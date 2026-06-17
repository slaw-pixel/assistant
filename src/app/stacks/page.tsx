"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import clsx from "clsx";
import { Download, Plus, X } from "lucide-react";
import { UNIVERSE } from "@/lib/universe";

interface LiveRow {
  ticker: string;
  "BidLstClsΔ%": number | null;
  "AskLstClsΔ%": number | null;
  isTrash: number | string | null;
  Report: number | string | null;
}

type Status = "connecting" | "connected" | "disconnected";

const WS_URL = process.env.NEXT_PUBLIC_BRIDGE_URL ?? "ws://localhost:8766";

const TABS = [
  { label: "Все стаки", href: "/stacks", active: true },
  { label: "Беты", href: "/" },
  { label: "Результат", href: "#", disabled: true },
];

// ticker → ETF lookup from universe
const TICKER_ETF: Record<string, string> = {};
for (const [etf, tickers] of Object.entries(UNIVERSE))
  for (const t of tickers) TICKER_ETF[t] = etf;

function pct(v: number | null) {
  if (v == null) return "—";
  return (v > 0 ? "+" : "") + v.toFixed(2) + "%";
}
function flag(v: number | string | null) {
  if (v == null || v === "" || v === 0 || v === "0" || v === "NO" || v === "False") return null;
  return <span className="text-yellow-500">●</span>;
}

