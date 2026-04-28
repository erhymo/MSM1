import "server-only";

import { modelReviewConfig } from "@/lib/config/model-review";
import { firestoreAnalysisConfig, firestoreCollections } from "@/lib/config/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { storeRawMarketData } from "@/lib/firebase/firestore-raw-market-service";
import { buildRecommendationAuditId } from "@/lib/firebase/firestore-model-review-service";
import { writeSystemLog } from "@/lib/firebase/firestore-system-log-service";
import type { AnalysisResult, DashboardSnapshot, HistoryPoint, SignalHistoryPoint } from "@/lib/types/analysis";
import type {
  AnalysisHistorySeries,
  FirestoreAnalysisHistoryDocument,
  FirestoreDashboardSnapshotDocument,
  FirestoreInstrumentDocument,
  FirestoreLatestAnalysisDocument,
  FirestoreRecommendationAuditDocument,
  FirestoreRawMarketDataDocument,
} from "@/lib/types/firestore";
import { compareAnalysisResults, formatRelativeTime } from "@/lib/utils/format";

const maxFirestoreBatchWrites = 450;
const dashboardSnapshotDocumentId = "latest";

type DashboardSnapshotReadSource = "dashboardSnapshots" | "latestAnalysis";

type DashboardSnapshotReadAttempt = {
  source: DashboardSnapshotReadSource;
  snapshot: DashboardSnapshot | null;
  durationMs: number;
  outcome: "success" | "empty" | "error";
  error: string | null;
};

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

function toLatestAnalysisDocument(analysis: AnalysisResult, writtenAt: string): FirestoreLatestAnalysisDocument {
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
    ...(analysis.rateSignal ? { rateSignal: analysis.rateSignal } : {}),
    ...(analysis.tacticalSignal ? { tacticalSignal: analysis.tacticalSignal } : {}),
    ...(analysis.tradeManagerPlan ? { tradeManagerPlan: analysis.tradeManagerPlan } : {}),
    source: firestoreAnalysisConfig.sourceLabel,
    writtenAt,
  };
}

function toInstrumentDocument(analysis: AnalysisResult, writtenAt: string): FirestoreInstrumentDocument {
  return {
    ticker: analysis.instrument.ticker,
    name: analysis.instrument.name,
    assetClass: analysis.instrument.assetClass,
    active: true,
    updatedAt: writtenAt,
  };
}

function toRecommendationAuditDocument(
  analysis: AnalysisResult,
  trigger: "cron" | "manual",
  writtenAt: string,
): FirestoreRecommendationAuditDocument {
  return {
    auditId: buildRecommendationAuditId(analysis.instrument.ticker, writtenAt),
    ticker: analysis.instrument.ticker,
    instrument: analysis.instrument,
    trigger,
    createdAt: writtenAt,
    analysisUpdatedAt: analysis.updatedAt,
    freshnessMode: analysis.freshness.mode,
    signal: analysis.signal,
    score: analysis.score,
    confidence: analysis.confidence,
    setupQuality: analysis.setupQuality,
    marketRegime: analysis.marketRegime,
    entry: analysis.entry,
    stopLoss: analysis.stopLoss,
    target: analysis.target,
    riskReward: analysis.riskReward,
    aiSummary: analysis.aiSummary,
    explanation: analysis.explanation,
    factorContributions: analysis.factorContributions,
    ...(analysis.tacticalSignal ? { tacticalSignal: analysis.tacticalSignal } : {}),
    ...(analysis.tacticalSignal
      ? {
          tacticalAction: analysis.tacticalSignal.action,
          tacticalScore: analysis.tacticalSignal.score,
          tacticalConfidence: analysis.tacticalSignal.confidence,
        }
      : {}),
    ...(analysis.tradeManagerPlan ? { tradeManagerPlan: analysis.tradeManagerPlan } : {}),
    ...(analysis.tradeManagerPlan ? { tradeGuidance: analysis.tradeManagerPlan.guidance } : {}),
    outcomes: modelReviewConfig.outcomeWindowsHours.map((horizonHours) => ({
      horizonHours,
      targetTime: new Date(new Date(writtenAt).getTime() + horizonHours * 60 * 60 * 1000).toISOString(),
      status: "pending",
      observationCount: 0,
    })),
    evaluationStatus: "pending",
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
    rateSignal: doc.rateSignal,
    tacticalSignal: doc.tacticalSignal,
    tradeManagerPlan: doc.tradeManagerPlan,
    priceHistory: history.priceHistory,
    confidenceHistory: history.confidenceHistory,
    cotHistory: history.cotHistory,
    sentimentHistory: history.sentimentHistory,
    signalHistory: history.signalHistory,
  };
}

function refreshStatusItems(items: FirestoreDashboardSnapshotDocument["statusItems"]) {
  return items.map((item) => ({
    ...item,
    value: item.updatedAt ? formatRelativeTime(item.updatedAt) : item.value,
  }));
}

function toDashboardSnapshot(latestDocs: FirestoreLatestAnalysisDocument[], statusItems: DashboardSnapshot["statusItems"]): DashboardSnapshot {
  const analyses = latestDocs
    .map((doc) => toAnalysisResult(doc, defaultHistoryFromLatest(doc)))
    .sort(compareAnalysisResults);

  return {
    analyses,
    statusItems,
  };
}

function toDashboardSnapshotDocument(snapshot: DashboardSnapshot, writtenAt: string): FirestoreDashboardSnapshotDocument {
  return {
    analyses: snapshot.analyses.map((analysis) => toLatestAnalysisDocument(analysis, writtenAt)),
    statusItems: snapshot.statusItems,
    source: firestoreAnalysisConfig.sourceLabel,
    writtenAt,
    schemaVersion: 1,
  };
}

