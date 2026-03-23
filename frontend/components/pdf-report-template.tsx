import React, { forwardRef } from "react";
import { type AnalyzeResponse, verdictToTone } from "@veritas/shared";

export const PdfReportTemplate = forwardRef<
  HTMLDivElement,
  { result: AnalyzeResponse; inputUrl?: string; inputText?: string }
>(({ result, inputUrl, inputText }, ref) => {
  const { verdict_distribution } = result;
  
  // Calculate percentages for a small bar chart
  const total = result.claims.length;
  const truePct = total ? (verdict_distribution.TRUE / total) * 100 : 0;
  const partialPct = total ? (verdict_distribution.PARTIAL / total) * 100 : 0;
  const falsePct = total ? (verdict_distribution.FALSE / total) * 100 : 0;
  const unverifiablePct = total ? (verdict_distribution.UNVERIFIABLE / total) * 100 : 0;

  return (
    <div
      style={{
        position: "absolute",
        left: "-9999px",
        top: 0
      }}
    >
      {/* 
        A4 aspect ratio is roughly 1:1.414. 
        Using a fixed width of 1200px, height handles itself but we aim for printable pages. 
        We use a pure white theme with deep blue/gray text for a highly professional look.
      */}
      <div
        ref={ref}
        style={{
          width: "700px",
          backgroundColor: "#ffffff",
          color: "#111827",
          fontFamily: "system-ui, -apple-system, sans-serif",
          padding: "40px",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          gap: "24px"
        }}
      >
        {/* Header Section */}
        <div style={{ borderBottom: "4px solid #f3f4f6", paddingBottom: "20px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h1 style={{ fontSize: "32px", fontWeight: "800", margin: "0 0 8px 0", letterSpacing: "-1px", color: "#111827" }}>
              Veritas Fact-Check Report
            </h1>
            <p style={{ fontSize: "14px", color: "#6b7280", margin: 0 }}>
              Generated on {new Date().toLocaleDateString()}
            </p>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "48px", fontWeight: "800", color: "#0e7c66", lineHeight: 1 }}>
              {result.overall_accuracy}<span style={{ fontSize: "24px" }}>%</span>
            </div>
            <div style={{ fontSize: "12px", textTransform: "uppercase", letterSpacing: "2px", color: "#9ca3af", marginTop: "4px" }}>
              Overall Accuracy
            </div>
          </div>
        </div>

        {/* Source Context */}
        <div style={{ backgroundColor: "#f8fafc", padding: "20px", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
          <h3 style={{ margin: "0 0 10px 0", fontSize: "14px", textTransform: "uppercase", letterSpacing: "1px", color: "#64748b" }}>Source Analyzed</h3>
          {inputUrl && <div style={{ fontSize: "16px", fontWeight: "600", color: "#3b82f6", marginBottom: "8px", overflowWrap: "break-word" }}>{inputUrl.length > 100 ? inputUrl.substring(0, 100) + "..." : inputUrl}</div>}
          <div style={{ fontSize: "14px", color: "#334155", lineHeight: "1.6" }}>
            {inputText ? (inputText.length > 250 ? inputText.substring(0, 250) + "..." : inputText) : "Content extracted dynamically from the provided URL."}
          </div>
        </div>

        {/* Statistics Row (Charts) */}
        <div className="page-break-avoid" style={{ display: "flex", gap: "24px", pageBreakInside: "avoid" }}>
          {/* Distribution Chart */}
          <div style={{ flex: 1, border: "1px solid #e5e7eb", borderRadius: "12px", padding: "24px" }}>
            <h3 style={{ margin: "0 0 20px 0", fontSize: "16px", color: "#374151" }}>Verdict Distribution</h3>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {[
                { label: "True", count: verdict_distribution.TRUE, pct: truePct, color: "#10b981" },
                { label: "Partial", count: verdict_distribution.PARTIAL, pct: partialPct, color: "#f59e0b" },
                { label: "False", count: verdict_distribution.FALSE, pct: falsePct, color: "#ef4444" },
                { label: "Unverifiable", count: verdict_distribution.UNVERIFIABLE, pct: unverifiablePct, color: "#9ca3af" },
              ].map(stat => (
                <div key={stat.label} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div style={{ width: "95px", fontSize: "14px", fontWeight: "500", color: "#4b5563" }}>{stat.label} ({stat.count})</div>
                  <div style={{ flex: 1, height: "12px", backgroundColor: "#f3f4f6", borderRadius: "6px", overflow: "hidden" }}>
                    <div style={{ width: `${stat.pct}%`, height: "100%", backgroundColor: stat.color, borderRadius: "6px" }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* AI Signals */}
          <div style={{ flex: 1, border: "1px solid #e5e7eb", borderRadius: "12px", padding: "24px", display: "flex", flexDirection: "column" }}>
            <h3 style={{ margin: "0 0 20px 0", fontSize: "16px", color: "#374151" }}>AI Generation Signals</h3>
            <div style={{ display: "flex", gap: "16px", flex: 1 }}>
              <div style={{ flex: 1, backgroundColor: "#f0fdf4", borderRadius: "12px", padding: "20px", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", textAlign: "center" }}>
                <div style={{ fontSize: "36px", fontWeight: "700", color: "#15803d" }}>
                  {result.ai_text_probability !== null ? `${result.ai_text_probability.toFixed(0)}%` : "N/A"}
                </div>
                <div style={{ fontSize: "14px", color: "#166534", marginTop: "8px" }}>AI Text Probability</div>
              </div>
              <div style={{ flex: 1, backgroundColor: "#faf5ff", borderRadius: "12px", padding: "20px", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", textAlign: "center" }}>
                <div style={{ fontSize: "36px", fontWeight: "700", color: "#7e22ce" }}>
                  {result.ai_image_probability !== null ? `${result.ai_image_probability.toFixed(0)}%` : "N/A"}
                </div>
                <div style={{ fontSize: "14px", color: "#6b21a8", marginTop: "8px" }}>AI Image Probability</div>
              </div>
            </div>
          </div>
        </div>

        {/* Claims Table */}
        <div>
          <h2 style={{ fontSize: "24px", fontWeight: "700", borderBottom: "2px solid #e5e7eb", paddingBottom: "12px", marginBottom: "24px" }}>
            Detailed Claim Verification
          </h2>
          
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            {result.claims.map((claim, idx) => {
              const tone = verdictToTone(claim.verdict);
              let pillColor = "#6b7280";
              let pillBg = "#f3f4f6";
              if (tone === "support") { pillColor = "#059669"; pillBg = "#d1fae5"; }
              if (tone === "danger") { pillColor = "#dc2626"; pillBg = "#fee2e2"; }
              if (tone === "warn") { pillColor = "#d97706"; pillBg = "#fef3c7"; }

              return (
                <div key={idx} className="page-break-avoid" style={{ border: "1px solid #e5e7eb", borderRadius: "10px", overflow: "hidden", pageBreakInside: "avoid" }}>
                  <div style={{ backgroundColor: "#f9fafb", padding: "16px 20px", borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px" }}>
                    <h3 style={{ margin: 0, fontSize: "16px", lineHeight: "1.4", color: "#1f2937", flex: 1 }}>
                      "{claim.claim}"
                    </h3>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "6px" }}>
                      <span style={{ backgroundColor: pillBg, color: pillColor, padding: "4px 10px", borderRadius: "999px", fontSize: "11px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "1px" }}>
                        {claim.verdict}
                      </span>
                      <span style={{ fontSize: "11px", color: "#6b7280", fontWeight: "500" }}>Confidence: {claim.confidence}%</span>
                    </div>
                  </div>
                  
                  <div style={{ padding: "20px" }}>
                    <div style={{ marginBottom: "16px" }}>
                      <h4 style={{ margin: "0 0 8px 0", fontSize: "12px", textTransform: "uppercase", color: "#9ca3af", letterSpacing: "1px" }}>Reasoning</h4>
                      <p style={{ margin: 0, fontSize: "13px", color: "#374151", lineHeight: "1.6" }}>{claim.reasoning}</p>
                    </div>

                    {claim.conflict && (
                      <div style={{ backgroundColor: "#fffbeb", borderLeft: "4px solid #f59e0b", padding: "12px 16px", marginBottom: "20px", borderRadius: "0 8px 8px 0" }}>
                        <strong style={{ color: "#b45309", display: "block", marginBottom: "4px", fontSize: "13px" }}>Source Conflict Detected</strong>
                        <span style={{ color: "#92400e", fontSize: "14px" }}>{claim.conflict_explanation}</span>
                      </div>
                    )}

                    {claim.citations.length > 0 && (
                      <div>
                        <h4 style={{ margin: "0 0 10px 0", fontSize: "12px", textTransform: "uppercase", color: "#9ca3af", letterSpacing: "1px" }}>Supporting Sources</h4>
                        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                          {claim.citations.map((c, i) => (
                            <div key={i} style={{ backgroundColor: "#f8fafc", padding: "12px", borderRadius: "8px", border: "1px solid #f1f5f9" }}>
                              <div style={{ fontWeight: "600", color: "#0f172a", marginBottom: "4px", fontSize: "13px" }}>{i + 1}. {c.title.length > 80 ? c.title.substring(0, 80) + "..." : c.title}</div>
                              <div style={{ color: "#64748b", fontSize: "12px", marginBottom: "6px" }}>{new URL(c.url).hostname}</div>
                              <div style={{ color: "#475569", fontSize: "13px", lineHeight: "1.5", fontStyle: "italic" }}>
                                "{c.snippet.length > 250 ? c.snippet.substring(0, 250).trim() + "..." : c.snippet}"
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div style={{ marginTop: "30px", paddingTop: "20px", borderTop: "1px solid #e5e7eb", textAlign: "center", color: "#9ca3af", fontSize: "12px" }}>
          This report was automatically synthesized by the Veritas AI Verification Engine.<br />
          Open source browser extension toolkit.
        </div>
      </div>
    </div>
  );
});
