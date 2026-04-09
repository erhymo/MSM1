import type { OilAlertDirection, OilAlertMarketTier } from "@/lib/alerts/oil-alert-types";

export type OilAlertMarketConfig = {
  marketId: string;
  label: string;
  weight: number;
  tier: OilAlertMarketTier;
  yesOutcomeOilBias: OilAlertDirection;
  thesis: string;
};

const configuredMarkets = [
  {
    marketId: "1540766",
    label: "Hormuz traffic returns to normal by end of April",
    weight: 1.15,
    tier: 1,
    yesOutcomeOilBias: "bearish",
    thesis: "Normalized Hormuz shipping lowers oil supply-risk premium and is bearish for oil.",
  },
  {
    marketId: "1707830",
    label: "Houthis successfully target shipping by April 30",
    weight: 1,
    tier: 1,
    yesOutcomeOilBias: "bullish",
    thesis: "Successful attacks on commercial shipping raise disruption risk and are bullish for oil.",
  },
  {
    marketId: "1819243",
    label: "QatarEnergy resumes LNG production by April 30",
    weight: 0.65,
    tier: 2,
    yesOutcomeOilBias: "bearish",
    thesis: "Energy supply normalization in Qatar eases regional risk premium and is mildly bearish for oil.",
  },
] satisfies OilAlertMarketConfig[];

function toBoolean(value: string | undefined, fallback: boolean) {
  if (!value) return fallback;
  return value.toLowerCase() === "true";
}

function toNumber(value: string | undefined, fallback: number, minimum: number) {
  return Math.max(minimum, Number(value ?? fallback));
}

export const oilAlertConfig = {
  alertId: "oil-brent-main",
  instrumentTicker: "XBRUSD",
  enabled: toBoolean(process.env.OIL_ALERT_ENABLED, false),
  cooldownHours: toNumber(process.env.OIL_ALERT_COOLDOWN_HOURS, 6, 1),
  minConfidence: toNumber(process.env.OIL_ALERT_MIN_CONFIDENCE, 70, 1),
  minPriceMovePercent: toNumber(process.env.OIL_ALERT_MIN_PRICE_MOVE_PERCENT, 0.9, 0.1),
  minPolymarketMovePp: toNumber(process.env.OIL_ALERT_MIN_POLYMARKET_MOVE_PP, 3, 0.1),
  maxPriceAgeHours: toNumber(process.env.OIL_ALERT_MAX_PRICE_AGE_HOURS, 30, 1),
  maxPolymarketAgeHours: toNumber(process.env.OIL_ALERT_MAX_POLYMARKET_AGE_HOURS, 72, 72),
  minFreshPolymarketMarkets: Math.min(configuredMarkets.length, Math.floor(toNumber(process.env.OIL_ALERT_MIN_FRESH_POLYMARKET_MARKETS, 2, 1))),
  headlinesEnabled: toBoolean(process.env.OIL_ALERT_HEADLINES_ENABLED, true),
  maxHeadlineAgeHours: toNumber(process.env.OIL_ALERT_MAX_HEADLINE_AGE_HOURS, 24, 1),
  markets: configuredMarkets,
  headlines: {
    maxRecords: toNumber(process.env.OIL_ALERT_HEADLINES_MAX_RECORDS, 8, 1),
    oilKeywords: ["oil", "brent", "crude", "energy"],
    contextKeywords: ["trump", "iran", "israel", "taiwan", "china", "russia", "ukraine", "tariff", "sanctions", "opec", "saudi"],
    bullishKeywords: ["attack", "strike", "war", "missile", "escalation", "sanctions", "conflict", "blockade", "shipping", "hormuz", "iran"],
    bearishKeywords: ["ceasefire", "truce", "de-escalation", "talks", "peace", "surplus", "supply boost", "production increase"],
    supplyShockKeywords: ["attack", "strike", "missile", "drone", "escalation", "blockade", "shipping", "tanker", "pipeline", "export disruption", "sanctions", "hormuz", "red sea"],
    supplyReliefKeywords: ["ceasefire", "truce", "peace", "de-escalation", "talks", "sanctions relief", "pipeline restart", "exports resume", "production increase", "surplus"],
    demandUpKeywords: ["stimulus", "rebound", "inventory draw", "travel demand", "refining demand", "strong demand", "china support", "opec cut"],
    demandDownKeywords: ["recession", "slowdown", "weak demand", "inventory build", "tariff", "trade war", "manufacturing slump", "pmi contraction"],
  },
} as const;