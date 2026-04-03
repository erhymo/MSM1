export const newsProviderConfig = {
  baseUrl: process.env.GDELT_DOC_BASE_URL ?? "https://api.gdeltproject.org/api/v2/doc/doc",
  timeoutMs: Math.max(2_000, Number(process.env.GDELT_DOC_TIMEOUT_MS ?? 8_000)),
} as const;