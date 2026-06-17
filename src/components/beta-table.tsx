"use client";

import { useState } from "react";
import { BENCHMARKS, SECTOR_LABEL as SECTOR } from "@/lib/universe";

export interface BetaRow {
  x_ticker: string;
  y_ticker: string;
  corr: number;
  beta: number;
}

function betaColor(b: number) {
  if (b > 1.5) return "text-green-400 font-semibold";
  if (b > 1.0) return "text-green-300";
  if (b >= 0.5) return "text-slate-200";
  if (b >= 0)  return "text-slate-500";
  return "text-red-400";
}

function corrColor(c: number) {
  const a = Math.abs(c);
  if (a >= 0.85) return "text-green-400";
  if (a >= 0.7)  return "text-yellow-400";
  return "text-red-400";
}

type SortCol = "ticker" | "etf" | "beta" | "corr";

interface Props {
  rows: BetaRow[];
  search: string;
  focusTicker?: string | null;
  onDelete?: (ticker: string) => void;
}

export default function BetaTable({ rows, search, focusTicker, onDelete }: Props) {
  const [sortCol, setSortCol] = useState<SortCol | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const q = search.toUpperCase().trim();
  const filtered = q ? rows.filter((r) => r.x_ticker.includes(q) || r.y_ticker.includes(q)) : rows;

  function handleSort(col: SortCol) {
    if (sortCol === col) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
  }

  function Th({ col, label, align = "left" }: { col: SortCol; label: string; align?: "left" | "right" }) {
    const active = sortCol === col;
    const arrow = active ? (sortDir === "asc" ? " ↑" : " ↓") : "";
    return (
      <th
        onClick={() => handleSort(col)}
        className={`px-3 py-2 cursor-pointer select-none whitespace-nowrap text-${align} hover:text-slate-300 transition-colors ${active ? "text-slate-200" : "text-slate-500"}`}
      >
        {label}{arrow}
      </th>
    );
  }

  function TickerRow({ row }: { row: BetaRow }) {
    const focused = focusTicker === row.x_ticker;
    return (
      <tr
        className={`group border-t transition-colors ${
          focused
            ? "border-l-2 border-blue-500 bg-blue-900/20 border-t-blue-900/30"
            : "border-t-[#1c1c1c] hover:bg-[#1e1e1e]"
        }`}
      >
        <td className={`px-3 py-1.5 font-medium ${focused ? "text-blue-300" : "text-slate-100"}`}>
          {row.x_ticker}
          <span className="ml-2 text-[10px] text-slate-600 font-normal">{SECTOR[row.y_ticker] ?? row.y_ticker}</span>
        </td>
        <td className="px-3 py-1.5 text-slate-600 text-xs font-mono">{row.y_ticker}</td>
        <td className={`px-3 py-1.5 text-right tabular-nums ${betaColor(row.beta)}`}>{row.beta.toFixed(2)}</td>
        <td className={`px-3 py-1.5 text-right tabular-nums ${corrColor(row.corr)}`}>{row.corr.toFixed(2)}</td>
        <td className="w-6 text-center pr-2">
          {onDelete && (
            <button
              onClick={() => onDelete(row.x_ticker)}
              className="opacity-0 group-hover:opacity-100 text-slate-700 hover:text-red-500 transition-all text-base leading-none"
              title={`Удалить ${row.x_ticker}`}
            >
              ×
            </button>
          )}
        </td>
      </tr>
    );
  }

  const headers = (
    <thead className="sticky top-0 bg-[#1e1e1e] z-10">
      <tr className="text-xs uppercase tracking-wider">
        <Th col="ticker" label="Тикер" />
        <Th col="etf" label="Сектор" />
        <Th col="beta" label="Beta" align="right" />
        <Th col="corr" label="Corr" align="right" />
        <th className="w-6" />
      </tr>
    </thead>
  );

  // Sorted flat view
  if (sortCol) {
    const sorted = [...filtered].sort((a, b) => {
      let v = 0;
      if (sortCol === "ticker") v = a.x_ticker.localeCompare(b.x_ticker);
      else if (sortCol === "etf") v = a.y_ticker.localeCompare(b.y_ticker);
      else if (sortCol === "beta") v = a.beta - b.beta;
      else v = a.corr - b.corr;
      return sortDir === "asc" ? v : -v;
    });
    return (
      <table className="w-full text-sm border-collapse">
        {headers}
        <tbody>{sorted.map((row) => <TickerRow key={`${row.y_ticker}-${row.x_ticker}`} row={row} />)}</tbody>
      </table>
    );
  }

  // Grouped by ETF (default)
  const byEtf = new Map<string, BetaRow[]>();
  for (const etf of BENCHMARKS) byEtf.set(etf, []);
  for (const row of filtered) {
    const bucket = byEtf.get(row.y_ticker);
    if (bucket) bucket.push(row);
    else byEtf.set(row.y_ticker, [row]);
  }

  return (
    <table className="w-full text-sm border-collapse">
      {headers}
      <tbody>
        {[...byEtf.entries()].map(([etf, etfRows]) => {
          const sorted = [...etfRows].sort((a, b) => b.beta - a.beta);
          if (sorted.length === 0) return null;
          return [
            <tr key={`h-${etf}`} className="bg-[#1c1c1c] border-t border-[#2e2e2e]">
              <td colSpan={5} className="px-3 py-1 text-xs font-bold text-slate-400 tracking-widest uppercase">
                {etf}
                <span className="ml-2 font-normal text-slate-600 normal-case tracking-normal">{SECTOR[etf] ?? ""}</span>
                <span className="ml-2 font-normal text-slate-700">{sorted.length} stocks</span>
              </td>
            </tr>,
            ...sorted.map((row) => <TickerRow key={`${row.y_ticker}-${row.x_ticker}`} row={row} />),
          ];
        })}
      </tbody>
    </table>
  );
}
