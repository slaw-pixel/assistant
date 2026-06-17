"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import Link from "next/link";
import BetaTable, { type BetaRow } from "@/components/beta-table";
import { UNIVERSE } from "@/lib/universe";
import { RefreshCw, AlertTriangle } from "lucide-react";
import clsx from "clsx";

const PERIODS = [
  { key: "3 months", label: "3M" },
  { key: "6 months", label: "6M" },
  { key: "12 months", label: "12M" },
  { key: "1 month (no sector filter)", label: "1M" },
  { key: "2 weeks (no sector filter)", label: "2W" },
] as const;
type Period = (typeof PERIODS)[number]["key"];

const ETF_OPTIONS = Object.keys(UNIVERSE).sort();
const CORR_WARN = 0.7;

// Default ticker→ETF from universe.ts
const DEFAULT_ASSIGN: Record<string, string> = {};
for (const [etf, tickers] of Object.entries(UNIVERSE))
  for (const t of tickers) DEFAULT_ASSIGN[t] = etf;

// ET hour (approximation: fixed -4 offset / summer EDT)
function etHour(): number {
  const et = new Date(Date.now() - 4 * 3600_000);
  return et.getUTCHours() + et.getUTCMinutes() / 60;
}

type Suggestion = { etf: string; corr: number } | "loading";

