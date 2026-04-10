import { confidenceConfig, factorWeights, signalThresholds, tradePlanConfig } from "@/lib/config/analysis";
import { getPolicyRate, getTwoYearYield, getTwoYearYieldChange5d, policyRateConfig } from "@/lib/config/policy-rates";
import type {
  AnalysisResult,
  COTSnapshot,
  FactorContribution,
  MarketRegime,
  PolicyRateSignal,
  PriceSnapshot,
  SentimentSnapshot,
  SignalType,
  TradeSetupQuality,
  VolatilitySnapshot,
} from "@/lib/types/analysis";
import { getInstrumentCurrencyPair } from "@/lib/utils/instrument-currency";

type CoreAnalysis = Omit<AnalysisResult, "instrument" | "aiSummary" | "explanation">;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function round(value: number) {
  return Math.round(value);
}

function formatSignedPercentPoints(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}pp`;
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
  const deviation = 50 - retailLong;
  const absDeviation = Math.abs(deviation);
  const normalizedDeviation = absDeviation / 50;
  const amplified = Math.pow(normalizedDeviation, 1.4) * 50;
  return round(clamp(Math.sign(deviation) * amplified * 2.8, -100, 100));
}

function getTrendScore(price: PriceSnapshot) {
  return round(clamp(price.weeklyTrend.bias * 0.3 + price.dailyTrend.bias * 0.45 + price.fourHourMomentum.bias * 0.25, -100, 100));
}

function getCotMomentumScore(cot: COTSnapshot) {
  const history = cot.history;
  if (history.length < 3) return 0;

  const recent = history.slice(-3);
  const oldest = recent[0]!.value;
  const latest = recent[recent.length - 1]!.value;
  const rateOfChange = latest - oldest;

  const accelerating = history.length >= 4 && Math.abs(latest - recent[1]!.value) > Math.abs(recent[1]!.value - oldest);

  return round(clamp(rateOfChange * 2.2 + (accelerating ? Math.sign(rateOfChange) * 12 : 0), -100, 100));
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

function getRateBias(score: number): PolicyRateSignal["bias"] {
  if (score >= 12) return "Bullish";
  if (score <= -12) return "Bearish";
  return "Neutral";
}

function getRateScore(rateSignal: PolicyRateSignal | null) {
  if (!rateSignal) return 0;

  const policyScore = clamp(rateSignal.spread * 16, -100, 100);
  const twoYearScore = clamp((rateSignal.twoYearSpread ?? 0) * 20, -100, 100);
  const momentumScore = clamp((rateSignal.twoYearSpreadChange5d ?? 0) * 180, -100, 100);

  return round(clamp(policyScore * 0.35 + twoYearScore * 0.45 + momentumScore * 0.2, -100, 100));
}

function getPolicyRateSignal(ticker: string): PolicyRateSignal | null {
  const pair = getInstrumentCurrencyPair(ticker);
  if (!pair) return null;

  const baseRate = getPolicyRate(pair.baseCurrency);
  const quoteRate = getPolicyRate(pair.quoteCurrency);
  if (typeof baseRate !== "number" || typeof quoteRate !== "number") return null;

  const spread = Number((baseRate - quoteRate).toFixed(2));
  const baseTwoYearYield = getTwoYearYield(pair.baseCurrency);
  const quoteTwoYearYield = getTwoYearYield(pair.quoteCurrency);
  const baseTwoYearYieldChange5d = getTwoYearYieldChange5d(pair.baseCurrency);
  const quoteTwoYearYieldChange5d = getTwoYearYieldChange5d(pair.quoteCurrency);
  const twoYearSpread =
    typeof baseTwoYearYield === "number" && typeof quoteTwoYearYield === "number"
      ? Number((baseTwoYearYield - quoteTwoYearYield).toFixed(2))
      : undefined;
  const twoYearSpreadChange5d =
    typeof baseTwoYearYieldChange5d === "number" && typeof quoteTwoYearYieldChange5d === "number"
      ? Number((baseTwoYearYieldChange5d - quoteTwoYearYieldChange5d).toFixed(2))
      : undefined;

  const signalBase: PolicyRateSignal = {
    baseCurrency: pair.baseCurrency,
    quoteCurrency: pair.quoteCurrency,
    baseRate,
    quoteRate,
    spread,
    ...(typeof baseTwoYearYield === "number" ? { baseTwoYearYield } : {}),
    ...(typeof quoteTwoYearYield === "number" ? { quoteTwoYearYield } : {}),
    ...(typeof twoYearSpread === "number" ? { twoYearSpread } : {}),
    ...(typeof twoYearSpreadChange5d === "number" ? { twoYearSpreadChange5d } : {}),
    bias: "Neutral",
    source: policyRateConfig.source,
    updatedAt: policyRateConfig.updatedAt,
  };
  const score = getRateScore(signalBase);

  return {
    ...signalBase,
    score,
    bias: getRateBias(score),
    source: policyRateConfig.source,
    updatedAt: policyRateConfig.updatedAt,
  };
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
  const cotMomentumScore = getCotMomentumScore(cot);
  const trendScore = getTrendScore(price);
  const momentumScore = getMomentumScore(price);
  const retailScore = getRetailScore(sentiment.retailLong);
  const rateSignal = getPolicyRateSignal(price.ticker);
  const rateScore = rateSignal?.score ?? 0;
  const directionalBias = Math.sign(cotScore + cotMomentumScore + trendScore + momentumScore + retailScore + rateScore) || Math.sign(price.dailyTrend.bias);
  const volatilityScore = getVolatilityScore(volatility, marketRegime, directionalBias);

  const cotMomentumDirection = cotMomentumScore > 0 ? "accelerating" : cotMomentumScore < 0 ? "decelerating" : "flat";
  const factorContributions = [
    toContribution("COT", factorWeights.cot, cotScore, `${cot.bias} large speculator bias`),
    toContribution("COT momentum", factorWeights.cotMomentum, cotMomentumScore, `Positioning ${cotMomentumDirection} over last 3 weeks`),
    toContribution("Trend", factorWeights.trend, trendScore, `${getTrendLabel(price, marketRegime)} across weekly/daily/4H`),
    ...(rateSignal
      ? [
          toContribution(
            "Rates",
            factorWeights.rateSignal,
            rateScore,
            `${rateSignal.baseCurrency}/${rateSignal.quoteCurrency} policy ${formatSignedPercentPoints(rateSignal.spread)}; 2Y ${formatSignedPercentPoints(rateSignal.twoYearSpread ?? 0)}; 5d Δ ${formatSignedPercentPoints(rateSignal.twoYearSpreadChange5d ?? 0)}`,
          ),
        ]
      : []),
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
  const relevantScores = [cotScore, cotMomentumScore, trendScore, retailScore, momentumScore, volatilityScore, rateScore].filter((value) => Math.abs(value) >= 15);
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
    ...(rateSignal ? { rateSignal } : {}),
    priceHistory: price.priceHistory,
    confidenceHistory: buildConfidenceHistory(confidence, momentumScore),
    cotHistory: cot.history,
    sentimentHistory: sentiment.history,
    signalHistory: buildSignalHistory(score),
  };
}