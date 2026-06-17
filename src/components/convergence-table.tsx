"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import clsx from "clsx";
import { UNIVERSE, SECTOR_LABEL } from "@/lib/universe";

const DEFAULT_ASSIGN: Record<string, string> = {};
for (const [etf, tickers] of Object.entries(UNIVERSE))
  for (const t of tickers) DEFAULT_ASSIGN[t] = etf;

interface LiveRow {
  ticker: string;
  "BidLstClsΔ%": number | null;
  "AskLstClsΔ%": number | null;
  isTrash: number | string | null;
}
interface BetaRow { x_ticker: string; y_ticker: string; beta: number; corr: number }
interface ConvRow { ticker: string; etf: string; beta: number; stockBid: number; stockAsk: number; zapas: number }

type Status = "connecting" | "connected" | "disconnected";
const WS_URL = process.env.NEXT_PUBLIC_BRIDGE_URL ?? "ws://localhost:8766";

function pct(v: number, sign = true) {
  return (sign && v > 0 ? "+" : "") + v.toFixed(2) + "%";
}
function isTrashFlag(v: number | string | null) {
  return v != null && v !== 0 && v !== "0" && v !== "NO" && v !== "False" && v !== "";
}
function zapasColor(z: number) {
  const a = Math.abs(z);
  if (a > 1.5) return z > 0 ? "text-green-300 font-bold" : "text-red-300 font-bold";
  if (a > 0.5) return z > 0 ? "text-green-400" : "text-red-400";
  return "text-slate-400";
}

