import "server-only";

import { firestoreAnalysisConfig, firestoreCollections } from "@/lib/config/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { getLatestRawMarketDataForTickers, storeRawMarketData } from "@/lib/firebase/firestore-raw-market-service";
import { getRecentSystemLogs, writeSystemLog } from "@/lib/firebase/firestore-system-log-service";
import type { AnalysisResult, DashboardSnapshot, HistoryPoint, SignalHistoryPoint, SystemStatusItem } from "@/lib/types/analysis";
import type {
  AnalysisHistorySeries,
  FirestoreAnalysisHistoryDocument,
  FirestoreInstrumentDocument,
  FirestoreLatestAnalysisDocument,
  FirestoreRawMarketDataDocument,
  FirestoreSystemLogDocument,
  RawMarketDataCategory,
} from "@/lib/types/firestore";
import { compareAnalysisResults, formatRelativeTime } from "@/lib/utils/format";

function isStale(updatedAt: string) {
  return Date.now() - new Date(updatedAt).getTime() > firestoreAnalysisConfig.staleAfterHours * 60 * 60 * 1000;
}

function withFallbackFreshness(analysis: FirestoreLatestAnalysisDocument): FirestoreLatestAnalysisDocument["freshness"] {
  if (!isStale(analysis.updatedAt)) return analysis.freshness;

  return {
    mode: "fallback",
    updatedAt: analysis.updatedAt,
    note: `Using last stored Firestore analysis from ${formatRelativeTime(analysis.updatedAt)} because no fresher snapshot is available`,
  };
}

function getAlignedPoint<T>(series: T[] | undefined, index: number, maxLength: number) {
  if (!series?.length) return undefined;

  const offset = maxLength - series.length;
  if (index < offset) return undefined;

  return series[index - offset];
}

function getRecordedAt(baseIsoDate: string, index: number, maxLength: number) {
  const baseTime = new Date(baseIsoDate).getTime();
  const hoursBack = (maxLength - 1 - index) * firestoreAnalysisConfig.historySeedStepHours;

  return new Date(baseTime - hoursBack * 60 * 60 * 1000).toISOString();
}

function toLatestAnalysisDocument(analysis: AnalysisResult): FirestoreLatestAnalysisDocument {
  return {
    ticker: analysis.instrument.ticker,
    instrument: analysis.instrument,
    signal: analysis.signal,
    score: analysis.score,
    confidence: analysis.confidence,
    cotBias: analysis.cotBias,
    trend: analysis.trend,
    retailLong: analysis.retailLong,
    marketRegime: analysis.marketRegime,
    updatedAt: analysis.updatedAt,
    freshness: analysis.freshness,
    setupQuality: analysis.setupQuality,
    entry: analysis.entry,
    stopLoss: analysis.stopLoss,
    target: analysis.target,
    riskReward: analysis.riskReward,
    aiSummary: analysis.aiSummary,
    explanation: analysis.explanation,
    factorContributions: analysis.factorContributions,
    source: firestoreAnalysisConfig.sourceLabel,
    writtenAt: new Date().toISOString(),
  };
}

function toInstrumentDocument(analysis: AnalysisResult): FirestoreInstrumentDocument {
  return {
    ticker: analysis.instrument.ticker,
    name: analysis.instrument.name,
    assetClass: analysis.instrument.assetClass,
    active: true,
    updatedAt: new Date().toISOString(),
  };
}

function toHistoryDocuments(analysis: AnalysisResult): FirestoreAnalysisHistoryDocument[] {
  const maxLength = Math.max(
    analysis.priceHistory.length,
    analysis.confidenceHistory.length,
    analysis.signalHistory.length,
    analysis.sentimentHistory?.length ?? 0,
    analysis.cotHistory?.length ?? 0,
  );

  return Array.from({ length: maxLength }, (_, index) => {
    const pricePoint = getAlignedPoint(analysis.priceHistory, index, maxLength);
    const confidencePoint = getAlignedPoint(analysis.confidenceHistory, index, maxLength);
    const signalPoint = getAlignedPoint(analysis.signalHistory, index, maxLength);
    const sentimentPoint = getAlignedPoint(analysis.sentimentHistory, index, maxLength);
    const cotPoint = getAlignedPoint(analysis.cotHistory, index, maxLength);

    return {
      ticker: analysis.instrument.ticker,
      label: pricePoint?.label ?? confidencePoint?.label ?? signalPoint?.label ?? sentimentPoint?.label ?? cotPoint?.label ?? `H${index + 1}`,
      sequence: index,
      recordedAt: getRecordedAt(analysis.updatedAt, index, maxLength),
      freshnessMode: analysis.freshness.mode,
      source: firestoreAnalysisConfig.sourceLabel,
      ...(pricePoint ? { price: pricePoint.value } : {}),
      ...(confidencePoint ? { confidence: confidencePoint.value } : {}),
      ...(signalPoint ? { score: signalPoint.score, signal: signalPoint.signal } : {}),
      ...(sentimentPoint ? { retailLong: sentimentPoint.value } : {}),
      ...(cotPoint ? { cotValue: cotPoint.value } : {}),
    };
  });
}

