import type { COTDataProvider } from "@/lib/providers/types";
import type { Instrument } from "@/lib/types/analysis";
import { getMockInstrumentSeed } from "@/lib/mock/provider-seeds";

function daysAgoToIso(daysAgo: number) {
  return new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();
}

function mapBias(score: number) {
  if (score >= 25) return "Bullish" as const;
  if (score <= -25) return "Bearish" as const;
  return "Neutral" as const;
}

function buildHistory(score: number) {
  return Array.from({ length: 8 }, (_, index) => ({
    label: `W${index + 1}`,
    value: Math.round(score - (7 - index) * Math.sign(score || 1) * 4),
  }));
}

export const mockCotProvider: COTDataProvider = {
  async getSnapshot(instrument: Instrument) {
    const seed = getMockInstrumentSeed(instrument.ticker);
    const updatedAt = daysAgoToIso(seed.cotUpdatedDaysAgo);

    return {
      ticker: instrument.ticker,
      source: "mock-cot-provider",
      bias: mapBias(seed.cotScore),
      netPosition: seed.cotScore,
      history: buildHistory(seed.cotScore),
      market: {
        strategy: "proxy",
        label: "Mock weekly positioning model",
        note: "Used only when live COT data and Firestore fallback are unavailable",
        components: [],
      },
      updatedAt,
      freshness: {
        mode: seed.cotFreshness,
        updatedAt,
        note: seed.cotFreshness === "live" ? "Latest weekly COT snapshot" : "Using last stored weekly COT snapshot",
      },
    };
  },
};