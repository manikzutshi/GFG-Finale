# Veritas

Veritas is a full-stack prototype for AI-assisted fact checking. It extracts factual claims from text or a URL, retrieves live evidence from the web, verifies each claim against retrieved sources, and returns an explainable report with citations.

The project is organized as an npm-workspaces monorepo:

- `frontend` - Next.js UI
- `backend` - Fastify API and analysis pipeline
- `packages/shared` - shared schemas, types, and sentence-segmentation helpers

## What It Does

- Accepts pasted text and/or a URL
- Extracts atomic, verifiable claims
- Generates search queries for each claim
- Searches Tavily for evidence
- Verifies claims with Gemini using only retrieved evidence
- Detects source conflicts
- Estimates AI-generated text and image probability heuristically
- Returns a structured report that can be reused by a future browser extension

## Local Ports

Veritas is configured to avoid the `5172-5178` range and currently uses:

- Frontend: `http://localhost:4310`
- Backend: `http://localhost:4311`

These ports were checked during setup and were free on this machine at implementation time.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create backend env file from [`backend/.env.example`](/C:/Users/Manik/Downloads/GFG Finals/backend/.env.example):

```env
GEMINI_API_KEY=your-gemini-key
GEMINI_MODEL=gemini-2.0-flash
TAVILY_API_KEY=your-tavily-key
BACKEND_PORT=4311
CORS_ORIGINS=http://localhost:4310
AI_DETECTION_API_URL=
AI_DETECTION_API_KEY=
```

3. Create frontend env file from [`frontend/.env.local.example`](/C:/Users/Manik/Downloads/GFG Finals/frontend/.env.local.example):

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:4311
```

4. Start the full stack:

```bash
npm run dev
```

5. Open `http://localhost:4310`.

## API

### `GET /health`

Returns a simple readiness payload.

### `POST /analyze`

Request:

```json
{
  "input_text": "NASA says the James Webb Space Telescope launched in December 2021.",
  "input_url": "https://example.com/article"
}
```

Response shape:

```json
{
  "source_text": "...",
  "overall_accuracy": 84,
  "verdict_distribution": {
    "TRUE": 2,
    "FALSE": 0,
    "PARTIAL": 1,
    "UNVERIFIABLE": 0
  },
  "claims": [
    {
      "id": "claim-1",
      "claim": "...",
      "source_sentence_ids": [0],
      "search_queries": ["..."],
      "verdict": "TRUE",
      "confidence": 88,
      "reasoning": "...",
      "conflict": false,
      "citations": [
        {
          "title": "...",
          "url": "...",
          "snippet": "...",
          "source_type": "government"
        }
      ]
    }
  ],
  "ai_text_probability": 24,
  "ai_image_probability": null,
  "warnings": [],
  "trace": []
}
```

## Architecture Notes

- The backend is stateless and CORS-enabled so a browser extension can call the same `/analyze` endpoint directly later.
- The shared workspace package keeps request/response schemas and sentence segmentation consistent between backend and frontend.
- URL handling uses readable-article extraction first, then falls back to broader page text if needed.
- Claim extraction, query generation, and verification all have defensive fallbacks so the pipeline degrades gracefully if model output is malformed.
- AI detection is heuristic by default, with optional API hooks available through `AI_DETECTION_API_URL` and `AI_DETECTION_API_KEY`.

## Development Commands

```bash
npm test
npm run lint
npm run build
```

## Extension Readiness

The current backend contract is intentionally reusable:

- send selected page text or a page URL to `/analyze`
- receive structured claim-level verdicts with citations
- map `source_sentence_ids` back to highlighted DOM ranges in an extension UI
- reuse the same shared schemas for extension messaging later

## Verification Status

The current workspace passes:

- `npm test`
- `npm run lint`
- `npm run build`