export default function Home() {
  const [rows, setRows] = useState<BetaRow[]>([]);
  const [period, setPeriod] = useState<Period>("3 months");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<Date | null>(null);
  const [search, setSearch] = useState("");
  const [assignSearch, setAssignSearch] = useState("");
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [suggests, setSuggests] = useState<Record<string, Suggestion>>({});

  // Load saved overrides
  useEffect(() => {
    fetch("/api/assignments")
      .then((r) => r.json())
      .then(setOverrides)
      .catch(() => {});
  }, []);

  const fetchBetas = useCallback(
    async (p: Period = period) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/betas?period=${encodeURIComponent(p)}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setRows(data.rows ?? []);
        const now = new Date();
        setFetchedAt(now);
        localStorage.setItem("betasFetchedAt", now.toISOString());
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    },
    [period]
  );

  // Auto-refresh at 17:30 ET if cache is from yesterday
  useEffect(() => {
    const stored = localStorage.getItem("betasFetchedAt");
    if (!stored) return;
    const last = new Date(stored);
    setFetchedAt(last);
    const lastDay = new Date(last.getTime() - 4 * 3600_000).getUTCDate();
    const todayDay = new Date(Date.now() - 4 * 3600_000).getUTCDate();
    if (etHour() >= 17.5 && lastDay !== todayDay) fetchBetas();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Effective assignments: overrides > universe defaults
  const effective = useMemo(
    () => ({ ...DEFAULT_ASSIGN, ...overrides }),
    [overrides]
  );

  // Left panel: group by ETF, filtered
  const assignGroups = useMemo(() => {
    const q = assignSearch.toUpperCase();
    const groups: Record<string, string[]> = {};
    for (const [ticker, etf] of Object.entries(effective)) {
      if (q && !ticker.includes(q) && !etf.includes(q)) continue;
      if (!groups[etf]) groups[etf] = [];
      groups[etf].push(ticker);
    }
    return Object.fromEntries(
      Object.entries(groups).sort(([a], [b]) => a.localeCompare(b))
    );
  }, [effective, assignSearch]);

  const setOverride = (ticker: string, etf: string) => {
    const next = { ...overrides, [ticker]: etf };
    setOverrides(next);
    fetch("/api/assignments", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    });
  };

  // Attention: low corr rows
  const attentionRows = useMemo(
    () =>
      rows
        .filter((r) => r.corr != null && Math.abs(r.corr) < CORR_WARN)
        .sort((a, b) => Math.abs(a.corr) - Math.abs(b.corr)),
    [rows]
  );

  const suggestETF = async (ticker: string) => {
    setSuggests((p) => ({ ...p, [ticker]: "loading" }));
    try {
      const res = await fetch(
        `/api/betas/suggest?ticker=${ticker}&period=${encodeURIComponent(period)}`
      );
      const data = await res.json();
      const best = data.suggestions?.[0];
      setSuggests((p) => ({
        ...p,
        [ticker]: best ? { etf: best.etf, corr: best.corr } : "loading",
      }));
    } catch {
      setSuggests((p) => { const n = { ...p }; delete n[ticker]; return n; });
    }
  };

  const switchPeriod = (p: Period) => { setPeriod(p); fetchBetas(p); };

  return (
    <div className="flex flex-col h-screen bg-[#0d0d0d] text-slate-200">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-2 border-b border-[#2a2a2a] bg-[#111] shrink-0">
        <span className="text-slate-400 font-bold tracking-widest text-sm uppercase">Assistant</span>
        <nav className="flex gap-1">
          <Link href="/stacks" className="px-3 py-1 rounded text-xs font-medium text-slate-400 hover:text-slate-200">Все стаки</Link>
          <span className="px-3 py-1 rounded text-xs font-medium bg-blue-600 text-white">Беты</span>
          <span className="px-3 py-1 rounded text-xs font-medium text-slate-700 cursor-not-allowed">Результат</span>
        </nav>
        <div className="flex-1" />
        <div className="flex gap-1">
          {PERIODS.map(({ key, label }) => (
            <button key={key} onClick={() => switchPeriod(key)}
              className={clsx("px-2 py-0.5 rounded text-xs font-mono",
                period === key ? "bg-slate-700 text-slate-100" : "text-slate-500 hover:text-slate-300")}>
              {label}
            </button>
          ))}
        </div>
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="поиск тикера..."
          className="w-28 bg-[#1a1a1a] border border-[#333] rounded px-2 py-0.5 text-xs text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-blue-600" />
        <button onClick={() => fetchBetas()} disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1 rounded bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-xs font-medium transition-colors">
          <RefreshCw size={11} className={loading ? "animate-spin" : ""} />
          {loading ? "Загрузка..." : "Обновить"}
        </button>
        <span className="text-xs text-slate-700">авт. 17:30 ET</span>
      </header>

      {/* Body: left assignments + right results */}
      <div className="flex flex-1 overflow-hidden">

        {/* LEFT — Assignments panel */}
        <aside className="w-52 flex flex-col border-r border-[#1a1a1a] shrink-0 overflow-hidden">
          <div className="px-2 py-1.5 border-b border-[#1a1a1a] shrink-0">
            <input value={assignSearch} onChange={(e) => setAssignSearch(e.target.value.toUpperCase())}
              placeholder="Фильтр тикера..."
              className="w-full bg-[#111] border border-[#2a2a2a] rounded px-2 py-0.5 text-xs text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-blue-600" />
          </div>
          <div className="flex-1 overflow-auto">
            {Object.entries(assignGroups).map(([etf, tickers]) => (
              <div key={etf}>
                <div className="px-2 py-0.5 text-[10px] text-slate-600 uppercase tracking-wider bg-[#080808] sticky top-0 z-10">
                  {etf} <span className="text-slate-700">({tickers.length})</span>
                </div>
                {tickers.sort().map((ticker) => (
                  <div key={ticker} className="flex items-center gap-1 px-2 py-px hover:bg-[#151515]">
                    <span className="text-xs text-slate-300 flex-1 font-mono">{ticker}</span>
                    <select
                      value={overrides[ticker] ?? etf}
                      onChange={(e) => setOverride(ticker, e.target.value)}
                      className="text-[10px] bg-[#111] border border-[#222] rounded px-0.5 text-slate-500 focus:outline-none focus:border-blue-600 cursor-pointer max-w-[52px]"
                    >
                      {ETF_OPTIONS.map((e) => <option key={e} value={e}>{e}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            ))}
            {Object.keys(assignGroups).length === 0 && (
              <div className="px-3 py-4 text-xs text-slate-700">Нет данных</div>
            )}
          </div>
        </aside>

        {/* RIGHT — Results + Attention */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Betas table */}
          <div className="flex-1 overflow-auto">
            {error && (
              <div className="m-3 p-2 rounded bg-red-900/30 border border-red-800 text-red-300 text-xs">{error}</div>
            )}
            {rows.length === 0 && !loading && !error && (
              <div className="flex items-center justify-center h-full text-slate-600 text-sm">
                Нажми «Обновить» чтобы загрузить беты из Datum
              </div>
            )}
            {rows.length > 0 && <BetaTable rows={rows} search={search} />}
          </div>

          {/* Attention list */}
          {attentionRows.length > 0 && (
            <div className="border-t border-[#2a2a2a] shrink-0 overflow-auto" style={{ maxHeight: "32%" }}>
              <div className="flex items-center gap-2 px-3 py-1 bg-[#0a0a0a] border-b border-[#1a1a1a] sticky top-0">
                <AlertTriangle size={11} className="text-yellow-500 shrink-0" />
                <span className="text-xs text-yellow-500 font-medium">
                  Внимание — corr &lt; 0.7 ({attentionRows.length} тикеров)
                </span>
              </div>
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="text-slate-600 uppercase tracking-wider text-[10px]">
                    <th className="text-left px-3 py-1">Тикер</th>
                    <th className="text-left px-2 py-1">ETF</th>
                    <th className="text-right px-2 py-1">Corr</th>
                    <th className="text-right px-2 py-1">Beta</th>
                    <th className="text-left px-3 py-1">Лучший ETF</th>
                  </tr>
                </thead>
                <tbody>
                  {attentionRows.map((r) => {
                    const sug = suggests[r.x_ticker];
                    return (
                      <tr key={r.x_ticker} className="border-t border-[#111] hover:bg-[#111]">
                        <td className="px-3 py-1 font-bold text-slate-200">{r.x_ticker}</td>
                        <td className="px-2 py-1 text-slate-500">{r.y_ticker}</td>
                        <td className="px-2 py-1 text-right tabular-nums text-red-400 font-semibold">{r.corr.toFixed(2)}</td>
                        <td className="px-2 py-1 text-right tabular-nums text-slate-400">{r.beta.toFixed(2)}</td>
                        <td className="px-3 py-1">
                          {!sug && (
                            <button onClick={() => suggestETF(r.x_ticker)}
                              className="text-[10px] text-blue-400 hover:text-blue-300 underline">
                              найти →
                            </button>
                          )}
                          {sug === "loading" && <span className="text-slate-600 text-[10px]">поиск...</span>}
                          {sug && sug !== "loading" && (
                            <span className="flex items-center gap-1.5">
                              <span className="text-green-400 font-bold">{sug.etf}</span>
                              <span className="text-slate-600">{sug.corr.toFixed(2)}</span>
                              <button onClick={() => setOverride(r.x_ticker, (sug as { etf: string }).etf)}
                                className="text-blue-400 hover:text-blue-300 underline">
                                применить
                              </button>
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="px-4 py-1 border-t border-[#1a1a1a] text-xs text-slate-700 flex gap-4 shrink-0">
        <span>{rows.length} тикеров</span>
        {fetchedAt && <span>обновлено {fetchedAt.toLocaleTimeString("ru-RU")}</span>}
        {attentionRows.length > 0 && (
          <span className="text-yellow-700">⚠ {attentionRows.length} с низкой корреляцией</span>
        )}
      </footer>
    </div>
  );
}
