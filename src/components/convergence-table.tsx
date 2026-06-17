"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import clsx from "clsx";
import { UNIVERSE, SECTOR_LABEL } from "@/lib/universe";

// Build default ticker→ETF from universe
const DEFAULT_ASSIGN: Record<string, string> = {};
for (const [etf, tickers] of Object.entries(UNIVERSE))
  for (const t of tickers) DEFAULT_ASSIGN[t] = etf;

interface LiveRow {
  ticker: string;
  "BidLstClsΔ%": number | null;
  "AskLstClsΔ%": number | null;
  isTrash: number | string | null;
}

interface BetaRow {
  x_ticker: string;
  y_ticker: string;
  beta: number;
  corr: number;
}

interface ConvRow {
  ticker: string;
  etf: string;
  beta: number;
  corr: number;
  stockBid: number;
  stockAsk: number;
  etfBid: number;
  etfAsk: number;
  expBid: number;
  expAsk: number;
  signal: number;
}

type Status = "connecting" | "connected" | "disconnected";
const WS_URL = process.env.NEXT_PUBLIC_BRIDGE_URL ?? "ws://localhost:8766";
const MIN_SIGNAL = 0.15;

function pct(v: number) {
  return (v > 0 ? "+" : "") + v.toFixed(2) + "%";
}

function signalColor(s: number) {
  if (s > 1.5) return "text-green-300 font-bold";
  if (s > 0.5) return "text-green-400";
  if (s < -1.5) return "text-red-300 font-bold";
  if (s < -0.5) return "text-red-400";
  return "text-slate-400";
}

function isTrashFlag(v: number | string | null) {
  return v != null && v !== 0 && v !== "0" && v !== "NO" && v !== "False" && v !== "";
}

