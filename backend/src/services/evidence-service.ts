import type { Citation } from "@veritas/shared";

import type { TavilySearchHit } from "../providers/tavily-client.js";
import { TavilyClient } from "../providers/tavily-client.js";
import { overlapScore } from "../utils/text.js";

export interface RankedEvidence extends Citation {
  rank: number;
}

function domainAuthority(hostname: string): number {
  const host = hostname.toLowerCase();

  if (host.endsWith(".gov")) {
    return 24;
  }
  if (host.endsWith(".edu")) {
    return 20;
  }
  if (/(reuters|apnews|bbc|nytimes|nature|science|who\.int|un\.org|cdc\.gov|nasa\.gov)/.test(host)) {
    return 18;
  }
  if (host.endsWith(".org")) {
    return 12;
  }
  if (host.endsWith(".com")) {
    return 8;
  }

  return 5;
}

function inferSourceType(hostname: string): string {
  const host = hostname.toLowerCase();

  if (host.endsWith(".gov")) {
    return "government";
  }
  if (host.endsWith(".edu")) {
    return "academic";
  }
  if (/(reuters|apnews|bbc|nytimes|wsj|economist)/.test(host)) {
    return "news";
  }
  if (host.endsWith(".org")) {
    return "organization";
  }

  return "web";
}

function recencyBoost(publishedAt?: string): number {
  if (!publishedAt) {
    return 0;
  }

  const publishedMs = Date.parse(publishedAt);
  if (Number.isNaN(publishedMs)) {
    return 0;
  }

  const ageInDays = (Date.now() - publishedMs) / (1000 * 60 * 60 * 24);
  if (ageInDays < 30) {
    return 10;
  }
  if (ageInDays < 365) {
    return 6;
  }
  if (ageInDays < 365 * 3) {
    return 3;
  }

  return 0;
}

export function rankEvidence(results: TavilySearchHit[], claim: string): RankedEvidence[] {
  const unique = new Map<string, TavilySearchHit>();

  for (const result of results) {
    if (!unique.has(result.url)) {
      unique.set(result.url, result);
    }
  }

  return Array.from(unique.values())
    .map((result) => {
      const hostname = new URL(result.url).hostname;
      const titleAndSnippet = `${result.title} ${result.snippet}`;
      const relevance = overlapScore(claim, titleAndSnippet) * 35;
      const searchScore = (result.score ?? 0.5) * 30;
      const authority = domainAuthority(hostname);
      const recency = recencyBoost(result.published_at);

      return {
        title: result.title,
        url: result.url,
        snippet: result.snippet,
        published_at: result.published_at,
        source_type: inferSourceType(hostname),
        rank: Math.round(relevance + searchScore + authority + recency)
      } satisfies RankedEvidence;
    })
    .sort((left, right) => right.rank - left.rank)
    .slice(0, 5);
}

export class EvidenceService {
  constructor(private readonly searchClient: TavilyClient) {}

  async gather(claim: string, queries: string[]): Promise<{ citations: Citation[]; warnings: string[] }> {
    const warnings: string[] = [];

    if (!this.searchClient.isConfigured()) {
      warnings.push("Tavily is not configured, so live evidence retrieval was skipped.");
      return { citations: [], warnings };
    }

    const searchResults = await Promise.all(
      queries.map(async (query) => {
        try {
          return await this.searchClient.search(query);
        } catch (error) {
          warnings.push(
            error instanceof Error
              ? `Search failed for "${query}": ${error.message}`
              : `Search failed for "${query}".`
          );
          return [];
        }
      })
    );

    const ranked = rankEvidence(searchResults.flat(), claim);

    if (ranked.length === 0) {
      warnings.push(`No usable evidence was retrieved for claim: ${claim}`);
    }

    return { citations: ranked, warnings };
  }
}

