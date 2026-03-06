import { AlertTriangle, CheckCircle2, Clock3, Radio, Siren } from "lucide-react";

import { Card } from "@/components/ui/card";
import type { SystemStatusItem } from "@/lib/types/analysis";
import { formatRelativeTime } from "@/lib/utils/format";

const tone = {
  ok: { icon: CheckCircle2, className: "text-emerald-300" },
  warning: { icon: AlertTriangle, className: "text-amber-300" },
  error: { icon: AlertTriangle, className: "text-rose-300" },
};

const groups: Array<{ key: SystemStatusItem["category"]; title: string }> = [
  { key: "job", title: "Pipeline" },
  { key: "feed", title: "Data feeds" },
  { key: "mode", title: "Snapshot mode" },
  { key: "error", title: "Monitoring" },
];

export function SystemStatus({ items }: { items: SystemStatusItem[] }) {
  const liveRows = items.filter((item) => item.freshnessMode === "live").length;
  const fallbackRows = items.filter((item) => item.freshnessMode === "fallback").length;
  const issueRows = items.filter((item) => item.category === "error" && item.status !== "ok").length;

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-white">System status</h2>
          <p className="text-sm text-muted">Diskret oversikt over siste jobb, datakilder, feil og live/fallback-status.</p>
        </div>
        <Clock3 className="h-5 w-5 text-slate-400" />
      </div>

      <div className="mb-4 grid gap-2 sm:grid-cols-3">
        <SummaryPill label="Live" value={String(liveRows)} tone="ok" icon={Radio} />
        <SummaryPill label="Fallback" value={String(fallbackRows)} tone={fallbackRows > 0 ? "warning" : "ok"} icon={Clock3} />
        <SummaryPill label="Issues" value={String(issueRows)} tone={issueRows > 0 ? "error" : "ok"} icon={Siren} />
      </div>

      <div className="space-y-4">
        {groups.map((group) => {
          const groupItems = items.filter((item) => item.category === group.key);
          if (!groupItems.length) return null;

          return (
            <section key={group.key}>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{group.title}</p>
              <div className="space-y-2">
                {groupItems.map((item) => {
                  const Icon = tone[item.status].icon;

                  return (
                    <div key={item.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                      <div className="flex items-start gap-3">
                        <Icon className={`mt-0.5 h-4 w-4 flex-none ${tone[item.status].className}`} />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-medium text-white">{item.label}</p>
                            <BadgePill>{item.value}</BadgePill>
                            <BadgePill>{item.source}</BadgePill>
                            {item.freshnessMode ? <BadgePill>{item.freshnessMode}</BadgePill> : null}
                          </div>
                          <p className="mt-1 text-sm text-muted">{item.detail}</p>
                          {item.updatedAt ? <p className="mt-2 text-xs text-slate-400">Updated {formatRelativeTime(item.updatedAt)}</p> : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </Card>
  );
}

function SummaryPill({
  label,
  value,
  tone: toneKey,
  icon: Icon,
}: {
  label: string;
  value: string;
  tone: keyof typeof tone;
  icon: typeof Clock3;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2">
      <Icon className={`h-4 w-4 ${tone[toneKey].className}`} />
      <div>
        <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">{label}</p>
        <p className="text-sm font-semibold text-white">{value}</p>
      </div>
    </div>
  );
}

function BadgePill({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs text-slate-300">{children}</span>;
}