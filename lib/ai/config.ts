import "server-only";

export type AISummaryMode = "auto" | "template" | "openai";

function toPositiveNumber(value: string | undefined, fallback: number, minimum: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(minimum, parsed) : fallback;
}

function toSummaryMode(value: string | undefined): AISummaryMode {
  const normalized = value?.toLowerCase();

  if (normalized === "template" || normalized === "openai" || normalized === "auto") {
    return normalized;
  }

  return "auto";
}

export const aiSummaryConfig = {
  enabled: process.env.ENABLE_AI_SUMMARY !== "false",
  mode: toSummaryMode(process.env.AI_SUMMARY_MODE),
  model: process.env.AI_SUMMARY_MODEL ?? "gpt-4o-mini",
  timeoutMs: toPositiveNumber(process.env.AI_SUMMARY_TIMEOUT_MS, 12_000, 3_000),
  maxSummaryCharacters: 240,
  openAiApiKey: process.env.OPENAI_API_KEY,
  openAiBaseUrl: "https://api.openai.com/v1",
} as const;

export function shouldUseOpenAISummaryMode() {
  if (!aiSummaryConfig.enabled) return false;
  if (aiSummaryConfig.mode === "template") return false;
  if (!aiSummaryConfig.openAiApiKey) return false;

  return aiSummaryConfig.mode === "auto" || aiSummaryConfig.mode === "openai";
}