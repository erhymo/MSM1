import "server-only";

import { aiSummaryService } from "@/lib/ai/summary";
import { templateSummaryProvider } from "@/lib/ai/template-summary-provider";
import { enrichAnalysesWithNokDisplay } from "@/lib/analysis/nok-display";
import { computeAnalysis } from "@/lib/analysis/scoring";
import { instruments } from "@/lib/config/instruments";
import { adminDb } from "@/lib/firebase/admin";
import { getDashboardSnapshotFromFirestore } from "@/lib/firebase/firestore-analysis-service";
import { writeSystemLog } from "@/lib/firebase/firestore-system-log-service";
import { cotProviderConfig } from "@/lib/providers/cot/config";
import { cotProvider } from "@/lib/providers/cot/provider";
import { mockVolatilityProvider } from "@/lib/providers/mock/volatility-provider";
import { priceProviderConfig } from "@/lib/providers/price/config";
import { priceProvider } from "@/lib/providers/price/provider";
import { sentimentProviderConfig } from "@/lib/providers/sentiment/config";
import { sentimentProvider } from "@/lib/providers/sentiment/provider";
import type { AnalysisResult, COTSnapshot, DashboardSnapshot, Instrument, PriceSnapshot, SentimentSnapshot, SystemStatusItem, VolatilitySnapshot } from "@/lib/types/analysis";
import type { FirestoreRawMarketDataDocument } from "@/lib/types/firestore";
import { compareAnalysisResults, formatRelativeTime } from "@/lib/utils/format";

export type ComputedDashboardState = {
  snapshot: DashboardSnapshot;
  rawMarketData: FirestoreRawMarketDataDocument[];
};

type ProviderBundle = {
  instrument: Instrument;
  price: PriceSnapshot;
  cot: COTSnapshot;
  sentiment: SentimentSnapshot;
  volatility: VolatilitySnapshot;
};

function toTrendValues(trend: PriceSnapshot["weeklyTrend"]) {
  return {
    timeframe: trend.timeframe,
    bias: trend.bias,
    ema20: trend.ema20,
    ema50: trend.ema50,
    macdHistogram: trend.macdHistogram,
  };
}

function toPriceHistoryValues(priceHistory: PriceSnapshot["priceHistory"]) {
  return priceHistory.map((point) => ({
    label: point.label,
    value: point.value,
  }));
}

async function getProviderBundle(instrument: Instrument): Promise<ProviderBundle> {
  const [price, cot, sentiment, volatility] = await Promise.all([
    priceProvider.getSnapshot(instrument),
    cotProvider.getSnapshot(instrument),
    sentimentProvider.getSnapshot(instrument),
    mockVolatilityProvider.getSnapshot(instrument),
  ]);

  return { instrument, price, cot, sentiment, volatility };
}

