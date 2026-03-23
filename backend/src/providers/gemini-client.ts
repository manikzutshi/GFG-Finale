import { z } from "zod";

import { extractJsonFromText } from "../utils/json.js";

type FetchLike = typeof fetch;

export class GeminiClient {
  constructor(
    private readonly apiKey: string | undefined,
    private readonly model: string,
    private readonly fetchImpl: FetchLike = fetch
  ) {}

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  async generateJson<T>({
    prompt,
    schema,
    temperature = 0.2
  }: {
    prompt: string;
    schema: z.ZodType<T>;
    temperature?: number;
  }): Promise<T | null> {
    if (!this.apiKey) {
      return null;
    }

    const maxRetries = 3;
    let response: Response | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      response = await this.fetchImpl(
        `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: prompt
                  }
                ]
              }
            ],
            generationConfig: {
              temperature,
              responseMimeType: "application/json"
            }
          })
        }
      );

      if (response.status !== 429 || attempt === maxRetries) {
        break;
      }

      // Exponential backoff: 2s, 4s, 8s
      const delay = Math.pow(2, attempt + 1) * 1000;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    if (!response!.ok) {
      throw new Error(`Gemini request failed with ${response!.status}.`);
    }

    const data = (await response!.json()) as {
      candidates?: Array<{
        content?: {
          parts?: Array<{ text?: string }>;
        };
      }>;
    };

    const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim();

    if (!text) {
      throw new Error("Gemini response did not contain text.");
    }

    return schema.parse(extractJsonFromText(text));
  }
}

