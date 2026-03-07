import "server-only";

import { firestoreAnalysisConfig, firestoreCollections } from "@/lib/config/firestore";
import { adminDb } from "@/lib/firebase/admin";
import type { FirestoreRawMarketDataDocument, RawMarketDataCategory } from "@/lib/types/firestore";
import { writeSystemLog } from "@/lib/firebase/firestore-system-log-service";

const rawMarketCategoryLookupLimit = Math.max(
  firestoreAnalysisConfig.historyLimit,
  Math.ceil((8 * 24) / firestoreAnalysisConfig.staleAfterHours) * 4,
);

function toDocId(entry: FirestoreRawMarketDataDocument) {
  return `${entry.category}-${entry.capturedAt.replace(/[:.]/g, "-")}`;
}

export async function storeRawMarketData(entries: FirestoreRawMarketDataDocument[]) {
  const db = adminDb;
  if (!db || !entries.length) return;

  const batch = db.batch();

  entries.forEach((entry) => {
    const ref = db
      .collection(firestoreCollections.rawMarketData)
      .doc(entry.ticker)
      .collection("entries")
      .doc(toDocId(entry));

    batch.set(ref, entry, { merge: true });
  });

  await batch.commit();

  await writeSystemLog({
    level: "info",
    scope: "raw-market-data",
    message: "Stored raw market data snapshot batch",
    details: {
      entries: entries.length,
      historyLimit: firestoreAnalysisConfig.historyLimit,
    },
  });
}

export async function getLatestRawMarketData(ticker: string, limit: number = firestoreAnalysisConfig.historyLimit) {
  const db = adminDb;
  if (!db) return [];

  const snapshot = await db
    .collection(firestoreCollections.rawMarketData)
    .doc(ticker)
    .collection("entries")
    .orderBy("capturedAt", "desc")
    .limit(limit)
    .get();

  return snapshot.docs.map((doc) => doc.data() as FirestoreRawMarketDataDocument);
}

export async function getLatestRawMarketDataForTickers(tickers: string[], limit: number = 4) {
  const entries = await Promise.all(tickers.map((ticker) => getLatestRawMarketData(ticker, limit)));
  return entries.flat();
}

export async function getLatestRawMarketEntry(ticker: string, category: RawMarketDataCategory) {
  const entries = await getLatestRawMarketData(ticker, rawMarketCategoryLookupLimit);
  return entries.find((entry) => entry.category === category) ?? null;
}

export async function getLatestRawMarketEntriesForTickers(tickers: string[], categories: RawMarketDataCategory[]) {
  const entriesByTicker = await Promise.all(tickers.map((ticker) => getLatestRawMarketData(ticker, rawMarketCategoryLookupLimit)));

  return entriesByTicker.flatMap((entries) =>
    categories.flatMap((category) => {
      const latestEntry = entries.find((entry) => entry.category === category);
      return latestEntry ? [latestEntry] : [];
    }),
  );
}
