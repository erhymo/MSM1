import type { AnalysisResult } from "@/lib/types/analysis";
import { TACTICAL_LABELS } from "@/lib/utils/format";

export type SwingFirstGuidance = {
  title: string;
  summary: string;
  nextStep: string;
  riskNote: string;
  bullets: string[];
};

function getDirectionText(analysis: AnalysisResult) {
  if (analysis.signal === "STRONG_BUY" || analysis.signal === "BUY") return "bullish";
  if (analysis.signal === "STRONG_SELL" || analysis.signal === "SELL") return "bearish";
  if (analysis.score > 15) return "svakt bullish";
  if (analysis.score < -15) return "svakt bearish";
  return "nøytral";
}

function getPlainFactorName(name: string) {
  if (name === "Retail sentiment") return "retail-sentiment";
  if (name === "COT momentum") return "COT-momentum";
  return name.toLowerCase();
}

function getTopFactors(analysis: AnalysisResult) {
  return [...analysis.factorContributions]
    .sort((left, right) => Math.abs(right.contribution) - Math.abs(left.contribution))
    .slice(0, 3);
}

function getTimingText(analysis: AnalysisResult) {
  const action = analysis.tacticalSignal?.action;
  if (!action) return "Timing-filteret mangler ferskt signal, så swing-biasen bør tolkes ekstra forsiktig.";
  if (action === "ENTER_LONG" || action === "ENTER_SHORT") {
    return "Timing er akseptabel, men dette er ikke et kjøpspåbud. Bruk det som bekreftelse hvis dere allerede har en planlagt swing-entry.";
  }
  if (action === "HOLD") return "Timing støtter først og fremst å følge med eller holde en eksisterende posisjon, ikke å jage ny størrelse.";
  if (action === "WAIT") return "Timing sier vent. Swing-caset kan fortsatt være interessant, men inngang bør ikke jages akkurat nå.";
  if (action === "TAKE_PROFIT") return "Timing sier at bevegelsen er strukket. For eksisterende posisjon handler dette mer om å sikre gevinst enn å legge til.";
  if (action === "EXIT") return "Timing varsler økende risiko mot swing-biasen. Nye posisjoner bør unngås, og åpne posisjoner bør vurderes strammere.";
  return "Timing sier unngå. Datakvalitet, volatilitet eller kortsiktig struktur er ikke god nok for ny risiko.";
}

function getNextStep(analysis: AnalysisResult, hasOpenPosition: boolean) {
  const action = analysis.tacticalSignal?.action;
  const bullish = analysis.signal === "STRONG_BUY" || analysis.signal === "BUY";
  const bearish = analysis.signal === "STRONG_SELL" || analysis.signal === "SELL";

  if (hasOpenPosition) {
    if (action === "EXIT" || action === "AVOID") return "Hvis dere allerede er inne, prioriter risikokontroll: sjekk stop-loss, unngå å legge til og vurder reduksjon hvis Risk Guard også varsler.";
    if (action === "TAKE_PROFIT") return "Hvis posisjonen er i pluss, vurder delgevinst eller flytt stop. Hvis den er i minus, ikke bruk swing-biasen som grunn til å øke.";
    return "Hvis dere allerede er inne, la swing-planen styre, men følg Risk Guard og ikke øk uten ny manuell vurdering.";
  }

  if (bullish) return "Uten posisjon: behandle dette som en watchlist-kandidat. Vent på rolig entry, definert stop og riktig størrelse før eventuell trade.";
  if (bearish) return "Uten posisjon: dette er primært en bearish watchlist-kandidat. Ikke kjøp mot signalet uten at modellen endrer seg.";
  return "Uten posisjon: ikke tving trade. Bruk instrumentet til observasjon til score, timing og regime blir tydeligere.";
}

function getRiskNote(analysis: AnalysisResult) {
  const action = analysis.tacticalSignal?.action;
  if (analysis.freshness.mode === "fallback") return "Datagrunnlaget har fallback-kilder. Reduser tillit til signalet til ferske data er bekreftet.";
  if (analysis.marketRegime === "Volatile") return "Regimet er volatilt. Bruk mindre størrelse, bredere beslutningsrom og strengere stop-disiplin.";
  if (action === "EXIT" || action === "AVOID") return "Korttidsbildet er negativt nok til at kapitalbeskyttelse bør veie tyngre enn nytt inngangsforsøk.";
  if (action === "TAKE_PROFIT") return "Prisen kan være strukket. Ikke legg til bare fordi swing-biasen er positiv.";
  return "Dette er fortsatt beslutningsstøtte, ikke en ordre. Maks risiko per trade bør holdes lav og stop bør være definert først.";
}

export function getSwingFirstGuidance(analysis: AnalysisResult, hasOpenPosition = false): SwingFirstGuidance {
  const direction = getDirectionText(analysis);
  const topFactors = getTopFactors(analysis);
  const factorText = topFactors.length
    ? topFactors.map((factor) => `${getPlainFactorName(factor.name)} ${factor.contribution >= 0 ? "støtter" : "trekker ned"} (${factor.contribution > 0 ? "+" : ""}${factor.contribution})`).join(", ")
    : "faktorbildet er blandet";
  const timingLabel = analysis.tacticalSignal ? TACTICAL_LABELS[analysis.tacticalSignal.action] : "Timing unavailable";

  return {
    title: `${analysis.instrument.ticker}: ${direction} 1–3 ukers bias`,
    summary: `MSM1 vurderer ${analysis.instrument.ticker} som ${direction} på swing-horisont, med score ${analysis.score} og ${analysis.confidence}% confidence. De viktigste driverne akkurat nå er ${factorText}.`,
    nextStep: getNextStep(analysis, hasOpenPosition),
    riskNote: getRiskNote(analysis),
    bullets: [
      `Swing-bias: ${direction} (${analysis.setupQuality} setup, ${analysis.marketRegime.toLowerCase()} regime).`,
      `Timing-filter: ${timingLabel}. ${getTimingText(analysis)}`,
      `Plan: entry ${analysis.entry}, stop ${analysis.signal === "NO_TRADE" ? "ikke aktiv" : analysis.stopLoss}, target ${analysis.signal === "NO_TRADE" ? "ikke aktiv" : analysis.target}.`,
    ],
  };
}
