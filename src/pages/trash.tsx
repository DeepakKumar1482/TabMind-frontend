import { useEffect, useState } from "react";
import Head from "next/head";
import {
  listTrashedSessions,
  undeleteSession,
  purgeSession,
} from "../../database/sessions";
import { listTrashedPages, undeletePage, purgePage } from "../../database/pages";
import { formatWhen } from "../lib/format";
import type { Page, Session } from "../../shared/types";

const RETENTION_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export default function TrashPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [standalonePages, setStandalonePages] = useState<Page[]>([]);
  const [now] = useState(() => Date.now());

  async function load() {
    const [trashedSessions, trashedPages] = await Promise.all([listTrashedSessions(), listTrashedPages()]);
    const trashedSessionIds = new Set(trashedSessions.map((s) => s.id));
    setSessions(trashedSessions.sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0)));
    // Pages already covered by a trashed session are restored/purged as a
    // unit with it — only show pages trashed on their own here.
    setStandalonePages(
      trashedPages.filter((p) => !trashedSessionIds.has(p.sessionId)).sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0))
    );
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, []);

  async function handleRestoreSession(session: Session) {
    await undeleteSession(session.id);
    await load();
  }

  async function handlePurgeSession(session: Session) {
    const ok = window.confirm(`Permanently delete "${session.name}"? This can't be undone.`);
    if (!ok) return;
    await purgeSession(session.id);
    await load();
  }

  async function handleRestorePage(page: Page) {
    await undeletePage(page.id);
    await load();
  }

  async function handlePurgePage(page: Page) {
    const ok = window.confirm(`Permanently delete "${page.title}"? This can't be undone.`);
    if (!ok) return;
    await purgePage(page.id);
    await load();
  }

  function daysLeft(deletedAt?: number): number {
    if (!deletedAt) return RETENTION_DAYS;
    return Math.max(0, RETENTION_DAYS - Math.floor((now - deletedAt) / DAY_MS));
  }

  const isEmpty = sessions.length === 0 && standalonePages.length === 0;

  return (
    <>
      <Head>
        <title>Trash · TabMind</title>
      </Head>
      <div className="max-w-3xl mx-auto px-6 py-10">
        <header className="mb-6">
          <h1 className="text-xl font-semibold tracking-tight">Trash</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Deleted sessions and tabs stay here for {RETENTION_DAYS} days, then are removed automatically.
          </p>
        </header>

        {isEmpty ? (
          <p className="text-zinc-500 text-sm border border-dashed border-zinc-800 rounded-xl p-6 text-center">
            Trash is empty.
          </p>
        ) : (
          <div className="flex flex-col gap-8">
            {sessions.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-zinc-300 mb-3">Sessions</h2>
                <ul className="border border-zinc-800 rounded-xl divide-y divide-zinc-800 overflow-hidden">
                  {sessions.map((session) => (
                    <li key={session.id} className="flex items-center gap-3 px-4 py-3.5 bg-zinc-900/40">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{session.name}</p>
                        <p className="text-xs text-zinc-500 mt-0.5">
                          {session.tabCount} tabs · deleted {formatWhen(session.deletedAt ?? now)} ·{" "}
                          {daysLeft(session.deletedAt)} day{daysLeft(session.deletedAt) === 1 ? "" : "s"} left
                        </p>
                      </div>
                      <button
                        onClick={() => handleRestoreSession(session)}
                        className="text-xs px-3 py-1.5 rounded-lg bg-violet-500 text-white font-medium hover:bg-violet-400 transition-colors shrink-0"
                      >
                        Restore
                      </button>
                      <button
                        onClick={() => handlePurgeSession(session)}
                        className="text-xs px-3 py-1.5 rounded-lg text-rose-400 hover:bg-rose-500/10 transition-colors shrink-0"
                      >
                        Delete permanently
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {standalonePages.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-zinc-300 mb-3">Tabs</h2>
                <ul className="border border-zinc-800 rounded-xl divide-y divide-zinc-800 overflow-hidden">
                  {standalonePages.map((page) => (
                    <li key={page.id} className="flex items-center gap-3 px-4 py-3.5 bg-zinc-900/40">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{page.title}</p>
                        <p className="text-xs text-zinc-500 mt-0.5">
                          deleted {formatWhen(page.deletedAt ?? now)} · {daysLeft(page.deletedAt)} day
                          {daysLeft(page.deletedAt) === 1 ? "" : "s"} left
                        </p>
                      </div>
                      <button
                        onClick={() => handleRestorePage(page)}
                        className="text-xs px-3 py-1.5 rounded-lg bg-violet-500 text-white font-medium hover:bg-violet-400 transition-colors shrink-0"
                      >
                        Restore
                      </button>
                      <button
                        onClick={() => handlePurgePage(page)}
                        className="text-xs px-3 py-1.5 rounded-lg text-rose-400 hover:bg-rose-500/10 transition-colors shrink-0"
                      >
                        Delete permanently
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </div>
    </>
  );
}
