import type { Instrument } from "@/lib/types/analysis";

type PriceSymbolMapping = {
  remoteSymbol: string;
  note?: string;
};

const symbolOverrides: Record<string, PriceSymbolMapping> = {
  XAUUSD: {
    remoteSymbol: "GC=F",
    note: "Gold futures proxy used for spot-gold coverage",
  },
  XBRUSD: {
    remoteSymbol: "BZ=F",
    note: "Brent crude futures contract",
  },
  SPX500: {
    remoteSymbol: "^GSPC",
    note: "S&P 500 index symbol",
  },
};

export function getPriceProviderSymbol(instrument: Instrument): PriceSymbolMapping {
  return symbolOverrides[instrument.ticker] ?? { remoteSymbol: `${instrument.ticker}=X` };
}