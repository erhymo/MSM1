export type SupportedPriceProvider = "yahoo-chart";

const requestedProvider = process.env.PRICE_PROVIDER;

export const priceProviderConfig = {
  provider: (requestedProvider === "yahoo-chart" ? requestedProvider : "yahoo-chart") as SupportedPriceProvider,
  baseUrl: process.env.PRICE_PROVIDER_BASE_URL ?? "https://query2.finance.yahoo.com/v8/finance/chart",
  timeoutMs: Math.max(2_000, Number(process.env.PRICE_PROVIDER_TIMEOUT_MS ?? 12_000)),
  userAgent: process.env.PRICE_PROVIDER_USER_AGENT ?? "Mozilla/5.0 (compatible; MSM1/1.0)",
  exchangeRateApiKey: process.env.EXCHANGE_RATE_API_KEY,
  exchangeRateApiBaseUrl: process.env.EXCHANGE_RATE_API_BASE_URL ?? "https://v6.exchangerate-api.com/v6",
  exchangeRateApiTimeoutMs: Math.max(2_000, Number(process.env.EXCHANGE_RATE_API_TIMEOUT_MS ?? 12_000)),
  range: "3mo",
  interval: "1d",
  historyPoints: 16,
  exchangeRateFallbackHistoryPoints: 24,
} as const;