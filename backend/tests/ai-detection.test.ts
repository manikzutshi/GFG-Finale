import { describe, expect, it } from "vitest";

import { heuristicImageProbability, heuristicTextProbability } from "../src/services/ai-detection.js";

describe("AI detection heuristics", () => {
  it("flags templated low-variance text more aggressively", () => {
    const score = heuristicTextProbability(
      "Furthermore, it is important to note that this platform delivers value. " +
        "Furthermore, it is important to note that this platform delivers value. " +
        "Furthermore, it is important to note that this platform delivers value."
    );

    expect(score).toBeGreaterThan(45);
  });

  it("returns null for image detection without images", () => {
    expect(heuristicImageProbability([])).toBeNull();
  });

  it("boosts probability when image metadata hints at generated media", () => {
    const score = heuristicImageProbability([
      {
        url: "https://cdn.example.com/midjourney-generated-image.png",
        alt: "AI generated concept art"
      }
    ]);

    expect(score).toBeGreaterThan(50);
  });
});