function toPoint(label: string, value: number): HistoryPoint {
  return { label, value };
}

function toSignalPoint(label: string, score: number, signal: SignalHistoryPoint["signal"]): SignalHistoryPoint {
  return { label, score, signal };
}

function defaultHistoryFromLatest(doc: FirestoreLatestAnalysisDocument): AnalysisHistorySeries {
  return {
    priceHistory: [toPoint("Now", doc.entry)],
    confidenceHistory: [toPoint("Now", doc.confidence)],
    cotHistory: undefined,
    sentimentHistory: [toPoint("Now", doc.retailLong)],
    signalHistory: [toSignalPoint("Now", doc.score, doc.signal)],
  };
}

function toHistorySeries(entries: FirestoreAnalysisHistoryDocument[], latest: FirestoreLatestAnalysisDocument): AnalysisHistorySeries {
  if (!entries.length) return defaultHistoryFromLatest(latest);

  return {
    priceHistory: entries.filter((entry) => typeof entry.price === "number").map((entry) => toPoint(entry.label, entry.price!)),
    confidenceHistory: entries.filter((entry) => typeof entry.confidence === "number").map((entry) => toPoint(entry.label, entry.confidence!)),
    cotHistory: entries.filter((entry) => typeof entry.cotValue === "number").map((entry) => toPoint(entry.label, entry.cotValue!)),
    sentimentHistory: entries.filter((entry) => typeof entry.retailLong === "number").map((entry) => toPoint(entry.label, entry.retailLong!)),
    signalHistory: entries
      .filter((entry) => typeof entry.score === "number" && entry.signal)
      .map((entry) => toSignalPoint(entry.label, entry.score!, entry.signal!)),
  };
}

function toAnalysisResult(doc: FirestoreLatestAnalysisDocument, history: AnalysisHistorySeries): AnalysisResult {
  return {
    instrument: doc.instrument,
    signal: doc.signal,
    score: doc.score,
    confidence: doc.confidence,
    cotBias: doc.cotBias,
    trend: doc.trend,
    retailLong: doc.retailLong,
    marketRegime: doc.marketRegime,
    updatedAt: doc.updatedAt,
    freshness: withFallbackFreshness(doc),
    setupQuality: doc.setupQuality,
    entry: doc.entry,
    stopLoss: doc.stopLoss,
    target: doc.target,
    riskReward: doc.riskReward,
    aiSummary: doc.aiSummary,
    explanation: doc.explanation,
    factorContributions: doc.factorContributions,
    priceHistory: history.priceHistory,
    confidenceHistory: history.confidenceHistory,
    cotHistory: history.cotHistory,
    sentimentHistory: history.sentimentHistory,
    signalHistory: history.signalHistory,
  };
}

function getLatestCategoryEntry(entries: FirestoreRawMarketDataDocument[], category: RawMarketDataCategory) {
  return entries.filter((entry) => entry.category === category).sort((left, right) => left.capturedAt.localeCompare(right.capturedAt)).at(-1);
}

function getFeedStatusItem(
  id: string,
  label: string,
  categoryKey: RawMarketDataCategory,
  entries: FirestoreRawMarketDataDocument[],
): SystemStatusItem {
  const latestEntry = getLatestCategoryEntry(entries, categoryKey);

  if (!latestEntry) {
    return {
      id,
      label,
      value: "Missing",
      status: "warning",
      detail: `No ${categoryKey.toUpperCase()} snapshot was found in rawMarketData`,
      category: "feed",
      source: "firestore",
    };
  }

  return {
    id,
    label,
    value: formatRelativeTime(latestEntry.capturedAt),
    status: latestEntry.freshnessMode === "fallback" ? "warning" : "ok",
    detail:
      latestEntry.freshnessMode === "fallback"
        ? `${latestEntry.ticker} is serving a fallback ${categoryKey} snapshot from ${latestEntry.source}`
        : `${latestEntry.ticker} is the newest ${latestEntry.source} ${categoryKey} snapshot in Firestore`,
    category: "feed",
    source: "firestore",
    updatedAt: latestEntry.capturedAt,
    freshnessMode: latestEntry.freshnessMode,
  };
}

function getErrorStatusItem(logs: FirestoreSystemLogDocument[]): SystemStatusItem {
  const recentIssues = logs.filter((entry) => entry.level !== "info");
  const latestIssue = recentIssues[0];

  if (!latestIssue) {
    return {
      id: "recent-errors",
      label: "Recent errors",
      value: "None",
      status: "ok",
      detail: "No recent warning or error logs were found in systemLogs",
      category: "error",
      source: "firestore",
    };
  }

  return {
    id: "recent-errors",
    label: "Recent errors",
    value: `${recentIssues.length} recent issue${recentIssues.length === 1 ? "" : "s"}`,
    status: latestIssue.level === "error" ? "error" : "warning",
    detail: `${latestIssue.scope}: ${latestIssue.message}`,
    category: "error",
    source: "firestore",
    updatedAt: latestIssue.createdAt,
  };
}

