import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ClaimCard } from "../components/claim-card";

describe("ClaimCard", () => {
  it("reveals citations when expanded", async () => {
    const user = userEvent.setup();

    render(
      <ClaimCard
        active={false}
        onFocus={vi.fn()}
        claim={{
          id: "claim-1",
          claim: "The Earth orbits the Sun.",
          source_sentence_ids: [0],
          search_queries: ["Earth Sun NASA"],
          verdict: "TRUE",
          confidence: 94,
          reasoning: "NASA and Britannica both support it.",
          conflict: false,
          citations: [
            {
              title: "NASA Solar System Exploration",
              url: "https://science.nasa.gov/earth",
              snippet: "Earth revolves around the Sun.",
              source_type: "government"
            }
          ]
        }}
      />
    );

    await user.click(screen.getByRole("button", { name: /show citations/i }));

    expect(screen.getByText(/NASA Solar System Exploration/)).toBeInTheDocument();
  });
});
