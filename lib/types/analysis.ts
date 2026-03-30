export type SignalType =
  | "STRONG_BUY"
  | "BUY"
  | "WAIT"
  | "HOLD"
  | "SELL"
  | "STRONG_SELL"
  | "NO_TRADE";

export type MarketRegime = "Trending" | "Ranging" | "Volatile";

export type TradeSetupQuality = "A+" | "A" | "B" | "C" | "No Trade";

export type AssetClass = "FX" | "Commodity" | "Index";

export type Timeframe = "4H" | "1D" | "1W";

export interface Instrument {
  ticker: string;
  name: string;
  assetClass: AssetClass;
}

export interface RawPriceData {
  ticker: string;
  timeframe: Timeframe;
  open: number;
  high: number;
  low: number;
  close: number;
  timestamp: string;
}

export interface COTData {
  ticker: string;
  bias: "Bullish" | "Neutral" | "Bearish";
  netPosition: number;
  timestamp: string;
}

export interface SentimentData {
  ticker: string;
  retailLong: number;
  retailShort: number;
  timestamp: string;
}

export interface VolatilityData {
  ticker: string;
  atrPercent: number;
  realizedVolatility: number;
  regimeHint: MarketRegime;
  timestamp: string;
}

export interface FactorContribution {
  name: string;
  weight: number;
  contribution: number;
  summary: string;
}

export interface HistoryPoint {
  label: string;
  value: number;
}

export interface COTParticipantSnapshot {
  long: number;
  short: number;
  net: number;
  netPercent: number;
}

export interface COTMarketComponent {
  marketName: string;
  marketCode?: string;
  exchangeName?: string;
  weight: number;
  openInterest: number;
  updatedAt: string;
  largeSpeculators: COTParticipantSnapshot;
  commercialHedgers: COTParticipantSnapshot;
}

export interface COTMarketContext {
  strategy: "direct" | "derived" | "proxy";
  label: string;
  note?: string;
  components: COTMarketComponent[];
}

export interface SignalHistoryPoint {
  label: string;
  signal: SignalType;
  score: number;
}

export interface DataFreshness {
  mode: "live" | "fallback";
  updatedAt: string;
  note: string;
}

export interface NokDisplayContext {
  quoteCurrency: string;
  nokPerQuote: number;
  source: string;
  updatedAt: string;
}

export interface TimeframeIndicatorSnapshot {
  timeframe: Timeframe;
  bias: number;
  ema20: number;
  ema50: number;
  macdHistogram: number;
}

export interface PriceSnapshot {
  ticker: string;
  source: string;
  currentPrice: number;
  atr14: number;
  atrPercent: number;
  weeklyTrend: TimeframeIndicatorSnapshot;
  dailyTrend: TimeframeIndicatorSnapshot;
  fourHourMomentum: TimeframeIndicatorSnapshot;
  priceHistory: HistoryPoint[];
  updatedAt: string;
  freshness: DataFreshness;
}

export interface COTSnapshot {
  ticker: string;
  source: string;
  bias: COTData["bias"];
  netPosition: number;
  history: HistoryPoint[];
  market: COTMarketContext;
  updatedAt: string;
  freshness: DataFreshness;
}

export interface SentimentSnapshot {
  ticker: string;
  source: string;
  retailLong: number;
  retailShort: number;
  history: HistoryPoint[];
  updatedAt: string;
  freshness: DataFreshness;
}

export interface VolatilitySnapshot {
  ticker: string;
  atrPercent: number;
  realizedVolatility: number;
  regimeHint: MarketRegime;
  history: HistoryPoint[];
  updatedAt: string;
  freshness: DataFreshness;
}

export interface AnalysisResult {
  instrument: Instrument;
  signal: SignalType;
  score: number;
  confidence: number;
  cotBias: string;
  trend: string;
  retailLong: number;
  marketRegime: MarketRegime;
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
  nokDisplay?: NokDisplayContext;
  priceHistory: HistoryPoint[];
  confidenceHistory: HistoryPoint[];
  cotHistory?: HistoryPoint[];
  sentimentHistory?: HistoryPoint[];
  signalHistory: SignalHistoryPoint[];
}

export interface SystemStatusItem {
  id: string;
  label: string;
  value: string;
  status: "ok" | "warning" | "error";
  detail: string;
  category: "job" | "feed" | "mode" | "error";
  source: "mock" | "firestore" | "provider" | "system";
  updatedAt?: string;
  freshnessMode?: DataFreshness["mode"];
}

export interface DashboardSnapshot {
  analyses: AnalysisResult[];
  statusItems: SystemStatusItem[];
}