function buildStatusItems(bundles: ProviderBundle[], fallbackCount: number): SystemStatusItem[] {
  const jobCompletedAt = new Date().toISOString();
  const newestPriceUpdate = bundles.map((bundle) => bundle.price.updatedAt).sort().at(-1) ?? new Date().toISOString();
  const newestCotUpdate = bundles.map((bundle) => bundle.cot.updatedAt).sort().at(-1) ?? new Date().toISOString();
  const newestSentimentUpdate = bundles.map((bundle) => bundle.sentiment.updatedAt).sort().at(-1) ?? new Date().toISOString();
  const priceFallbackCount = bundles.filter((bundle) => bundle.price.freshness.mode === "fallback").length;
  const cotFallbackCount = bundles.filter((bundle) => bundle.cot.freshness.mode === "fallback").length;
  const sentimentFallbackCount = bundles.filter((bundle) => bundle.sentiment.freshness.mode === "fallback").length;
  const providerSources = [...new Set(bundles.flatMap((bundle) => [bundle.price.source, bundle.cot.source, bundle.sentiment.source]))];
  const providerSummary = providerSources.join(", ");
  const handledIssueCount = priceFallbackCount + cotFallbackCount + sentimentFallbackCount;

  return [
    {
      id: "analysis-job",
      label: "Latest analysis job",
      value: formatRelativeTime(jobCompletedAt),
      status: fallbackCount > 0 ? "warning" : "ok",
      detail:
        fallbackCount > 0
          ? `${bundles.length} instruments processed by the provider-backed analysis engine with ${fallbackCount} fallback instrument snapshot${fallbackCount === 1 ? "" : "s"}`
          : `${bundles.length} instruments processed by the provider-backed analysis engine using ${providerSummary}`,
      category: "job",
      source: "provider",
      updatedAt: jobCompletedAt,
    },
    {
      id: "price-update",
      label: "Latest price update",
      value: formatRelativeTime(newestPriceUpdate),
      status: priceFallbackCount > 0 ? "warning" : "ok",
      detail:
        priceFallbackCount > 0
          ? `${priceFallbackCount} instrument${priceFallbackCount === 1 ? " is" : "s are"} using ExchangeRate, Firestore, or mock fallback after ${priceProviderConfig.provider} fetch issues`
          : `${priceProviderConfig.provider} refreshed the current dashboard snapshot server-side`,
      category: "feed",
      source: "provider",
      updatedAt: newestPriceUpdate,
      freshnessMode: priceFallbackCount > 0 ? "fallback" : "live",
    },
    {
      id: "cot-update",
      label: "Latest COT update",
      value: formatRelativeTime(newestCotUpdate),
      status: cotFallbackCount > 0 ? "warning" : "ok",
      detail:
        cotFallbackCount > 0
          ? `Weekly COT bias is using Firestore or mock fallback for ${cotFallbackCount} instrument${cotFallbackCount === 1 ? "" : "s"}`
          : `${cotProviderConfig.provider} refreshed or served the current weekly COT layer`,
      category: "feed",
      source: "provider",
      updatedAt: newestCotUpdate,
      freshnessMode: cotFallbackCount > 0 ? "fallback" : "live",
    },
    {
      id: "sentiment-update",
      label: "Latest sentiment update",
      value: formatRelativeTime(newestSentimentUpdate),
      status: sentimentFallbackCount > 0 ? "warning" : "ok",
      detail:
        sentimentFallbackCount > 0
          ? `Retail sentiment is using Firestore or mock fallback for ${sentimentFallbackCount} instrument${sentimentFallbackCount === 1 ? "" : "s"}`
          : `${sentimentProviderConfig.provider} refreshed the contrarian retail sentiment layer`,
      category: "feed",
      source: "provider",
      updatedAt: newestSentimentUpdate,
      freshnessMode: sentimentFallbackCount > 0 ? "fallback" : "live",
    },
    {
      id: "recent-errors",
      label: "Recent errors",
      value: handledIssueCount > 0 ? `${handledIssueCount} handled` : "None",
      status: handledIssueCount > 0 ? "warning" : "ok",
      detail:
        handledIssueCount > 0
          ? "Provider-side price, COT, or retail sentiment issues were handled through Firestore or mock fallback without blocking the dashboard"
          : "No recent provider-side pipeline errors were encountered while building this snapshot",
      category: "error",
      source: "provider",
    },
    {
      id: "data-mode",
      label: "Data mode",
      value: fallbackCount > 0 ? `${fallbackCount} fallback` : "Live",
      status: fallbackCount > 0 ? "warning" : "ok",
      detail:
        fallbackCount > 0
          ? "Some instruments are using last stored values for retail sentiment, weekly COT, or another provider input"
          : "All instruments are using live provider-backed pricing with current supporting inputs",
      category: "mode",
      source: "provider",
      freshnessMode: fallbackCount > 0 ? "fallback" : "live",
    },
  ];
}

