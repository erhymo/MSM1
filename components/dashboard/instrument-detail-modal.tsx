"use client";

import { Activity, Clock3, ShieldAlert, Target, TrendingUp } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import type { AnalysisResult } from "@/lib/types/analysis";
import { cn } from "@/lib/utils/cn";
import { formatApproxNokPrice, formatPercent, formatPrice, formatRelativeTime, SIGNAL_LABELS } from "@/lib/utils/format";

type InstrumentDetailModalProps = {
  analysis: AnalysisResult | null;
  open: boolean;
  onClose: () => void;
};

const chartGridColor = "#22304d";
const chartAxisColor = "#7c8aa5";
const chartTooltipStyle = {
  background: "#0f172a",
  border: "1px solid #1e293b",
  borderRadius: "16px",
};

const signalTone: Record<AnalysisResult["signal"], string> = {
  STRONG_BUY: "border-emerald-300/30 bg-emerald-400/15 text-emerald-50",
  BUY: "border-green-300/30 bg-green-400/15 text-green-50",
  WAIT: "border-amber-300/25 bg-amber-400/12 text-amber-50",
  HOLD: "border-blue-300/25 bg-blue-400/12 text-blue-50",
  SELL: "border-rose-300/25 bg-rose-400/12 text-rose-50",
  STRONG_SELL: "border-red-300/25 bg-red-400/12 text-red-50",
  NO_TRADE: "border-slate-300/20 bg-slate-400/10 text-slate-100",
};

