import "server-only";

import { firestoreAnalysisConfig, firestoreCollections } from "@/lib/config/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { storeRawMarketData } from "@/lib/firebase/firestore-raw-market-service";
import { writeSystemLog } from "@/lib/firebase/firestore-system-log-service";
import { enrichAnalysesWithNokDisplay } from "@/lib/analysis/nok-display";
import type { AnalysisResult, DashboardSnapshot, HistoryPoint, SignalHistoryPoint } from "@/lib/types/analysis";
import type {
  AnalysisHistorySeries,
  FirestoreAnalysisHistoryDocument,
  FirestoreInstrumentDocument,
  FirestoreLatestAnalysisDocument,
  FirestoreRawMarketDataDocument,
} from "@/lib/types/firestore";
import { compareAnalysisResults, formatRelativeTime } from "@/lib/utils/format";

const maxFirestoreBatchWrites = 450;

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
    ...(analysis.nokDisplay ? { nokDisplay: analysis.nokDisplay } : {}),
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
  const priceHistory = analysis.priceHistory.slice(-firestoreAnalysisConfig.historyLimit);
  const confidenceHistory = analysis.confidenceHistory.slice(-firestoreAnalysisConfig.historyLimit);
  const signalHistory = analysis.signalHistory.slice(-firestoreAnalysisConfig.historyLimit);
  const sentimentHistory = analysis.sentimentHistory?.slice(-firestoreAnalysisConfig.historyLimit);
  const cotHistory = analysis.cotHistory?.slice(-firestoreAnalysisConfig.historyLimit);

  const maxLength = Math.max(
    priceHistory.length,
    confidenceHistory.length,
    signalHistory.length,
    sentimentHistory?.length ?? 0,
    cotHistory?.length ?? 0,
  );

  return Array.from({ length: maxLength }, (_, index) => {
    const pricePoint = getAlignedPoint(priceHistory, index, maxLength);
    const confidencePoint = getAlignedPoint(confidenceHistory, index, maxLength);
    const signalPoint = getAlignedPoint(signalHistory, index, maxLength);
    const sentimentPoint = getAlignedPoint(sentimentHistory, index, maxLength);
    const cotPoint = getAlignedPoint(cotHistory, index, maxLength);

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
    nokDisplay: doc.nokDisplay,
    priceHistory: history.priceHistory,
    confidenceHistory: history.confidenceHistory,
    cotHistory: history.cotHistory,
    sentimentHistory: history.sentimentHistory,
    signalHistory: history.signalHistory,
  };
}

export async function seedFirestoreAnalysisStore(snapshot: DashboardSnapshot, rawMarketData: FirestoreRawMarketDataDocument[]) {
  const db = adminDb;
  if (!db) return;

  const firestore = db;
  let batch = firestore.batch();
  let writeCount = 0;
  let committedBatchCount = 0;

  async function commitBatch() {
    if (!writeCount) return;

    await batch.commit();
    batch = firestore.batch();
    writeCount = 0;
    committedBatchCount += 1;
  }

  async function queueSet<T>(ref: FirebaseFirestore.DocumentReference<T>, value: T) {
    batch.set(ref, value, { merge: true });
    writeCount += 1;

    if (writeCount >= maxFirestoreBatchWrites) {
      await commitBatch();
    }
  }

  for (const analysis of snapshot.analyses) {
    const instrumentRef = firestore.collection(firestoreCollections.instruments).doc(analysis.instrument.ticker);
    const latestRef = firestore.collection(firestoreCollections.latestAnalysis).doc(analysis.instrument.ticker);

    await queueSet(instrumentRef, toInstrumentDocument(analysis));
    await queueSet(latestRef, toLatestAnalysisDocument(analysis));

    for (const entry of toHistoryDocuments(analysis)) {
      const historyRef = firestore
        .collection(firestoreCollections.analysisHistory)
        .doc(analysis.instrument.ticker)
        .collection("entries")
        .doc(`${entry.sequence}-${entry.recordedAt.replace(/[:.]/g, "-")}`);

      await queueSet(historyRef, entry);
    }
  }

  await commitBatch();
  await storeRawMarketData(rawMarketData);
  await writeSystemLog({
    level: "info",
    scope: "analysis-sync",
    message: "Seeded Firestore analysis collections from the analysis engine",
    details: {
      instruments: snapshot.analyses.length,
      rawEntries: rawMarketData.length,
      historyLimit: firestoreAnalysisConfig.historyLimit,
      batchCommits: committedBatchCount,
    },
  });
}

/**
 * Light dashboard read: fetches only the `latestAnalysis` collection (single
 * query) and derives minimal history from each document.  This avoids the N+1
 * subcollection reads (history + rawMarketData) that previously caused Vercel
 * serverless timeouts for 50+ instruments.
 */
export async function getDashboardSnapshotFromFirestore(): Promise<DashboardSnapshot | null> {
  const db = adminDb;
  if (!db) return null;

  const latestSnapshot = await db.collection(firestoreCollections.latestAnalysis).get();
  if (latestSnapshot.empty) return null;

  const latestDocs = latestSnapshot.docs.map((doc) => doc.data() as FirestoreLatestAnalysisDocument);

  // Derive history from the latest document itself (no subcollection reads).
  const analyses = await enrichAnalysesWithNokDisplay(
    latestDocs
      .map((doc) => toAnalysisResult(doc, defaultHistoryFromLatest(doc)))
      .sort(compareAnalysisResults),
  );

  const fallbackCount = analyses.filter((a) => a.freshness.mode === "fallback").length;
  const latestAnalysisWrite = latestDocs.map((d) => d.writtenAt).sort().at(-1) ?? new Date().toISOString();

  return {
    analyses,
    statusItems: [
      {
        id: "analysis-job",
        label: "Latest analysis job",
        value: formatRelativeTime(latestAnalysisWrite),
        status: fallbackCount > 0 ? "warning" : "ok",
        detail:
          fallbackCount > 0
            ? `${latestDocs.length} instruments available, some serving fallback values`
            : `${latestDocs.length} instruments available and within the freshness window`,
        category: "job",
        source: "firestore",
        updatedAt: latestAnalysisWrite,
      },
      {
        id: "data-mode",
        label: "Data mode",
        value: fallbackCount > 0 ? `${fallbackCount} fallback` : "Live",
        status: fallbackCount > 0 ? "warning" : "ok",
        detail:
          fallbackCount > 0
            ? `The UI is using last known Firestore values where fresh data is missing`
            : `Dashboard is serving live Firestore-backed data`,
        category: "mode",
        source: "firestore",
        freshnessMode: fallbackCount > 0 ? "fallback" : "live",
      },
    ],
  };
}
