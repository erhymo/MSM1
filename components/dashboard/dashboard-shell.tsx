"use client";

import { Activity, BellDot, FileText, LogOut, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { InstrumentDetailModal } from "@/components/dashboard/instrument-detail-modal";
import { InstrumentGrid } from "@/components/dashboard/instrument-grid";
import { OilAlertSection } from "@/components/dashboard/oil-alert-section";
import { SystemStatus } from "@/components/dashboard/system-status";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { getCurrencyConcentration, getPositionRisk, readStoredPositions, type StoredPositions } from "@/lib/client/position-risk";
import type { AnalysisResult, OilAlertDashboardSummary, SystemStatusItem } from "@/lib/types/analysis";
import { compareAnalysisResults, formatNok } from "@/lib/utils/format";

type DashboardShellProps = {
  analyses: AnalysisResult[];
  statusItems: SystemStatusItem[];
  oilAlert?: OilAlertDashboardSummary | null;
};

export function DashboardShell({ analyses, statusItems, oilAlert }: DashboardShellProps) {
  const [selected, setSelected] = useState<AnalysisResult | null>(null);
  const [positions, setPositions] = useState<StoredPositions>({});
  const { user, signOut, loading, initializing } = useAuth();
  const rankedAnalyses = useMemo(() => [...analyses].sort(compareAnalysisResults), [analyses]);

  useEffect(() => {
    setPositions(readStoredPositions());
  }, []);

  const fallbackCount = useMemo(
    () => rankedAnalyses.filter((item) => item.freshness.mode === "fallback").length,
    [rankedAnalyses],
  );

  const liveCount = rankedAnalyses.length - fallbackCount;
  const actionableCount = useMemo(
    () => rankedAnalyses.filter((item) => item.tacticalSignal?.action === "ENTER_LONG" || item.tacticalSignal?.action === "ENTER_SHORT").length,
    [rankedAnalyses],
  );
  const positionRiskSummary = useMemo(() => {
    const risks = rankedAnalyses.map((analysis) => getPositionRisk(analysis, positions[analysis.instrument.ticker])).filter((risk) => risk.isOpen);
    const totalPnlNok = risks.reduce((sum, risk) => sum + (risk.pnlNok ?? 0), 0);
    return {
      risks,
      openCount: risks.length,
      warningCount: risks.filter((risk) => risk.severity === "warning").length,
      dangerCount: risks.filter((risk) => risk.severity === "danger").length,
      totalPnlNok,
      concentration: getCurrencyConcentration(rankedAnalyses, positions),
    };
  }, [positions, rankedAnalyses]);

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <div className="mx-auto max-w-[1600px] space-y-8">
        <header className="grid gap-5 rounded-[30px] border border-white/10 bg-panel/80 p-6 shadow-glow backdrop-blur xl:grid-cols-[1.55fr_1fr] xl:p-7">
          <div>
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <Badge className="bg-blue-500/10 text-blue-100">MSM1</Badge>
              <Badge className="bg-emerald-500/10 text-emerald-100">{rankedAnalyses.length} instruments</Badge>
              <Badge className="bg-cyan-500/10 text-cyan-100">{actionableCount} tactical entries</Badge>
              <Badge className={fallbackCount > 0 ? "bg-amber-500/10 text-amber-100" : "bg-emerald-500/10 text-emerald-100"}>
                {fallbackCount > 0 ? `${fallbackCount} fallback` : "All feeds live"}
              </Badge>
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-[2.1rem]">Trading dashboard</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
              Action-first decision support: tactical entries and risk management lead, while swing bias remains the broader 1–3 week backdrop.
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <HeaderStat label="Action now" value={String(actionableCount)} detail="Tactical ENTER setups lead the stack before slower swing watchlist ideas." />
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
              <HeaderStat label="Ranking" value="Action first" detail="ENTER first, then HOLD, WAIT, TAKE PROFIT, EXIT and AVOID." compact />
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
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href="/reports"
                  className="inline-flex items-center gap-2 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm text-cyan-100 transition hover:bg-cyan-400/15"
                >
                  <FileText className="h-4 w-4" />
                  Rapport
                </Link>
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
          </div>
        </header>

        {positionRiskSummary.openCount > 0 ? (
          <section className="rounded-[28px] border border-amber-300/20 bg-amber-500/10 p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-[0.2em] text-amber-100/80">Position Risk Guard</p>
                <h2 className="mt-2 text-xl font-semibold text-white">
                  {positionRiskSummary.dangerCount > 0 ? "Åpne posisjoner trenger handling" : "Åpne posisjoner overvåkes"}
                </h2>
                <p className="mt-2 text-sm leading-6 text-amber-50/85">
                  {positionRiskSummary.openCount} registrerte posisjoner · {positionRiskSummary.dangerCount} danger · {positionRiskSummary.warningCount} warning · estimert P/L {formatNok(positionRiskSummary.totalPnlNok)}
                  {positionRiskSummary.concentration ? ` · største valutaeksponering: ${positionRiskSummary.concentration[0]} (${positionRiskSummary.concentration[1] > 0 ? "+" : ""}${positionRiskSummary.concentration[1]})` : ""}
                </p>
              </div>
              <Badge className={positionRiskSummary.dangerCount > 0 ? "bg-rose-500/20 text-rose-50" : "bg-amber-500/20 text-amber-50"}>
                {positionRiskSummary.dangerCount > 0 ? "Risk alert" : "Watch positions"}
              </Badge>
            </div>
          </section>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[1.7fr_0.9fr]">
          <section className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-white">Ranked instruments</h2>
                <p className="text-sm leading-6 text-muted">Best tactical actions appear first; swing Buy is no longer enough by itself to top the list.</p>
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

      <InstrumentDetailModal analysis={selected} open={Boolean(selected)} onClose={() => { setSelected(null); setPositions(readStoredPositions()); }} />
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