"use client";

import { AlertCircle, Loader2, LockKeyhole, Mail } from "lucide-react";
import { useState } from "react";

import { useAuth } from "@/hooks/use-auth";
import { isFirebaseConfigured } from "@/lib/firebase/config";

export function LoginForm() {
  const { signIn, loading, initializing } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    try {
      await signIn(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in.");
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      {!isFirebaseConfigured ? (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-100">
          Add Firebase environment variables before signing in.
        </div>
      ) : null}

      <label className="block space-y-2">
        <span className="text-sm font-medium text-slate-200">Email</span>
        <div className="flex items-center rounded-2xl border border-white/10 bg-white/[0.03] px-4">
          <Mail className="h-4 w-4 text-muted" />
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full bg-transparent px-3 py-3 text-sm text-white outline-none placeholder:text-slate-500"
            placeholder="name@msm1.io"
            autoComplete="email"
            required
          />
        </div>
      </label>

      <label className="block space-y-2">
        <span className="text-sm font-medium text-slate-200">Password</span>
        <div className="flex items-center rounded-2xl border border-white/10 bg-white/[0.03] px-4">
          <LockKeyhole className="h-4 w-4 text-muted" />
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full bg-transparent px-3 py-3 text-sm text-white outline-none placeholder:text-slate-500"
            placeholder="••••••••"
            autoComplete="current-password"
            required
          />
        </div>
      </label>

      {error ? (
        <div className="flex items-start gap-2 rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-100">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-none" />
          <span>{error}</span>
        </div>
      ) : null}

      <button
        type="submit"
        disabled={loading || initializing || !isFirebaseConfigured}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-slate-700"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {initializing ? "Checking session..." : loading ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}