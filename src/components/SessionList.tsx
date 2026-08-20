import { useState } from "react";
import { Favicon, CopyUrlButton, PageTags, ActionMenu } from "./ui";
import { hostname, formatWhen, formatShortDate } from "../lib/format";
import type { Workspace, Session, Page } from "../../shared/types";

type SortKey = "original" | "title" | "domain" | "captured";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "original", label: "Original order" },
  { value: "title", label: "Title" },
  { value: "domain", label: "Domain" },
  { value: "captured", label: "Recently captured" },
];

function sortPages(list: Page[], sortBy: SortKey): Page[] {
  if (sortBy === "original") return list;
  const copy = [...list];
  if (sortBy === "title") copy.sort((a, b) => a.title.localeCompare(b.title));
  else if (sortBy === "domain") copy.sort((a, b) => hostname(a.url).localeCompare(hostname(b.url)));
  else if (sortBy === "captured") copy.sort((a, b) => b.capturedAt - a.capturedAt);
  return copy;
}

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
  onSetPageGroup,
  onTogglePin,
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
  onSetPageGroup: (page: Page, group: string | undefined) => void;
  onTogglePin: (page: Page) => void;
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
              onSetPageGroup={onSetPageGroup}
              onTogglePin={onTogglePin}
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
  onSetPageGroup,
  onTogglePin,
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
  onSetPageGroup: (page: Page, group: string | undefined) => void;
  onTogglePin: (page: Page) => void;
  selectedPageIds: Set<number>;
  onToggleSelectPage: (pageId: number) => void;
  onSelectAllPages: (pageIds: number[]) => void;
  onRestoreSelectedPages: (sessionId: number) => void;
}) {
  const [sortBy, setSortBy] = useState<SortKey>("original");
  const pageList = pages ?? [];
  const groupNames: string[] = [];
  for (const page of pageList) {
    if (page.group && !groupNames.includes(page.group)) groupNames.push(page.group);
  }
  const applySort = (list: Page[]) => sortPages(list, sortBy);
  const pinnedFirst = (list: Page[]) => [...list].sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned));
  const ungrouped = pinnedFirst(applySort(pageList.filter((p) => !p.group)));
  return (
    <div className="border border-zinc-800 rounded-xl p-4 bg-zinc-900/40 hover:border-zinc-700 transition-colors">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-sm truncate">{session.name}</p>
          <p className="text-xs text-zinc-500 mt-0.5 font-mono tabular-nums">
            {session.tabCount} tabs
            {session.windowCount && session.windowCount > 1 ? ` · ${session.windowCount} windows` : ""} ·{" "}
            {formatWhen(session.createdAt)}
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
            <label className="flex items-center gap-1.5 text-xs text-zinc-500">
              Sort
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortKey)}
                className="rounded-md border border-zinc-800 bg-zinc-900 px-1.5 py-1 text-zinc-400 outline-none focus:border-violet-500/60 transition-colors"
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
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
          <div className="flex flex-col gap-4">
            {groupNames.map((groupName) => (
              <div key={groupName}>
                <p className="text-[11px] uppercase tracking-wide text-zinc-500 mb-1.5 flex items-center gap-1.5">
                  <span aria-hidden>▾</span> {groupName}
                </p>
                <ul className="flex flex-col gap-3 pl-1 border-l border-zinc-800 ml-1">
                  {pinnedFirst(applySort(pageList.filter((p) => p.group === groupName))).map((page) => (
                    <PageRow
                      key={page.id}
                      page={page}
                      groupNames={groupNames}
                      selected={selectedPageIds.has(page.id)}
                      onToggleSelect={onToggleSelectPage}
                      onDelete={onDeletePage}
                      onSetGroup={onSetPageGroup}
                      onTogglePin={onTogglePin}
                    />
                  ))}
                </ul>
              </div>
            ))}
            {ungrouped.length > 0 && (
              <div>
                {groupNames.length > 0 && (
                  <p className="text-[11px] uppercase tracking-wide text-zinc-600 mb-1.5">Ungrouped</p>
                )}
                <ul className="flex flex-col gap-3">
                  {ungrouped.map((page) => (
                    <PageRow
                      key={page.id}
                      page={page}
                      groupNames={groupNames}
                      selected={selectedPageIds.has(page.id)}
                      onToggleSelect={onToggleSelectPage}
                      onDelete={onDeletePage}
                      onSetGroup={onSetPageGroup}
                      onTogglePin={onTogglePin}
                    />
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function PageRow({
  page,
  groupNames,
  selected,
  onToggleSelect,
  onDelete,
  onSetGroup,
  onTogglePin,
}: {
  page: Page;
  groupNames: string[];
  selected: boolean;
  onToggleSelect: (pageId: number) => void;
  onDelete: (page: Page) => void;
  onSetGroup: (page: Page, group: string | undefined) => void;
  onTogglePin: (page: Page) => void;
}) {
  function handleGroupChange(value: string) {
    if (value === "__new__") {
      const name = window.prompt("New group name")?.trim();
      if (name) onSetGroup(page, name);
      return;
    }
    onSetGroup(page, value === "__none__" ? undefined : value);
  }

  return (
    <li className="flex gap-2.5 group">
      <input
        type="checkbox"
        checked={selected}
        onChange={() => onToggleSelect(page.id)}
        className="accent-violet-500 mt-1 shrink-0"
      />
      <Favicon url={page.url} size={16} />
      <div className="min-w-0 flex-1">
        <a href={page.url} target="_blank" rel="noreferrer" className="text-sm text-zinc-200 hover:underline truncate block">
          {page.title}
        </a>
        <p className="text-xs text-zinc-600 truncate">{hostname(page.url)}</p>
        {page.summary && <p className="text-xs text-zinc-500 mt-1">{page.summary}</p>}
        <PageTags tags={page.tags} />
      </div>
      <div
        className={`flex items-center gap-1 transition-opacity shrink-0 self-start ${
          page.pinned ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        }`}
      >
        <button
          onClick={() => onTogglePin(page)}
          aria-label={page.pinned ? "Unpin tab" : "Pin tab"}
          className={`text-xs leading-none ${page.pinned ? "text-amber-400" : "text-zinc-700 hover:text-amber-300"}`}
        >
          {page.pinned ? "★" : "☆"}
        </button>
        <select
          value={page.group ?? "__none__"}
          onChange={(e) => handleGroupChange(e.target.value)}
          aria-label="Assign to group"
          className="text-[11px] rounded-md border border-zinc-800 bg-zinc-900 px-1.5 py-1 text-zinc-500 outline-none focus:border-violet-500/60 transition-colors"
        >
          <option value="__none__">No group</option>
          {groupNames.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
          <option value="__new__">+ New group…</option>
        </select>
        <CopyUrlButton url={page.url} />
        <button onClick={() => onDelete(page)} aria-label="Remove tab from session" className="text-xs text-zinc-700 hover:text-rose-400">
          ✕
        </button>
      </div>
    </li>
  );
}
