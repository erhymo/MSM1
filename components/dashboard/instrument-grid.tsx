import { Inbox } from "lucide-react";

import { Card } from "@/components/ui/card";
import type { AnalysisResult } from "@/lib/types/analysis";

import { InstrumentCard } from "./instrument-card";

type InstrumentGridProps = {
  analyses: AnalysisResult[];
  onSelect: (analysis: AnalysisResult) => void;
};

export function InstrumentGrid({ analyses, onSelect }: InstrumentGridProps) {
  if (!analyses.length) {
    return (
      <Card className="flex min-h-[280px] items-center justify-center p-8 sm:p-10">
        <div className="max-w-md text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] text-slate-300">
            <Inbox className="h-5 w-5" />
          </div>
          <h3 className="mt-4 text-lg font-semibold text-white">No analysis snapshots available</h3>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            The dashboard will populate automatically when the next analysis snapshot is written to Firestore or computed locally.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className="grid auto-rows-fr gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {analyses.map((analysis) => (
        <InstrumentCard key={analysis.instrument.ticker} analysis={analysis} onSelect={onSelect} />
      ))}
    </div>
  );
}