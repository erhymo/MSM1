import { writeSystemLog } from "@/lib/firebase/firestore-system-log-service";
import { mockSentimentProvider } from "@/lib/providers/mock/sentiment-provider";
import { sentimentProviderConfig } from "@/lib/providers/sentiment/config";
import { dukascopySentimentProvider } from "@/lib/providers/sentiment/dukascopy-provider";
import { getFirestoreCachedSentimentSnapshot, getFirestoreFallbackSentimentSnapshot } from "@/lib/providers/sentiment/firestore-fallback";
import type { SentimentDataProvider } from "@/lib/providers/types";
import type { Instrument } from "@/lib/types/analysis";

const remoteProviders: Record<typeof sentimentProviderConfig.provider, SentimentDataProvider> = {
  "dukascopy-realtime": dukascopySentimentProvider,
};

const selectedRemoteProvider = remoteProviders[sentimentProviderConfig.provider];

export const sentimentProvider: SentimentDataProvider = {
  async getSnapshot(instrument: Instrument) {
    const cachedSnapshot = await getFirestoreCachedSentimentSnapshot(instrument);

    if (cachedSnapshot) {
      return cachedSnapshot;
    }

    try {
      return await selectedRemoteProvider.getSnapshot(instrument);
    } catch (error) {
      const reason = error instanceof Error ? error.message : "unknown-error";
      const firestoreFallback = await getFirestoreFallbackSentimentSnapshot(instrument);

      if (firestoreFallback) {
        await writeSystemLog({
          level: "warning",
          scope: "sentiment-provider",
          message: "Sentiment provider failed, using Firestore fallback snapshot",
          details: {
            ticker: instrument.ticker,
            provider: sentimentProviderConfig.provider,
            reason,
          },
        }).catch(() => undefined);

        return firestoreFallback;
      }

      const mockFallback = await mockSentimentProvider.getSnapshot(instrument);

      await writeSystemLog({
        level: "error",
        scope: "sentiment-provider",
        message: "Sentiment provider failed and no Firestore fallback snapshot was available",
        details: {
          ticker: instrument.ticker,
          provider: sentimentProviderConfig.provider,
          reason,
        },
      }).catch(() => undefined);

      return {
        ...mockFallback,
        freshness: {
          mode: "fallback",
          updatedAt: mockFallback.updatedAt,
          note: "Sentiment API failed and no Firestore snapshot was available; using mock contrarian fallback",
        },
      };
    }
  },
};