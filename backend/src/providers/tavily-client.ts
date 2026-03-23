type FetchLike = typeof fetch;

export interface TavilySearchHit {
  title: string;
  url: string;
  snippet: string;
  published_at?: string;
  score?: number;
}

export class TavilyClient {
  constructor(
    private readonly apiKey: string | undefined,
    private readonly fetchImpl: FetchLike = fetch
  ) {}

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  async search(query: string): Promise<TavilySearchHit[]> {
    if (!this.apiKey) {
      return [];
    }

    const response = await this.fetchImpl("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        api_key: this.apiKey,
        query,
        topic: "general",
        search_depth: "advanced",
        max_results: 5,
        include_answer: false,
        include_raw_content: false,
        include_images: false
      })
    });

    if (!response.ok) {
      throw new Error(`Tavily request failed with ${response.status}.`);
    }

    const data = (await response.json()) as {
      results?: Array<{
        title?: string;
        url?: string;
        content?: string;
        score?: number;
        published_date?: string;
      }>;
    };

    return (data.results ?? [])
      .filter((result) => result.url && result.title)
      .map((result) => ({
        title: result.title ?? "Untitled source",
        url: result.url ?? "",
        snippet: result.content ?? "",
        score: result.score,
        published_at: result.published_date
      }));
  }
}

