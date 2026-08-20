import { useEffect, useMemo, useState } from "react";
import Head from "next/head";
import { listWorkspaces, createWorkspace, updateWorkspace } from "../../database/workspaces";
import { listSessions, updateSession } from "../../database/sessions";
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

  // Embeds every captured page that hasn't been indexed yet, one at a time
  // so the UI stays responsive while the local model works. Runs once per
  // dashboard load.
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

  async function handleCreateWorkspace() {
    const name = window.prompt("Workspace name")?.trim();
    if (!name) return;
    const icon = window.prompt("Icon (single emoji)", "📁")?.trim() || "📁";
    await createWorkspace({ name, icon, createdAt: Date.now() });
    await loadAll();
  }

  async function handleRenameWorkspace(ws: Workspace) {
    const name = window.prompt("Rename workspace", ws.name)?.trim();
    if (!name || name === ws.name) return;
    await updateWorkspace(ws.id, { name });
    setWorkspaces((prev) => prev.map((w) => (w.id === ws.id ? { ...w, name } : w)));
  }

  async function handleAssignWorkspace(sessionId: number, workspaceId: number) {
    await updateSession(sessionId, { workspaceId });
    setSessions((prev) => prev.map((s) => (s.id === sessionId ? { ...s, workspaceId } : s)));
  }

  async function handleRenameSession(session: Session) {
    const name = window.prompt("Rename session", session.name)?.trim();
    if (!name || name === session.name || !session.id) return;
    await updateSession(session.id, { name });
    setSessions((prev) => prev.map((s) => (s.id === session.id ? { ...s, name } : s)));
  }

  const grouped = useMemo(() => {
    const byWorkspace = workspaces.map((ws) => ({
      workspace: ws,
      sessions: sessions.filter((s) => s.workspaceId === ws.id),
    }));
    const knownIds = new Set(workspaces.map((w) => w.id));
    const orphaned = sessions.filter((s) => !s.workspaceId || !knownIds.has(s.workspaceId));
    return { byWorkspace, orphaned };
  }, [workspaces, sessions]);

  return (
    <>
      <Head>
        <title>TabMind</title>
      </Head>
      <main className="min-h-screen bg-zinc-950 text-zinc-100 selection:bg-teal-400/20">
        <div className="max-w-3xl mx-auto px-6 py-10">
          <header className="flex items-start justify-between gap-4 mb-8">
            <div>
              <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
                <span aria-hidden>🧠</span> TabMind
              </h1>
              <p className="text-sm text-zinc-500 mt-1">
                {sessions.length} session{sessions.length === 1 ? "" : "s"} across {workspaces.length} workspace
                {workspaces.length === 1 ? "" : "s"}
              </p>
            </div>
            <button
              onClick={handleCreateWorkspace}
              className="text-sm px-3 py-1.5 rounded-lg border border-zinc-800 text-zinc-300 hover:border-teal-500/50 hover:text-teal-300 transition-colors"
            >
              + New workspace
            </button>
          </header>

          {aiStatus && aiStatus.done < aiStatus.total && (
            <p className="text-xs text-amber-400/90 mb-5 font-mono">
              Indexing pages for search… {aiStatus.done}/{aiStatus.total} (first run downloads a model, cached after)
            </p>
          )}

          <form onSubmit={runSearch} className="mb-8 flex gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Semantic search across every captured page…"
              className="flex-1 rounded-lg bg-zinc-900 border border-zinc-800 px-3.5 py-2.5 text-sm outline-none focus:border-teal-500/60 placeholder:text-zinc-600 transition-colors"
            />
            <button
              type="submit"
              disabled={searching}
              className="text-sm px-4 py-2.5 rounded-lg bg-teal-500 text-zinc-950 font-medium hover:bg-teal-400 disabled:opacity-50 transition-colors"
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
                className="text-sm px-3 py-2.5 rounded-lg border border-zinc-800 text-zinc-400 hover:bg-zinc-900 transition-colors"
              >
                Clear
              </button>
            )}
          </form>

          {results && (
            <div className="mb-10">
              <p className="text-xs uppercase tracking-wide text-zinc-500 mb-3">{results.length} result{results.length === 1 ? "" : "s"}</p>
              <ul className="flex flex-col gap-2">
                {results.map(({ page, score }) => (
                  <li key={page.id} className="border border-zinc-800 rounded-xl p-3.5 bg-zinc-900/60">
                    <div className="flex items-center gap-2.5">
                      <Favicon url={page.url} size={16} />
                      <a href={page.url} target="_blank" rel="noreferrer" className="font-medium text-sm hover:underline truncate flex-1">
                        {page.title}
                      </a>
                      <span className="text-xs text-teal-400/80 shrink-0 font-mono tabular-nums">{(score * 100).toFixed(0)}%</span>
                    </div>
                    {page.summary && <p className="text-sm text-zinc-400 mt-1.5 ml-[26px]">{page.summary}</p>}
                    <PageTags tags={page.tags} />
                  </li>
                ))}
              </ul>
            </div>
          )}

          {sessions.length === 0 && (
            <p className="text-zinc-500 text-sm border border-dashed border-zinc-800 rounded-xl p-6 text-center">
              No sessions yet. Hit the panic button in the extension popup to collapse your tabs.
            </p>
          )}

          <div className="flex flex-col gap-8">
            {grouped.orphaned.length > 0 && (
              <WorkspaceSection
                icon="❔"
                name="Unassigned"
                sessions={grouped.orphaned}
                workspaces={workspaces}
                expanded={expanded}
                pagesBySession={pagesBySession}
                onToggle={toggleSession}
                onRestore={restoreSession}
                onAssign={handleAssignWorkspace}
                onRenameSession={handleRenameSession}
              />
            )}
            {grouped.byWorkspace.map(({ workspace, sessions: wsSessions }) => (
              <WorkspaceSection
                key={workspace.id}
                icon={workspace.icon}
                name={workspace.name}
                sessions={wsSessions}
                workspaces={workspaces}
                expanded={expanded}
                pagesBySession={pagesBySession}
                onToggle={toggleSession}
                onRestore={restoreSession}
                onAssign={handleAssignWorkspace}
                onRenameSession={handleRenameSession}
                onRename={() => handleRenameWorkspace(workspace)}
              />
            ))}
          </div>
        </div>
      </main>
    </>
  );
}

