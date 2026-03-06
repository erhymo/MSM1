import type { MarketRegime } from "@/lib/types/analysis";

export type MockInstrumentSeed = {
  price: number;
  weeklyBias: number;
  dailyBias: number;
  fourHourBias: number;
  cotScore: number;
  retailLong: number;
  atrPercent: number;
  regimeHint: MarketRegime;
  priceFreshness: "live" | "fallback";
  sentimentFreshness: "live" | "fallback";
  cotFreshness: "live" | "fallback";
  volatilityFreshness: "live" | "fallback";
  priceUpdatedHoursAgo: number;
  sentimentUpdatedHoursAgo: number;
  cotUpdatedDaysAgo: number;
  volatilityUpdatedHoursAgo: number;
};

export const mockInstrumentSeeds: Record<string, MockInstrumentSeed> = {
  EURUSD: { price: 1.0942, weeklyBias: 82, dailyBias: 88, fourHourBias: 72, cotScore: 90, retailLong: 28, atrPercent: 0.85, regimeHint: "Trending", priceFreshness: "live", sentimentFreshness: "live", cotFreshness: "live", volatilityFreshness: "live", priceUpdatedHoursAgo: 1, sentimentUpdatedHoursAgo: 1, cotUpdatedDaysAgo: 2, volatilityUpdatedHoursAgo: 1 },
  GBPUSD: { price: 1.2765, weeklyBias: 64, dailyBias: 70, fourHourBias: 60, cotScore: 72, retailLong: 36, atrPercent: 0.92, regimeHint: "Trending", priceFreshness: "live", sentimentFreshness: "live", cotFreshness: "live", volatilityFreshness: "live", priceUpdatedHoursAgo: 2, sentimentUpdatedHoursAgo: 2, cotUpdatedDaysAgo: 2, volatilityUpdatedHoursAgo: 2 },
  USDJPY: { price: 149.24, weeklyBias: -66, dailyBias: -60, fourHourBias: -54, cotScore: -70, retailLong: 63, atrPercent: 0.95, regimeHint: "Trending", priceFreshness: "live", sentimentFreshness: "live", cotFreshness: "live", volatilityFreshness: "live", priceUpdatedHoursAgo: 1, sentimentUpdatedHoursAgo: 1, cotUpdatedDaysAgo: 2, volatilityUpdatedHoursAgo: 1 },
  AUDUSD: { price: 0.6584, weeklyBias: 46, dailyBias: 52, fourHourBias: 40, cotScore: 60, retailLong: 33, atrPercent: 0.75, regimeHint: "Ranging", priceFreshness: "live", sentimentFreshness: "live", cotFreshness: "live", volatilityFreshness: "live", priceUpdatedHoursAgo: 3, sentimentUpdatedHoursAgo: 3, cotUpdatedDaysAgo: 2, volatilityUpdatedHoursAgo: 3 },
  USDCAD: { price: 1.3531, weeklyBias: 8, dailyBias: 10, fourHourBias: 5, cotScore: 5, retailLong: 49, atrPercent: 0.65, regimeHint: "Ranging", priceFreshness: "fallback", sentimentFreshness: "live", cotFreshness: "live", volatilityFreshness: "fallback", priceUpdatedHoursAgo: 5, sentimentUpdatedHoursAgo: 2, cotUpdatedDaysAgo: 2, volatilityUpdatedHoursAgo: 5 },
  USDCHF: { price: 0.8826, weeklyBias: -5, dailyBias: -12, fourHourBias: -8, cotScore: -3, retailLong: 52, atrPercent: 0.6, regimeHint: "Ranging", priceFreshness: "live", sentimentFreshness: "live", cotFreshness: "live", volatilityFreshness: "live", priceUpdatedHoursAgo: 2, sentimentUpdatedHoursAgo: 2, cotUpdatedDaysAgo: 2, volatilityUpdatedHoursAgo: 2 },
  NZDUSD: { price: 0.6127, weeklyBias: 42, dailyBias: 50, fourHourBias: 38, cotScore: 58, retailLong: 31, atrPercent: 0.8, regimeHint: "Trending", priceFreshness: "live", sentimentFreshness: "live", cotFreshness: "live", volatilityFreshness: "live", priceUpdatedHoursAgo: 2, sentimentUpdatedHoursAgo: 2, cotUpdatedDaysAgo: 2, volatilityUpdatedHoursAgo: 2 },
  USDNOK: { price: 10.54, weeklyBias: -55, dailyBias: -48, fourHourBias: -52, cotScore: -62, retailLong: 59, atrPercent: 2.4, regimeHint: "Volatile", priceFreshness: "fallback", sentimentFreshness: "live", cotFreshness: "live", volatilityFreshness: "fallback", priceUpdatedHoursAgo: 7, sentimentUpdatedHoursAgo: 3, cotUpdatedDaysAgo: 2, volatilityUpdatedHoursAgo: 8 },
  USDSEK: { price: 10.31, weeklyBias: -46, dailyBias: -40, fourHourBias: -35, cotScore: -58, retailLong: 61, atrPercent: 2.1, regimeHint: "Volatile", priceFreshness: "live", sentimentFreshness: "live", cotFreshness: "live", volatilityFreshness: "live", priceUpdatedHoursAgo: 2, sentimentUpdatedHoursAgo: 2, cotUpdatedDaysAgo: 2, volatilityUpdatedHoursAgo: 2 },
  USDMXN: { price: 16.93, weeklyBias: -88, dailyBias: -86, fourHourBias: -82, cotScore: -90, retailLong: 68, atrPercent: 1.2, regimeHint: "Trending", priceFreshness: "live", sentimentFreshness: "live", cotFreshness: "live", volatilityFreshness: "live", priceUpdatedHoursAgo: 1, sentimentUpdatedHoursAgo: 1, cotUpdatedDaysAgo: 2, volatilityUpdatedHoursAgo: 1 },
  EURGBP: { price: 0.8571, weeklyBias: 4, dailyBias: 8, fourHourBias: 2, cotScore: 4, retailLong: 47, atrPercent: 0.45, regimeHint: "Ranging", priceFreshness: "live", sentimentFreshness: "live", cotFreshness: "live", volatilityFreshness: "live", priceUpdatedHoursAgo: 3, sentimentUpdatedHoursAgo: 3, cotUpdatedDaysAgo: 2, volatilityUpdatedHoursAgo: 3 },
  GBPJPY: { price: 190.84, weeklyBias: 55, dailyBias: 60, fourHourBias: 66, cotScore: 62, retailLong: 34, atrPercent: 1.45, regimeHint: "Trending", priceFreshness: "live", sentimentFreshness: "live", cotFreshness: "live", volatilityFreshness: "live", priceUpdatedHoursAgo: 1, sentimentUpdatedHoursAgo: 1, cotUpdatedDaysAgo: 2, volatilityUpdatedHoursAgo: 1 },
  XAUUSD: { price: 2148.4, weeklyBias: 78, dailyBias: 84, fourHourBias: 70, cotScore: 86, retailLong: 27, atrPercent: 1.35, regimeHint: "Trending", priceFreshness: "live", sentimentFreshness: "live", cotFreshness: "live", volatilityFreshness: "live", priceUpdatedHoursAgo: 1, sentimentUpdatedHoursAgo: 1, cotUpdatedDaysAgo: 2, volatilityUpdatedHoursAgo: 1 },
  XBRUSD: { price: 82.36, weeklyBias: 10, dailyBias: 6, fourHourBias: -4, cotScore: 2, retailLong: 51, atrPercent: 3.2, regimeHint: "Volatile", priceFreshness: "live", sentimentFreshness: "live", cotFreshness: "live", volatilityFreshness: "live", priceUpdatedHoursAgo: 2, sentimentUpdatedHoursAgo: 2, cotUpdatedDaysAgo: 2, volatilityUpdatedHoursAgo: 2 },
  SPX500: { price: 5124.5, weeklyBias: 68, dailyBias: 75, fourHourBias: 64, cotScore: 74, retailLong: 39, atrPercent: 1.05, regimeHint: "Trending", priceFreshness: "live", sentimentFreshness: "live", cotFreshness: "live", volatilityFreshness: "live", priceUpdatedHoursAgo: 1, sentimentUpdatedHoursAgo: 1, cotUpdatedDaysAgo: 2, volatilityUpdatedHoursAgo: 1 },
};

export function getMockInstrumentSeed(ticker: string) {
  const seed = mockInstrumentSeeds[ticker];

  if (!seed) {
    throw new Error(`Missing mock seed for ${ticker}`);
  }

  return seed;
}