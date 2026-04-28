import type { MarketRegime, PriceSnapshot, SignalType, TacticalSignal, VolatilitySnapshot } from "@/lib/types/analysis";

type TacticalInput = {
  price: PriceSnapshot;
  volatility: VolatilitySnapshot;
  swingSignal: SignalType;
  swingScore: number;
  swingConfidence: number;
  marketRegime: MarketRegime;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function round(value: number) {
  return Math.round(value);
}

function getSwingDirection(signal: SignalType, score: number) {
  if (signal === "STRONG_BUY" || signal === "BUY") return 1;
  if (signal === "STRONG_SELL" || signal === "SELL") return -1;
  if (signal === "HOLD" && Math.abs(score) >= 25) return Math.sign(score);
  return 0;
}

function getRecentAverage(price: PriceSnapshot) {
  const recent = price.priceHistory.slice(-8).map((point) => point.value).filter(Number.isFinite);
  if (!recent.length) return price.currentPrice;
  return recent.reduce((sum, value) => sum + value, 0) / recent.length;
}

function getStretchComponent(price: PriceSnapshot, direction: number) {
  if (!direction || price.atr14 <= 0) return 0;

  const stretchInAtr = ((price.currentPrice - getRecentAverage(price)) / price.atr14) * direction;
  const quality =
    stretchInAtr >= 1.8
      ? -70
      : stretchInAtr >= 1.15
        ? -45
        : stretchInAtr <= -1.7
          ? -45
          : stretchInAtr <= -0.35
            ? 35
            : 15;

  return {
    component: round(clamp(quality * direction, -100, 100)),
    stretchInAtr,
  };
}

function getVolatilityComponent(volatility: VolatilitySnapshot, marketRegime: MarketRegime, direction: number) {
  if (!direction) return 0;
  const quality =
    marketRegime === "Volatile" || volatility.atrPercent >= 2.1
      ? -55
      : volatility.atrPercent < 0.45
        ? -20
        : volatility.atrPercent <= 1.6
          ? 35
          : 10;

  return round(clamp(quality * direction, -100, 100));
}

function getSwingComponent(signal: SignalType, score: number, confidence: number, direction: number) {
  if (!direction) return 0;
  const strongSignal = signal === "STRONG_BUY" || signal === "STRONG_SELL";
  const magnitude = strongSignal ? 58 : confidence >= 60 ? 44 : 30;
  return round(clamp(magnitude * direction + score * 0.12, -100, 100));
}

function getReason(action: TacticalSignal["action"], direction: number, stretchInAtr: number, components: TacticalSignal["components"]) {
  const side = direction > 0 ? "bullish" : direction < 0 ? "bearish" : "neutral";
  const momentumAligned = direction !== 0 && components.momentum4h * direction >= 15;
  const dailyAligned = direction !== 0 && components.dailyAlignment * direction >= 15;
  const stretched = direction !== 0 && stretchInAtr >= 1.15;

  if (action === "AVOID") return "Tactical timing is unreliable because price data or volatility conditions are not clean enough.";
  if (action === "TAKE_PROFIT") return `Swing remains ${side}, but the move is stretched versus recent ATR; consider securing gains rather than adding.`;
  if (action === "EXIT") return `Short-term momentum is now working against the ${side} swing bias.`;
  if (action === "ENTER_LONG" || action === "ENTER_SHORT") return `Swing bias, 4H momentum and daily structure are aligned, and price is not overly stretched.`;
  if (action === "HOLD") return `Swing bias is still ${side}; tactical conditions support holding more than adding aggressively.`;
  if (!direction) return "No clear swing edge yet, so tactical layer stays patient.";
  if (!momentumAligned) return `Swing is ${side}, but 4H momentum has not confirmed a fresh entry.`;
  if (!dailyAligned) return `4H timing is improving, but daily structure is not fully aligned yet.`;
  if (stretched) return `Swing is ${side}, but price is already stretched versus recent ATR.`;
  return "Setup is close, but tactical confirmation is not strong enough for a fresh entry.";
}

export function computeTacticalSignal({ price, volatility, swingSignal, swingScore, swingConfidence, marketRegime }: TacticalInput): TacticalSignal {
  const direction = getSwingDirection(swingSignal, swingScore);
  const stretch = getStretchComponent(price, direction);
  const stretchComponent = typeof stretch === "number" ? stretch : stretch.component;
  const stretchInAtr = typeof stretch === "number" ? 0 : stretch.stretchInAtr;
  const components: TacticalSignal["components"] = {
    momentum4h: round(clamp(price.fourHourMomentum.bias, -100, 100)),
    dailyAlignment: round(clamp(price.dailyTrend.bias, -100, 100)),
    stretch: stretchComponent,
    volatility: getVolatilityComponent(volatility, marketRegime, direction),
    swingAlignment: getSwingComponent(swingSignal, swingScore, swingConfidence, direction),
  };
  const score = round(
    clamp(
      components.momentum4h * 0.35 +
        components.dailyAlignment * 0.2 +
        components.stretch * 0.2 +
        components.volatility * 0.1 +
        components.swingAlignment * 0.15,
      -100,
      100,
    ),
  );
  const directionalScore = direction ? score * direction : 0;
  const staleTiming = price.freshness.mode === "fallback" || volatility.freshness.mode === "fallback";
  const stretchedWithTrend = direction !== 0 && stretchInAtr >= 1.15 && components.momentum4h * direction >= 12;
  const reversalAgainstSwing = direction !== 0 && directionalScore <= -28 && components.momentum4h * direction <= -20;
  const tooVolatile = marketRegime === "Volatile" && volatility.atrPercent >= 2.1;

  const action: TacticalSignal["action"] = staleTiming || tooVolatile
    ? "AVOID"
    : !direction
      ? "WAIT"
      : stretchedWithTrend && directionalScore >= 5
        ? "TAKE_PROFIT"
        : reversalAgainstSwing
          ? "EXIT"
          : direction > 0 && score >= 35 && components.dailyAlignment > 0
            ? "ENTER_LONG"
            : direction < 0 && score <= -35 && components.dailyAlignment < 0
              ? "ENTER_SHORT"
              : directionalScore >= 10
                ? "HOLD"
                : "WAIT";

  const componentAgreement = Object.values(components).filter((value) => direction !== 0 && value * direction > 0).length / Object.keys(components).length;
  const confidencePenalty = staleTiming ? 18 : tooVolatile ? 14 : 0;
  const confidence = round(clamp(Math.abs(score) * 0.5 + swingConfidence * 0.28 + componentAgreement * 28 - confidencePenalty, 15, 95));

  return {
    action,
    score,
    confidence,
    reason: getReason(action, direction, stretchInAtr, components),
    horizon: "1D-3D",
    components,
  };
}