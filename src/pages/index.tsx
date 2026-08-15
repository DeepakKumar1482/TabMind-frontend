import { useEffect, useState } from "react";
import Head from "next/head";
import { listWorkspaces } from "../../database/workspaces";
import { listSessions } from "../../database/sessions";
import { listPagesBySession, listAllPages, listUnprocessedPages, updatePage } from "../../database/pages";
import { processPage } from "../../ai/process";
import { semanticSearch, type SearchResult } from "../../ai/search";
import type { Workspace, Session, Page } from "../../shared/types";

export default function Dashboard() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [pagesBySession, setPagesBySession] = useState<Record<number, Page[]>>({});
  const [expanded, setExpanded] = useState<number | null>(null);

  const [aiStatus, setAiStatus] = useState<{ done: number; total: number } | null>(null);

  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[] | null>(null);

  useEffect(() => {
    void loadAll();
    void runBackgroundProcessing();
  }, []);

  async function loadAll() {
    const [w, s] = await Promise.all([listWorkspaces(), listSessions()]);
    setWorkspaces(w);
    setSessions(s);
  }

  // Summarize / embed / auto-tag every captured page that hasn't been
  // processed yet. Runs once per dashboard load, one page at a time so the
  // UI stays responsive while the local models work.
  async function runBackgroundProcessing() {
    const unprocessed = await listUnprocessedPages();
    if (unprocessed.length === 0) return;

    setAiStatus({ done: 0, total: unprocessed.length });
    for (let i = 0; i < unprocessed.length; i++) {
      const page = unprocessed[i];
      try {
        const fields = await processPage(page);
        await updatePage(page.id, fields);
        setPagesBySession((prev) => {
          if (!prev[page.sessionId]) return prev;
          return {
            ...prev,
            [page.sessionId]: prev[page.sessionId].map((p) =>
              p.id === page.id ? { ...p, ...fields } : p
            ),
          };
        });
      } catch (err) {
        console.error("AI processing failed for page", page.id, err);
      }
      setAiStatus({ done: i + 1, total: unprocessed.length });
    }
  }

  async function toggleSession(sessionId: number) {
    if (expanded === sessionId) {
      setExpanded(null);
      return;
    }
    if (!pagesBySession[sessionId]) {
      const pages = await listPagesBySession(sessionId);
      setPagesBySession((prev) => ({ ...prev, [sessionId]: pages }));
    }
    setExpanded(sessionId);
  }

  async function restoreSession(sessionId: number) {
    if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) return;
    await chrome.runtime.sendMessage({ type: "RESTORE_SESSION", sessionId });
  }

  async function runSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) {
      setResults(null);
      return;
    }
    setSearching(true);
    try {
      const pages = await listAllPages();
      setResults(await semanticSearch(query, pages));
    } finally {
      setSearching(false);
    }
  }

  function workspaceName(id?: number) {
    return workspaces.find((w) => w.id === id)?.name ?? "Unsorted";
  }

  return (
    <>
      <Head>
        <title>TabMind</title>
      </Head>
      <main className="min-h-screen bg-slate-950 text-slate-100 p-8">
        <h1 className="text-2xl font-semibold mb-1">🧠 TabMind</h1>
        <p className="text-slate-400 mb-4">
          {sessions.length} sessions · {workspaces.length} workspaces
        </p>

        {aiStatus && aiStatus.done < aiStatus.total && (
          <p className="text-xs text-amber-400 mb-4">
            Local AI processing pages… {aiStatus.done}/{aiStatus.total} (first run downloads models, cached after)
          </p>
        )}

        <form onSubmit={runSearch} className="mb-8 flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Semantic search across every captured page…"
            className="flex-1 rounded-md bg-slate-900 border border-slate-800 px-3 py-2 text-sm outline-none focus:border-slate-600"
          />
          <button
            type="submit"
            disabled={searching}
            className="text-sm px-4 py-2 rounded-md bg-slate-800 hover:bg-slate-700 disabled:opacity-50"
          >
            {searching ? "Searching…" : "Search"}
          </button>
          {results && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setResults(null);
              }}
              className="text-sm px-3 py-2 rounded-md bg-slate-900 border border-slate-800 hover:bg-slate-800"
            >
              Clear
            </button>
          )}
        </form>

        {results && (
          <div className="mb-8">
            <p className="text-sm text-slate-500 mb-2">{results.length} result(s)</p>
            <ul className="flex flex-col gap-2">
              {results.map(({ page, score }) => (
                <li key={page.id} className="border border-slate-800 rounded-lg p-3 bg-slate-900">
                  <div className="flex items-center justify-between gap-2">
                    <a href={page.url} target="_blank" rel="noreferrer" className="font-medium hover:underline truncate">
                      {page.title}
                    </a>
                    <span className="text-xs text-slate-500 shrink-0">{(score * 100).toFixed(0)}%</span>
                  </div>
                  {page.summary && <p className="text-sm text-slate-400 mt-1">{page.summary}</p>}
                  <PageTags tags={page.tags} />
                </li>
              ))}
            </ul>
          </div>
        )}

        {sessions.length === 0 && (
          <p className="text-slate-500">
            No sessions yet. Hit the panic button in the extension popup to collapse your tabs.
          </p>
        )}

        <div className="flex flex-col gap-3">
          {sessions.map((session) => (
            <div key={session.id} className="border border-slate-800 rounded-lg p-4 bg-slate-900">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{session.name}</p>
                  <p className="text-sm text-slate-500">
                    {workspaceName(session.workspaceId)} · {session.tabCount} tabs ·{" "}
                    {new Date(session.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => session.id && toggleSession(session.id)}
                    className="text-sm px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700"
                  >
                    {expanded === session.id ? "Hide" : "View"}
                  </button>
                  <button
                    onClick={() => session.id && restoreSession(session.id)}
                    className="text-sm px-3 py-1.5 rounded-md bg-emerald-700 hover:bg-emerald-600"
                  >
                    Restore All
                  </button>
                </div>
              </div>

              {expanded === session.id && session.id && (
                <ul className="mt-4 flex flex-col gap-3 border-t border-slate-800 pt-3">
                  {(pagesBySession[session.id] ?? []).map((page) => (
                    <li key={page.id} className="text-sm text-slate-300">
                      <a href={page.url} target="_blank" rel="noreferrer" className="hover:underline truncate block">
                        {page.title}
                      </a>
                      {page.summary && <p className="text-xs text-slate-500 mt-0.5">{page.summary}</p>}
                      <PageTags tags={page.tags} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </main>
    </>
  );
}

function PageTags({ tags }: { tags: string[] }) {
  if (!tags.length) return null;
  return (
    <div className="flex gap-1.5 mt-1 flex-wrap">
      {tags.map((tag) => (
        <span key={tag} className="text-[11px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
          {tag}
        </span>
      ))}
    </div>
  );
}
