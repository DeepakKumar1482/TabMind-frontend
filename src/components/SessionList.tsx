import { Favicon, CopyUrlButton, PageTags, ActionMenu } from "./ui";
import { hostname, formatWhen, formatShortDate } from "../lib/format";
import type { Workspace, Session, Page } from "../../shared/types";

export function WorkspaceSection({
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
  onDeleteSession,
  onDeletePage,
  selectedPageIds,
  onToggleSelectPage,
  onSelectAllPages,
  onRestoreSelectedPages,
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
  onDeleteSession: (session: Session) => void;
  onDeletePage: (page: Page) => void;
  selectedPageIds: Set<number>;
  onToggleSelectPage: (pageId: number) => void;
  onSelectAllPages: (pageIds: number[]) => void;
  onRestoreSelectedPages: (sessionId: number) => void;
  onRename?: () => void;
}) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-base" aria-hidden>
          {icon}
        </span>
        <h2 className="text-sm font-semibold text-zinc-300">{name}</h2>
        <span className="text-xs text-zinc-600 font-mono tabular-nums">{sessions.length}</span>
        {onRename && (
          <button onClick={onRename} className="text-xs text-zinc-600 hover:text-violet-300 ml-auto transition-colors">
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
              onDeleteSession={onDeleteSession}
              onDeletePage={onDeletePage}
              selectedPageIds={selectedPageIds}
              onToggleSelectPage={onToggleSelectPage}
              onSelectAllPages={onSelectAllPages}
              onRestoreSelectedPages={onRestoreSelectedPages}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export function SessionCard({
  session,
  workspaces,
  isExpanded,
  pages,
  onToggle,
  onRestore,
  onAssign,
  onRenameSession,
  onDeleteSession,
  onDeletePage,
  selectedPageIds,
  onToggleSelectPage,
  onSelectAllPages,
  onRestoreSelectedPages,
}: {
  session: Session;
  workspaces: Workspace[];
  isExpanded: boolean;
  pages: Page[] | undefined;
  onToggle: (id: number) => void;
  onRestore: (id: number) => void;
  onAssign: (sessionId: number, workspaceId: number) => void;
  onRenameSession: (session: Session) => void;
  onDeleteSession: (session: Session) => void;
  onDeletePage: (page: Page) => void;
  selectedPageIds: Set<number>;
  onToggleSelectPage: (pageId: number) => void;
  onSelectAllPages: (pageIds: number[]) => void;
  onRestoreSelectedPages: (sessionId: number) => void;
}) {
  return (
    <div className="border border-zinc-800 rounded-xl p-4 bg-zinc-900/40 hover:border-zinc-700 transition-colors">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-sm truncate">{session.name}</p>
          <p className="text-xs text-zinc-500 mt-0.5 font-mono tabular-nums">
            {session.tabCount} tabs · {formatWhen(session.createdAt)}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <select
            value={session.workspaceId ?? ""}
            onChange={(e) => session.id && onAssign(session.id, Number(e.target.value))}
            className="text-xs rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-zinc-400 outline-none focus:border-violet-500/60 transition-colors"
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
            className="text-xs px-3 py-1.5 rounded-lg bg-violet-500 text-white font-medium hover:bg-violet-400 transition-colors"
          >
            Restore
          </button>
          <ActionMenu
            items={[
              { label: "Rename", onClick: () => onRenameSession(session) },
              { label: "Delete", onClick: () => onDeleteSession(session), danger: true },
            ]}
          />
        </div>
      </div>

      {isExpanded && (
        <div className="mt-4 border-t border-zinc-800 pt-3.5">
          <dl className="flex flex-wrap gap-x-5 gap-y-1 mb-3.5 text-xs">
            <div className="flex items-baseline gap-1.5">
              <dt className="text-zinc-600">Tabs</dt>
              <dd className="font-mono tabular-nums text-zinc-300">{(pages ?? []).length}</dd>
            </div>
            <div className="flex items-baseline gap-1.5">
              <dt className="text-zinc-600">Domains</dt>
              <dd className="font-mono tabular-nums text-zinc-300">
                {new Set((pages ?? []).map((p) => hostname(p.url))).size}
              </dd>
            </div>
            <div className="flex items-baseline gap-1.5">
              <dt className="text-zinc-600">Created</dt>
              <dd className="text-zinc-300">{formatShortDate(session.createdAt)}</dd>
            </div>
            <div className="flex items-baseline gap-1.5">
              <dt className="text-zinc-600">Last opened</dt>
              <dd className="text-zinc-300">{session.lastOpenedAt ? formatShortDate(session.lastOpenedAt) : "Never"}</dd>
            </div>
          </dl>
          <div className="flex items-center gap-3 mb-2.5">
            <label className="flex items-center gap-1.5 text-xs text-zinc-500 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={(pages ?? []).length > 0 && selectedPageIds.size === (pages ?? []).length}
                onChange={() => onSelectAllPages((pages ?? []).map((p) => p.id))}
                className="accent-violet-500"
              />
              Select all
            </label>
            {selectedPageIds.size > 0 && (
              <button
                onClick={() => session.id && onRestoreSelectedPages(session.id)}
                className="text-xs px-2.5 py-1 rounded-lg bg-violet-500 text-white font-medium hover:bg-violet-400 transition-colors ml-auto"
              >
                Restore {selectedPageIds.size} selected
              </button>
            )}
          </div>
          <ul className="flex flex-col gap-3">
            {(pages ?? []).map((page) => (
              <li key={page.id} className="flex gap-2.5 group">
                <input
                  type="checkbox"
                  checked={selectedPageIds.has(page.id)}
                  onChange={() => onToggleSelectPage(page.id)}
                  className="accent-violet-500 mt-1 shrink-0"
                />
                <Favicon url={page.url} size={16} />
                <div className="min-w-0 flex-1">
                  <a
                    href={page.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-zinc-200 hover:underline truncate block"
                  >
                    {page.title}
                  </a>
                  <p className="text-xs text-zinc-600 truncate">{hostname(page.url)}</p>
                  {page.summary && <p className="text-xs text-zinc-500 mt-1">{page.summary}</p>}
                  <PageTags tags={page.tags} />
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 self-start">
                  <CopyUrlButton url={page.url} />
                  <button
                    onClick={() => onDeletePage(page)}
                    aria-label="Remove tab from session"
                    className="text-xs text-zinc-700 hover:text-rose-400"
                  >
                    ✕
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
