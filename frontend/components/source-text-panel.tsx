import React from "react";
import { segmentSentences, type ClaimResult } from "@veritas/shared";
import clsx from "clsx";

export function SourceTextPanel({
  sourceText,
  claims,
  activeClaimId
}: {
  sourceText: string;
  claims: ClaimResult[];
  activeClaimId: string | null;
}) {
  const sentences = segmentSentences(sourceText);
  const activeClaim = claims.find((claim) => claim.id === activeClaimId) ?? null;
  const activeSentenceIds = new Set(activeClaim?.source_sentence_ids ?? []);
  const contextualSentenceIds = new Set(claims.flatMap((claim) => claim.source_sentence_ids));

  return (
    <div className="panel source-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Source</p>
          <h3>Input text with claim mapping</h3>
        </div>
      </div>

      <div className="source-copy">
        {sentences.map((sentence, index) => {
          const highlight = activeSentenceIds.has(index)
            ? "active"
            : contextualSentenceIds.has(index)
              ? "context"
              : "none";

          return (
            <span
              key={`${index}-${sentence.slice(0, 24)}`}
              className={clsx("source-sentence", {
                "source-sentence-active": highlight === "active",
                "source-sentence-context": highlight === "context"
              })}
              data-highlight={highlight}
            >
              <span className="sentence-index">#{index}</span>
              {sentence}{" "}
            </span>
          );
        })}
      </div>
    </div>
  );
}
