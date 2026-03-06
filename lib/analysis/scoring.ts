import { confidenceConfig, factorWeights, signalThresholds, tradePlanConfig } from "@/lib/config/analysis";
import type {
  AnalysisResult,
  COTSnapshot,
  FactorContribution,
  MarketRegime,
  PriceSnapshot,
  SentimentSnapshot,
  SignalType,
  TradeSetupQuality,
  VolatilitySnapshot,
} from "@/lib/types/analysis";

type CoreAnalysis = Omit<AnalysisResult, "instrument" | "aiSummary" | "explanation">;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function round(value: number) {
  return Math.round(value);
}

function getMarketRegime(price: PriceSnapshot, volatility: VolatilitySnapshot): MarketRegime {
  const aligned =
    Math.sign(price.weeklyTrend.bias) === Math.sign(price.dailyTrend.bias) &&
    Math.sign(price.dailyTrend.bias) === Math.sign(price.fourHourMomentum.bias);
  const trendStrength = (Math.abs(price.weeklyTrend.bias) + Math.abs(price.dailyTrend.bias) + Math.abs(price.fourHourMomentum.bias)) / 3;

  if (volatility.regimeHint === "Volatile" || volatility.atrPercent >= 2.1 || volatility.realizedVolatility >= 2.6) return "Volatile";
  if (aligned && trendStrength >= 50 && volatility.regimeHint !== "Ranging") return "Trending";
  if (volatility.regimeHint === "Trending" && trendStrength >= 40) return "Trending";
  return "Ranging";
}

function getTrendLabel(price: PriceSnapshot, regime: MarketRegime) {
  const daily = price.dailyTrend.bias;
  const weekly = price.weeklyTrend.bias;
  const fourHour = price.fourHourMomentum.bias;

  if (regime === "Volatile") return Math.abs(daily) > 20 ? "High-volatility trend" : "Choppy";
  if (daily >= 75 && weekly >= 60) return "Breakout";
  if (daily <= -75 && weekly <= -60) return "Strong downtrend";
  if (daily >= 55 && fourHour >= 45) return "Higher highs";
  if (daily <= -45 && fourHour <= -35) return "Lower highs";
  if (daily >= 35 && fourHour > 0) return "Recovery phase";
  if (daily <= -35 && fourHour < 0) return "Daily rollover";
  if (Math.abs(daily) <= 15) return "Mixed daily";
  return "Range structure";
}

function getRetailScore(retailLong: number) {
  return round(clamp((50 - retailLong) * 3.2, -100, 100));
}

function getTrendScore(price: PriceSnapshot) {
  return round(clamp(price.weeklyTrend.bias * 0.3 + price.dailyTrend.bias * 0.45 + price.fourHourMomentum.bias * 0.25, -100, 100));
}

function getMomentumScore(price: PriceSnapshot) {
  return round(clamp(price.fourHourMomentum.bias * 0.7 + price.dailyTrend.macdHistogram * 6, -100, 100));
}

function getVolatilityScore(volatility: VolatilitySnapshot, regime: MarketRegime, directionalBias: number) {
  if (!directionalBias) return 0;
  if (regime === "Volatile") return round(14 * directionalBias);
  if (volatility.atrPercent < 0.55) return round(20 * directionalBias);
  if (volatility.atrPercent <= 1.6) return round(62 * directionalBias);
  return round(32 * directionalBias);
}

function toContribution(name: string, weight: number, rawScore: number, summary: string): FactorContribution {
  return {
    name,
    weight,
    contribution: round((rawScore * weight) / 100),
    summary,
  };
}

function getSignal(score: number, confidence: number, regime: MarketRegime) {
  const absoluteScore = Math.abs(score);

  if (confidence < confidenceConfig.minimumTradeConfidence || (absoluteScore <= signalThresholds.noTradeAbsScore && regime !== "Trending")) {
    return "NO_TRADE" as const;
  }
  if (score >= signalThresholds.strongBuy) return "STRONG_BUY" as const;
  if (score >= signalThresholds.buy) return "BUY" as const;
  if (score <= signalThresholds.strongSell) return "STRONG_SELL" as const;
  if (score <= signalThresholds.sell) return "SELL" as const;
  if (absoluteScore <= signalThresholds.waitAbsScore || confidence < confidenceConfig.holdConfidenceFloor) {
    return "WAIT" as const;
  }
  return "HOLD" as const;
}

function getSetupQuality(signal: SignalType, score: number, confidence: number): TradeSetupQuality {
  if (signal === "NO_TRADE") return "No Trade";

  const rank = Math.abs(score) * 0.58 + confidence * 0.42;

  if (rank >= 82 && confidence >= 72) return "A+";
  if (rank >= 70) return "A";
  if (rank >= 56) return "B";
  return "C";
}

