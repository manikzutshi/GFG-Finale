"use client";

import React from "react";
import { useDeferredValue, useEffect, useState, useTransition } from "react";

import type { AnalyzeResponse } from "@veritas/shared";

import { Bookmark, Download } from "lucide-react";

import { analyzeContent } from "../lib/api";
import { PdfReportTemplate } from "./pdf-report-template";
import { ClaimCard } from "./claim-card";
import { PipelineStatus } from "./pipeline-status";
import { Sidebar } from "./sidebar";
import { SourceTextPanel } from "./source-text-panel";
import { SummaryBar } from "./summary-bar";
import { ThemeToggle } from "./theme-toggle";

export function VeritasApp() {
  const [activeTab, setActiveTab] = useState<"text" | "image" | "audio">("text");
  const [inputType, setInputType] = useState<"url" | "text">("url");
  const [imageInputType, setImageInputType] = useState<"url" | "upload">("url");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  
  // Text analysis state
  const [inputText, setInputText] = useState("");
  const [inputUrl, setInputUrl] = useState("");
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [savingBookmark, setSavingBookmark] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [bookmarkId, setBookmarkId] = useState<string | null>(null);
  const [refreshSidebar, setRefreshSidebar] = useState(0);
  
  // Image analysis state
  const [imageUrl, setImageUrl] = useState("");
  const [imageLoading, setImageLoading] = useState(false);
  const [imageResult, setImageResult] = useState<any | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [activeStage, setActiveStage] = useState(0);
  const [activeClaimId, setActiveClaimId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const deferredActiveClaimId = useDeferredValue(activeClaimId);
  
  // Audio analysis state
  const [audioInputType, setAudioInputType] = useState<"url" | "upload">("url");
  const [audioUrl, setAudioUrl] = useState("");
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioPreview, setAudioPreview] = useState<string | null>(null);
  const [audioLoading, setAudioLoading] = useState(false);
  const [audioResult, setAudioResult] = useState<any | null>(null);
  const [audioError, setAudioError] = useState<string | null>(null);

  // Page image forensics state (auto-scan images found on fact-checked URLs)
  const [pageImageScans, setPageImageScans] = useState<Array<{
    url: string;
    alt?: string;
    status: "pending" | "scanning" | "done" | "error";
    result?: any;
    error?: string;
  }>>([]);

  const pdfRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!loading) {
      return undefined;
    }

    setActiveStage(0);
    const timer = window.setInterval(() => {
      setActiveStage((stage) => (stage < 2 ? stage + 1 : stage));
    }, 900);

    return () => {
      window.clearInterval(timer);
    };
  }, [loading]);

  // Auto-scan discovered page images when analysis completes
  useEffect(() => {
    const images = (result as any)?.discovered_images;
    if (!images || images.length === 0) {
      setPageImageScans([]);
      return;
    }

    // Initialize scan entries
    const initialScans = images.map((img: any) => ({
      url: img.url,
      alt: img.alt,
      status: "pending" as const,
    }));
    setPageImageScans(initialScans);

    // Scan each image independently
    const API_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4311";
    images.forEach((img: any, index: number) => {
      // Mark as scanning
      setPageImageScans(prev => prev.map((s, i) => i === index ? { ...s, status: "scanning" as const } : s));

      fetch(`${API_URL}/api/check-image`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: img.url })
      })
        .then(res => res.json())
        .then(data => {
          if (data.error) throw new Error(data.error);
          setPageImageScans(prev => prev.map((s, i) => i === index ? { ...s, status: "done" as const, result: data } : s));
        })
        .catch(err => {
          setPageImageScans(prev => prev.map((s, i) => i === index ? { ...s, status: "error" as const, error: err.message } : s));
        });
    });
  }, [result]);

  async function handleAnalyze(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setLoading(true);
    setError(null);
    setResult(null);
    setActiveClaimId(null);

    try {
      const response = await analyzeContent({
        input_text: inputText.trim() || undefined,
        input_url: inputUrl.trim() || undefined
      });

      startTransition(() => {
        setResult(response);
        setBookmarked(false);
        setBookmarkId(null);
        setActiveClaimId(response.claims[0]?.id ?? null);
      });
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Analysis failed.");
    } finally {
      setLoading(false);
    }
  }

  async function handleBookmark() {
    if (!result) return;
    setSavingBookmark(true);
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4311";
      
      if (bookmarked && bookmarkId) {
        const res = await fetch(`${API_URL}/api/bookmarks/${bookmarkId}`, { method: "DELETE" });
        if (!res.ok) throw new Error("Failed to remove bookmark");
        setBookmarked(false);
        setBookmarkId(null);
        setRefreshSidebar((prev) => prev + 1);
        return;
      }

      const response = await fetch(`${API_URL}/api/bookmarks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inputUrl: inputType === "url" ? inputUrl.trim() || undefined : undefined,
          inputText: inputType === "text" ? inputText.trim() || undefined : undefined,
          analysisResult: result,
          source: "web",
          type: inputType
        })
      });

      if (!response.ok) throw new Error("Failed to save bookmark");
      const data = await response.json();
      setBookmarkId(data.id);
      setBookmarked(true);
      setRefreshSidebar((prev) => prev + 1);
    } catch (err) {
      console.error("Error toggling bookmark:", err);
    } finally {
      setSavingBookmark(false);
    }
  }

  async function handleDownloadReport() {
    if (!result || !pdfRef.current) return;
    
    try {
      // Dynamically import to avoid Next.js SSR crashes (self is not defined)
      const html2pdf = (await import("html2pdf.js")).default;
      const element = pdfRef.current;
      const opt = {
        margin:       0,
        filename:     `veritas-full-report-${new Date().toISOString().split("T")[0]}.pdf`,
        image:        { type: "jpeg" as const, quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true, letterRendering: true, windowWidth: 700 }, // Scaled linearly
        jsPDF:        { unit: 'px', format: [700, element.scrollHeight] as [number, number], orientation: 'portrait' as const }
      };

      // Native, high-quality pagination conversion
      html2pdf().set(opt).from(element).save();
    } catch (err) {
      console.error("Failed to generate PDF Report", err);
    }
  }

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    } else {
      setImageFile(null);
      setImagePreview(null);
    }
  };

  async function handleImageCheck(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (imageInputType === "url" && !imageUrl.trim()) return;
    if (imageInputType === "upload" && !imageFile) return;

    setImageLoading(true);
    setImageError(null);
    setImageResult(null);

    try {
      let requestPayload = {};

      if (imageInputType === "upload") {
        if (!imagePreview) throw new Error("File not loaded properly.");
        // Compress base64 payload size by stripping the mime header if needed by backend,
        // but we'll send the full Data URL and let the backend extract the comma buffer.
        requestPayload = { imageBase64: imagePreview };
      } else {
        requestPayload = { imageUrl: imageUrl.trim() };
      }

      const API_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4311";
      const response = await fetch(`${API_URL}/api/check-image`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestPayload)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to check image.");
      }

      setImageResult(data);
    } catch (err) {
      setImageError(err instanceof Error ? err.message : "Image analysis failed.");
    } finally {
      setImageLoading(false);
    }
  }

  const handleAudioFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAudioFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setAudioPreview(reader.result as string);
      reader.readAsDataURL(file);
    } else {
      setAudioFile(null);
      setAudioPreview(null);
    }
  };

  async function handleAudioCheck(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (audioInputType === "url" && !audioUrl.trim()) return;
    if (audioInputType === "upload" && !audioFile) return;

    setAudioLoading(true);
    setAudioError(null);
    setAudioResult(null);

    try {
      let requestPayload = {};

      if (audioInputType === "upload") {
        if (!audioPreview) throw new Error("File not loaded properly.");
        requestPayload = { audioBase64: audioPreview };
      } else {
        requestPayload = { audioUrl: audioUrl.trim() };
      }

      const API_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4311";
      const response = await fetch(`${API_URL}/api/check-audio`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestPayload)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to check audio.");
      }

      setAudioResult(data);
    } catch (err) {
      setAudioError(err instanceof Error ? err.message : "Audio analysis failed.");
    } finally {
      setAudioLoading(false);
    }
  }

  function handleSelectBookmark(savedResult: any, savedUrl: string, savedText: string, savedId: string) {
    startTransition(() => {
      setActiveTab("text");
      setInputUrl(savedUrl);
      setInputText(savedText);
      setInputType(savedUrl ? "url" : "text");
      setResult(savedResult);
      setActiveClaimId(savedResult.claims?.[0]?.id ?? null);
      setBookmarked(true);
      setBookmarkId(savedId);
      setError(null);
    });
  }

  function handleNewAnalysis() {
    setResult(null);
    setError(null);
    setInputUrl("");
    setInputText("");
    setInputType("url");
    setLoading(false);
    setBookmarked(false);
    setBookmarkId(null);
    setActiveClaimId(null);
    setPageImageScans([]);
    // Image tab
    setImageUrl("");
    setImageFile(null);
    setImagePreview(null);
    setImageResult(null);
    setImageError(null);
    setImageInputType("url");
    // Audio tab
    setAudioUrl("");
    setAudioFile(null);
    setAudioPreview(null);
    setAudioResult(null);
    setAudioError(null);
    setAudioInputType("url");
  }

  return (
    <div className="app-layout">
      {result && <PdfReportTemplate ref={pdfRef} result={result} inputUrl={inputUrl} inputText={inputText} />}
      <Sidebar onSelectBookmark={handleSelectBookmark} triggerRefresh={refreshSidebar} />
    
      <main className="app-shell main-content">
        <section className="hero">
          <div>
          <p className="eyebrow">Veritas</p>
          <h1>Explainable claim verification for text and live webpages.</h1>
          <p className="hero-copy">
            Extract claims, gather evidence, verify against sources, and surface a report that a browser
            extension can reuse later without changing the backend contract.
          </p>
        </div>
        <div className="hero-metrics">
          <span>Stateless API</span>
          <span>Gemini + Tavily</span>
          <span>Extension-ready schema</span>
          <ThemeToggle />
          {(result || imageResult || audioResult) && (
            <button
              onClick={handleNewAnalysis}
              style={{ 
                background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)",
                color: "#fff", padding: "8px 16px", borderRadius: "10px", 
                fontSize: "13px", fontWeight: 600, cursor: "pointer",
                transition: "all 0.2s ease", marginLeft: "8px"
              }}
              onMouseOver={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.15)")}
              onMouseOut={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
            >
              ✦ New Analysis
            </button>
          )}
        </div>
      </section>
      <div style={{ display: "flex", gap: "8px", marginBottom: "32px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)", padding: "6px", borderRadius: "20px", width: "fit-content", backdropFilter: "blur(20px)", boxShadow: "0 8px 32px rgba(0,0,0,0.2)" }}>
        <button 
          onClick={() => setActiveTab("text")}
          style={{ background: activeTab === "text" ? "rgba(255,255,255,0.1)" : "transparent", color: activeTab === "text" ? "#fff" : "var(--muted)", padding: "12px 24px", borderRadius: "14px", fontWeight: activeTab === "text" ? 600 : 500, border: "none", cursor: "pointer", transition: "all 0.3s cubic-bezier(0.16, 1, 0.3, 1)", fontSize: "14px", boxShadow: activeTab === "text" ? "0 4px 12px rgba(0,0,0,0.1)" : "none" }}
        >
          Fact-Check Text/URL
        </button>
        <button 
          onClick={() => setActiveTab("image")}
          style={{ background: activeTab === "image" ? "rgba(255,255,255,0.1)" : "transparent", color: activeTab === "image" ? "#fff" : "var(--muted)", padding: "12px 24px", borderRadius: "14px", fontWeight: activeTab === "image" ? 600 : 500, border: "none", cursor: "pointer", transition: "all 0.3s cubic-bezier(0.16, 1, 0.3, 1)", fontSize: "14px", boxShadow: activeTab === "image" ? "0 4px 12px rgba(0,0,0,0.1)" : "none" }}
        >
          AI Image Detector
        </button>
        <button 
          onClick={() => setActiveTab("audio")}
          style={{ background: activeTab === "audio" ? "rgba(255,255,255,0.1)" : "transparent", color: activeTab === "audio" ? "#fff" : "var(--muted)", padding: "12px 24px", borderRadius: "14px", fontWeight: activeTab === "audio" ? 600 : 500, border: "none", cursor: "pointer", transition: "all 0.3s cubic-bezier(0.16, 1, 0.3, 1)", fontSize: "14px", boxShadow: activeTab === "audio" ? "0 4px 12px rgba(0,0,0,0.1)" : "none" }}
        >
          AI Audio Detector
        </button>
      </div>

      {activeTab === "text" ? (
      <section className="workspace-grid">
        <div className="left-column">
          <form className="panel input-panel" onSubmit={handleAnalyze}>
            <div className="panel-header" style={{ marginBottom: "16px" }}>
              <div style={{ width: "100%" }}>
                <p className="eyebrow" style={{ marginBottom: "12px" }}>Data Source</p>
                <div style={{ display: "flex", gap: "6px", background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.05)", padding: "4px", borderRadius: "12px", width: "100%" }}>
                  <button 
                    type="button"
                    onClick={() => { setInputType("url"); setInputText(""); setResult(null); setError(null); }}
                    style={{ flex: 1, background: inputType === "url" ? "rgba(255,255,255,0.1)" : "transparent", color: inputType === "url" ? "#fff" : "var(--muted)", padding: "10px", borderRadius: "8px", fontSize: "13px", fontWeight: 600, border: "none", cursor: "pointer", transition: "all 0.2s ease", boxShadow: inputType === "url" ? "0 2px 8px rgba(0,0,0,0.2)" : "none" }}
                  >
                    Web URL
                  </button>
                  <button 
                    type="button"
                    onClick={() => { setInputType("text"); setInputUrl(""); setResult(null); setError(null); }}
                    style={{ flex: 1, background: inputType === "text" ? "rgba(255,255,255,0.1)" : "transparent", color: inputType === "text" ? "#fff" : "var(--muted)", padding: "10px", borderRadius: "8px", fontSize: "13px", fontWeight: 600, border: "none", cursor: "pointer", transition: "all 0.2s ease", boxShadow: inputType === "text" ? "0 2px 8px rgba(0,0,0,0.2)" : "none" }}
                  >
                    Raw Text
                  </button>
                </div>
              </div>
            </div>

            <div style={{ opacity: 1, transition: "opacity 0.3s ease" }}>
              {inputType === "url" ? (
                <>
                  <label className="field-label" htmlFor="input-url">Target URL</label>
                  <input
                    id="input-url"
                    className="text-input"
                    style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.06)", color: "#fff" }}
                    value={inputUrl || ""}
                    onChange={(event) => setInputUrl(event.target.value)}
                    placeholder="https://example.com/article"
                  />
                </>
              ) : (
                <>
                  <label className="field-label" htmlFor="input-text">Content Body</label>
                  <textarea
                    id="input-text"
                    className="text-area"
                    style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.06)", color: "#fff" }}
                    value={inputText}
                    onChange={(event) => setInputText(event.target.value)}
                    placeholder="Paste the entire text segment you want to verify."
                    rows={8}
                  />
                </>
              )}
            </div>

            <div className="form-actions">
              <button
                className="primary-button"
                type="submit"
                disabled={loading || (!inputText.trim() && !inputUrl.trim())}
              >
                {loading ? "Analyzing..." : "Analyze Claims"}
              </button>
              <span className="form-hint">Designed for reuse by a future browser extension.</span>
            </div>
          </form>

          {isPending || loading ? (
            <PipelineStatus loading={loading} activeStage={activeStage} trace={result?.trace} />
          ) : null}

          {result ? (
            <details className="panel" style={{ cursor: "pointer", outline: "none", padding: 0, overflow: "hidden", transition: "all 0.3s ease" }}>
              <summary className="eyebrow" style={{ margin: 0, padding: "18px 22px", fontWeight: 700, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>Review Core Diagnostics & Source Mapping</span>
                <span style={{ fontSize: "16px", opacity: 0.5 }}>↓</span>
              </summary>
              <div style={{ padding: "22px", borderTop: "1px solid var(--line)", cursor: "default", display: "flex", flexDirection: "column", gap: "24px", background: "rgba(0,0,0,0.15)", maxHeight: "500px", overflowY: "auto" }}>
                <PipelineStatus loading={loading} activeStage={activeStage} trace={result.trace} />
                <SourceTextPanel
                  sourceText={result.source_text ?? inputText}
                  claims={result.claims ?? []}
                  activeClaimId={deferredActiveClaimId}
                />
              </div>
            </details>
          ) : null}
        </div>

        <div className="right-column">
          {result ? (
            <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
              <div style={{ flex: 1 }}>
                <SummaryBar result={result} />
              </div>
              <button
                onClick={handleBookmark}
                disabled={savingBookmark || bookmarked}
                className="panel citation-toggle"
                style={{ padding: "18px", minWidth: "60px", display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}
                title={bookmarked ? "Saved" : "Bookmark this result"}
              >
                <Bookmark 
                  size={24} 
                  fill={bookmarked ? "var(--accent)" : "none"} 
                  color={bookmarked ? "var(--accent)" : "var(--muted)"}
                  style={{ transition: "all 0.2s ease" }}
                />
              </button>
              <button
                onClick={handleDownloadReport}
                className="panel citation-toggle"
                style={{ padding: "18px", minWidth: "60px", display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}
                title="Download Full Report (PDF)"
              >
                <Download 
                  size={24} 
                  color="var(--accent)"
                  style={{ transition: "all 0.2s ease" }}
                />
              </button>
            </div>
          ) : null}

          {error ? <div className="error-banner">{error}</div> : null}

          <div className="result-stack">
            {loading ? (
              <>
                <div className="claim-skeleton" />
                <div className="claim-skeleton" />
                <div className="claim-skeleton" />
              </>
            ) : null}

            {!loading && result?.claims.length ? (
              result.claims.map((claim) => (
                <ClaimCard
                  key={claim.id}
                  claim={claim}
                  active={claim.id === deferredActiveClaimId}
                  onFocus={() => setActiveClaimId(claim.id)}
                />
              ))
            ) : null}

            {!loading && result && result.claims.length === 0 ? (
              <div className="panel empty-state">
                <p className="eyebrow">No claims detected</p>
                <h3>Veritas could not find externally verifiable factual claims.</h3>
                <p>Try a denser excerpt or supply a more content-rich article URL.</p>
              </div>
            ) : null}

            {!loading && !result && !error ? (
              <div className="panel empty-state">
                <p className="eyebrow">Awaiting analysis</p>
                <h3>Run the pipeline to see claim-level verification cards here.</h3>
                <p>Each card will include a verdict, confidence score, concise reasoning, and clickable citations.</p>
              </div>
            ) : null}
          </div>

          {/* Page Image Forensics — auto-scanned images from the article */}
          {pageImageScans.length > 0 && (
            <div className="panel" style={{ padding: "18px" }}>
              <p className="eyebrow" style={{ marginBottom: "14px" }}>Page Image Forensics</p>
              <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                {pageImageScans.map((scan, i) => (
                  <div key={i} style={{ 
                    position: "relative", width: "calc(33.33% - 8px)", minWidth: "120px",
                    borderRadius: "10px", overflow: "hidden", 
                    border: "1px solid rgba(255,255,255,0.08)",
                    background: "rgba(0,0,0,0.2)",
                    aspectRatio: "4/3"
                  }}>
                    <img 
                      src={scan.url} 
                      alt={scan.alt || "Page image"} 
                      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", opacity: scan.status === "scanning" ? 0.5 : 1, transition: "opacity 0.3s ease" }}
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                    {/* Status overlay */}
                    <div style={{ 
                      position: "absolute", bottom: 0, left: 0, right: 0, 
                      padding: "6px 8px",
                      background: scan.status === "done" 
                        ? (scan.result?.isFake ? "rgba(239,68,68,0.85)" : "rgba(34,197,94,0.85)")
                        : scan.status === "error" ? "rgba(239,68,68,0.85)"
                        : "rgba(0,0,0,0.7)",
                      backdropFilter: "blur(8px)",
                      fontSize: "11px", fontWeight: 600, color: "#fff"
                    }}>
                      {scan.status === "scanning" && "Scanning..."}
                      {scan.status === "pending" && "Queued..."}
                      {scan.status === "error" && (scan.error || "Scan failed")}
                      {scan.status === "done" && scan.result && (
                        <span>{scan.result.isFake ? `⚠ AI ${Math.round(scan.result.confidenceScore)}%` : `✓ Real ${Math.round(100 - scan.result.confidenceScore)}%`}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result?.warnings.length ? (
            <div className="panel warning-panel" style={{ background: "rgba(255, 159, 10, 0.05)", borderColor: "rgba(255, 159, 10, 0.15)" }}>
              <p className="eyebrow" style={{ color: "var(--warning)" }}>System Diagnostics</p>
              <ul style={{ fontSize: "13px", opacity: 0.8, marginTop: "8px", paddingLeft: "16px" }}>
                {result.warnings.map((w) => {
                  if (w.includes("fell back to heuristics") && w.includes("invalid_enum_value")) {
                    return <li key={w} style={{ marginBottom: "6px" }}>Model generated unrecognized classification state ('CONFLICT'). Fallback heuristics engaged to stabilize pipeline schema structure.</li>;
                  }
                  return <li key={w} style={{ marginBottom: "6px" }}>{w}</li>;
                })}
              </ul>
            </div>
          ) : null}
        </div>
      </section>
      ) : activeTab === "image" ? (
      <section className="workspace-grid">
        <div className="left-column">
          <form className="panel input-panel" onSubmit={handleImageCheck}>
            <div className="panel-header" style={{ marginBottom: "16px" }}>
              <div style={{ width: "100%" }}>
                <p className="eyebrow" style={{ marginBottom: "12px" }}>Data Source</p>
                <div style={{ display: "flex", gap: "6px", background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.05)", padding: "4px", borderRadius: "12px", width: "100%" }}>
                  <button 
                    type="button"
                    onClick={() => { setImageInputType("url"); setImageFile(null); setImagePreview(null); setImageResult(null); setImageError(null); }}
                    style={{ flex: 1, background: imageInputType === "url" ? "rgba(255,255,255,0.1)" : "transparent", color: imageInputType === "url" ? "#fff" : "var(--muted)", padding: "10px", borderRadius: "8px", fontSize: "13px", fontWeight: 600, border: "none", cursor: "pointer", transition: "all 0.2s ease" }}
                  >
                    Image URL
                  </button>
                  <button 
                    type="button"
                    onClick={() => { setImageInputType("upload"); setImageUrl(""); setImageResult(null); setImageError(null); }}
                    style={{ flex: 1, background: imageInputType === "upload" ? "rgba(255,255,255,0.1)" : "transparent", color: imageInputType === "upload" ? "#fff" : "var(--muted)", padding: "10px", borderRadius: "8px", fontSize: "13px", fontWeight: 600, border: "none", cursor: "pointer", transition: "all 0.2s ease" }}
                  >
                    File Upload
                  </button>
                </div>
              </div>
            </div>

            <div style={{ display: imageInputType === "url" ? "block" : "none" }}>
              <label className="field-label" htmlFor="image-url">Image URL to analyze</label>
              <input
                id="image-url"
                className="text-input"
                value={imageUrl || ""}
                onChange={(event) => setImageUrl(event.target.value)}
                placeholder="https://example.com/image.jpg"
                style={{ marginBottom: "16px" }}
              />
            </div>
            <div style={{ display: imageInputType === "upload" ? "block" : "none" }}>
              <label className="field-label" htmlFor="image-file">Upload Local Image</label>
              <input
                id="image-file"
                type="file"
                accept="image/*"
                onChange={handleImageFileChange}
                className="text-input"
                style={{ marginBottom: "16px", padding: "10px" }}
              />
            </div>

            <div className="form-actions">
              <button
                className="primary-button"
                style={{ background: "linear-gradient(135deg, #1d4ed8 0%, #1e3a8a 100%)" }}
                type="submit"
                disabled={imageLoading || (imageInputType === "url" ? !imageUrl.trim() : !imageFile)}
              >
                {imageLoading ? "Analyzing..." : "Check Image"}
              </button>
              <span className="form-hint">Uses computer vision to detect synthetic patterns.</span>
            </div>
          </form>

          {(imageUrl || imagePreview) && (
            <div className="panel" style={{ padding: 0, overflow: "hidden" }}>
              <img 
                src={(imagePreview || imageUrl)!} 
                alt="Target for analysis" 
                style={{ width: "100%", maxHeight: "400px", objectFit: "contain", background: "rgba(17,17,17,0.05)" }}
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            </div>
          )}
        </div>

        <div className="right-column">
          {imageResult && (
            <div className={`panel ${imageResult.isFake ? "claim-card-danger" : "claim-card-support"}`}>
              <p className="eyebrow">Detection Results</p>
              <h3 style={{ marginBottom: "16px", color: imageResult.isFake ? "var(--danger)" : "var(--accent)" }}>
                {imageResult.isFake ? "Likely AI Generated" : "Likely Authentic"}
              </h3>
              
              <div className="score-card" style={{ marginBottom: "16px" }}>
                <p className="eyebrow">Confidence Score</p>
                <div className="score-value">{imageResult.confidenceScore.toFixed(1)}%</div>
              </div>

              <p className="claim-reasoning">{imageResult.message}</p>
              
              <div style={{ marginTop: "16px", display: "flex", gap: "8px" }}>
                <span className="query-chip">Provider: {imageResult.provider}</span>
              </div>
            </div>
          )}

          {imageError && <div className="error-banner">{imageError}</div>}
          
          {!imageResult && !imageError && !imageLoading && (
            <div className="panel empty-state">
              <p className="eyebrow">Awaiting image</p>
              <h3>Run the detector on a suspicious image.</h3>
              <p>We'll check for artifacts left by models like Midjourney, DALL-E, and Stable Diffusion.</p>
            </div>
          )}
          
          {imageLoading && (
            <div className="claim-skeleton" style={{ height: "300px" }} />
          )}
        </div>
      </section>
      ) : activeTab === "audio" ? (
      <section className="workspace-grid">
        <div className="left-column">
          <form className="panel input-panel" onSubmit={handleAudioCheck}>
            <div className="panel-header" style={{ marginBottom: "16px" }}>
              <div style={{ width: "100%" }}>
                <p className="eyebrow" style={{ marginBottom: "12px" }}>Data Source</p>
                <div style={{ display: "flex", gap: "6px", background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.05)", padding: "4px", borderRadius: "12px", width: "100%" }}>
                  <button 
                    type="button"
                    onClick={() => { setAudioInputType("url"); setAudioFile(null); setAudioPreview(null); setAudioResult(null); setAudioError(null); }}
                    style={{ flex: 1, background: audioInputType === "url" ? "rgba(255,255,255,0.1)" : "transparent", color: audioInputType === "url" ? "#fff" : "var(--muted)", padding: "10px", borderRadius: "8px", fontSize: "13px", fontWeight: 600, border: "none", cursor: "pointer", transition: "all 0.2s ease" }}
                  >
                    Audio URL
                  </button>
                  <button 
                    type="button"
                    onClick={() => { setAudioInputType("upload"); setAudioUrl(""); setAudioResult(null); setAudioError(null); }}
                    style={{ flex: 1, background: audioInputType === "upload" ? "rgba(255,255,255,0.1)" : "transparent", color: audioInputType === "upload" ? "#fff" : "var(--muted)", padding: "10px", borderRadius: "8px", fontSize: "13px", fontWeight: 600, border: "none", cursor: "pointer", transition: "all 0.2s ease" }}
                  >
                    File Upload
                  </button>
                </div>
              </div>
            </div>

            <div style={{ display: audioInputType === "url" ? "block" : "none" }}>
              <label className="field-label" htmlFor="audio-url">Audio URL to analyze</label>
              <input
                id="audio-url"
                className="text-input"
                value={audioUrl || ""}
                onChange={(event) => setAudioUrl(event.target.value)}
                placeholder="https://example.com/speech.mp3"
                style={{ marginBottom: "16px" }}
              />
            </div>
            <div style={{ display: audioInputType === "upload" ? "block" : "none" }}>
              <label className="field-label" htmlFor="audio-file">Upload Local Audio</label>
              <input
                id="audio-file"
                type="file"
                accept="audio/*"
                onChange={handleAudioFileChange}
                className="text-input"
                style={{ marginBottom: "16px", padding: "10px" }}
              />
            </div>

            <div className="form-actions">
              <button
                className="primary-button"
                style={{ background: "linear-gradient(135deg, #7c3aed 0%, #4c1d95 100%)" }}
                type="submit"
                disabled={audioLoading || (audioInputType === "url" ? !audioUrl.trim() : !audioFile)}
              >
                {audioLoading ? "Analyzing..." : "Check Audio"}
              </button>
              <span className="form-hint">Scans vocal frequencies for cloning artifacts.</span>
            </div>
          </form>

          {(audioUrl || audioPreview) && (
            <div className="panel" style={{ padding: "16px", background: "rgba(17,17,17,0.05)" }}>
              <p className="eyebrow" style={{ marginBottom: "12px" }}>Acoustic Preview</p>
              <audio 
                controls 
                src={(audioPreview || audioUrl)!} 
                style={{ width: "100%", borderRadius: "8px" }}
                onError={(e) => { (e.target as HTMLAudioElement).style.display = 'none'; }}
              >
                Your browser does not support the audio element.
              </audio>
            </div>
          )}
        </div>

        <div className="right-column">
          {audioResult && (
            <div className={`panel ${audioResult.isFake ? "claim-card-danger" : "claim-card-support"}`}>
              <p className="eyebrow">Detection Results</p>
              <h3 style={{ marginBottom: "16px", color: audioResult.isFake ? "var(--danger)" : "var(--accent)" }}>
                {audioResult.isFake ? "Likely AI Voice Clone" : "Likely Authentic Human"}
              </h3>
              
              <div className="score-card" style={{ marginBottom: "16px" }}>
                <p className="eyebrow">Confidence Score</p>
                <div className="score-value">{audioResult.confidenceScore.toFixed(1)}%</div>
              </div>

              <p className="claim-reasoning">{audioResult.message}</p>

              {audioResult.indicators && audioResult.indicators.length > 0 && (
                <div style={{ marginTop: "16px" }}>
                  <p className="eyebrow" style={{ marginBottom: "8px" }}>Forensic Indicators</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                    {audioResult.indicators.map((ind: string, i: number) => (
                      <span key={i} className="query-chip" style={{ fontSize: "11px" }}>{ind}</span>
                    ))}
                  </div>
                </div>
              )}
              
              <div style={{ marginTop: "16px", display: "flex", gap: "8px" }}>
                <span className="query-chip">Provider: {audioResult.provider}</span>
              </div>
            </div>
          )}

          {audioError && <div className="error-banner">{audioError}</div>}
          
          {!audioResult && !audioError && !audioLoading && (
            <div className="panel empty-state">
              <p className="eyebrow">Awaiting audio</p>
              <h3>Upload a suspicious speech sample.</h3>
              <p>We'll mathematically scan the vocal frequencies for deepfake neural signatures left by models like ElevenLabs or Play.ht.</p>
            </div>
          )}
          
          {audioLoading && (
            <div className="claim-skeleton" style={{ height: "300px" }} />
          )}
        </div>
      </section>
      ) : null}

      {isPending ? <div className="transition-indicator">Refreshing report view...</div> : null}
      </main>
    </div>
  );
}
