import { describe, expect, it } from "vitest";

import { AnalyzeResponseSchema, segmentSentences } from "./index";

describe("@veritas/shared", () => {
  it("segments sentences consistently", () => {
    const sentences = segmentSentences("Earth orbits the Sun. Mars is red! Is Venus hotter?");

    expect(sentences).toEqual(["Earth orbits the Sun.", "Mars is red!", "Is Venus hotter?"]);
  });

  it("validates analyze responses", () => {
    const parsed = AnalyzeResponseSchema.parse({
      source_text: "Example text.",
      overall_accuracy: 75,
      verdict_distribution: {
        TRUE: 1,
        FALSE: 0,
        PARTIAL: 0,
        UNVERIFIABLE: 0
      },
      claims: [],
      ai_text_probability: 42,
      ai_image_probability: null,
      warnings: [],
      trace: []
    });

    expect(parsed.overall_accuracy).toBe(75);
  });
});
