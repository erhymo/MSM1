import "server-only";

import { buildComputedDashboardState } from "@/lib/analysis/engine";
import { firestoreAnalysisConfig } from "@/lib/config/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { seedFirestoreAnalysisStore } from "@/lib/firebase/firestore-analysis-service";
import { writeSystemLog } from "@/lib/firebase/firestore-system-log-service";
import { cotProviderConfig } from "@/lib/providers/cot/config";
import { sentimentProviderConfig } from "@/lib/providers/sentiment/config";

export type AnalysisRunTrigger = "cron" | "manual";

export type AnalysisRunResult = {
  trigger: AnalysisRunTrigger;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  instruments: number;
  fallbackInstruments: number;
  rawEntries: number;
  status: "ok" | "warning";
  cadence: {
    analysisIntervalHours: number;
    cotRefreshWindowHours: number;
    cotUpdateDay: string;
    sentimentRefreshWindowHours: number;
  };
};

export function getAnalysisCadenceSummary() {
  return {
    analysisIntervalHours: firestoreAnalysisConfig.staleAfterHours,
    cotRefreshWindowHours: cotProviderConfig.staleAfterHours,
    cotUpdateDay: cotProviderConfig.updateDay,
    sentimentRefreshWindowHours: sentimentProviderConfig.staleAfterHours,
  };
}

function getDurationMs(startedAt: string, completedAt: string) {
  return Math.max(0, new Date(completedAt).getTime() - new Date(startedAt).getTime());
}

function ensurePersistenceAvailable() {
  if (!adminDb) {
    throw new Error(
      "Firebase Admin / Firestore is not configured. The analysis runner requires persistence to write latestAnalysis, analysisHistory, rawMarketData, and systemLogs.",
    );
  }
}

export async function runAnalysisRefresh(trigger: AnalysisRunTrigger): Promise<AnalysisRunResult> {
  ensurePersistenceAvailable();

  const startedAt = new Date().toISOString();

  await writeSystemLog({
    level: "info",
    scope: "analysis-sync",
    message: "Started scheduled analysis runner",
    details: {
      trigger,
      analysisIntervalHours: firestoreAnalysisConfig.staleAfterHours,
      cotRefreshWindowHours: cotProviderConfig.staleAfterHours,
      sentimentRefreshWindowHours: sentimentProviderConfig.staleAfterHours,
    },
  }).catch(() => undefined);

  try {
    const computedState = await buildComputedDashboardState();

    await seedFirestoreAnalysisStore(computedState.snapshot, computedState.rawMarketData, { trigger });

    const completedAt = new Date().toISOString();
    const fallbackInstruments = computedState.snapshot.analyses.filter((analysis) => analysis.freshness.mode === "fallback").length;
    const result: AnalysisRunResult = {
      trigger,
      startedAt,
      completedAt,
      durationMs: getDurationMs(startedAt, completedAt),
      instruments: computedState.snapshot.analyses.length,
      fallbackInstruments,
      rawEntries: computedState.rawMarketData.length,
      status: fallbackInstruments > 0 ? "warning" : "ok",
      cadence: getAnalysisCadenceSummary(),
    };

    await writeSystemLog({
      level: fallbackInstruments > 0 ? "warning" : "info",
      scope: "analysis-sync",
      message:
        fallbackInstruments > 0
          ? "Scheduled analysis runner completed with fallback inputs"
          : "Scheduled analysis runner completed successfully",
      details: {
        trigger: result.trigger,
        instruments: result.instruments,
        fallbackInstruments: result.fallbackInstruments,
        rawEntries: result.rawEntries,
        durationMs: result.durationMs,
      },
    }).catch(() => undefined);

    return result;
  } catch (error) {
    const completedAt = new Date().toISOString();

    await writeSystemLog({
      level: "error",
      scope: "analysis-sync",
      message: "Scheduled analysis runner failed",
      details: {
        trigger,
        durationMs: getDurationMs(startedAt, completedAt),
        reason: error instanceof Error ? error.message : "unknown-error",
      },
    }).catch(() => undefined);

    throw error;
  }
}