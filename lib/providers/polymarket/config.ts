export const polymarketProviderConfig = {
  baseUrl: process.env.POLYMARKET_BASE_URL ?? "https://gamma-api.polymarket.com",
  timeoutMs: Math.max(2_000, Number(process.env.POLYMARKET_TIMEOUT_MS ?? 8_000)),
  userAgent: process.env.POLYMARKET_USER_AGENT ?? "Mozilla/5.0 (compatible; MSM1/1.0)",
} as const;