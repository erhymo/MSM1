import type { PriceDataProvider } from "@/lib/providers/types";
import type { Instrument, Timeframe, TimeframeIndicatorSnapshot } from "@/lib/types/analysis";
import { getMockInstrumentSeed } from "@/lib/mock/provider-seeds";

function hoursAgoToIso(hoursAgo: number) {
  return new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString();
}

function buildIndicatorSnapshot(timeframe: Timeframe, price: number, bias: number): TimeframeIndicatorSnapshot {
  const spread = price * Math.max(0.0025, Math.abs(bias) / 1800);
  const direction = Math.sign(bias) || 1;

  return {
    timeframe,
    bias,
    ema20: Number((price + direction * spread).toFixed(4)),
    ema50: Number((price - direction * spread).toFixed(4)),
    macdHistogram: Number((bias / 22).toFixed(2)),
  };
}

function buildPriceHistory(price: number, dailyBias: number, atrPercent: number) {
  const direction = Math.sign(dailyBias) || 1;
  const drift = price * (Math.abs(dailyBias) / 10000);
  const volatility = price * (atrPercent / 100) * 0.45;

  return Array.from({ length: 16 }, (_, index) => {
    const step = index - 15;
    const value = price + step * drift * direction + Math.sin(index * 1.25) * volatility;

    return {
      label: `D${index + 1}`,
      value: Number(value.toFixed(4)),
    };
  });
}

export const mockPriceProvider: PriceDataProvider = {
  async getSnapshot(instrument: Instrument) {
    const seed = getMockInstrumentSeed(instrument.ticker);
    const updatedAt = hoursAgoToIso(seed.priceUpdatedHoursAgo);

    return {
      ticker: instrument.ticker,
      source: "mock-price-provider",
      currentPrice: seed.price,
      atr14: Number((seed.price * (seed.atrPercent / 100)).toFixed(4)),
      atrPercent: seed.atrPercent,
      weeklyTrend: buildIndicatorSnapshot("1W", seed.price, seed.weeklyBias),
      dailyTrend: buildIndicatorSnapshot("1D", seed.price, seed.dailyBias),
      fourHourMomentum: buildIndicatorSnapshot("4H", seed.price, seed.fourHourBias),
      priceHistory: buildPriceHistory(seed.price, seed.dailyBias, seed.atrPercent),
      updatedAt,
      freshness: {
        mode: seed.priceFreshness,
        updatedAt,
        note: seed.priceFreshness === "live" ? "Latest provider snapshot" : "Using last stored provider snapshot",
      },
    };
  },
};