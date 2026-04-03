import type { AnalysisResult, AssetClass, DataFreshness, FactorContribution, Instrument, SignalType, SystemStatusItem, TradeSetupQuality } from "@/lib/types/analysis";
import type { OilAlertDecision, OilAlertDirection, OilAlertRunTrigger } from "@/lib/alerts/oil-alert-types";

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
    | "oil-alert";
  message: string;
  details?: Record<string, string | number | boolean | null>;
  createdAt: string;
}

export interface FirestoreOilAlertObservedMarketDocument {
  marketId: string;
  label: string;
  question: string;
  weight: number;
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
    yesProbability: number;
    previousYesProbability?: number;
    deltaPp?: number;
    oilDirectionalMovePp?: number;
    impliedDirection: OilAlertDirection | null;
  }[];
  topHeadlines: {
    title: string;
    url: string;
    domain: string;
    publishedAt: string;
    direction: OilAlertDirection | null;
    score: number;
    matchedKeywords: string[];
  }[];
  cooldownUntil?: string;
  emailSubject?: string;
  createdAt: string;
}

export type AnalysisHistorySeries = Pick<AnalysisResult, "priceHistory" | "confidenceHistory" | "cotHistory" | "sentimentHistory" | "signalHistory">;
