import { VerdictSchema } from "@veritas/shared";
import type { Citation, Verdict } from "@veritas/shared";
import { z } from "zod";

import { GeminiClient } from "../providers/gemini-client.js";
import { clamp, overlapScore } from "../utils/text.js";

const VerificationSchema = z.object({
  verdict: VerdictSchema,
  confidence: z.number().min(0).max(100),
  reasoning: z.string().min(12),
  conflict: z.boolean(),
  conflict_explanation: z.string().optional()
});

const BatchVerificationSchema = z.object({
  items: z.array(
    z.object({
      claim_id: z.number().int().nonnegative(),
      verdict: VerdictSchema,
      confidence: z.number().min(0).max(100),
      reasoning: z.string().min(12),
      conflict: z.boolean(),
      conflict_explanation: z.string().optional()
    })
  )
});

export interface VerificationResult {
  verdict: Verdict;
  confidence: number;
  reasoning: string;
  conflict: boolean;
  conflict_explanation?: string;
  warnings: string[];
}

function authorityWeight(sourceType: string): number {
  switch (sourceType) {
    case "government":
      return 1;
    case "academic":
      return 0.95;
    case "news":
      return 0.85;
    case "organization":
      return 0.75;
    default:
      return 0.65;
  }
}

function heuristicVerification(claim: string, citations: Citation[], warning?: string): VerificationResult {
  const contradictionPattern =
    /\b(false|fake|hoax|debunked|misleading|incorrect|not true|no evidence|fabricated|scam)\b/i;

  const scored = citations.map((citation) => {
    const evidenceText = `${citation.title} ${citation.snippet}`;
    const overlap = overlapScore(claim, evidenceText);
    const authority = authorityWeight(citation.source_type);
    const supportScore = overlap * authority;
    const contradiction = contradictionPattern.test(evidenceText);

    return {
      citation,
      overlap,
      authority,
      supportScore,
      contradiction
    };
  });

  const strongSupport = scored.filter((item) => item.supportScore >= 0.22);
  const contradictionHits = scored.filter(
    (item) => item.contradiction && item.overlap >= 0.15
  );
  const averageSupport =
    scored.reduce((sum, item) => sum + item.supportScore, 0) / Math.max(1, scored.length);
  const bestSupport = Math.max(...scored.map((item) => item.supportScore), 0);

  if (strongSupport.length >= 2 && contradictionHits.length === 0) {
    return {
      verdict: "TRUE",
      confidence: Math.round(clamp(58 + bestSupport * 60)),
      reasoning:
        "Multiple retrieved sources independently align with the claim, so the fallback verifier treats it as supported.",
      conflict: false,
      warnings: warning ? [warning] : []
    };
  }

  if (strongSupport.length >= 1 && contradictionHits.length >= 1) {
    return {
      verdict: "PARTIAL",
      confidence: Math.round(clamp(46 + bestSupport * 35)),
      reasoning:
        "Some retrieved evidence supports the claim, but other sources use contradictory fact-check language, so the fallback marks this as mixed.",
      conflict: true,
      conflict_explanation:
        "Retrieved sources contain both supporting evidence and contradiction-oriented wording.",
      warnings: warning ? [warning] : []
    };
  }

  if (contradictionHits.length >= 1 && strongSupport.length === 0) {
    return {
      verdict: "FALSE",
      confidence: Math.round(clamp(50 + bestSupport * 25)),
      reasoning:
        "The retrieved evidence is dominated by contradiction-oriented sources, so the fallback verifier treats the claim as likely false.",
      conflict: false,
      warnings: warning ? [warning] : []
    };
  }

  if (strongSupport.length >= 1 || averageSupport >= 0.18) {
    return {
      verdict: "PARTIAL",
      confidence: Math.round(clamp(44 + bestSupport * 30)),
      reasoning:
        "The evidence overlaps with the claim, but the fallback verifier does not have enough consistent support to mark it fully true.",
      conflict: false,
      warnings: warning ? [warning] : []
    };
  }

  return {
    verdict: "UNVERIFIABLE",
    confidence: Math.round(clamp(24 + bestSupport * 15)),
    reasoning:
      "Retrieved evidence exists, but the fallback verifier could not find enough precise alignment to justify a stronger verdict.",
    conflict: false,
    warnings: warning ? [warning] : []
  };
}

export class VerificationEngine {
  constructor(private readonly llm: GeminiClient) {}

