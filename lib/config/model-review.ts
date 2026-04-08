import "server-only";

export type ModelReviewAIMode = "auto" | "template" | "openai";

function toPositiveNumber(value: string | undefined, fallback: number, minimum: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(minimum, parsed) : fallback;
}

function toAIMode(value: string | undefined): ModelReviewAIMode {
  const normalized = value?.toLowerCase();
  if (normalized === "template" || normalized === "openai" || normalized === "auto") return normalized;
  return "auto";
}

function toOutcomeWindows(value: string | undefined) {
  const parsed = (value ?? "24,120,240")
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isFinite(item) && item >= 1)
    .map((item) => Math.floor(item));

  return [...new Set(parsed)].sort((left, right) => left - right);
}

const outcomeWindowsHours = toOutcomeWindows(process.env.MODEL_REVIEW_OUTCOME_WINDOWS_HOURS);
const maxOutcomeWindowHours = outcomeWindowsHours.at(-1) ?? 240;

export const modelReviewConfig = {
  outcomeWindowsHours,
  reportHorizonHours: toPositiveNumber(process.env.MODEL_REVIEW_REPORT_HORIZON_HOURS, 120, 1),
  auditLookbackHours: toPositiveNumber(process.env.MODEL_REVIEW_AUDIT_LOOKBACK_HOURS, maxOutcomeWindowHours + 72, maxOutcomeWindowHours),
  reportLookbackHours: toPositiveNumber(process.env.MODEL_REVIEW_REPORT_LOOKBACK_HOURS, 24 * 14, maxOutcomeWindowHours),
  maxAuditsPerRun: toPositiveNumber(process.env.MODEL_REVIEW_MAX_AUDITS_PER_RUN, 6000, 100),
  minSamplesPerBucket: toPositiveNumber(process.env.MODEL_REVIEW_MIN_SAMPLES_PER_BUCKET, 8, 1),
  sourceLabel: "model-review-agent",
  aiMode: toAIMode(process.env.MODEL_REVIEW_AI_MODE),
  aiModel: process.env.MODEL_REVIEW_AI_MODEL ?? process.env.AI_SUMMARY_MODEL ?? "gpt-4o-mini",
  aiTimeoutMs: toPositiveNumber(process.env.MODEL_REVIEW_AI_TIMEOUT_MS, 12_000, 3_000),
  openAiApiKey: process.env.OPENAI_API_KEY,
  openAiBaseUrl: "https://api.openai.com/v1",
} as const;

export function shouldUseOpenAIModelReviewMode() {
  if (modelReviewConfig.aiMode === "template") return false;
  if (!modelReviewConfig.openAiApiKey) return false;
  return modelReviewConfig.aiMode === "auto" || modelReviewConfig.aiMode === "openai";
}
