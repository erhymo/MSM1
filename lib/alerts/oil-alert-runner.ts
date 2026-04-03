import "server-only";

import type { OilAlertDirection, OilAlertHeadlineSignal, OilAlertMarketSignal, OilAlertRunOptions, OilAlertRunResult, OilAlertRunTrigger } from "@/lib/alerts/oil-alert-types";
import { oilAlertConfig } from "@/lib/config/oil-alerts";
import { adminDb } from "@/lib/firebase/admin";
import { appendOilAlertHistory, getOilAlertState, writeOilAlertState } from "@/lib/firebase/firestore-alert-service";
import { writeSystemLog } from "@/lib/firebase/firestore-system-log-service";
import { instruments } from "@/lib/config/instruments";
import { sendOilAlertEmail } from "@/lib/email/sendgrid";
import { gdeltNewsProvider } from "@/lib/providers/news/gdelt-provider";
import { polymarketProvider } from "@/lib/providers/polymarket/provider";
import { priceProvider } from "@/lib/providers/price/provider";
import type { PolymarketMarketSnapshot } from "@/lib/providers/polymarket/provider";
import type { FirestoreOilAlertObservedMarketDocument, FirestoreOilAlertStateDocument } from "@/lib/types/firestore";

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

function getObservedMarkets(signals: OilAlertMarketSignal[]): FirestoreOilAlertObservedMarketDocument[] {
  return signals.map((signal) => ({
    marketId: signal.marketId,
    label: signal.label,
    question: signal.question,
    weight: signal.weight,
    yesProbability: signal.yesProbability,
  }));
}

