import type { AnalysisResult, SignalType } from "@/lib/types/analysis";

const nokCurrencyFormatter = new Intl.NumberFormat("nb-NO", {
  style: "currency",
  currency: "NOK",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const SIGNAL_LABELS: Record<SignalType, string> = {
  STRONG_BUY: "Strong Buy",
  BUY: "Buy",
  WAIT: "Wait",
  HOLD: "Hold",
  SELL: "Sell",
  STRONG_SELL: "Strong Sell",
  NO_TRADE: "No Trade",
};

const SIGNAL_SORT_PRIORITY: Record<SignalType, number> = {
  STRONG_BUY: 0,
  BUY: 1,
  STRONG_SELL: 2,
  SELL: 3,
  HOLD: 4,
  WAIT: 5,
  NO_TRADE: 6,
};

export function formatPercent(value: number, digits = 0) {
  return `${value.toFixed(digits)}%`;
}

export function formatPrice(value: number) {
  if (value >= 100) return value.toFixed(2);
  if (value >= 10) return value.toFixed(3);
  return value.toFixed(4);
}

export function formatNok(value: number) {
  return nokCurrencyFormatter.format(value);
}

export function formatApproxNokPrice(value: number, analysis: AnalysisResult) {
  const nokPerQuote = analysis.nokDisplay?.nokPerQuote;

  if (!Number.isFinite(value) || !Number.isFinite(nokPerQuote) || !nokPerQuote || nokPerQuote <= 0) {
    return null;
  }

  return `≈ ${formatNok(value * nokPerQuote)}`;
}

export function formatRelativeTime(isoDate: string) {
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const diffMinutes = Math.max(1, Math.round(diffMs / 60000));

  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.round(diffHours / 24);
  return `${diffDays}d ago`;
}

export function compareAnalysisResults(a: AnalysisResult, b: AnalysisResult) {
  const signalPriority = SIGNAL_SORT_PRIORITY[a.signal] - SIGNAL_SORT_PRIORITY[b.signal];
  if (signalPriority !== 0) return signalPriority;

  const directionalScoreDiff = Math.abs(b.score) - Math.abs(a.score);
  if (directionalScoreDiff !== 0) return directionalScoreDiff;

  if (b.confidence !== a.confidence) return b.confidence - a.confidence;
  return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
}