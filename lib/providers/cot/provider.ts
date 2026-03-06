import { writeSystemLog } from "@/lib/firebase/firestore-system-log-service";
import { mockCotProvider } from "@/lib/providers/mock/cot-provider";
import type { COTDataProvider } from "@/lib/providers/types";
import type { Instrument } from "@/lib/types/analysis";

import { cotProviderConfig } from "@/lib/providers/cot/config";
import { getFirestoreCachedCotSnapshot, getFirestoreFallbackCotSnapshot } from "@/lib/providers/cot/firestore-fallback";
import { legacyFuturesCotProvider } from "@/lib/providers/cot/legacy-futures-provider";

const remoteProviders: Record<typeof cotProviderConfig.provider, COTDataProvider> = {
  "cftc-legacy-futures": legacyFuturesCotProvider,
};

const selectedRemoteProvider = remoteProviders[cotProviderConfig.provider];

export const cotProvider: COTDataProvider = {
  async getSnapshot(instrument: Instrument) {
    const cachedSnapshot = await getFirestoreCachedCotSnapshot(instrument);

    if (cachedSnapshot) {
      return cachedSnapshot;
    }

    try {
      return await selectedRemoteProvider.getSnapshot(instrument);
    } catch (error) {
      const reason = error instanceof Error ? error.message : "unknown-error";
      const firestoreFallback = await getFirestoreFallbackCotSnapshot(instrument);

      if (firestoreFallback) {
        await writeSystemLog({
          level: "warning",
          scope: "cot-provider",
          message: "COT provider failed, using Firestore fallback snapshot",
          details: {
            ticker: instrument.ticker,
            provider: cotProviderConfig.provider,
            reason,
          },
        }).catch(() => undefined);

        return firestoreFallback;
      }

      const mockFallback = await mockCotProvider.getSnapshot(instrument);

      await writeSystemLog({
        level: "error",
        scope: "cot-provider",
        message: "COT provider failed and no Firestore fallback snapshot was available",
        details: {
          ticker: instrument.ticker,
          provider: cotProviderConfig.provider,
          reason,
        },
      }).catch(() => undefined);

      return {
        ...mockFallback,
        freshness: {
          mode: "fallback",
          updatedAt: mockFallback.updatedAt,
          note: "COT API failed and no Firestore snapshot was available; using mock weekly fallback",
        },
      };
    }
  },
};