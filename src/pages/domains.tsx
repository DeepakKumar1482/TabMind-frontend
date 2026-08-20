import { useEffect, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { listAllPages } from "../../database/pages";
import { listSessions } from "../../database/sessions";
import { Favicon, CopyUrlButton } from "../components/ui";
import { hostname, formatWhen } from "../lib/format";
import type { Page, Session } from "../../shared/types";

interface DomainGroup {
  domain: string;
  pages: Page[];
}

export default function DomainsPage() {
  const [groups, setGroups] = useState<DomainGroup[]>([]);
  const [sessionsById, setSessionsById] = useState<Map<number, Session>>(new Map());
  const [expanded, setExpanded] = useState<string | null>(null);

  async function load() {
    const [pages, sessions] = await Promise.all([listAllPages(), listSessions()]);
    const byDomain = new Map<string, Page[]>();
    for (const page of pages) {
      const domain = hostname(page.url);
      const list = byDomain.get(domain) ?? [];
      list.push(page);
      byDomain.set(domain, list);
    }
    const domainGroups = [...byDomain.entries()]
      .map(([domain, list]) => ({ domain, pages: list.sort((a, b) => b.capturedAt - a.capturedAt) }))
      .sort((a, b) => b.pages.length - a.pages.length);
    setGroups(domainGroups);
    setSessionsById(new Map(sessions.filter((s) => s.id).map((s) => [s.id, s])));
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, []);

  return (
    <>
      <Head>
        <title>Domains · TabMind</title>
      </Head>
      <div className="max-w-3xl mx-auto px-6 py-10">
        <header className="mb-6">
          <h1 className="text-xl font-semibold tracking-tight">Domains</h1>
          <p className="text-sm text-zinc-500 mt-1">
            {groups.length} domain{groups.length === 1 ? "" : "s"} across every session
          </p>
        </header>

        {groups.length === 0 ? (
          <p className="text-zinc-500 text-sm border border-dashed border-zinc-800 rounded-xl p-6 text-center">
            Nothing captured yet.
          </p>
        ) : (
          <ul className="border border-zinc-800 rounded-xl divide-y divide-zinc-800 overflow-hidden">
            {groups.map((group) => {
              const isOpen = expanded === group.domain;
              return (
                <li key={group.domain} className="bg-zinc-900/40">
                  <button
                    onClick={() => setExpanded(isOpen ? null : group.domain)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-zinc-900 transition-colors"
                  >
                    <Favicon url={group.pages[0].url} size={16} />
                    <span className="text-sm text-zinc-200 flex-1 truncate">{group.domain}</span>
                    <span className="text-xs text-zinc-500 font-mono tabular-nums shrink-0">
                      {group.pages.length} tab{group.pages.length === 1 ? "" : "s"}
                    </span>
                    <span className="text-zinc-600 text-xs shrink-0" aria-hidden>
                      {isOpen ? "▾" : "▸"}
                    </span>
                  </button>
                  {isOpen && (
                    <ul className="flex flex-col gap-2 px-4 pb-3.5 pl-[42px]">
                      {group.pages.map((page) => {
                        const session = sessionsById.get(page.sessionId);
                        return (
                          <li key={page.id} className="flex items-center gap-2.5 group">
                            <a
                              href={page.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-sm text-zinc-300 hover:underline truncate flex-1"
                            >
                              {page.title}
                            </a>
                            {session && (
                              <Link
                                href={`/sessions?q=${encodeURIComponent(session.name)}`}
                                className="text-xs text-zinc-600 hover:text-zinc-400 shrink-0"
                              >
                                {session.name}
                              </Link>
                            )}
                            <span className="text-xs text-zinc-600 shrink-0">{formatWhen(page.capturedAt)}</span>
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                              <CopyUrlButton url={page.url} />
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
