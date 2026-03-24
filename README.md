# Veritas — AI-Powered Fact Verification & Deepfake Detection Platform

Veritas is a full-stack, production-grade platform for AI-assisted fact-checking and media forensics. It extracts factual claims from text or live webpages, retrieves real-time evidence from the open web, verifies each claim against retrieved sources using Gemini, and extends its forensic capabilities to AI-generated image and audio deepfake detection — all surfaced through an explainable, citation-backed report.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Monorepo Structure](#monorepo-structure)
- [Core Pipeline: Fact-Check Analysis](#core-pipeline-fact-check-analysis)
- [AI Image Deepfake Detector](#ai-image-deepfake-detector)
- [AI Audio Deepfake Detector](#ai-audio-deepfake-detector)
- [Inline Page Image Forensics](#inline-page-image-forensics)
- [Browser Extension](#browser-extension)
- [Frontend Architecture](#frontend-architecture)
- [Backend Architecture](#backend-architecture)
- [Shared Schema Package](#shared-schema-package)
- [Database & Persistence](#database--persistence)
- [Environment Variables](#environment-variables)
- [Local Development](#local-development)
- [Deployment](#deployment)
- [API Reference](#api-reference)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          CLIENT LAYER                                   │
│  ┌──────────────┐  ┌───────────────┐  ┌──────────────────────────────┐ │
│  │  Next.js UI   │  │  Chrome Ext.  │  │  Any REST Client (Postman)  │ │
│  │  :4310        │  │  Popup        │  │                              │ │
│  └──────┬───────┘  └──────┬────────┘  └──────────────┬───────────────┘ │
│         │                 │                           │                 │
└─────────┼─────────────────┼───────────────────────────┼─────────────────┘
          │                 │                           │
          ▼                 ▼                           ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       FASTIFY API LAYER (:4311)                         │
│                                                                         │
│  POST /analyze          POST /api/check-image    POST /api/check-audio │
│  POST /api/bookmarks    GET  /health                                    │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    ANALYSIS PIPELINE                             │   │
│  │  Source Ingestion → Claim Extraction → Query Generation →       │   │
│  │  Evidence Search (Tavily) → Verification Engine (Gemini) →      │   │
│  │  AI Detection → Scoring → Response Assembly                     │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└────────────┬──────────────┬──────────────┬──────────────┬───────────────┘
             │              │              │              │
             ▼              ▼              ▼              ▼
      ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐
      │  Gemini  │   │  Tavily  │   │HuggingFace│  │  Neon DB  │
      │  2.5     │   │  Search  │   │ Inference │  │ Postgres  │
      │  Flash   │   │  API     │   │   API     │  │           │
      └──────────┘   └──────────┘   └──────────┘   └──────────┘
```

---

## Monorepo Structure

```
veritas/
├── frontend/           # Next.js 15 UI (Vercel)
│   ├── app/            # Next.js App Router pages
│   ├── components/     # React components
│   └── lib/            # API client, utilities
├── backend/            # Fastify API server (Render)
│   └── src/
│       ├── config/     # Environment variable loading
│       ├── db/         # Drizzle ORM schema & client
│       ├── lib/        # Error classes
│       ├── providers/  # External API clients (Gemini, Tavily, HF)
│       ├── routes/     # Route handlers (check-image, check-audio, bookmarks)
│       ├── services/   # Core business logic (7 services)
│       └── utils/      # Scoring, tracing, JSON helpers
├── packages/shared/    # Shared Zod schemas & sentence segmentation
├── extension/          # Chrome extension (popup-based)
├── package.json        # Workspace root
└── tsconfig.base.json  # Shared TypeScript config
```

---

## Core Pipeline: Fact-Check Analysis

The heart of Veritas. When a user submits a URL or raw text, the backend executes a 6-stage pipeline with full tracing.

### Data Flow

```
User Input (URL or Text)
        │
        ▼
┌─── Stage 1: Source Ingestion ───┐
│  • If URL: fetch HTML → parse   │
│    with Mozilla Readability      │
│  • Extract readable article text │
│  • Discover up to 3 images from │
│    <img> tags (absolutized URLs) │
│  • Sentence segmentation         │
└──────────────┬──────────────────┘
               ▼
┌─── Stage 2: Claim Extraction ───┐
│  • Send sentences to Gemini      │
│  • Extract atomic, verifiable    │
│    factual claims                │
│  • Map each claim back to source │
│    sentence IDs                  │
│  • Fallback: if Gemini fails,   │
│    returns empty claims array    │
└──────────────┬──────────────────┘
               ▼
┌─── Stage 3: Query Generation ───┐
│  • For each claim, Gemini        │
│    generates 2-3 targeted        │
│    search queries                │
│  • Queries are optimized for     │
│    Tavily news/fact-check search │
└──────────────┬──────────────────┘
               ▼
┌─── Stage 4: Evidence Search ────┐
│  • Each query is sent to Tavily  │
│    Search API                    │
│  • Returns citations with:       │
│    title, URL, snippet,          │
│    source_type (govt, academic,  │
│    news, organization, other)    │
│  • Citations are deduplicated    │
└──────────────┬──────────────────┘
               ▼
┌─── Stage 5: Verification ───────┐
│  PRIMARY: Gemini LLM             │
│  • Receives claim + citations    │
│  • Returns verdict, confidence,  │
│    reasoning, conflict detection │
│  • Verdicts: TRUE, FALSE,        │
│    PARTIAL, UNVERIFIABLE         │
│                                   │
│  FALLBACK: Heuristic Engine      │
│  • Activates when Gemini fails   │
│    or hits rate limits            │
│  • Uses keyword overlap scoring  │
│  • Authority weighting:           │
│    govt(1.0) > academic(0.95)    │
│    > news(0.85) > org(0.75)      │
│  • Contradiction pattern matching │
│    (false, fake, hoax, debunked) │
└──────────────┬──────────────────┘
               ▼
┌─── Stage 6: AI Detection ───────┐
│  • ai_text_probability: scored   │
│    via optional detection API    │
│  • ai_image_probability: if page │
│    images found, scored via HF   │
│  • Results are nullable (0-100)  │
└──────────────┬──────────────────┘
               ▼
┌─── Response Assembly ───────────┐
│  • overall_accuracy score        │
│  • verdict_distribution counts   │
│  • Array of claim results with   │
│    citations and reasoning       │
│  • discovered_images for inline  │
│    page image forensics          │
│  • Pipeline trace (timing data)  │
│  • Warnings array                │
└──────────────────────────────────┘
```

### Key Files

| File | Purpose |
|------|---------|
| `services/analyze-service.ts` | Pipeline orchestrator — wires all 6 stages together |
| `services/source-ingestion.ts` | URL fetching, HTML parsing, image extraction, sentence segmentation |
| `services/claim-extractor.ts` | Gemini-powered atomic claim extraction from sentences |
| `services/query-generator.ts` | Generates search queries per claim |
| `services/evidence-service.ts` | Queries Tavily API, deduplicates citations |
| `services/verification-engine.ts` | Dual-path verification: Gemini LLM + heuristic fallback |
| `services/ai-detection.ts` | AI-generated text/image probability scoring |

---

## AI Image Deepfake Detector

A standalone tab for detecting AI-generated images using the HuggingFace Inference API.

### Data Flow

```
User uploads image (file or URL)
        │
        ▼
   Frontend (veritas-app.tsx)
   Converts file → Base64,
   or passes URL directly
        │
        ▼
   POST /api/check-image
   (check-image.ts)
        │
        ├── If Base64: decode to Buffer
        ├── If URL: fetch → Buffer
        │
        ▼
   HuggingFace Inference API
   router.huggingface.co/hf-inference
   Model: umm-maybe/AI-image-detector
        │
        ▼
   Image Classification Response
   [{ label: "artificial", score: 0.87 },
    { label: "human", score: 0.13 }]
        │
        ▼
   Backend normalizes result:
   { isFake, confidenceScore, provider }
        │
        ▼
   Frontend displays verdict with
   confidence meter and provider tag
```

### How Detection Works

The `umm-maybe/AI-image-detector` model is a ViT-based (Vision Transformer) image classifier trained on datasets of real photographs vs AI-generated images (Stable Diffusion, DALL-E, Midjourney). The binary payload is streamed directly to HuggingFace's inference router as raw bytes with `Content-Type: image/jpeg`.

---

## AI Audio Deepfake Detector

A standalone tab for detecting AI-cloned speech using Google Gemini's native multimodal audio understanding.

### Data Flow

```
User uploads audio (file or URL)
        │
        ▼
   Frontend (veritas-app.tsx)
   Converts file → Base64 data URL,
   or passes URL directly
        │
        ▼
   POST /api/check-audio
   (check-audio.ts)
        │
        ├── If Base64: extract mime type,
        │   strip data URL prefix
        ├── If URL: fetch → arrayBuffer
        │   → Base64 encode
        │
        ▼
   Gemini 2.5 Flash API
   generativelanguage.googleapis.com
   with inline_data { mime_type, data }
        │
   Gemini "listens" to the raw waveform
   and analyzes:
   • Breathing patterns
   • Pitch consistency
   • Vocal fry and creak
   • Background noise variation
   • Prosody and rhythm
   • Spectral vocoder artifacts
        │
        ▼
   Structured JSON response:
   { isFake, confidenceScore,
     reasoning, indicators[] }
        │
        ▼
   Frontend displays:
   • Verdict badge (green/red)
   • Confidence meter
   • Reasoning paragraph
   • Forensic indicator chips
```

### Calibration Design Decision

The Gemini prompt is explicitly calibrated to **default to REAL**. Phone recordings, voice memos, compressed m4a/mp3 files naturally have quality artifacts that must NOT be confused with AI synthesis. The prompt requires 2-3 **unmistakable** synthetic markers before flagging as fake, and treats filler words ("um", "uh"), background noise, and uneven volume as signs of **authenticity**.

---

## Inline Page Image Forensics

When fact-checking a URL, Veritas automatically scans images embedded in the article for AI-generated content.

### Data Flow

```
POST /analyze (URL mode)
        │
        ▼
   Source Ingestion extracts
   up to 3 <img> tags from the
   scraped HTML page (absolutized URLs)
        │
        ▼
   AnalyzeResponse includes
   discovered_images: [{ url, alt, host }]
        │
        ▼
   Frontend useEffect triggers
   on result change, fires
   independent /api/check-image
   calls per discovered image
        │
        ▼
   Results render as thumbnails
   with color-coded overlays:
   🟢 "✓ Real 94%" (green)
   🔴 "⚠ AI 87%" (red)
   ⚫ "Scan failed: ..." (error on card)
```

Each image is scanned independently — if one fails (e.g., CORS blocked, 404), the error displays directly on that image's card without affecting others. No fallback mechanism; the error state IS the fallback.

---

## Browser Extension

A Chrome extension popup that brings Veritas fact-checking to any webpage without leaving the tab.

### Data Flow

```
User clicks extension icon
        │
        ▼
   popup.js gets active tab URL
   via chrome.tabs.query()
        │
        ▼
   Displays hostname in target box
   User clicks "Analyze Current Context"
        │
        ▼
   Staged loading messages cycle
   every 3 seconds:
   1. "Connecting to Veritas backend..."
   2. "Fetching and parsing page content..."
   3. "Extracting verifiable claims..."
   4. "Searching for evidence sources..."
   5. "Cross-referencing citations..."
   6. "Running verification engine..."
   7. "Finalizing analysis report..."
        │
        ▼
   POST to Render backend
   { input_url: currentTab.url }
   (60s AbortController timeout)
        │
        ▼
   Results render as claim cards
   with verdict dots, confidence
   scores, and reasoning
        │
        ▼
   "Save to Veritas Dashboard"
   button syncs via POST /api/bookmarks
   to Neon Postgres, visible on
   the main web dashboard sidebar
```

### Extension Files

| File | Purpose |
|------|---------|
| `popup.html` | Extension popup UI with Apple-style dark theme |
| `popup.js` | Event handlers, API calls, staged loading, DOM rendering |
| `manifest.json` | Chrome extension manifest (permissions, popup config) |

---

## Frontend Architecture

### Component Tree

```
app/page.tsx
  └── VeritasApp (veritas-app.tsx) — 800+ line main orchestrator
        ├── Sidebar (sidebar.tsx)
        │     └── Saved analyses, bookmarks, extension syncs
        ├── PdfReportTemplate (pdf-report-template.tsx)
        │     └── Hidden print-ready report for PDF export
        ├── ThemeToggle (theme-toggle.tsx)
        │     └── Light/dark mode switch
        ├── PipelineStatus (pipeline-status.tsx)
        │     └── 3-stage animated progress indicator
        ├── SourceTextPanel (source-text-panel.tsx)
        │     └── Highlights source sentences mapped to claims
        ├── SummaryBar (summary-bar.tsx)
        │     └── Overall accuracy score + verdict distribution
        └── ClaimCard (claim-card.tsx)
              └── Individual claim verdict, reasoning, citations
```

### Tab System

The app uses a 3-tab interface managed by `activeTab` state:

1. **Fact-Check Text/URL** — Full analysis pipeline with claims, verdicts, page image forensics
2. **AI Image Detector** — Standalone image upload/URL deepfake detection
3. **AI Audio Detector** — Standalone audio upload/URL deepfake detection

### State Management

All state lives in the top-level `VeritasApp` component via `useState` hooks. The `handleNewAnalysis()` function resets all 20+ state variables across all tabs with a single click.

---

## Backend Architecture

### Fastify Server Configuration

- **Port**: 4311 (configurable via `BACKEND_PORT`)
- **CORS**: Enabled for configured origins
- **Body Limit**: 10MB (supports base64 image/audio uploads)
- **Plugins**: Route autoloading via `fastify.register()`

### Provider Clients

| Provider | Client File | Purpose |
|----------|------------|---------|
| Google Gemini | `providers/gemini-client.ts` | LLM for claim extraction, query generation, verification. Includes retry with exponential backoff for 429s. |
| Tavily | `providers/tavily-client.ts` | Real-time web search for evidence gathering |
| HuggingFace | `providers/optional-detection-api.ts` | AI image classification (binary image streaming) |

### Defensive Fallbacks

The pipeline is designed to **never crash** even if external APIs fail:

- **Gemini rate limited (429)**: Exponential backoff (2s, 4s, 8s) with 3 retries
- **Gemini fully down**: Heuristic verification engine activates — uses keyword overlap scoring and contradiction pattern matching against retrieved citations
- **Tavily fails**: Claims marked as `UNVERIFIABLE` with 22% confidence
- **HuggingFace fails**: `ai_image_probability` returns `null`; page image forensics shows error per-card

---

## Shared Schema Package

`packages/shared/` contains Zod schemas shared between frontend and backend to ensure type-safe contracts.

### Key Schemas

```typescript
AnalyzeRequestSchema  — { input_text?, input_url? }
AnalyzeResponseSchema — {
  source_text, overall_accuracy, verdict_distribution,
  claims[], ai_text_probability, ai_image_probability,
  discovered_images[], warnings[], trace[]
}
ClaimResultSchema — {
  id, claim, source_sentence_ids[], search_queries[],
  verdict, confidence, reasoning, conflict,
  conflict_explanation?, citations[]
}
VerdictSchema — "TRUE" | "FALSE" | "PARTIAL" | "UNVERIFIABLE"
```

Also exports `segmentSentences()` — a regex-based sentence splitter used by both the backend ingestion service and frontend source text panel.

---

## Database & Persistence

**Neon Postgres** (serverless Postgres) via **Drizzle ORM**.

Used exclusively for the bookmarks/saved analyses feature:
- Extension syncs analysis results to the cloud
- Web dashboard sidebar displays saved analyses
- Each bookmark stores: URL, raw text input, full analysis JSON, source ("web" or "extension"), timestamp

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Required | Purpose |
|----------|----------|---------|
| `GEMINI_API_KEY` | ✅ | Google Gemini API for claim analysis, audio detection |
| `GEMINI_MODEL` | ✅ | Model identifier (e.g., `gemini-2.5-flash`) |
| `TAVILY_API_KEY` | ✅ | Real-time web search for evidence |
| `HUGGINGFACE_API_KEY` | ✅ | HuggingFace Inference API for image detection |
| `DATABASE_URL` | ✅ | Neon Postgres connection string |
| `BACKEND_PORT` | ⬜ | Default: `4311` |
| `CORS_ORIGINS` | ⬜ | Default: `http://localhost:4310` |
| `ELEVENLABS_API_KEY` | ⬜ | Reserved for future features |

### Frontend (`frontend/.env.local`)

| Variable | Required | Purpose |
|----------|----------|---------|
| `NEXT_PUBLIC_API_BASE_URL` | ✅ | Backend URL (e.g., `http://localhost:4311`) |

---

## Local Development

### Prerequisites

- Node.js 18+
- npm 9+

### Setup

```bash
# 1. Install all workspace dependencies
npm install

# 2. Copy and configure backend environment
cp backend/.env.example backend/.env
# Edit backend/.env with your API keys

# 3. Copy and configure frontend environment
cp frontend/.env.local.example frontend/.env.local

# 4. Start the full stack (both frontend + backend)
npm run dev
```

### Local Ports

| Service | URL |
|---------|-----|
| Frontend | `http://localhost:4310` |
| Backend  | `http://localhost:4311` |

### Development Commands

```bash
npm test        # Run all workspace tests
npm run lint    # Lint all workspaces
npm run build   # Production build (all workspaces)
```

---

## Deployment

| Layer | Platform | URL |
|-------|----------|-----|
| Frontend | Vercel | Your Vercel deployment URL |
| Backend | Render | `https://gfg-finale.onrender.com` |
| Database | Neon | Serverless Postgres |

### Why Separate Hosts?

The analysis pipeline takes 10-30 seconds per request (scrape → extract → search → verify). Vercel Serverless Functions have a 10-second timeout on the free tier and a 4.5MB body limit. Render allows persistent Fastify processes with no timeout constraints and supports the 10MB body limit needed for base64 audio/image uploads.

### Render Environment Variables

Set all backend `.env` variables in Render's dashboard under Environment → Environment Variables.

### Vercel Environment Variables

Only `NEXT_PUBLIC_API_BASE_URL` is needed, pointing to your Render backend URL.

---

## API Reference

### `GET /health`

Returns a readiness payload.

### `POST /analyze`

Full fact-check analysis pipeline.

**Request:**
```json
{
  "input_text": "NASA says the James Webb Space Telescope launched in December 2021.",
  "input_url": "https://example.com/article"
}
```

**Response:**
```json
{
  "source_text": "...",
  "overall_accuracy": 84,
  "verdict_distribution": { "TRUE": 2, "FALSE": 0, "PARTIAL": 1, "UNVERIFIABLE": 0 },
  "claims": [{
    "id": "claim-1",
    "claim": "...",
    "source_sentence_ids": [0],
    "search_queries": ["..."],
    "verdict": "TRUE",
    "confidence": 88,
    "reasoning": "...",
    "conflict": false,
    "citations": [{ "title": "...", "url": "...", "snippet": "...", "source_type": "government" }]
  }],
  "ai_text_probability": 24,
  "ai_image_probability": null,
  "discovered_images": [{ "url": "...", "alt": "...", "host": "..." }],
  "warnings": [],
  "trace": [{ "stage": "ingesting", "duration_ms": 1200, "meta": {} }]
}
```

### `POST /api/check-image`

AI image deepfake detection.

**Request:**
```json
{ "imageUrl": "https://example.com/photo.jpg" }
// or
{ "imageBase64": "data:image/jpeg;base64,/9j/4AAQ..." }
```

**Response:**
```json
{
  "imageUrl": "https://example.com/photo.jpg",
  "isFake": true,
  "confidenceScore": 87.3,
  "provider": "HuggingFace (umm-maybe/AI-image-detector)"
}
```

### `POST /api/check-audio`

AI audio deepfake detection.

**Request:**
```json
{ "audioUrl": "https://example.com/speech.mp3" }
// or
{ "audioBase64": "data:audio/mpeg;base64,SUQzBA..." }
```

**Response:**
```json
{
  "audioUrl": "https://example.com/speech.mp3",
  "isFake": false,
  "confidenceScore": 12,
  "provider": "Google Gemini 2.5 Flash (Audio Forensics)",
  "message": "Natural breathing patterns, vocal fry, and filler words detected.",
  "indicators": ["Natural breathing", "Variable pitch", "Background noise variation"]
}
```

### `POST /api/bookmarks`

Save an analysis result to the cloud database.

**Request:**
```json
{
  "inputUrl": "https://bbc.com/article",
  "analysisResult": { /* full analyze response */ },
  "source": "extension",
  "type": "url"
}
```
