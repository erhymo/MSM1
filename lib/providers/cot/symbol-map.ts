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

/* ------------------------------------------------------------------ */
/* Helper to build derived cross mappings                             */
/* ------------------------------------------------------------------ */

function derived(label: string, note: string, base: { name: string; w: number }, quote: { name: string; w: number }): CotSymbolMapping {
  return {
    strategy: "derived",
    label,
    note,
    legs: [
      { marketName: base.name, weight: base.w },
      { marketName: quote.name, weight: quote.w },
    ],
  };
}

function usdProxy(note: string): CotSymbolMapping {
  return { strategy: "proxy", label: "USD INDEX proxy", note, legs: [{ marketName: "USD INDEX", weight: 1 }] };
}

function eurProxy(note: string): CotSymbolMapping {
  return { strategy: "proxy", label: "EURO FX proxy", note, legs: [{ marketName: "EURO FX", weight: 1 }] };
}

function gbpProxy(note: string): CotSymbolMapping {
  return { strategy: "proxy", label: "BRITISH POUND proxy", note, legs: [{ marketName: "BRITISH POUND", weight: 1 }] };
}

/* Shorthand refs for the 8 CFTC currency futures */
const EUR = { name: "EURO FX", w: 1 };
const GBP = { name: "BRITISH POUND", w: 1 };
const GBP_INV = { name: "BRITISH POUND", w: -1 };
const JPY_INV = { name: "JAPANESE YEN", w: -1 };
const AUD = { name: "AUSTRALIAN DOLLAR", w: 1 };
const AUD_INV = { name: "AUSTRALIAN DOLLAR", w: -1 };
const CAD = { name: "CANADIAN DOLLAR", w: 1 };
const CAD_INV = { name: "CANADIAN DOLLAR", w: -1 };
const CHF = { name: "SWISS FRANC", w: 1 };
const CHF_INV = { name: "SWISS FRANC", w: -1 };
const NZD = { name: "NZ DOLLAR", w: 1 };
const NZD_INV = { name: "NZ DOLLAR", w: -1 };

