import type { SentimentDataProvider } from "@/lib/providers/types";
import type { HistoryPoint, Instrument } from "@/lib/types/analysis";

import { sentimentProviderConfig } from "@/lib/providers/sentiment/config";
import { getRecentStoredSentimentHistory } from "@/lib/providers/sentiment/firestore-fallback";
import { getSentimentProviderMapping } from "@/lib/providers/sentiment/symbol-map";

type RemoteDukascopySentimentRow = {
  date?: string | number;
  long?: string | number;
  short?: string | number;
  title?: string;
};

function toNumber(value: string | number | undefined) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

function clampPercent(value: number) {
  return Math.min(100, Math.max(0, Number(value.toFixed(2))));
}

function toUpdatedAt(value: string | number | undefined) {
  const timestamp = typeof value === "string" ? Number(value) : value;

  if (typeof timestamp === "number" && Number.isFinite(timestamp)) {
    const isoDate = new Date(timestamp).toISOString();

    if (!isoDate.includes("Invalid")) {
      return isoDate;
    }
  }

  return new Date().toISOString();
}

function withCurrentObservation(history: HistoryPoint[], retailLong: number): HistoryPoint[] {
  const recentHistory = history.slice(-(sentimentProviderConfig.historyPoints - 1));
  return [...recentHistory, { label: "Now", value: clampPercent(retailLong) }];
}

async function fetchRealtimeSentiment(providerInstrument: string) {
  const url = new URL(sentimentProviderConfig.baseUrl);
  url.searchParams.set("group", "quotes");
  url.searchParams.set("method", "realtimeSentimentIndex");
  url.searchParams.set("enabled", "true");
  url.searchParams.set("key", sentimentProviderConfig.widgetKey);
  url.searchParams.set("liquidity", sentimentProviderConfig.liquidity);
  url.searchParams.set("type", sentimentProviderConfig.type);
  url.searchParams.set("instrument", providerInstrument);

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Accept: "application/json",
      Referer: sentimentProviderConfig.referer,
      "User-Agent": sentimentProviderConfig.userAgent,
    },
    cache: "no-store",
    signal: AbortSignal.timeout(sentimentProviderConfig.timeoutMs),
  });

  if (!response.ok) {
    throw new Error(`Dukascopy sentiment request failed for ${providerInstrument} with status ${response.status}`);
  }

  const payload = (await response.json()) as RemoteDukascopySentimentRow[];
  const latestRow = Array.isArray(payload) ? payload[0] : null;

  if (!latestRow) {
    throw new Error(`No Dukascopy sentiment snapshot returned for ${providerInstrument}`);
  }

  const retailLong = toNumber(latestRow.long);
  const retailShort = toNumber(latestRow.short);

  if (typeof retailLong !== "number" || typeof retailShort !== "number") {
    throw new Error(`Incomplete Dukascopy sentiment payload for ${providerInstrument}`);
  }

  return {
    retailLong: clampPercent(retailLong),
    retailShort: clampPercent(retailShort),
    updatedAt: toUpdatedAt(latestRow.date),
  };
}

export const dukascopySentimentProvider: SentimentDataProvider = {
  async getSnapshot(instrument: Instrument) {
    const mapping = getSentimentProviderMapping(instrument);
    const snapshot = await fetchRealtimeSentiment(mapping.providerInstrument);
    const storedHistory = await getRecentStoredSentimentHistory(instrument.ticker, sentimentProviderConfig.historyPoints - 1);

    return {
      ticker: instrument.ticker,
      source: "dukascopy-realtime",
      retailLong: snapshot.retailLong,
      retailShort: snapshot.retailShort,
      history: withCurrentObservation(storedHistory, snapshot.retailLong),
      updatedAt: snapshot.updatedAt,
      freshness: {
        mode: "live",
        updatedAt: snapshot.updatedAt,
        note: `Latest retail sentiment snapshot from Dukascopy for ${mapping.providerInstrument}`,
      },
    };
  },
};