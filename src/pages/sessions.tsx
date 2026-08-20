import { useEffect } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { useSessions } from "../hooks/useSessions";
import { WorkspaceSection } from "../components/SessionList";
import { Favicon, CopyUrlButton, PageTags } from "../components/ui";
import { hostname } from "../lib/format";

export default function SessionsPage() {
  const router = useRouter();
  const s = useSessions();

  useEffect(() => {
    if (typeof router.query.q === "string") s.setSessionQuery(router.query.q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.query.q]);

  const workspaceFilter = typeof router.query.workspace === "string" ? Number(router.query.workspace) : null;
  const byWorkspace = workspaceFilter
    ? s.grouped.byWorkspace.filter((g) => g.workspace.id === workspaceFilter)
    : s.grouped.byWorkspace;

  return (
    <>
      <Head>
        <title>Sessions · TabMind</title>
      </Head>
      <div className="max-w-3xl mx-auto px-6 py-10">
        <header className="mb-6">
          <h1 className="text-xl font-semibold tracking-tight">Sessions</h1>
          <p className="text-sm text-zinc-500 mt-1">
            {s.sessions.length} session{s.sessions.length === 1 ? "" : "s"} across {s.workspaces.length} workspace
            {s.workspaces.length === 1 ? "" : "s"}
          </p>
        </header>

        {s.aiStatus && s.aiStatus.done < s.aiStatus.total && (
          <p className="text-xs text-amber-400/90 mb-5 font-mono">
            Indexing pages for search… {s.aiStatus.done}/{s.aiStatus.total} (first run downloads a model, cached after)
          </p>
        )}

        <form onSubmit={s.runSearch} className="mb-6 flex gap-2">
          <input
            value={s.query}
            onChange={(e) => s.setQuery(e.target.value)}
            placeholder="Semantic search across every captured page…"
            className="flex-1 rounded-lg bg-zinc-900 border border-zinc-800 px-3.5 py-2.5 text-sm outline-none focus:border-violet-500/60 placeholder:text-zinc-600 transition-colors"
          />
          <button
            type="submit"
            disabled={s.searching}
            className="text-sm px-4 py-2.5 rounded-lg bg-violet-500 text-white font-medium hover:bg-violet-400 disabled:opacity-50 transition-colors"
          >
            {s.searching ? "Searching…" : "Search"}
          </button>
          {s.results && (
            <button
              type="button"
              onClick={() => {
                s.setQuery("");
                s.setResults(null);
              }}
              className="text-sm px-3 py-2.5 rounded-lg border border-zinc-800 text-zinc-400 hover:bg-zinc-900 transition-colors"
            >
              Clear
            </button>
          )}
        </form>

        {s.results && (
          <div className="mb-10">
            <p className="text-xs uppercase tracking-wide text-zinc-500 mb-3">
              {s.results.length} result{s.results.length === 1 ? "" : "s"}
            </p>
            <ul className="flex flex-col gap-2">
              {s.results.map(({ page, score }) => (
                <li key={page.id} className="border border-zinc-800 rounded-xl p-3.5 bg-zinc-900/60">
                  <div className="flex items-center gap-2.5">
                    <Favicon url={page.url} size={16} />
                    <a
                      href={page.url}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-sm hover:underline truncate flex-1"
                    >
                      {page.title}
                    </a>
                    <span className="text-xs text-violet-400/80 shrink-0 font-mono tabular-nums">
                      {(score * 100).toFixed(0)}%
                    </span>
                    <CopyUrlButton url={page.url} />
                  </div>
                  {page.summary && <p className="text-sm text-zinc-400 mt-1.5 ml-[26px]">{page.summary}</p>}
                  <PageTags tags={page.tags} />
                </li>
              ))}
            </ul>
          </div>
        )}

        {s.sessions.length === 0 && (
          <p className="text-zinc-500 text-sm border border-dashed border-zinc-800 rounded-xl p-6 text-center">
            No sessions yet. Hit Collapse Tabs to capture your open tabs.
          </p>
        )}

        {s.sessions.length > 0 && (
          <div className="mb-5 flex gap-2">
            <input
              value={s.sessionQuery}
              onChange={(e) => s.setSessionQuery(e.target.value)}
              placeholder="Filter sessions by name, tab title, URL, or domain…"
              className="flex-1 rounded-lg bg-zinc-900 border border-zinc-800 px-3.5 py-2 text-sm outline-none focus:border-violet-500/60 placeholder:text-zinc-600 transition-colors"
            />
            {s.sessionQuery && (
              <button
                type="button"
                onClick={() => s.setSessionQuery("")}
                className="text-sm px-3 py-2 rounded-lg border border-zinc-800 text-zinc-400 hover:bg-zinc-900 transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        )}

        {s.sessionResults && (
          <div className="mb-8">
            <p className="text-xs uppercase tracking-wide text-zinc-500 mb-3">
              {s.sessionResults.length} session{s.sessionResults.length === 1 ? "" : "s"} match
            </p>
            {s.sessionResults.length === 0 ? (
              <p className="text-sm text-zinc-600 border border-dashed border-zinc-800 rounded-xl px-4 py-3">
                Nothing matches &ldquo;{s.sessionQuery}&rdquo;.
              </p>
            ) : (
              <ul className="flex flex-col gap-3">
                {s.sessionResults.map(({ session, pages }) => (
                  <li key={session.id} className="border border-zinc-800 rounded-xl p-3.5 bg-zinc-900/60">
                    <p className="text-sm font-medium">{session.name}</p>
                    {pages.length > 0 ? (
                      <ul className="mt-1.5 flex flex-col gap-1">
                        {pages.map((page) => (
                          <li key={page.id} className="flex items-center gap-2">
                            <Favicon url={page.url} size={14} />
                            <a
                              href={page.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-zinc-500 hover:text-zinc-300 hover:underline truncate"
                            >
                              {hostname(page.url)}
                            </a>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-zinc-600 mt-1">{session.tabCount} tabs</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {!s.sessionResults && (
          <div className="flex flex-col gap-8">
            {!workspaceFilter && s.grouped.orphaned.length > 0 && (
              <WorkspaceSection
                icon="❔"
                name="Unassigned"
                sessions={s.grouped.orphaned}
                workspaces={s.workspaces}
                expanded={s.expanded}
                pagesBySession={s.pagesBySession}
                onToggle={s.toggleSession}
                onRestore={s.restoreSession}
                onAssign={s.handleAssignWorkspace}
                onRenameSession={s.handleRenameSession}
                onDeleteSession={s.handleDeleteSession}
                onDeletePage={s.handleDeletePage}
                selectedPageIds={s.selectedPageIds}
                onToggleSelectPage={s.toggleSelectPage}
                onSelectAllPages={s.selectAllPages}
                onRestoreSelectedPages={s.restoreSelectedPages}
              />
            )}
            {byWorkspace.map(({ workspace, sessions: wsSessions }) => (
              <WorkspaceSection
                key={workspace.id}
                icon={workspace.icon}
                name={workspace.name}
                sessions={wsSessions}
                workspaces={s.workspaces}
                expanded={s.expanded}
                pagesBySession={s.pagesBySession}
                onToggle={s.toggleSession}
                onRestore={s.restoreSession}
                onAssign={s.handleAssignWorkspace}
                onRenameSession={s.handleRenameSession}
                onDeleteSession={s.handleDeleteSession}
                onDeletePage={s.handleDeletePage}
                selectedPageIds={s.selectedPageIds}
                onToggleSelectPage={s.toggleSelectPage}
                onSelectAllPages={s.selectAllPages}
                onRestoreSelectedPages={s.restoreSelectedPages}
                onRename={() => s.handleRenameWorkspace(workspace)}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