export default function ConvergenceTable() {
  const [liveMap, setLiveMap] = useState<Map<string, LiveRow>>(new Map());
  const [betas, setBetas] = useState<BetaRow[]>([]);
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<Status>("disconnected");
  const [ts, setTs] = useState<string | null>(null);
  const [betaLoading, setBetaLoading] = useState(true);
  const [betaError, setBetaError] = useState<string | null>(null);
  const [minSignal, setMinSignal] = useState(MIN_SIGNAL);
  const [groupOrder, setGroupOrder] = useState<Record<string, string[]>>({});
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    fetch("/api/betas?period=3%20months")
      .then((r) => r.json())
      .then((d) => { setBetas(d.rows ?? []); setBetaLoading(false); })
      .catch((e) => { setBetaError(String(e)); setBetaLoading(false); });
    fetch("/api/assignments").then((r) => r.json()).then(setAssignments).catch(() => {});
  }, []);

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

  const effective = useMemo(() => ({ ...DEFAULT_ASSIGN, ...assignments }), [assignments]);

  // Build beta lookup: ticker → beta row for the assigned ETF only
  const betaMap = useMemo(() => {
    const m = new Map<string, BetaRow>();
    for (const b of betas) {
      if (b.y_ticker === effective[b.x_ticker]) m.set(b.x_ticker, b);
    }
    return m;
  }, [betas, effective]);

  const rows = useMemo((): ConvRow[] => {
    if (!betaMap.size || !liveMap.size) return [];
    const result: ConvRow[] = [];

    for (const [ticker, b] of betaMap) {
      if (!b.beta) continue;
      const live = liveMap.get(ticker);
      const etfLive = liveMap.get(b.y_ticker);
      if (!live || !etfLive) continue;
      if (isTrashFlag(live.isTrash)) continue;

      const stockBid = live["BidLstClsΔ%"];
      const stockAsk = live["AskLstClsΔ%"];
      const etfBid = etfLive["BidLstClsΔ%"];
      const etfAsk = etfLive["AskLstClsΔ%"];
      if (stockBid == null || stockAsk == null || etfBid == null || etfAsk == null) continue;

      const expBid = etfBid * b.beta;
      const expAsk = etfAsk * b.beta;
      const divLong = expBid - stockAsk;
      const divShort = stockBid - expAsk;
      let signal = 0;
      if (divLong > 0) signal = divLong;
      else if (divShort > 0) signal = -divShort;
      if (Math.abs(signal) < minSignal) continue;

      result.push({ ticker, etf: b.y_ticker, beta: b.beta, corr: b.corr, stockBid, stockAsk, etfBid, etfAsk, expBid, expAsk, signal });
    }
    return result;
  }, [betaMap, liveMap, minSignal]);

  // Group by ETF, apply custom order within each group
  const grouped = useMemo(() => {
    const g: Record<string, ConvRow[]> = {};
    for (const r of rows) {
      if (!g[r.etf]) g[r.etf] = [];
      g[r.etf].push(r);
    }
    return Object.entries(g).sort(([a], [b]) => a.localeCompare(b)).map(([etf, etfRows]) => {
      const order = groupOrder[etf];
      const sorted = order
        ? [...etfRows].sort((a, b) => {
            const ai = order.indexOf(a.ticker);
            const bi = order.indexOf(b.ticker);
            if (ai < 0 && bi < 0) return Math.abs(b.signal) - Math.abs(a.signal);
            if (ai < 0) return 1;
            if (bi < 0) return -1;
            return ai - bi;
          })
        : [...etfRows].sort((a, b) => Math.abs(b.signal) - Math.abs(a.signal));
      return [etf, sorted] as [string, ConvRow[]];
    });
  }, [rows, groupOrder]);

  function onDrop(etf: string, targetTicker: string) {
    if (!dragging || dragging === targetTicker) return;
    const currentRows = grouped.find(([e]) => e === etf)?.[1] ?? [];
    const currentOrder = currentRows.map((r) => r.ticker);
    const from = currentOrder.indexOf(dragging);
    const to = currentOrder.indexOf(targetTicker);
    if (from < 0 || to < 0) return;
    const next = [...currentOrder];
    next.splice(from, 1);
    next.splice(to, 0, dragging);
    setGroupOrder((prev) => ({ ...prev, [etf]: next }));
  }

  const totalSignals = rows.length;
  const dot = { connected: "bg-green-500", connecting: "bg-yellow-500 animate-pulse", disconnected: "bg-red-500" }[status];

  return (
    <div className="flex flex-col h-full bg-[#1e1e1e]">
      {/* Status bar */}
      <div className="flex items-center gap-3 px-4 py-1.5 border-b border-[#333] text-xs text-slate-500 shrink-0 bg-[#242424]">
        <span className={clsx("w-2 h-2 rounded-full shrink-0", dot)} />
        <span>
          {status === "connected" ? "Терминал подключён"
            : status === "connecting" ? "Подключение..."
            : "Терминал недоступен — python scripts/terminal_bridge.py"}
        </span>
        {betaLoading && <span className="text-slate-600">загрузка бет...</span>}
        {betaError && <span className="text-red-500">беты: {betaError}</span>}
        {!betaLoading && !betaError && <span className="text-slate-600">{betas.length} бет</span>}
        <span className="ml-auto flex items-center gap-2">
          <label className="text-slate-600">мин. сигнал</label>
          <input type="number" step="0.1" min="0" value={minSignal}
            onChange={(e) => setMinSignal(parseFloat(e.target.value) || 0)}
            className="w-16 bg-[#2a2a2a] border border-[#404040] rounded px-1.5 py-0.5 text-slate-300 text-xs focus:outline-none focus:border-blue-500 tabular-nums" />
          <span className="text-slate-600">%</span>
        </span>
        {ts && <span className="tabular-nums text-slate-600">{ts}</span>}
        <span className="text-slate-400 font-medium">{totalSignals} сигналов</span>
      </div>

      {totalSignals === 0 ? (
        <div className="flex-1 flex items-center justify-center text-slate-600 text-sm">
          {betaLoading ? "Загружаем беты из Datum..."
            : status !== "connected" ? "Ожидаем терминал..."
            : !liveMap.size ? "Ожидаем данные..."
            : "Нет расхождений выше порога"}
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          <table className="w-full text-xs border-collapse">
            <thead className="sticky top-0 bg-[#1e1e1e] z-10">
              <tr className="text-slate-500 uppercase tracking-wider border-b border-[#2e2e2e]">
                <th className="w-5 px-1 py-2" />
                <th className="text-left px-3 py-2">Тикер</th>
                <th className="text-left px-2 py-2">Сектор</th>
                <th className="text-right px-2 py-2">β</th>
                <th className="text-right px-2 py-2">Bid%</th>
                <th className="text-right px-2 py-2">Ask%</th>
                <th className="text-right px-2 py-2 text-slate-600">ETF×β bid</th>
                <th className="text-right px-2 py-2 text-slate-600">ETF×β ask</th>
                <th className="text-right px-3 py-2">Сигнал</th>
                <th className="text-center px-3 py-2">Идея</th>
              </tr>
            </thead>
            <tbody>
              {grouped.map(([etf, etfRows]) => [
                // ETF group header
                <tr key={`h-${etf}`} className="bg-[#242424] border-t border-[#333]">
                  <td colSpan={10} className="px-3 py-1 text-[11px] font-bold text-slate-400 tracking-widest uppercase">
                    {etf}
                    <span className="ml-2 font-normal text-slate-500 normal-case tracking-normal">{SECTOR_LABEL[etf] ?? ""}</span>
                    <span className="ml-2 font-normal text-slate-600">{etfRows.length} сигналов</span>
                  </td>
                </tr>,
                // Ticker rows
                ...etfRows.map((r) => (
                  <tr
                    key={r.ticker}
                    draggable
                    onDragStart={() => setDragging(r.ticker)}
                    onDragEnd={() => { setDragging(null); setDragOver(null); }}
                    onDragOver={(e) => { e.preventDefault(); setDragOver(r.ticker); }}
                    onDragLeave={() => setDragOver(null)}
                    onDrop={(e) => { e.preventDefault(); onDrop(etf, r.ticker); setDragging(null); setDragOver(null); }}
                    className={clsx(
                      "border-t transition-colors select-none",
                      dragOver === r.ticker ? "border-t-blue-500 bg-blue-900/20" : "border-t-[#272727] hover:bg-[#272727]",
                      dragging === r.ticker && "opacity-40"
                    )}
                  >
                    <td className="w-5 px-1 py-1.5 text-slate-700 text-center cursor-grab">⠿</td>
                    <td className="px-3 py-1.5 font-bold text-slate-100 tracking-wide">{r.ticker}</td>
                    <td className="px-2 py-1.5 text-slate-500 font-mono">{r.etf}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-slate-500">{r.beta.toFixed(2)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-slate-300">{pct(r.stockBid)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-slate-300">{pct(r.stockAsk)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-slate-600">{pct(r.expBid)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-slate-600">{pct(r.expAsk)}</td>
                    <td className={clsx("px-3 py-1.5 text-right tabular-nums font-semibold", signalColor(r.signal))}>
                      {pct(r.signal)}
                    </td>
                    <td className="px-3 py-1.5 text-center">
                      {r.signal > 0
                        ? <span className="text-green-400 font-bold">LONG</span>
                        : <span className="text-red-400 font-bold">SHORT</span>}
                    </td>
                  </tr>
                )),
              ])}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
