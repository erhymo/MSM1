export type SupportedCotProvider = "cftc-legacy-futures";

const requestedProvider = process.env.COT_PROVIDER;

export const cotProviderConfig = {
  provider: (requestedProvider === "cftc-legacy-futures" ? requestedProvider : "cftc-legacy-futures") as SupportedCotProvider,
  baseUrl: process.env.COT_PROVIDER_BASE_URL ?? "https://publicreporting.cftc.gov/resource/6dca-aqww.json",
  timeoutMs: Math.max(2_000, Number(process.env.COT_PROVIDER_TIMEOUT_MS ?? 12_000)),
  appToken: process.env.COT_PROVIDER_APP_TOKEN,
  historyPoints: 8,
  staleAfterHours: Math.max(24, Number(process.env.COT_STALE_AFTER_HOURS ?? 192)),
  updateDay: process.env.COT_UPDATE_DAY ?? "FRIDAY",
} as const;