export type OilAlertDirection = "bullish" | "bearish";

export type OilAlertMarketTier = 1 | 2 | 3;

export type OilAlertNewsCategory = "supply-shock" | "supply-relief" | "demand-up" | "demand-down";

export type OilAlertDecision =
  | "disabled"
  | "seeded"
  | "skipped-non-live-price"
  | "skipped-stale-price"
  | "skipped-stale-polymarket"
  | "insufficient-move"
  | "insufficient-confidence"
  | "cooldown"
  | "duplicate"
  | "triggered";

export type OilAlertRunTrigger = "cron" | "manual";

export interface OilAlertRunOptions {
  dryRun?: boolean;
}

export interface OilAlertMarketSignal {
  marketId: string;
  label: string;
  question: string;
  weight: number;
  tier?: OilAlertMarketTier;
  yesProbability: number;
  previousYesProbability?: number;
  deltaPp?: number;
  oilDirectionalMovePp?: number;
  confirmationScore?: number;
  impliedDirection: OilAlertDirection | null;
}

export interface OilAlertHeadlineSignal {
  title: string;
  url: string;
  domain: string;
  publishedAt: string;
  direction: OilAlertDirection | null;
  category?: OilAlertNewsCategory;
  score: number;
  ageHours?: number;
  matchedKeywords: string[];
}

export interface OilAlertRunResult {
  trigger: OilAlertRunTrigger;
  alertId: string;
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
    freshnessMode: "live" | "fallback";
  };
  topSignals: OilAlertMarketSignal[];
  topHeadlines: OilAlertHeadlineSignal[];
  cooldownUntil?: string;
  emailSubject?: string;
}