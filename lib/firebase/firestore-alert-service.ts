import "server-only";

import { firestoreCollections } from "@/lib/config/firestore";
import { adminDb } from "@/lib/firebase/admin";
import type { FirestoreOilAlertHistoryDocument, FirestoreOilAlertStateDocument } from "@/lib/types/firestore";

export async function getOilAlertState(alertId: string) {
  const db = adminDb;
  if (!db) return null;

  const snapshot = await db.collection(firestoreCollections.alertState).doc(alertId).get();
  if (!snapshot.exists) return null;

  return snapshot.data() as FirestoreOilAlertStateDocument;
}

export async function getLatestOilAlertHistory(alertId: string, limit = 10) {
  const db = adminDb;
  if (!db) return null;

  const snapshot = await db.collection(firestoreCollections.alertHistory).orderBy("createdAt", "desc").limit(limit).get();
  const entry = snapshot.docs.map((doc) => doc.data() as FirestoreOilAlertHistoryDocument).find((item) => item.alertId === alertId);

  return entry ?? null;
}

export async function writeOilAlertState(alertId: string, state: FirestoreOilAlertStateDocument) {
  const db = adminDb;
  if (!db) return;

  await db.collection(firestoreCollections.alertState).doc(alertId).set(state);
}

export async function appendOilAlertHistory(entry: Omit<FirestoreOilAlertHistoryDocument, "createdAt"> & { createdAt?: string }) {
  const db = adminDb;
  if (!db) return;

  const payload: FirestoreOilAlertHistoryDocument = {
    ...entry,
    createdAt: entry.createdAt ?? new Date().toISOString(),
  };

  await db.collection(firestoreCollections.alertHistory).add(payload);
}