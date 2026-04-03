import type { OilAlertDirection } from "@/lib/alerts/oil-alert-types";

export type OilAlertMarketConfig = {
  marketId: string;
  label: string;
  weight: number;
  yesOutcomeOilBias: OilAlertDirection;
  thesis: string;
};

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
  headlinesEnabled: toBoolean(process.env.OIL_ALERT_HEADLINES_ENABLED, true),
  markets: [
    {
      marketId: "567621",
      label: "China/Taiwan invasion risk (2026)",
      weight: 1,
      yesOutcomeOilBias: "bullish",
      thesis: "Higher odds of a China/Taiwan conflict typically increase oil risk premium.",
    },
    {
      marketId: "567687",
      label: "Russia/Ukraine ceasefire (2026)",
      weight: 0.85,
      yesOutcomeOilBias: "bearish",
      thesis: "Higher ceasefire odds can reduce geopolitical oil risk premium.",
    },
    {
      marketId: "567688",
      label: "Netanyahu out by end of 2026",
      weight: 0.45,
      yesOutcomeOilBias: "bearish",
      thesis: "Lower regional tension risk is mildly bearish for oil risk premium.",
    },
  ] satisfies OilAlertMarketConfig[],
  headlines: {
    maxRecords: toNumber(process.env.OIL_ALERT_HEADLINES_MAX_RECORDS, 8, 1),
    oilKeywords: ["oil", "brent", "crude", "energy"],
    contextKeywords: ["trump", "iran", "israel", "taiwan", "china", "russia", "ukraine", "tariff", "sanctions", "opec", "saudi"],
    bullishKeywords: ["attack", "strike", "war", "missile", "escalation", "sanctions", "conflict", "blockade", "shipping", "tariff", "iran"],
    bearishKeywords: ["ceasefire", "truce", "de-escalation", "talks", "peace", "surplus", "supply boost", "production increase"],
  },
} as const;