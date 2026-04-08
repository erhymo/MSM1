import "server-only";

import { generateModelReviewNarrative } from "@/lib/ai/model-review";
import { modelReviewConfig } from "@/lib/config/model-review";
import { adminDb } from "@/lib/firebase/admin";
import { getRecentRecommendationAudits, writeModelReviewReport } from "@/lib/firebase/firestore-model-review-service";
import { writeSystemLog } from "@/lib/firebase/firestore-system-log-service";
import { refreshRecommendationAuditOutcomes } from "@/lib/model-review/evaluator";
import { buildModelReviewMetrics } from "@/lib/model-review/metrics";

export type ModelReviewRunTrigger = "cron" | "manual";

function getDurationMs(startedAt: string, completedAt: string) {
  return Math.max(0, new Date(completedAt).getTime() - new Date(startedAt).getTime());
}

function ensurePersistenceAvailable() {
  if (!adminDb) throw new Error("Firebase Admin / Firestore is required for model-review persistence.");
}

export async function runRecommendationOutcomeRefresh(trigger: ModelReviewRunTrigger, dryRun = false) {
  ensurePersistenceAvailable();
  const startedAt = new Date().toISOString();
  const refreshed = await refreshRecommendationAuditOutcomes({ dryRun });
  const completedAt = new Date().toISOString();
  const result = {
    trigger,
    startedAt,
    completedAt,
    durationMs: getDurationMs(startedAt, completedAt),
    ...refreshed,
    status: refreshed.auditsUpdated > 0 ? "ok" : "warning",
  } as const;

  await writeSystemLog({
    level: result.status === "ok" ? "info" : "warning",
    scope: "model-review",
    message: dryRun ? "Model-review outcome refresh dry-run completed" : "Model-review outcome refresh completed",
    details: {
      trigger,
      auditsConsidered: result.auditsConsidered,
      auditsUpdated: result.auditsUpdated,
      readyWindows: result.readyWindows,
      pendingWindows: result.pendingWindows,
      durationMs: result.durationMs,
    },
  }).catch(() => undefined);

  return result;
}

export async function runModelReviewReport(trigger: ModelReviewRunTrigger, dryRun = false) {
  ensurePersistenceAvailable();
  const startedAt = new Date().toISOString();
  const audits = await getRecentRecommendationAudits(modelReviewConfig.reportLookbackHours);
  const completeAudits = audits.filter((audit) => audit.outcomes.some((item) => item.horizonHours === modelReviewConfig.reportHorizonHours && item.status === "ready"));
  const metrics = buildModelReviewMetrics(completeAudits, modelReviewConfig.reportHorizonHours);
  const narrative = await generateModelReviewNarrative({
    horizonHours: modelReviewConfig.reportHorizonHours,
    completeAuditCount: completeAudits.length,
    metrics,
  });

  const report = {
    reportId: `latest-${modelReviewConfig.reportHorizonHours}h`,
    generatedAt: new Date().toISOString(),
    horizonHours: modelReviewConfig.reportHorizonHours,
    sourceAuditCount: audits.length,
    completeAuditCount: completeAudits.length,
    reviewMode: narrative.reviewMode,
    headline: narrative.headline,
    summary: narrative.summary,
    recommendations: narrative.recommendations,
    metrics,
  } as const;

  if (!dryRun) await writeModelReviewReport(report);
  const completedAt = new Date().toISOString();
  const result = { trigger, dryRun, startedAt, completedAt, durationMs: getDurationMs(startedAt, completedAt), ...report };

  await writeSystemLog({
    level: completeAudits.length >= modelReviewConfig.minSamplesPerBucket ? "info" : "warning",
    scope: "model-review",
    message: dryRun ? "Model-review report dry-run completed" : "Model-review report generated",
    details: {
      trigger,
      reportId: report.reportId,
      sourceAudits: report.sourceAuditCount,
      completeAudits: report.completeAuditCount,
      horizonHours: report.horizonHours,
      durationMs: result.durationMs,
    },
  }).catch(() => undefined);

  return result;
}
