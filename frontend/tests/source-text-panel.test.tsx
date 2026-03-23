import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SourceTextPanel } from "../components/source-text-panel";

describe("SourceTextPanel", () => {
  it("marks active and contextual claim sentences", () => {
    render(
      <SourceTextPanel
        sourceText="Earth orbits the Sun. Mars has two moons. Venus is hot."
        activeClaimId="claim-2"
        claims={[
          {
            id: "claim-1",
            claim: "Earth orbits the Sun.",
            source_sentence_ids: [0],
            search_queries: [],
            verdict: "TRUE",
            confidence: 90,
            reasoning: "Supported",
            conflict: false,
            citations: []
          },
          {
            id: "claim-2",
            claim: "Mars has two moons.",
            source_sentence_ids: [1],
            search_queries: [],
            verdict: "TRUE",
            confidence: 90,
            reasoning: "Supported",
            conflict: false,
            citations: []
          }
        ]}
      />
    );

    expect(screen.getByText(/Mars has two moons/)).toHaveAttribute("data-highlight", "active");
    expect(screen.getByText(/Earth orbits the Sun/)).toHaveAttribute("data-highlight", "context");
  });
});
