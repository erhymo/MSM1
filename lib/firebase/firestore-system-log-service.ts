import "server-only";

import { adminDb } from "@/lib/firebase/admin";
import { firestoreCollections } from "@/lib/config/firestore";
import type { FirestoreSystemLogDocument } from "@/lib/types/firestore";

export async function writeSystemLog(
  entry: Omit<FirestoreSystemLogDocument, "createdAt"> & { createdAt?: string },
) {
  const db = adminDb;
  if (!db) return;

  const payload: FirestoreSystemLogDocument = {
    ...entry,
    createdAt: entry.createdAt ?? new Date().toISOString(),
  };

  await db.collection(firestoreCollections.systemLogs).add(payload);
}

export async function getRecentSystemLogs(limit = 6) {
  const db = adminDb;
  if (!db) return [];

  const snapshot = await db.collection(firestoreCollections.systemLogs).orderBy("createdAt", "desc").limit(limit).get();
  return snapshot.docs.map((doc) => doc.data() as FirestoreSystemLogDocument);
}