function buildRawMarketDataEntries(bundles: ProviderBundle[]): FirestoreRawMarketDataDocument[] {
  return bundles.flatMap(({ instrument, price, cot, sentiment, volatility }) => {
    const entries: FirestoreRawMarketDataDocument[] = [
      {
        ticker: instrument.ticker,
        category: "price",
        source: price.source,
        timeframe: "multi",
        capturedAt: price.updatedAt,
        freshnessMode: price.freshness.mode,
        values: {
          currentPrice: price.currentPrice,
          atr14: price.atr14,
          atrPercent: price.atrPercent,
          weeklyBias: price.weeklyTrend.bias,
          dailyBias: price.dailyTrend.bias,
          fourHourBias: price.fourHourMomentum.bias,
          weeklyTrend: toTrendValues(price.weeklyTrend),
          dailyTrend: toTrendValues(price.dailyTrend),
          fourHourMomentum: toTrendValues(price.fourHourMomentum),
          priceHistory: toPriceHistoryValues(price.priceHistory),
          freshnessNote: price.freshness.note,
        },
      },
      {
        ticker: instrument.ticker,
        category: "cot",
        source: cot.source,
        capturedAt: cot.updatedAt,
        freshnessMode: cot.freshness.mode,
        values: {
          bias: cot.bias,
          netPosition: cot.netPosition,
          history: cot.history.map((point) => ({
            label: point.label,
            value: point.value,
          })),
          marketStrategy: cot.market.strategy,
          marketLabel: cot.market.label,
          marketNote: cot.market.note ?? null,
          marketComponents: cot.market.components.map((component) => ({
            marketName: component.marketName,
            marketCode: component.marketCode ?? null,
            exchangeName: component.exchangeName ?? null,
            weight: component.weight,
            openInterest: component.openInterest,
            updatedAt: component.updatedAt,
            largeSpeculators: {
              long: component.largeSpeculators.long,
              short: component.largeSpeculators.short,
              net: component.largeSpeculators.net,
              netPercent: component.largeSpeculators.netPercent,
            },
            commercialHedgers: {
              long: component.commercialHedgers.long,
              short: component.commercialHedgers.short,
              net: component.commercialHedgers.net,
              netPercent: component.commercialHedgers.netPercent,
            },
          })),
          freshnessNote: cot.freshness.note,
        },
      },
      {
        ticker: instrument.ticker,
        category: "sentiment",
        source: sentiment.source,
        capturedAt: sentiment.updatedAt,
        freshnessMode: sentiment.freshness.mode,
        values: {
          retailLong: sentiment.retailLong,
          retailShort: sentiment.retailShort,
          history: sentiment.history.map((point) => ({
            label: point.label,
            value: point.value,
          })),
          freshnessNote: sentiment.freshness.note,
        },
      },
      {
        ticker: instrument.ticker,
        category: "volatility",
        source: "mock-provider",
        capturedAt: volatility.updatedAt,
        freshnessMode: volatility.freshness.mode,
        values: {
          atrPercent: volatility.atrPercent,
          realizedVolatility: volatility.realizedVolatility,
          regimeHint: volatility.regimeHint,
        },
      },
    ];

    return entries;
  });
}

async function fetchBundlesInBatches(batchSize = 10): Promise<ProviderBundle[]> {
  const results: ProviderBundle[] = [];

  for (let i = 0; i < instruments.length; i += batchSize) {
    const batch = instruments.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(getProviderBundle));
    results.push(...batchResults);
  }

  return results;
}

export async function buildComputedDashboardState(): Promise<ComputedDashboardState> {
  const bundles = await fetchBundlesInBatches(10);

  const analyses = await Promise.all(
    bundles.map(async ({ instrument, price, cot, sentiment, volatility }) => {
      const computed = computeAnalysis(price, cot, sentiment, volatility);
      const analysisBase: AnalysisResult = {
        instrument,
        ...computed,
        aiSummary: "",
        explanation: "",
      };
      const narrative = await aiSummaryService.summarize({
        analysis: analysisBase,
        factors: {
          cotNetPosition: cot.netPosition,
          weeklyTrendBias: price.weeklyTrend.bias,
          dailyTrendBias: price.dailyTrend.bias,
          momentumBias: price.fourHourMomentum.bias,
          retailShort: sentiment.retailShort,
        },
      });

      return {
        ...analysisBase,
        aiSummary: narrative.summary,
        explanation: narrative.explanation,
      };
    }),
  );

  const analysesWithNokDisplay = await enrichAnalysesWithNokDisplay(analyses);
  const sortedAnalyses = analysesWithNokDisplay.sort(compareAnalysisResults);
  const fallbackCount = sortedAnalyses.filter((analysis) => analysis.freshness.mode === "fallback").length;

  return {
    snapshot: {
      analyses: sortedAnalyses,
      statusItems: buildStatusItems(bundles, fallbackCount),
    },
    rawMarketData: buildRawMarketDataEntries(bundles),
  };
}

/** Maximum time (ms) to wait for a Firestore read before serving a quick fallback. */
const dashboardReadTimeoutMs = 4_500;
const dashboardReadTimedOut = Symbol("dashboard-read-timeout");

/**
 * Number of instruments to compute on-demand when Firestore is empty.
 * 7 majors can be fetched + scored well within the Vercel 10 s limit.
 */
const onDemandInstrumentLimit = 7;

function prependDashboardStatus(snapshot: DashboardSnapshot, statusItem: SystemStatusItem): DashboardSnapshot {
  return {
    ...snapshot,
    statusItems: [statusItem, ...snapshot.statusItems.filter((item) => item.id !== statusItem.id)],
  };
}

