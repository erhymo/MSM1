import { BellDot, Clock3, Newspaper, TrendingDown, TrendingUp } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { OilAlertDashboardDecision, OilAlertDashboardSummary } from "@/lib/types/analysis";
import { cn } from "@/lib/utils/cn";
import { formatPercent, formatPrice, formatRelativeTime } from "@/lib/utils/format";

const decisionLabels: Record<OilAlertDashboardDecision, string> = {
  disabled: "Disabled",
  "not-seeded": "Not seeded",
  seeded: "Seeded",
  "skipped-non-live-price": "Waiting for live price",
  "skipped-stale-price": "Price too old",
  "skipped-stale-polymarket": "Markets too old",
  "insufficient-move": "Below move threshold",
  "insufficient-confidence": "Below confidence threshold",
  cooldown: "Cooldown",
  duplicate: "Duplicate",
  triggered: "Triggered",
};

function formatWhen(isoDate?: string) {
  if (!isoDate) return "—";
  const diffMs = new Date(isoDate).getTime() - Date.now();
  if (diffMs <= 0) return formatRelativeTime(isoDate);

  const diffMinutes = Math.max(1, Math.round(diffMs / 60000));
  if (diffMinutes < 60) return `in ${diffMinutes}m`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `in ${diffHours}h`;
  return `in ${Math.round(diffHours / 24)}d`;
}

function getStatusLabel(oilAlert?: OilAlertDashboardSummary | null) {
  if (!oilAlert) return "Unavailable";
  if (!oilAlert.enabled) return "Paused";
  if (oilAlert.decision === "not-seeded") return "Awaiting seed";
  if (oilAlert.decision === "skipped-stale-price" || oilAlert.decision === "skipped-stale-polymarket") return "Blocked by freshness";
  if (oilAlert.cooldownUntil && new Date(oilAlert.cooldownUntil).getTime() > Date.now()) return "Cooldown";
  if (oilAlert.decision === "triggered") return "Triggered";
  return "Monitoring";
}

function getActionLabel(oilAlert?: OilAlertDashboardSummary | null) {
  if (!oilAlert?.enabled) return "WAIT";
  if (oilAlert.decision === "triggered" && oilAlert.direction === "bullish") return "BUY OIL";
  if (oilAlert.decision === "triggered" && oilAlert.direction === "bearish") return "SELL OIL";
  return "WAIT";
}

function getActionTone(oilAlert?: OilAlertDashboardSummary | null) {
  const action = getActionLabel(oilAlert);
  if (action === "BUY OIL") return "text-emerald-300";
  if (action === "SELL OIL") return "text-rose-300";
  return "text-slate-100";
}

function getActionSummary(oilAlert?: OilAlertDashboardSummary | null) {
  if (!oilAlert) return "Oil alert-data kunne ikke lastes akkurat nå.";
  if (!oilAlert.enabled) return "Oil alert-motoren er pauset.";
  if (oilAlert.decision === "triggered" && oilAlert.direction === "bullish") return `Bullish oil signal med ${oilAlert.confidence}/100 confidence.`;
  if (oilAlert.decision === "triggered" && oilAlert.direction === "bearish") return `Bearish oil signal med ${oilAlert.confidence}/100 confidence.`;
  if (oilAlert.decision === "not-seeded" || oilAlert.decision === "seeded") return "Bygger første baseline før klare olje-signaler kan vises.";
  if (oilAlert.decision === "skipped-stale-price") return "Venter på ferskere Brent-data før signal kan vurderes.";
  if (oilAlert.decision === "skipped-stale-polymarket") return "Venter på ferskere Polymarket-bekreftelse før signal kan vurderes.";
  if (oilAlert.decision === "insufficient-move") return "Brent-bevegelsen er ikke sterk nok ennå.";
  if (oilAlert.decision === "insufficient-confidence") return "Signalet er ikke sterkt nok ennå.";
  if (oilAlert.decision === "cooldown") return "Forrige olje-signal er fortsatt i cooldown.";
  if (oilAlert.decision === "duplicate") return "Samme oljescenario ble allerede registrert nylig.";
  return "Overvåker for neste klare olje-signal.";
}

function getActionSubline(oilAlert?: OilAlertDashboardSummary | null) {
  if (!oilAlert) return "Ingen lastet state.";

  const parts = [`Confidence ${oilAlert.confidence}/100`];
  if (oilAlert.price) {
    parts.push(`Brent ${formatPercent(oilAlert.price.movePercent, 1)}`);
  }
  parts.push(`Updated ${formatWhen(oilAlert.lastRunAt ?? oilAlert.lastObservedAt)}`);
  return parts.join(" • ");
}

function getDirectionLabel(direction: OilAlertDashboardSummary["direction"]) {
  if (direction === "bullish") return "Bullish oil";
  if (direction === "bearish") return "Bearish oil";
  return "No active bias";
}

function getStatusTone(oilAlert?: OilAlertDashboardSummary | null) {
  if (!oilAlert) return "bg-white/5 text-slate-200";
  if (!oilAlert.enabled) return "bg-slate-500/10 text-slate-200";
  if (oilAlert.decision === "triggered") return oilAlert.direction === "bearish" ? "bg-rose-500/10 text-rose-100" : "bg-emerald-500/10 text-emerald-100";
  if (oilAlert.decision === "skipped-stale-price" || oilAlert.decision === "skipped-stale-polymarket") return "bg-amber-500/10 text-amber-100";
  if (oilAlert.decision === "cooldown") return "bg-amber-500/10 text-amber-100";
  return "bg-cyan-500/10 text-cyan-100";
}

