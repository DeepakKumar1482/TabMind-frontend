# TabMind — Frontend

Chrome extension UI + dashboard. Next.js.

## Scope

- Chrome Extension (Manifest V3)
  - Panic Button (collapse tabs)
  - Context menu integration
  - Background service worker
  - Content script (page extraction)
- Dashboard (Next.js app)
  - Workspaces / Sessions view
  - Semantic search UI
  - Research Mode UI
  - Knowledge Graph (React Flow)
  - Notes, Read-Later, Analytics
  - AI model management / settings UI

## Local AI (runs in extension/frontend)

- Transformers.js
- Embeddings: MiniLM
- Acceleration: WebGPU, WASM fallback
- Summarization, tagging, classification, similarity — all on-device

## Tech Stack

- Next.js + TypeScript
- Tailwind CSS
- Vite (for extension bundle, if separate from Next build)
- React Flow (knowledge graph)
- Vitest + Playwright

## Talks to Backend for

- Auth (if added later)
- Sync across devices (optional, not required for MVP — local-first)
- MongoDB-backed persistence beyond IndexedDB (optional cloud sync)

## Structure

```
frontend/
├── extension/
│   ├── manifest.json
│   ├── background/
│   │   ├── service-worker.ts   # onMessage router
│   │   ├── tab-manager.ts      # panic capture, dedupe, restore
│   │   └── message-handler.ts  # message types
│   ├── content/extractor.ts    # injected page-text extraction
│   ├── popup/                  # Panic Button popup (React)
│   └── icons/
├── database/                   # IndexedDB (Dexie.js) — local-first storage
│   ├── db.ts
│   ├── pages.ts
│   ├── sessions.ts
│   └── workspaces.ts
├── shared/
│   ├── types/
│   └── constants/protected-domains.ts
├── src/app/                    # Next.js dashboard (static-exported, packaged into the extension)
├── ai/                          # Phase 2 — local AI (Transformers.js), dashboard-only
│   ├── pipelines.ts             # lazy singleton loaders (embedder / summarizer / classifier)
│   ├── embeddings.ts            # embed(text), cosineSimilarity()
│   ├── summarize.ts             # summarize(content)
│   ├── autotag.ts               # autoTag(text) — zero-shot classification
│   ├── process.ts               # processPage() — runs all three per page
│   └── search.ts                # semanticSearch(query, pages)
├── research/                   # Phase 4 — not started
└── graph/                      # Phase 4 — not started
```

## Build & load (Phase 1 — done)

```
npm run build:all      # next build (static export) -> vite build (extension) -> copy dashboard in
```

Then load `dist-extension/` as an unpacked extension in `chrome://extensions` (Developer Mode).

- Popup → **Collapse Tabs** queries all tabs, skips protected domains (`shared/constants/protected-domains.ts`), extracts page text via `chrome.scripting.executeScript`, dedupes by URL, writes a `Session` + `Page[]` to IndexedDB, closes the captured tabs, opens the dashboard.
- Dashboard (`chrome-extension://<id>/dashboard/index.html`) lists sessions, expands to page list, **Restore All** reopens every page in the session.
- Next.js dashboard runs with `basePath: "/dashboard"` + `output: "export"` so its static assets resolve correctly when nested inside the extension package.

## Phase 2 — AI (embeddings local, summarization/tags via Gemini)

Runs **only inside the dashboard tab** (`chrome-extension://<id>/dashboard/index.html`) — never in the background service worker. The extension's capture flow (Phase 1) stays untouched: it stores raw `title`/`content`/`url` only, fast.

| Task | Where | How |
|---|---|---|
| Embeddings (semantic search) | On-device | [Transformers.js](https://github.com/xenova/transformers.js), `Xenova/all-MiniLM-L6-v2` — 384-dim, fetched from HF CDN once, cached by browser, never leaves the machine (`ai/embeddings.ts`) |
| Summarization + auto-tags | Backend proxy | `ai/gemini.ts` → `POST {NEXT_PUBLIC_BACKEND_URL}/api/ai/process` → backend calls Gemini (`gemini-2.5-flash`). Page title/content is sent off-device for this step — see privacy note below. |

Flow:

1. On dashboard load, `runBackgroundProcessing()` (`src/app/page.tsx`) finds every `Page` without an `embedding` (`listUnprocessedPages()` in `database/pages.ts`) and processes them one at a time via `ai/process.ts` → `processPage()`: embedding computed locally, summary+tags fetched from the backend, both written back to Dexie (`updatePage()`). UI shows a small progress indicator while this runs.
2. Semantic search bar embeds the query locally (`ai/embeddings.ts`) and ranks all pages by cosine similarity against their stored embeddings (`ai/search.ts` → `semanticSearch()`), threshold 0.2, above-threshold results sorted descending. Fully local — no network call.
3. Auto-tags and summaries render inline on both search results and the session page list.

**Requires the backend running locally** (`../backend`, `./mvnw spring-boot:run`) with `GEMINI_API_KEY` set in `backend/.env` — see backend README's Phase 2 section. If the backend is down/unset, embeddings + search still work; summary/tags just fail silently per-page (logged to console, doesn't block other pages).

**Privacy note:** this is a deliberate departure from "fully local-first" for summarization/tags — captured page content is sent to Google's Gemini API via the backend for that step. Embeddings/semantic search remain 100% on-device. The Gemini API key lives only in `backend/.env` (gitignored, never committed) and is never present in this frontend's bundle/client code — the extension can be fully unpacked/inspected by anyone and the key won't be in it, since the browser never talks to Gemini directly, only to the backend proxy.

**Known issue (unresolved, tracked, not blocking):** `@xenova/transformers` currently reports 4 high + 1 critical `npm audit` findings (via `protobufjs` / `sharp` in the `onnxruntime-web` dependency chain). Still used here for the embedding model only (smaller surface than before, now that summarization/classification models were dropped). Considered switching to `@huggingface/transformers` — not yet done. Revisit before Phase 5 (production hardening).

## Status

**Phase 1 (Tab Capture / IndexedDB / Dashboard / Restore)** — done, building clean.
**Phase 2 (AI: local embeddings + semantic search, Gemini-backed summarization/auto-tags)** — done, building clean. Requires backend running for summary/tags.

Not yet done: workspace picker UI, duplicate/cleanup UI, research mode, knowledge graph, real icons (placeholders are solid-color PNGs), Vitest/Playwright tests, `@xenova/transformers` audit findings above. See root project doc for full feature list and phased build order (Phase 1–5).
