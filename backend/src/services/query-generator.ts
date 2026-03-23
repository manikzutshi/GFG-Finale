import { z } from "zod";

import { GeminiClient } from "../providers/gemini-client.js";
import { createFallbackQueries } from "../utils/text.js";

const QuerySchema = z.object({
  queries: z.array(z.string().min(4)).min(3).max(5)
});

const BatchQuerySchema = z.object({
  items: z.array(
    z.object({
      claim_id: z.number().int().nonnegative(),
      queries: z.array(z.string().min(4)).min(3).max(5)
    })
  )
});

export class QueryGenerator {
  constructor(private readonly llm: GeminiClient) {}

  async generate(claim: string): Promise<{ queries: string[]; warnings: string[] }> {
    const fallbackQueries = createFallbackQueries(claim);
    const warnings: string[] = [];

    if (!this.llm.isConfigured()) {
      return { queries: fallbackQueries, warnings };
    }

    try {
      const prompt = [
        "You generate diverse search queries for evidence retrieval.",
        "Return JSON with the shape {\"queries\":[\"...\"]} only.",
        "Rules:",
        "- Provide 3 to 5 queries.",
        "- Prioritize authoritative sources and neutral phrasing.",
        "- Keep queries short and evidence-seeking.",
        "",
        `Claim: ${claim}`
      ].join("\n");

      const response = await this.llm.generateJson({
        prompt,
        schema: QuerySchema
      });

      const queries = Array.from(new Set((response?.queries ?? []).map((value) => value.trim()).filter(Boolean))).slice(0, 5);
      if (queries.length >= 3) {
        return { queries, warnings };
      }

      warnings.push("Query generation returned too few usable queries, so deterministic fallbacks were used.");
    } catch (error) {
      warnings.push(
        error instanceof Error
          ? `Query generation fell back to deterministic queries: ${error.message}`
          : "Query generation fell back to deterministic queries."
      );
    }

    return { queries: fallbackQueries, warnings };
  }

  async generateMany(claims: string[]): Promise<Array<{ queries: string[]; warnings: string[] }>> {
    const fallbacks = claims.map((claim) => ({
      queries: createFallbackQueries(claim),
      warnings: [] as string[]
    }));

    if (!this.llm.isConfigured() || claims.length === 0) {
      return fallbacks;
    }

    try {
      const prompt = [
        "You generate diverse search queries for evidence retrieval.",
        "Return JSON with the shape {\"items\":[{\"claim_id\":0,\"queries\":[\"...\"]}]} only.",
        "Rules:",
        "- For every claim_id below, provide 3 to 5 queries.",
        "- Prioritize authoritative sources and neutral phrasing.",
        "- Keep queries short and evidence-seeking.",
        "- Preserve claim_id values exactly.",
        "",
        "Claims:",
        ...claims.map((claim, index) => `[${index}] ${claim}`)
      ].join("\n");

      const response = await this.llm.generateJson({
        prompt,
        schema: BatchQuerySchema
      });

      const byId = new Map(
        (response?.items ?? []).map((item) => [
          item.claim_id,
          Array.from(new Set(item.queries.map((value) => value.trim()).filter(Boolean))).slice(0, 5)
        ])
      );

      return claims.map((claim, index) => {
        const queries = byId.get(index);
        if (queries && queries.length >= 3) {
          return {
            queries,
            warnings: []
          };
        }

        return {
          queries: createFallbackQueries(claim),
          warnings: ["Batched query generation returned too few usable queries, so deterministic fallbacks were used."]
        };
      });
    } catch (error) {
      const warning =
        error instanceof Error
          ? `Query generation fell back to deterministic queries: ${error.message}`
          : "Query generation fell back to deterministic queries.";

      return claims.map((claim) => ({
        queries: createFallbackQueries(claim),
        warnings: [warning]
      }));
    }
  }
}
