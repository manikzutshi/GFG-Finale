import type { DiscoveredImage } from "./source-ingestion.js";

import { OptionalDetectionApiClient } from "../providers/optional-detection-api.js";
import {
  clamp,
  containsTemplatePhrases,
  lexicalDiversity,
  repeatedTrigramRatio,
  sentenceStats,
  tokenize
} from "../utils/text.js";

export function heuristicTextProbability(text: string): number {
  const tokens = tokenize(text);
  if (tokens.length === 0) {
    return 0;
  }

  const diversity = lexicalDiversity(text);
  const stats = sentenceStats(text);
  const repetition = repeatedTrigramRatio(text);
  const templateHits = containsTemplatePhrases(text);

  let score = 18;

  if (diversity < 0.42) {
    score += 22;
  } else if (diversity < 0.5) {
    score += 12;
  }

  if (stats.variance < 20) {
    score += 18;
  } else if (stats.variance < 35) {
    score += 8;
  }

  if (stats.average > 20) {
    score += 6;
  }

  score += repetition * 100;
  score += templateHits * 9;

  if (tokens.length < 60) {
    score -= 8;
  }

  return Math.round(clamp(score));
}

export function heuristicImageProbability(images: DiscoveredImage[]): number | null {
  if (images.length === 0) {
    return null;
  }

  const imageScores = images.map((image) => {
    const combined = `${image.url} ${image.alt ?? ""} ${image.title ?? ""}`.toLowerCase();
    let score = 10;

    if (/(midjourney|dall-e|openai|stable-diffusion|stability|leonardo|firefly|generated)/.test(combined)) {
      score += 48;
    }

    if (/(ai[-_ ]?art|synthetic|rendered|concept art)/.test(combined)) {
      score += 22;
    }

    if (/\b(img|image)[-_]?\d{4,}\b/.test(combined)) {
      score += 6;
    }

    return clamp(score);
  });

  return Math.round(imageScores.reduce((sum, value) => sum + value, 0) / imageScores.length);
}

function blendProbabilities(heuristicScore: number | null, apiScore: number | null): number | null {
  if (heuristicScore === null && apiScore === null) {
    return null;
  }
  if (heuristicScore === null) {
    return apiScore;
  }
  if (apiScore === null) {
    return heuristicScore;
  }

  return Math.round(heuristicScore * 0.35 + apiScore * 0.65);
}

export class AiDetectionService {
  constructor(private readonly apiClient: OptionalDetectionApiClient) {}

  async detect(text: string, images: DiscoveredImage[]): Promise<{
    aiTextProbability: number | null;
    aiImageProbability: number | null;
    warnings: string[];
  }> {
    const warnings: string[] = [];
    const textHeuristic = heuristicTextProbability(text);
    const imageHeuristic = heuristicImageProbability(images);

    let apiTextScore: number | null = null;
    let apiImageScore: number | null = null;

    if (this.apiClient.isConfigured()) {
      try {
        apiTextScore = await this.apiClient.detect("text", { text });
      } catch (error) {
        warnings.push(
          error instanceof Error
            ? `Optional AI text detection API failed: ${error.message}`
            : "Optional AI text detection API failed."
        );
      }

      if (images.length > 0) {
        try {
          apiImageScore = await this.apiClient.detect("images", { images });
        } catch (error) {
          warnings.push(
            error instanceof Error
              ? `Optional AI image detection API failed: ${error.message}`
              : "Optional AI image detection API failed."
          );
        }
      }
    }

    return {
      aiTextProbability: blendProbabilities(textHeuristic, apiTextScore),
      aiImageProbability: blendProbabilities(imageHeuristic, apiImageScore),
      warnings
    };
  }
}
