import type { Instrument } from "@/lib/types/analysis";

export type SentimentSymbolMapping = {
  providerInstrument: string;
};

const symbolMappings: Record<string, SentimentSymbolMapping> = {
  EURUSD: { providerInstrument: "EUR/USD" },
  GBPUSD: { providerInstrument: "GBP/USD" },
  USDJPY: { providerInstrument: "USD/JPY" },
  AUDUSD: { providerInstrument: "AUD/USD" },
  USDCAD: { providerInstrument: "USD/CAD" },
  USDCHF: { providerInstrument: "USD/CHF" },
  NZDUSD: { providerInstrument: "NZD/USD" },
  USDNOK: { providerInstrument: "USD/NOK" },
  USDSEK: { providerInstrument: "USD/SEK" },
  USDMXN: { providerInstrument: "USD/MXN" },
  EURGBP: { providerInstrument: "EUR/GBP" },
  GBPJPY: { providerInstrument: "GBP/JPY" },
  XAUUSD: { providerInstrument: "XAU/USD" },
  XBRUSD: { providerInstrument: "BRENT.CMD/USD" },
  SPX500: { providerInstrument: "USA500.IDX/USD" },
};

export function getSentimentProviderMapping(instrument: Instrument): SentimentSymbolMapping {
  const mapping = symbolMappings[instrument.ticker];

  if (!mapping) {
    throw new Error(`Missing sentiment symbol mapping for ${instrument.ticker}`);
  }

  return mapping;
}