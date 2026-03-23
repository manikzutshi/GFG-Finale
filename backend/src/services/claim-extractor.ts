import { z } from "zod";

import { GeminiClient } from "../providers/gemini-client.js";
import { normalizeText, selectFallbackClaims } from "../utils/text.js";

export interface ExtractedClaim {
  claim: string;
  sourceSentenceIds: number[];
}

const ClaimExtractionSchema = z.object({
  claims: z.array(
    z.object({
      claim: z.string().min(10),
      source_sentence_ids: z.array(z.number().int().nonnegative()).min(1)
    })
  )
});

export class ClaimExtractor {
  constructor(private readonly llm: GeminiClient) {}

  async extract(sentences: string[]): Promise<{ claims: ExtractedClaim[]; warnings: string[] }> {
    const fallbackClaims = selectFallbackClaims(sentences);
    const warnings: string[] = [];

    if (!this.llm.isConfigured()) {
      if (fallbackClaims.length === 0) {
        warnings.push("Gemini is not configured and no clear factual claims were found heuristically.");
      }

      return { claims: fallbackClaims, warnings };
    }

    try {
      const limitedSentences = sentences.slice(0, 45);
      const prompt = [
        "You extract atomic factual claims from text.",
        "Return JSON with the shape {\"claims\":[{\"claim\":\"...\",\"source_sentence_ids\":[0]}]} only.",
        "Rules:",
        "- Only include factual, externally verifiable claims.",
        "- Ignore opinions, calls to action, rhetorical questions, and vague statements.",
        "- Keep each claim atomic and preserve the original meaning.",
        "- Use only source sentence IDs that appear below.",
        "- Return at most 3 claims.",
        "",
        "Source sentences:",
        ...limitedSentences.map((sentence, index) => `[${index}] ${sentence}`)
      ].join("\n");

      const response = await this.llm.generateJson({
        prompt,
        schema: ClaimExtractionSchema
      });

      const claims = Array.from(
        new Map(
          (response?.claims ?? [])
            .map((item) => ({
              claim: normalizeText(item.claim),
              sourceSentenceIds: Array.from(
                new Set(item.source_sentence_ids.filter((value) => value >= 0 && value < sentences.length))
              )
            }))
            .filter((item) => item.claim && item.sourceSentenceIds.length > 0)
            .map((item) => [item.claim.toLowerCase(), item] as const)
        ).values()
      ).slice(0, 3);

      if (claims.length > 0) {
        return { claims, warnings };
      }

      warnings.push("Gemini did not return any usable claims, so heuristic extraction was used.");
    } catch (error) {
      warnings.push(
        error instanceof Error
          ? `Claim extraction fell back to heuristics: ${error.message}`
          : "Claim extraction fell back to heuristics."
      );
    }

    if (fallbackClaims.length === 0) {
      warnings.push("No verifiable claims were found in the submitted text.");
    }

    return { claims: fallbackClaims, warnings };
  }
}
