import { Activity, ChevronRight, Clock3, ShieldAlert, Target, TrendingUp } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { AnalysisResult, TacticalAction } from "@/lib/types/analysis";
import { cn } from "@/lib/utils/cn";
import { formatApproxNokPrice, formatPercent, formatPrice, formatRelativeTime, SIGNAL_LABELS, TACTICAL_LABELS } from "@/lib/utils/format";

const signalTone: Record<
  AnalysisResult["signal"],
  {
    card: string;
    badge: string;
    glow: string;
  }
> = {
  STRONG_BUY: {
    card: "border-emerald-400/25 bg-emerald-500/[0.08]",
    badge: "border-emerald-300/30 bg-emerald-400/15 text-emerald-50",
    glow: "from-emerald-400/20",
  },
  BUY: {
    card: "border-green-400/25 bg-green-500/[0.08]",
    badge: "border-green-300/30 bg-green-400/15 text-green-50",
    glow: "from-green-400/18",
  },
  WAIT: {
    card: "border-amber-400/20 bg-amber-500/[0.06]",
    badge: "border-amber-300/25 bg-amber-400/12 text-amber-50",
    glow: "from-amber-400/14",
  },
  HOLD: {
    card: "border-blue-400/20 bg-blue-500/[0.06]",
    badge: "border-blue-300/25 bg-blue-400/12 text-blue-50",
    glow: "from-blue-400/14",
  },
  SELL: {
    card: "border-rose-400/20 bg-rose-500/[0.07]",
    badge: "border-rose-300/25 bg-rose-400/12 text-rose-50",
    glow: "from-rose-400/14",
  },
  STRONG_SELL: {
    card: "border-red-500/25 bg-red-500/[0.08]",
    badge: "border-red-300/25 bg-red-400/12 text-red-50",
    glow: "from-red-400/16",
  },
  NO_TRADE: {
    card: "border-slate-400/15 bg-slate-500/[0.05]",
    badge: "border-slate-300/20 bg-slate-400/10 text-slate-100",
    glow: "from-slate-300/10",
  },
};

const tacticalTone: Record<TacticalAction, string> = {
  ENTER_LONG: "border-emerald-300/30 bg-emerald-400/15 text-emerald-50",
  ENTER_SHORT: "border-red-300/25 bg-red-400/12 text-red-50",
  HOLD: "border-blue-300/25 bg-blue-400/12 text-blue-50",
  WAIT: "border-amber-300/25 bg-amber-400/12 text-amber-50",
  TAKE_PROFIT: "border-cyan-300/25 bg-cyan-400/12 text-cyan-50",
  EXIT: "border-rose-300/25 bg-rose-400/12 text-rose-50",
  AVOID: "border-slate-300/20 bg-slate-400/10 text-slate-100",
};

type InstrumentCardProps = {
  analysis: AnalysisResult;
  onSelect: (analysis: AnalysisResult) => void;
};

