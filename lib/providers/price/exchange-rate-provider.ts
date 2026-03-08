import "server-only";

import type { Instrument, PriceSnapshot, TimeframeIndicatorSnapshot } from "@/lib/types/analysis";

import { priceProviderConfig } from "@/lib/providers/price/config";
import { getInstrumentCurrencyPair } from "@/lib/utils/instrument-currency";

type ExchangeRateApiResponse = {
  result?: string;
  base_code?: string;
  target_code?: string;
  conversion_rate?: number;
  time_last_update_unix?: number;
  time_last_update_utc?: string;
  "error-type"?: string;
};

export type ExchangeRatePairQuote = {
  baseCurrency: string;
  quoteCurrency: string;
  rate: number;
  source: string;
  updatedAt: string;
};

function round(value: number, digits: number) {
  return Number(value.toFixed(digits));
}

function toHistoryLabel(isoDate: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    timeZone: "UTC",
  }).format(new Date(isoDate));
}

function scaleTrendSnapshot(snapshot: TimeframeIndicatorSnapshot, factor: number): TimeframeIndicatorSnapshot {
  return {
    timeframe: snapshot.timeframe,
    bias: snapshot.bias,
    ema20: round(snapshot.ema20 * factor, 4),
    ema50: round(snapshot.ema50 * factor, 4),
    macdHistogram: round(snapshot.macdHistogram * factor, 2),
  };
}

function buildNeutralTrendSnapshot(timeframe: TimeframeIndicatorSnapshot["timeframe"], currentPrice: number): TimeframeIndicatorSnapshot {
  return {
    timeframe,
    bias: 0,
    ema20: round(currentPrice, 4),
    ema50: round(currentPrice, 4),
    macdHistogram: 0,
  };
}

function buildSyntheticPriceHistory(currentPrice: number, atrPercent: number, updatedAt: string) {
  const historyPoints = priceProviderConfig.exchangeRateFallbackHistoryPoints;
  const anchorTime = new Date(updatedAt).getTime();
  const drift = currentPrice * 0.0014;
  const swing = Math.max(currentPrice * (atrPercent / 100) * 0.35, currentPrice * 0.001);

  return Array.from({ length: historyPoints }, (_, index) => {
    const step = index - (historyPoints - 1);
    const timestamp = new Date(anchorTime - (historyPoints - 1 - index) * 24 * 60 * 60 * 1000).toISOString();
    const rawValue = currentPrice + step * drift + Math.sin(index * 0.85) * swing;

    return {
      label: toHistoryLabel(timestamp),
      value: round(Math.max(currentPrice * 0.1, rawValue), 4),
    };
  });
}

export async function getExchangeRatePairQuote(baseCurrency: string, quoteCurrency: string): Promise<ExchangeRatePairQuote> {
  const base = baseCurrency.trim().toUpperCase();
  const quote = quoteCurrency.trim().toUpperCase();

  if (!/^[A-Z]{3}$/.test(base) || !/^[A-Z]{3}$/.test(quote)) {
    throw new Error(`Invalid ExchangeRate currency pair ${baseCurrency}/${quoteCurrency}`);
  }

  if (base === quote) {
    return {
      baseCurrency: base,
      quoteCurrency: quote,
      rate: 1,
      source: "exchange-rate-api",
      updatedAt: new Date().toISOString(),
    };
  }

  if (!priceProviderConfig.exchangeRateApiKey) {
    throw new Error("ExchangeRate API key is not configured");
  }

  const url = new URL(
    `${priceProviderConfig.exchangeRateApiBaseUrl}/${encodeURIComponent(priceProviderConfig.exchangeRateApiKey)}/pair/${encodeURIComponent(base)}/${encodeURIComponent(quote)}`,
  );

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(priceProviderConfig.exchangeRateApiTimeoutMs),
  });

  if (!response.ok) {
    throw new Error(`ExchangeRate pair request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as ExchangeRateApiResponse;
  if (payload.result !== "success") {
    throw new Error(payload["error-type"] ?? `ExchangeRate pair request failed for ${base}/${quote}`);
  }

  if (typeof payload.conversion_rate !== "number" || !Number.isFinite(payload.conversion_rate)) {
    throw new Error(`ExchangeRate pair response for ${base}/${quote} did not include a valid conversion rate`);
  }

  const updatedAt =
    typeof payload.time_last_update_unix === "number"
      ? new Date(payload.time_last_update_unix * 1000).toISOString()
      : typeof payload.time_last_update_utc === "string"
        ? new Date(payload.time_last_update_utc).toISOString()
        : new Date().toISOString();

  return {
    baseCurrency: base,
    quoteCurrency: quote,
    rate: payload.conversion_rate,
    source: "exchange-rate-api",
    updatedAt,
  };
}

export async function getExchangeRateFallbackPriceSnapshot(
  instrument: Instrument,
  referenceSnapshot?: PriceSnapshot | null,
): Promise<PriceSnapshot> {
  const pair = getInstrumentCurrencyPair(instrument);
  if (!pair) {
    throw new Error(`Instrument ${instrument.ticker} is not supported by ExchangeRate fallback`);
  }

  const quote = await getExchangeRatePairQuote(pair.baseCurrency, pair.quoteCurrency);
  const liveRate = round(quote.rate, 4);

  if (referenceSnapshot?.currentPrice && Number.isFinite(referenceSnapshot.currentPrice) && referenceSnapshot.currentPrice > 0) {
    const factor = liveRate / referenceSnapshot.currentPrice;

    if (Number.isFinite(factor) && factor > 0) {
      return {
        ticker: instrument.ticker,
        source: quote.source,
        currentPrice: liveRate,
        atr14: round(referenceSnapshot.atr14 * factor, 4),
        atrPercent: round(referenceSnapshot.atrPercent, 2),
        weeklyTrend: scaleTrendSnapshot(referenceSnapshot.weeklyTrend, factor),
        dailyTrend: scaleTrendSnapshot(referenceSnapshot.dailyTrend, factor),
        fourHourMomentum: scaleTrendSnapshot(referenceSnapshot.fourHourMomentum, factor),
        priceHistory: referenceSnapshot.priceHistory.map((point) => ({
          label: point.label,
          value: round(point.value * factor, 4),
        })),
        updatedAt: quote.updatedAt,
        freshness: {
          mode: "fallback",
          updatedAt: quote.updatedAt,
          note: `Using live ${pair.baseCurrency}/${pair.quoteCurrency} rate from ExchangeRate-API with scaled ${referenceSnapshot.source} context because Yahoo chart data was unavailable`,
        },
      };
    }
  }

  const atrPercent = liveRate >= 100 ? 0.45 : liveRate >= 10 ? 0.35 : 0.25;
  const atr14 = round(liveRate * (atrPercent / 100), 4);

  return {
    ticker: instrument.ticker,
    source: quote.source,
    currentPrice: liveRate,
    atr14,
    atrPercent,
    weeklyTrend: buildNeutralTrendSnapshot("1W", liveRate),
    dailyTrend: buildNeutralTrendSnapshot("1D", liveRate),
    fourHourMomentum: buildNeutralTrendSnapshot("4H", liveRate),
    priceHistory: buildSyntheticPriceHistory(liveRate, atrPercent, quote.updatedAt),
    updatedAt: quote.updatedAt,
    freshness: {
      mode: "fallback",
      updatedAt: quote.updatedAt,
      note: `Using live ${pair.baseCurrency}/${pair.quoteCurrency} rate from ExchangeRate-API with synthesized fallback history because Yahoo chart data was unavailable`,
    },
  };
}