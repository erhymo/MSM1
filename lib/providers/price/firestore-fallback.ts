import { getLatestRawMarketEntry } from "@/lib/firebase/firestore-raw-market-service";
import type { Instrument, PriceSnapshot, Timeframe, TimeframeIndicatorSnapshot, HistoryPoint } from "@/lib/types/analysis";
import type { FirestoreRawMarketDataDocument, FirestoreRawMarketValue } from "@/lib/types/firestore";

function isRecord(value: FirestoreRawMarketValue | undefined): value is Record<string, FirestoreRawMarketValue> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toNumber(value: FirestoreRawMarketValue | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function buildIndicatorSnapshot(timeframe: Timeframe, currentPrice: number, bias: number): TimeframeIndicatorSnapshot {
  const spread = currentPrice * Math.max(0.0025, Math.abs(bias) / 1800);
  const direction = Math.sign(bias) || 1;

  return {
    timeframe,
    bias,
    ema20: Number((currentPrice + direction * spread).toFixed(4)),
    ema50: Number((currentPrice - direction * spread).toFixed(4)),
    macdHistogram: Number((bias / 22).toFixed(2)),
  };
}

function buildPriceHistory(currentPrice: number, dailyBias: number, atrPercent: number): HistoryPoint[] {
  const direction = Math.sign(dailyBias) || 1;
  const drift = currentPrice * (Math.abs(dailyBias) / 10000);
  const volatility = currentPrice * (atrPercent / 100) * 0.45;

  return Array.from({ length: 16 }, (_, index) => {
    const step = index - 15;
    const value = currentPrice + step * drift * direction + Math.sin(index * 1.25) * volatility;

    return {
      label: `D${index + 1}`,
      value: Number(value.toFixed(4)),
    };
  });
}

function toTrendSnapshot(
  values: FirestoreRawMarketDataDocument["values"],
  key: "weeklyTrend" | "dailyTrend" | "fourHourMomentum",
  timeframe: Timeframe,
  currentPrice: number,
  legacyBiasKey: "weeklyBias" | "dailyBias" | "fourHourBias",
) {
  const nested = values[key];

  if (isRecord(nested)) {
    const bias = toNumber(nested.bias) ?? 0;
    return {
      timeframe,
      bias,
      ema20: toNumber(nested.ema20) ?? buildIndicatorSnapshot(timeframe, currentPrice, bias).ema20,
      ema50: toNumber(nested.ema50) ?? buildIndicatorSnapshot(timeframe, currentPrice, bias).ema50,
      macdHistogram: toNumber(nested.macdHistogram) ?? buildIndicatorSnapshot(timeframe, currentPrice, bias).macdHistogram,
    };
  }

  const legacyBias = toNumber(values[legacyBiasKey]) ?? 0;
  return buildIndicatorSnapshot(timeframe, currentPrice, legacyBias);
}

function toPriceHistory(value: FirestoreRawMarketValue | undefined) {
  if (!Array.isArray(value)) return undefined;

  const points = value
    .map((item) => {
      if (!isRecord(item)) return null;
      const label = typeof item.label === "string" ? item.label : null;
      const pointValue = toNumber(item.value);

      if (!label || typeof pointValue !== "number") return null;
      return { label, value: pointValue };
    })
    .filter((item): item is HistoryPoint => Boolean(item));

  return points.length ? points : undefined;
}

export async function getFirestoreFallbackPriceSnapshot(instrument: Instrument): Promise<PriceSnapshot | null> {
  const entry = await getLatestRawMarketEntry(instrument.ticker, "price");
  if (!entry) return null;

  const currentPrice = toNumber(entry.values.currentPrice);
  if (typeof currentPrice !== "number") return null;

  const atr14 = toNumber(entry.values.atr14);
  const atrPercent = toNumber(entry.values.atrPercent) ?? (atr14 && currentPrice ? (atr14 / currentPrice) * 100 : 0.8);
  const dailyTrend = toTrendSnapshot(entry.values, "dailyTrend", "1D", currentPrice, "dailyBias");

  return {
    ticker: instrument.ticker,
    source: entry.source,
    currentPrice,
    atr14: atr14 ?? Number((currentPrice * (atrPercent / 100)).toFixed(4)),
    atrPercent: Number(atrPercent.toFixed(2)),
    weeklyTrend: toTrendSnapshot(entry.values, "weeklyTrend", "1W", currentPrice, "weeklyBias"),
    dailyTrend,
    fourHourMomentum: toTrendSnapshot(entry.values, "fourHourMomentum", "4H", currentPrice, "fourHourBias"),
    priceHistory: toPriceHistory(entry.values.priceHistory) ?? buildPriceHistory(currentPrice, dailyTrend.bias, atrPercent),
    updatedAt: entry.capturedAt,
    freshness: {
      mode: "fallback",
      updatedAt: entry.capturedAt,
      note: `Using last stored ${entry.source} price snapshot from Firestore`,
    },
  };
}