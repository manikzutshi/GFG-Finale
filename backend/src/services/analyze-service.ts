import { AnalyzeResponseSchema } from "@veritas/shared";
import type { AnalyzeRequest, AnalyzeResponse, ClaimResult } from "@veritas/shared";

import { getEnv, type Env } from "../config/env.js";
import { GeminiClient } from "../providers/gemini-client.js";
import { OptionalDetectionApiClient } from "../providers/optional-detection-api.js";
import { TavilyClient } from "../providers/tavily-client.js";
import { scoreClaims } from "../utils/scoring.js";
import { TraceCollector } from "../utils/trace.js";
import { AiDetectionService } from "./ai-detection.js";
import { ClaimExtractor } from "./claim-extractor.js";
import { EvidenceService } from "./evidence-service.js";
import { QueryGenerator } from "./query-generator.js";
import { ingestSource } from "./source-ingestion.js";
import { VerificationEngine } from "./verification-engine.js";

type FetchLike = typeof fetch;

export interface AnalyzeServiceDeps {
  env?: Env;
  fetchImpl?: FetchLike;
  llm?: GeminiClient;
  searchClient?: TavilyClient;
  detectionApiClient?: OptionalDetectionApiClient;
}

export class AnalyzeService {
  private readonly env: Env;
  private readonly fetchImpl: FetchLike;
  private readonly claimExtractor: ClaimExtractor;
  private readonly queryGenerator: QueryGenerator;
  private readonly evidenceService: EvidenceService;
  private readonly verificationEngine: VerificationEngine;
  private readonly detectionService: AiDetectionService;

  constructor(deps: AnalyzeServiceDeps = {}) {
    this.env = deps.env ?? getEnv();
    this.fetchImpl = deps.fetchImpl ?? fetch;

    const llm =
      deps.llm ??
      new GeminiClient(this.env.GEMINI_API_KEY, this.env.GEMINI_MODEL, this.fetchImpl);
    const searchClient =
      deps.searchClient ?? new TavilyClient(this.env.TAVILY_API_KEY, this.fetchImpl);
    const detectionApiClient =
      deps.detectionApiClient ??
      new OptionalDetectionApiClient(
        this.env.AI_DETECTION_API_URL,
        this.env.AI_DETECTION_API_KEY,
        this.fetchImpl
      );

    this.claimExtractor = new ClaimExtractor(llm);
    this.queryGenerator = new QueryGenerator(llm);
    this.evidenceService = new EvidenceService(searchClient);
    this.verificationEngine = new VerificationEngine(llm);
    this.detectionService = new AiDetectionService(detectionApiClient);
  }

  async analyze(request: AnalyzeRequest): Promise<AnalyzeResponse> {
    const warnings = new Set<string>();
    const trace = new TraceCollector();

    const source = await trace.run(
      "ingesting",
      () =>
        ingestSource({
          inputText: request.input_text,
          inputUrl: request.input_url,
          fetchImpl: this.fetchImpl
        }),
      (result) => ({
        sentence_count: result.sentences.length,
        image_count: result.images.length,
        used_url: Boolean(request.input_url)
      })
    );
    source.warnings.forEach((warning) => warnings.add(warning));

    const extracted = await trace.run(
      "extracting",
      () => this.claimExtractor.extract(source.sentences),
      (result) => ({
        claim_count: result.claims.length
      })
    );
    extracted.warnings.forEach((warning) => warnings.add(warning));

    const searchBundles = await trace.run(
      "searching",
      async () => {
        const queryBundles = await this.queryGenerator.generateMany(
          extracted.claims.map((claim) => claim.claim)
        );

        return Promise.all(
          extracted.claims.map(async (claim, index) => {
            const queries = queryBundles[index] ?? {
              queries: [],
              warnings: []
            };
            queries.warnings.forEach((warning) => warnings.add(warning));

            const evidence = await this.evidenceService.gather(claim.claim, queries.queries);
            evidence.warnings.forEach((warning) => warnings.add(warning));

            return {
              claim,
              queries: queries.queries,
              citations: evidence.citations
            };
          })
        );
      },
      (result) => ({
        searched_claims: result.length,
        evidence_count: result.reduce((sum, item) => sum + item.citations.length, 0)
      })
    );

    const verified = await trace.run(
      "verifying",
      async () => {
        const verificationResults = await this.verificationEngine.verifyMany(
          searchBundles.map(({ claim, citations }) => ({
            claim: claim.claim,
            citations
          }))
        );

        return searchBundles.map(({ claim, queries, citations }, index) => {
          const verification = verificationResults[index];
          verification?.warnings.forEach((warning) => warnings.add(warning));

          const result: ClaimResult = {
            id: `claim-${index + 1}`,
            claim: claim.claim,
            source_sentence_ids: claim.sourceSentenceIds,
            search_queries: queries,
            verdict: verification?.verdict ?? "UNVERIFIABLE",
            confidence: verification?.confidence ?? 22,
            reasoning:
              verification?.reasoning ??
              "No authoritative evidence was retrieved, so the claim cannot be verified reliably.",
            conflict: verification?.conflict ?? false,
            conflict_explanation: verification?.conflict_explanation,
            citations
          };

          return result;
        });
      },
      (result) => ({
        verified_claims: result.length
      })
    );

    const aiSignals = await trace.run(
      "ai-detection",
      () => this.detectionService.detect(source.sourceText, source.images),
      (result) => ({
        has_image_probability: result.aiImageProbability !== null
      })
    );
    aiSignals.warnings.forEach((warning) => warnings.add(warning));

    const { overallAccuracy, verdictDistribution } = scoreClaims(verified);

    return AnalyzeResponseSchema.parse({
      source_text: source.sourceText,
      overall_accuracy: overallAccuracy,
      verdict_distribution: verdictDistribution,
      claims: verified,
      ai_text_probability: aiSignals.aiTextProbability,
      ai_image_probability: aiSignals.aiImageProbability,
      warnings: Array.from(warnings),
      trace: trace.list()
    });
  }
}
