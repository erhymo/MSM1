import type { SentimentDataProvider } from "@/lib/providers/types";
import type { Instrument } from "@/lib/types/analysis";
import { getMockInstrumentSeed } from "@/lib/mock/provider-seeds";

function hoursAgoToIso(hoursAgo: number) {
  return new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString();
}

function buildHistory(retailLong: number) {
  return Array.from({ length: 8 }, (_, index) => ({
    label: `S${index + 1}`,
    value: Number((retailLong + Math.sin(index * 1.35) * 4.2).toFixed(1)),
  }));
}

export const mockSentimentProvider: SentimentDataProvider = {
  async getSnapshot(instrument: Instrument) {
    const seed = getMockInstrumentSeed(instrument.ticker);
    const updatedAt = hoursAgoToIso(seed.sentimentUpdatedHoursAgo);

    return {
      ticker: instrument.ticker,
      source: "mock-sentiment-provider",
      retailLong: seed.retailLong,
      retailShort: Number((100 - seed.retailLong).toFixed(1)),
      history: buildHistory(seed.retailLong),
      updatedAt,
      freshness: {
        mode: seed.sentimentFreshness,
        updatedAt,
        note: seed.sentimentFreshness === "live" ? "Latest retail sentiment snapshot" : "Using last stored retail sentiment snapshot",
      },
    };
  },
};