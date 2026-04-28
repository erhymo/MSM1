import "server-only";

import { modelReviewConfig, shouldUseOpenAIModelReviewMode } from "@/lib/config/model-review";
import type { FirestoreModelReviewReportDocument } from "@/lib/types/firestore";

type ModelReviewNarrative = Pick<FirestoreModelReviewReportDocument, "headline" | "summary" | "recommendations" | "reviewMode">;

function buildTemplateNarrative(input: Pick<FirestoreModelReviewReportDocument, "horizonHours" | "completeAuditCount" | "metrics">): ModelReviewNarrative {
  const strongest = [...input.metrics.bySignal].sort((left, right) => right.hitRatePercent - left.hitRatePercent)[0];
  const weakest = [...input.metrics.bySignal].sort((left, right) => left.hitRatePercent - right.hitRatePercent)[0];
  const strongestTactical = [...(input.metrics.byTacticalAction ?? [])].sort((left, right) => right.hitRatePercent - left.hitRatePercent)[0];
  const live = input.metrics.byFreshnessMode.find((row) => row.label === "live");
  const fallback = input.metrics.byFreshnessMode.find((row) => row.label === "fallback");
  const recommendations = [
    weakest ? `Review ${weakest.label} thresholds first; it is the weakest signal bucket at ${weakest.hitRatePercent}% directional hit rate.` : "Collect more completed audits before changing thresholds.",
    strongest ? `Preserve the structure behind ${strongest.label}; it currently leads the pack with ${strongest.hitRatePercent}% hit rate.` : "Wait for a larger sample before promoting any single signal bucket.",
    live && fallback && live.hitRatePercent > fallback.hitRatePercent
      ? `Treat fallback-fed recommendations more conservatively; live data is outperforming fallback by ${Math.max(0, live.hitRatePercent - fallback.hitRatePercent).toFixed(1)} percentage points.`
      : "Data freshness is not showing a clear penalty yet; keep monitoring live vs fallback splits before tightening filters.",
    strongestTactical ? `Use tactical ${strongestTactical.label} as the first timing bucket to review; it has ${strongestTactical.samples} samples and ${strongestTactical.hitRatePercent}% tactical hit rate.` : "Collect more tactical samples before changing timing thresholds.",
  ];

  return {
    reviewMode: "template",
    headline: `${input.completeAuditCount} completed audits reviewed over ${input.horizonHours}h horizon`,
    summary: `Directional hit rate is ${input.metrics.total.hitRatePercent}% with average directional return ${input.metrics.total.avgReturnPercent}%. The strongest signal bucket is ${strongest?.label ?? "n/a"}, while ${weakest?.label ?? "n/a"} currently lags and deserves the next calibration pass.`,
    recommendations: recommendations.slice(0, 3),
  };
}

function buildPrompt(input: Pick<FirestoreModelReviewReportDocument, "horizonHours" | "completeAuditCount" | "metrics">) {
  return [
    `Review ${input.completeAuditCount} completed recommendation audits over a ${input.horizonHours}-hour horizon.`,
    "Reply in exactly this format:",
    "HEADLINE: ...",
    "SUMMARY: ...",
    "- recommendation 1",
    "- recommendation 2",
    "- recommendation 3",
    `METRICS: ${JSON.stringify(input.metrics)}`,
  ].join("\n");
}

function parseNarrative(candidate: string): ModelReviewNarrative | null {
  const lines = candidate.split("\n").map((line) => line.trim()).filter(Boolean);
  const headline = lines.find((line) => line.startsWith("HEADLINE:"))?.replace(/^HEADLINE:\s*/, "");
  const summary = lines.find((line) => line.startsWith("SUMMARY:"))?.replace(/^SUMMARY:\s*/, "");
  const recommendations = lines.filter((line) => line.startsWith("- ")).map((line) => line.replace(/^-\s*/, ""));
  if (!headline || !summary || recommendations.length < 2) return null;
  return { reviewMode: "openai", headline, summary, recommendations: recommendations.slice(0, 3) };
}

export async function generateModelReviewNarrative(
  input: Pick<FirestoreModelReviewReportDocument, "horizonHours" | "completeAuditCount" | "metrics">,
): Promise<ModelReviewNarrative> {
  const fallback = buildTemplateNarrative(input);
  if (!shouldUseOpenAIModelReviewMode()) return fallback;

  const response = await fetch(`${modelReviewConfig.openAiBaseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${modelReviewConfig.openAiApiKey}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(modelReviewConfig.aiTimeoutMs),
    body: JSON.stringify({
      model: modelReviewConfig.aiModel,
      temperature: 0.1,
      max_tokens: 220,
      messages: [
        { role: "system", content: "You review backtested recommendation metrics. Never invent data and keep recommendations concrete and conservative." },
        { role: "user", content: buildPrompt(input) },
      ],
    }),
  });

  if (!response.ok) return fallback;
  const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string | null } }> };
  return parseNarrative(payload.choices?.[0]?.message?.content ?? "") ?? fallback;
}
