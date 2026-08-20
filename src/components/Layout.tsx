import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { listWorkspaces } from "../../database/workspaces";
import { listSessions, purgeExpiredSessions } from "../../database/sessions";
import { purgeExpiredPages } from "../../database/pages";
import { formatBytes } from "../lib/format";
import type { Workspace, Session } from "../../shared/types";

const NAV = [
  { href: "/", label: "Dashboard", icon: "▦" },
  { href: "/sessions", label: "Sessions", icon: "▤" },
  { href: "/recently-closed", label: "Recently Closed", icon: "↺" },
  { href: "/duplicates", label: "Duplicates", icon: "⧉" },
  { href: "/domains", label: "Domains", icon: "◈" },
  { href: "/trash", label: "Trash", icon: "🗑" },
];

const TRASH_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

export default function Layout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [storage, setStorage] = useState<{ usage: number; quota: number } | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [searchValue, setSearchValue] = useState("");

  async function refreshCounts() {
    const [w, s] = await Promise.all([listWorkspaces(), listSessions()]);
    setWorkspaces(w);
    setSessions(s);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshCounts();
    const onRouteChange = () => void refreshCounts();
    router.events.on("routeChangeComplete", onRouteChange);
    return () => router.events.off("routeChangeComplete", onRouteChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.storage?.estimate) return;
    void navigator.storage.estimate().then((est) => {
      if (est.usage !== undefined && est.quota !== undefined) setStorage({ usage: est.usage, quota: est.quota });
    });
  }, []);

  useEffect(() => {
    const cutoff = Date.now() - TRASH_RETENTION_MS;
    void Promise.all([purgeExpiredSessions(cutoff), purgeExpiredPages(cutoff)]);
  }, []);

  useEffect(() => {
    function onKeydown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKeydown);
    return () => window.removeEventListener("keydown", onKeydown);
  }, []);

  async function handleCollapseTabs() {
    if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) return;
    await chrome.runtime.sendMessage({ type: "PANIC_CAPTURE" });
  }

  async function handleSaveSession() {
    if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) return;
    await chrome.runtime.sendMessage({ type: "SAVE_SESSION" });
    await refreshCounts();
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!searchValue.trim()) return;
    void router.push(`/sessions?q=${encodeURIComponent(searchValue.trim())}`);
  }

  const storagePct = storage ? Math.min(100, (storage.usage / storage.quota) * 100) : 0;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex">
      <aside
        className={`${
          collapsed ? "w-[68px]" : "w-64"
        } shrink-0 border-r border-zinc-800 bg-zinc-950 flex flex-col transition-[width] duration-150`}
      >
        <div className="flex items-center gap-2 px-4 h-16 border-b border-zinc-800">
          <span className="w-7 h-7 rounded-lg bg-violet-500 text-white flex items-center justify-center text-sm font-bold shrink-0">
            T
          </span>
          {!collapsed && <span className="font-semibold tracking-tight">TabMind</span>}
          <button
            onClick={() => setCollapsed((v) => !v)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="ml-auto text-zinc-600 hover:text-zinc-300 transition-colors"
          >
            {collapsed ? "»" : "«"}
          </button>
        </div>

        <div className="px-3 pt-4 flex flex-col gap-2">
          <button
            onClick={handleCollapseTabs}
            className="w-full text-sm px-3 py-2.5 rounded-lg bg-violet-500 text-white font-medium hover:bg-violet-400 transition-colors flex items-center justify-center gap-1.5"
          >
            <span aria-hidden>+</span>
            {!collapsed && "Collapse Tabs"}
          </button>
          <button
            onClick={handleSaveSession}
            title="Capture the current tabs as a session without closing them"
            className="w-full text-sm px-3 py-2.5 rounded-lg border border-zinc-800 text-zinc-300 hover:bg-zinc-900 transition-colors flex items-center justify-center gap-1.5"
          >
            <span aria-hidden>⤓</span>
            {!collapsed && "Save Current Session"}
          </button>
        </div>

        <nav className="px-3 pt-4 flex flex-col gap-0.5">
          {NAV.map((item) => {
            const active = router.pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 text-sm px-3 py-2 rounded-lg transition-colors ${
                  active ? "bg-violet-500/15 text-violet-300" : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
                }`}
              >
                <span className="w-4 text-center shrink-0" aria-hidden>
                  {item.icon}
                </span>
                {!collapsed && item.label}
              </Link>
            );
          })}
        </nav>

        {!collapsed && workspaces.length > 0 && (
          <div className="px-3 pt-5">
            <p className="text-[11px] uppercase tracking-wide text-zinc-600 px-3 mb-1.5">Groups</p>
            <div className="flex flex-col gap-0.5">
              {workspaces.map((w) => {
                const count = sessions.filter((s) => s.workspaceId === w.id).length;
                return (
                  <Link
                    key={w.id}
                    href={`/sessions?workspace=${w.id}`}
                    className="flex items-center gap-2.5 text-sm px-3 py-1.5 rounded-lg text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200 transition-colors"
                  >
                    <span aria-hidden>{w.icon}</span>
                    <span className="truncate flex-1">{w.name}</span>
                    <span className="text-xs text-zinc-600 font-mono tabular-nums">{count}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        <div className="mt-auto px-3 pb-4">
          {storage && !collapsed && (
            <div className="px-3 py-3">
              <p className="text-[11px] text-zinc-600 mb-1.5">
                Storage · {formatBytes(storage.usage)} of {formatBytes(storage.quota)} used
              </p>
              <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                <div className="h-full bg-violet-500 rounded-full" style={{ width: `${storagePct}%` }} />
              </div>
            </div>
          )}
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-16 border-b border-zinc-800 flex items-center gap-4 px-6 shrink-0">
          <form onSubmit={handleSearchSubmit} className="flex-1 max-w-xl">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600 text-sm" aria-hidden>
                ⌕
              </span>
              <input
                ref={searchRef}
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                placeholder="Search sessions, tabs, or URLs…"
                className="w-full rounded-lg bg-zinc-900 border border-zinc-800 pl-9 pr-14 py-2 text-sm outline-none focus:border-violet-500/60 placeholder:text-zinc-600 transition-colors"
              />
              <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-zinc-600 border border-zinc-800 rounded px-1.5 py-0.5 font-mono">
                ⌘K
              </kbd>
            </div>
          </form>
        </header>
        <main className="flex-1 min-w-0 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
