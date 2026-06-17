"use client";

import Link from "next/link";
import clsx from "clsx";
import ConvergenceTable from "@/components/convergence-table";

const TABS = [
  { label: "Betas", href: "/" },
  { label: "Все стаки", href: "/stacks" },
  { label: "Свелось?", href: "/convergence" },
];

export default function ConvergencePage() {
  return (
    <div className="flex flex-col h-screen bg-[#0d0d0d] text-slate-200">
      <header className="flex items-center gap-4 px-4 py-2 border-b border-[#2a2a2a] bg-[#111] shrink-0">
        <span className="text-slate-400 font-bold tracking-widest text-sm uppercase">
          Assistant
        </span>
        <nav className="flex gap-1">
          {TABS.map(({ label, href }) => (
            <Link
              key={label}
              href={href}
              className={clsx(
                "px-3 py-1 rounded text-xs font-medium",
                href === "/convergence"
                  ? "bg-blue-600 text-white"
                  : "text-slate-400 hover:text-slate-200"
              )}
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="flex-1" />
        <span className="text-xs text-slate-600">
          сигнал = ETF×β − акция (лонг) / акция − ETF×β (шорт)
        </span>
      </header>

      <main className="flex-1 overflow-hidden">
        <ConvergenceTable />
      </main>
    </div>
  );
}
