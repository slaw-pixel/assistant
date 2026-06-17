"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";

export interface StackRow {
  ticker: string;
  LstPrc: number | null;
  Bid: number | null;
  Ask: number | null;
  YCls: number | null;
  "Gap%": number | null;
  "DayMove%": number | null;
  "AskLstClsΔ%": number | null;
  Vol: number | null;
  TrdStatus: string | null;
}

type Status = "connecting" | "connected" | "disconnected";

function pct(v: number | null): string {
  if (v == null) return "—";
  return (v > 0 ? "+" : "") + v.toFixed(2) + "%";
}
function price(v: number | null): string {
  if (v == null) return "—";
  return v.toFixed(2);
}
function vol(v: number | null): string {
  if (v == null) return "—";
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + "M";
  if (v >= 1_000) return (v / 1_000).toFixed(0) + "K";
  return String(v);
}
function pctColor(v: number | null): string {
  if (v == null) return "text-slate-600";
  if (v > 2) return "text-green-400 font-semibold";
  if (v > 0.5) return "text-green-300";
  if (v < -2) return "text-red-400 font-semibold";
  if (v < -0.5) return "text-red-300";
  return "text-slate-400";
}

const WS_URL =
  process.env.NEXT_PUBLIC_BRIDGE_URL ?? "ws://localhost:8766";

export default function StacksTable() {
  const [rows, setRows] = useState<StackRow[]>([]);
  const [status, setStatus] = useState<Status>("disconnected");
  const [ts, setTs] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    function connect() {
      setStatus("connecting");
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => setStatus("connected");

      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data);
        if (msg.type === "snapshot") {
          setRows(msg.data);
          setTs(msg.ts ?? null);
        }
      };

      ws.onclose = () => {
        setStatus("disconnected");
        timer = setTimeout(connect, 3000); // auto-reconnect
      };

      ws.onerror = () => ws.close();
    }

    connect();
    return () => {
      clearTimeout(timer);
      wsRef.current?.close();
    };
  }, []);

  const statusDot = {
    connected: "bg-green-500",
    connecting: "bg-yellow-500 animate-pulse",
    disconnected: "bg-red-500",
  }[status];

  return (
    <div className="flex flex-col h-full">
      {/* status bar */}
      <div className="flex items-center gap-2 px-4 py-1.5 border-b border-[#2a2a2a] text-xs text-slate-500 shrink-0">
        <span className={clsx("w-2 h-2 rounded-full", statusDot)} />
        <span>
          {status === "connected"
            ? "Терминал подключён"
            : status === "connecting"
            ? "Подключение..."
            : "Терминал не доступен — запусти terminal_bridge.py"}
        </span>
        {ts && <span className="ml-auto">{ts}</span>}
      </div>

      {/* table */}
      {rows.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-slate-600 text-sm text-center px-8">
          {status === "disconnected"
            ? "Запусти: python scripts/terminal_bridge.py"
            : "Ожидаем данных..."}
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 bg-[#0d0d0d] z-10">
              <tr className="text-xs text-slate-500 uppercase tracking-wider">
                <th className="text-left px-3 py-2">Ticker</th>
                <th className="text-right px-3 py-2">Bid</th>
                <th className="text-right px-3 py-2">Ask</th>
                <th className="text-right px-3 py-2">Gap%</th>
                <th className="text-right px-3 py-2">Day%</th>
                <th className="text-right px-3 py-2 font-bold text-slate-400">Net%</th>
                <th className="text-right px-3 py-2">Vol</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.ticker}
                  className="border-t border-[#1a1a1a] hover:bg-[#1a1a1a] transition-colors"
                >
                  <td className="px-3 py-2 font-bold text-slate-100">{r.ticker}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-300">
                    {price(r.Bid)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-300">
                    {price(r.Ask)}
                  </td>
                  <td className={clsx("px-3 py-2 text-right tabular-nums", pctColor(r["Gap%"]))}>
                    {pct(r["Gap%"])}
                  </td>
                  <td className={clsx("px-3 py-2 text-right tabular-nums", pctColor(r["DayMove%"]))}>
                    {pct(r["DayMove%"])}
                  </td>
                  <td className={clsx("px-3 py-2 text-right tabular-nums font-semibold", pctColor(r["AskLstClsΔ%"]))}>
                    {pct(r["AskLstClsΔ%"])}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-500">
                    {vol(r.Vol)}
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
