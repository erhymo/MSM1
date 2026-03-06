import "server-only";

import { cert, getApp, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

import { firebaseAdminConfig, isFirebaseAdminConfigured } from "@/lib/firebase/config";

const adminServiceAccount = isFirebaseAdminConfigured
  ? {
      projectId: firebaseAdminConfig.projectId!,
      clientEmail: firebaseAdminConfig.clientEmail!,
      privateKey: firebaseAdminConfig.privateKey!,
    }
  : null;

export const adminApp = adminServiceAccount
  ? getApps().length
    ? getApp()
    : initializeApp({
        credential: cert(adminServiceAccount),
        projectId: adminServiceAccount.projectId,
      })
  : null;

export const adminAuth = adminApp ? getAuth(adminApp) : null;
export const adminDb = adminApp ? getFirestore(adminApp) : null;