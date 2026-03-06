export type SupportedSentimentProvider = "dukascopy-realtime";

const requestedProvider = process.env.SENTIMENT_PROVIDER;
const requestedLiquidity = process.env.SENTIMENT_PROVIDER_LIQUIDITY;

export const sentimentProviderConfig = {
  provider: (requestedProvider === "dukascopy-realtime" ? requestedProvider : "dukascopy-realtime") as SupportedSentimentProvider,
  baseUrl: process.env.SENTIMENT_PROVIDER_BASE_URL ?? "https://freeserv.dukascopy.com/2.0/api/",
  widgetKey: process.env.SENTIMENT_PROVIDER_WIDGET_KEY ?? "bsq3l3p5lc8w4s0c",
  timeoutMs: Math.max(2_000, Number(process.env.SENTIMENT_PROVIDER_TIMEOUT_MS ?? 12_000)),
  liquidity: (requestedLiquidity === "providers" ? requestedLiquidity : "consumers") as "consumers" | "providers",
  type: process.env.SENTIMENT_PROVIDER_TYPE ?? "swfx",
  referer: process.env.SENTIMENT_PROVIDER_REFERER ?? "https://www.dukascopy.com/swiss/english/marketwatch/sentiment/",
  userAgent: process.env.SENTIMENT_PROVIDER_USER_AGENT ?? "Mozilla/5.0 (compatible; MSM1/1.0)",
  historyPoints: 8,
  staleAfterHours: Math.max(1, Number(process.env.SENTIMENT_STALE_AFTER_HOURS ?? 6)),
} as const;