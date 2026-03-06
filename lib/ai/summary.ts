import "server-only";

import { aiSummaryConfig, shouldUseOpenAISummaryMode } from "@/lib/ai/config";
import { openAISummaryProvider } from "@/lib/ai/openai-summary-provider";
export type { SummaryFactors, SummaryService, SummaryServiceInput, SummaryServiceOutput } from "@/lib/ai/summary-shared";
import type { SummaryService } from "@/lib/ai/summary-shared";
import { templateSummaryProvider } from "@/lib/ai/template-summary-provider";
import { writeSystemLog } from "@/lib/firebase/firestore-system-log-service";

export const aiSummaryService: SummaryService = {
  async summarize(input) {
    if (!shouldUseOpenAISummaryMode()) {
      return templateSummaryProvider.summarize(input);
    }

    try {
      return await openAISummaryProvider.summarize(input);
    } catch (error) {
      const reason = error instanceof Error ? error.message : "unknown-error";

      await writeSystemLog({
        level: "warning",
        scope: "ai-summary",
        message: "OpenAI summary generation failed, using template fallback",
        details: {
          ticker: input.analysis.instrument.ticker,
          mode: aiSummaryConfig.mode,
          model: aiSummaryConfig.model,
          reason,
        },
      }).catch(() => undefined);

      return templateSummaryProvider.summarize(input);
    }
  },
};