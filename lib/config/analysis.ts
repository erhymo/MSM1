export const factorWeights = {
  cot: 35,
  trend: 25,
  retailSentiment: 20,
  momentum: 10,
  volatility: 10,
} as const;

export const signalThresholds = {
  strongBuy: 80,
  buy: 40,
  sell: -40,
  strongSell: -80,
  noTradeAbsScore: 12,
  waitAbsScore: 20,
} as const;

export const confidenceConfig = {
  minimumTradeConfidence: 38,
  holdConfidenceFloor: 52,
  fallbackPenalty: 8,
} as const;

export const tradePlanConfig = {
  stopAtrMultiplier: 1.2,
  targetAtrMultiplier: 2.3,
} as const;