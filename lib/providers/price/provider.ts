import { writeSystemLog } from "@/lib/firebase/firestore-system-log-service";
import { mockPriceProvider } from "@/lib/providers/mock/price-provider";
import type { PriceDataProvider } from "@/lib/providers/types";
import type { Instrument } from "@/lib/types/analysis";

import { priceProviderConfig } from "@/lib/providers/price/config";
import { getFirestoreFallbackPriceSnapshot } from "@/lib/providers/price/firestore-fallback";
import { yahooChartPriceProvider } from "@/lib/providers/price/yahoo-chart-provider";

const remoteProviders: Record<typeof priceProviderConfig.provider, PriceDataProvider> = {
  "yahoo-chart": yahooChartPriceProvider,
};

const selectedRemoteProvider = remoteProviders[priceProviderConfig.provider];

export const priceProvider: PriceDataProvider = {
  async getSnapshot(instrument: Instrument) {
    try {
      return await selectedRemoteProvider.getSnapshot(instrument);
    } catch (error) {
      const reason = error instanceof Error ? error.message : "unknown-error";
      const firestoreFallback = await getFirestoreFallbackPriceSnapshot(instrument);

      if (firestoreFallback) {
        await writeSystemLog({
          level: "warning",
          scope: "price-provider",
          message: "Price provider failed, using Firestore fallback snapshot",
          details: {
            ticker: instrument.ticker,
            provider: priceProviderConfig.provider,
            reason,
          },
        }).catch(() => undefined);

        return firestoreFallback;
      }

      const mockFallback = await mockPriceProvider.getSnapshot(instrument);

      await writeSystemLog({
        level: "error",
        scope: "price-provider",
        message: "Price provider failed and no Firestore fallback snapshot was available",
        details: {
          ticker: instrument.ticker,
          provider: priceProviderConfig.provider,
          reason,
        },
      }).catch(() => undefined);

      return {
        ...mockFallback,
        freshness: {
          mode: "fallback",
          updatedAt: mockFallback.updatedAt,
          note: "Price API failed and no Firestore snapshot was available; using mock fallback",
        },
      };
    }
  },
};