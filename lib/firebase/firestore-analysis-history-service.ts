import "server-only";

import { firestoreAnalysisConfig, firestoreCollections } from "@/lib/config/firestore";
import { adminDb } from "@/lib/firebase/admin";
import type { HistoryPoint, SignalHistoryPoint } from "@/lib/types/analysis";
import type {
  AnalysisHistorySeries,
  FirestoreAnalysisDailyHistoryDocument,
  FirestoreLatestAnalysisDocument,
} from "@/lib/types/firestore";

const maxFirestoreBatchWrites = 450;

function toDailyHistoryDocument(doc: FirestoreLatestAnalysisDocument): FirestoreAnalysisDailyHistoryDocument {
  return {
    ticker: doc.ticker,
    recordedDate: doc.updatedAt.slice(0, 10),
    recordedAt: doc.updatedAt,
    source: firestoreAnalysisConfig.sourceLabel,
    freshnessMode: doc.freshness.mode,
    price: doc.entry,
    confidence: doc.confidence,
    score: doc.score,
    signal: doc.signal,
    retailLong: doc.retailLong,
  };
}

function toDateLabel(isoDate: string) {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return isoDate.slice(5, 10);
  return `${date.getUTCDate()}/${date.getUTCMonth() + 1}`;
}

function toPoint(label: string, value: number): HistoryPoint {
  return { label, value };
}

function toSignalPoint(label: string, score: number, signal: SignalHistoryPoint["signal"]): SignalHistoryPoint {
  return { label, score, signal };
}

function appendCurrentPoint(series: AnalysisHistorySeries, latest: FirestoreLatestAnalysisDocument): AnalysisHistorySeries {
  return {
    priceHistory: [...series.priceHistory, toPoint("Now", latest.entry)],
    confidenceHistory: [...series.confidenceHistory, toPoint("Now", latest.confidence)],
    sentimentHistory: [...(series.sentimentHistory ?? []), toPoint("Now", latest.retailLong)],
    signalHistory: [...series.signalHistory, toSignalPoint("Now", latest.score, latest.signal)],
    cotHistory: series.cotHistory,
  };
}

export async function writeDailyAnalysisHistorySnapshots(options: { dryRun?: boolean } = {}) {
  const db = adminDb;
  if (!db) return { dryRun: Boolean(options.dryRun), latestDocuments: 0, snapshotsWritten: 0 };
  const firestore = db;

  const latestSnapshot = await firestore.collection(firestoreCollections.latestAnalysis).get();
  if (latestSnapshot.empty) return { dryRun: Boolean(options.dryRun), latestDocuments: 0, snapshotsWritten: 0 };

  const docs = latestSnapshot.docs.map((entry) => entry.data() as FirestoreLatestAnalysisDocument);
  let batch = firestore.batch();
  let writeCount = 0;
  let snapshotsWritten = 0;

  async function commitBatch() {
    if (!writeCount || options.dryRun) return;
    await batch.commit();
    batch = firestore.batch();
    writeCount = 0;
  }

  for (const doc of docs) {
    const daily = toDailyHistoryDocument(doc);
    const ref = firestore.collection(firestoreCollections.analysisDailyHistory).doc(doc.ticker).collection("entries").doc(daily.recordedDate);
    batch.set(ref, daily, { merge: true });
    writeCount += 1;
    snapshotsWritten += 1;

    if (writeCount >= maxFirestoreBatchWrites) {
      await commitBatch();
    }
  }

  await commitBatch();
  return { dryRun: Boolean(options.dryRun), latestDocuments: docs.length, snapshotsWritten };
}

export async function getInstrumentDailyHistorySeries(ticker: string, limit = 30): Promise<AnalysisHistorySeries | null> {
  const db = adminDb;
  if (!db) return null;

  const [latestDoc, historySnapshot] = await Promise.all([
    db.collection(firestoreCollections.latestAnalysis).doc(ticker).get(),
    db
      .collection(firestoreCollections.analysisDailyHistory)
      .doc(ticker)
      .collection("entries")
      .orderBy("recordedAt", "desc")
      .limit(limit)
      .get(),
  ]);

  const latest = latestDoc.exists ? (latestDoc.data() as FirestoreLatestAnalysisDocument) : null;
  const entries = historySnapshot.docs
    .map((doc) => doc.data() as FirestoreAnalysisDailyHistoryDocument)
    .sort((left, right) => left.recordedAt.localeCompare(right.recordedAt));

  const series: AnalysisHistorySeries = {
    priceHistory: entries.map((entry) => toPoint(toDateLabel(entry.recordedAt), entry.price)),
    confidenceHistory: entries.map((entry) => toPoint(toDateLabel(entry.recordedAt), entry.confidence)),
    sentimentHistory: entries.map((entry) => toPoint(toDateLabel(entry.recordedAt), entry.retailLong)),
    signalHistory: entries.map((entry) => toSignalPoint(toDateLabel(entry.recordedAt), entry.score, entry.signal)),
    cotHistory: undefined,
  };

  if (!latest) {
    return entries.length ? series : null;
  }

  return appendCurrentPoint(series, latest);
}
