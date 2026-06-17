"use client";

import { useState, useCallback } from "react";
import BetaTable, { type BetaRow } from "@/components/beta-table";
import { RefreshCw } from "lucide-react";
import clsx from "clsx";

const PERIODS = [
  { key: "3 months", label: "3M" },
  { key: "6 months", label: "6M" },
  { key: "12 months", label: "12M" },
  { key: "1 month (no sector filter)", label: "1M" },
  { key: "2 weeks (no sector filter)", label: "2W" },
] as const;

type Period = (typeof PERIODS)[number]["key"];

function timeAgo(date: Date | null): string {
  if (!date) return "";
  const s = Math.round((Date.now() - date.getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  return `${Math.round(s / 3600)}h ago`;
}

export default function Home() {
  const [rows, setRows] = useState<BetaRow[]>([]);
  const [period, setPeriod] = useState<Period>("3 months");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<Date | null>(null);
  const [search, setSearch] = useState("");

  const fetchBetas = useCallback(
    async (p: Period = period) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/betas?period=${encodeURIComponent(p)}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setRows(data.rows ?? []);
        setFetchedAt(new Date());
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    },
    [period]
  );

  const switchPeriod = (p: Period) => {
    setPeriod(p);
    fetchBetas(p);
  };

  return (
    <div className="flex flex-col h-screen bg-[#0d0d0d] text-slate-200">
      {/* Top bar */}
      <header className="flex items-center gap-4 px-4 py-2 border-b border-[#2a2a2a] bg-[#111] shrink-0">
        <span className="text-slate-400 font-bold tracking-widest text-sm uppercase">
          Assistant
        </span>

        {/* Nav tabs — future phases */}
        <nav className="flex gap-1">
          {["Betas", "Свелось?", "Live"].map((tab, i) => (
            <button
              key={tab}
              disabled={i > 0}
              className={clsx(
                "px-3 py-1 rounded text-xs font-medium",
                i === 0
                  ? "bg-blue-600 text-white"
                  : "text-slate-600 cursor-not-allowed"
              )}
            >
              {tab}
            </button>
          ))}
        </nav>

        <div className="flex-1" />

        {/* Period selector */}
        <div className="flex gap-1">
          {PERIODS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => switchPeriod(key)}
              className={clsx(
                "px-2 py-0.5 rounded text-xs font-mono",
                period === key
                  ? "bg-slate-700 text-slate-100"
                  : "text-slate-500 hover:text-slate-300"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Search */}
        <input
          type="text"
          placeholder="поиск тикера..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-[#1a1a1a] border border-[#333] rounded px-2 py-0.5 text-xs text-slate-300 placeholder:text-slate-600 w-36 focus:outline-none focus:border-blue-600"
        />

        {/* Refresh */}
        <button
          onClick={() => fetchBetas()}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1 rounded bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-xs font-medium transition-colors"
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          {loading ? "Загрузка..." : "Обновить"}
        </button>

        {fetchedAt && (
          <span className="text-xs text-slate-600">{timeAgo(fetchedAt)}</span>
        )}
      </header>

      {/* Content */}
      <main className="flex-1 overflow-hidden">
        {error && (
          <div className="m-4 p-3 rounded bg-red-900/30 border border-red-800 text-red-300 text-sm">
            {error}
          </div>
        )}

        {rows.length === 0 && !loading && !error && (
          <div className="flex items-center justify-center h-full text-slate-600 text-sm">
            Нажми «Обновить» чтобы загрузить беты из Datum
          </div>
        )}

        {rows.length > 0 && (
          <div className="h-full overflow-auto">
            <BetaTable rows={rows} search={search} />
          </div>
        )}
      </main>

      {/* Status bar */}
      <footer className="px-4 py-1 border-t border-[#1a1a1a] text-xs text-slate-700 flex gap-4 shrink-0">
        <span>{rows.length} тикеров</span>
        {fetchedAt && (
          <span>обновлено {fetchedAt.toLocaleTimeString("ru-RU")}</span>
        )}
      </footer>
    </div>
  );
}