export function InstrumentCard({ analysis, onSelect }: InstrumentCardProps) {
  const freshnessClass =
    analysis.freshness.mode === "live"
      ? "border-emerald-400/15 bg-emerald-500/10 text-emerald-100"
      : "border-amber-400/20 bg-amber-500/10 text-amber-100";
  const confidenceTone =
    analysis.confidence >= 75
      ? "bg-emerald-400"
      : analysis.confidence >= 60
        ? "bg-cyan-400"
        : analysis.confidence >= 45
          ? "bg-amber-400"
          : "bg-slate-400";
  const tone = signalTone[analysis.signal];
  const tactical = analysis.tacticalSignal;
  const isNoTrade = analysis.signal === "NO_TRADE";
  const entryNok = formatApproxNokPrice(analysis.entry, analysis);
  const stopNok = isNoTrade ? null : formatApproxNokPrice(analysis.stopLoss, analysis);
  const targetNok = isNoTrade ? null : formatApproxNokPrice(analysis.target, analysis);

  return (
    <button type="button" onClick={() => onSelect(analysis)} className="h-full w-full text-left">
      <Card className={cn("group relative flex h-full min-h-[430px] flex-col overflow-hidden p-5 transition duration-200 hover:-translate-y-1 hover:border-white/20 sm:p-6", tone.card)}>
        <div className={cn("pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b to-transparent", tone.glow)} />

        <div className="relative flex h-full flex-col">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">{analysis.instrument.assetClass}</p>
              <p className="mt-2 text-2xl font-semibold tracking-tight text-white">{analysis.instrument.ticker}</p>
            </div>
            <div className="flex flex-col items-end gap-2 text-right">
              <Badge className={cn("bg-black/10", tone.badge)}>{SIGNAL_LABELS[analysis.signal]}</Badge>
              {tactical ? <Badge className={cn("bg-black/10", tacticalTone[tactical.action])}>Tactical: {TACTICAL_LABELS[tactical.action]}</Badge> : null}
              <span className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                {isNoTrade ? "Stand aside" : `Setup ${analysis.setupQuality}`}
              </span>
            </div>
          </div>

          <div className="mt-5 rounded-3xl border border-white/10 bg-black/20 p-4">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Confidence</p>
                <p className="mt-2 text-3xl font-semibold tracking-tight text-white">{formatPercent(analysis.confidence)}</p>
              </div>
              <div className="text-right">
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Score</p>
                <p className="mt-2 text-xl font-semibold text-white">{analysis.score}</p>
              </div>
            </div>

            <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/5">
              <div className={cn("h-full rounded-full", confidenceTone)} style={{ width: `${Math.max(8, analysis.confidence)}%` }} />
            </div>

            <p className="mt-3 text-xs leading-5 text-slate-300">
              {isNoTrade
                ? "No Trade until conviction and factor alignment improve."
                : `${analysis.marketRegime} regime with ${analysis.setupQuality} setup quality.`}
            </p>
          </div>

          {tactical ? (
            <div className="mt-4 rounded-3xl border border-white/10 bg-white/[0.03] p-4">
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Tactical · {tactical.horizon}</p>
                <span className="text-xs font-semibold text-white">{tactical.score > 0 ? "+" : ""}{tactical.score}</span>
              </div>
              <p className="text-sm font-medium text-white">{TACTICAL_LABELS[tactical.action]}</p>
              <p className="mt-1.5 line-clamp-2 text-xs leading-5 text-slate-300">{tactical.reason}</p>
            </div>
          ) : null}

          <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-slate-200">
            <Metric label="COT bias" value={analysis.cotBias} icon={Activity} />
            <Metric label="Trend" value={analysis.trend} icon={TrendingUp} />
            <Metric label="Retail long" value={formatPercent(analysis.retailLong)} icon={ShieldAlert} />
            <Metric label="Regime" value={analysis.marketRegime} icon={Target} />
          </div>

          <div className="mt-4 rounded-3xl border border-white/10 bg-white/[0.03] p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Trade plan</p>
              <p className="text-xs text-slate-400">{isNoTrade ? "Observation only" : `R/R ${analysis.riskReward.toFixed(1)}`}</p>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <TradeMetric label="Entry" value={formatPrice(analysis.entry)} secondaryValue={entryNok} />
              <TradeMetric label="Stop" value={isNoTrade ? "—" : formatPrice(analysis.stopLoss)} secondaryValue={stopNok} muted={isNoTrade} />
              <TradeMetric label="Target" value={isNoTrade ? "—" : formatPrice(analysis.target)} secondaryValue={targetNok} muted={isNoTrade} />
              <TradeMetric label="Risk / reward" value={isNoTrade ? "Flat" : analysis.riskReward.toFixed(1)} muted={isNoTrade} />
            </div>
          </div>

          <div className="mt-auto space-y-3 pt-4 text-sm">
            <div className="flex items-center justify-between text-slate-200">
              <span className="flex items-center gap-2 text-slate-300">
                <Clock3 className="h-4 w-4" />
                Updated {formatRelativeTime(analysis.updatedAt)}
              </span>
              <span className="inline-flex items-center gap-1 text-slate-400 transition group-hover:text-slate-200">
                Details
                <ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </span>
            </div>

            <div className={cn("rounded-2xl border px-3.5 py-3", freshnessClass)}>
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-semibold uppercase tracking-[0.16em]">
                  {analysis.freshness.mode === "live" ? "Live provider data" : "Fallback snapshot in use"}
                </span>
                <span className="text-xs text-white/70">{formatRelativeTime(analysis.freshness.updatedAt)}</span>
              </div>
              <p className="mt-1.5 text-xs leading-5 text-white/80">{analysis.freshness.note}</p>
            </div>
          </div>
        </div>
      </Card>
    </button>
  );
}

function Metric({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Activity }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/10 p-3">
      <div className="mb-2 flex items-center gap-2 text-xs text-slate-300/80">
        <Icon className="h-3.5 w-3.5" />
        <span>{label}</span>
      </div>
      <p className="truncate text-sm font-medium text-white">{value}</p>
    </div>
  );
}

function TradeMetric({
  label,
  value,
  secondaryValue,
  muted = false,
}: {
  label: string;
  value: string;
  secondaryValue?: string | null;
  muted?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/10 p-3">
      <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <p className={cn("mt-2 text-sm font-semibold text-white", muted && "text-slate-400")}>{value}</p>
      {secondaryValue ? <p className="mt-1 text-xs text-slate-400">{secondaryValue}</p> : null}
    </div>
  );
}