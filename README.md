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
├── ai/                         # Phase 2 — not started
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

## Status

**Phase 1 (Tab Capture / IndexedDB / Dashboard / Restore) scaffolded and building clean.** Not yet done: workspace picker UI, AI (Phase 2), duplicate/cleanup UI, research mode, knowledge graph, real icons (placeholders are solid-color PNGs), Vitest/Playwright tests. See root project doc for full feature list and phased build order (Phase 1–5).
