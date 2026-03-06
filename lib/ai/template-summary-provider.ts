import type { SummaryService } from "@/lib/ai/summary-shared";
import { buildRuleBasedExplanation, buildTemplateSummary } from "@/lib/ai/summary-shared";

export const templateSummaryProvider: SummaryService = {
  async summarize(input) {
    return {
      summary: buildTemplateSummary(input),
      explanation: buildRuleBasedExplanation(input),
    };
  },
};