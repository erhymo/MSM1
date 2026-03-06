import { getApp, getApps, initializeApp } from "firebase/app";
import { browserLocalPersistence, getAuth, setPersistence } from "firebase/auth";

import { firebaseConfig, isFirebaseConfigured } from "@/lib/firebase/config";

export const firebaseApp = isFirebaseConfigured
  ? getApps().length
    ? getApp()
    : initializeApp(firebaseConfig)
  : null;

export const auth = firebaseApp ? getAuth(firebaseApp) : null;

export async function ensureAuthPersistence() {
  if (!auth) return;
  await setPersistence(auth, browserLocalPersistence);
}