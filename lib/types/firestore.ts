import type { AnalysisResult, AssetClass, DataFreshness, FactorContribution, Instrument, PolicyRateSignal, SignalType, SystemStatusItem, TacticalSignal, TradeSetupQuality } from "@/lib/types/analysis";
import type { OilAlertDecision, OilAlertDirection, OilAlertRunResult, OilAlertRunTrigger } from "@/lib/alerts/oil-alert-types";

export interface FirestoreInstrumentDocument {
  ticker: string;
  name: string;
  assetClass: AssetClass;
  active: boolean;
  updatedAt: string;
}

export interface FirestoreLatestAnalysisDocument {
  ticker: string;
  instrument: Instrument;
  signal: SignalType;
  score: number;
  confidence: number;
  cotBias: string;
  trend: string;
  retailLong: number;
  marketRegime: AnalysisResult["marketRegime"];
  updatedAt: string;
  freshness: DataFreshness;
  setupQuality: TradeSetupQuality;
  entry: number;
  stopLoss: number;
  target: number;
  riskReward: number;
  aiSummary: string;
  explanation: string;
  factorContributions: FactorContribution[];
  nokDisplay?: AnalysisResult["nokDisplay"];
  rateSignal?: PolicyRateSignal;
  tacticalSignal?: TacticalSignal;
  source: string;
  writtenAt: string;
}

export interface FirestoreDashboardSnapshotDocument {
  analyses: FirestoreLatestAnalysisDocument[];
  statusItems: SystemStatusItem[];
  source: string;
  writtenAt: string;
  schemaVersion: 1;
}

export interface FirestoreAnalysisHistoryDocument {
  ticker: string;
  label: string;
  sequence: number;
  recordedAt: string;
  freshnessMode: DataFreshness["mode"];
  source: string;
  price?: number;
  confidence?: number;
  score?: number;
  signal?: SignalType;
  retailLong?: number;
  cotValue?: number;
}

export interface FirestoreAnalysisDailyHistoryDocument {
  ticker: string;
  recordedDate: string;
  recordedAt: string;
  source: string;
  freshnessMode: DataFreshness["mode"];
  price: number;
  confidence: number;
  score: number;
  signal: SignalType;
  retailLong: number;
}

export interface FirestoreRecommendationAuditOutcome {
  horizonHours: number;
  targetTime: string;
  status: "pending" | "ready";
  evaluatedAt?: string;
  observedPrice?: number;
  observedAt?: string;
  observationCount: number;
  returnPercent?: number;
  maxFavorablePercent?: number;
  maxAdversePercent?: number;
  targetHit?: boolean;
  stopHit?: boolean;
  directionalWin?: boolean;
}

export interface FirestoreRecommendationAuditDocument {
  auditId: string;
  ticker: string;
  instrument: Instrument;
  trigger: "cron" | "manual";
  createdAt: string;
  analysisUpdatedAt: string;
  freshnessMode: DataFreshness["mode"];
  signal: SignalType;
  score: number;
  confidence: number;
  setupQuality: TradeSetupQuality;
  marketRegime: AnalysisResult["marketRegime"];
  entry: number;
  stopLoss: number;
  target: number;
  riskReward: number;
  aiSummary: string;
  explanation: string;
  factorContributions: FactorContribution[];
  tacticalSignal?: TacticalSignal;
  outcomes: FirestoreRecommendationAuditOutcome[];
  evaluationStatus: "pending" | "partial" | "complete";
}

export interface FirestoreModelReviewMetricRow {
  label: string;
  samples: number;
  avgReturnPercent: number;
  hitRatePercent: number;
  avgConfidence: number;
}

export interface FirestoreModelReviewReportDocument {
  reportId: string;
  generatedAt: string;
  horizonHours: number;
  sourceAuditCount: number;
  completeAuditCount: number;
  reviewMode: "template" | "openai";
  headline: string;
  summary: string;
  recommendations: string[];
  metrics: {
    total: FirestoreModelReviewMetricRow;
    bySignal: FirestoreModelReviewMetricRow[];
    byConfidenceBucket: FirestoreModelReviewMetricRow[];
    byRegime: FirestoreModelReviewMetricRow[];
    byFreshnessMode: FirestoreModelReviewMetricRow[];
  };
}

export type RawMarketDataCategory = "price" | "cot" | "sentiment" | "volatility";

export type FirestoreRawMarketValue =
  | string
  | number
  | boolean
  | null
  | FirestoreRawMarketValue[]
  | { [key: string]: FirestoreRawMarketValue };

export interface FirestoreRawMarketDataDocument {
  ticker: string;
  category: RawMarketDataCategory;
  source: string;
  timeframe?: string;
  capturedAt: string;
  freshnessMode: DataFreshness["mode"];
  values: Record<string, FirestoreRawMarketValue>;
}

export interface FirestoreSystemLogDocument {
  level: "info" | "warning" | "error";
  scope:
    | "analysis-sync"
    | "dashboard-read"
    | "raw-market-data"
    | "price-provider"
    | "cot-provider"
    | "sentiment-provider"
    | "ai-summary"
    | "polymarket-provider"
    | "email"
    | "news-provider"
    | "oil-alert"
    | "model-review";
  message: string;
  details?: Record<string, string | number | boolean | null>;
  createdAt: string;
}

export interface FirestoreOilAlertObservedMarketDocument {
  marketId: string;
  label: string;
  question: string;
  weight: number;
  tier?: 1 | 2 | 3;
  yesProbability: number;
}

export interface FirestoreOilAlertStateDocument {
  alertId: string;
  lastObservedAt: string;
  lastLivePrice: number;
  lastPriceUpdatedAt: string;
  lastPriceSource: string;
  lastPolymarketMarkets: FirestoreOilAlertObservedMarketDocument[];
  lastDecision: OilAlertDecision;
  lastConfidence: number;
  lastDirection?: OilAlertDirection;
  lastSentAt?: string;
  lastSignalHash?: string;
  lastRunResult?: OilAlertRunResult;
  cooldownUntil?: string;
  updatedAt: string;
}

export interface FirestoreOilAlertHistoryDocument {
  alertId: string;
  trigger: OilAlertRunTrigger;
  dryRun: boolean;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  status: "ok" | "warning";
  decision: OilAlertDecision;
  reason: string;
  confidence: number;
  direction: OilAlertDirection | null;
  emailSent: boolean;
  marketsChecked: number;
  liveInputs: boolean;
  newsScore: number;
  marketRegimeScore?: number;
  confirmationScore?: number;
  directionalScore?: number;
  alignedLayers?: number;
  price: {
    current: number;
    previous?: number;
    movePercent: number;
    updatedAt: string;
    source: string;
    freshnessMode: DataFreshness["mode"];
  };
  topSignals: {
    marketId: string;
    label: string;
    question: string;
    weight: number;
    tier?: 1 | 2 | 3;
    yesProbability: number;
    previousYesProbability?: number;
    deltaPp?: number;
    oilDirectionalMovePp?: number;
    confirmationScore?: number;
    impliedDirection: OilAlertDirection | null;
  }[];
  topHeadlines: {
    title: string;
    url: string;
    domain: string;
    publishedAt: string;
    direction: OilAlertDirection | null;
    category?: "supply-shock" | "supply-relief" | "demand-up" | "demand-down";
    score: number;
    ageHours?: number;
    matchedKeywords: string[];
  }[];
  cooldownUntil?: string;
  emailSubject?: string;
  createdAt: string;
}

export type AnalysisHistorySeries = Pick<AnalysisResult, "priceHistory" | "confidenceHistory" | "cotHistory" | "sentimentHistory" | "signalHistory">;
