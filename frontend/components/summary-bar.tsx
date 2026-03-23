import React from "react";
import type { AnalyzeResponse } from "@veritas/shared";

function formatProbability(value: number | null) {
  return value === null ? "N/A" : `${value}%`;
}

export function SummaryBar({ result }: { result: AnalyzeResponse }) {
  return (
    <section className="summary-grid">
      <article className="score-card">
        <p className="eyebrow">Overall Accuracy</p>
        <div className="score-value">{result.overall_accuracy}</div>
        <p className="score-subtitle">Weighted by per-claim confidence and evidence-backed verdicts.</p>
      </article>

      <article className="summary-card">
        <p className="eyebrow">Verdict Distribution</p>
        <div className="distribution-grid">
          <div>
            <strong>{result.verdict_distribution.TRUE}</strong>
            <span>True</span>
          </div>
          <div>
            <strong>{result.verdict_distribution.PARTIAL}</strong>
            <span>Partial</span>
          </div>
          <div>
            <strong>{result.verdict_distribution.FALSE}</strong>
            <span>False</span>
          </div>
          <div>
            <strong>{result.verdict_distribution.UNVERIFIABLE}</strong>
            <span>Unverifiable</span>
          </div>
        </div>
      </article>

      <article className="summary-card">
        <p className="eyebrow">AI Signals</p>
        <div className="signal-pair">
          <div>
            <strong>{formatProbability(result.ai_text_probability)}</strong>
            <span>Text probability</span>
          </div>
          <div>
            <strong>{formatProbability(result.ai_image_probability)}</strong>
            <span>Image probability</span>
          </div>
        </div>
      </article>
    </section>
  );
}
