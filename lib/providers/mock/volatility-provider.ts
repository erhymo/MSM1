import type { VolatilityDataProvider } from "@/lib/providers/types";
import type { Instrument, MarketRegime } from "@/lib/types/analysis";
import { getMockInstrumentSeed } from "@/lib/mock/provider-seeds";

function hoursAgoToIso(hoursAgo: number) {
  return new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString();
}

function buildHistory(atrPercent: number, regimeHint: MarketRegime) {
  const amplitude = regimeHint === "Volatile" ? 0.26 : regimeHint === "Trending" ? 0.14 : 0.08;

  return Array.from({ length: 8 }, (_, index) => ({
    label: `V${index + 1}`,
    value: Number((atrPercent + Math.sin(index * 1.15) * amplitude + (index - 7) * 0.02).toFixed(2)),
  }));
}

export const mockVolatilityProvider: VolatilityDataProvider = {
  async getSnapshot(instrument: Instrument) {
    const seed = getMockInstrumentSeed(instrument.ticker);
    const updatedAt = hoursAgoToIso(seed.volatilityUpdatedHoursAgo);

    return {
      ticker: instrument.ticker,
      atrPercent: seed.atrPercent,
      realizedVolatility: Number((seed.atrPercent * (seed.regimeHint === "Volatile" ? 1.35 : 1.12)).toFixed(2)),
      regimeHint: seed.regimeHint,
      history: buildHistory(seed.atrPercent, seed.regimeHint),
      updatedAt,
      freshness: {
        mode: seed.volatilityFreshness,
        updatedAt,
        note: seed.volatilityFreshness === "live" ? "Latest volatility snapshot" : "Using last stored volatility snapshot",
      },
    };
  },
};