import type { COTMarketComponent, COTParticipantSnapshot, COTSnapshot, Instrument } from "@/lib/types/analysis";

import { cotProviderConfig } from "@/lib/providers/cot/config";
import type { CotMarketLeg, CotSymbolMapping } from "@/lib/providers/cot/symbol-map";

export type RemoteLegacyCotRow = {
  report_date_as_yyyy_mm_dd?: string;
  contract_market_name?: string;
  cftc_contract_market_code?: string;
  market_and_exchange_names?: string;
  open_interest_all?: string;
  noncomm_positions_long_all?: string;
  noncomm_positions_short_all?: string;
  comm_positions_long_all?: string;
  comm_positions_short_all?: string;
};

type BaseNormalizeInput = {
  instrument: Instrument;
  source: string;
  mapping: CotSymbolMapping;
  freshnessMode?: COTSnapshot["freshness"]["mode"];
  freshnessNote?: string;
};

type NormalizeSingleMarketCotSnapshotInput = BaseNormalizeInput & {
  leg: CotMarketLeg;
  rows: RemoteLegacyCotRow[];
};

type NormalizeDerivedCotSnapshotInput = BaseNormalizeInput & {
  rowGroups: Array<{
    leg: CotMarketLeg;
    rows: RemoteLegacyCotRow[];
  }>;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function round(value: number, digits: number = 2) {
  return Number(value.toFixed(digits));
}

function toNumber(value: string | number | undefined) {
  const normalized = typeof value === "number" ? value : Number(value ?? Number.NaN);
  return Number.isFinite(normalized) ? normalized : 0;
}

function toIsoDate(row: RemoteLegacyCotRow) {
  const raw = row.report_date_as_yyyy_mm_dd;
  return raw ? new Date(raw).toISOString() : new Date().toISOString();
}

function toHistoryLabel(isoDate: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    timeZone: "UTC",
  }).format(new Date(isoDate));
}

function buildParticipantSnapshot(longValue: number, shortValue: number): COTParticipantSnapshot {
  const net = longValue - shortValue;
  const denominator = Math.max(1, longValue + shortValue);

  return {
    long: longValue,
    short: shortValue,
    net,
    netPercent: round((net / denominator) * 100),
  };
}

function getRowParticipants(row: RemoteLegacyCotRow) {
  return {
    largeSpeculators: buildParticipantSnapshot(toNumber(row.noncomm_positions_long_all), toNumber(row.noncomm_positions_short_all)),
    commercialHedgers: buildParticipantSnapshot(toNumber(row.comm_positions_long_all), toNumber(row.comm_positions_short_all)),
  };
}

function getWeightedScore(row: RemoteLegacyCotRow, weight: number) {
  const participants = getRowParticipants(row);
  return clamp(Math.round(participants.largeSpeculators.netPercent * weight), -100, 100);
}

function getBias(score: number): COTSnapshot["bias"] {
  if (score >= 20) return "Bullish";
  if (score <= -20) return "Bearish";
  return "Neutral";
}

function toMarketComponent(row: RemoteLegacyCotRow, weight: number): COTMarketComponent {
  const participants = getRowParticipants(row);

  return {
    marketName: row.contract_market_name ?? "Unknown market",
    marketCode: row.cftc_contract_market_code,
    exchangeName: row.market_and_exchange_names,
    weight,
    openInterest: toNumber(row.open_interest_all),
    updatedAt: toIsoDate(row),
    largeSpeculators: participants.largeSpeculators,
    commercialHedgers: participants.commercialHedgers,
  };
}

function withFreshness(updatedAt: string, input: BaseNormalizeInput): COTSnapshot["freshness"] {
  return {
    mode: input.freshnessMode ?? "live",
    updatedAt,
    note: input.freshnessNote ?? `Latest ${input.source} weekly COT snapshot`,
  };
}

export function normalizeSingleMarketCotSnapshot(input: NormalizeSingleMarketCotSnapshotInput): COTSnapshot {
  const rows = [...input.rows].sort((left, right) => toIsoDate(left).localeCompare(toIsoDate(right)));
  const historyRows = rows.slice(-cotProviderConfig.historyPoints);
  const latestRow = historyRows.at(-1);

  if (!latestRow) {
    throw new Error(`No COT history rows available for ${input.instrument.ticker}`);
  }

  const updatedAt = toIsoDate(latestRow);
  const history = historyRows.map((row) => ({
    label: toHistoryLabel(toIsoDate(row)),
    value: getWeightedScore(row, input.leg.weight),
  }));
  const netPosition = history.at(-1)?.value ?? 0;

  return {
    ticker: input.instrument.ticker,
    source: input.source,
    bias: getBias(netPosition),
    netPosition,
    history,
    market: {
      strategy: input.mapping.strategy,
      label: input.mapping.label,
      note: input.mapping.note,
      components: [toMarketComponent(latestRow, input.leg.weight)],
    },
    updatedAt,
    freshness: withFreshness(updatedAt, input),
  };
}

export function normalizeDerivedCotSnapshot(input: NormalizeDerivedCotSnapshotInput): COTSnapshot {
  const preparedGroups = input.rowGroups.map((group) => ({
    leg: group.leg,
    rows: [...group.rows].sort((left, right) => toIsoDate(left).localeCompare(toIsoDate(right))),
  }));
  const minLength = Math.min(...preparedGroups.map((group) => group.rows.length));

  if (!Number.isFinite(minLength) || minLength < 1) {
    throw new Error(`Insufficient derived COT history for ${input.instrument.ticker}`);
  }

  const historyLength = Math.min(minLength, cotProviderConfig.historyPoints);
  const alignedGroups = preparedGroups.map((group) => ({
    leg: group.leg,
    rows: group.rows.slice(-historyLength),
  }));

  const history = Array.from({ length: historyLength }, (_, index) => {
    const rowsAtIndex = alignedGroups.map((group) => group.rows[index]!);
    const labelDate = rowsAtIndex.map(toIsoDate).sort().at(-1) ?? new Date().toISOString();
    const value = clamp(
      Math.round(rowsAtIndex.reduce((sum, row, rowIndex) => sum + getWeightedScore(row, alignedGroups[rowIndex]!.leg.weight), 0)),
      -100,
      100,
    );

    return {
      label: toHistoryLabel(labelDate),
      value,
    };
  });

  const latestComponents = alignedGroups.map((group) => toMarketComponent(group.rows.at(-1)!, group.leg.weight));
  const updatedAt = latestComponents.map((component) => component.updatedAt).sort().at(-1) ?? new Date().toISOString();
  const netPosition = history.at(-1)?.value ?? 0;

  return {
    ticker: input.instrument.ticker,
    source: input.source,
    bias: getBias(netPosition),
    netPosition,
    history,
    market: {
      strategy: input.mapping.strategy,
      label: input.mapping.label,
      note: input.mapping.note,
      components: latestComponents,
    },
    updatedAt,
    freshness: withFreshness(updatedAt, input),
  };
}