export default function ConvergenceTable() {
  const [liveMap, setLiveMap]       = useState<Map<string, LiveRow>>(new Map());
  const [betas, setBetas]           = useState<BetaRow[]>([]);
  const [assignments, setAssign]    = useState<Record<string, string>>({});
  const [status, setStatus]         = useState<Status>("disconnected");
  const [ts, setTs]                 = useState<string | null>(null);
  const [betaLoading, setBetaLoad]  = useState(true);
  const [minZapas, setMinZapas]     = useState(0.15);
  const [groupOrder, setGroupOrder] = useState<Record<string, string[]>>({});
  const [dragging, setDragging]     = useState<string | null>(null);
  const [dragOver, setDragOver]     = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    fetch("/api/betas?period=3%20months").then(r => r.json())
      .then(d => { setBetas(d.rows ?? []); setBetaLoad(false); }).catch(() => setBetaLoad(false));
    fetch("/api/assignments").then(r => r.json()).then(setAssign).catch(() => {});
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
          setLiveMap(new Map((msg.data as LiveRow[]).map(r => [r.ticker, r])));
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

  const betaMap = useMemo(() => {
    const m = new Map<string, BetaRow>();
    for (const b of betas)
      if (b.y_ticker === effective[b.x_ticker]) m.set(b.x_ticker, b);
    return m;
  }, [betas, effective]);

  const rows = useMemo((): ConvRow[] => {
    if (!betaMap.size || !liveMap.size) return [];
    const result: ConvRow[] = [];
    for (const [ticker, b] of betaMap) {
      if (!b.beta) continue;
      const live = liveMap.get(ticker);
      const etfLive = liveMap.get(b.y_ticker);
      if (!live || !etfLive || isTrashFlag(live.isTrash)) continue;
      const sb = live["BidLstClsΔ%"], sa = live["AskLstClsΔ%"];
      const eb = etfLive["BidLstClsΔ%"], ea = etfLive["AskLstClsΔ%"];
      if (sb == null || sa == null || eb == null || ea == null) continue;
      const expBid = eb * b.beta, expAsk = ea * b.beta;
      const dLong = expBid - sa, dShort = sb - expAsk;
      let zapas = 0;
      if (dLong > 0) zapas = dLong;
      else if (dShort > 0) zapas = -dShort;
      if (Math.abs(zapas) < minZapas) continue;
      result.push({ ticker, etf: b.y_ticker, beta: b.beta, stockBid: sb, stockAsk: sa, zapas });
    }
    return result;
  }, [betaMap, liveMap, minZapas]);

  const grouped = useMemo(() => {
    const g: Record<string, ConvRow[]> = {};
    for (const r of rows) { if (!g[r.etf]) g[r.etf] = []; g[r.etf].push(r); }
    return Object.entries(g).sort(([a], [b]) => a.localeCompare(b)).map(([etf, etfRows]) => {
      const order = groupOrder[etf];
      const sorted = order
        ? [...etfRows].sort((a, b) => {
            const ai = order.indexOf(a.ticker), bi = order.indexOf(b.ticker);
            if (ai < 0 && bi < 0) return Math.abs(b.zapas) - Math.abs(a.zapas);
            return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi);
          })
        : [...etfRows].sort((a, b) => Math.abs(b.zapas) - Math.abs(a.zapas));
      return [etf, sorted] as [string, ConvRow[]];
    });
  }, [rows, groupOrder]);

  function onDrop(etf: string, targetTicker: string) {
    if (!dragging || dragging === targetTicker) return;
    const cur = grouped.find(([e]) => e === etf)?.[1].map(r => r.ticker) ?? [];
    const next = [...cur];
    const fi = next.indexOf(dragging), ti = next.indexOf(targetTicker);
    if (fi < 0 || ti < 0) return;
    next.splice(fi, 1); next.splice(ti, 0, dragging);
    setGroupOrder(p => ({ ...p, [etf]: next }));
  }

  const dot = { connected: "bg-green-500", connecting: "bg-yellow-500 animate-pulse", disconnected: "bg-red-500" }[status];

  return (
    <div className="flex flex-col h-full" style={{ background: "#252525" }}>
      {/* Status bar */}
      <div className="flex items-center gap-3 px-4 py-1.5 border-b text-xs shrink-0"
        style={{ background: "#2e2e2e", borderColor: "#3a3a3a", color: "#888" }}>
        <span className={clsx("w-2 h-2 rounded-full shrink-0", dot)} />
        <span style={{ color: status === "connected" ? "#aaa" : "#777" }}>
          {status === "connected" ? "Терминал подключён"
            : status === "connecting" ? "Подключение..."
            : "Терминал недоступен"}
        </span>
        {betaLoading && <span>загрузка бет...</span>}
        <span className="ml-auto flex items-center gap-2">
          <span>мин. запас</span>
          <input type="number" step="0.05" min="0" value={minZapas}
            onChange={e => setMinZapas(parseFloat(e.target.value) || 0)}
            className="w-14 rounded px-1.5 py-0.5 text-xs tabular-nums focus:outline-none"
            style={{ background: "#333", border: "1px solid #444", color: "#ccc" }} />
          <span>%</span>
        </span>
        {ts && <span style={{ color: "#666" }}>{ts}</span>}
        <span style={{ color: "#aaa" }}>{rows.length} сигналов</span>
      </div>

      {rows.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-sm" style={{ color: "#555" }}>
          {betaLoading ? "Загружаем беты..." : status !== "connected" ? "Ожидаем терминал..." : "Нет расхождений выше порога"}
        </div>
      ) : (
        /* Multi-column grid — one card per ETF sector */
        <div className="flex-1 overflow-auto p-3">
          <div className="flex gap-3 h-full items-start flex-wrap">
            {grouped.map(([etf, etfRows]) => (
              <div key={etf} className="flex flex-col rounded flex-shrink-0"
                style={{ width: 220, background: "#2e2e2e", border: "1px solid #3a3a3a", minHeight: 80 }}>

                {/* Column header */}
                <div className="px-2.5 py-1.5 rounded-t" style={{ background: "#383838", borderBottom: "1px solid #444" }}>
                  <div className="text-[11px] font-bold tracking-widest uppercase" style={{ color: "#ccc" }}>{etf}</div>
                  <div className="text-[10px]" style={{ color: "#777" }}>{SECTOR_LABEL[etf] ?? ""} · {etfRows.length}</div>
                </div>

                {/* Column sub-header */}
                <div className="grid px-2 py-0.5 text-[9px] uppercase tracking-wider"
                  style={{ gridTemplateColumns: "1fr auto auto auto", color: "#555", borderBottom: "1px solid #333" }}>
                  <span>Тикер</span>
                  <span className="text-right pr-1">Bid</span>
                  <span className="text-right pr-1">Ask</span>
                  <span className="text-right">Запас</span>
                </div>

                {/* Rows */}
                {etfRows.map(r => (
                  <div key={r.ticker}
                    draggable
                    onDragStart={() => setDragging(r.ticker)}
                    onDragEnd={() => { setDragging(null); setDragOver(null); }}
                    onDragOver={e => { e.preventDefault(); setDragOver(r.ticker); }}
                    onDragLeave={() => setDragOver(null)}
                    onDrop={e => { e.preventDefault(); onDrop(etf, r.ticker); setDragging(null); setDragOver(null); }}
                    className="grid px-2 py-1 cursor-grab select-none"
                    style={{
                      gridTemplateColumns: "1fr auto auto auto",
                      borderBottom: "1px solid #333",
                      background: dragOver === r.ticker ? "#3a4a5a"
                        : dragging === r.ticker ? "#222"
                        : undefined,
                      opacity: dragging === r.ticker ? 0.4 : 1,
                    }}
                  >
                    <span className="text-[11px] font-bold" style={{ color: "#e0e0e0" }}>{r.ticker}</span>
                    <span className="text-[10px] tabular-nums text-right pr-1" style={{ color: "#888" }}>{pct(r.stockBid)}</span>
                    <span className="text-[10px] tabular-nums text-right pr-1" style={{ color: "#888" }}>{pct(r.stockAsk)}</span>
                    <span className={clsx("text-[11px] tabular-nums font-semibold text-right", zapasColor(r.zapas))}>
                      {r.zapas > 0 ? "▲" : "▼"}{pct(Math.abs(r.zapas), false)}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