export default function StacksPage() {
  const [tickers, setTickers] = useState<string[]>([]);
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [liveMap, setLiveMap] = useState<Map<string, LiveRow>>(new Map());
  const [status, setStatus] = useState<Status>("disconnected");
  const [ts, setTs] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [saving, setSaving] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const loadTickers = useCallback(() => {
    fetch("/api/stacks").then((r) => r.json()).then((d) => setTickers(d.tickers ?? []));
  }, []);

  useEffect(() => {
    loadTickers();
    fetch("/api/assignments").then((r) => r.json()).then(setAssignments).catch(() => {});
  }, [loadTickers]);

  const save = useCallback(async (next: string[]) => {
    setSaving(true);
    await fetch("/api/stacks", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tickers: next }),
    });
    setSaving(false);
    setTickers(next);
  }, []);

  const addTicker = () => {
    const t = input.trim().toUpperCase();
    if (!t || tickers.includes(t)) { setInput(""); return; }
    save([...tickers, t]);
    setInput("");
    inputRef.current?.focus();
  };

  const removeTicker = (t: string) => save(tickers.filter((x) => x !== t));

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    function connect() {
      setStatus("connecting");
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;
      ws.onopen = () => setStatus("connected");
      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data as string);
        if (msg.type === "snapshot") {
          setLiveMap(new Map((msg.data as LiveRow[]).map((r) => [r.ticker, r])));
          setTs(msg.ts ?? null);
        }
      };
      ws.onclose = () => { setStatus("disconnected"); timer = setTimeout(connect, 3000); };
      ws.onerror = () => ws.close();
    }
    connect();
    return () => { clearTimeout(timer); wsRef.current?.close(); };
  }, []);

  const dot = {
    connected: "bg-green-500",
    connecting: "bg-yellow-500 animate-pulse",
    disconnected: "bg-red-500",
  }[status];

  const etfFor = (ticker: string) => assignments[ticker] ?? TICKER_ETF[ticker] ?? "";

  return (
    <div className="flex flex-col h-screen bg-[#0d0d0d] text-slate-200">
      {/* Nav */}
      <header className="flex items-center gap-4 px-4 py-2 border-b border-[#2a2a2a] bg-[#111] shrink-0">
        <span className="text-slate-400 font-bold tracking-widest text-sm uppercase">Assistant</span>
        <nav className="flex gap-1">
          {TABS.map(({ label, href, active, disabled }) =>
            disabled ? (
              <span key={label} className="px-3 py-1 rounded text-xs font-medium text-slate-700 cursor-not-allowed">{label}</span>
            ) : (
              <Link key={label} href={href} className={clsx("px-3 py-1 rounded text-xs font-medium", active ? "bg-blue-600 text-white" : "text-slate-400 hover:text-slate-200")}>
                {label}
              </Link>
            )
          )}
        </nav>
        <div className="flex-1" />
        <div className="flex items-center gap-1">
          <input ref={inputRef} value={input}
            onChange={(e) => setInput(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && addTicker()}
            placeholder="TICKER"
            className="w-20 bg-[#1a1a1a] border border-[#333] rounded px-2 py-0.5 text-xs text-slate-200 placeholder:text-slate-600 uppercase focus:outline-none focus:border-blue-600" />
          <button onClick={addTicker}
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-blue-700 hover:bg-blue-600 text-xs font-medium transition-colors">
            <Plus size={11} /> Добавить
          </button>
        </div>
        <a href="/api/stacks/export" download="stacks.xlsx"
          className="flex items-center gap-1 px-2 py-0.5 rounded bg-[#1a1a1a] border border-[#333] hover:border-slate-500 text-xs text-slate-400 hover:text-slate-200 transition-colors">
          <Download size={11} /> Excel
        </a>
        <span className="text-xs text-slate-600">{saving ? "сохраняю..." : `${tickers.length}`}</span>
      </header>

      {/* Status */}
      <div className="flex items-center gap-2 px-4 py-0.5 border-b border-[#1a1a1a] text-[11px] text-slate-600 shrink-0">
        <span className={clsx("w-1.5 h-1.5 rounded-full shrink-0", dot)} />
        <span>
          {status === "connected" ? "Терминал подключён"
            : status === "connecting" ? "Подключение..."
            : "Терминал недоступен — python scripts/terminal_bridge.py"}
        </span>
        {ts && <span className="ml-auto tabular-nums">{ts}</span>}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse" style={{ fontSize: "11px" }}>
          <thead className="sticky top-0 bg-[#0d0d0d] z-10">
            <tr className="text-slate-600 uppercase tracking-wider text-[10px]">
              <th className="w-6 px-1 py-1"></th>
              <th className="text-left px-2 py-1">Тикер</th>
              <th className="text-right px-2 py-1">Bid%</th>
              <th className="text-right px-2 py-1">Ask%</th>
              <th className="text-center px-1 py-1">T</th>
              <th className="text-center px-1 py-1">R</th>
              <th className="text-left px-2 py-1 text-slate-700">Сектор</th>
            </tr>
          </thead>
          <tbody>
            {tickers.map((ticker) => {
              const r = liveMap.get(ticker);
              return (
                <tr key={ticker} className="border-t border-[#131313] hover:bg-[#141414] group">
                  <td className="px-1 py-px text-center">
                    <button onClick={() => removeTicker(ticker)}
                      className="opacity-0 group-hover:opacity-100 text-slate-700 hover:text-red-500 transition-all">
                      <X size={10} />
                    </button>
                  </td>
                  <td className="px-2 py-px font-mono font-bold text-slate-200">{ticker}</td>
                  <td className="px-2 py-px text-right tabular-nums text-slate-400">{pct(r?.["BidLstClsΔ%"] ?? null)}</td>
                  <td className="px-2 py-px text-right tabular-nums text-slate-400">{pct(r?.["AskLstClsΔ%"] ?? null)}</td>
                  <td className="px-1 py-px text-center">{flag(r?.isTrash ?? null)}</td>
                  <td className="px-1 py-px text-center">{flag(r?.Report ?? null)}</td>
                  <td className="px-2 py-px text-slate-600 font-mono">{etfFor(ticker)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {tickers.length === 0 && (
          <div className="flex items-center justify-center h-32 text-slate-600 text-sm">
            Добавь тикеры через форму выше
          </div>
        )}
      </div>
    </div>
  );
}
