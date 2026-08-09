"use client";

import { useEffect, useState } from "react";
import { listWorkspaces } from "../../database/workspaces";
import { listSessions } from "../../database/sessions";
import { listPagesBySession } from "../../database/pages";
import type { Workspace, Session, Page } from "../../shared/types";

export default function Dashboard() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [pagesBySession, setPagesBySession] = useState<Record<number, Page[]>>({});
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    void loadAll();
  }, []);

  async function loadAll() {
    const [w, s] = await Promise.all([listWorkspaces(), listSessions()]);
    setWorkspaces(w);
    setSessions(s);
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

  function workspaceName(id?: number) {
    return workspaces.find((w) => w.id === id)?.name ?? "Unsorted";
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-8">
      <h1 className="text-2xl font-semibold mb-1">🧠 TabMind</h1>
      <p className="text-slate-400 mb-8">
        {sessions.length} sessions · {workspaces.length} workspaces
      </p>

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
              <ul className="mt-4 flex flex-col gap-1.5 border-t border-slate-800 pt-3">
                {(pagesBySession[session.id] ?? []).map((page) => (
                  <li key={page.id} className="text-sm text-slate-300 truncate">
                    <a href={page.url} target="_blank" rel="noreferrer" className="hover:underline">
                      {page.title}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </main>
  );
}
