import "server-only";

import { modelReviewConfig } from "@/lib/config/model-review";
import {
  getRecentRecommendationAudits,
  getStoredPriceEntriesSince,
  writeRecommendationAuditUpdates,
} from "@/lib/firebase/firestore-model-review-service";
import type {
  FirestoreRawMarketDataDocument,
  FirestoreRecommendationAuditDocument,
  FirestoreRecommendationAuditOutcome,
} from "@/lib/types/firestore";

function round(value: number, digits = 3) {
  return Number(value.toFixed(digits));
}

function getDirectionalMultiplier(signal: FirestoreRecommendationAuditDocument["signal"]) {
  if (signal === "BUY" || signal === "STRONG_BUY") return 1;
  if (signal === "SELL" || signal === "STRONG_SELL") return -1;
  return 1;
}

function getTacticalMultiplier(audit: FirestoreRecommendationAuditDocument) {
  if (audit.tacticalAction === "ENTER_LONG") return 1;
  if (audit.tacticalAction === "ENTER_SHORT") return -1;
  if (audit.tacticalAction === "HOLD") return getDirectionalMultiplier(audit.signal);
  return null;
}

function toCurrentPrice(entry: FirestoreRawMarketDataDocument) {
  const value = entry.values.currentPrice;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function evaluateOutcomeWindow(
  audit: FirestoreRecommendationAuditDocument,
  entries: FirestoreRawMarketDataDocument[],
  horizonHours: number,
): FirestoreRecommendationAuditOutcome {
  const targetTime = new Date(new Date(audit.createdAt).getTime() + horizonHours * 60 * 60 * 1000).toISOString();
  const futureEntries = entries.filter((entry) => entry.capturedAt >= audit.createdAt);
  const observation = futureEntries.find((entry) => entry.capturedAt >= targetTime);

  if (!observation) {
    return { horizonHours, targetTime, status: "pending", observationCount: futureEntries.length };
  }

  const observedPrice = toCurrentPrice(observation);
  const observedAt = observation.capturedAt;
  if (observedPrice === null) {
    return { horizonHours, targetTime, status: "pending", observationCount: futureEntries.length };
  }

  const multiplier = getDirectionalMultiplier(audit.signal);
  const tacticalMultiplier = getTacticalMultiplier(audit);
  const observedSeries = futureEntries.filter((entry) => entry.capturedAt <= observedAt).map(toCurrentPrice).filter((value): value is number => value !== null);
  const directionalReturns = observedSeries.map((price) => ((price - audit.entry) / audit.entry) * 100 * multiplier);
  const tacticalReturns = tacticalMultiplier === null ? [] : observedSeries.map((price) => ((price - audit.entry) / audit.entry) * 100 * tacticalMultiplier);
  const targetHit = multiplier === 1 ? observedSeries.some((price) => price >= audit.target) : observedSeries.some((price) => price <= audit.target);
  const stopHit = multiplier === 1 ? observedSeries.some((price) => price <= audit.stopLoss) : observedSeries.some((price) => price >= audit.stopLoss);
  const directionalWin =
    audit.signal === "BUY" || audit.signal === "STRONG_BUY" || audit.signal === "SELL" || audit.signal === "STRONG_SELL"
      ? ((observedPrice - audit.entry) / audit.entry) * 100 * multiplier > 0
      : undefined;

  return {
    horizonHours,
    targetTime,
    status: "ready",
    evaluatedAt: new Date().toISOString(),
    observedPrice,
    observedAt,
    observationCount: observedSeries.length,
    returnPercent: round(((observedPrice - audit.entry) / audit.entry) * 100 * multiplier),
    maxFavorablePercent: round(Math.max(...directionalReturns, 0)),
    maxAdversePercent: round(Math.min(...directionalReturns, 0)),
    targetHit,
    stopHit,
    ...(typeof directionalWin === "boolean" ? { directionalWin } : {}),
    ...(tacticalMultiplier === null
      ? {}
      : {
          tacticalReturnPercent: round(((observedPrice - audit.entry) / audit.entry) * 100 * tacticalMultiplier),
          tacticalDirectionalWin: ((observedPrice - audit.entry) / audit.entry) * 100 * tacticalMultiplier > 0,
          tacticalMaxFavorablePercent: round(Math.max(...tacticalReturns, 0)),
          tacticalMaxAdversePercent: round(Math.min(...tacticalReturns, 0)),
        }),
  };
}

export async function refreshRecommendationAuditOutcomes(options: { dryRun?: boolean } = {}) {
  const audits = await getRecentRecommendationAudits(modelReviewConfig.auditLookbackHours);
  if (!audits.length) {
    return { dryRun: Boolean(options.dryRun), auditsConsidered: 0, auditsUpdated: 0, readyWindows: 0, pendingWindows: 0 };
  }

  const grouped = new Map<string, FirestoreRecommendationAuditDocument[]>();
  for (const audit of audits) grouped.set(audit.ticker, [...(grouped.get(audit.ticker) ?? []), audit]);

  const updates: FirestoreRecommendationAuditDocument[] = [];
  for (const [ticker, tickerAudits] of grouped) {
    const oldestAudit = tickerAudits.map((audit) => audit.createdAt).sort()[0] ?? new Date().toISOString();
    const entries = await getStoredPriceEntriesSince(ticker, oldestAudit);

    for (const audit of tickerAudits) {
      const outcomes = modelReviewConfig.outcomeWindowsHours.map((hours) => evaluateOutcomeWindow(audit, entries, hours));
      const readyCount = outcomes.filter((item) => item.status === "ready").length;
      const evaluationStatus: FirestoreRecommendationAuditDocument["evaluationStatus"] =
        readyCount === 0 ? "pending" : readyCount === outcomes.length ? "complete" : "partial";
      const nextAudit = { ...audit, outcomes, evaluationStatus };

      if (JSON.stringify(audit.outcomes ?? []) !== JSON.stringify(outcomes) || audit.evaluationStatus !== evaluationStatus) {
        updates.push(nextAudit);
      }
    }
  }

  if (!options.dryRun && updates.length) {
    await writeRecommendationAuditUpdates(updates);
  }

  const allOutcomes = updates.flatMap((audit) => audit.outcomes);
  return {
    dryRun: Boolean(options.dryRun),
    auditsConsidered: audits.length,
    auditsUpdated: updates.length,
    readyWindows: allOutcomes.filter((item) => item.status === "ready").length,
    pendingWindows: allOutcomes.filter((item) => item.status === "pending").length,
  };
}