export function InstrumentDetailModal({ analysis, open, onClose }: InstrumentDetailModalProps) {
  if (!analysis) return null;

  const hasSentimentHistory = Boolean(analysis.sentimentHistory?.length);
  const hasCotHistory = Boolean(analysis.cotHistory?.length);
  const freshnessLabel = analysis.freshness.mode === "fallback" ? "Fallback active" : "Live provider data";
  const isNoTrade = analysis.signal === "NO_TRADE";
  const entryNok = formatApproxNokPrice(analysis.entry, analysis);
  const stopNok = isNoTrade ? null : formatApproxNokPrice(analysis.stopLoss, analysis);
  const targetNok = isNoTrade ? null : formatApproxNokPrice(analysis.target, analysis);
  const confidenceTone =
    analysis.confidence >= 75
      ? "bg-emerald-400"
      : analysis.confidence >= 60
        ? "bg-cyan-400"
        : analysis.confidence >= 45
          ? "bg-amber-400"
          : "bg-slate-400";

  return (
    <Modal isOpen={open} onClose={onClose} title={`${analysis.instrument.ticker} · ${SIGNAL_LABELS[analysis.signal]}`}>
      <div className="space-y-6">
        <section className="grid gap-4 xl:grid-cols-[1.45fr_1fr]">
          <Card className="overflow-hidden p-6">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <Badge className={cn("bg-black/10", signalTone[analysis.signal])}>{SIGNAL_LABELS[analysis.signal]}</Badge>
              <Badge className="bg-white/5 text-slate-200">Setup {analysis.setupQuality}</Badge>
              <Badge className="bg-white/5 text-slate-200">{analysis.marketRegime}</Badge>
              <Badge className={analysis.freshness.mode === "fallback" ? "bg-amber-500/10 text-amber-100" : "bg-emerald-500/10 text-emerald-100"}>
                {freshnessLabel}
              </Badge>
            </div>
            <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">{analysis.instrument.assetClass}</p>
            <h3 className="mt-3 text-3xl font-semibold tracking-tight text-white">{analysis.instrument.name}</h3>
            <p className="mt-2 flex items-center gap-2 text-sm text-slate-400">
              <Clock3 className="h-4 w-4" />
              Updated {formatRelativeTime(analysis.updatedAt)}
            </p>

            <div className="mt-5 rounded-[28px] border border-white/10 bg-black/20 p-5">
              <p className="text-base font-medium leading-7 text-slate-100">{analysis.aiSummary}</p>
              <p className="mt-3 text-sm leading-6 text-slate-300">{analysis.explanation}</p>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <InfoTile label="Trend" value={analysis.trend} icon={TrendingUp} />
              <InfoTile label="COT bias" value={analysis.cotBias} icon={Activity} />
              <InfoTile label="Retail long" value={formatPercent(analysis.retailLong)} icon={ShieldAlert} />
              <InfoTile label="Regime" value={analysis.marketRegime} icon={Target} />
            </div>
          </Card>

          <Card className="space-y-5 p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Execution view</p>
                <h4 className="mt-2 text-2xl font-semibold tracking-tight text-white">{isNoTrade ? "Stand aside" : "Trade plan"}</h4>
              </div>
              <Badge className="bg-white/5 text-slate-200">Score {analysis.score}</Badge>
            </div>

            {isNoTrade ? (
              <div className="rounded-[26px] border border-amber-400/20 bg-amber-500/10 p-4 text-sm leading-6 text-amber-100">
                No Trade is active because the current setup does not yet have enough conviction or alignment to justify a plan.
              </div>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2">
              <Stat label="Entry" value={formatPrice(analysis.entry)} secondaryValue={entryNok} />
              <Stat label="Stop loss" value={isNoTrade ? "—" : formatPrice(analysis.stopLoss)} secondaryValue={stopNok} muted={isNoTrade} />
              <Stat label="Target" value={isNoTrade ? "—" : formatPrice(analysis.target)} secondaryValue={targetNok} muted={isNoTrade} />
              <Stat label="Risk / reward" value={isNoTrade ? "Flat" : analysis.riskReward.toFixed(1)} muted={isNoTrade} />
            </div>

            <div className="rounded-[28px] border border-white/10 bg-black/20 p-5">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Confidence</p>
                  <p className="mt-2 text-4xl font-semibold tracking-tight text-white">{formatPercent(analysis.confidence)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Setup quality</p>
                  <p className="mt-2 text-xl font-semibold text-white">{analysis.setupQuality}</p>
                </div>
              </div>

              <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/5">
                <div className={cn("h-full rounded-full", confidenceTone)} style={{ width: `${Math.max(8, analysis.confidence)}%` }} />
              </div>

              <p className="mt-3 text-sm text-slate-300">
                Confidence blends score strength, factor alignment and live-vs-fallback data quality.
              </p>
            </div>

            <div className="rounded-[26px] border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Data freshness</p>
                <span className={analysis.freshness.mode === "fallback" ? "text-xs font-medium text-amber-200" : "text-xs font-medium text-emerald-200"}>
                  {freshnessLabel}
                </span>
              </div>
              <p className="mt-2 text-sm font-medium text-white">Updated {formatRelativeTime(analysis.freshness.updatedAt)}</p>
              <p className="mt-2 text-sm leading-6 text-slate-300">{analysis.freshness.note}</p>
            </div>
          </Card>
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          <ChartCard title="Price trend chart">
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={analysis.priceHistory}>
                <CartesianGrid stroke={chartGridColor} strokeDasharray="3 3" />
                <XAxis dataKey="label" stroke={chartAxisColor} />
                <YAxis stroke={chartAxisColor} domain={["dataMin - 1", "dataMax + 1"]} />
                <Tooltip contentStyle={chartTooltipStyle} />
                <Area type="monotone" dataKey="value" stroke="#60a5fa" fill="#1d4ed8" fillOpacity={0.35} />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Confidence history">
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={analysis.confidenceHistory}>
                <CartesianGrid stroke={chartGridColor} strokeDasharray="3 3" />
                <XAxis dataKey="label" stroke={chartAxisColor} />
                <YAxis stroke={chartAxisColor} />
                <Tooltip contentStyle={chartTooltipStyle} />
                <Line type="monotone" dataKey="value" stroke="#22c55e" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        </section>

        <section className="grid gap-4 xl:grid-cols-3">
          <ChartCard title="Signal history">
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={analysis.signalHistory}>
                <CartesianGrid stroke={chartGridColor} strokeDasharray="3 3" />
                <XAxis dataKey="label" stroke={chartAxisColor} />
                <YAxis stroke={chartAxisColor} domain={[-100, 100]} />
                <Tooltip contentStyle={chartTooltipStyle} />
                <Line type="monotone" dataKey="score" stroke="#f59e0b" strokeWidth={2} dot />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          {hasSentimentHistory ? (
            <ChartCard title="Sentiment history">
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={analysis.sentimentHistory}>
                  <CartesianGrid stroke={chartGridColor} strokeDasharray="3 3" />
                  <XAxis dataKey="label" stroke={chartAxisColor} />
                  <YAxis stroke={chartAxisColor} />
                  <Tooltip contentStyle={chartTooltipStyle} />
                  <Line type="monotone" dataKey="value" stroke="#f43f5e" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
          ) : null}

          {hasCotHistory ? (
            <ChartCard title="COT history">
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={analysis.cotHistory}>
                  <CartesianGrid stroke={chartGridColor} strokeDasharray="3 3" />
                  <XAxis dataKey="label" stroke={chartAxisColor} />
                  <YAxis stroke={chartAxisColor} domain={[-100, 100]} />
                  <Tooltip contentStyle={chartTooltipStyle} />
                  <Area type="monotone" dataKey="value" stroke="#a78bfa" fill="#7c3aed" fillOpacity={0.22} />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>
          ) : null}
        </section>

        <section>
          <Card className="p-6">
            <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-300">Factor contributions</h4>
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {analysis.factorContributions.map((factor) => (
                <div key={factor.name} className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-white">{factor.name}</p>
                    <span className="text-xs text-slate-300">{factor.weight}%</span>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-slate-300">{factor.summary}</p>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/5">
                    <div
                      className={cn("h-full rounded-full", factor.contribution >= 0 ? "bg-cyan-400" : "bg-rose-400")}
                      style={{ width: `${Math.max(10, Math.min(100, Math.abs(factor.contribution) * 3))}%` }}
                    />
                  </div>
                  <p className={factor.contribution >= 0 ? "mt-2 text-sm font-semibold text-blue-200" : "mt-2 text-sm font-semibold text-rose-200"}>
                    Contribution {factor.contribution > 0 ? "+" : ""}
                    {factor.contribution}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        </section>
      </div>
    </Modal>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="p-6">
      <h4 className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-slate-300">{title}</h4>
      {children}
    </Card>
  );
}

function Stat({
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
    <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
      <p className="text-xs uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <p className={cn("mt-2 text-lg font-semibold text-white", muted && "text-slate-400")}>{value}</p>
      {secondaryValue ? <p className="mt-1 text-xs text-slate-400">{secondaryValue}</p> : null}
    </div>
  );
}

function InfoTile({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Activity }) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-slate-400">
        <Icon className="h-3.5 w-3.5" />
        <span>{label}</span>
      </div>
      <p className="mt-2 text-sm font-medium text-slate-100">{value}</p>
    </div>
  );
}