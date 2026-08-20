import { useEffect, useMemo, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { useSessions } from "../hooks/useSessions";
import { Favicon, CopyUrlButton, ActionMenu } from "../components/ui";
import { formatBytes, formatWhen, hostname, timeAgo } from "../lib/format";
import { listAllPages } from "../../database/pages";
import type { Page } from "../../shared/types";

const DAY_MS = 24 * 60 * 60 * 1000;

export default function Dashboard() {
  const s = useSessions();
  const [allPages, setAllPages] = useState<Page[]>([]);
  const [storage, setStorage] = useState<{ usage: number; quota: number } | null>(null);
  const [now] = useState(() => Date.now());

  useEffect(() => {
    void listAllPages().then(setAllPages);
  }, [s.sessions, s.pagesBySession]);

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.storage?.estimate) return;
    void navigator.storage.estimate().then((est) => {
      if (est.usage !== undefined && est.quota !== undefined) setStorage({ usage: est.usage, quota: est.quota });
    });
  }, []);

  const stats = useMemo(() => {
    const thisWeek = now - 7 * DAY_MS;
    const lastWeek = now - 14 * DAY_MS;

    function weekDelta(timestamps: number[]) {
      const current = timestamps.filter((t) => t >= thisWeek).length;
      const previous = timestamps.filter((t) => t >= lastWeek && t < thisWeek).length;
      if (previous === 0) return current > 0 ? null : 0;
      return Math.round(((current - previous) / previous) * 100);
    }

    const sessionTimestamps = s.sessions.map((sess) => sess.createdAt);
    const totalTabs = s.sessions.reduce((sum, sess) => sum + sess.tabCount, 0);
    const tabsThisWeek = s.sessions.filter((sess) => sess.createdAt >= thisWeek).reduce((sum, sess) => sum + sess.tabCount, 0);
    const tabsLastWeek = s.sessions
      .filter((sess) => sess.createdAt >= lastWeek && sess.createdAt < thisWeek)
      .reduce((sum, sess) => sum + sess.tabCount, 0);
    const tabsDelta = tabsLastWeek === 0 ? (tabsThisWeek > 0 ? null : 0) : Math.round(((tabsThisWeek - tabsLastWeek) / tabsLastWeek) * 100);

    return {
      totalSessions: s.sessions.length,
      sessionsDelta: weekDelta(sessionTimestamps),
      totalTabs,
      tabsDelta,
    };
  }, [s.sessions, now]);

  const activity = useMemo(() => {
    const days: { label: string; value: number }[] = [];
    const nowDate = new Date(now);
    for (let i = 6; i >= 0; i--) {
      const day = new Date(nowDate);
      day.setDate(nowDate.getDate() - i);
      const start = new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime();
      const end = start + DAY_MS;
      const count = allPages.filter((p) => p.capturedAt >= start && p.capturedAt < end).length;
      days.push({ label: day.toLocaleDateString(undefined, { weekday: "short" }), value: count });
    }
    return days;
  }, [allPages, now]);

  const recentSessions = [...s.sessions].sort((a, b) => b.createdAt - a.createdAt).slice(0, 5);
  const recentlyClosed = [...allPages].sort((a, b) => b.capturedAt - a.capturedAt).slice(0, 5);

  function workspaceIcon(workspaceId?: number) {
    return s.workspaces.find((w) => w.id === workspaceId)?.icon ?? "📁";
  }

  return (
    <>
      <Head>
        <title>TabMind</title>
      </Head>
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard label="Total Sessions" value={stats.totalSessions} delta={stats.sessionsDelta} icon="📁" tint="violet" />
          <StatCard label="Total Tabs" value={stats.totalTabs} delta={stats.tabsDelta} icon="🗂" tint="blue" />
          <StatCard label="Groups" value={s.workspaces.length} icon="🗃" tint="emerald" caption="workspaces in use" />
          <StatCard
            label="Storage Used"
            value={storage ? formatBytes(storage.usage) : "—"}
            icon="💾"
            tint="amber"
            caption={storage ? `of ${formatBytes(storage.quota)} available` : undefined}
            raw
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 flex flex-col gap-8">
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-zinc-300">Recent Sessions</h2>
                <Link href="/sessions" className="text-xs text-violet-400 hover:text-violet-300 transition-colors">
                  View all
                </Link>
              </div>
              {recentSessions.length === 0 ? (
                <p className="text-sm text-zinc-600 border border-dashed border-zinc-800 rounded-xl p-6 text-center">
                  No sessions yet. Hit Collapse Tabs to capture your open tabs.
                </p>
              ) : (
                <ul className="border border-zinc-800 rounded-xl divide-y divide-zinc-800 overflow-hidden">
                  {recentSessions.map((session) => (
                    <li key={session.id} className="flex items-center gap-3 px-4 py-3.5 bg-zinc-900/40">
                      <span className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center text-sm shrink-0" aria-hidden>
                        {workspaceIcon(session.workspaceId)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{session.name}</p>
                        <p className="text-xs text-zinc-500 mt-0.5">{formatWhen(session.createdAt)}</p>
                      </div>
                      <span className="text-xs text-zinc-500 font-mono tabular-nums shrink-0">{session.tabCount} tabs</span>
                      <button
                        onClick={() => session.id && s.restoreSession(session.id)}
                        className="text-xs px-3 py-1.5 rounded-lg bg-violet-500 text-white font-medium hover:bg-violet-400 transition-colors shrink-0"
                      >
                        Restore
                      </button>
                      <ActionMenu
                        items={[
                          { label: "Rename", onClick: () => s.handleRenameSession(session) },
                          { label: "Delete", onClick: () => s.handleDeleteSession(session), danger: true },
                        ]}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-zinc-300">Recently Closed Tabs</h2>
                <Link href="/recently-closed" className="text-xs text-violet-400 hover:text-violet-300 transition-colors">
                  View all
                </Link>
              </div>
              {recentlyClosed.length === 0 ? (
                <p className="text-sm text-zinc-600 border border-dashed border-zinc-800 rounded-xl p-6 text-center">
                  Nothing captured yet.
                </p>
              ) : (
                <ul className="border border-zinc-800 rounded-xl divide-y divide-zinc-800 overflow-hidden">
                  {recentlyClosed.map((page) => (
                    <li key={page.id} className="flex items-center gap-3 px-4 py-3 bg-zinc-900/40 group">
                      <Favicon url={page.url} size={18} />
                      <div className="min-w-0 flex-1">
                        <a href={page.url} target="_blank" rel="noreferrer" className="text-sm text-zinc-200 hover:underline truncate block">
                          {page.title}
                        </a>
                        <p className="text-xs text-zinc-600 truncate">{hostname(page.url)}</p>
                      </div>
                      <span className="text-xs text-zinc-600 shrink-0 font-mono">Closed {timeAgo(page.capturedAt)}</span>
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <CopyUrlButton url={page.url} />
                      </div>
                      <button
                        onClick={() => s.reopenPage(page)}
                        className="text-xs px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors shrink-0"
                      >
                        Reopen
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <aside>
            <div className="border border-zinc-800 rounded-xl p-5 bg-zinc-900/40">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-zinc-300">Activity Overview</h2>
                <span className="text-xs text-zinc-600">Last 7 days</span>
              </div>
              <ActivityChart data={activity} />
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}

function StatCard({
  label,
  value,
  delta,
  icon,
  tint,
  caption,
  raw,
}: {
  label: string;
  value: number | string;
  delta?: number | null;
  icon: string;
  tint: "violet" | "blue" | "emerald" | "amber";
  caption?: string;
  raw?: boolean;
}) {
  const tintClasses: Record<typeof tint, string> = {
    violet: "bg-violet-500/15 text-violet-300",
    blue: "bg-blue-500/15 text-blue-300",
    emerald: "bg-emerald-500/15 text-emerald-300",
    amber: "bg-amber-500/15 text-amber-300",
  };

  return (
    <div className="border border-zinc-800 rounded-xl p-4 bg-zinc-900/40 flex items-start gap-3">
      <span className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg shrink-0 ${tintClasses[tint]}`} aria-hidden>
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-xs text-zinc-500">{label}</p>
        <p className="text-xl font-semibold tabular-nums mt-0.5 truncate">{value}</p>
        {!raw && delta !== undefined && delta !== null && (
          <p className={`text-xs mt-0.5 ${delta >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
            {delta >= 0 ? "↑" : "↓"} {Math.abs(delta)}% this week
          </p>
        )}
        {caption && <p className="text-xs text-zinc-600 mt-0.5">{caption}</p>}
      </div>
    </div>
  );
}

function ActivityChart({ data }: { data: { label: string; value: number }[] }) {
  const width = 260;
  const height = 120;
  const padding = 8;
  const max = Math.max(1, ...data.map((d) => d.value));

  const points = data.map((d, i) => {
    const x = padding + (i / (data.length - 1)) * (width - padding * 2);
    const y = height - padding - (d.value / max) * (height - padding * 2);
    return { x, y, ...d };
  });

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const areaPath = `${linePath} L${points[points.length - 1].x},${height - padding} L${points[0].x},${height - padding} Z`;

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" role="img" aria-label="Tabs captured per day, last 7 days">
        <defs>
          <linearGradient id="activityFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgb(167 139 250)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="rgb(167 139 250)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((f) => (
          <line
            key={f}
            x1={padding}
            x2={width - padding}
            y1={padding + f * (height - padding * 2)}
            y2={padding + f * (height - padding * 2)}
            stroke="rgb(39 39 42)"
            strokeWidth="1"
          />
        ))}
        <path d={areaPath} fill="url(#activityFill)" />
        <path d={linePath} fill="none" stroke="rgb(167 139 250)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p) => (
          <circle key={p.label} cx={p.x} cy={p.y} r="2.5" fill="rgb(167 139 250)" />
        ))}
      </svg>
      <div className="flex justify-between mt-1.5">
        {data.map((d) => (
          <span key={d.label} className="text-[10px] text-zinc-600 font-mono">
            {d.label}
          </span>
        ))}
      </div>
    </div>
  );
}
