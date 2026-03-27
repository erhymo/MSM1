import type { Instrument } from "@/lib/types/analysis";

export const instruments: Instrument[] = [
  // --- Majors ---
  { ticker: "EURUSD", name: "Euro / US Dollar", assetClass: "FX" },
  { ticker: "USDJPY", name: "US Dollar / Japanese Yen", assetClass: "FX" },
  { ticker: "GBPUSD", name: "British Pound / US Dollar", assetClass: "FX" },
  { ticker: "USDCHF", name: "US Dollar / Swiss Franc", assetClass: "FX" },
  { ticker: "USDCAD", name: "US Dollar / Canadian Dollar", assetClass: "FX" },
  { ticker: "AUDUSD", name: "Australian Dollar / US Dollar", assetClass: "FX" },
  { ticker: "NZDUSD", name: "New Zealand Dollar / US Dollar", assetClass: "FX" },

  // --- Crosses: EUR ---
  { ticker: "EURGBP", name: "Euro / British Pound", assetClass: "FX" },
  { ticker: "EURJPY", name: "Euro / Japanese Yen", assetClass: "FX" },
  { ticker: "EURCHF", name: "Euro / Swiss Franc", assetClass: "FX" },
  { ticker: "EURAUD", name: "Euro / Australian Dollar", assetClass: "FX" },
  { ticker: "EURCAD", name: "Euro / Canadian Dollar", assetClass: "FX" },
  { ticker: "EURNZD", name: "Euro / New Zealand Dollar", assetClass: "FX" },

  // --- Crosses: GBP ---
  { ticker: "GBPJPY", name: "British Pound / Japanese Yen", assetClass: "FX" },
  { ticker: "GBPCHF", name: "British Pound / Swiss Franc", assetClass: "FX" },
  { ticker: "GBPAUD", name: "British Pound / Australian Dollar", assetClass: "FX" },
  { ticker: "GBPCAD", name: "British Pound / Canadian Dollar", assetClass: "FX" },
  { ticker: "GBPNZD", name: "British Pound / New Zealand Dollar", assetClass: "FX" },

  // --- Crosses: JPY ---
  { ticker: "AUDJPY", name: "Australian Dollar / Japanese Yen", assetClass: "FX" },
  { ticker: "CADJPY", name: "Canadian Dollar / Japanese Yen", assetClass: "FX" },
  { ticker: "NZDJPY", name: "New Zealand Dollar / Japanese Yen", assetClass: "FX" },
  { ticker: "CHFJPY", name: "Swiss Franc / Japanese Yen", assetClass: "FX" },

  // --- Crosses: Other ---
  { ticker: "AUDCAD", name: "Australian Dollar / Canadian Dollar", assetClass: "FX" },
  { ticker: "AUDCHF", name: "Australian Dollar / Swiss Franc", assetClass: "FX" },
  { ticker: "AUDNZD", name: "Australian Dollar / New Zealand Dollar", assetClass: "FX" },
  { ticker: "NZDCAD", name: "New Zealand Dollar / Canadian Dollar", assetClass: "FX" },
  { ticker: "NZDCHF", name: "New Zealand Dollar / Swiss Franc", assetClass: "FX" },
  { ticker: "CADCHF", name: "Canadian Dollar / Swiss Franc", assetClass: "FX" },

  // --- Exotics: USD ---
  { ticker: "USDMXN", name: "US Dollar / Mexican Peso", assetClass: "FX" },
  { ticker: "USDZAR", name: "US Dollar / South African Rand", assetClass: "FX" },
  { ticker: "USDTRY", name: "US Dollar / Turkish Lira", assetClass: "FX" },
  { ticker: "USDSGD", name: "US Dollar / Singapore Dollar", assetClass: "FX" },
  { ticker: "USDHKD", name: "US Dollar / Hong Kong Dollar", assetClass: "FX" },
  { ticker: "USDINR", name: "US Dollar / Indian Rupee", assetClass: "FX" },
  { ticker: "USDBRL", name: "US Dollar / Brazilian Real", assetClass: "FX" },
  { ticker: "USDSEK", name: "US Dollar / Swedish Krona", assetClass: "FX" },
  { ticker: "USDNOK", name: "US Dollar / Norwegian Krone", assetClass: "FX" },
  { ticker: "USDDKK", name: "US Dollar / Danish Krone", assetClass: "FX" },
  { ticker: "USDPLN", name: "US Dollar / Polish Zloty", assetClass: "FX" },
  { ticker: "USDTHB", name: "US Dollar / Thai Baht", assetClass: "FX" },
  { ticker: "USDCNH", name: "US Dollar / Chinese Yuan Offshore", assetClass: "FX" },
  { ticker: "USDILS", name: "US Dollar / Israeli Shekel", assetClass: "FX" },
  { ticker: "USDCZK", name: "US Dollar / Czech Koruna", assetClass: "FX" },
  { ticker: "USDHUF", name: "US Dollar / Hungarian Forint", assetClass: "FX" },

  // --- Exotics: EUR / GBP crosses ---
  { ticker: "EURTRY", name: "Euro / Turkish Lira", assetClass: "FX" },
  { ticker: "EURZAR", name: "Euro / South African Rand", assetClass: "FX" },
  { ticker: "EURSEK", name: "Euro / Swedish Krona", assetClass: "FX" },
  { ticker: "EURNOK", name: "Euro / Norwegian Krone", assetClass: "FX" },
  { ticker: "GBPZAR", name: "British Pound / South African Rand", assetClass: "FX" },

  // --- Non-FX ---
  { ticker: "XAUUSD", name: "Gold Spot / US Dollar", assetClass: "Commodity" },
  { ticker: "XBRUSD", name: "Brent Crude", assetClass: "Commodity" },
  { ticker: "SPX500", name: "S&P 500 Index", assetClass: "Index" },
];