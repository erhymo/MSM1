import { getLatestRawMarketData, getLatestRawMarketEntry } from "@/lib/firebase/firestore-raw-market-service";
import { sentimentProviderConfig } from "@/lib/providers/sentiment/config";
import type { HistoryPoint, Instrument, SentimentSnapshot } from "@/lib/types/analysis";
import type { FirestoreRawMarketDataDocument, FirestoreRawMarketValue } from "@/lib/types/firestore";

const monthLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

type SentimentObservation = {
  capturedAt: string;
  retailLong: number;
};

function isRecord(value: FirestoreRawMarketValue | undefined): value is Record<string, FirestoreRawMarketValue> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toNumber(value: FirestoreRawMarketValue | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function toString(value: FirestoreRawMarketValue | undefined) {
  return typeof value === "string" ? value : undefined;
}

function clampPercent(value: number) {
  return Math.min(100, Math.max(0, Number(value.toFixed(2))));
}

function toHistoryLabel(isoDate: string, index: number) {
  const date = new Date(isoDate);

  if (Number.isNaN(date.getTime())) {
    return `S${index + 1}`;
  }

  return `${monthLabels[date.getUTCMonth()] ?? "S"} ${date.getUTCDate()}`;
}

function toHistory(value: FirestoreRawMarketValue | undefined) {
  if (!Array.isArray(value)) return undefined;

  const points = value
    .map((item) => {
      if (!isRecord(item)) return null;
      const label = toString(item.label);
      const pointValue = toNumber(item.value);

      if (!label || typeof pointValue !== "number") return null;
      return { label, value: clampPercent(pointValue) };
    })
    .filter((item): item is HistoryPoint => Boolean(item));

  return points.length ? points : undefined;
}

function toObservation(entry: FirestoreRawMarketDataDocument): SentimentObservation | null {
  if (entry.category !== "sentiment") return null;

  const retailLong = toNumber(entry.values.retailLong);

  if (typeof retailLong !== "number") {
    return null;
  }

  return {
    capturedAt: entry.capturedAt,
    retailLong: clampPercent(retailLong),
  };
}

function observationsToHistory(observations: SentimentObservation[]): HistoryPoint[] {
  const recent = observations
    .sort((left, right) => left.capturedAt.localeCompare(right.capturedAt))
    .slice(-sentimentProviderConfig.historyPoints);

  return recent.map((observation, index) => ({
    label: toHistoryLabel(observation.capturedAt, index),
    value: observation.retailLong,
  }));
}

function buildSinglePointHistory(capturedAt: string, retailLong: number): HistoryPoint[] {
  return observationsToHistory([{ capturedAt, retailLong: clampPercent(retailLong) }]);
}

function toSentimentSnapshot(
  instrument: Instrument,
  entry: FirestoreRawMarketDataDocument,
  freshnessMode: SentimentSnapshot["freshness"]["mode"],
  freshnessNote: string,
): SentimentSnapshot | null {
  const retailLong = toNumber(entry.values.retailLong);

  if (typeof retailLong !== "number") {
    return null;
  }

  return {
    ticker: instrument.ticker,
    source: entry.source,
    retailLong: clampPercent(retailLong),
    retailShort: clampPercent(toNumber(entry.values.retailShort) ?? 100 - retailLong),
    history: toHistory(entry.values.history) ?? buildSinglePointHistory(entry.capturedAt, retailLong),
    updatedAt: entry.capturedAt,
    freshness: {
      mode: freshnessMode,
      updatedAt: entry.capturedAt,
      note: freshnessNote,
    },
  };
}

export function isSentimentSnapshotFresh(updatedAt: string) {
  return Date.now() - new Date(updatedAt).getTime() <= sentimentProviderConfig.staleAfterHours * 60 * 60 * 1000;
}

export async function getRecentStoredSentimentHistory(ticker: string, limit: number = sentimentProviderConfig.historyPoints) {
  const entries = await getLatestRawMarketData(ticker, Math.max(limit * 5, limit + 4));
  const observations = entries.map(toObservation).filter((item): item is SentimentObservation => item !== null);

  return observationsToHistory(observations.slice(-limit));
}

export async function getFirestoreCachedSentimentSnapshot(instrument: Instrument): Promise<SentimentSnapshot | null> {
  const entry = await getLatestRawMarketEntry(instrument.ticker, "sentiment");

  if (!entry || entry.freshnessMode !== "live" || !isSentimentSnapshotFresh(entry.capturedAt)) {
    return null;
  }

  return toSentimentSnapshot(instrument, entry, "live", `Using cached ${entry.source} retail sentiment snapshot from Firestore`);
}

export async function getFirestoreFallbackSentimentSnapshot(instrument: Instrument): Promise<SentimentSnapshot | null> {
  const entry = await getLatestRawMarketEntry(instrument.ticker, "sentiment");

  if (!entry) {
    return null;
  }

  return toSentimentSnapshot(instrument, entry, "fallback", `Using last stored ${entry.source} retail sentiment snapshot from Firestore`);
}