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
  if (analysis.signal === "STRONG_BUY" || analysis.signal === "BUY") return "positiv";
  if (analysis.signal === "STRONG_SELL" || analysis.signal === "SELL") return "negativ";
  if (analysis.score > 15) return "litt positiv";
  if (analysis.score < -15) return "litt negativ";
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
  if (!action) return "Den korte sjekken mangler ferskt signal, så vurderingen bør tolkes ekstra forsiktig.";
  if (action === "ENTER_LONG" || action === "ENTER_SHORT") {
    return "Det korte bildet er greit, men dette er ikke en ordre om å kjøpe eller selge. Bruk det bare som støtte hvis dere allerede har en tydelig plan.";
  }
  if (action === "HOLD") return "Det korte bildet støtter først og fremst å følge med eller holde en eksisterende posisjon, ikke å øke størrelsen.";
  if (action === "WAIT") return "Den korte sjekken sier vent. Paret kan fortsatt være interessant de neste ukene, men inngang bør ikke jages akkurat nå.";
  if (action === "TAKE_PROFIT") return "Prisen kan ha gått langt nok på kort sikt. For en eksisterende posisjon handler dette mer om å sikre gevinst enn å legge til.";
  if (action === "EXIT") return "Den korte sjekken varsler økende risiko. Nye posisjoner bør unngås, og åpne posisjoner bør vurderes strammere.";
  return "Den korte sjekken sier unngå. Data, uro eller kortsiktig utvikling er ikke god nok for ny risiko.";
}

function getNextStep(analysis: AnalysisResult, hasOpenPosition: boolean) {
  const action = analysis.tacticalSignal?.action;
  const bullish = analysis.signal === "STRONG_BUY" || analysis.signal === "BUY";
  const bearish = analysis.signal === "STRONG_SELL" || analysis.signal === "SELL";

  if (hasOpenPosition) {
    if (action === "EXIT" || action === "AVOID") return "Hvis dere allerede er inne, prioriter risikokontroll: sjekk stop-loss, unngå å legge til og vurder reduksjon hvis risikovarselet også varsler.";
    if (action === "TAKE_PROFIT") return "Hvis posisjonen er i pluss, vurder delgevinst eller flytt stop. Hvis den er i minus, ikke bruk hovedretningen som grunn til å øke.";
    return "Hvis dere allerede er inne, følg den opprinnelige planen, men følg risikovarselet og ikke øk uten ny manuell vurdering.";
  }

  if (bullish) return "Uten posisjon: se på dette som et par det kan være verdt å følge. Vent på rolig inngang, tydelig stop og riktig størrelse før eventuell handel.";
  if (bearish) return "Uten posisjon: modellen peker mest nedover. Ikke kjøp mot denne vurderingen uten at bildet endrer seg.";
  return "Uten posisjon: ikke tving frem en handel. Følg med til poengsum, kort sjekk og markedssituasjon blir tydeligere.";
}

function getRiskNote(analysis: AnalysisResult) {
  const action = analysis.tacticalSignal?.action;
  if (analysis.freshness.mode === "fallback") return "Datagrunnlaget har fallback-kilder. Reduser tillit til signalet til ferske data er bekreftet.";
  if (analysis.marketRegime === "Volatile") return "Regimet er volatilt. Bruk mindre størrelse, bredere beslutningsrom og strengere stop-disiplin.";
  if (action === "EXIT" || action === "AVOID") return "Det korte bildet er svakt nok til at kapitalbeskyttelse bør veie tyngre enn ny handel.";
  if (action === "TAKE_PROFIT") return "Prisen kan være strukket. Ikke legg til bare fordi hovedretningen er positiv.";
  return "Dette er beslutningsstøtte, ikke en ordre. Risiko per handel bør holdes lav og stop bør være bestemt først.";
}

export function getSwingFirstGuidance(analysis: AnalysisResult, hasOpenPosition = false): SwingFirstGuidance {
  const direction = getDirectionText(analysis);
  const topFactors = getTopFactors(analysis);
  const factorText = topFactors.length
    ? topFactors.map((factor) => `${getPlainFactorName(factor.name)} ${factor.contribution >= 0 ? "støtter" : "trekker ned"} (${factor.contribution > 0 ? "+" : ""}${factor.contribution})`).join(", ")
    : "faktorbildet er blandet";
  const timingLabel = analysis.tacticalSignal ? TACTICAL_LABELS[analysis.tacticalSignal.action] : "Kort sjekk mangler";

  return {
    title: `${analysis.instrument.ticker}: ${direction} retning de neste 1–3 ukene`,
    summary: `MSM1 vurderer ${analysis.instrument.ticker} som ${direction} de neste 1–3 ukene, med poengsum ${analysis.score} og ${analysis.confidence}% tillit. De viktigste driverne akkurat nå er ${factorText}.`,
    nextStep: getNextStep(analysis, hasOpenPosition),
    riskNote: getRiskNote(analysis),
    bullets: [
      `Hovedretning: ${direction} (${analysis.setupQuality} oppsett, ${analysis.marketRegime.toLowerCase()} marked).`,
      `Kort sjekk: ${timingLabel}. ${getTimingText(analysis)}`,
      `Planlagte nivåer: inngang ${analysis.entry}, stop ${analysis.signal === "NO_TRADE" ? "ikke aktiv" : analysis.stopLoss}, mål ${analysis.signal === "NO_TRADE" ? "ikke aktiv" : analysis.target}.`,
    ],
  };
}