function buildSignalHistory(score: number): CoreAnalysis["signalHistory"] {
  const direction = Math.sign(score || 1);

  return Array.from({ length: 6 }, (_, index) => {
    const historicalScore = round(score - (5 - index) * direction * 5);
    const historicalSignal =
      historicalScore >= signalThresholds.strongBuy
        ? "STRONG_BUY"
        : historicalScore >= signalThresholds.buy
          ? "BUY"
          : historicalScore <= signalThresholds.strongSell
            ? "STRONG_SELL"
            : historicalScore <= signalThresholds.sell
              ? "SELL"
              : Math.abs(historicalScore) <= signalThresholds.waitAbsScore
                ? "WAIT"
                : "HOLD";

    return { label: `W${index + 1}`, signal: historicalSignal, score: historicalScore };
  });
}

function buildConfidenceHistory(confidence: number, momentumScore: number) {
  const direction = Math.sign(momentumScore || 1);

  return Array.from({ length: 8 }, (_, index) => ({
    label: `C${index + 1}`,
    value: clamp(round(confidence - (7 - index) * direction * 2 + Math.sin(index) * 3), 20, 95),
  }));
}

export function computeAnalysis(price: PriceSnapshot, cot: COTSnapshot, sentiment: SentimentSnapshot, volatility: VolatilitySnapshot): CoreAnalysis {
  const marketRegime = getMarketRegime(price, volatility);
  const cotScore = round(clamp(cot.netPosition, -100, 100));
  const trendScore = getTrendScore(price);
  const momentumScore = getMomentumScore(price);
  const retailScore = getRetailScore(sentiment.retailLong);
  const directionalBias = Math.sign(cotScore + trendScore + momentumScore + retailScore) || Math.sign(price.dailyTrend.bias);
  const volatilityScore = getVolatilityScore(volatility, marketRegime, directionalBias);

  const factorContributions = [
    toContribution("COT", factorWeights.cot, cotScore, `${cot.bias} large speculator bias`),
    toContribution("Trend", factorWeights.trend, trendScore, `${getTrendLabel(price, marketRegime)} across weekly/daily/4H`),
    toContribution("Retail sentiment", factorWeights.retailSentiment, retailScore, `Retail long at ${sentiment.retailLong.toFixed(0)}% used contrarian`),
    toContribution("Momentum", factorWeights.momentum, momentumScore, `4H timing aligned at ${price.fourHourMomentum.bias}`),
    toContribution(
      "Volatility",
      factorWeights.volatility,
      volatilityScore,
      `ATR ${volatility.atrPercent.toFixed(2)}% with ${volatility.regimeHint.toLowerCase()} volatility profile`,
    ),
  ];

  const score = clamp(factorContributions.reduce((sum, item) => sum + item.contribution, 0), -100, 100);
  const relevantScores = [cotScore, trendScore, retailScore, momentumScore, volatilityScore].filter((value) => Math.abs(value) >= 15);
  const alignedCount = relevantScores.filter((value) => Math.sign(value) === Math.sign(score)).length;
  const alignment = relevantScores.length ? alignedCount / relevantScores.length : 0.35;
  const fallbackCount = [price.freshness, cot.freshness, sentiment.freshness, volatility.freshness].filter(
    (item) => item.mode === "fallback",
  ).length;
  const dataQuality = 20 - fallbackCount * confidenceConfig.fallbackPenalty;
  const regimePenalty = marketRegime === "Volatile" ? 10 : marketRegime === "Ranging" ? 4 : 0;
  const lowConvictionPenalty = Math.abs(score) < 25 ? 12 : 0;
  const convictionBonus = Math.abs(score) >= 70 ? 8 : Math.abs(score) >= 50 ? 4 : 0;

  const confidence = clamp(round(Math.abs(score) * 0.44 + alignment * 34 + dataQuality - regimePenalty - lowConvictionPenalty + convictionBonus), 20, 95);
  const signal = getSignal(score, confidence, marketRegime);
  const setupQuality = getSetupQuality(signal, score, confidence);
  const direction = Math.sign(score) || 1;
  const entry = price.currentPrice;
  const stopOffset = price.atr14 * tradePlanConfig.stopAtrMultiplier;
  const targetOffset = price.atr14 * tradePlanConfig.targetAtrMultiplier;
  const stopLoss = signal === "NO_TRADE" ? entry : Number((entry - direction * stopOffset).toFixed(4));
  const target = signal === "NO_TRADE" ? entry : Number((entry + direction * targetOffset).toFixed(4));
  const riskReward = signal === "NO_TRADE" ? 0 : Number((tradePlanConfig.targetAtrMultiplier / tradePlanConfig.stopAtrMultiplier).toFixed(1));

  return {
    signal,
    score,
    confidence,
    cotBias: cot.bias,
    trend: getTrendLabel(price, marketRegime),
    retailLong: sentiment.retailLong,
    marketRegime,
    updatedAt: price.updatedAt,
    freshness: {
      mode: fallbackCount > 0 ? "fallback" : "live",
      updatedAt: price.updatedAt,
      note: fallbackCount > 0 ? `${fallbackCount} source(s) using last stored value` : "All primary sources delivered live snapshots",
    },
    setupQuality,
    entry,
    stopLoss,
    target,
    riskReward,
    factorContributions,
    priceHistory: price.priceHistory,
    confidenceHistory: buildConfidenceHistory(confidence, momentumScore),
    cotHistory: cot.history,
    sentimentHistory: sentiment.history,
    signalHistory: buildSignalHistory(score),
  };
}