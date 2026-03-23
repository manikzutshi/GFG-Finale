import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { VeritasApp } from "../components/veritas-app";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("VeritasApp", () => {
  it("shows loading stages and renders results", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          source_text: "Earth orbits the Sun.",
          overall_accuracy: 88,
          verdict_distribution: {
            TRUE: 1,
            FALSE: 0,
            PARTIAL: 0,
            UNVERIFIABLE: 0
          },
          claims: [
            {
              id: "claim-1",
              claim: "Earth orbits the Sun.",
              source_sentence_ids: [0],
              search_queries: ["Earth Sun NASA"],
              verdict: "TRUE",
              confidence: 88,
              reasoning: "NASA supports this claim.",
              conflict: false,
              citations: []
            }
          ],
          ai_text_probability: 14,
          ai_image_probability: null,
          warnings: [],
          trace: [
            {
              stage: "extracting",
              started_at: new Date().toISOString(),
              completed_at: new Date().toISOString(),
              duration_ms: 10
            },
            {
              stage: "searching",
              started_at: new Date().toISOString(),
              completed_at: new Date().toISOString(),
              duration_ms: 20
            },
            {
              stage: "verifying",
              started_at: new Date().toISOString(),
              completed_at: new Date().toISOString(),
              duration_ms: 30
            }
          ]
        })
      })
    );

    render(<VeritasApp />);

    fireEvent.click(screen.getByRole("button", { name: /analyze claims/i }));

    expect(screen.getByText(/Extracting factual claims/i)).toBeInTheDocument();

    await waitFor(() => expect(screen.getByText(/Overall Accuracy/i)).toBeInTheDocument());
    expect(screen.getByText(/NASA supports this claim/i)).toBeInTheDocument();
  });

  it("shows API errors cleanly", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({
          error: "Backend unavailable."
        })
      })
    );

    render(<VeritasApp />);
    fireEvent.click(screen.getByRole("button", { name: /analyze claims/i }));

    await waitFor(() => expect(screen.getByText(/Backend unavailable/i)).toBeInTheDocument());
  });
});
