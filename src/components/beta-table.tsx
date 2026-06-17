"use client";

import { useState } from "react";
import { BENCHMARKS } from "@/lib/universe";

export interface BetaRow {
  x_ticker: string;
  y_ticker: string;
  corr: number;
  beta: number;
}

const SECTOR: Record<string, string> = {
  QQQ:  "Nasdaq",
  IWM:  "Small Cap",
  XLE:  "Energy",
  DIA:  "Dow",
  BITO: "Crypto",
  SMH:  "Chips",
  SOXL: "Chips 3x",
  SPY:  "S&P 500",
  XLF:  "Finance",
  XLI:  "Industrials",
  XLP:  "Staples",
  XLU:  "Utilities",
  IGV:  "Software",
  GDX:  "Gold",
  ARKK: "Innovation",
  KWEB: "China",
};

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

interface Props { rows: BetaRow[]; search: string }

export default function BetaTable({ rows, search }: Props) {
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
        <thead className="sticky top-0 bg-[#141414] z-10">
          <tr className="text-xs uppercase tracking-wider">
            <Th col="ticker" label="Тикер" />
            <Th col="etf" label="Сектор" />
            <Th col="beta" label="Beta" align="right" />
            <Th col="corr" label="Corr" align="right" />
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr key={`${row.y_ticker}-${row.x_ticker}`} className="border-t border-[#222] hover:bg-[#1e1e1e] transition-colors">
              <td className="px-3 py-1.5 font-medium text-slate-100">
                {row.x_ticker}
                <span className="ml-2 text-[10px] text-slate-600 font-normal">{SECTOR[row.y_ticker] ?? row.y_ticker}</span>
              </td>
              <td className="px-3 py-1.5 text-slate-500 text-xs font-mono">{row.y_ticker}</td>
              <td className={`px-3 py-1.5 text-right tabular-nums ${betaColor(row.beta)}`}>{row.beta.toFixed(2)}</td>
              <td className={`px-3 py-1.5 text-right tabular-nums ${corrColor(row.corr)}`}>{row.corr.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
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
      <thead className="sticky top-0 bg-[#141414] z-10">
        <tr className="text-xs uppercase tracking-wider">
          <Th col="ticker" label="Тикер" />
          <Th col="etf" label="Сектор" />
          <Th col="beta" label="Beta" align="right" />
          <Th col="corr" label="Corr" align="right" />
        </tr>
      </thead>
      <tbody>
        {[...byEtf.entries()].map(([etf, etfRows]) => {
          const sorted = [...etfRows].sort((a, b) => b.beta - a.beta);
          if (sorted.length === 0) return null;
          return [
            <tr key={`h-${etf}`} className="bg-[#1c1c1c] border-t border-[#2e2e2e]">
              <td colSpan={4} className="px-3 py-1 text-xs font-bold text-slate-400 tracking-widest uppercase">
                {etf}
                <span className="ml-2 font-normal text-slate-600 normal-case tracking-normal">{SECTOR[etf] ?? ""}</span>
                <span className="ml-2 font-normal text-slate-700">{sorted.length} stocks</span>
              </td>
            </tr>,
            ...sorted.map((row) => (
              <tr key={`${row.y_ticker}-${row.x_ticker}`} className="border-t border-[#1c1c1c] hover:bg-[#1e1e1e] transition-colors">
                <td className="px-3 py-1.5 font-medium text-slate-100">
                  {row.x_ticker}
                  <span className="ml-2 text-[10px] text-slate-600 font-normal">{SECTOR[row.y_ticker] ?? row.y_ticker}</span>
                </td>
                <td className="px-3 py-1.5 text-slate-600 text-xs font-mono">{row.y_ticker}</td>
                <td className={`px-3 py-1.5 text-right tabular-nums ${betaColor(row.beta)}`}>{row.beta.toFixed(2)}</td>
                <td className={`px-3 py-1.5 text-right tabular-nums ${corrColor(row.corr)}`}>{row.corr.toFixed(2)}</td>
              </tr>
            )),
          ];
        })}
      </tbody>
    </table>
  );
}
