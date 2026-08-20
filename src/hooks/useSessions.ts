import { useEffect, useMemo, useState } from "react";
import { listWorkspaces, createWorkspace, updateWorkspace } from "../../database/workspaces";
import { listSessions, updateSession, deleteSession } from "../../database/sessions";
import { listPagesBySession, listAllPages, listUnprocessedPages, updatePage, deletePage } from "../../database/pages";
import { processPage } from "../../ai/process";
import { semanticSearch, type SearchResult } from "../../ai/search";
import { hostname } from "../lib/format";
import type { Workspace, Session, Page } from "../../shared/types";

// Shared data + actions behind both the dashboard overview and the full
// sessions page — one Dexie-backed source of truth, one set of handlers.
export function useSessions() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [pagesBySession, setPagesBySession] = useState<Record<number, Page[]>>({});
  const [expanded, setExpanded] = useState<number | null>(null);
  const [selectedPageIds, setSelectedPageIds] = useState<Set<number>>(new Set());

  const [aiStatus, setAiStatus] = useState<{ done: number; total: number } | null>(null);

  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[] | null>(null);

  const [sessionQuery, setSessionQuery] = useState("");
  const [rawSessionResults, setRawSessionResults] = useState<{ session: Session; pages: Page[] }[] | null>(null);
  const sessionResults = sessionQuery.trim() ? rawSessionResults : null;

  useEffect(() => {
    void loadAll();
    void runBackgroundProcessing();
  }, []);

  useEffect(() => {
    const q = sessionQuery.trim().toLowerCase();
    if (!q) return;
    const handle = setTimeout(async () => {
      const allPages = await listAllPages();
      const matchingPagesBySession = new Map<number, Page[]>();
      for (const page of allPages) {
        const haystack = `${page.title} ${page.url} ${hostname(page.url)}`.toLowerCase();
        if (!haystack.includes(q)) continue;
        const list = matchingPagesBySession.get(page.sessionId) ?? [];
        list.push(page);
        matchingPagesBySession.set(page.sessionId, list);
      }
      const matches: { session: Session; pages: Page[] }[] = [];
      for (const session of sessions) {
        const nameMatches = session.name.toLowerCase().includes(q);
        const pageMatches = (session.id && matchingPagesBySession.get(session.id)) || [];
        if (nameMatches || pageMatches.length > 0) matches.push({ session, pages: pageMatches });
      }
      setRawSessionResults(matches);
    }, 150);
    return () => clearTimeout(handle);
  }, [sessionQuery, sessions]);

  async function loadAll() {
    const [w, s] = await Promise.all([listWorkspaces(), listSessions()]);
    setWorkspaces(w);
    setSessions(s);
  }

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
            [page.sessionId]: prev[page.sessionId].map((p) => (p.id === page.id ? { ...p, ...fields } : p)),
          };
        });
      } catch (err) {
        console.error("AI processing failed for page", page.id, err);
      }
      setAiStatus({ done: i + 1, total: unprocessed.length });
    }
  }

  async function ensurePagesLoaded(sessionId: number) {
    if (!pagesBySession[sessionId]) {
      const pages = await listPagesBySession(sessionId);
      setPagesBySession((prev) => ({ ...prev, [sessionId]: pages }));
    }
  }

  async function toggleSession(sessionId: number) {
    setSelectedPageIds(new Set());
    if (expanded === sessionId) {
      setExpanded(null);
      return;
    }
    await ensurePagesLoaded(sessionId);
    setExpanded(sessionId);
  }

  async function markSessionOpened(sessionId: number) {
    const lastOpenedAt = Date.now();
    await updateSession(sessionId, { lastOpenedAt });
    setSessions((prev) => prev.map((s) => (s.id === sessionId ? { ...s, lastOpenedAt } : s)));
  }

  async function restoreSession(sessionId: number) {
    if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) return;
    await chrome.runtime.sendMessage({ type: "RESTORE_SESSION", sessionId });
    await markSessionOpened(sessionId);
  }

  function toggleSelectPage(pageId: number) {
    setSelectedPageIds((prev) => {
      const next = new Set(prev);
      if (next.has(pageId)) next.delete(pageId);
      else next.add(pageId);
      return next;
    });
  }

  function selectAllPages(pageIds: number[]) {
    setSelectedPageIds((prev) => (prev.size === pageIds.length ? new Set() : new Set(pageIds)));
  }

  async function restoreSelectedPages(sessionId: number) {
    const pages = pagesBySession[sessionId] ?? [];
    const urls = pages.filter((p) => selectedPageIds.has(p.id)).map((p) => p.url);
    if (!urls.length || typeof chrome === "undefined" || !chrome.runtime?.sendMessage) return;
    await chrome.runtime.sendMessage({ type: "RESTORE_PAGES", urls });
    await markSessionOpened(sessionId);
  }

  async function reopenPage(page: Page) {
    if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) return;
    await chrome.runtime.sendMessage({ type: "RESTORE_PAGES", urls: [page.url] });
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

  async function handleDeleteSession(session: Session) {
    if (!session.id) return;
    const ok = window.confirm(`Delete "${session.name}" and its ${session.tabCount} tabs? This can't be undone.`);
    if (!ok) return;
    await deleteSession(session.id);
    setSessions((prev) => prev.filter((s) => s.id !== session.id));
    setPagesBySession((prev) => {
      const next = { ...prev };
      delete next[session.id!];
      return next;
    });
    setExpanded((prev) => (prev === session.id ? null : prev));
  }

  async function handleDeletePage(page: Page) {
    const ok = window.confirm(`Remove "${page.title}" from this session?`);
    if (!ok) return;
    const newTabCount = Math.max(0, (sessions.find((s) => s.id === page.sessionId)?.tabCount ?? 1) - 1);
    await deletePage(page.id);
    await updateSession(page.sessionId, { tabCount: newTabCount });
    setPagesBySession((prev) => {
      const existing = prev[page.sessionId];
      if (!existing) return prev;
      return { ...prev, [page.sessionId]: existing.filter((p) => p.id !== page.id) };
    });
    setSessions((prev) => prev.map((s) => (s.id === page.sessionId ? { ...s, tabCount: newTabCount } : s)));
  }

  async function handleTogglePin(page: Page) {
    const pinned = !page.pinned;
    await updatePage(page.id, { pinned });
    setPagesBySession((prev) => {
      const existing = prev[page.sessionId];
      if (!existing) return prev;
      return { ...prev, [page.sessionId]: existing.map((p) => (p.id === page.id ? { ...p, pinned } : p)) };
    });
  }

  async function handleSetPageGroup(page: Page, group: string | undefined) {
    await updatePage(page.id, { group });
    setPagesBySession((prev) => {
      const existing = prev[page.sessionId];
      if (!existing) return prev;
      return { ...prev, [page.sessionId]: existing.map((p) => (p.id === page.id ? { ...p, group } : p)) };
    });
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

  return {
    workspaces,
    sessions,
    pagesBySession,
    expanded,
    selectedPageIds,
    aiStatus,
    query,
    setQuery,
    searching,
    results,
    setResults,
    sessionQuery,
    setSessionQuery,
    sessionResults,
    grouped,
    toggleSession,
    restoreSession,
    toggleSelectPage,
    selectAllPages,
    restoreSelectedPages,
    reopenPage,
    runSearch,
    handleCreateWorkspace,
    handleRenameWorkspace,
    handleAssignWorkspace,
    handleRenameSession,
    handleDeleteSession,
    handleDeletePage,
    handleSetPageGroup,
    handleTogglePin,
  };
}
