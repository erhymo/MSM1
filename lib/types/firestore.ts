import type { AnalysisResult, AssetClass, DataFreshness, FactorContribution, Instrument, SignalType, TradeSetupQuality } from "@/lib/types/analysis";

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
  scope: "analysis-sync" | "dashboard-read" | "raw-market-data" | "price-provider" | "cot-provider" | "sentiment-provider" | "ai-summary";
  message: string;
  details?: Record<string, string | number | boolean | null>;
  createdAt: string;
}

export type AnalysisHistorySeries = Pick<AnalysisResult, "priceHistory" | "confidenceHistory" | "cotHistory" | "sentimentHistory" | "signalHistory">;
