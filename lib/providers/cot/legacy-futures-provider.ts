import type { COTDataProvider } from "@/lib/providers/types";
import type { Instrument } from "@/lib/types/analysis";

import { cotProviderConfig } from "@/lib/providers/cot/config";
import { normalizeDerivedCotSnapshot, normalizeSingleMarketCotSnapshot, type RemoteLegacyCotRow } from "@/lib/providers/cot/normalize-cot-snapshot";
import { getCotProviderMapping } from "@/lib/providers/cot/symbol-map";

const selectFields = [
  "report_date_as_yyyy_mm_dd",
  "contract_market_name",
  "cftc_contract_market_code",
  "market_and_exchange_names",
  "open_interest_all",
  "noncomm_positions_long_all",
  "noncomm_positions_short_all",
  "comm_positions_long_all",
  "comm_positions_short_all",
].join(",");

function escapeSocrataString(value: string) {
  return value.replace(/'/g, "''");
}

async function fetchLegacyRows(marketName: string, limit: number): Promise<RemoteLegacyCotRow[]> {
  const url = new URL(cotProviderConfig.baseUrl);
  url.searchParams.set("$select", selectFields);
  url.searchParams.set("$where", `contract_market_name='${escapeSocrataString(marketName)}'`);
  url.searchParams.set("$order", "report_date_as_yyyy_mm_dd desc");
  url.searchParams.set("$limit", String(limit));

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Accept: "application/json",
      ...(cotProviderConfig.appToken ? { "X-App-Token": cotProviderConfig.appToken } : {}),
    },
    cache: "no-store",
    signal: AbortSignal.timeout(cotProviderConfig.timeoutMs),
  });

  if (!response.ok) {
    throw new Error(`CFTC legacy request failed for ${marketName} with status ${response.status}`);
  }

  const payload = (await response.json()) as RemoteLegacyCotRow[];

  if (!Array.isArray(payload) || !payload.length) {
    throw new Error(`No CFTC legacy rows returned for ${marketName}`);
  }

  return payload;
}

export const legacyFuturesCotProvider: COTDataProvider = {
  async getSnapshot(instrument: Instrument) {
    const mapping = getCotProviderMapping(instrument);

    if (mapping.strategy === "derived") {
      const rowGroups = await Promise.all(
        mapping.legs.map(async (leg) => ({
          leg,
          rows: await fetchLegacyRows(leg.marketName, cotProviderConfig.historyPoints + 2),
        })),
      );

      return normalizeDerivedCotSnapshot({
        instrument,
        source: "cftc-legacy-futures",
        mapping,
        rowGroups,
        freshnessMode: "live",
        freshnessNote: `Latest weekly CFTC Legacy Futures positioning for ${mapping.label}`,
      });
    }

    const primaryLeg = mapping.legs[0];

    if (!primaryLeg) {
      throw new Error(`No COT market leg configured for ${instrument.ticker}`);
    }

    const rows = await fetchLegacyRows(primaryLeg.marketName, cotProviderConfig.historyPoints + 2);

    return normalizeSingleMarketCotSnapshot({
      instrument,
      source: "cftc-legacy-futures",
      mapping,
      leg: primaryLeg,
      rows,
      freshnessMode: "live",
      freshnessNote: `Latest weekly CFTC Legacy Futures positioning for ${mapping.label}`,
    });
  },
};