async function getDashboardSnapshotDocumentFromFirestore(): Promise<DashboardSnapshot | null> {
  const db = adminDb;
  if (!db) return null;

  const snapshot = await db.collection(firestoreCollections.dashboardSnapshots).doc(dashboardSnapshotDocumentId).get();
  if (!snapshot.exists) return null;

  const data = snapshot.data() as FirestoreDashboardSnapshotDocument | undefined;
  if (!data?.analyses?.length) return null;

  return toDashboardSnapshot(data.analyses, refreshStatusItems(data.statusItems ?? []));
}

async function readDashboardSnapshotCandidate(
  source: DashboardSnapshotReadSource,
  loader: () => Promise<DashboardSnapshot | null>,
): Promise<DashboardSnapshotReadAttempt> {
  const startedAt = Date.now();

  try {
    const snapshot = await loader();

    return {
      source,
      snapshot,
      durationMs: Date.now() - startedAt,
      outcome: snapshot ? "success" : "empty",
      error: null,
    };
  } catch (error) {
    return {
      source,
      snapshot: null,
      durationMs: Date.now() - startedAt,
      outcome: "error",
      error: error instanceof Error ? error.message : "Unknown Firestore dashboard read error",
    };
  }
}

async function getDashboardSnapshotFromLatestAnalysisCollection(): Promise<DashboardSnapshot | null> {
  const db = adminDb;
  if (!db) return null;

  const latestSnapshot = await db.collection(firestoreCollections.latestAnalysis).get();
  if (latestSnapshot.empty) return null;

  const latestDocs = latestSnapshot.docs.map((doc) => doc.data() as FirestoreLatestAnalysisDocument);
  const fallbackCount = latestDocs.filter((doc) => withFallbackFreshness(doc).mode === "fallback").length;
  const latestAnalysisWrite = latestDocs.map((d) => d.writtenAt).sort().at(-1) ?? new Date().toISOString();

  return toDashboardSnapshot(latestDocs, [
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
  ]);
}

export async function seedFirestoreAnalysisStore(
  snapshot: DashboardSnapshot,
  rawMarketData: FirestoreRawMarketDataDocument[],
  options: { trigger: "cron" | "manual" },
) {
  const db = adminDb;
  if (!db) return;

  const firestore = db;
  const writtenAt = new Date().toISOString();
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

  const dashboardSnapshotRef = firestore.collection(firestoreCollections.dashboardSnapshots).doc(dashboardSnapshotDocumentId);
  await queueSet(dashboardSnapshotRef, toDashboardSnapshotDocument(snapshot, writtenAt));

  for (const analysis of snapshot.analyses) {
    const instrumentRef = firestore.collection(firestoreCollections.instruments).doc(analysis.instrument.ticker);
    const latestRef = firestore.collection(firestoreCollections.latestAnalysis).doc(analysis.instrument.ticker);
    const audit = toRecommendationAuditDocument(analysis, options.trigger, writtenAt);
    const auditRef = firestore.collection(firestoreCollections.recommendationAudits).doc(audit.auditId);

    await queueSet(instrumentRef, toInstrumentDocument(analysis, writtenAt));
    await queueSet(latestRef, toLatestAnalysisDocument(analysis, writtenAt));
    await queueSet(auditRef, audit);

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
      dashboardSnapshotDocument: dashboardSnapshotDocumentId,
    },
  });
}

/**
 * Dashboard read path: start the aggregated snapshot read and the legacy
 * `latestAnalysis` fallback in parallel, then return the first successful
 * snapshot. This keeps one slow Firestore path from blocking the other.
 */
export async function getDashboardSnapshotFromFirestore(): Promise<DashboardSnapshot | null> {
  const pendingReads = new Map<DashboardSnapshotReadSource, Promise<DashboardSnapshotReadAttempt>>([
    ["dashboardSnapshots", readDashboardSnapshotCandidate("dashboardSnapshots", getDashboardSnapshotDocumentFromFirestore)],
    ["latestAnalysis", readDashboardSnapshotCandidate("latestAnalysis", getDashboardSnapshotFromLatestAnalysisCollection)],
  ]);
  const attempts: DashboardSnapshotReadAttempt[] = [];

  while (pendingReads.size) {
    const attempt = await Promise.race(pendingReads.values());
    pendingReads.delete(attempt.source);
    attempts.push(attempt);

    if (attempt.snapshot) {
      if (attempt.source === "latestAnalysis") {
        const storedSnapshotAttempt = attempts.find((entry) => entry.source === "dashboardSnapshots");

        void writeSystemLog({
          level: "warning",
          scope: "dashboard-read",
          message: "Dashboard served from legacy Firestore fallback",
          details: {
            winner: attempt.source,
            winnerMs: attempt.durationMs,
            storedSnapshotOutcome: storedSnapshotAttempt?.outcome ?? (pendingReads.has("dashboardSnapshots") ? "pending" : "unknown"),
            storedSnapshotMs: storedSnapshotAttempt?.durationMs ?? null,
            storedSnapshotPending: pendingReads.has("dashboardSnapshots"),
          },
        }).catch(() => undefined);
      }

      return attempt.snapshot;
    }
  }

  const failedAttempts = attempts.filter((attempt) => attempt.outcome === "error");
  if (failedAttempts.length) {
    throw new Error(
      failedAttempts
        .map((attempt) => `${attempt.source}: ${attempt.error ?? "Unknown Firestore dashboard read error"}`)
        .join("; "),
    );
  }

  return null;
}
