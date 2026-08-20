import { useEffect, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { listAllPages, deletePage } from "../../database/pages";
import { listSessions, updateSession } from "../../database/sessions";
import { Favicon } from "../components/ui";
import { hostname, formatWhen } from "../lib/format";
import type { Page, Session } from "../../shared/types";

interface DuplicateGroup {
  url: string;
  pages: Page[];
}

export default function DuplicatesPage() {
  const [groups, setGroups] = useState<DuplicateGroup[]>([]);
  const [sessionsById, setSessionsById] = useState<Map<number, Session>>(new Map());

  async function load() {
    const [pages, sessions] = await Promise.all([listAllPages(), listSessions()]);
    const byUrl = new Map<string, Page[]>();
    for (const page of pages) {
      const list = byUrl.get(page.url) ?? [];
      list.push(page);
      byUrl.set(page.url, list);
    }
    const dupeGroups = [...byUrl.entries()]
      .filter(([, list]) => list.length > 1)
      .map(([url, list]) => ({ url, pages: list.sort((a, b) => b.capturedAt - a.capturedAt) }));
    setGroups(dupeGroups);
    setSessionsById(new Map(sessions.filter((s) => s.id).map((s) => [s.id, s])));
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, []);

  async function removePage(page: Page) {
    await deletePage(page.id);
    const session = sessionsById.get(page.sessionId);
    if (session) await updateSession(page.sessionId, { tabCount: Math.max(0, session.tabCount - 1) });
    setGroups((prev) =>
      prev
        .map((g) => (g.url === page.url ? { ...g, pages: g.pages.filter((p) => p.id !== page.id) } : g))
        .filter((g) => g.pages.length > 1)
    );
  }

  async function keepNewest(group: DuplicateGroup) {
    const [, ...rest] = group.pages;
    const ok = window.confirm(`Delete ${rest.length} older duplicate${rest.length === 1 ? "" : "s"} of this tab?`);
    if (!ok) return;
    for (const page of rest) await removePage(page);
  }

  const totalDuplicates = groups.reduce((sum, g) => sum + g.pages.length - 1, 0);

  return (
    <>
      <Head>
        <title>Duplicates · TabMind</title>
      </Head>
      <div className="max-w-3xl mx-auto px-6 py-10">
        <header className="mb-6">
          <h1 className="text-xl font-semibold tracking-tight">Duplicate Tabs</h1>
          <p className="text-sm text-zinc-500 mt-1">
            {groups.length === 0
              ? "No duplicates found across your sessions."
              : `${totalDuplicates} duplicate tab${totalDuplicates === 1 ? "" : "s"} across ${groups.length} URL${groups.length === 1 ? "" : "s"}`}
          </p>
        </header>

        {groups.length === 0 ? (
          <p className="text-zinc-500 text-sm border border-dashed border-zinc-800 rounded-xl p-6 text-center">
            Nothing to clean up. The same URL captured more than once, across any session, shows up here.
          </p>
        ) : (
          <ul className="flex flex-col gap-4">
            {groups.map((group) => (
              <li key={group.url} className="border border-zinc-800 rounded-xl p-4 bg-zinc-900/40">
                <div className="flex items-center gap-2.5 mb-3">
                  <Favicon url={group.url} size={16} />
                  <a
                    href={group.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm font-medium hover:underline truncate flex-1"
                  >
                    {group.pages[0].title}
                  </a>
                  <span className="text-xs text-zinc-600 shrink-0">{hostname(group.url)}</span>
                  <button
                    onClick={() => keepNewest(group)}
                    className="text-xs px-2.5 py-1 rounded-lg bg-violet-500 text-white font-medium hover:bg-violet-400 transition-colors shrink-0"
                  >
                    Keep newest, delete rest
                  </button>
                </div>
                <ul className="flex flex-col gap-2 pl-[26px]">
                  {group.pages.map((page, i) => {
                    const session = sessionsById.get(page.sessionId);
                    return (
                      <li key={page.id} className="flex items-center gap-3 text-xs">
                        <span className={`px-1.5 py-0.5 rounded ${i === 0 ? "bg-emerald-500/15 text-emerald-300" : "bg-zinc-800 text-zinc-500"}`}>
                          {i === 0 ? "Newest" : "Older"}
                        </span>
                        <span className="text-zinc-500">
                          {session ? (
                            <Link href={`/sessions?q=${encodeURIComponent(session.name)}`} className="hover:text-zinc-300">
                              {session.name}
                            </Link>
                          ) : (
                            "Unknown session"
                          )}
                        </span>
                        <span className="text-zinc-600">{formatWhen(page.capturedAt)}</span>
                        <button
                          onClick={() => removePage(page)}
                          className="ml-auto text-zinc-700 hover:text-rose-400 transition-colors"
                        >
                          ✕ Remove
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
