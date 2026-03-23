import React, { forwardRef } from "react";
import { type ClaimResult, verdictToTone } from "@veritas/shared";

export const FlashcardExport = forwardRef<
  HTMLDivElement,
  { claim: ClaimResult; inputUrl?: string; inputText?: string }
>(({ claim, inputUrl, inputText }, ref) => {
  const tone = verdictToTone(claim.verdict);
  
  // Choose colors based on tone
  let bgColor = "#ffffff"; // pure white bg
  let borderColor = "#f1f3f5";
  let pillColor = "#333";
  let pillText = "#fff";
  let textColor = "#111827"; // nearly black text
  let subTextColor = "#4b5563"; // gray text
  let innerBg = "#f8f9fa"; // very light gray for reasoning box

  if (tone === "support") {
    borderColor = "rgba(14, 124, 102, 0.2)";
    pillColor = "#0e7c66"; // Veritas Green
    pillText = "#ffffff";
  } else if (tone === "danger") {
    borderColor = "rgba(184, 64, 49, 0.2)";
    pillColor = "#b84031"; // Red
    pillText = "#ffffff";
  } else if (tone === "warn") {
    borderColor = "rgba(199, 119, 0, 0.2)";
    pillColor = "#c77700"; // Orange
    pillText = "#ffffff";
  }

  // A sleek 1:1 Instagram-post size (1080x1080)
  return (
    <div
      style={{
        position: "absolute",
        left: "-9999px",
        top: 0
      }}
    >
      <div
        ref={ref}
        style={{
          width: "1080px",
          height: "1080px",
          backgroundColor: bgColor,
          color: textColor,
          fontFamily: "system-ui, -apple-system, sans-serif",
          display: "flex",
          flexDirection: "column",
          padding: "80px",
          boxSizing: "border-box",
          border: `12px solid ${borderColor}`,
          position: "relative",
          overflow: "hidden"
        }}
      >
        {/* Subtle background gradient noise or shape could go here */}
        <div style={{
          position: "absolute",
          top: "-200px",
          right: "-200px",
          width: "800px",
          height: "800px",
          borderRadius: "50%",
          background: `radial-gradient(circle, ${pillColor}22 0%, transparent 70%)`,
          zIndex: 0
        }} />

        <div style={{ flex: 1, zIndex: 1, display: "flex", flexDirection: "column" }}>
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "60px" }}>
            <div style={{ fontSize: "28px", letterSpacing: "4px", fontWeight: "800", color: "#9ca3af" }}>
              VERITAS : FACT CHECK
            </div>
            <div
              style={{
                backgroundColor: pillColor,
                color: pillText,
                padding: "16px 32px",
                borderRadius: "100px",
                fontSize: "32px",
                fontWeight: "800",
                textTransform: "uppercase",
                letterSpacing: "2px",
                boxShadow: "0 10px 30px rgba(0,0,0,0.3)"
              }}
            >
              Verdict: {claim.verdict}
            </div>
          </div>

          {/* The Claim */}
          <h1 style={{ 
            fontSize: "64px", 
            fontWeight: "700", 
            lineHeight: "1.2", 
            marginBottom: "40px",
            color: textColor,
            display: "-webkit-box",
            WebkitLineClamp: 4,
            WebkitBoxOrient: "vertical",
            overflow: "hidden"
          }}>
            "{claim.claim}"
          </h1>

          {/* Reasoning */}
          <div style={{
            backgroundColor: innerBg,
            padding: "40px",
            borderRadius: "24px",
            border: "1px solid rgba(0,0,0,0.05)",
            flex: 1
          }}>
            <p style={{
              fontSize: "36px",
              lineHeight: "1.5",
              color: subTextColor,
              margin: 0,
              display: "-webkit-box",
              WebkitLineClamp: 6,
              WebkitBoxOrient: "vertical",
              overflow: "hidden"
            }}>
              {claim.reasoning}
            </p>
          </div>
          
          {/* Footer Context */}
          {inputUrl && (
            <div style={{ marginTop: "40px", fontSize: "24px", color: "#9ca3af" }}>
              Source scanned: {new URL(inputUrl).hostname}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
