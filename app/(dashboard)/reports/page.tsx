import { ArrowLeft, FileText } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { getRecentModelReviewReports } from "@/lib/firebase/firestore-model-review-service";
import type { FirestoreModelReviewMetricRow, FirestoreModelReviewReportDocument } from "@/lib/types/firestore";

export const revalidate = 300;

function formatDate(value: string) {
  return new Intl.DateTimeFormat("nb-NO", { dateStyle: "full", timeStyle: "short" }).format(new Date(value));
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function MetricTable({ title, rows }: { title: string; rows: FirestoreModelReviewMetricRow[] }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-black/10 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        <span className="text-xs text-slate-400">{rows.length} rader</span>
      </div>
      {!rows.length ? <p className="text-sm text-slate-400">Ingen data ennå.</p> : <div className="space-y-2">{rows.map((row) => <MetricRow key={`${title}-${row.label}`} row={row} />)}</div>}
    </section>
  );
}

function MetricRow({ row }: { row: FirestoreModelReviewMetricRow }) {
  return (
    <div className="grid grid-cols-[1.2fr_repeat(4,minmax(0,1fr))] gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-slate-200">
      <span className="font-medium text-white">{row.label}</span>
      <span>{row.samples} prøver</span>
      <span>{formatPercent(row.hitRatePercent)} treff</span>
      <span>{formatPercent(row.avgReturnPercent)} avkastning</span>
      <span>{row.avgConfidence.toFixed(1)} conf</span>
    </div>
  );
}

function ReportCard({ report }: { report: FirestoreModelReviewReportDocument }) {
  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge className="bg-cyan-500/10 text-cyan-100">Ukentlig rapport</Badge>
            <Badge className="bg-white/5 text-slate-200">{report.horizonHours}t horisont</Badge>
            <Badge className="bg-emerald-500/10 text-emerald-100">{report.completeAuditCount} ferdig evaluerte</Badge>
          </div>
          <h2 className="text-xl font-semibold text-white">{report.headline}</h2>
          <p className="mt-2 text-sm text-slate-300">Generert {formatDate(report.generatedAt)}</p>
        </div>
        <Badge className="bg-white/5 text-slate-200">{report.reviewMode === "openai" ? "OpenAI" : "Template"}</Badge>
      </div>

      <p className="mt-5 text-sm leading-6 text-slate-300">{report.summary}</p>

      <div className="mt-5 grid gap-3 sm:grid-cols-4">
        <Stat label="Kilder" value={String(report.sourceAuditCount)} detail="Audits i vurderingsvinduet" />
        <Stat label="Evaluerte" value={String(report.completeAuditCount)} detail="Rapporter med klar fasit" />
        <Stat label="Treffrate" value={formatPercent(report.metrics.total.hitRatePercent)} detail="Total retningspresisjon" />
        <Stat label="Snittavkastning" value={formatPercent(report.metrics.total.avgReturnPercent)} detail="Gjennomsnittlig retningsretur" />
      </div>

      <section className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <h3 className="text-sm font-semibold text-white">Anbefalinger</h3>
        <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-300">
          {report.recommendations.map((item) => <li key={item} className="flex gap-2"><span className="text-cyan-300">•</span><span>{item}</span></li>)}
        </ul>
      </section>

      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        <MetricTable title="Per signal" rows={report.metrics.bySignal} />
        <MetricTable title="Per confidence-bøtte" rows={report.metrics.byConfidenceBucket} />
        <MetricTable title="Per regime" rows={report.metrics.byRegime} />
        <MetricTable title="Per datafriskhet" rows={report.metrics.byFreshnessMode} />
        <MetricTable title="Per tactical action" rows={report.metrics.byTacticalAction ?? []} />
        <MetricTable title="Per trade guidance" rows={report.metrics.byTradeGuidance ?? []} />
      </div>
    </Card>
  );
}

function Stat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <div className="rounded-2xl border border-white/10 bg-black/10 p-4"><p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">{label}</p><p className="mt-2 text-lg font-semibold text-white">{value}</p><p className="mt-1 text-xs text-slate-300">{detail}</p></div>;
}

export default async function ReportsPage() {
  const reports = await getRecentModelReviewReports(12);

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <div className="mx-auto max-w-[1600px] space-y-8">
        <header className="rounded-[30px] border border-white/10 bg-panel/80 p-6 shadow-glow backdrop-blur xl:p-7">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <Badge className="bg-blue-500/10 text-blue-100">MSM1</Badge>
            <Badge className="bg-cyan-500/10 text-cyan-100">Rapporter</Badge>
            <Badge className="bg-white/5 text-slate-200">{reports.length} lagret</Badge>
          </div>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-[2.1rem]">Ukentlige rapporter</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">Her ser du rapportene som model-review-agenten lager hver søndag, inkludert sammendrag, anbefalinger og målt treffsikkerhet.</p>
            </div>
            <Link href="/dashboard" className="inline-flex items-center gap-2 rounded-2xl border border-white/10 px-4 py-2 text-sm text-slate-200 transition hover:bg-white/5"><ArrowLeft className="h-4 w-4" />Til dashboard</Link>
          </div>
        </header>

        {!reports.length ? <Card className="p-8 text-center"><FileText className="mx-auto h-10 w-10 text-slate-400" /><h2 className="mt-4 text-lg font-semibold text-white">Ingen rapporter ennå</h2><p className="mt-2 text-sm text-slate-300">Den første rapporten dukker opp her etter at søndagsjobben har kjørt og lagret en model-review-rapport.</p></Card> : <div className="space-y-6">{reports.map((report) => <ReportCard key={report.reportId} report={report} />)}</div>}
      </div>
    </main>
  );
}
