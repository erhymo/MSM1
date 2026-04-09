import "server-only";

import type { OilAlertDirection, OilAlertHeadlineSignal, OilAlertMarketSignal, OilAlertNewsCategory, OilAlertRunOptions, OilAlertRunResult, OilAlertRunTrigger } from "@/lib/alerts/oil-alert-types";
import { oilAlertConfig } from "@/lib/config/oil-alerts";
import { adminDb } from "@/lib/firebase/admin";
import { appendOilAlertHistory, getOilAlertState, writeOilAlertState } from "@/lib/firebase/firestore-alert-service";
import { writeSystemLog } from "@/lib/firebase/firestore-system-log-service";
import { instruments } from "@/lib/config/instruments";
import { isOilAlertEmailConfigured, sendOilAlertEmail } from "@/lib/email/sendgrid";
import { gdeltNewsProvider } from "@/lib/providers/news/gdelt-provider";
import { polymarketProvider } from "@/lib/providers/polymarket/provider";
import { priceProvider } from "@/lib/providers/price/provider";
import type { PolymarketMarketSnapshot } from "@/lib/providers/polymarket/provider";
import type { FirestoreOilAlertObservedMarketDocument, FirestoreOilAlertStateDocument } from "@/lib/types/firestore";

type OilAlertLayerEvaluation = {
  direction: OilAlertDirection | null;
  score: number;
  alignedCount: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function getDurationMs(startedAt: string, completedAt: string) {
  return Math.max(0, new Date(completedAt).getTime() - new Date(startedAt).getTime());
}

function getPercentChange(current: number, previous: number) {
  if (!previous) return 0;
  return ((current - previous) / previous) * 100;
}

function getAgeMs(updatedAt: string, referenceTime: string) {
  const updated = new Date(updatedAt).getTime();
  const reference = new Date(referenceTime).getTime();
  if (!Number.isFinite(updated) || !Number.isFinite(reference)) return Number.POSITIVE_INFINITY;
  return Math.max(0, reference - updated);
}

function getAgeHours(updatedAt: string, referenceTime: string) {
  return round(getAgeMs(updatedAt, referenceTime) / (60 * 60 * 1000), 2);
}

function isFreshEnough(updatedAt: string, maxAgeHours: number, referenceTime: string) {
  return getAgeMs(updatedAt, referenceTime) <= maxAgeHours * 60 * 60 * 1000;
}

function isActiveFreshMarket(snapshot: PolymarketMarketSnapshot, referenceTime: string) {
  return snapshot.active && !snapshot.closed && isFreshEnough(snapshot.updatedAt, oilAlertConfig.maxPolymarketAgeHours, referenceTime);
}

function getBrentInstrument() {
  const instrument = instruments.find((entry) => entry.ticker === oilAlertConfig.instrumentTicker);
  if (!instrument) {
    throw new Error(`Instrument ${oilAlertConfig.instrumentTicker} is not configured`);
  }

  return instrument;
}

function getDirectionFromSignedValue(value: number): OilAlertDirection | null {
  if (value > 0) return "bullish";
  if (value < 0) return "bearish";
  return null;
}

function getTierMultiplier(tier: number) {
  if (tier === 1) return 1;
  if (tier === 2) return 0.72;
  return 0.42;
}

function normalizeHeadlineKey(title: string) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function getSourceWeight(domain: string) {
  return /(reuters|bloomberg|apnews|ft|wsj|cnbc)/i.test(domain) ? 1.15 : 1;
}

function getRecencyWeight(ageHours: number) {
  if (ageHours <= 3) return 1.15;
  if (ageHours <= 8) return 1;
  if (ageHours <= 16) return 0.8;
  return 0.6;
}

function evaluateMarketRegime(priceMovePercent: number): OilAlertLayerEvaluation & { actionableMove: boolean } {
  const absoluteMove = Math.abs(priceMovePercent);
  const direction = getDirectionFromSignedValue(priceMovePercent);
  const baseScore = clamp((absoluteMove / oilAlertConfig.minPriceMovePercent) * 28, 0, 28);
  const breakoutBonus = absoluteMove >= oilAlertConfig.minPriceMovePercent ? 12 : absoluteMove >= oilAlertConfig.minPriceMovePercent * 0.7 ? 6 : absoluteMove >= oilAlertConfig.minPriceMovePercent * 0.45 ? 2 : 0;

  return {
    direction,
    score: round(direction ? clamp(baseScore + breakoutBonus, 0, 40) : 0, 2),
    alignedCount: direction ? 1 : 0,
    actionableMove: absoluteMove >= oilAlertConfig.minPriceMovePercent * 0.55,
  };
}

function evaluateDirectionalLayer(values: number[]): OilAlertLayerEvaluation {
  const bullish = values.reduce((sum, value) => sum + Math.max(0, value), 0);
  const bearish = values.reduce((sum, value) => sum + Math.max(0, -value), 0);
  const direction = bullish === bearish ? null : bullish > bearish ? "bullish" : "bearish";
  const dominant = Math.max(bullish, bearish);

  return {
    direction,
    score: round(dominant, 2),
    alignedCount: direction ? values.filter((value) => getDirectionFromSignedValue(value) === direction).length : 0,
  };
}

function getObservedMarkets(signals: OilAlertMarketSignal[]): FirestoreOilAlertObservedMarketDocument[] {
  return signals.map((signal) => ({
    marketId: signal.marketId,
    label: signal.label,
    question: signal.question,
    weight: signal.weight,
    ...(signal.tier ? { tier: signal.tier } : {}),
    yesProbability: signal.yesProbability,
  }));
}

function buildSignalHash(direction: OilAlertDirection, priceMovePercent: number, signals: OilAlertMarketSignal[], confidence: number) {
  const drivers = signals
    .slice(0, 2)
    .map((signal) => `${signal.marketId}:${round(signal.confirmationScore ?? signal.oilDirectionalMovePp ?? 0, 1)}`)
    .join(",");

  return `${direction}:${round(priceMovePercent, 2)}:${Math.round(confidence)}:${drivers}`;
}

function buildEmailBody(
  direction: OilAlertDirection,
  confidence: number,
  currentPrice: number,
  priceMovePercent: number,
  signals: OilAlertMarketSignal[],
  headlines: OilAlertHeadlineSignal[],
) {
  const directionLabel = direction === "bullish" ? "Bullish" : "Bearish";
  const marketLines = signals
    .slice(0, 3)
    .map((signal) => {
      const delta = signal.deltaPp ?? 0;
      const prefix = delta > 0 ? "+" : "";
      return `- ${signal.label}: YES ${round(signal.yesProbability * 100, 1)}% (${prefix}${round(delta, 1)} pp)`;
    })
    .join("\n");
  const headlineLines = headlines
    .slice(0, 3)
    .map((headline) => `- ${headline.title} [${headline.domain}]`)
    .join("\n");

  const text = [
    `MSM1 Oil Alert (${directionLabel})`,
    `Confidence: ${confidence}/100`,
    `Brent (XBRUSD): ${currentPrice} (${priceMovePercent > 0 ? "+" : ""}${round(priceMovePercent, 2)}%)`,
    "",
    "Top confirmation markets:",
    marketLines || "- No aligned confirmation markets",
    "",
    "Top headlines:",
    headlineLines || "- No aligned headlines",
    "",
    direction === "bullish" ? "Action: Review long-oil / higher-risk-premium scenarios." : "Action: Review bearish-oil / lower-risk-premium scenarios.",
  ].join("\n");

  const html = [
    `<h2>MSM1 Oil Alert (${directionLabel})</h2>`,
    `<p><strong>Confidence:</strong> ${confidence}/100</p>`,
    `<p><strong>Brent (XBRUSD):</strong> ${currentPrice} (${priceMovePercent > 0 ? "+" : ""}${round(priceMovePercent, 2)}%)</p>`,
    `<p><strong>Top confirmation markets:</strong></p>`,
    `<ul>${signals
      .slice(0, 3)
      .map((signal) => `<li>${signal.label}: YES ${round(signal.yesProbability * 100, 1)}% (${(signal.deltaPp ?? 0) > 0 ? "+" : ""}${round(signal.deltaPp ?? 0, 1)} pp)</li>`)
      .join("")}</ul>`,
    `<p><strong>Top headlines:</strong></p>`,
    `<ul>${headlines
      .slice(0, 3)
      .map((headline) => `<li>${headline.title} [${headline.domain}]</li>`)
      .join("")}</ul>`,
    `<p>${direction === "bullish" ? "Review long-oil / higher-risk-premium scenarios." : "Review bearish-oil / lower-risk-premium scenarios."}</p>`,
  ].join("");

  return { text, html };
}

function buildResult(
  input: Omit<OilAlertRunResult, "completedAt" | "durationMs"> & { completedAt?: string },
): OilAlertRunResult {
  const completedAt = input.completedAt ?? new Date().toISOString();
  return {
    ...input,
    completedAt,
    durationMs: getDurationMs(input.startedAt, completedAt),
  };
}

function toRunState(
  result: OilAlertRunResult,
  startedAt: string,
  priceSnapshot: ReturnType<typeof priceProvider.getSnapshot> extends Promise<infer T> ? T : never,
  previousState: FirestoreOilAlertStateDocument | null,
  observedMarkets: FirestoreOilAlertObservedMarketDocument[],
): FirestoreOilAlertStateDocument {
  return {
    alertId: oilAlertConfig.alertId,
    lastObservedAt: startedAt,
    lastLivePrice: priceSnapshot.currentPrice,
    lastPriceUpdatedAt: priceSnapshot.updatedAt,
    lastPriceSource: priceSnapshot.source,
    lastPolymarketMarkets: observedMarkets.length ? observedMarkets : (previousState?.lastPolymarketMarkets ?? []),
    lastDecision: result.decision,
    lastConfidence: result.confidence,
    lastRunResult: result,
    ...(result.direction ? { lastDirection: result.direction } : {}),
    ...(previousState?.lastSentAt ? { lastSentAt: previousState.lastSentAt } : {}),
    ...(previousState?.lastSignalHash ? { lastSignalHash: previousState.lastSignalHash } : {}),
    ...(result.cooldownUntil ?? previousState?.cooldownUntil ? { cooldownUntil: result.cooldownUntil ?? previousState?.cooldownUntil } : {}),
    updatedAt: startedAt,
  };
}

function ensurePersistenceAvailable() {
  if (!adminDb) {
    throw new Error("Firebase Admin / Firestore is not configured. Oil alerts require alert state/history persistence.");
  }
}

function scoreHeadline(input: { title: string; domain: string; publishedAt: string }, referenceTime: string) {
  const lower = input.title.toLowerCase();
  const contextHits = oilAlertConfig.headlines.contextKeywords.filter((keyword) => lower.includes(keyword));
  const oilHits = oilAlertConfig.headlines.oilKeywords.filter((keyword) => lower.includes(keyword));
  const categoryHits: Array<{ category: OilAlertNewsCategory; direction: OilAlertDirection; hits: string[]; multiplier: number }> = [
    {
      category: "supply-shock",
      direction: "bullish",
      hits: oilAlertConfig.headlines.supplyShockKeywords.filter((keyword) => lower.includes(keyword)),
      multiplier: 3,
    },
    {
      category: "supply-relief",
      direction: "bearish",
      hits: oilAlertConfig.headlines.supplyReliefKeywords.filter((keyword) => lower.includes(keyword)),
      multiplier: 3,
    },
    {
      category: "demand-up",
      direction: "bullish",
      hits: oilAlertConfig.headlines.demandUpKeywords.filter((keyword) => lower.includes(keyword)),
      multiplier: 2.2,
    },
    {
      category: "demand-down",
      direction: "bearish",
      hits: oilAlertConfig.headlines.demandDownKeywords.filter((keyword) => lower.includes(keyword)),
      multiplier: 2.2,
    },
  ];

  const bullishBoost = oilAlertConfig.headlines.bullishKeywords.filter((keyword) => lower.includes(keyword)).length * 1.2;
  const bearishBoost = oilAlertConfig.headlines.bearishKeywords.filter((keyword) => lower.includes(keyword)).length * 1.2;
  const bullishRaw = categoryHits.filter((entry) => entry.direction === "bullish").reduce((sum, entry) => sum + entry.hits.length * entry.multiplier, bullishBoost);
  const bearishRaw = categoryHits.filter((entry) => entry.direction === "bearish").reduce((sum, entry) => sum + entry.hits.length * entry.multiplier, bearishBoost);
  const direction = bullishRaw === bearishRaw ? null : bullishRaw > bearishRaw ? "bullish" : "bearish";
  const dominantCategory = categoryHits
    .filter((entry) => entry.hits.length > 0 && (!direction || entry.direction === direction))
    .sort((left, right) => right.hits.length * right.multiplier - left.hits.length * left.multiplier)[0]?.category;
  const matchedKeywords = [
    ...contextHits,
    ...oilHits,
    ...categoryHits.flatMap((entry) => entry.hits),
  ];
  const ageHours = getAgeHours(input.publishedAt, referenceTime);
  const contextBoost = contextHits.length > 0 && oilHits.length > 0 ? 1.5 : contextHits.length || oilHits.length ? 0.75 : 0;
  const score = direction
    ? clamp(round((Math.max(bullishRaw, bearishRaw) + contextBoost) * getSourceWeight(input.domain) * getRecencyWeight(ageHours), 2), 1, 10)
    : 0;

  return {
    direction,
    category: dominantCategory,
    score,
    ageHours,
    matchedKeywords: [...new Set(matchedKeywords)].slice(0, 8),
  } as const;
}

export async function runOilAlertCheck(trigger: OilAlertRunTrigger, options: OilAlertRunOptions = {}): Promise<OilAlertRunResult> {
  ensurePersistenceAvailable();

  const startedAt = new Date().toISOString();
  const dryRun = Boolean(options.dryRun);

  if (!oilAlertConfig.enabled) {
    return buildResult({
      trigger,
      alertId: oilAlertConfig.alertId,
      dryRun,
      startedAt,
      status: "ok",
      decision: "disabled",
      reason: "OIL_ALERT_ENABLED is false",
      confidence: 0,
      direction: null,
      emailSent: false,
      marketsChecked: oilAlertConfig.markets.length,
      liveInputs: false,
      newsScore: 0,
      price: {
        current: 0,
        movePercent: 0,
        updatedAt: startedAt,
        source: "disabled",
        freshnessMode: "fallback",
      },
      topSignals: [],
      topHeadlines: [],
    });
  }

  await writeSystemLog({
    level: "info",
    scope: "oil-alert",
    message: "Started oil alert runner",
    details: {
      trigger,
      alertId: oilAlertConfig.alertId,
      marketCount: oilAlertConfig.markets.length,
      dryRun,
    },
  }).catch(() => undefined);

  const instrument = getBrentInstrument();
  const [priceSnapshot, previousState, marketSnapshots, rawHeadlines] = await Promise.all([
    priceProvider.getSnapshot(instrument),
    getOilAlertState(oilAlertConfig.alertId),
    polymarketProvider.getMarkets(oilAlertConfig.markets.map((market) => market.marketId)),
    oilAlertConfig.headlinesEnabled
      ? gdeltNewsProvider.getHeadlines({
          oilKeywords: oilAlertConfig.headlines.oilKeywords,
          contextKeywords: oilAlertConfig.headlines.contextKeywords,
          maxRecords: oilAlertConfig.headlines.maxRecords,
        }).catch(async (error) => {
          await writeSystemLog({
            level: "warning",
            scope: "news-provider",
            message: "Headline provider failed during oil alert run",
            details: {
              reason: error instanceof Error ? error.message : "unknown-error",
            },
          }).catch(() => undefined);

          return [];
        })
      : Promise.resolve([]),
  ]);

  const priceAgeHours = getAgeHours(priceSnapshot.updatedAt, startedAt);
  const priceFreshEnough = priceSnapshot.freshness.mode === "live" && isFreshEnough(priceSnapshot.updatedAt, oilAlertConfig.maxPriceAgeHours, startedAt);
  const freshMarketSnapshots = marketSnapshots.filter((snapshot) => isActiveFreshMarket(snapshot, startedAt));
  const staleOrInactiveMarkets = marketSnapshots.filter((snapshot) => !isActiveFreshMarket(snapshot, startedAt));
  const freshHeadlines = rawHeadlines.filter((headline) => isFreshEnough(headline.publishedAt, oilAlertConfig.maxHeadlineAgeHours, startedAt));
  const observedMarketBaseline = previousState?.lastPolymarketMarkets ?? [];

  const priceMovePercent = previousState ? getPercentChange(priceSnapshot.currentPrice, previousState.lastLivePrice) : 0;
  const marketRegime = evaluateMarketRegime(priceMovePercent);

  const marketSignals = oilAlertConfig.markets
    .flatMap((marketConfig) => {
      const snapshot = freshMarketSnapshots.find((entry) => entry.marketId === marketConfig.marketId);
      if (!snapshot) return [];

      const previousMarket = previousState?.lastPolymarketMarkets.find((entry) => entry.marketId === marketConfig.marketId);
      const deltaPp = previousMarket ? (snapshot.yesProbability - previousMarket.yesProbability) * 100 : undefined;
      const signedOilMove = deltaPp === undefined ? undefined : marketConfig.yesOutcomeOilBias === "bullish" ? deltaPp : -deltaPp;
      const confirmationScore = signedOilMove === undefined ? undefined : signedOilMove * marketConfig.weight * getTierMultiplier(marketConfig.tier);

      const signal: OilAlertMarketSignal = {
        marketId: snapshot.marketId,
        label: marketConfig.label,
        question: snapshot.question,
        weight: marketConfig.weight,
        tier: marketConfig.tier,
        yesProbability: snapshot.yesProbability,
        impliedDirection: confirmationScore === undefined ? null : getDirectionFromSignedValue(confirmationScore),
        ...(previousMarket ? { previousYesProbability: previousMarket.yesProbability } : {}),
        ...(deltaPp === undefined ? {} : { deltaPp: round(deltaPp, 2) }),
        ...(signedOilMove === undefined ? {} : { oilDirectionalMovePp: round(signedOilMove * marketConfig.weight, 2) }),
        ...(confirmationScore === undefined ? {} : { confirmationScore: round(confirmationScore, 2) }),
      };

      return [signal];
    })
    .sort((left, right) => Math.abs(right.confirmationScore ?? 0) - Math.abs(left.confirmationScore ?? 0));

  const confirmationLayerRaw = evaluateDirectionalLayer(marketSignals.map((signal) => signal.confirmationScore ?? 0));
  const confirmationScore = round(clamp((confirmationLayerRaw.score / Math.max(0.5, oilAlertConfig.minPolymarketMovePp)) * 18, 0, 20), 2);
  const dedupedHeadlines = freshHeadlines.filter((headline, index, collection) => {
    const key = normalizeHeadlineKey(headline.title);
    return collection.findIndex((entry) => normalizeHeadlineKey(entry.title) === key) === index;
  });
  const scoredHeadlines: OilAlertHeadlineSignal[] = dedupedHeadlines
    .map((headline) => {
      const scored = scoreHeadline({ title: headline.title, domain: headline.domain, publishedAt: headline.publishedAt }, startedAt);
      return {
        title: headline.title,
        url: headline.url,
        domain: headline.domain,
        publishedAt: headline.publishedAt,
        direction: scored.direction,
        score: scored.score,
        ...(scored.category ? { category: scored.category } : {}),
        ...(typeof scored.ageHours === "number" ? { ageHours: scored.ageHours } : {}),
        matchedKeywords: scored.matchedKeywords,
      };
    })
    .filter((headline) => headline.score > 0)
    .sort((left, right) => right.score - left.score)
    .filter((headline, index, collection) => {
      const category = headline.category ?? "uncategorized";
      return collection.filter((entry) => (entry.category ?? "uncategorized") === category).indexOf(headline) < 2 && index < 6;
    });
  const newsLayerRaw = evaluateDirectionalLayer(
    scoredHeadlines.map((headline) => (headline.direction === "bullish" ? headline.score : headline.direction === "bearish" ? -headline.score : 0)),
  );
  const newsScore = round(clamp(newsLayerRaw.score * 1.35, 0, 25), 2);
  const directionalScore = round(
    (marketRegime.direction === "bullish" ? marketRegime.score : marketRegime.direction === "bearish" ? -marketRegime.score : 0)
      + (newsLayerRaw.direction === "bullish" ? newsScore : newsLayerRaw.direction === "bearish" ? -newsScore : 0)
      + (confirmationLayerRaw.direction === "bullish" ? confirmationScore : confirmationLayerRaw.direction === "bearish" ? -confirmationScore : 0),
    2,
  );
  const blendedDirection = getDirectionFromSignedValue(directionalScore);
  const alignedLayers = blendedDirection
    ? [marketRegime.direction, newsLayerRaw.direction, confirmationLayerRaw.direction].filter((direction) => direction === blendedDirection).length
    : 0;
  const conflictingLayers = blendedDirection
    ? [marketRegime.direction, newsLayerRaw.direction, confirmationLayerRaw.direction].filter((direction) => direction && direction !== blendedDirection).length
    : 0;
  const topSignals = blendedDirection ? marketSignals.filter((signal) => signal.impliedDirection === blendedDirection).slice(0, 3) : marketSignals.slice(0, 3);
  const topHeadlines = blendedDirection ? scoredHeadlines.filter((headline) => headline.direction === blendedDirection).slice(0, 3) : scoredHeadlines.slice(0, 3);
  const confidence = Math.round(
    clamp(
      marketRegime.score
        + newsScore
        + confirmationScore
        + (alignedLayers >= 2 ? 12 : 0)
        + (alignedLayers === 3 ? 8 : 0)
        - conflictingLayers * 10,
      0,
      100,
    ),
  );

  const baseResult = {
    trigger,
    alertId: oilAlertConfig.alertId,
    dryRun,
    startedAt,
    confidence,
    direction: blendedDirection ?? marketRegime.direction,
    emailSent: false,
    marketsChecked: marketSignals.length,
    liveInputs: priceFreshEnough && (freshMarketSnapshots.length > 0 || scoredHeadlines.length > 0),
    newsScore,
    marketRegimeScore: marketRegime.score,
    confirmationScore,
    directionalScore,
    alignedLayers,
    price: {
      current: priceSnapshot.currentPrice,
      ...(previousState ? { previous: previousState.lastLivePrice } : {}),
      movePercent: round(priceMovePercent, 4),
      updatedAt: priceSnapshot.updatedAt,
      source: priceSnapshot.source,
      freshnessMode: priceSnapshot.freshness.mode,
    } as OilAlertRunResult["price"],
    topSignals,
    topHeadlines,
  };

  if (priceSnapshot.freshness.mode !== "live") {
    const result = buildResult({
      ...baseResult,
      status: "warning",
      decision: "skipped-non-live-price",
      reason: "Brent snapshot is fallback/stale, so alerts are suppressed",
    });

    if (!dryRun) {
      await writeOilAlertState(oilAlertConfig.alertId, toRunState(result, startedAt, priceSnapshot, previousState, observedMarketBaseline));
      await appendOilAlertHistory(result).catch(() => undefined);
    }
    return result;
  }

  if (!priceFreshEnough) {
    const result = buildResult({
      ...baseResult,
      status: "warning",
      decision: "skipped-stale-price",
      reason: `Brent snapshot is ${priceAgeHours}h old, above the ${oilAlertConfig.maxPriceAgeHours}h freshness limit`,
    });

    if (!dryRun) {
      await writeOilAlertState(oilAlertConfig.alertId, toRunState(result, startedAt, priceSnapshot, previousState, observedMarketBaseline));
      await appendOilAlertHistory(result).catch(() => undefined);
    }
    return result;
  }

  const observedMarkets = getObservedMarkets(marketSignals);

  if (!previousState) {
    const result = buildResult({
      ...baseResult,
      status: "ok",
      decision: "seeded",
      reason: "Stored initial live baseline for Brent and confirmation inputs",
      direction: null,
      confidence: 0,
    });

    const seededState: FirestoreOilAlertStateDocument = {
      alertId: oilAlertConfig.alertId,
      lastObservedAt: startedAt,
      lastLivePrice: priceSnapshot.currentPrice,
      lastPriceUpdatedAt: priceSnapshot.updatedAt,
      lastPriceSource: priceSnapshot.source,
      lastPolymarketMarkets: observedMarkets,
      lastDecision: "seeded",
      lastConfidence: 0,
      lastRunResult: result,
      updatedAt: startedAt,
    };

    if (!dryRun) {
      await writeOilAlertState(oilAlertConfig.alertId, seededState);
      await appendOilAlertHistory(result).catch(() => undefined);
    }
    return result;
  }

  let decision: OilAlertRunResult["decision"] = "insufficient-confidence";
  let status: OilAlertRunResult["status"] = "ok";
  let reason = "Signal did not meet trigger threshold";
  let emailSubject: string | undefined;
  let cooldownUntil: string | undefined = previousState.cooldownUntil;
  let emailSent = false;

  if (!marketRegime.direction) {
    decision = "insufficient-move";
    reason = `Brent moved ${round(priceMovePercent, 2)}%, which is too small to establish market regime`;
  } else if (!blendedDirection) {
    decision = "insufficient-confidence";
    reason = "Market regime, news and confirmation do not point clearly in one oil direction";
  } else if (!marketRegime.actionableMove && alignedLayers < 2) {
    decision = "insufficient-move";
    reason = `Brent moved ${round(priceMovePercent, 2)}%, below the actionable threshold without enough confirming catalysts`;
  } else if (alignedLayers < 2) {
    decision = "insufficient-confidence";
    const staleList = staleOrInactiveMarkets.map((market) => market.marketId).join(", ") || "none";
    reason = freshMarketSnapshots.length || scoredHeadlines.length
      ? `Need at least two aligned layers; got market=${marketRegime.direction ?? "none"}, news=${newsLayerRaw.direction ?? "none"}, confirm=${confirmationLayerRaw.direction ?? "none"}`
      : `Only Brent regime is available. Confirmation inputs are too weak or stale (markets filtered: ${staleList})`;
  } else if (confidence < oilAlertConfig.minConfidence) {
    decision = "insufficient-confidence";
    reason = `Confidence ${confidence} is below threshold ${oilAlertConfig.minConfidence}`;
  } else {
    const signalHash = buildSignalHash(blendedDirection, priceMovePercent, topSignals, confidence);
    const now = Date.now();
    const cooldownActive = previousState.cooldownUntil ? new Date(previousState.cooldownUntil).getTime() > now : false;

    if (cooldownActive) {
      decision = "cooldown";
      status = "warning";
      reason = `Cooldown active until ${previousState.cooldownUntil}`;
    } else if (previousState.lastSignalHash === signalHash) {
      decision = "duplicate";
      status = "warning";
      reason = "Same oil alert scenario was already sent recently";
    } else {
      decision = "triggered";
      emailSubject = `MSM1 Oil Alert: ${blendedDirection === "bullish" ? "Bullish" : "Bearish"} Brent signal (${confidence}/100)`;
      const emailBody = buildEmailBody(blendedDirection, confidence, priceSnapshot.currentPrice, priceMovePercent, topSignals, topHeadlines);
      if (!dryRun) {
        if (isOilAlertEmailConfigured()) {
          try {
            await sendOilAlertEmail({
              subject: emailSubject,
              html: emailBody.html,
              text: emailBody.text,
              categories: ["msm1", "oil-alert"],
            });

            emailSent = true;
          } catch (error) {
            await writeSystemLog({
              level: "warning",
              scope: "oil-alert",
              message: "Oil alert triggered but email delivery failed",
              details: {
                reason: error instanceof Error ? error.message : "unknown-error",
              },
            }).catch(() => undefined);
          }
        } else {
          await writeSystemLog({
            level: "info",
            scope: "oil-alert",
            message: "Oil alert triggered with email delivery disabled",
            details: {
              reason: "SendGrid env vars are not configured",
            },
          }).catch(() => undefined);
        }
      }
      cooldownUntil = new Date(now + oilAlertConfig.cooldownHours * 60 * 60 * 1000).toISOString();
      reason = `${dryRun ? "Dry-run would trigger" : "Triggered"} ${blendedDirection} oil alert with confidence ${confidence}${!dryRun && !emailSent ? " (email delivery disabled)" : ""}`;

      if (!dryRun) {
        previousState.lastSentAt = startedAt;
        previousState.lastSignalHash = signalHash;
        previousState.cooldownUntil = cooldownUntil;
        previousState.lastDirection = blendedDirection;
      }
    }
  }

  const result = buildResult({
    ...baseResult,
    status,
    decision,
    reason,
    emailSent,
    ...(cooldownUntil ? { cooldownUntil } : {}),
    ...(emailSubject ? { emailSubject } : {}),
  });

  const nextState = toRunState(result, startedAt, priceSnapshot, previousState, observedMarkets);

  if (!dryRun) {
    await writeOilAlertState(oilAlertConfig.alertId, nextState);
    await appendOilAlertHistory(result).catch(() => undefined);
  }

  await writeSystemLog({
    level: decision === "triggered" ? "warning" : "info",
    scope: "oil-alert",
    message: decision === "triggered" ? "Oil alert triggered" : "Oil alert runner completed without sending",
    details: {
      trigger,
      decision,
      confidence,
      direction: result.direction,
      priceMovePercent: round(priceMovePercent, 2),
      marketRegimeScore: marketRegime.score,
      confirmationScore,
      newsScore: round(newsScore, 2),
      directionalScore,
      alignedLayers,
      dryRun,
      topMarkets: topSignals.map((signal) => signal.marketId).join(","),
    },
  }).catch(() => undefined);

  return result;
}