const symbolMappings: Record<string, CotSymbolMapping> = {
  /* ---- Majors ---- */
  EURUSD: { strategy: "direct", label: "EURO FX", legs: [{ marketName: "EURO FX", weight: 1 }] },
  USDJPY: { strategy: "direct", label: "JAPANESE YEN", note: "JPY futures inverted for USDJPY bias", legs: [{ marketName: "JAPANESE YEN", weight: -1 }] },
  GBPUSD: { strategy: "direct", label: "BRITISH POUND", legs: [{ marketName: "BRITISH POUND", weight: 1 }] },
  USDCHF: { strategy: "direct", label: "SWISS FRANC", note: "CHF futures inverted for USDCHF bias", legs: [{ marketName: "SWISS FRANC", weight: -1 }] },
  USDCAD: { strategy: "direct", label: "CANADIAN DOLLAR", note: "CAD futures inverted for USDCAD bias", legs: [{ marketName: "CANADIAN DOLLAR", weight: -1 }] },
  AUDUSD: { strategy: "direct", label: "AUSTRALIAN DOLLAR", legs: [{ marketName: "AUSTRALIAN DOLLAR", weight: 1 }] },
  NZDUSD: { strategy: "direct", label: "NZ DOLLAR", legs: [{ marketName: "NZ DOLLAR", weight: 1 }] },

  /* ---- Crosses: EUR ---- */
  EURGBP: derived("EURO FX vs BRITISH POUND", "EUR vs GBP weekly positioning", EUR, GBP_INV),
  EURJPY: derived("EURO FX vs JAPANESE YEN", "EUR vs JPY weekly positioning", EUR, JPY_INV),
  EURCHF: derived("EURO FX vs SWISS FRANC", "EUR vs CHF weekly positioning", EUR, CHF_INV),
  EURAUD: derived("EURO FX vs AUSTRALIAN DOLLAR", "EUR vs AUD weekly positioning", EUR, AUD_INV),
  EURCAD: derived("EURO FX vs CANADIAN DOLLAR", "EUR vs CAD weekly positioning", EUR, CAD_INV),
  EURNZD: derived("EURO FX vs NZ DOLLAR", "EUR vs NZD weekly positioning", EUR, NZD_INV),

  /* ---- Crosses: GBP ---- */
  GBPJPY: derived("BRITISH POUND vs JAPANESE YEN", "GBP vs JPY weekly positioning", GBP, JPY_INV),
  GBPCHF: derived("BRITISH POUND vs SWISS FRANC", "GBP vs CHF weekly positioning", GBP, CHF_INV),
  GBPAUD: derived("BRITISH POUND vs AUSTRALIAN DOLLAR", "GBP vs AUD weekly positioning", GBP, AUD_INV),
  GBPCAD: derived("BRITISH POUND vs CANADIAN DOLLAR", "GBP vs CAD weekly positioning", GBP, CAD_INV),
  GBPNZD: derived("BRITISH POUND vs NZ DOLLAR", "GBP vs NZD weekly positioning", GBP, NZD_INV),

  /* ---- Crosses: JPY ---- */
  AUDJPY: derived("AUSTRALIAN DOLLAR vs JAPANESE YEN", "AUD vs JPY weekly positioning", AUD, JPY_INV),
  CADJPY: derived("CANADIAN DOLLAR vs JAPANESE YEN", "CAD vs JPY weekly positioning", CAD, JPY_INV),
  NZDJPY: derived("NZ DOLLAR vs JAPANESE YEN", "NZD vs JPY weekly positioning", NZD, JPY_INV),
  CHFJPY: derived("SWISS FRANC vs JAPANESE YEN", "CHF vs JPY weekly positioning", CHF, JPY_INV),

  /* ---- Crosses: Other ---- */
  AUDCAD: derived("AUSTRALIAN DOLLAR vs CANADIAN DOLLAR", "AUD vs CAD weekly positioning", AUD, CAD_INV),
  AUDCHF: derived("AUSTRALIAN DOLLAR vs SWISS FRANC", "AUD vs CHF weekly positioning", AUD, CHF_INV),
  AUDNZD: derived("AUSTRALIAN DOLLAR vs NZ DOLLAR", "AUD vs NZD weekly positioning", AUD, NZD_INV),
  NZDCAD: derived("NZ DOLLAR vs CANADIAN DOLLAR", "NZD vs CAD weekly positioning", NZD, CAD_INV),
  NZDCHF: derived("NZ DOLLAR vs SWISS FRANC", "NZD vs CHF weekly positioning", NZD, CHF_INV),
  CADCHF: derived("CANADIAN DOLLAR vs SWISS FRANC", "CAD vs CHF weekly positioning", CAD, CHF_INV),

  /* ---- Exotics: USD ---- */
  USDMXN: { strategy: "direct", label: "MEXICAN PESO", note: "MXN futures inverted for USDMXN bias", legs: [{ marketName: "MEXICAN PESO", weight: -1 }] },
  USDZAR: usdProxy("No ZAR futures on CFTC; USD INDEX used as proxy"),
  USDTRY: usdProxy("No TRY futures on CFTC; USD INDEX used as proxy"),
  USDSGD: usdProxy("No SGD futures on CFTC; USD INDEX used as proxy"),
  USDHKD: usdProxy("No HKD futures on CFTC; USD INDEX used as proxy"),
  USDINR: usdProxy("No INR futures on CFTC; USD INDEX used as proxy"),
  USDBRL: usdProxy("No BRL futures on CFTC; USD INDEX used as proxy"),
  USDSEK: usdProxy("No SEK futures on CFTC; USD INDEX used as proxy"),
  USDNOK: usdProxy("No NOK futures on CFTC; USD INDEX used as proxy"),
  USDDKK: usdProxy("No DKK futures on CFTC; USD INDEX used as proxy"),
  USDPLN: usdProxy("No PLN futures on CFTC; USD INDEX used as proxy"),
  USDTHB: usdProxy("No THB futures on CFTC; USD INDEX used as proxy"),
  USDCNH: usdProxy("No CNH futures on CFTC; USD INDEX used as proxy"),
  USDILS: usdProxy("No ILS futures on CFTC; USD INDEX used as proxy"),
  USDCZK: usdProxy("No CZK futures on CFTC; USD INDEX used as proxy"),
  USDHUF: usdProxy("No HUF futures on CFTC; USD INDEX used as proxy"),

  /* ---- Exotics: EUR / GBP crosses ---- */
  EURTRY: eurProxy("No TRY futures on CFTC; EURO FX used as base-side proxy"),
  EURZAR: eurProxy("No ZAR futures on CFTC; EURO FX used as base-side proxy"),
  EURSEK: eurProxy("No SEK futures on CFTC; EURO FX used as base-side proxy"),
  EURNOK: eurProxy("No NOK futures on CFTC; EURO FX used as base-side proxy"),
  GBPZAR: gbpProxy("No ZAR futures on CFTC; BRITISH POUND used as base-side proxy"),

  /* ---- Non-FX ---- */
  XAUUSD: { strategy: "direct", label: "GOLD", note: "Gold futures positioning", legs: [{ marketName: "GOLD", weight: 1 }] },
  XBRUSD: { strategy: "direct", label: "BRENT LAST DAY", note: "Brent crude futures positioning", legs: [{ marketName: "BRENT LAST DAY", weight: 1 }] },
  SPX500: { strategy: "direct", label: "E-MINI S&P 500", legs: [{ marketName: "E-MINI S&P 500", weight: 1 }] },
};

export function getCotProviderMapping(instrument: Instrument): CotSymbolMapping {
  const mapping = symbolMappings[instrument.ticker];

  if (!mapping) {
    throw new Error(`Missing COT symbol mapping for ${instrument.ticker}`);
  }

  return mapping;
}