"use client";

import { BENCHMARKS } from "@/lib/universe";

export interface BetaRow {
  x_ticker: string;
  y_ticker: string;
  corr: number;
  beta: number;
}

function betaColor(beta: number): string {
  if (beta > 1.5) return "text-green-400 font-semibold";
  if (beta > 1.0) return "text-green-300";
  if (beta >= 0.5) return "text-slate-200";
  if (beta >= 0) return "text-slate-500";
  return "text-red-400";
}

function corrColor(corr: number): string {
  const abs = Math.abs(corr);
  if (abs >= 0.85) return "text-green-400";
  if (abs >= 0.7) return "text-yellow-400";
  return "text-slate-500";
}

function fmt(n: number, decimals = 2): string {
  return n.toFixed(decimals);
}

interface Props {
  rows: BetaRow[];
  search: string;
}

export default function BetaTable({ rows, search }: Props) {
  const q = search.toUpperCase().trim();

  // Group rows by sector ETF, preserving benchmark order
  const byEtf = new Map<string, BetaRow[]>();
  for (const etf of BENCHMARKS) byEtf.set(etf, []);
  for (const row of rows) {
    const bucket = byEtf.get(row.y_ticker);
    if (bucket) bucket.push(row);
    else byEtf.set(row.y_ticker, [row]);
  }

  return (
    <div className="overflow-auto">
      <table className="w-full text-sm border-collapse">
        <thead className="sticky top-0 bg-[#0d0d0d] z-10">
          <tr className="text-xs text-slate-500 uppercase tracking-wider">
            <th className="text-left px-3 py-2 w-24">Ticker</th>
            <th className="text-left px-3 py-2 w-16">ETF</th>
            <th className="text-right px-3 py-2 w-20">Beta</th>
            <th className="text-right px-3 py-2 w-20">Corr</th>
          </tr>
        </thead>
        <tbody>
          {[...byEtf.entries()].map(([etf, etfRows]) => {
            const filtered = q
              ? etfRows.filter((r) => r.x_ticker.includes(q))
              : etfRows;
            if (filtered.length === 0) return null;

            const sorted = [...filtered].sort((a, b) => b.beta - a.beta);

            return [
              // Sector header row
              <tr key={`h-${etf}`} className="bg-[#161616] border-t border-[#2a2a2a]">
                <td
                  colSpan={4}
                  className="px-3 py-1 text-xs font-bold text-slate-400 tracking-widest uppercase"
                >
                  {etf}
                  <span className="ml-2 font-normal text-slate-600">
                    {filtered.length} stocks
                  </span>
                </td>
              </tr>,
              // Ticker rows
              ...sorted.map((row) => (
                <tr
                  key={`${row.y_ticker}-${row.x_ticker}`}
                  className="border-t border-[#1a1a1a] hover:bg-[#1a1a1a] transition-colors"
                >
                  <td className="px-3 py-1.5 font-medium text-slate-100">
                    {row.x_ticker}
                  </td>
                  <td className="px-3 py-1.5 text-slate-600 text-xs">{row.y_ticker}</td>
                  <td className={`px-3 py-1.5 text-right tabular-nums ${betaColor(row.beta)}`}>
                    {fmt(row.beta)}
                  </td>
                  <td className={`px-3 py-1.5 text-right tabular-nums ${corrColor(row.corr)}`}>
                    {fmt(row.corr)}
                  </td>
                </tr>
              )),
            ];
          })}
        </tbody>
      </table>
    </div>
  );
}
