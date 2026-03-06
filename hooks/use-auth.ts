"use client";

import { useAuthContext } from "@/lib/firebase/auth-provider";

export function useAuth() {
  return useAuthContext();
}