export async function getDashboardSnapshot(): Promise<DashboardSnapshot> {
  if (!adminDb) {
    // No Firestore configured – full compute (dev / local only).
    return (await buildComputedDashboardState()).snapshot;
  }

  try {
    // 1. Try Firestore (fast path) with a timeout safety net. The Firestore
    //    snapshot is the source of truth on dashboard reads, even when stale.
    const snapshot = await Promise.race([
      getDashboardSnapshotFromFirestore(),
      new Promise<typeof dashboardReadTimedOut>((resolve) => setTimeout(() => resolve(dashboardReadTimedOut), dashboardReadTimeoutMs)),
    ]);

    if (snapshot && snapshot !== dashboardReadTimedOut) return snapshot;

    if (snapshot === null) {
      // 2. Firestore is truly empty – compute a small first-load snapshot so the
      //    dashboard still shows something before the initial runner finishes.
      const quickSnapshot = await buildQuickSnapshot();

      await writeSystemLog({
        level: "warning",
        scope: "dashboard-read",
        message: "Firestore empty – served on-demand bootstrap snapshot",
        details: {
          instruments: quickSnapshot.analyses.length,
          timeoutMs: dashboardReadTimeoutMs,
        },
      }).catch(() => undefined);

      return quickSnapshot;
    }

    await writeSystemLog({
      level: "warning",
      scope: "dashboard-read",
      message: "Firestore read timed out before stored snapshot could be served",
      details: {
        timeoutMs: dashboardReadTimeoutMs,
      },
    }).catch(() => undefined);

    return prependDashboardStatus(await buildQuickSnapshot(), {
      id: "dashboard-read-timeout",
      label: "Stored snapshot delayed",
      value: "Showing fallback snapshot",
      status: "warning",
      detail: `The latest stored dashboard snapshot took too long to load. Showing ${onDemandInstrumentLimit} major instruments while the Firestore-backed view catches up.`,
      category: "job",
      source: "system",
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    await writeSystemLog({
      level: "error",
      scope: "dashboard-read",
      message: "Stored dashboard snapshot read failed",
      details: {
        timeoutMs: dashboardReadTimeoutMs,
        error: error instanceof Error ? error.message : "Unknown dashboard read error",
      },
    }).catch(() => undefined);

    return prependDashboardStatus(await buildQuickSnapshot(), {
      id: "system-error",
      label: "Temporary data issue",
      value: "Showing fallback snapshot",
      status: "warning",
      detail: `Could not load the stored dashboard snapshot. Showing ${onDemandInstrumentLimit} major instruments while the Firestore-backed view recovers.`,
      category: "job",
      source: "system",
      updatedAt: new Date().toISOString(),
    });
  }
}

/**
 * Compute a small snapshot (majors only) for first-load and slow-read cases
 * where the full Firestore-backed dashboard cannot be served quickly enough.
 */
async function buildQuickSnapshot(): Promise<DashboardSnapshot> {
  const subset = instruments.slice(0, onDemandInstrumentLimit);
  const bundles = await Promise.all(subset.map(getProviderBundle));

  const analyses = await Promise.all(
    bundles.map(async ({ instrument, price, cot, sentiment, volatility }) => {
      const computed = computeAnalysis(price, cot, sentiment, volatility);
      const analysisBase: AnalysisResult = {
        instrument,
        ...computed,
        aiSummary: "",
        explanation: "",
      };
      const narrative = await templateSummaryProvider.summarize({
        analysis: analysisBase,
        factors: {
          cotNetPosition: cot.netPosition,
          weeklyTrendBias: price.weeklyTrend.bias,
          dailyTrendBias: price.dailyTrend.bias,
          momentumBias: price.fourHourMomentum.bias,
          retailShort: sentiment.retailShort,
        },
      });

      return { ...analysisBase, aiSummary: narrative.summary, explanation: narrative.explanation };
    }),
  );

  const sortedAnalyses = analyses.sort(compareAnalysisResults);
  const fallbackCount = sortedAnalyses.filter((a) => a.freshness.mode === "fallback").length;

  return {
    analyses: sortedAnalyses,
    statusItems: [
      ...buildStatusItems(bundles, fallbackCount),
      {
        id: "partial-load",
        label: "Partial coverage",
        value: `${subset.length} of ${instruments.length}`,
        status: "warning",
        detail: `Showing ${subset.length} major instruments until the first stored Firestore snapshot is written. All ${instruments.length} instruments will appear after the analysis runner completes.`,
        category: "job",
        source: "system",
        updatedAt: new Date().toISOString(),
      },
    ],
  };
}
