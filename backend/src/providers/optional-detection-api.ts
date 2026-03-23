type FetchLike = typeof fetch;

export class OptionalDetectionApiClient {
  constructor(
    private readonly apiUrl: string | undefined,
    private readonly apiKey: string | undefined,
    private readonly fetchImpl: FetchLike = fetch
  ) {}

  isConfigured(): boolean {
    return Boolean(this.apiUrl);
  }

  async detect(kind: "text" | "images", payload: unknown): Promise<number | null> {
    if (!this.apiUrl) {
      return null;
    }

    const response = await this.fetchImpl(this.apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {})
      },
      body: JSON.stringify({
        kind,
        payload
      })
    });

    if (!response.ok) {
      throw new Error(`Detection API request failed with ${response.status}.`);
    }

    const data = (await response.json()) as {
      probability?: number;
      score?: number;
    };

    const value = typeof data.probability === "number" ? data.probability : data.score;
    if (typeof value !== "number") {
      return null;
    }

    return Math.min(100, Math.max(0, value));
  }
}
