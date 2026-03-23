"use client";

import React from "react";
import { useState } from "react";

import { verdictToTone, type ClaimResult } from "@veritas/shared";
import clsx from "clsx";
import html2canvas from "html2canvas";
import { Download, Link } from "lucide-react";

import { FlashcardExport } from "./flashcard-export";

export function ClaimCard({
  claim,
  active,
  onFocus
}: {
  claim: ClaimResult;
  active: boolean;
  onFocus: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const tone = verdictToTone(claim.verdict);
  const cardRef = React.useRef<HTMLElement>(null);
  const exportRef = React.useRef<HTMLDivElement>(null);

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!exportRef.current) return;
    try {
      const canvas = await html2canvas(exportRef.current, {
        scale: 2,

      });
      const dataUrl = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.download = `veritas-fact-check-${claim.id}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Failed to generate image", err);
    }
  };

  return (
    <>
      <FlashcardExport ref={exportRef} claim={claim} />
      <article
        ref={cardRef}
      className={clsx("claim-card", `claim-card-${tone}`, "animate-pop-in", {
        "claim-card-active": active
      })}
      style={{ position: "relative" }}
      onMouseEnter={onFocus}
      onFocus={onFocus}
      tabIndex={0}
    >
      <div className="claim-card-header">
        <div>
          <span className={`verdict-pill verdict-pill-${tone}`}>{claim.verdict}</span>
          <h4 style={{ marginTop: "12px", marginBottom: "8px" }}>{claim.claim}</h4>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <div className="confidence-pill">{claim.confidence}%</div>
          <button
            onClick={handleShare}
            className="citation-toggle"
            title="Download Flashcard"
            style={{ padding: "6px", display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <Download size={16} />
          </button>
        </div>
      </div>

      <p className="claim-reasoning">{claim.reasoning}</p>

      {claim.conflict ? (
        <div className="conflict-banner">
          <strong>Source conflict</strong>
          <span>{claim.conflict_explanation ?? "Retrieved sources disagree materially on this claim."}</span>
        </div>
      ) : null}

      <div className="query-row">
        {claim.search_queries.slice(0, 3).map((query) => (
          <span key={query} className="query-chip">
            {query}
          </span>
        ))}
      </div>

      <button className="citation-toggle" type="button" onClick={() => setExpanded((value) => !value)}>
        {expanded ? "Hide citations" : `Show citations (${claim.citations.length})`}
      </button>

      {expanded ? (
        <div className="citation-list" data-html2canvas-ignore>
          {claim.citations.map((citation) => (
            <a
              key={citation.url}
              className="citation-item"
              href={citation.url}
              target="_blank"
              rel="noreferrer"
            >
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <strong>{citation.title}</strong>
                <Link size={14} style={{ opacity: 0.5 }} />
              </div>
              <span className="source-domain">{new URL(citation.url).hostname}</span>
              <p>{citation.snippet}</p>

              {/* Assuming citation might have an image URL in the future if added to schema */}
              {/* @ts-expect-error - image_url might not be in the schema yet but we want to prep for it */}
              {citation.image_url && (
                <img
                  // @ts-expect-error
                  src={citation.image_url}
                  alt="Citation Reference"
                  style={{ width: "100%", maxHeight: "200px", objectFit: "cover", borderRadius: "8px", marginTop: "10px" }}
                />
              )}
            </a>
          ))}
        </div>
      ) : null}
    </article>
    </>
  );
}
