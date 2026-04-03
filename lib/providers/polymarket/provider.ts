import { writeSystemLog } from "@/lib/firebase/firestore-system-log-service";

import { polymarketProviderConfig } from "@/lib/providers/polymarket/config";

type GammaMarketResponse = {
  id: string;
  question?: string;
  slug?: string;
  outcomes?: string | string[];
  outcomePrices?: string | string[];
  active?: boolean;
  closed?: boolean;
  updatedAt?: string;
  endDate?: string;
};

export type PolymarketMarketSnapshot = {
  marketId: string;
  question: string;
  slug: string;
  yesProbability: number;
  noProbability: number;
  active: boolean;
  closed: boolean;
  updatedAt: string;
  endDate?: string;
  source: string;
};

function round(value: number, digits = 4) {
  return Number(value.toFixed(digits));
}

function parseStringArray(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value.map((entry) => String(entry));
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.map((entry) => String(entry));
    }
  } catch {
    return value.split(",").map((entry) => entry.trim()).filter(Boolean);
  }

  return [];
}

function getOutcomePrice(outcomes: string[], outcomePrices: string[], target: string) {
  const index = outcomes.findIndex((outcome) => outcome.toLowerCase() === target.toLowerCase());
  if (index === -1) return null;

  const value = Number(outcomePrices[index] ?? "NaN");
  return Number.isFinite(value) ? round(value) : null;
}

async function fetchMarket(marketId: string): Promise<PolymarketMarketSnapshot> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), polymarketProviderConfig.timeoutMs);

  try {
    const response = await fetch(`${polymarketProviderConfig.baseUrl}/markets/${marketId}`, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": polymarketProviderConfig.userAgent,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Polymarket market ${marketId} returned HTTP ${response.status}`);
    }

    const data = (await response.json()) as GammaMarketResponse;
    const outcomes = parseStringArray(data.outcomes);
    const outcomePrices = parseStringArray(data.outcomePrices);
    const yesProbability = getOutcomePrice(outcomes, outcomePrices, "Yes");
    const noProbability = getOutcomePrice(outcomes, outcomePrices, "No");

    if (yesProbability === null || noProbability === null) {
      throw new Error(`Polymarket market ${marketId} did not contain Yes/No prices`);
    }

    return {
      marketId: data.id ?? marketId,
      question: data.question ?? marketId,
      slug: data.slug ?? marketId,
      yesProbability,
      noProbability,
      active: Boolean(data.active),
      closed: Boolean(data.closed),
      updatedAt: data.updatedAt ?? new Date().toISOString(),
      endDate: data.endDate,
      source: "polymarket-gamma",
    };
  } finally {
    clearTimeout(timeout);
  }
}

export const polymarketProvider = {
  async getMarkets(marketIds: string[]) {
    const results = await Promise.allSettled(marketIds.map((marketId) => fetchMarket(marketId)));
    const markets: PolymarketMarketSnapshot[] = [];
    const failed: string[] = [];

    results.forEach((result, index) => {
      if (result.status === "fulfilled") {
        markets.push(result.value);
        return;
      }

      failed.push(`${marketIds[index]}:${result.reason instanceof Error ? result.reason.message : "unknown-error"}`);
    });

    if (!markets.length) {
      throw new Error(`Failed to fetch configured Polymarket markets: ${failed.join("; ")}`);
    }

    if (failed.length) {
      await writeSystemLog({
        level: "warning",
        scope: "polymarket-provider",
        message: "Some configured Polymarket markets could not be fetched",
        details: {
          requested: marketIds.length,
          succeeded: markets.length,
          failed: failed.length,
          failures: failed.join(" | ").slice(0, 900),
        },
      }).catch(() => undefined);
    }

    return markets;
  },
};