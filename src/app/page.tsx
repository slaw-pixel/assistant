"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
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

type SugItem = { etf: string; corr: number; beta: number };
type Suggestion = SugItem[] | "loading" | "dismissed";

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

  // On mount: restore betas + suggestions from cache
  useEffect(() => {
    try {
      const c = localStorage.getItem("betasCache");
      if (c) {
        const { rows: r, period: p, fetchedAt: fa } = JSON.parse(c);
        setRows(r ?? []);
        setPeriod(p ?? "3 months");
        setFetchedAt(new Date(fa));
      }
    } catch {}
    try {
      const s = localStorage.getItem("betasSuggests");
      if (s) setSuggests(JSON.parse(s));
    } catch {}

    // Auto-refresh if cache is stale
    const stored = localStorage.getItem("betasFetchedAt");
    if (stored) {
      const last = new Date(stored);
      const lastDay = new Date(last.getTime() - 4 * 3600_000).getUTCDate();
      const todayDay = new Date(Date.now() - 4 * 3600_000).getUTCDate();
      if (etHour() >= 17.5 && lastDay !== todayDay) fetchBetas();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchBetas = useCallback(
    async (p: Period = period) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/betas?period=${encodeURIComponent(p)}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const newRows = data.rows ?? [];
        setRows(newRows);
        const now = new Date();
        setFetchedAt(now);
        // Clear old suggestions when betas refresh
        setSuggests({});
        localStorage.removeItem("betasSuggests");
        localStorage.setItem("betasFetchedAt", now.toISOString());
        localStorage.setItem("betasCache", JSON.stringify({ rows: newRows, period: p, fetchedAt: now.toISOString() }));
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    },
    [period]
  );

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

  const dismissSuggest = (ticker: string) => {
    setSuggests((p) => {
      const next = { ...p, [ticker]: "dismissed" as const };
      try { localStorage.setItem("betasSuggests", JSON.stringify(next)); } catch {}
      return next;
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

  const suggestETF = useCallback(async (ticker: string) => {
    setSuggests((p) => ({ ...p, [ticker]: "loading" }));
    try {
      const res = await fetch(
        `/api/betas/suggest?ticker=${ticker}&period=${encodeURIComponent(period)}`
      );
      const data = await res.json();
      const top: SugItem[] = (data.suggestions ?? []).slice(0, 3).map(
        (s: SugItem) => ({ etf: s.etf, corr: s.corr, beta: s.beta })
      );
      const result: Suggestion = top;
      setSuggests((p) => {
        const next = { ...p, [ticker]: result };
        try { localStorage.setItem("betasSuggests", JSON.stringify(next)); } catch {}
        return next;
      });
    } catch {
      setSuggests((p) => { const n = { ...p }; delete n[ticker]; return n; });
    }
  }, [period]);

  // Auto-suggest all low-corr tickers sequentially (one at a time to not hammer Datum)
  const suggestRef = useRef(suggestETF);
  suggestRef.current = suggestETF;
  const attentionKey = attentionRows.map((r) => r.x_ticker).join(",");
  useEffect(() => {
    const pending = attentionRows.filter((r) => !suggests[r.x_ticker]);
    if (!pending.length) return;
    let cancelled = false;
    (async () => {
      for (const r of pending) {
        if (cancelled) break;
        await suggestRef.current(r.x_ticker);
      }
    })();
    return () => { cancelled = true; };
  }, [attentionKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [attentionExpanded, setAttentionExpanded] = useState(false);

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
              <div key={etf}
                onDragOver={(e) => { e.preventDefault(); setDragOver(etf); }}
                onDragLeave={() => setDragOver(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragging && dragging !== etf) setOverride(dragging, etf);
                  setDragging(null);
                  setDragOver(null);
                }}
              >
                <div className={clsx(
                  "px-2 py-0.5 text-[10px] uppercase tracking-wider sticky top-0 z-10 transition-colors",
                  dragOver === etf
                    ? "bg-blue-900/60 text-blue-300"
                    : "bg-[#080808] text-slate-600"
                )}>
                  {etf} <span className="opacity-50">({tickers.length})</span>
                </div>
                {tickers.sort().map((ticker) => (
                  <div key={ticker}
                    draggable
                    onDragStart={() => setDragging(ticker)}
                    onDragEnd={() => { setDragging(null); setDragOver(null); }}
                    className={clsx(
                      "flex items-center gap-1 px-2 py-px hover:bg-[#151515] cursor-grab active:cursor-grabbing select-none transition-opacity",
                      dragging === ticker && "opacity-30"
                    )}
                  >
                    <span className="text-slate-600 text-[10px] mr-0.5">⠿</span>
                    <span className="text-xs text-slate-300 flex-1 font-mono">{ticker}</span>
                    <select
                      value={overrides[ticker] ?? etf}
                      onChange={(e) => setOverride(ticker, e.target.value)}
                      onClick={(e) => e.stopPropagation()}
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

          {/* Betas table — hidden when attention is expanded */}
          <div className={clsx("overflow-auto", attentionExpanded ? "hidden" : "flex-1")}>
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
            <div className={clsx(
              "border-t border-[#2a2a2a] overflow-auto",
              attentionExpanded ? "flex-1" : "shrink-0"
            )} style={attentionExpanded ? undefined : { maxHeight: "32%" }}>
              {/* Sticky header */}
              <div className="flex items-center gap-2 px-3 py-1.5 bg-[#1a1a1a] border-b border-[#2a2a2a] sticky top-0 z-10">
                <AlertTriangle size={11} className="text-yellow-500 shrink-0" />
                <span className="text-xs text-yellow-500 font-medium">
                  Внимание — corr &lt; 0.7 ({attentionRows.length} тикеров)
                </span>
                <div className="flex-1" />
                <button
                  onClick={() => setAttentionExpanded((v) => !v)}
                  className="text-[11px] text-slate-500 hover:text-slate-300 px-2 py-0.5 rounded hover:bg-[#2a2a2a] transition-colors"
                >
                  {attentionExpanded ? "↓ свернуть" : "↑ развернуть"}
                </button>
              </div>
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="text-slate-500 uppercase tracking-wider text-[10px] bg-[#161616]">
                    <th className="text-left px-3 py-1">Тикер</th>
                    <th className="text-left px-2 py-1">ETF</th>
                    <th className="text-right px-2 py-1">Corr</th>
                    <th className="text-right px-2 py-1">Beta</th>
                    <th className="text-left px-3 py-1">Альтернативы</th>
                  </tr>
                </thead>
                <tbody>
                  {attentionRows.map((r) => {
                    const sug = suggests[r.x_ticker];
                    const items = Array.isArray(sug) ? sug : null;
                    return (
                      <tr key={r.x_ticker} className="border-t border-[#222] hover:bg-[#1e1e1e]">
                        <td className="px-3 py-1.5 font-bold text-slate-200">{r.x_ticker}</td>
                        <td className="px-2 py-1.5 text-slate-500">{r.y_ticker}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums text-red-400 font-semibold">{r.corr.toFixed(2)}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums text-slate-400">{r.beta.toFixed(2)}</td>
                        <td className="px-3 py-1.5">
                          {!sug && <span className="text-slate-600 text-[10px]">ожидание...</span>}
                          {sug === "loading" && <span className="text-slate-500 text-[10px]">поиск...</span>}
                          {sug === "dismissed" && <span className="text-slate-700 text-[10px]">оставлено</span>}
                          {items && items.length === 0 && <span className="text-slate-700 text-[10px]">нет альтернатив</span>}
                          {items && items.length > 0 && (
                            <span className="flex items-center gap-2 flex-wrap">
                              {items.map((s) => (
                                <button
                                  key={s.etf}
                                  onClick={() => { setOverride(r.x_ticker, s.etf); dismissSuggest(r.x_ticker); }}
                                  className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#252525] hover:bg-[#2e2e2e] border border-[#333] hover:border-green-700 transition-colors group"
                                  title={`применить ${s.etf}`}
                                >
                                  <span className="text-green-400 group-hover:text-green-300 font-bold text-[11px]">{s.etf}</span>
                                  <span className="text-slate-500 text-[10px]">{s.corr.toFixed(2)}</span>
                                </button>
                              ))}
                              <button
                                onClick={() => dismissSuggest(r.x_ticker)}
                                className="text-slate-600 hover:text-slate-300 text-[13px] leading-none px-1 py-0.5 rounded hover:bg-[#2a2a2a] transition-colors"
                                title="оставить текущий ETF"
                              >
                                ×
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
