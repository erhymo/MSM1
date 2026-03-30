"use client";

import { onAuthStateChanged, signInWithEmailAndPassword, signOut as firebaseSignOut, type User } from "firebase/auth";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { getFirebaseAuthErrorMessage } from "@/lib/firebase/auth-errors";
import { auth, ensureAuthPersistence } from "@/lib/firebase/client";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { clearSessionCookie, setSessionCookie } from "@/lib/firebase/session";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  initializing: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    if (!isFirebaseConfigured || !auth) {
      setInitializing(false);
      return;
    }

    void ensureAuthPersistence();

    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      setInitializing(false);

      try {
        if (nextUser) {
          await setSessionCookie();
        } else {
          await clearSessionCookie();
        }
      } catch {
        // Cookie sync is best-effort in Phase 1B.
      }
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (initializing || !isFirebaseConfigured) {
      return;
    }

    if (user && pathname.startsWith("/login")) {
      router.replace("/dashboard");
      return;
    }

    if (!user && pathname.startsWith("/dashboard")) {
      router.replace("/login");
    }
  }, [initializing, pathname, router, user]);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!auth || !isFirebaseConfigured) {
      throw new Error("Firebase Auth is not configured.");
    }

    setLoading(true);

    try {
      await ensureAuthPersistence();
      await signInWithEmailAndPassword(auth, email, password);
      await setSessionCookie();
      router.replace("/dashboard");
    } catch (error) {
      throw new Error(getFirebaseAuthErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [router]);

  const signOut = useCallback(async () => {
    setLoading(true);

    try {
      if (auth) {
        await firebaseSignOut(auth);
      }

      setUser(null);
      await clearSessionCookie();
      router.replace("/login");
    } finally {
      setLoading(false);
    }
  }, [router]);

  const value = useMemo(
    () => ({ user, loading, initializing, signIn, signOut }),
    [initializing, loading, signIn, signOut, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }

  return context;
}