export type OilAlertDirection = "bullish" | "bearish";

export type OilAlertDecision =
  | "disabled"
  | "seeded"
  | "skipped-non-live-price"
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
  yesProbability: number;
  previousYesProbability?: number;
  deltaPp?: number;
  oilDirectionalMovePp?: number;
  impliedDirection: OilAlertDirection | null;
}

export interface OilAlertHeadlineSignal {
  title: string;
  url: string;
  domain: string;
  publishedAt: string;
  direction: OilAlertDirection | null;
  score: number;
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