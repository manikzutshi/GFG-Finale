import { describe, expect, it } from "vitest";

import { rankEvidence } from "../src/services/evidence-service.js";

describe("rankEvidence", () => {
  it("prefers authoritative domains with matching evidence", () => {
    const ranked = rankEvidence(
      [
        {
          title: "CDC confirms case counts",
          url: "https://www.cdc.gov/example",
          snippet: "The CDC reported 100 confirmed cases in the latest update.",
          score: 0.8,
          published_at: new Date().toISOString()
        },
        {
          title: "Random forum",
          url: "https://forum.example.com/thread",
          snippet: "I heard there were about 100 cases.",
          score: 0.9
        }
      ],
      "The CDC reported 100 confirmed cases."
    );

    expect(ranked[0]?.source_type).toBe("government");
    expect(ranked[0]?.url).toContain("cdc.gov");
  });
});

