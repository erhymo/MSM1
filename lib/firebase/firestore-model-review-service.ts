import "server-only";

import { modelReviewConfig } from "@/lib/config/model-review";
import { firestoreCollections } from "@/lib/config/firestore";
import { adminDb } from "@/lib/firebase/admin";
import type {
  FirestoreModelReviewReportDocument,
  FirestoreRawMarketDataDocument,
  FirestoreRecommendationAuditDocument,
} from "@/lib/types/firestore";

const maxFirestoreBatchWrites = 450;

function toAuditId(ticker: string, createdAt: string) {
  return `${ticker}-${createdAt.replace(/[:.]/g, "-")}`;
}

export function buildRecommendationAuditId(ticker: string, createdAt: string) {
  return toAuditId(ticker, createdAt);
}

export async function getRecentRecommendationAudits(lookbackHours: number) {
  const db = adminDb;
  if (!db) return [];

  const cutoff = new Date(Date.now() - lookbackHours * 60 * 60 * 1000).toISOString();
  const snapshot = await db
    .collection(firestoreCollections.recommendationAudits)
    .where("createdAt", ">=", cutoff)
    .orderBy("createdAt", "desc")
    .limit(modelReviewConfig.maxAuditsPerRun)
    .get();

  return snapshot.docs.map((doc) => doc.data() as FirestoreRecommendationAuditDocument);
}

export async function getStoredPriceEntriesSince(ticker: string, sinceIso: string, limit = 160) {
  const db = adminDb;
  if (!db) return [];

  const snapshot = await db
    .collection(firestoreCollections.rawMarketData)
    .doc(ticker)
    .collection("entries")
    .orderBy("capturedAt", "asc")
    .startAt(sinceIso)
    .limit(limit)
    .get();

  return snapshot.docs
    .map((doc) => doc.data() as FirestoreRawMarketDataDocument)
    .filter((entry) => entry.category === "price");
}

export async function writeRecommendationAuditUpdates(audits: FirestoreRecommendationAuditDocument[]) {
  const db = adminDb;
  if (!db || !audits.length) return;

  const firestore = db;
  let batch = firestore.batch();
  let writeCount = 0;

  async function commitBatch() {
    if (!writeCount) return;
    await batch.commit();
    batch = firestore.batch();
    writeCount = 0;
  }

  for (const audit of audits) {
    const ref = firestore.collection(firestoreCollections.recommendationAudits).doc(audit.auditId || toAuditId(audit.ticker, audit.createdAt));
    batch.set(ref, audit, { merge: true });
    writeCount += 1;

    if (writeCount >= maxFirestoreBatchWrites) {
      await commitBatch();
    }
  }

  await commitBatch();
}

export async function writeModelReviewReport(report: FirestoreModelReviewReportDocument) {
  const db = adminDb;
  if (!db) return;

  await db.collection(firestoreCollections.modelReviewReports).doc(report.reportId).set(report, { merge: true });
}

export async function getLatestModelReviewReport() {
  const db = adminDb;
  if (!db) return null;

  const snapshot = await db.collection(firestoreCollections.modelReviewReports).orderBy("generatedAt", "desc").limit(1).get();
  return snapshot.empty ? null : (snapshot.docs[0]?.data() as FirestoreModelReviewReportDocument);
}
