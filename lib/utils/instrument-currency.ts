import type { Instrument } from "@/lib/types/analysis";

export type InstrumentCurrencyPair = {
  baseCurrency: string;
  quoteCurrency: string;
};

function toTicker(value: Instrument | string) {
  return (typeof value === "string" ? value : value.ticker).trim().toUpperCase();
}

export function getInstrumentCurrencyPair(value: Instrument | string): InstrumentCurrencyPair | null {
  const ticker = toTicker(value);
  if (!/^[A-Z]{6}$/.test(ticker)) return null;

  return {
    baseCurrency: ticker.slice(0, 3),
    quoteCurrency: ticker.slice(3, 6),
  };
}

export function isFxInstrument(value: Instrument) {
  return value.assetClass === "FX" && Boolean(getInstrumentCurrencyPair(value));
}

export function supportsNokDisplay(value: Instrument) {
  return value.assetClass !== "Index" && Boolean(getInstrumentCurrencyPair(value));
}