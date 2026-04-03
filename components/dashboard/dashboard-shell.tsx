"use client";

import { Activity, BellDot, LogOut, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";

import { InstrumentDetailModal } from "@/components/dashboard/instrument-detail-modal";
import { InstrumentGrid } from "@/components/dashboard/instrument-grid";
import { OilAlertSection } from "@/components/dashboard/oil-alert-section";
import { SystemStatus } from "@/components/dashboard/system-status";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import type { AnalysisResult, OilAlertDashboardSummary, SystemStatusItem } from "@/lib/types/analysis";
import { compareAnalysisResults } from "@/lib/utils/format";

type DashboardShellProps = {
  analyses: AnalysisResult[];
  statusItems: SystemStatusItem[];
  oilAlert?: OilAlertDashboardSummary | null;
};

export function DashboardShell({ analyses, statusItems, oilAlert }: DashboardShellProps) {
  const [selected, setSelected] = useState<AnalysisResult | null>(null);
  const { user, signOut, loading, initializing } = useAuth();
  const rankedAnalyses = useMemo(() => [...analyses].sort(compareAnalysisResults), [analyses]);

  const fallbackCount = useMemo(
    () => rankedAnalyses.filter((item) => item.freshness.mode === "fallback").length,
    [rankedAnalyses],
  );

  const liveCount = rankedAnalyses.length - fallbackCount;
  const actionableCount = useMemo(
    () => rankedAnalyses.filter((item) => item.signal === "BUY" || item.signal === "STRONG_BUY").length,
    [rankedAnalyses],
  );

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <div className="mx-auto max-w-[1600px] space-y-8">
        <header className="grid gap-5 rounded-[30px] border border-white/10 bg-panel/80 p-6 shadow-glow backdrop-blur xl:grid-cols-[1.55fr_1fr] xl:p-7">
          <div>
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <Badge className="bg-blue-500/10 text-blue-100">MSM1</Badge>
              <Badge className="bg-emerald-500/10 text-emerald-100">{rankedAnalyses.length} instruments</Badge>
              <Badge className="bg-cyan-500/10 text-cyan-100">{actionableCount} actionable buys</Badge>
              <Badge className={fallbackCount > 0 ? "bg-amber-500/10 text-amber-100" : "bg-emerald-500/10 text-emerald-100"}>
                {fallbackCount > 0 ? `${fallbackCount} fallback` : "All feeds live"}
              </Badge>
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-[2.1rem]">Trading dashboard</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
              Ranked 1–3 week decision support with provider-backed pricing, weekly COT bias, contrarian retail sentiment, Firestore fallback and cleaner trade-plan detail.
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <HeaderStat label="Actionable" value={String(actionableCount)} detail="Strong buy and buy setups lead the stack." />
              <HeaderStat label="Live coverage" value={String(liveCount)} detail="Primary providers delivered fresh snapshots." />
              <HeaderStat
                label="Fallback"
                value={String(fallbackCount)}
                detail={fallbackCount > 0 ? "Stored snapshots are surfaced clearly in card and modal status." : "No stored fallback inputs currently needed."}
              />
            </div>
          </div>

          <div className="flex flex-col justify-between gap-5 rounded-[28px] border border-white/10 bg-white/[0.03] p-5">
            <div className="flex items-center gap-3 text-sm text-slate-200">
              <ShieldCheck className="h-4 w-4 text-emerald-300" />
              <span>{user?.email ?? "Authenticated workspace"}</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <HeaderStat label="Ranking" value="Buys first" detail="Then hold, wait, no trade and bearish signals." compact />
              <HeaderStat
                label="Cadence"
                value="3h / weekly"
                detail="Price refreshes regularly while COT and sentiment reuse fresh cached snapshots."
                compact
              />
            </div>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 text-sm text-slate-300">
                <BellDot className="h-4 w-4 text-blue-300" />
                {initializing ? "Syncing authenticated session" : "Scheduled runner and provider fallback active"}
              </div>
              <button
                type="button"
                onClick={() => void signOut()}
                disabled={loading || initializing}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/10 px-4 py-2 text-sm text-slate-200 transition hover:bg-white/5 disabled:opacity-60"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </div>
          </div>
        </header>

        <div className="grid gap-6 xl:grid-cols-[1.7fr_0.9fr]">
          <section className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-white">Ranked instruments</h2>
                <p className="text-sm leading-6 text-muted">Best buy opportunities appear first, followed by the rest of the signal stack.</p>
              </div>
              <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-slate-300 lg:flex">
                <Activity className="h-3.5 w-3.5 text-cyan-300" />
                Presentation ranking applied client-side
              </div>
            </div>
            <InstrumentGrid analyses={rankedAnalyses} onSelect={setSelected} />
          </section>

          <aside className="space-y-6">
            <OilAlertSection oilAlert={oilAlert} />
            <SystemStatus items={statusItems} />
          </aside>
        </div>
      </div>

      <InstrumentDetailModal analysis={selected} open={Boolean(selected)} onClose={() => setSelected(null)} />
    </main>
  );
}

function HeaderStat({
  label,
  value,
  detail,
  compact = false,
}: {
  label: string;
  value: string;
  detail: string;
  compact?: boolean;
}) {
  return (
    <div className={compact ? "rounded-2xl border border-white/10 bg-black/10 p-3" : "rounded-3xl border border-white/10 bg-black/10 p-4"}>
      <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">{label}</p>
      <p className="mt-2 text-lg font-semibold text-white">{value}</p>
      <p className="mt-1 text-xs leading-5 text-slate-300">{detail}</p>
    </div>
  );
}