  async verify(claim: string, citations: Citation[]): Promise<VerificationResult> {
    if (citations.length === 0) {
      return {
        verdict: "UNVERIFIABLE",
        confidence: 22,
        reasoning: "No authoritative evidence was retrieved, so the claim cannot be verified reliably.",
        conflict: false,
        warnings: []
      };
    }

    if (!this.llm.isConfigured()) {
      return heuristicVerification(
        claim,
        citations,
        "Gemini is not configured, so heuristic verification was used."
      );
    }

    try {
      const prompt = [
        "You are verifying a factual claim using only the evidence provided below.",
        "Return JSON with the exact shape {\"verdict\":\"TRUE|FALSE|PARTIAL|UNVERIFIABLE\",\"confidence\":0-100,\"reasoning\":\"...\",\"conflict\":true|false,\"conflict_explanation\":\"optional\"}.",
        "Rules:",
        "- Use ONLY the evidence supplied here. Do not rely on world knowledge.",
        "- If evidence is incomplete or ambiguous, use UNVERIFIABLE.",
        "- If the evidence both supports and contradicts the claim, set conflict=true.",
        "- Keep reasoning concise and explicitly tied to the cited evidence.",
        "",
        `Claim: ${claim}`,
        "",
        "Evidence:",
        ...citations.map(
          (citation, index) =>
            `[${index + 1}] ${citation.title}\nURL: ${citation.url}\nSnippet: ${citation.snippet}`
        )
      ].join("\n");

      const response = await this.llm.generateJson({
        prompt,
        schema: VerificationSchema
      });

      return {
        verdict: response?.verdict ?? "UNVERIFIABLE",
        confidence: Math.round(response?.confidence ?? 25),
        reasoning: response?.reasoning ?? "The retrieved evidence was insufficient for a reliable determination.",
        conflict: Boolean(response?.conflict),
        conflict_explanation: response?.conflict_explanation,
        warnings: []
      };
    } catch (error) {
      return heuristicVerification(
        claim,
        citations,
        error instanceof Error
          ? `Verification fell back to heuristics: ${error.message}`
          : "Verification fell back to heuristics."
      );
    }
  }

  async verifyMany(inputs: Array<{ claim: string; citations: Citation[] }>): Promise<VerificationResult[]> {
    if (inputs.length === 0) {
      return [];
    }

    const baseResults: Array<{ claim: string; result: VerificationResult | null }> = inputs.map(
      ({ claim, citations }) => {
      if (citations.length === 0) {
        return {
          claim,
          result: {
            verdict: "UNVERIFIABLE" as const,
            confidence: 22,
            reasoning: "No authoritative evidence was retrieved, so the claim cannot be verified reliably.",
            conflict: false,
            warnings: []
          }
        };
      }

      return {
        claim,
        result: null
      };
      }
    );

    const pending = inputs
      .map((input, index) => ({ ...input, index }))
      .filter((input) => input.citations.length > 0);

    if (pending.length === 0) {
      return baseResults.map((item) => item.result!);
    }

    if (!this.llm.isConfigured()) {
      for (const item of pending) {
        baseResults[item.index] = {
          claim: item.claim,
          result: heuristicVerification(
            item.claim,
            item.citations,
            "Gemini is not configured, so heuristic verification was used."
          )
        };
      }

      return baseResults.map((item) => item.result!);
    }

    try {
      const prompt = [
        "You are verifying multiple factual claims using only the evidence provided below.",
        "Return JSON with the exact shape {\"items\":[{\"claim_id\":0,\"verdict\":\"TRUE|FALSE|PARTIAL|UNVERIFIABLE\",\"confidence\":0-100,\"reasoning\":\"...\",\"conflict\":true|false,\"conflict_explanation\":\"optional\"}]}",
        "Rules:",
        "- Use ONLY the evidence supplied here. Do not rely on world knowledge.",
        "- Return one item for every claim_id listed below.",
        "- If evidence is incomplete or ambiguous, use UNVERIFIABLE.",
        "- If the evidence both supports and contradicts the claim, set conflict=true.",
        "- Keep reasoning concise and explicitly tied to the cited evidence.",
        "",
        ...pending.flatMap((item) => [
          `Claim [${item.index}]: ${item.claim}`,
          "Evidence:",
          ...item.citations.map(
            (citation, citationIndex) =>
              `  [${item.index}.${citationIndex + 1}] ${citation.title}\n  URL: ${citation.url}\n  Snippet: ${citation.snippet}`
          ),
          ""
        ])
      ].join("\n");

      const response = await this.llm.generateJson({
        prompt,
        schema: BatchVerificationSchema
      });

      const byId = new Map((response?.items ?? []).map((item) => [item.claim_id, item]));

      for (const item of pending) {
        const verified = byId.get(item.index);
        if (verified) {
          baseResults[item.index] = {
            claim: item.claim,
            result: {
              verdict: verified.verdict,
              confidence: Math.round(verified.confidence),
              reasoning: verified.reasoning,
              conflict: Boolean(verified.conflict),
              conflict_explanation: verified.conflict_explanation,
              warnings: []
            }
          };
          continue;
        }

        baseResults[item.index] = {
          claim: item.claim,
          result: heuristicVerification(
            item.claim,
            item.citations,
            "Verification fell back to heuristics because the batched Gemini response missed this claim."
          )
        };
      }

      return baseResults.map((item) => item.result!);
    } catch (error) {
      const warning =
        error instanceof Error
          ? `Verification fell back to heuristics: ${error.message}`
          : "Verification fell back to heuristics.";

      for (const item of pending) {
        baseResults[item.index] = {
          claim: item.claim,
          result: heuristicVerification(item.claim, item.citations, warning)
        };
      }

      return baseResults.map((item) => item.result!);
    }
  }
}
