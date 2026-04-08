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

function toMetricRow(label: string, audits: FirestoreRecommendationAuditDocument[], horizonHours: number): FirestoreModelReviewMetricRow {
  const outcomes = audits.map((audit) => getReadyOutcome(audit, horizonHours)).filter((item) => item !== null);
  const directionalWins = outcomes.map((item) => item.directionalWin).filter((item): item is boolean => typeof item === "boolean");
  const returnValues = outcomes.map((item) => item.returnPercent ?? 0);

  return {
    label,
    samples: audits.length,
    avgReturnPercent: round(returnValues.reduce((sum, value) => sum + value, 0) / Math.max(returnValues.length, 1)),
    hitRatePercent: round((directionalWins.filter(Boolean).length / Math.max(directionalWins.length, 1)) * 100),
    avgConfidence: round(audits.reduce((sum, audit) => sum + audit.confidence, 0) / Math.max(audits.length, 1)),
  };
}

function groupRows(
  audits: FirestoreRecommendationAuditDocument[],
  horizonHours: number,
  keyBuilder: (audit: FirestoreRecommendationAuditDocument) => string,
) {
  const groups = new Map<string, FirestoreRecommendationAuditDocument[]>();
  for (const audit of audits) {
    const key = keyBuilder(audit);
    groups.set(key, [...(groups.get(key) ?? []), audit]);
  }

  return [...groups.entries()]
    .map(([label, entries]) => toMetricRow(label, entries, horizonHours))
    .sort((left, right) => right.samples - left.samples || right.hitRatePercent - left.hitRatePercent);
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
  };
}
