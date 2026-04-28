import type {
  FirestoreModelReviewMetricRow,
  FirestoreModelReviewReportDocument,
  FirestoreRecommendationAuditDocument,
} from "@/lib/types/firestore";

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function getReadyOutcome(audit: FirestoreRecommendationAuditDocument, horizonHours: number) {
  return audit.outcomes.find((outcome) => outcome.horizonHours === horizonHours && outcome.status === "ready") ?? null;
}

function getConfidenceBucket(confidence: number) {
  if (confidence >= 85) return "85+";
  if (confidence >= 75) return "75-84";
  if (confidence >= 65) return "65-74";
  if (confidence >= 50) return "50-64";
  return "0-49";
}

type MetricOptions = {
  returnSelector?: (audit: FirestoreRecommendationAuditDocument, horizonHours: number) => number;
  winSelector?: (audit: FirestoreRecommendationAuditDocument, horizonHours: number) => boolean | undefined;
  confidenceSelector?: (audit: FirestoreRecommendationAuditDocument) => number;
};

function toMetricRow(label: string, audits: FirestoreRecommendationAuditDocument[], horizonHours: number, options: MetricOptions = {}): FirestoreModelReviewMetricRow {
  const directionalWins = audits.map((audit) => options.winSelector?.(audit, horizonHours) ?? getReadyOutcome(audit, horizonHours)?.directionalWin).filter((item): item is boolean => typeof item === "boolean");
  const returnValues = audits.map((audit) => options.returnSelector?.(audit, horizonHours) ?? getReadyOutcome(audit, horizonHours)?.returnPercent ?? 0);
  const confidenceValues = audits.map((audit) => options.confidenceSelector?.(audit) ?? audit.confidence);

  return {
    label,
    samples: audits.length,
    avgReturnPercent: round(returnValues.reduce((sum, value) => sum + value, 0) / Math.max(returnValues.length, 1)),
    hitRatePercent: round((directionalWins.filter(Boolean).length / Math.max(directionalWins.length, 1)) * 100),
    avgConfidence: round(confidenceValues.reduce((sum, value) => sum + value, 0) / Math.max(confidenceValues.length, 1)),
  };
}

function groupRows(
  audits: FirestoreRecommendationAuditDocument[],
  horizonHours: number,
  keyBuilder: (audit: FirestoreRecommendationAuditDocument) => string,
  options: MetricOptions = {},
) {
  const groups = new Map<string, FirestoreRecommendationAuditDocument[]>();
  for (const audit of audits) {
    const key = keyBuilder(audit);
    groups.set(key, [...(groups.get(key) ?? []), audit]);
  }

  return [...groups.entries()]
    .map(([label, entries]) => toMetricRow(label, entries, horizonHours, options))
    .sort((left, right) => right.samples - left.samples || right.hitRatePercent - left.hitRatePercent);
}

function getTacticalReturn(audit: FirestoreRecommendationAuditDocument, horizonHours: number) {
  return getReadyOutcome(audit, horizonHours)?.tacticalReturnPercent ?? getReadyOutcome(audit, horizonHours)?.returnPercent ?? 0;
}

function getTacticalWin(audit: FirestoreRecommendationAuditDocument, horizonHours: number) {
  return getReadyOutcome(audit, horizonHours)?.tacticalDirectionalWin;
}

export function buildModelReviewMetrics(
  audits: FirestoreRecommendationAuditDocument[],
  horizonHours: number,
): FirestoreModelReviewReportDocument["metrics"] {
  const completed = audits.filter((audit) => getReadyOutcome(audit, horizonHours));

  return {
    total: toMetricRow("All directional audits", completed, horizonHours),
    bySignal: groupRows(completed, horizonHours, (audit) => audit.signal),
    byConfidenceBucket: groupRows(completed, horizonHours, (audit) => getConfidenceBucket(audit.confidence)),
    byRegime: groupRows(completed, horizonHours, (audit) => audit.marketRegime),
    byFreshnessMode: groupRows(completed, horizonHours, (audit) => audit.freshnessMode),
    byTacticalAction: groupRows(completed, horizonHours, (audit) => audit.tacticalAction ?? "none", {
      returnSelector: getTacticalReturn,
      winSelector: getTacticalWin,
      confidenceSelector: (audit) => audit.tacticalConfidence ?? audit.confidence,
    }),
    byTradeGuidance: groupRows(completed, horizonHours, (audit) => audit.tradeGuidance ?? "none", {
      returnSelector: getTacticalReturn,
      winSelector: getTacticalWin,
      confidenceSelector: (audit) => audit.tacticalConfidence ?? audit.confidence,
    }),
  };
}
