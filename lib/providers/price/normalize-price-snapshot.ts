import type { Instrument, PriceSnapshot, Timeframe, TimeframeIndicatorSnapshot } from "@/lib/types/analysis";

import { priceProviderConfig } from "@/lib/providers/price/config";

export type RemotePriceBar = {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
};

type NormalizePriceSnapshotInput = {
  instrument: Instrument;
  source: string;
  bars: RemotePriceBar[];
  updatedAt: string;
  freshnessMode?: PriceSnapshot["freshness"]["mode"];
  freshnessNote?: string;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function round(value: number, digits: number) {
  return Number(value.toFixed(digits));
}

function getPercentChange(current: number, previous: number) {
  if (!previous) return 0;
  return ((current - previous) / previous) * 100;
}

function buildEmaSeries(values: number[], period: number) {
  if (!values.length) return [];

  const multiplier = 2 / (period + 1);
  const series: number[] = [values[0]];

  for (let index = 1; index < values.length; index += 1) {
    series.push(values[index] * multiplier + series[index - 1] * (1 - multiplier));
  }

  return series;
}

function getLastEma(values: number[], period: number) {
  if (!values.length) return 0;
  return buildEmaSeries(values, Math.max(2, Math.min(period, values.length))).at(-1) ?? values.at(-1) ?? 0;
}

function getMacdHistogram(values: number[]) {
  if (!values.length) return 0;

  const ema12 = buildEmaSeries(values, Math.max(2, Math.min(12, values.length)));
  const ema26 = buildEmaSeries(values, Math.max(2, Math.min(26, values.length)));
  const macdLine = values.map((_, index) => (ema12[index] ?? values[index]) - (ema26[index] ?? values[index]));
  const signalLine = buildEmaSeries(macdLine, Math.max(2, Math.min(9, macdLine.length)));

  return (macdLine.at(-1) ?? 0) - (signalLine.at(-1) ?? 0);
}

function getAtr14(bars: RemotePriceBar[]) {
  if (!bars.length) return 0;

  const trueRanges = bars.map((bar, index) => {
    const previousClose = bars[Math.max(0, index - 1)]?.close ?? bar.close;
    return Math.max(bar.high - bar.low, Math.abs(bar.high - previousClose), Math.abs(bar.low - previousClose));
  });

  const recent = trueRanges.slice(-14);
  const average = recent.reduce((sum, value) => sum + value, 0) / Math.max(1, recent.length);

  return average;
}

function toHistoryLabel(isoDate: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    timeZone: "UTC",
  }).format(new Date(isoDate));
}

function buildTimeframeIndicatorSnapshot(timeframe: Timeframe, closes: number[], lookback: number): TimeframeIndicatorSnapshot {
  const currentPrice = closes.at(-1) ?? 0;
  const previous = closes.at(Math.max(0, closes.length - 1 - lookback)) ?? currentPrice;
  const ema20 = getLastEma(closes, 20);
  const ema50 = getLastEma(closes, 50);
  const macdHistogram = getMacdHistogram(closes);

  const priceVsEmaScore = getPercentChange(currentPrice, ema20) * 180;
  const emaSpreadScore = getPercentChange(ema20, ema50) * 220;
  const momentumScore = getPercentChange(currentPrice, previous) * 160;
  const macdScore = ((macdHistogram / Math.max(Math.abs(currentPrice), 0.0001)) * 100) * 380;

  return {
    timeframe,
    bias: clamp(Math.round(priceVsEmaScore + emaSpreadScore + momentumScore + macdScore), -100, 100),
    ema20: round(ema20, 4),
    ema50: round(ema50, 4),
    macdHistogram: round(macdHistogram, 2),
  };
}

export function normalizePriceSnapshot(input: NormalizePriceSnapshotInput): PriceSnapshot {
  const bars = [...input.bars].sort((left, right) => left.timestamp.localeCompare(right.timestamp));
  const closes = bars.map((bar) => bar.close);
  const currentPrice = round(closes.at(-1) ?? 0, 4);
  const atr14 = round(getAtr14(bars), 4);
  const atrPercent = round(currentPrice ? (atr14 / currentPrice) * 100 : 0, 2);

  return {
    ticker: input.instrument.ticker,
    source: input.source,
    currentPrice,
    atr14,
    atrPercent,
    weeklyTrend: buildTimeframeIndicatorSnapshot("1W", closes, 20),
    dailyTrend: buildTimeframeIndicatorSnapshot("1D", closes, 5),
    fourHourMomentum: buildTimeframeIndicatorSnapshot("4H", closes, 3),
    priceHistory: bars.slice(-priceProviderConfig.historyPoints).map((bar) => ({
      label: toHistoryLabel(bar.timestamp),
      value: round(bar.close, 4),
    })),
    updatedAt: input.updatedAt,
    freshness: {
      mode: input.freshnessMode ?? "live",
      updatedAt: input.updatedAt,
      note: input.freshnessNote ?? `Latest ${input.source} snapshot`,
    },
  };
}