function buildStatusItems(
  analyses: AnalysisResult[],
  latestDocs: FirestoreLatestAnalysisDocument[],
  averageHistoryPoints: number,
  rawEntries: FirestoreRawMarketDataDocument[],
  logs: FirestoreSystemLogDocument[],
): SystemStatusItem[] {
  const latestAnalysisWrite = latestDocs.map((doc) => doc.writtenAt).sort().at(-1) ?? new Date().toISOString();
  const fallbackCount = analyses.filter((analysis) => analysis.freshness.mode === "fallback").length;

  return [
    {
      id: "analysis-job",
      label: "Latest analysis job",
      value: formatRelativeTime(latestAnalysisWrite),
      status: fallbackCount > 0 ? "warning" : "ok",
      detail:
        fallbackCount > 0
          ? `${latestDocs.length} latestAnalysis documents are available, but some are currently serving fallback values`
          : `${latestDocs.length} latestAnalysis documents are available and within the freshness window`,
      category: "job",
      source: "firestore",
      updatedAt: latestAnalysisWrite,
    },
    getFeedStatusItem("price-update", "Latest price update", "price", rawEntries),
    getFeedStatusItem("cot-update", "Latest COT update", "cot", rawEntries),
    getFeedStatusItem("sentiment-update", "Latest sentiment update", "sentiment", rawEntries),
    getErrorStatusItem(logs),
    {
      id: "data-mode",
      label: "Data mode",
      value: fallbackCount > 0 ? `${fallbackCount} fallback` : "Live",
      status: fallbackCount > 0 ? "warning" : "ok",
      detail:
        fallbackCount > 0
          ? `The UI is using last known Firestore values where fresh data is missing · avg history ${averageHistoryPoints} pts`
          : `Dashboard is serving live Firestore-backed data with analysisHistory coverage averaging ${averageHistoryPoints} points`,
      category: "mode",
      source: "firestore",
      freshnessMode: fallbackCount > 0 ? "fallback" : "live",
    },
  ];
}

export async function seedFirestoreAnalysisStore(snapshot: DashboardSnapshot, rawMarketData: FirestoreRawMarketDataDocument[]) {
  const db = adminDb;
  if (!db) return;

  const batch = db.batch();

  snapshot.analyses.forEach((analysis) => {
    const instrumentRef = db.collection(firestoreCollections.instruments).doc(analysis.instrument.ticker);
    const latestRef = db.collection(firestoreCollections.latestAnalysis).doc(analysis.instrument.ticker);

    batch.set(instrumentRef, toInstrumentDocument(analysis), { merge: true });
    batch.set(latestRef, toLatestAnalysisDocument(analysis), { merge: true });

    toHistoryDocuments(analysis).forEach((entry) => {
      const historyRef = db
        .collection(firestoreCollections.analysisHistory)
        .doc(analysis.instrument.ticker)
        .collection("entries")
        .doc(`${entry.sequence}-${entry.recordedAt.replace(/[:.]/g, "-")}`);

      batch.set(historyRef, entry, { merge: true });
    });
  });

  await batch.commit();
  await storeRawMarketData(rawMarketData);
  await writeSystemLog({
    level: "info",
    scope: "analysis-sync",
    message: "Seeded Firestore analysis collections from the analysis engine",
    details: {
      instruments: snapshot.analyses.length,
      rawEntries: rawMarketData.length,
    },
  });
}

async function getHistorySeriesForTicker(ticker: string, latest: FirestoreLatestAnalysisDocument) {
  const db = adminDb;
  if (!db) return defaultHistoryFromLatest(latest);

  const historySnapshot = await db
    .collection(firestoreCollections.analysisHistory)
    .doc(ticker)
    .collection("entries")
    .orderBy("recordedAt", "desc")
    .limit(firestoreAnalysisConfig.historyLimit)
    .get();

  const entries = historySnapshot.docs.map((doc) => doc.data() as FirestoreAnalysisHistoryDocument).reverse();
  return toHistorySeries(entries, latest);
}

export async function getDashboardSnapshotFromFirestore(): Promise<DashboardSnapshot | null> {
  const db = adminDb;
  if (!db) return null;

  const latestSnapshot = await db.collection(firestoreCollections.latestAnalysis).get();
  if (latestSnapshot.empty) return null;

  const latestDocs = latestSnapshot.docs.map((doc) => doc.data() as FirestoreLatestAnalysisDocument);
  const tickers = latestDocs.map((doc) => doc.ticker);
  const [historySeries, rawEntries, logs] = await Promise.all([
    Promise.all(latestDocs.map((doc) => getHistorySeriesForTicker(doc.ticker, doc))),
    getLatestRawMarketDataForTickers(tickers),
    getRecentSystemLogs(),
  ]);

  const analyses = latestDocs
    .map((doc, index) => toAnalysisResult(doc, historySeries[index]))
    .sort(compareAnalysisResults);

  const averageHistoryPoints = analyses.length
    ? Math.round(analyses.reduce((sum, analysis) => sum + analysis.priceHistory.length, 0) / analyses.length)
    : 0;

  return {
    analyses,
    statusItems: buildStatusItems(analyses, latestDocs, averageHistoryPoints, rawEntries, logs),
  };
}
