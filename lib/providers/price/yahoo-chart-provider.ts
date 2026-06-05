import type { PriceDataProvider } from "@/lib/providers/types";
import type { Instrument } from "@/lib/types/analysis";

import { priceProviderConfig } from "@/lib/providers/price/config";
import { normalizePriceSnapshot, type RemotePriceBar } from "@/lib/providers/price/normalize-price-snapshot";
import { getPriceProviderSymbol } from "@/lib/providers/price/symbol-map";

type YahooChartResult = {
  meta?: {
    regularMarketTime?: number | null;
  };
  timestamp?: number[];
  indicators?: {
    quote?: Array<{
      open?: Array<number | null>;
      high?: Array<number | null>;
      low?: Array<number | null>;
      close?: Array<number | null>;
    }>;
  };
};

type YahooChartResponse = {
  chart?: {
    result?: YahooChartResult[];
    error?: {
      description?: string | null;
    } | null;
  };
};

type YahooBarsResult = {
  bars: RemotePriceBar[];
  updatedAt: string;
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function toBars(result: YahooChartResult) {
  const timestamps = result.timestamp ?? [];
  const quote = result.indicators?.quote?.[0];
  const opens = quote?.open ?? [];
  const highs = quote?.high ?? [];
  const lows = quote?.low ?? [];
  const closes = quote?.close ?? [];

  return timestamps.reduce<RemotePriceBar[]>((bars, timestamp, index) => {
    const open = opens[index];
    const high = highs[index];
    const low = lows[index];
    const close = closes[index];

    if (!isFiniteNumber(high) || !isFiniteNumber(low) || !isFiniteNumber(close)) return bars;

    bars.push({
      timestamp: new Date(timestamp * 1000).toISOString(),
      open: isFiniteNumber(open) ? open : close,
      high,
      low,
      close,
    });

    return bars;
  }, []);
}

async function fetchYahooBars(remoteSymbol: string, interval: string, range: string): Promise<YahooBarsResult> {
  const url = new URL(`${priceProviderConfig.baseUrl}/${encodeURIComponent(remoteSymbol)}`);
  url.searchParams.set("interval", interval);
  url.searchParams.set("range", range);

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Accept: "application/json",
      "User-Agent": priceProviderConfig.userAgent,
    },
    cache: "no-store",
    signal: AbortSignal.timeout(priceProviderConfig.timeoutMs),
  });

  if (!response.ok) {
    throw new Error(`Yahoo chart request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as YahooChartResponse;
  const description = payload.chart?.error?.description;

  if (description) {
    throw new Error(description);
  }

  const result = payload.chart?.result?.[0];
  if (!result) {
    throw new Error(`No Yahoo chart result returned for ${remoteSymbol}`);
  }

  const bars = toBars(result);
  if (bars.length < 8) {
    throw new Error(`Insufficient Yahoo chart history returned for ${remoteSymbol}`);
  }

  const updatedAt =
    typeof result.meta?.regularMarketTime === "number"
      ? new Date(result.meta.regularMarketTime * 1000).toISOString()
      : bars.at(-1)?.timestamp ?? new Date().toISOString();

  return { bars, updatedAt };
}

export const yahooChartPriceProvider: PriceDataProvider = {
  async getSnapshot(instrument: Instrument) {
    const { remoteSymbol } = getPriceProviderSymbol(instrument);
    const daily = await fetchYahooBars(remoteSymbol, priceProviderConfig.interval, priceProviderConfig.range);
    if (daily.bars.length < 20) {
      throw new Error(`Insufficient Yahoo chart history returned for ${instrument.ticker}`);
    }
    const intraday = await fetchYahooBars(remoteSymbol, priceProviderConfig.intradayInterval, priceProviderConfig.intradayRange).catch(() => null);

    return normalizePriceSnapshot({
      instrument,
      source: intraday ? "yahoo-chart+intraday" : "yahoo-chart",
      bars: daily.bars,
      intradayBars: intraday?.bars,
      updatedAt: intraday?.updatedAt ?? daily.updatedAt,
      freshnessMode: "live",
      freshnessNote: intraday
        ? `Latest Yahoo daily + ${priceProviderConfig.intradayInterval} intraday snapshot for ${remoteSymbol}`
        : `Latest Yahoo daily snapshot for ${remoteSymbol}; intraday tactical fallback unavailable`,
    });
  },
};