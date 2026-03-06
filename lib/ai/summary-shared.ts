import type { AnalysisResult } from "@/lib/types/analysis";
import { SIGNAL_LABELS } from "@/lib/utils/format";

export type SummaryFactors = {
  cotNetPosition: number;
  weeklyTrendBias: number;
  dailyTrendBias: number;
  momentumBias: number;
  retailShort: number;
};

export type SummaryServiceInput = {
  analysis: AnalysisResult;
  factors: SummaryFactors;
};

export type SummaryServiceOutput = {
  summary: string;
  explanation: string;
};

export interface SummaryService {
  summarize(input: SummaryServiceInput): Promise<SummaryServiceOutput>;
}

function clampPercent(value: number) {
  return Math.min(100, Math.max(0, Number(value.toFixed(1))));
}

function getDirectionalPhrase(value: number, bullishLabel: string, bearishLabel: string, neutralLabel: string) {
  if (value >= 20) return bullishLabel;
  if (value <= -20) return bearishLabel;
  return neutralLabel;
}

function getTopFactorSummaries(analysis: AnalysisResult) {
  return [...analysis.factorContributions]
    .sort((left, right) => Math.abs(right.contribution) - Math.abs(left.contribution))
    .slice(0, 3)
    .map((factor) => factor.summary);
}

export function getCotPhrase(input: SummaryServiceInput) {
  const cotBias = input.analysis.cotBias.toLowerCase();

  if (cotBias.includes("bull")) return "COT bullish";
  if (cotBias.includes("bear")) return "COT bearish";
  if (input.factors.cotNetPosition >= 20) return "COT bullish";
  if (input.factors.cotNetPosition <= -20) return "COT bearish";
  return "COT neutral";
}

export function getRetailPhrase(input: SummaryServiceInput) {
  const retailLong = clampPercent(input.analysis.retailLong);
  const retailShort = clampPercent(input.factors.retailShort);

  if (retailLong >= 65) return `retail heavily long (${retailLong.toFixed(0)}% long)`;
  if (retailShort >= 65) return `retail heavily short (${retailShort.toFixed(0)}% short)`;
  if (retailLong >= 55) return `retail net long (${retailLong.toFixed(0)}% long)`;
  if (retailShort >= 55) return `retail net short (${retailShort.toFixed(0)}% short)`;
  return `retail balanced (${retailLong.toFixed(0)}% long)`;
}

export function getDailyTrendPhrase(input: SummaryServiceInput) {
  return getDirectionalPhrase(input.factors.dailyTrendBias, "daily trend bullish", "daily trend bearish", "daily trend mixed");
}

export function getMomentumPhrase(input: SummaryServiceInput) {
  if (input.factors.momentumBias >= 45) return "4H momentum improving";
  if (input.factors.momentumBias <= -45) return "4H momentum weakening";
  if (input.factors.momentumBias >= 15) return "4H momentum slightly positive";
  if (input.factors.momentumBias <= -15) return "4H momentum slightly negative";
  return "4H momentum mixed";
}

export function buildTemplateSummary(input: SummaryServiceInput) {
  const verdict = SIGNAL_LABELS[input.analysis.signal];
  const summaryBody = [getCotPhrase(input), getRetailPhrase(input), getDailyTrendPhrase(input), getMomentumPhrase(input)].join(", ");
  const fallbackSuffix = input.analysis.freshness.mode === "fallback" ? " Fallback data was used for part of the stack." : "";

  return `${summaryBody}; therefore ${verdict} over the next 1–3 weeks.${fallbackSuffix}`;
}

export function buildRuleBasedExplanation(input: SummaryServiceInput) {
  const strongestFactors = getTopFactorSummaries(input.analysis);
  const factorSuffix = strongestFactors.length ? ` Strongest factors: ${strongestFactors.join("; ")}.` : "";

  return `${input.analysis.instrument.ticker} remains ${input.analysis.marketRegime.toLowerCase()} with ${input.analysis.confidence}% confidence. The signal is set by deterministic scoring, not by AI.${factorSuffix}`;
}

export function normalizeSummaryText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function validateSummaryText(candidate: string, input: SummaryServiceInput, maxCharacters: number) {
  const normalized = normalizeSummaryText(candidate);

  if (!normalized || normalized.length > maxCharacters) {
    return null;
  }

  const verdict = SIGNAL_LABELS[input.analysis.signal].toLowerCase();

  if (!normalized.toLowerCase().includes(verdict)) {
    return null;
  }

  return /[.!?]$/.test(normalized) ? normalized : `${normalized}.`;
}

export function buildPromptFacts(input: SummaryServiceInput) {
  const verdict = SIGNAL_LABELS[input.analysis.signal];

  return [
    `Ticker: ${input.analysis.instrument.ticker}`,
    `Signal already decided by deterministic scoring: ${verdict}`,
    `Confidence: ${input.analysis.confidence}%`,
    `Market regime: ${input.analysis.marketRegime}`,
    `COT bias phrase: ${getCotPhrase(input)}`,
    `COT net position score: ${input.factors.cotNetPosition}`,
    `Retail phrase: ${getRetailPhrase(input)}`,
    `Retail long: ${input.analysis.retailLong.toFixed(1)}%`,
    `Retail short: ${clampPercent(input.factors.retailShort).toFixed(1)}%`,
    `Weekly trend bias: ${input.factors.weeklyTrendBias}`,
    `Daily trend phrase: ${getDailyTrendPhrase(input)}`,
    `Daily trend bias: ${input.factors.dailyTrendBias}`,
    `Momentum phrase: ${getMomentumPhrase(input)}`,
    `4H momentum bias: ${input.factors.momentumBias}`,
    `Freshness mode: ${input.analysis.freshness.mode}`,
  ];
}