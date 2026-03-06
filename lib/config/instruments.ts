import type { Instrument } from "@/lib/types/analysis";

export const instruments: Instrument[] = [
  { ticker: "EURUSD", name: "Euro / US Dollar", assetClass: "FX" },
  { ticker: "GBPUSD", name: "British Pound / US Dollar", assetClass: "FX" },
  { ticker: "USDJPY", name: "US Dollar / Japanese Yen", assetClass: "FX" },
  { ticker: "AUDUSD", name: "Australian Dollar / US Dollar", assetClass: "FX" },
  { ticker: "USDCAD", name: "US Dollar / Canadian Dollar", assetClass: "FX" },
  { ticker: "USDCHF", name: "US Dollar / Swiss Franc", assetClass: "FX" },
  { ticker: "NZDUSD", name: "New Zealand Dollar / US Dollar", assetClass: "FX" },
  { ticker: "USDNOK", name: "US Dollar / Norwegian Krone", assetClass: "FX" },
  { ticker: "USDSEK", name: "US Dollar / Swedish Krona", assetClass: "FX" },
  { ticker: "USDMXN", name: "US Dollar / Mexican Peso", assetClass: "FX" },
  { ticker: "EURGBP", name: "Euro / British Pound", assetClass: "FX" },
  { ticker: "GBPJPY", name: "British Pound / Japanese Yen", assetClass: "FX" },
  { ticker: "XAUUSD", name: "Gold Spot / US Dollar", assetClass: "Commodity" },
  { ticker: "XBRUSD", name: "Brent Crude", assetClass: "Commodity" },
  { ticker: "SPX500", name: "S&P 500 Index", assetClass: "Index" },
];