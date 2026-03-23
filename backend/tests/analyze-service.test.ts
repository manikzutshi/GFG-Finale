import { describe, expect, it } from "vitest";

import { AnalyzeService } from "../src/services/analyze-service.js";
import { GeminiClient } from "../src/providers/gemini-client.js";
import { OptionalDetectionApiClient } from "../src/providers/optional-detection-api.js";
import { TavilyClient } from "../src/providers/tavily-client.js";

class MockGemini extends GeminiClient {
  public callCount = 0;

  constructor() {
    super(undefined, "mock");
  }

  override isConfigured(): boolean {
    return true;
  }

  override async generateJson<T>({ prompt }: { prompt: string }): Promise<T | null> {
    this.callCount += 1;

    if (prompt.includes("extract atomic factual claims")) {
      return {
        claims: [
          {
            claim: "The Earth orbits the Sun.",
            source_sentence_ids: [0]
          },
          {
            claim: "Mars has two moons.",
            source_sentence_ids: [1]
          }
        ]
      } as T;
    }

    if (prompt.includes("generate diverse search queries")) {
      return {
        items: [
          {
            claim_id: 0,
            queries: ["Earth orbits Sun NASA", "Earth orbit Sun encyclopedia", "Earth sun annual orbit"]
          },
          {
            claim_id: 1,
            queries: ["Mars two moons NASA", "Mars has two moons encyclopedia", "Mars two moons Britannica"]
          }
        ]
      } as T;
    }

    return {
      items: [
        {
          claim_id: 0,
          verdict: "TRUE",
          confidence: 81,
          reasoning: "The supplied evidence supports the claim.",
          conflict: false
        },
        {
          claim_id: 1,
          verdict: "TRUE",
          confidence: 84,
          reasoning: "The supplied evidence supports the claim.",
          conflict: false
        }
      ]
    } as T;
  }
}

class MockSearch extends TavilyClient {
  constructor(private readonly results: Record<string, Array<{ title: string; url: string; snippet: string }>>) {
    super(undefined);
  }

  override isConfigured(): boolean {
    return true;
  }

  override async search(query: string) {
    return (this.results[query] ?? []).map((result) => ({
      ...result,
      score: 0.8,
      published_at: new Date().toISOString()
    }));
  }
}

class MockDetection extends OptionalDetectionApiClient {
  constructor() {
    super(undefined, undefined);
  }

  override isConfigured(): boolean {
    return false;
  }
}

describe("AnalyzeService", () => {
  it("returns structured analysis from mocked providers", async () => {
    const llm = new MockGemini();
    const service = new AnalyzeService({
      env: {
        GEMINI_API_KEY: undefined,
        GEMINI_MODEL: "mock",
        TAVILY_API_KEY: undefined,
        BACKEND_PORT: 4000,
        CORS_ORIGINS: "http://localhost:3000",
        AI_DETECTION_API_URL: undefined,
        AI_DETECTION_API_KEY: undefined
      },
      llm,
      searchClient: new MockSearch({
        "Earth orbits Sun NASA": [
          {
            title: "NASA Solar System Exploration",
            url: "https://science.nasa.gov/earth",
            snippet: "Earth travels around the Sun once every year."
          }
        ],
        "Earth orbit Sun encyclopedia": [
          {
            title: "Britannica Earth",
            url: "https://www.britannica.com/place/Earth",
            snippet: "Earth revolves around the Sun."
          }
        ],
        "Earth sun annual orbit": [
          {
            title: "National Geographic",
            url: "https://www.nationalgeographic.com/science/article/earth",
            snippet: "Earth's orbit around the Sun defines the year."
          }
        ],
        "Mars two moons NASA": [
          {
            title: "NASA Mars Overview",
            url: "https://science.nasa.gov/mars",
            snippet: "Mars has two small moons, Phobos and Deimos."
          }
        ],
        "Mars has two moons encyclopedia": [
          {
            title: "Britannica Mars",
            url: "https://www.britannica.com/place/Mars-planet",
            snippet: "Mars has two natural satellites."
          }
        ],
        "Mars two moons Britannica": [
          {
            title: "ESA Mars",
            url: "https://www.esa.int/Science_Exploration/Space_Science/Mars",
            snippet: "Mars has two moons."
          }
        ]
      }),
      detectionApiClient: new MockDetection()
    });

    const response = await service.analyze({
      input_text: "The Earth orbits the Sun. Mars has two moons."
    });

    expect(response.claims).toHaveLength(2);
    expect(response.claims[0]?.verdict).toBe("TRUE");
    expect(response.verdict_distribution.TRUE).toBe(2);
    expect(response.ai_text_probability).not.toBeNull();
    expect(llm.callCount).toBe(3);
  });

  it("surfaces unverifiable results when search returns nothing", async () => {
    const llm = new MockGemini();
    const service = new AnalyzeService({
      env: {
        GEMINI_API_KEY: undefined,
        GEMINI_MODEL: "mock",
        TAVILY_API_KEY: undefined,
        BACKEND_PORT: 4000,
        CORS_ORIGINS: "http://localhost:3000",
        AI_DETECTION_API_URL: undefined,
        AI_DETECTION_API_KEY: undefined
      },
      llm,
      searchClient: new MockSearch({}),
      detectionApiClient: new MockDetection()
    });

    const response = await service.analyze({
      input_text: "The Earth orbits the Sun."
    });

    expect(response.claims[0]?.verdict).toBe("UNVERIFIABLE");
    expect(response.warnings.some((warning) => warning.includes("No usable evidence"))).toBe(true);
    expect(llm.callCount).toBe(2);
  });
});
