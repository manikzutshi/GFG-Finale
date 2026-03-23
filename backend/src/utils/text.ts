import { normalizeWhitespace, segmentSentences } from "@veritas/shared";

const STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "that",
  "the",
  "to",
  "was",
  "were",
  "will",
  "with"
]);

const OPINION_PATTERN =
  /\b(i think|i believe|in my opinion|amazing|terrible|wonderful|awful|should|could|might|probably|possibly)\b/i;
const FACT_PATTERN =
  /\b(is|are|was|were|has|have|had|includes|contains|founded|born|died|announced|reported|launched|won|lost|located|recorded|measured|released)\b|[%\d]/i;

export function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, value));
}

export function normalizeText(text: string): string {
  return normalizeWhitespace(text);
}

export function tokenize(text: string): string[] {
  return normalizeText(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

export function extractKeyTerms(text: string): string[] {
  return Array.from(
    new Set(
      tokenize(text).filter((token) => token.length > 3 && !STOPWORDS.has(token))
    )
  ).slice(0, 8);
}

export function overlapScore(claim: string, evidence: string): number {
  const claimTerms = extractKeyTerms(claim);
  if (claimTerms.length === 0) {
    return 0;
  }

  const evidenceTokens = new Set(tokenize(evidence));
  const hits = claimTerms.filter((term) => evidenceTokens.has(term)).length;
  return hits / claimTerms.length;
}

export function looksFactual(sentence: string): boolean {
  const normalized = normalizeText(sentence);
  if (normalized.length < 25 || normalized.length > 280) {
    return false;
  }

  if (normalized.endsWith("?") || OPINION_PATTERN.test(normalized)) {
    return false;
  }

  return FACT_PATTERN.test(normalized) || /\b[A-Z][a-z]+(?:\s[A-Z][a-z]+)+\b/.test(normalized);
}

export function selectFallbackClaims(
  sentences: string[],
  limit = 3
): Array<{ claim: string; sourceSentenceIds: number[] }> {
  return sentences
    .map((sentence, index) => ({ sentence, index }))
    .filter(({ sentence }) => looksFactual(sentence))
    .slice(0, limit)
    .map(({ sentence, index }) => ({
      claim: sentence,
      sourceSentenceIds: [index]
    }));
}

export function createFallbackQueries(claim: string): string[] {
  const terms = extractKeyTerms(claim);
  const keywordString = terms.slice(0, 4).join(" ");
  const base = normalizeText(claim);
  const queries = [
    base,
    `${keywordString || base} official source`,
    `${keywordString || base} Reuters AP fact check`,
    `${keywordString || base} statistics report`
  ];

  return Array.from(new Set(queries.map((query) => query.trim()).filter(Boolean))).slice(0, 5);
}

export function sentenceStats(text: string): { average: number; variance: number; count: number } {
  const sentences = segmentSentences(text);
  if (sentences.length === 0) {
    return { average: 0, variance: 0, count: 0 };
  }

  const lengths = sentences.map((sentence) => tokenize(sentence).length);
  const average = lengths.reduce((sum, value) => sum + value, 0) / lengths.length;
  const variance =
    lengths.reduce((sum, value) => sum + (value - average) ** 2, 0) / Math.max(1, lengths.length);

  return { average, variance, count: lengths.length };
}

export function lexicalDiversity(text: string): number {
  const tokens = tokenize(text);
  if (tokens.length === 0) {
    return 0;
  }

  return new Set(tokens).size / tokens.length;
}

export function repeatedTrigramRatio(text: string): number {
  const tokens = tokenize(text);
  if (tokens.length < 6) {
    return 0;
  }

  const counts = new Map<string, number>();
  for (let index = 0; index <= tokens.length - 3; index += 1) {
    const trigram = tokens.slice(index, index + 3).join(" ");
    counts.set(trigram, (counts.get(trigram) ?? 0) + 1);
  }

  const repeats = Array.from(counts.values()).filter((count) => count > 1).length;
  return repeats / counts.size;
}

export function containsTemplatePhrases(text: string): number {
  const patterns = [
    /in today's fast-paced/i,
    /it is important to note/i,
    /overall[, ]/i,
    /in conclusion/i,
    /furthermore/i,
    /moreover/i
  ];

  return patterns.filter((pattern) => pattern.test(text)).length;
}
