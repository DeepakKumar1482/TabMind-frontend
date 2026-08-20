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
- Embeddings: MiniLM — semantic search / similarity, all on-device
- Acceleration: WebGPU, WASM fallback
- Summarization/tagging tried twice (local models, then Gemini proxy), dropped both times — see Phase 2 below

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
├── src/pages/                   # Next.js dashboard, Pages Router (static-exported, packaged into the extension)
│   ├── index.tsx                 # Dashboard overview — stats, recent sessions, activity chart
│   ├── sessions.tsx               # Full session/workspace management (search, rename, delete, restore)
│   └── recently-closed.tsx        # Full recently-captured-tabs feed
├── src/components/              # Layout (sidebar/topbar), SessionList (Workspace/SessionCard), ui.tsx (Favicon/CopyUrlButton/ActionMenu/PageTags)
├── src/hooks/useSessions.ts     # Shared session/workspace state + CRUD, used by index.tsx and sessions.tsx
├── src/lib/format.ts            # hostname/formatWhen/timeAgo/formatBytes
├── ai/                          # Phase 2 — local AI (Transformers.js), dashboard-only
│   ├── pipelines.ts             # lazy singleton loader (embedder only)
│   ├── embeddings.ts            # embed(text), cosineSimilarity()
│   ├── process.ts               # processPage() — embeds one page
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

## Phase 2 — Local AI (embeddings, semantic search)

Runs on-device via [Transformers.js](https://github.com/xenova/transformers.js) (`@xenova/transformers`), **only inside the dashboard tab** (`chrome-extension://<id>/dashboard/index.html`) — never in the background service worker, since model loading needs a full window/WASM-friendly context and is too heavy to run on every capture. The extension's capture flow (Phase 1) stays untouched: it stores raw `title`/`content`/`url` only, fast.

Summarization and auto-tagging were tried twice — first as local models (`distilbart-cnn-6-6` + `nli-deberta-v3-xsmall`), then as a Gemini backend proxy — and dropped both times (weight/latency for the former, rate limits for the latter, quality not worth either cost). Only the embedder remains:

| Task | Model | Used for |
|---|---|---|
| Feature extraction | `Xenova/all-MiniLM-L6-v2` | 384-dim sentence embeddings — semantic search, similarity |

Flow:

1. On dashboard load, `runBackgroundProcessing()` (`src/pages/index.tsx`) finds every `Page` without an `embedding` (`listUnprocessedPages()` in `database/pages.ts`) and embeds them one at a time via `ai/process.ts` → `processPage()`, writing `embedding` back to Dexie (`updatePage()`). UI shows a small progress indicator while this runs; first load is slower (model download), subsequent loads are fast (cached model, only new pages processed).
2. Semantic search bar embeds the query (`ai/embeddings.ts`) and ranks all pages by cosine similarity against their stored embeddings (`ai/search.ts` → `semanticSearch()`), threshold 0.2, above-threshold results sorted descending.

**Known issue (unresolved, tracked, not blocking):** `@xenova/transformers` currently reports 4 high + 1 critical `npm audit` findings (via `protobufjs` / `sharp` in the `onnxruntime-web` dependency chain). Smaller surface now that only the embedding model is loaded. Considered switching to `@huggingface/transformers` (the actively maintained successor) — not yet done. Revisit before Phase 5 (production hardening).

## Phase 3 — Manual workspace organization

No AI categorization (both attempts at it were dropped — see above). Sessions are grouped by workspace on the dashboard, with a `Move to…` dropdown on each session card (`database/sessions.ts` → `updateSession()`) and a `+ New workspace` control in the header (`database/workspaces.ts` → `createWorkspace()`, `updateWorkspace()` for renaming). Sessions whose `workspaceId` doesn't resolve to a real workspace fall into an "Unassigned" section rather than being hidden.

Each page row also renders its site favicon via the `favicon` permission + `chrome-extension://<id>/_favicon/?pageUrl=…` (Chrome's own local favicon cache — no network call, works offline).

V1 session-management pass (own git branch each, merged sequentially): rename/delete session, delete individual tabs, copy URL, restore selected tabs, keyword session search (separate from semantic search), session metadata (tabs/domains/created/last opened via a new `lastOpenedAt` field).

## Dashboard redesign

Multi-page shell (`src/components/Layout.tsx`, wrapped in `_app.tsx`) — sidebar (Dashboard/Sessions/Recently Closed nav, Groups list with live session counts, storage meter via `navigator.storage.estimate()`) + topbar search with ⌘K focus. Violet accent, replacing the earlier teal single-page layout.

Every stat shown is backed by real data — no placeholder numbers. Dashboard overview computes Total Sessions/Tabs with real week-over-week deltas (from `createdAt` timestamps), Groups count, and Storage Used; the Activity Overview chart (hand-rolled inline SVG, no charting library) buckets real `capturedAt` timestamps into the last 7 days. "Recently Closed" is genuinely the most-recently-captured pages across all sessions (`capturedAt` desc), not a separate soft-delete feature. Deliberately **not** included: Pinned Tabs, Hours Saved, notifications, user profile/avatar — none have a real data source yet (no pin feature, no accounts, no meaningful "hours saved" formula), so they're left out rather than faked.

## Status

**Phase 1 (Tab Capture / IndexedDB / Dashboard / Restore)** — done, building clean.
**Phase 2 (Local AI: embeddings, semantic search)** — done, building clean. Runs entirely client-side in the dashboard, on-device.
**Phase 3 (Manual workspace organization, favicons, session management V1, dashboard redesign)** — done, building clean.

Not yet done: duplicate/cleanup UI, research mode, knowledge graph, real icons (placeholders are solid-color PNGs), Vitest/Playwright tests, `@xenova/transformers` audit findings above. See root project doc for full feature list and phased build order.
