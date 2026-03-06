import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <main className="grid min-h-screen place-items-center p-6">
      <div className="absolute inset-0 grid-surface opacity-70" />
      <div className="relative w-full max-w-md rounded-3xl border border-white/10 bg-panel/90 p-8 shadow-glow backdrop-blur">
        <div className="mb-8 space-y-3">
          <span className="inline-flex rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.24em] text-blue-200">
            MSM1
          </span>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-white">Trading intelligence dashboard</h1>
            <p className="mt-2 text-sm text-muted">
              Secure access for the MSM1 analysis workspace.
            </p>
          </div>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}