import { tradeManagerConfig } from "@/lib/config/trade-manager";
import type { AnalysisResult, SignalType, TradeManagerGuidance, TradeManagerPlan } from "@/lib/types/analysis";
import { getInstrumentCurrencyPair } from "@/lib/utils/instrument-currency";

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function getSignalDirection(signal: SignalType, score: number) {
  if (signal === "STRONG_BUY" || signal === "BUY") return 1;
  if (signal === "STRONG_SELL" || signal === "SELL") return -1;
  return Math.sign(score);
}

function getGuidance(analysis: AnalysisResult): TradeManagerGuidance {
  const action = analysis.tacticalSignal?.action;
  if (analysis.signal === "NO_TRADE" || action === "AVOID") return "AVOID";
  if (action === "ENTER_LONG" || action === "ENTER_SHORT") return "OPEN_POSITION";
  if (action === "TAKE_PROFIT") return "TAKE_PARTIAL_PROFIT";
  if (action === "EXIT") return "EXIT_POSITION";
  if (action === "HOLD") return "HOLD_POSITION";
  return "WAIT";
}

function getGuidanceSummary(guidance: TradeManagerGuidance, hasSizing: boolean) {
  if (guidance === "OPEN_POSITION") return hasSizing ? "Kun planlagt størrelse: hvis dere selv velger å handle, hold risikoen innenfor planen for 10 000 NOK-kontoen." : "Det korte bildet er greit, men NOK-beregning mangler. Ikke handle uten en manuell risikoplan.";
  if (guidance === "TAKE_PARTIAL_PROFIT") return "Risiko først: vurder å sikre delgevinst eller flytte stop-loss i stedet for å øke posisjonen.";
  if (guidance === "EXIT_POSITION") return "Risiko først: det korte bildet taler for å redusere risiko, ikke forsvare hovedretningen blindt.";
  if (guidance === "HOLD_POSITION") return "Eksisterende posisjon kan holdes hvis den passer planen, men unngå å legge til aggressivt.";
  if (guidance === "AVOID") return "Unngå ny risiko til data, uro eller kortsiktig bilde blir bedre.";
  return "Vent på tydeligere bilde og bestemt stop før dere risikerer kapital.";
}

export function computeTradeManagerPlan(analysis: AnalysisResult): TradeManagerPlan {
  const guidance = getGuidance(analysis);
  const accountEquityNok = tradeManagerConfig.accountEquityNok;
  const riskAmountNok = roundMoney((accountEquityNok * tradeManagerConfig.riskPercent) / 100);
  const maxRiskAmountNok = roundMoney((accountEquityNok * tradeManagerConfig.maxRiskPercent) / 100);
  const maxNotionalNok = roundMoney(accountEquityNok * tradeManagerConfig.maxNotionalLeverage);
  const nokPerQuote = analysis.nokDisplay?.nokPerQuote;
  const riskPerUnitQuote = Math.abs(analysis.entry - analysis.stopLoss);
  const profitPerUnitQuote = Math.abs(analysis.target - analysis.entry);
  const pair = getInstrumentCurrencyPair(analysis.instrument);
  const unitLabel = pair?.baseCurrency ? `${pair.baseCurrency} units` : "units";
  const hasSizing = Boolean(nokPerQuote && nokPerQuote > 0 && riskPerUnitQuote > 0 && analysis.signal !== "NO_TRADE");
  const notes = [
    `Grunnplanen risikerer ${tradeManagerConfig.riskPercent}% av en ${accountEquityNok.toLocaleString("nb-NO")} NOK-konto per handel.`,
    `Ikke gå over ${tradeManagerConfig.maxRiskPercent}% risiko uten en bevisst manuell beslutning.`,
  ];

  if (!hasSizing) {
    return {
      guidance,
      accountEquityNok,
      riskPercent: tradeManagerConfig.riskPercent,
      riskAmountNok,
      maxRiskPercent: tradeManagerConfig.maxRiskPercent,
      maxRiskAmountNok,
      maxNotionalNok,
      unitLabel,
      partialTakeProfit: {
        triggerR: tradeManagerConfig.partialTakeProfitR,
        closePercent: tradeManagerConfig.partialClosePercent,
        moveStopTo: "BREAK_EVEN",
      },
      summary: getGuidanceSummary(guidance, false),
      notes: [...notes, "Størrelse i NOK krever gyldig valutakurs til NOK og en stop som ikke er lik inngang."],
      source: tradeManagerConfig.source,
    };
  }

  const riskPerUnitNok = riskPerUnitQuote * nokPerQuote!;
  const notionalPerUnitNok = analysis.entry * nokPerQuote!;
  const riskBasedUnits = Math.floor(riskAmountNok / riskPerUnitNok);
  const notionalCappedUnits = Math.floor(maxNotionalNok / notionalPerUnitNok);
  const suggestedUnits = Math.max(0, Math.min(riskBasedUnits, notionalCappedUnits));
  const estimatedLossAtStopNok = roundMoney(suggestedUnits * riskPerUnitNok);
  const estimatedProfitAtTargetNok = roundMoney(suggestedUnits * profitPerUnitQuote * nokPerQuote!);
  const direction = getSignalDirection(analysis.signal, analysis.score) || 1;
  const partialPrice = Number((analysis.entry + direction * riskPerUnitQuote * tradeManagerConfig.partialTakeProfitR).toFixed(4));
  const estimatedRealizedProfitNok = roundMoney(estimatedLossAtStopNok * tradeManagerConfig.partialTakeProfitR * (tradeManagerConfig.partialClosePercent / 100));

  return {
    guidance,
    accountEquityNok,
    riskPercent: tradeManagerConfig.riskPercent,
    riskAmountNok,
    maxRiskPercent: tradeManagerConfig.maxRiskPercent,
    maxRiskAmountNok,
    maxNotionalNok,
    unitLabel,
    suggestedUnits,
    notionalValueNok: roundMoney(suggestedUnits * notionalPerUnitNok),
    riskPerUnitNok: roundMoney(riskPerUnitNok),
    estimatedLossAtStopNok,
    estimatedProfitAtTargetNok,
    partialTakeProfit: {
      triggerR: tradeManagerConfig.partialTakeProfitR,
      closePercent: tradeManagerConfig.partialClosePercent,
      moveStopTo: "BREAK_EVEN",
      price: partialPrice,
      estimatedRealizedProfitNok,
    },
    summary: getGuidanceSummary(guidance, true),
    notes: suggestedUnits < riskBasedUnits ? [...notes, `Størrelsen er begrenset av en forsiktig ${tradeManagerConfig.maxNotionalLeverage}x eksponeringsgrense.`] : notes,
    source: tradeManagerConfig.source,
  };
}

export function enrichAnalysesWithTradeManagerPlan(analyses: AnalysisResult[]): AnalysisResult[] {
  return analyses.map((analysis) => ({ ...analysis, tradeManagerPlan: computeTradeManagerPlan(analysis) }));
}