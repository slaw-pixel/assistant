"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import clsx from "clsx";

interface LiveRow {
  ticker: string;
  "BidLstClsΔ%": number | null;
  "AskLstClsΔ%": number | null;
  isTrash: number | string | null;
}

interface BetaRow {
  x_ticker: string; // stock
  y_ticker: string; // ETF
  beta: number;
  corr: number;
}

interface ConvRow {
  ticker: string;
  etf: string;
  beta: number;
  stockBid: number;
  stockAsk: number;
  etfBid: number;
  etfAsk: number;
  expBid: number; // ETF_bid × beta
  expAsk: number; // ETF_ask × beta
  signal: number; // >0 long lagging, <0 short leading
}

type Status = "connecting" | "connected" | "disconnected";

const WS_URL = process.env.NEXT_PUBLIC_BRIDGE_URL ?? "ws://localhost:8766";
const MIN_SIGNAL = 0.15; // % threshold to show

function pct(v: number) {
  return (v > 0 ? "+" : "") + v.toFixed(2) + "%";
}

function signalColor(s: number) {
  if (s > 1.5) return "text-green-400 font-bold";
  if (s > 0.5) return "text-green-300";
  if (s < -1.5) return "text-red-400 font-bold";
  if (s < -0.5) return "text-red-300";
  return "text-slate-400";
}

function isTrashFlag(v: number | string | null) {
  return v != null && v !== 0 && v !== "0" && v !== "NO" && v !== "False" && v !== "";
}

export default function ConvergenceTable() {
  const [liveMap, setLiveMap] = useState<Map<string, LiveRow>>(new Map());
  const [betas, setBetas] = useState<BetaRow[]>([]);
  const [status, setStatus] = useState<Status>("disconnected");
  const [ts, setTs] = useState<string | null>(null);
  const [betaLoading, setBetaLoading] = useState(true);
  const [betaError, setBetaError] = useState<string | null>(null);
  const [minSignal, setMinSignal] = useState(MIN_SIGNAL);
  const wsRef = useRef<WebSocket | null>(null);

  // Load betas once on mount
  useEffect(() => {
    fetch("/api/betas?period=3%20months")
      .then((r) => r.json())
      .then((d) => { setBetas(d.rows ?? []); setBetaLoading(false); })
      .catch((e) => { setBetaError(String(e)); setBetaLoading(false); });
  }, []);

  // WebSocket live data
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

  const rows = useMemo((): ConvRow[] => {
    if (!betas.length || !liveMap.size) return [];

    const result: ConvRow[] = [];

    for (const b of betas) {
      if (!b.beta) continue;

      const live = liveMap.get(b.x_ticker);
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

      // Long signal: stock ask below where ETF×beta says it should be
      const divLong = expBid - stockAsk;
      // Short signal: stock bid above where ETF×beta says it should be
      const divShort = stockBid - expAsk;

      let signal = 0;
      if (divLong > 0) signal = divLong;
      else if (divShort > 0) signal = -divShort;

      if (Math.abs(signal) < minSignal) continue;

      result.push({ ticker: b.x_ticker, etf: b.y_ticker, beta: b.beta, stockBid, stockAsk, etfBid, etfAsk, expBid, expAsk, signal });
    }

    return result.sort((a, b) => Math.abs(b.signal) - Math.abs(a.signal));
  }, [betas, liveMap, minSignal]);

  const dot = { connected: "bg-green-500", connecting: "bg-yellow-500 animate-pulse", disconnected: "bg-red-500" }[status];

  return (
    <div className="flex flex-col h-full">
      {/* status bar */}
      <div className="flex items-center gap-3 px-4 py-1.5 border-b border-[#2a2a2a] text-xs text-slate-500 shrink-0">
        <span className={clsx("w-2 h-2 rounded-full shrink-0", dot)} />
        <span>
          {status === "connected" ? "Терминал подключён"
            : status === "connecting" ? "Подключение..."
            : "Терминал недоступен — запусти: python scripts/terminal_bridge.py"}
        </span>

        {betaLoading && <span className="text-slate-600">загрузка бет...</span>}
        {betaError && <span className="text-red-500">беты: {betaError}</span>}
        {!betaLoading && !betaError && (
          <span className="text-slate-600">{betas.length} бет загружено</span>
        )}

        <span className="ml-auto flex items-center gap-2">
          <label className="text-slate-600">мин. сигнал</label>
          <input
            type="number"
            step="0.1"
            min="0"
            value={minSignal}
            onChange={(e) => setMinSignal(parseFloat(e.target.value) || 0)}
            className="w-16 bg-[#1a1a1a] border border-[#333] rounded px-1.5 py-0.5 text-slate-300 text-xs focus:outline-none focus:border-blue-600 tabular-nums"
          />
          <span className="text-slate-600">%</span>
        </span>

        {ts && <span className="tabular-nums text-slate-600">{ts}</span>}
        <span className="text-slate-500">{rows.length} сигналов</span>
      </div>

      {rows.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-slate-600 text-sm">
          {betaLoading ? "Загружаем беты из Datum..."
            : status !== "connected" ? "Ожидаем терминал..."
            : !liveMap.size ? "Ожидаем данные..."
            : "Нет расхождений выше порога"}
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          <table className="w-full text-xs border-collapse">
            <thead className="sticky top-0 bg-[#0d0d0d] z-10">
              <tr className="text-slate-600 uppercase tracking-wider">
                <th className="text-left px-3 py-2">Тикер</th>
                <th className="text-left px-2 py-2">ETF</th>
                <th className="text-right px-2 py-2">β</th>
                <th className="text-right px-2 py-2">Bid%</th>
                <th className="text-right px-2 py-2">Ask%</th>
                <th className="text-right px-2 py-2 text-slate-500">ETF×β bid</th>
                <th className="text-right px-2 py-2 text-slate-500">ETF×β ask</th>
                <th className="text-right px-3 py-2 text-slate-300">Сигнал</th>
                <th className="text-center px-3 py-2 text-slate-300">Идея</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.ticker} className="border-t border-[#1a1a1a] hover:bg-[#1a1a1a] transition-colors">
                  <td className="px-3 py-1.5 font-bold text-slate-100 tracking-wide">{r.ticker}</td>
                  <td className="px-2 py-1.5 text-slate-500">{r.etf}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-slate-500">{r.beta.toFixed(2)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-slate-400">{pct(r.stockBid)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-slate-400">{pct(r.stockAsk)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-slate-600">{pct(r.expBid)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-slate-600">{pct(r.expAsk)}</td>
                  <td className={clsx("px-3 py-1.5 text-right tabular-nums font-semibold", signalColor(r.signal))}>
                    {pct(r.signal)}
                  </td>
                  <td className="px-3 py-1.5 text-center">
                    {r.signal > 0
                      ? <span className="text-green-400 font-bold text-xs">LONG</span>
                      : <span className="text-red-400 font-bold text-xs">SHORT</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
