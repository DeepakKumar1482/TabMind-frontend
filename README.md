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

## Phase 2 — Local AI (summarization, embeddings, semantic search, auto-tags)

All AI runs on-device via [Transformers.js](https://github.com/xenova/transformers.js) (`@xenova/transformers`), **only inside the dashboard tab** (`chrome-extension://<id>/dashboard/index.html`) — never in the background service worker, since model loading needs a full window/WASM-friendly context and is too heavy to run on every capture. The extension's capture flow (Phase 1) stays untouched: it stores raw `title`/`content`/`url` only, fast.

Models (fetched from the HF CDN on first use, cached by the browser after):

| Task | Model | Used for |
|---|---|---|
| Feature extraction | `Xenova/all-MiniLM-L6-v2` | 384-dim sentence embeddings — semantic search, similarity |
| Summarization | `Xenova/distilbart-cnn-6-6` | 1–2 sentence page summary |
| Zero-shot classification | `Xenova/nli-deberta-v3-xsmall` | auto-tags from a fixed candidate label set (`ai/autotag.ts`) |

Flow:

1. On dashboard load, `runBackgroundProcessing()` (`src/pages/index.tsx`) finds every `Page` without an `embedding` (`listUnprocessedPages()` in `database/pages.ts`) and processes them one at a time via `ai/process.ts` → `processPage()`, writing `summary` / `embedding` / `tags` back to Dexie (`updatePage()`). UI shows a small progress indicator while this runs; first load is slower (model download), subsequent loads are fast (cached models, only new pages processed).
2. Semantic search bar embeds the query (`ai/embeddings.ts`) and ranks all pages by cosine similarity against their stored embeddings (`ai/search.ts` → `semanticSearch()`), threshold 0.2, above-threshold results sorted descending.
3. Auto-tags and summaries render inline on both search results and the session page list.

**Known issue (unresolved, tracked, not blocking):** `@xenova/transformers` currently reports 4 high + 1 critical `npm audit` findings (via `protobufjs` / `sharp` in the `onnxruntime-web` dependency chain). Considered switching to `@huggingface/transformers` (the actively maintained successor) — not yet done. Revisit before Phase 5 (production hardening).

## Status

**Phase 1 (Tab Capture / IndexedDB / Dashboard / Restore)** — done, building clean.
**Phase 2 (Local AI: summarization, embeddings, semantic search, auto-tags)** — done, building clean. Runs entirely client-side in the dashboard, on-device.

Not yet done: workspace picker UI, duplicate/cleanup UI, research mode, knowledge graph, real icons (placeholders are solid-color PNGs), Vitest/Playwright tests, `@xenova/transformers` audit findings above. See root project doc for full feature list and phased build order (Phase 1–5).
