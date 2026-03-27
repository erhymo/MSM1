import type { Instrument } from "@/lib/types/analysis";

export type SentimentSymbolMapping = {
  providerInstrument: string;
};

const symbolMappings: Record<string, SentimentSymbolMapping> = {
  // Majors
  EURUSD: { providerInstrument: "EUR/USD" },
  USDJPY: { providerInstrument: "USD/JPY" },
  GBPUSD: { providerInstrument: "GBP/USD" },
  USDCHF: { providerInstrument: "USD/CHF" },
  USDCAD: { providerInstrument: "USD/CAD" },
  AUDUSD: { providerInstrument: "AUD/USD" },
  NZDUSD: { providerInstrument: "NZD/USD" },

  // Crosses: EUR
  EURGBP: { providerInstrument: "EUR/GBP" },
  EURJPY: { providerInstrument: "EUR/JPY" },
  EURCHF: { providerInstrument: "EUR/CHF" },
  EURAUD: { providerInstrument: "EUR/AUD" },
  EURCAD: { providerInstrument: "EUR/CAD" },
  EURNZD: { providerInstrument: "EUR/NZD" },

  // Crosses: GBP
  GBPJPY: { providerInstrument: "GBP/JPY" },
  GBPCHF: { providerInstrument: "GBP/CHF" },
  GBPAUD: { providerInstrument: "GBP/AUD" },
  GBPCAD: { providerInstrument: "GBP/CAD" },
  GBPNZD: { providerInstrument: "GBP/NZD" },

  // Crosses: JPY
  AUDJPY: { providerInstrument: "AUD/JPY" },
  CADJPY: { providerInstrument: "CAD/JPY" },
  NZDJPY: { providerInstrument: "NZD/JPY" },
  CHFJPY: { providerInstrument: "CHF/JPY" },

  // Crosses: Other
  AUDCAD: { providerInstrument: "AUD/CAD" },
  AUDCHF: { providerInstrument: "AUD/CHF" },
  AUDNZD: { providerInstrument: "AUD/NZD" },
  NZDCAD: { providerInstrument: "NZD/CAD" },
  NZDCHF: { providerInstrument: "NZD/CHF" },
  CADCHF: { providerInstrument: "CAD/CHF" },

  // Exotics: USD
  USDMXN: { providerInstrument: "USD/MXN" },
  USDZAR: { providerInstrument: "USD/ZAR" },
  USDTRY: { providerInstrument: "USD/TRY" },
  USDSGD: { providerInstrument: "USD/SGD" },
  USDHKD: { providerInstrument: "USD/HKD" },
  // USDINR — not available on Dukascopy (mock fallback)
  // USDBRL — not available on Dukascopy (mock fallback)
  USDSEK: { providerInstrument: "USD/SEK" },
  USDNOK: { providerInstrument: "USD/NOK" },
  USDDKK: { providerInstrument: "USD/DKK" },
  USDPLN: { providerInstrument: "USD/PLN" },
  USDTHB: { providerInstrument: "USD/THB" },
  USDCNH: { providerInstrument: "USD/CNH" },
  USDILS: { providerInstrument: "USD/ILS" },
  USDCZK: { providerInstrument: "USD/CZK" },
  USDHUF: { providerInstrument: "USD/HUF" },

  // Exotics: EUR / GBP crosses
  EURTRY: { providerInstrument: "EUR/TRY" },
  EURZAR: { providerInstrument: "EUR/ZAR" },
  EURSEK: { providerInstrument: "EUR/SEK" },
  EURNOK: { providerInstrument: "EUR/NOK" },
  // GBPZAR — not available on Dukascopy (mock fallback)

  // Non-FX
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