import { newsProviderConfig } from "@/lib/providers/news/config";

type GdeltArticle = {
  url: string;
  title: string;
  seendate?: string;
  domain?: string;
  language?: string;
};

type GdeltResponse = {
  articles?: GdeltArticle[];
};

export type NewsHeadline = {
  title: string;
  url: string;
  domain: string;
  publishedAt: string;
  source: string;
};

function quoteTerms(terms: readonly string[]) {
  return terms.map((term) => (term.includes(" ") ? `"${term}"` : term)).join(" OR ");
}

function toIsoDate(value: string | undefined) {
  if (!value) return new Date().toISOString();

  const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(value);
  if (!match) return new Date().toISOString();

  const [, year, month, day, hour, minute, second] = match;
  return `${year}-${month}-${day}T${hour}:${minute}:${second}Z`;
}

export const gdeltNewsProvider = {
  async getHeadlines(input: { oilKeywords: readonly string[]; contextKeywords: readonly string[]; maxRecords: number }) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), newsProviderConfig.timeoutMs);

    try {
      const query = `(${quoteTerms(input.oilKeywords)}) AND (${quoteTerms(input.contextKeywords)})`;
      const url = new URL(newsProviderConfig.baseUrl);
      url.searchParams.set("query", query);
      url.searchParams.set("mode", "ArtList");
      url.searchParams.set("format", "json");
      url.searchParams.set("sort", "datedesc");
      url.searchParams.set("maxrecords", String(input.maxRecords));

      const response = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: "application/json" },
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`GDELT returned HTTP ${response.status}`);
      }

      const data = (await response.json()) as GdeltResponse;
      return (data.articles ?? [])
        .filter((article) => !article.language || article.language.toLowerCase() === "english")
        .map((article) => ({
          title: article.title,
          url: article.url,
          domain: article.domain ?? "unknown",
          publishedAt: toIsoDate(article.seendate),
          source: "gdelt-doc",
        })) satisfies NewsHeadline[];
    } finally {
      clearTimeout(timeout);
    }
  },
};