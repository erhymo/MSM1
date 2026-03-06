import { getLatestRawMarketEntry } from "@/lib/firebase/firestore-raw-market-service";
import { cotProviderConfig } from "@/lib/providers/cot/config";
import type { COTMarketComponent, COTParticipantSnapshot, COTSnapshot, HistoryPoint, Instrument } from "@/lib/types/analysis";
import type { FirestoreRawMarketDataDocument, FirestoreRawMarketValue } from "@/lib/types/firestore";

function isRecord(value: FirestoreRawMarketValue | undefined): value is Record<string, FirestoreRawMarketValue> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toNumber(value: FirestoreRawMarketValue | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function toString(value: FirestoreRawMarketValue | undefined) {
  return typeof value === "string" ? value : undefined;
}

function getBias(score: number): COTSnapshot["bias"] {
  if (score >= 20) return "Bullish";
  if (score <= -20) return "Bearish";
  return "Neutral";
}

function toHistory(value: FirestoreRawMarketValue | undefined) {
  if (!Array.isArray(value)) return undefined;

  const points = value
    .map((item) => {
      if (!isRecord(item)) return null;
      const label = toString(item.label);
      const pointValue = toNumber(item.value);

      if (!label || typeof pointValue !== "number") return null;
      return { label, value: pointValue };
    })
    .filter((item): item is HistoryPoint => Boolean(item));

  return points.length ? points : undefined;
}

function toParticipantSnapshot(value: FirestoreRawMarketValue | undefined): COTParticipantSnapshot | undefined {
  if (!isRecord(value)) return undefined;

  const long = toNumber(value.long);
  const short = toNumber(value.short);
  const net = toNumber(value.net);
  const netPercent = toNumber(value.netPercent);

  if (typeof long !== "number" || typeof short !== "number" || typeof net !== "number" || typeof netPercent !== "number") {
    return undefined;
  }

  return { long, short, net, netPercent };
}

function toMarketComponents(value: FirestoreRawMarketValue | undefined): COTMarketComponent[] | undefined {
  if (!Array.isArray(value)) return undefined;

  const components = value
    .map((item): COTMarketComponent | null => {
      if (!isRecord(item)) return null;

      const marketName = toString(item.marketName);
      const weight = toNumber(item.weight);
      const openInterest = toNumber(item.openInterest);
      const updatedAt = toString(item.updatedAt);
      const largeSpeculators = toParticipantSnapshot(item.largeSpeculators);
      const commercialHedgers = toParticipantSnapshot(item.commercialHedgers);

      if (
        !marketName ||
        typeof weight !== "number" ||
        typeof openInterest !== "number" ||
        !updatedAt ||
        !largeSpeculators ||
        !commercialHedgers
      ) {
        return null;
      }

      return {
        marketName,
        marketCode: toString(item.marketCode),
        exchangeName: toString(item.exchangeName),
        weight,
        openInterest,
        updatedAt,
        largeSpeculators,
        commercialHedgers,
      };
    });

  const filtered = components.filter((item): item is COTMarketComponent => item !== null);

  return filtered.length ? filtered : undefined;
}

function toCotSnapshot(
  instrument: Instrument,
  entry: FirestoreRawMarketDataDocument,
  freshnessMode: COTSnapshot["freshness"]["mode"],
  freshnessNote: string,
): COTSnapshot | null {
  const netPosition = toNumber(entry.values.netPosition);
  if (typeof netPosition !== "number") return null;

  const history = toHistory(entry.values.history) ?? [{ label: "W1", value: netPosition }];

  return {
    ticker: instrument.ticker,
    source: entry.source,
    bias: (toString(entry.values.bias) as COTSnapshot["bias"] | undefined) ?? getBias(netPosition),
    netPosition,
    history,
    market: {
      strategy: (toString(entry.values.marketStrategy) as COTSnapshot["market"]["strategy"] | undefined) ?? "proxy",
      label: toString(entry.values.marketLabel) ?? `Stored ${instrument.ticker} COT snapshot`,
      note: toString(entry.values.marketNote),
      components: toMarketComponents(entry.values.marketComponents) ?? [],
    },
    updatedAt: entry.capturedAt,
    freshness: {
      mode: freshnessMode,
      updatedAt: entry.capturedAt,
      note: freshnessNote,
    },
  };
}

export function isCotSnapshotFresh(updatedAt: string) {
  return Date.now() - new Date(updatedAt).getTime() <= cotProviderConfig.staleAfterHours * 60 * 60 * 1000;
}

export async function getFirestoreCachedCotSnapshot(instrument: Instrument): Promise<COTSnapshot | null> {
  const entry = await getLatestRawMarketEntry(instrument.ticker, "cot");

  if (!entry || entry.freshnessMode !== "live" || !isCotSnapshotFresh(entry.capturedAt)) {
    return null;
  }

  return toCotSnapshot(instrument, entry, "live", `Using cached weekly ${entry.source} COT snapshot from Firestore`);
}

export async function getFirestoreFallbackCotSnapshot(instrument: Instrument): Promise<COTSnapshot | null> {
  const entry = await getLatestRawMarketEntry(instrument.ticker, "cot");
  if (!entry) return null;

  return toCotSnapshot(instrument, entry, "fallback", `Using last stored ${entry.source} weekly COT snapshot from Firestore`);
}