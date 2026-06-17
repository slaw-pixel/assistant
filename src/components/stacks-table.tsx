"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";

export interface StackRow {
  ticker: string;
  "BidLstClsΔ%": number | null;
  "AskLstClsΔ%": number | null;
  isTrash: number | string | null;
  Report: number | string | null;
}

type Status = "connecting" | "connected" | "disconnected";

function pct(v: number | null): string {
  if (v == null) return "—";
  return (v > 0 ? "+" : "") + v.toFixed(2) + "%";
}
function pctColor(v: number | null): string {
  if (v == null) return "text-slate-600";
  if (v > 3)  return "text-green-400 font-semibold";
  if (v > 1)  return "text-green-300";
  if (v < -3) return "text-red-400 font-semibold";
  if (v < -1) return "text-red-300";
  return "text-slate-400";
}
function flag(v: number | string | null): React.ReactNode {
  if (v == null || v === "" || v === 0 || v === "NO" || v === "0" || v === "False")
    return null;
  return <span className="text-yellow-400">●</span>;
}

const WS_URL = process.env.NEXT_PUBLIC_BRIDGE_URL ?? "ws://localhost:8766";

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
        const msg = JSON.parse(e.data as string);
        if (msg.type === "snapshot") {
          setRows(msg.data);
          setTs(msg.ts ?? null);
        }
      };
      ws.onclose = () => {
        setStatus("disconnected");
        timer = setTimeout(connect, 3000);
      };
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

  return (
    <div className="flex flex-col h-full">
      {/* status bar */}
      <div className="flex items-center gap-2 px-4 py-1.5 border-b border-[#2a2a2a] text-xs text-slate-500 shrink-0">
        <span className={clsx("w-2 h-2 rounded-full shrink-0", dot)} />
        <span>
          {status === "connected"
            ? "Терминал подключён"
            : status === "connecting"
            ? "Подключение..."
            : "Терминал недоступен — запусти: python scripts/terminal_bridge.py"}
        </span>
        {ts && <span className="ml-auto tabular-nums">{ts}</span>}
      </div>

      {rows.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-slate-600 text-sm">
          {status !== "connected" ? "Ожидаем бридж..." : "Нет данных"}
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 bg-[#0d0d0d] z-10">
              <tr className="text-xs text-slate-500 uppercase tracking-wider">
                <th className="text-left px-3 py-2 w-24">Ticker</th>
                <th className="text-right px-3 py-2">Bid%</th>
                <th className="text-right px-3 py-2">Ask%</th>
                <th className="text-center px-2 py-2">Trash</th>
                <th className="text-center px-2 py-2">Rep</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.ticker}
                  className="border-t border-[#1a1a1a] hover:bg-[#1a1a1a] transition-colors"
                >
                  <td className="px-3 py-1.5 font-bold text-slate-100 text-xs tracking-wide">
                    {r.ticker}
                  </td>
                  <td className={clsx("px-3 py-1.5 text-right tabular-nums", pctColor(r["BidLstClsΔ%"]))}>
                    {pct(r["BidLstClsΔ%"])}
                  </td>
                  <td className={clsx("px-3 py-1.5 text-right tabular-nums", pctColor(r["AskLstClsΔ%"]))}>
                    {pct(r["AskLstClsΔ%"])}
                  </td>
                  <td className="px-2 py-1.5 text-center text-xs">{flag(r.isTrash)}</td>
                  <td className="px-2 py-1.5 text-center text-xs">{flag(r.Report)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
