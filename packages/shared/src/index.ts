import { z } from "zod";

export const VerdictSchema = z.enum(["TRUE", "FALSE", "PARTIAL", "UNVERIFIABLE"]);

export const CitationSchema = z.object({
  title: z.string(),
  url: z.string().url(),
  snippet: z.string(),
  source_type: z.string(),
  published_at: z.string().optional()
});

export const ClaimResultSchema = z.object({
  id: z.string(),
  claim: z.string(),
  source_sentence_ids: z.array(z.number().int().nonnegative()),
  search_queries: z.array(z.string()),
  verdict: VerdictSchema,
  confidence: z.number().min(0).max(100),
  reasoning: z.string(),
  conflict: z.boolean(),
  conflict_explanation: z.string().optional(),
  citations: z.array(CitationSchema)
});

export const VerdictDistributionSchema = z.object({
  TRUE: z.number().int().nonnegative(),
  FALSE: z.number().int().nonnegative(),
  PARTIAL: z.number().int().nonnegative(),
  UNVERIFIABLE: z.number().int().nonnegative()
});

export const TraceStepSchema = z.object({
  stage: z.string(),
  started_at: z.string(),
  completed_at: z.string(),
  duration_ms: z.number().nonnegative(),
  meta: z.record(z.any()).optional()
});

export const AnalyzeRequestSchema = z
  .object({
    input_text: z.string().trim().optional(),
    input_url: z.string().url().optional()
  })
  .refine((value) => Boolean(value.input_text || value.input_url), {
    message: "Either input_text or input_url is required."
  });

export const AnalyzeResponseSchema = z.object({
  source_text: z.string(),
  overall_accuracy: z.number().min(0).max(100),
  verdict_distribution: VerdictDistributionSchema,
  claims: z.array(ClaimResultSchema),
  ai_text_probability: z.number().min(0).max(100).nullable(),
  ai_image_probability: z.number().min(0).max(100).nullable(),
  warnings: z.array(z.string()),
  trace: z.array(TraceStepSchema)
});

export type Verdict = z.infer<typeof VerdictSchema>;
export type Citation = z.infer<typeof CitationSchema>;
export type ClaimResult = z.infer<typeof ClaimResultSchema>;
export type VerdictDistribution = z.infer<typeof VerdictDistributionSchema>;
export type TraceStep = z.infer<typeof TraceStepSchema>;
export type AnalyzeRequest = z.infer<typeof AnalyzeRequestSchema>;
export type AnalyzeResponse = z.infer<typeof AnalyzeResponseSchema>;

export function segmentSentences(text: string): string[] {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return [];
  }

  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const segmenter = new Intl.Segmenter("en", { granularity: "sentence" });
    return Array.from(segmenter.segment(normalized), (entry) => entry.segment.trim()).filter(Boolean);
  }

  return normalized
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

export function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function verdictToTone(verdict: Verdict): "support" | "warn" | "danger" | "neutral" {
  switch (verdict) {
    case "TRUE":
      return "support";
    case "PARTIAL":
      return "warn";
    case "FALSE":
      return "danger";
    default:
      return "neutral";
  }
}

