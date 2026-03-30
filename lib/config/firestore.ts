export const firestoreCollections = {
  instruments: "instruments",
  latestAnalysis: "latestAnalysis",
  dashboardSnapshots: "dashboardSnapshots",
  analysisHistory: "analysisHistory",
  rawMarketData: "rawMarketData",
  systemLogs: "systemLogs",
} as const;

export const firestoreAnalysisConfig = {
  historyLimit: 8,
  staleAfterHours: Math.max(1, Number(process.env.ANALYSIS_INTERVAL_HOURS ?? 3)),
  historySeedStepHours: 6,
  sourceLabel: "analysis-engine",
} as const;
