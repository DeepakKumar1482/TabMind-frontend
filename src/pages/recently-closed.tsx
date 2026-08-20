import { useEffect, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { listAllPages } from "../../database/pages";
import { listSessions } from "../../database/sessions";
import { Favicon, CopyUrlButton } from "../components/ui";
import { hostname, timeAgo } from "../lib/format";
import type { Page, Session } from "../../shared/types";

const LIMIT = 50;

export default function RecentlyClosedPage() {
  const [pages, setPages] = useState<Page[]>([]);
  const [sessionsById, setSessionsById] = useState<Map<number, Session>>(new Map());

  async function load() {
    const [allPages, sessions] = await Promise.all([listAllPages(), listSessions()]);
    setPages(allPages.sort((a, b) => b.capturedAt - a.capturedAt).slice(0, LIMIT));
    setSessionsById(new Map(sessions.filter((s) => s.id).map((s) => [s.id, s])));
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, []);

  async function reopen(page: Page) {
    if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) return;
    await chrome.runtime.sendMessage({ type: "RESTORE_PAGES", urls: [page.url] });
  }

  return (
    <>
      <Head>
        <title>Recently Closed · TabMind</title>
      </Head>
      <div className="max-w-3xl mx-auto px-6 py-10">
        <header className="mb-6">
          <h1 className="text-xl font-semibold tracking-tight">Recently Closed</h1>
          <p className="text-sm text-zinc-500 mt-1">
            The last {pages.length} tab{pages.length === 1 ? "" : "s"} captured, most recent first
          </p>
        </header>

        {pages.length === 0 ? (
          <p className="text-zinc-500 text-sm border border-dashed border-zinc-800 rounded-xl p-6 text-center">
            Nothing captured yet.
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {pages.map((page) => {
              const session = sessionsById.get(page.sessionId);
              return (
                <li
                  key={page.id}
                  className="flex items-center gap-3 px-3.5 py-3 rounded-xl hover:bg-zinc-900/60 transition-colors group"
                >
                  <Favicon url={page.url} size={20} />
                  <div className="min-w-0 flex-1">
                    <a
                      href={page.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm text-zinc-200 hover:underline truncate block"
                    >
                      {page.title}
                    </a>
                    <p className="text-xs text-zinc-600 truncate">
                      {hostname(page.url)}
                      {session && (
                        <>
                          {" · "}
                          <Link href={`/sessions?q=${encodeURIComponent(session.name)}`} className="hover:text-zinc-400">
                            {session.name}
                          </Link>
                        </>
                      )}
                    </p>
                  </div>
                  <span className="text-xs text-zinc-600 shrink-0 font-mono">{timeAgo(page.capturedAt)}</span>
                  <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <CopyUrlButton url={page.url} />
                  </div>
                  <button
                    onClick={() => reopen(page)}
                    className="text-xs px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors shrink-0"
                  >
                    Reopen
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
