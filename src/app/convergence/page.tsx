"use client";

import Link from "next/link";
import ConvergenceTable from "@/components/convergence-table";

export default function ConvergencePage() {
  return (
    <div className="flex flex-col h-screen bg-[#1e1e1e] text-slate-200">
      <header className="flex items-center gap-4 px-4 py-2 border-b border-[#333] bg-[#242424] shrink-0">
        <span className="text-slate-400 font-bold tracking-widest text-sm uppercase">Assistant</span>
        <nav className="flex gap-1">
          <Link href="/stacks" className="px-3 py-1 rounded text-xs font-medium text-slate-400 hover:text-slate-200">Все стаки</Link>
          <Link href="/" className="px-3 py-1 rounded text-xs font-medium text-slate-400 hover:text-slate-200">Беты</Link>
          <span className="px-3 py-1 rounded text-xs font-medium bg-blue-600 text-white">Calc</span>
        </nav>
        <div className="flex-1" />
        <span className="text-xs text-slate-600">сигнал = ETF×β − акция (лонг) / акция − ETF×β (шорт)</span>
      </header>
      <main className="flex-1 overflow-hidden">
        <ConvergenceTable />
      </main>
    </div>
  );
}