function buildSignalHash(direction: OilAlertDirection, priceMovePercent: number, signals: OilAlertMarketSignal[], confidence: number) {
  const drivers = signals
    .slice(0, 2)
    .map((signal) => `${signal.marketId}:${round(signal.oilDirectionalMovePp ?? 0, 1)}`)
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
    "Top Polymarket drivers:",
    marketLines || "- No aligned Polymarket drivers",
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
    `<p><strong>Top Polymarket drivers:</strong></p>`,
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

function ensurePersistenceAvailable() {
  if (!adminDb) {
    throw new Error("Firebase Admin / Firestore is not configured. Oil alerts require alert state/history persistence.");
  }
}

function scoreHeadline(title: string) {
  const lower = title.toLowerCase();
  const matchedKeywords = [
    ...oilAlertConfig.headlines.contextKeywords.filter((keyword) => lower.includes(keyword)),
    ...oilAlertConfig.headlines.oilKeywords.filter((keyword) => lower.includes(keyword)),
  ];
  const bullishHits = oilAlertConfig.headlines.bullishKeywords.filter((keyword) => lower.includes(keyword));
  const bearishHits = oilAlertConfig.headlines.bearishKeywords.filter((keyword) => lower.includes(keyword));
  const direction = bullishHits.length === bearishHits.length ? null : bullishHits.length > bearishHits.length ? "bullish" : "bearish";
  const score = direction ? clamp(4 + matchedKeywords.length + Math.max(bullishHits.length, bearishHits.length) * 2, 1, 10) : 0;

  return {
    direction,
    score,
    matchedKeywords: [...new Set([...matchedKeywords, ...bullishHits, ...bearishHits])].slice(0, 8),
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

  const priceMovePercent = previousState ? getPercentChange(priceSnapshot.currentPrice, previousState.lastLivePrice) : 0;

  const marketSignals = oilAlertConfig.markets
    .flatMap((marketConfig) => {
      const snapshot = freshMarketSnapshots.find((entry) => entry.marketId === marketConfig.marketId);
      if (!snapshot) return [];

      const previousMarket = previousState?.lastPolymarketMarkets.find((entry) => entry.marketId === marketConfig.marketId);
      const deltaPp = previousMarket ? (snapshot.yesProbability - previousMarket.yesProbability) * 100 : undefined;
      const signedOilMove = deltaPp === undefined ? undefined : marketConfig.yesOutcomeOilBias === "bullish" ? deltaPp : -deltaPp;

      const signal: OilAlertMarketSignal = {
        marketId: snapshot.marketId,
        label: marketConfig.label,
        question: snapshot.question,
        weight: marketConfig.weight,
        yesProbability: snapshot.yesProbability,
        impliedDirection: signedOilMove === undefined ? null : getDirectionFromSignedValue(signedOilMove),
        ...(previousMarket ? { previousYesProbability: previousMarket.yesProbability } : {}),
        ...(deltaPp === undefined ? {} : { deltaPp: round(deltaPp, 2) }),
        ...(signedOilMove === undefined ? {} : { oilDirectionalMovePp: round(signedOilMove * marketConfig.weight, 2) }),
      };

      return [signal];
    })
    .sort((left, right) => Math.abs(right.oilDirectionalMovePp ?? 0) - Math.abs(left.oilDirectionalMovePp ?? 0));

  const bullishStrength = round(
    marketSignals.reduce((sum, signal) => sum + Math.max(0, signal.oilDirectionalMovePp ?? 0), 0),
    2,
  );
  const bearishStrength = round(
    marketSignals.reduce((sum, signal) => sum + Math.max(0, -(signal.oilDirectionalMovePp ?? 0)), 0),
    2,
  );
  const marketDirection = bullishStrength === bearishStrength ? null : bullishStrength > bearishStrength ? "bullish" : "bearish";
  const dominantMarketStrength = Math.max(bullishStrength, bearishStrength);
  const priceDirection = getDirectionFromSignedValue(priceMovePercent);
  const scoredHeadlines: OilAlertHeadlineSignal[] = freshHeadlines
    .map((headline) => {
      const scored = scoreHeadline(headline.title);
      return {
        title: headline.title,
        url: headline.url,
        domain: headline.domain,
        publishedAt: headline.publishedAt,
        direction: scored.direction,
        score: scored.score,
        matchedKeywords: scored.matchedKeywords,
      };
    })
    .filter((headline) => headline.score > 0)
    .sort((left, right) => right.score - left.score);
  const alignedSignals = marketSignals.filter((signal) => signal.impliedDirection && signal.impliedDirection === priceDirection);
  const alignedHeadlines = scoredHeadlines.filter((headline) => headline.direction && headline.direction === priceDirection);
  const topSignals = priceDirection ? alignedSignals.slice(0, 3) : marketSignals.slice(0, 3);
  const topHeadlines = priceDirection ? alignedHeadlines.slice(0, 3) : scoredHeadlines.slice(0, 3);
  const priceScore = clamp((Math.abs(priceMovePercent) / oilAlertConfig.minPriceMovePercent) * 30, 0, 40);
  const marketScore = clamp((dominantMarketStrength / oilAlertConfig.minPolymarketMovePp) * 25, 0, 35);
  const alignmentBonus = priceDirection && marketDirection && priceDirection === marketDirection ? 15 : 0;
  const breadthBonus = clamp(Math.max(0, alignedSignals.length - 1) * 5, 0, 10);
  const newsScore = clamp(topHeadlines.reduce((sum, headline) => sum + headline.score, 0), 0, 25);
  const confidence = Math.round(clamp(priceScore + marketScore + alignmentBonus + breadthBonus + newsScore, 0, 100));

  const baseResult = {
    trigger,
    alertId: oilAlertConfig.alertId,
    dryRun,
    startedAt,
    confidence,
    direction: priceDirection,
    emailSent: false,
    marketsChecked: marketSignals.length,
    liveInputs: priceFreshEnough && freshMarketSnapshots.length >= oilAlertConfig.minFreshPolymarketMarkets,
    newsScore,
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
      await appendOilAlertHistory(result).catch(() => undefined);
    }
    return result;
  }

  if (freshMarketSnapshots.length < oilAlertConfig.minFreshPolymarketMarkets) {
    const staleList = staleOrInactiveMarkets.map((market) => market.marketId).join(", ") || "none";
    const result = buildResult({
      ...baseResult,
      status: "warning",
      decision: "skipped-stale-polymarket",
      reason: `Only ${freshMarketSnapshots.length} Polymarket markets passed freshness/active checks; need ${oilAlertConfig.minFreshPolymarketMarkets}. Filtered: ${staleList}`,
    });

    if (!dryRun) {
      await appendOilAlertHistory(result).catch(() => undefined);
    }
    return result;
  }

  const observedMarkets = getObservedMarkets(marketSignals);

  if (!previousState) {
    const seededState: FirestoreOilAlertStateDocument = {
      alertId: oilAlertConfig.alertId,
      lastObservedAt: startedAt,
      lastLivePrice: priceSnapshot.currentPrice,
      lastPriceUpdatedAt: priceSnapshot.updatedAt,
      lastPriceSource: priceSnapshot.source,
      lastPolymarketMarkets: observedMarkets,
      lastDecision: "seeded",
      lastConfidence: 0,
      updatedAt: startedAt,
    };

    if (!dryRun) {
      await writeOilAlertState(oilAlertConfig.alertId, seededState);
    }

    const result = buildResult({
      ...baseResult,
      status: "ok",
      decision: "seeded",
      reason: "Stored initial live baseline for Brent and Polymarket markets",
      direction: null,
      confidence: 0,
    });

    if (!dryRun) {
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

  if (!priceDirection || Math.abs(priceMovePercent) < oilAlertConfig.minPriceMovePercent) {
    decision = "insufficient-move";
    reason = `Brent moved ${round(priceMovePercent, 2)}%, below the ${oilAlertConfig.minPriceMovePercent}% threshold`;
  } else if (!marketDirection || dominantMarketStrength < oilAlertConfig.minPolymarketMovePp) {
    decision = "insufficient-confidence";
    reason = `Polymarket confirmation was too weak (${round(dominantMarketStrength, 2)} weighted pp)`;
  } else if (marketDirection !== priceDirection) {
    decision = "insufficient-confidence";
    reason = "Brent and Polymarket are moving in opposite directions";
  } else if (confidence < oilAlertConfig.minConfidence) {
    decision = "insufficient-confidence";
    reason = `Confidence ${confidence} is below threshold ${oilAlertConfig.minConfidence}`;
  } else {
    const signalHash = buildSignalHash(priceDirection, priceMovePercent, topSignals, confidence);
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
      emailSubject = `MSM1 Oil Alert: ${priceDirection === "bullish" ? "Bullish" : "Bearish"} Brent signal (${confidence}/100)`;
      const emailBody = buildEmailBody(priceDirection, confidence, priceSnapshot.currentPrice, priceMovePercent, topSignals, topHeadlines);
      if (!dryRun) {
        await sendOilAlertEmail({
          subject: emailSubject,
          html: emailBody.html,
          text: emailBody.text,
          categories: ["msm1", "oil-alert"],
        });

        emailSent = true;
      }
      cooldownUntil = new Date(now + oilAlertConfig.cooldownHours * 60 * 60 * 1000).toISOString();
      reason = `${dryRun ? "Dry-run would trigger" : "Triggered"} ${priceDirection} oil alert with confidence ${confidence}`;

      if (!dryRun) {
        previousState.lastSentAt = startedAt;
        previousState.lastSignalHash = signalHash;
        previousState.cooldownUntil = cooldownUntil;
        previousState.lastDirection = priceDirection;
      }
    }
  }

  const nextState: FirestoreOilAlertStateDocument = {
    alertId: oilAlertConfig.alertId,
    lastObservedAt: startedAt,
    lastLivePrice: priceSnapshot.currentPrice,
    lastPriceUpdatedAt: priceSnapshot.updatedAt,
    lastPriceSource: priceSnapshot.source,
    lastPolymarketMarkets: observedMarkets,
    lastDecision: decision,
    lastConfidence: confidence,
    ...(priceDirection ? { lastDirection: priceDirection } : {}),
    ...(previousState.lastSentAt ? { lastSentAt: previousState.lastSentAt } : {}),
    ...(previousState.lastSignalHash ? { lastSignalHash: previousState.lastSignalHash } : {}),
    ...(cooldownUntil ? { cooldownUntil } : {}),
    updatedAt: startedAt,
  };

  if (!dryRun) {
    await writeOilAlertState(oilAlertConfig.alertId, nextState);
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

  if (!dryRun) {
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
      dominantMarketStrength: round(dominantMarketStrength, 2),
      newsScore: round(newsScore, 2),
      dryRun,
      topMarkets: topSignals.map((signal) => signal.marketId).join(","),
    },
  }).catch(() => undefined);

  return result;
}