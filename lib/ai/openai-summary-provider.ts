import "server-only";

import { aiSummaryConfig } from "@/lib/ai/config";
import type { SummaryService, SummaryServiceInput } from "@/lib/ai/summary-shared";
import { buildPromptFacts, buildRuleBasedExplanation, buildTemplateSummary, validateSummaryText } from "@/lib/ai/summary-shared";
import { SIGNAL_LABELS } from "@/lib/utils/format";

type OpenAIChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
};

function buildPrompt(input: SummaryServiceInput) {
  const verdict = SIGNAL_LABELS[input.analysis.signal];
  const facts = buildPromptFacts(input).map((line) => `- ${line}`).join("\n");

  return [
    "Write one short, verifiable market summary sentence using only the facts below.",
    `Do not change or reinterpret the signal. The signal is already fixed as: ${verdict}.`,
    "Mention 3 to 5 concrete factors, stay grounded in the supplied values, and avoid hype.",
    `End with: Therefore ${verdict} over the next 1–3 weeks.`,
    "Do not use bullet points or markdown.",
    facts,
  ].join("\n\n");
}

export const openAISummaryProvider: SummaryService = {
  async summarize(input) {
    const apiKey = aiSummaryConfig.openAiApiKey;
    const fallbackSummary = buildTemplateSummary(input);

    if (!apiKey) {
      return {
        summary: fallbackSummary,
        explanation: buildRuleBasedExplanation(input),
      };
    }

    const response = await fetch(`${aiSummaryConfig.openAiBaseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(aiSummaryConfig.timeoutMs),
      body: JSON.stringify({
        model: aiSummaryConfig.model,
        temperature: 0.1,
        max_tokens: 120,
        messages: [
          {
            role: "system",
            content: "You explain already-computed trading signals. Never invent data, never change the signal, and never add unsupported factors.",
          },
          {
            role: "user",
            content: buildPrompt(input),
          },
        ],
      }),
    });

    if (!response.ok) {
      const details = (await response.text()).slice(0, 240).replace(/\s+/g, " ");
      throw new Error(`OpenAI summary request failed with status ${response.status}${details ? `: ${details}` : ""}`);
    }

    const payload = (await response.json()) as OpenAIChatCompletionResponse;
    const candidate = payload.choices?.[0]?.message?.content ?? "";
    const validatedSummary = validateSummaryText(candidate, input, aiSummaryConfig.maxSummaryCharacters);

    if (!validatedSummary) {
      throw new Error("OpenAI summary response was empty or failed validation");
    }

    return {
      summary: validatedSummary,
      explanation: buildRuleBasedExplanation(input),
    };
  },
};