function WorkspaceSection({
  icon,
  name,
  sessions,
  workspaces,
  expanded,
  pagesBySession,
  onToggle,
  onRestore,
  onAssign,
  onRenameSession,
  onRename,
}: {
  icon: string;
  name: string;
  sessions: Session[];
  workspaces: Workspace[];
  expanded: number | null;
  pagesBySession: Record<number, Page[]>;
  onToggle: (id: number) => void;
  onRestore: (id: number) => void;
  onAssign: (sessionId: number, workspaceId: number) => void;
  onRenameSession: (session: Session) => void;
  onRename?: () => void;
}) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-base" aria-hidden>{icon}</span>
        <h2 className="text-sm font-semibold text-zinc-300">{name}</h2>
        <span className="text-xs text-zinc-600 font-mono tabular-nums">{sessions.length}</span>
        {onRename && (
          <button
            onClick={onRename}
            className="text-xs text-zinc-600 hover:text-teal-300 ml-auto transition-colors"
          >
            Rename
          </button>
        )}
      </div>

      {sessions.length === 0 ? (
        <p className="text-xs text-zinc-600 border border-dashed border-zinc-800 rounded-xl px-4 py-3">
          Nothing assigned here yet.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {sessions.map((session) => (
            <SessionCard
              key={session.id}
              session={session}
              workspaces={workspaces}
              isExpanded={expanded === session.id}
              pages={session.id ? pagesBySession[session.id] : undefined}
              onToggle={onToggle}
              onRestore={onRestore}
              onAssign={onAssign}
              onRenameSession={onRenameSession}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function SessionCard({
  session,
  workspaces,
  isExpanded,
  pages,
  onToggle,
  onRestore,
  onAssign,
  onRenameSession,
}: {
  session: Session;
  workspaces: Workspace[];
  isExpanded: boolean;
  pages: Page[] | undefined;
  onToggle: (id: number) => void;
  onRestore: (id: number) => void;
  onAssign: (sessionId: number, workspaceId: number) => void;
  onRenameSession: (session: Session) => void;
}) {
  return (
    <div className="border border-zinc-800 rounded-xl p-4 bg-zinc-900/40 hover:border-zinc-700 transition-colors">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 group flex items-baseline gap-1.5">
          <div className="min-w-0">
            <p className="font-medium text-sm truncate">{session.name}</p>
            <p className="text-xs text-zinc-500 mt-0.5 font-mono tabular-nums">
              {session.tabCount} tabs · {new Date(session.createdAt).toLocaleString()}
            </p>
          </div>
          <button
            onClick={() => onRenameSession(session)}
            aria-label="Rename session"
            className="text-xs text-zinc-700 hover:text-teal-300 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
          >
            ✎
          </button>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <select
            value={session.workspaceId ?? ""}
            onChange={(e) => session.id && onAssign(session.id, Number(e.target.value))}
            className="text-xs rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-zinc-400 outline-none focus:border-teal-500/60 transition-colors"
          >
            <option value="" disabled>
              Move to…
            </option>
            {workspaces.map((w) => (
              <option key={w.id} value={w.id}>
                {w.icon} {w.name}
              </option>
            ))}
          </select>
          <button
            onClick={() => session.id && onToggle(session.id)}
            className="text-xs px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors"
          >
            {isExpanded ? "Hide" : "View"}
          </button>
          <button
            onClick={() => session.id && onRestore(session.id)}
            className="text-xs px-3 py-1.5 rounded-lg bg-teal-500 text-zinc-950 font-medium hover:bg-teal-400 transition-colors"
          >
            Restore
          </button>
        </div>
      </div>

      {isExpanded && (
        <ul className="mt-4 flex flex-col gap-3 border-t border-zinc-800 pt-3.5">
          {(pages ?? []).map((page) => (
            <li key={page.id} className="flex gap-2.5">
              <Favicon url={page.url} size={16} />
              <div className="min-w-0 flex-1">
                <a href={page.url} target="_blank" rel="noreferrer" className="text-sm text-zinc-200 hover:underline truncate block">
                  {page.title}
                </a>
                <p className="text-xs text-zinc-600 truncate">{hostname(page.url)}</p>
                {page.summary && <p className="text-xs text-zinc-500 mt-1">{page.summary}</p>}
                <PageTags tags={page.tags} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Favicon({ url, size = 16 }: { url: string; size?: number }) {
  const [errored, setErrored] = useState(false);
  const src =
    typeof chrome !== "undefined" && chrome.runtime?.id
      ? `chrome-extension://${chrome.runtime.id}/_favicon/?pageUrl=${encodeURIComponent(url)}&size=${size * 2}`
      : undefined;

  if (!src || errored) {
    return (
      <span
        className="shrink-0 rounded-sm bg-zinc-800 mt-0.5"
        style={{ width: size, height: size }}
        aria-hidden
      />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      className="shrink-0 rounded-sm mt-0.5"
      onError={() => setErrored(true)}
    />
  );
}

function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function PageTags({ tags }: { tags: string[] }) {
  if (!tags.length) return null;
  return (
    <div className="flex gap-1.5 mt-1.5 flex-wrap">
      {tags.map((tag) => (
        <span key={tag} className="text-[11px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
          {tag}
        </span>
      ))}
    </div>
  );
}
