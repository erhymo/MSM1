import type { AnalysisResult } from "@/lib/types/analysis";
import { getInstrumentCurrencyPair } from "@/lib/utils/instrument-currency";

export type PositionSide = "BUY" | "SELL";

export type ManualPosition = {
  isOpen: boolean;
  side: PositionSide;
  entryPrice?: number;
  units?: number;
  stopLoss?: number;
  takeProfit?: number;
  updatedAt?: string;
};

export type StoredPositions = Record<string, ManualPosition>;

export type PositionRisk = {
  isOpen: boolean;
  isComplete: boolean;
  missingFields: string[];
  pnlQuote?: number;
  pnlNok?: number;
  pnlPercentOfAccount?: number;
  rMultiple?: number;
  stopLossMissing: boolean;
  severity: "ok" | "warning" | "danger";
  title: string;
  detail: string;
};

export const accountEquityNok = 10_000;
export const openPositionsStorageKey = "msm1-open-positions-v1";

function toNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return undefined;
  const normalized = value.replace(",", ".").trim();
  if (!normalized) return undefined;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function readStoredPositions(): StoredPositions {
  if (typeof window === "undefined") return {};

  try {
    const raw = window.localStorage.getItem(openPositionsStorageKey);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};

    const entries: Array<[string, ManualPosition]> = [];

    Object.entries(parsed).forEach(([ticker, value]) => {
      if (value === true) {
        entries.push([ticker, { isOpen: true, side: "BUY" }]);
        return;
      }
      if (!value || typeof value !== "object" || Array.isArray(value)) return;
      const candidate = value as Record<string, unknown>;
      const side = candidate.side === "SELL" ? "SELL" : "BUY";
      entries.push([
        ticker,
        {
          isOpen: candidate.isOpen !== false,
          side,
          entryPrice: toNumber(candidate.entryPrice),
          units: toNumber(candidate.units),
          stopLoss: toNumber(candidate.stopLoss),
          takeProfit: toNumber(candidate.takeProfit),
          updatedAt: typeof candidate.updatedAt === "string" ? candidate.updatedAt : undefined,
        },
      ]);
    });

    return Object.fromEntries(entries);
  } catch {
    return {};
  }
}

export function writeStoredPositions(positions: StoredPositions) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(openPositionsStorageKey, JSON.stringify(positions));
}

export function getPositionRisk(analysis: AnalysisResult, position?: ManualPosition): PositionRisk {
  if (!position?.isOpen) {
    return { isOpen: false, isComplete: false, missingFields: [], stopLossMissing: false, severity: "ok", title: "Ingen registrert posisjon", detail: "Legg inn posisjon for å aktivere risikovarsel." };
  }

  const missingFields = [
    position.entryPrice ? null : "entry",
    position.units ? null : "units",
  ].filter((value): value is string => Boolean(value));
  const stopLossMissing = !position.stopLoss;
  const isComplete = missingFields.length === 0;

  if (!isComplete || !position.entryPrice || !position.units) {
    return {
      isOpen: true,
      isComplete: false,
      missingFields,
      stopLossMissing,
      severity: stopLossMissing ? "warning" : "ok",
      title: stopLossMissing ? "Risikovarsel mangler stop-loss" : "Risikovarsel trenger mer data",
      detail: "Legg inn inngang, enheter og helst stop-loss for at appen skal kunne varsle når posisjonen går for mye feil vei.",
    };
  }

  const direction = position.side === "BUY" ? 1 : -1;
  const pnlQuote = (analysis.entry - position.entryPrice) * position.units * direction;
  const pnlNok = analysis.nokDisplay?.nokPerQuote ? pnlQuote * analysis.nokDisplay.nokPerQuote : undefined;
  const pnlPercentOfAccount = typeof pnlNok === "number" ? (pnlNok / accountEquityNok) * 100 : undefined;
  const riskPerUnit = position.stopLoss ? Math.abs(position.entryPrice - position.stopLoss) : undefined;
  const rMultiple = riskPerUnit && riskPerUnit > 0 ? ((analysis.entry - position.entryPrice) * direction) / riskPerUnit : undefined;
  const drawdownDanger = typeof pnlPercentOfAccount === "number" && pnlPercentOfAccount <= -2;
  const drawdownWarning = typeof pnlPercentOfAccount === "number" && pnlPercentOfAccount <= -1;
  const rDanger = typeof rMultiple === "number" && rMultiple <= -1;
  const rWarning = typeof rMultiple === "number" && rMultiple <= -0.65;
  const severity = drawdownDanger || rDanger || (stopLossMissing && drawdownWarning) ? "danger" : drawdownWarning || rWarning || stopLossMissing ? "warning" : "ok";
  const pair = getInstrumentCurrencyPair(analysis.instrument);
  const pnlLabel = typeof pnlNok === "number" ? `${Math.round(pnlNok).toLocaleString("nb-NO")} NOK` : `${pnlQuote.toFixed(2)} ${pair?.quoteCurrency ?? "quote"}`;
  const sideLabel = position.side === "BUY" ? "kjøp" : "salg";

  return {
    isOpen: true,
    isComplete: true,
    missingFields,
    pnlQuote,
    pnlNok,
    pnlPercentOfAccount,
    rMultiple,
    stopLossMissing,
    severity,
    title: severity === "danger" ? "Risikovarsel: håndter risiko nå" : severity === "warning" ? "Risikovarsel: følg tett" : "Risikovarsel: innenfor plan",
    detail: `${analysis.instrument.ticker} er registrert som ${sideLabel} fra ${position.entryPrice}. Estimert P/L er ${pnlLabel}${typeof rMultiple === "number" ? ` (${rMultiple.toFixed(2)}R)` : ""}.${stopLossMissing ? " Stop-loss mangler." : ""}`,
  };
}

export function getCurrencyConcentration(analyses: AnalysisResult[], positions: StoredPositions) {
  const exposure = new Map<string, number>();
  analyses.forEach((analysis) => {
    const position = positions[analysis.instrument.ticker];
    if (!position?.isOpen) return;
    const pair = getInstrumentCurrencyPair(analysis.instrument);
    if (!pair) return;
    exposure.set(pair.baseCurrency, (exposure.get(pair.baseCurrency) ?? 0) + (position.side === "BUY" ? 1 : -1));
    exposure.set(pair.quoteCurrency, (exposure.get(pair.quoteCurrency) ?? 0) + (position.side === "BUY" ? -1 : 1));
  });
  return [...exposure.entries()].sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))[0] ?? null;
}