function signalDetail(oilAlert: OilAlertDashboardSummary, index: number) {
  const signal = oilAlert.topSignals[index];
  if (!signal) return "";
  if (typeof signal.deltaPp === "number") return `${formatPercent(signal.yesProbability * 100, 1)} yes • ${signal.deltaPp >= 0 ? "+" : ""}${signal.deltaPp.toFixed(1)} pp`;
  return `${formatPercent(signal.yesProbability * 100, 1)} yes`;
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/10 p-3">
      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="mt-2 text-base font-semibold text-white">{value}</p>
      <p className="mt-1 text-xs leading-5 text-slate-300">{detail}</p>
    </div>
  );
}

export function OilAlertSection({ oilAlert }: { oilAlert?: OilAlertDashboardSummary | null }) {
  const statusLabel = getStatusLabel(oilAlert);
  const actionLabel = getActionLabel(oilAlert);

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-white">Oil Alerts</h2>
          <p className="text-sm text-muted">Brent, Polymarket og headline-laget samlet i én kompakt operatørvisning.</p>
        </div>
        <BellDot className="h-5 w-5 text-cyan-300" />
      </div>

      {!oilAlert ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] p-4 text-sm text-slate-300">
          Oil alert-data kunne ikke lastes uten å forsinke dashboard-renderen.
        </div>
      ) : (
        <div className="space-y-4">
          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Recommendation</p>
                <p className={cn("mt-2 text-3xl font-semibold tracking-tight", getActionTone(oilAlert))}>{actionLabel}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge className={cn("border-transparent", getStatusTone(oilAlert))}>{statusLabel}</Badge>
                {oilAlert.liveInputs ? <Badge className="bg-emerald-500/10 text-emerald-100">Live inputs</Badge> : null}
              </div>
            </div>

            <p className="mt-3 text-sm leading-6 text-slate-200">{getActionSummary(oilAlert)}</p>
            <p className="mt-1 text-xs leading-5 text-slate-400">{getActionSubline(oilAlert)}</p>
          </section>

          <p className="text-xs leading-6 text-slate-400">Engine detail: {oilAlert.reason}</p>

          <div className="grid gap-3 sm:grid-cols-2">
            <Metric label="Action" value={actionLabel} detail={`${getDirectionLabel(oilAlert.direction)} • ${decisionLabels[oilAlert.decision]}`} />
            <Metric label="Confidence" value={`${oilAlert.confidence}/100`} detail={oilAlert.enabled ? "Composite score from price, Polymarket and news." : "Engine is currently disabled."} />
            <Metric
              label="Brent"
              value={oilAlert.price ? formatPrice(oilAlert.price.current) : "—"}
              detail={oilAlert.price ? `${formatPercent(oilAlert.price.movePercent, 1)} move • ${oilAlert.price.source}` : "Waiting for first stored live price."}
            />
            <Metric
              label="Last run"
              value={formatWhen(oilAlert.lastRunAt ?? oilAlert.lastObservedAt)}
              detail={oilAlert.cooldownUntil ? `Cooldown ${formatWhen(oilAlert.cooldownUntil)}` : oilAlert.lastSentAt ? `Last email ${formatWhen(oilAlert.lastSentAt)}` : "No alert email sent yet."}
            />
          </div>

          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Top drivers</p>
              {oilAlert.price ? <p className="text-xs text-slate-400">Updated {formatWhen(oilAlert.price.updatedAt)}</p> : null}
            </div>
            <div className="space-y-2.5">
              {oilAlert.topSignals.length ? (
                oilAlert.topSignals.slice(0, 3).map((signal, index) => (
                  <div key={signal.marketId} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-black/10 p-3">
                    {signal.impliedDirection === "bearish" ? <TrendingDown className="mt-0.5 h-4 w-4 text-rose-300" /> : <TrendingUp className="mt-0.5 h-4 w-4 text-emerald-300" />}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-white">{signal.label}</p>
                      <p className="mt-1 text-xs leading-5 text-slate-300">{signalDetail(oilAlert, index) || signal.question}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-300">Waiting for the first stored oil alert run before drivers can be ranked.</p>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Headline layer</p>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Newspaper className="h-3.5 w-3.5" />
                News score {oilAlert.newsScore}
              </div>
            </div>
            {oilAlert.topHeadlines.length ? (
              <div className="space-y-2.5">
                {oilAlert.topHeadlines.slice(0, 2).map((headline) => (
                  <div key={headline.url} className="rounded-2xl border border-white/10 bg-black/10 p-3">
                    <p className="text-sm font-medium text-white">{headline.title}</p>
                    <p className="mt-1 text-xs text-slate-300">{headline.domain} • {formatWhen(headline.publishedAt)}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-slate-300">
                <Clock3 className="h-4 w-4 text-slate-400" />
                No matched headlines on the latest stored run.
              </div>
            )}
          </section>
        </div>
      )}
    </Card>
  );
}