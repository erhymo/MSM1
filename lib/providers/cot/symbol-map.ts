import type { Instrument } from "@/lib/types/analysis";

export type CotMarketLeg = {
  marketName: string;
  weight: number;
};

export type CotSymbolMapping = {
  strategy: "direct" | "derived" | "proxy";
  label: string;
  note?: string;
  legs: CotMarketLeg[];
};

const symbolMappings: Record<string, CotSymbolMapping> = {
  EURUSD: { strategy: "direct", label: "EURO FX", legs: [{ marketName: "EURO FX", weight: 1 }] },
  GBPUSD: { strategy: "direct", label: "BRITISH POUND", legs: [{ marketName: "BRITISH POUND", weight: 1 }] },
  USDJPY: { strategy: "direct", label: "JAPANESE YEN", note: "JPY futures are inverted to express USDJPY pair bias", legs: [{ marketName: "JAPANESE YEN", weight: -1 }] },
  AUDUSD: { strategy: "direct", label: "AUSTRALIAN DOLLAR", legs: [{ marketName: "AUSTRALIAN DOLLAR", weight: 1 }] },
  USDCAD: { strategy: "direct", label: "CANADIAN DOLLAR", note: "CAD futures are inverted to express USDCAD pair bias", legs: [{ marketName: "CANADIAN DOLLAR", weight: -1 }] },
  USDCHF: { strategy: "direct", label: "SWISS FRANC", note: "CHF futures are inverted to express USDCHF pair bias", legs: [{ marketName: "SWISS FRANC", weight: -1 }] },
  NZDUSD: { strategy: "direct", label: "NZ DOLLAR", legs: [{ marketName: "NZ DOLLAR", weight: 1 }] },
  USDNOK: { strategy: "proxy", label: "USD INDEX proxy", note: "USD Index is used as a practical proxy until a dedicated NOK mapping is added", legs: [{ marketName: "USD INDEX", weight: 1 }] },
  USDSEK: { strategy: "proxy", label: "USD INDEX proxy", note: "USD Index is used as a practical proxy until a dedicated SEK mapping is added", legs: [{ marketName: "USD INDEX", weight: 1 }] },
  USDMXN: { strategy: "direct", label: "MEXICAN PESO", note: "MXN futures are inverted to express USDMXN pair bias", legs: [{ marketName: "MEXICAN PESO", weight: -1 }] },
  EURGBP: {
    strategy: "derived",
    label: "EURO FX vs BRITISH POUND",
    note: "Derived from the relative weekly positioning of EUR and GBP futures",
    legs: [
      { marketName: "EURO FX", weight: 1 },
      { marketName: "BRITISH POUND", weight: -1 },
    ],
  },
  GBPJPY: {
    strategy: "derived",
    label: "BRITISH POUND vs JAPANESE YEN",
    note: "Derived from GBP strength versus JPY strength in weekly futures positioning",
    legs: [
      { marketName: "BRITISH POUND", weight: 1 },
      { marketName: "JAPANESE YEN", weight: -1 },
    ],
  },
  XAUUSD: { strategy: "direct", label: "GOLD", note: "Gold futures positioning used as the long-term spot gold bias", legs: [{ marketName: "GOLD", weight: 1 }] },
  XBRUSD: { strategy: "direct", label: "BRENT LAST DAY", note: "Brent last-day futures positioning used as the Brent crude bias", legs: [{ marketName: "BRENT LAST DAY", weight: 1 }] },
  SPX500: { strategy: "direct", label: "E-MINI S&P 500", legs: [{ marketName: "E-MINI S&P 500", weight: 1 }] },
};

export function getCotProviderMapping(instrument: Instrument): CotSymbolMapping {
  const mapping = symbolMappings[instrument.ticker];

  if (!mapping) {
    throw new Error(`Missing COT symbol mapping for ${instrument.ticker}`);
  }

  return mapping;
}