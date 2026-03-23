import type { ClaimResult, VerdictDistribution } from "@veritas/shared";

const VERDICT_WEIGHTS: Record<ClaimResult["verdict"], number> = {
  TRUE: 1,
  PARTIAL: 0.5,
  FALSE: 0,
  UNVERIFIABLE: 0.25
};

export function scoreClaims(claims: ClaimResult[]): {
  overallAccuracy: number;
  verdictDistribution: VerdictDistribution;
} {
  const verdictDistribution: VerdictDistribution = {
    TRUE: 0,
    FALSE: 0,
    PARTIAL: 0,
    UNVERIFIABLE: 0
  };

  if (claims.length === 0) {
    return { overallAccuracy: 0, verdictDistribution };
  }

  let weightedScore = 0;
  let confidenceWeight = 0;

  for (const claim of claims) {
    verdictDistribution[claim.verdict] += 1;

    const normalizedConfidence = Math.max(0.15, claim.confidence / 100);
    confidenceWeight += normalizedConfidence;
    weightedScore += VERDICT_WEIGHTS[claim.verdict] * normalizedConfidence;
  }

  return {
    overallAccuracy: Math.round((weightedScore / confidenceWeight) * 100),
    verdictDistribution
  };
}

