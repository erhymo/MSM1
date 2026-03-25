import "server-only";

import { getExchangeRatePairQuote } from "@/lib/providers/price/exchange-rate-provider";
import { priceProviderConfig } from "@/lib/providers/price/config";
import { writeSystemLog } from "@/lib/firebase/firestore-system-log-service";
import type { AnalysisResult } from "@/lib/types/analysis";
import { getInstrumentCurrencyPair, supportsNokDisplay } from "@/lib/utils/instrument-currency";

function hasValidNokDisplay(analysis: AnalysisResult) {
  return Boolean(analysis.nokDisplay && Number.isFinite(analysis.nokDisplay.nokPerQuote) && analysis.nokDisplay.nokPerQuote > 0);
}

export async function enrichAnalysesWithNokDisplay(analyses: AnalysisResult[]): Promise<AnalysisResult[]> {
  if (!priceProviderConfig.exchangeRateApiKey) return analyses;

  const pendingQuoteCurrencies = [...new Set(
    analyses
      .filter((analysis) => supportsNokDisplay(analysis.instrument) && !hasValidNokDisplay(analysis))
      .map((analysis) => getInstrumentCurrencyPair(analysis.instrument)?.quoteCurrency)
      .filter((quoteCurrency): quoteCurrency is string => Boolean(quoteCurrency)),
  )];

  if (!pendingQuoteCurrencies.length) return analyses;

  const rateEntries = await Promise.allSettled(
    pendingQuoteCurrencies.map(async (quoteCurrency) => {
      if (quoteCurrency === "NOK") {
        return [
          quoteCurrency,
          {
            quoteCurrency,
            nokPerQuote: 1,
            source: "exchange-rate-api",
            updatedAt: new Date().toISOString(),
          },
        ] as const;
      }

      const quote = await getExchangeRatePairQuote(quoteCurrency, "NOK");
      return [
        quoteCurrency,
        {
          quoteCurrency,
          nokPerQuote: quote.rate,
          source: quote.source,
          updatedAt: quote.updatedAt,
        },
      ] as const;
    }),
  );

  const nokDisplayByQuoteCurrency = new Map<string, NonNullable<AnalysisResult["nokDisplay"]>>();
  const failedCurrencies: string[] = [];

  rateEntries.forEach((entry, index) => {
    if (entry.status === "fulfilled") {
      nokDisplayByQuoteCurrency.set(entry.value[0], entry.value[1]);
    } else {
      failedCurrencies.push(`${pendingQuoteCurrencies[index]}: ${entry.reason instanceof Error ? entry.reason.message : String(entry.reason)}`);
    }
  });

  if (failedCurrencies.length > 0) {
    await writeSystemLog({
      level: "warning",
      scope: "price-provider",
      message: `ExchangeRate API failed for ${failedCurrencies.length} of ${pendingQuoteCurrencies.length} currencies`,
      details: {
        failed: failedCurrencies.join(" | "),
        succeeded: nokDisplayByQuoteCurrency.size,
      },
    }).catch(() => undefined);
  }

  return analyses.map((analysis) => {
    if (!supportsNokDisplay(analysis.instrument) || hasValidNokDisplay(analysis)) {
      return analysis;
    }

    const pair = getInstrumentCurrencyPair(analysis.instrument);
    if (!pair) return analysis;

    const nokDisplay = nokDisplayByQuoteCurrency.get(pair.quoteCurrency);
    return nokDisplay ? { ...analysis, nokDisplay } : analysis;
  });
}