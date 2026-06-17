"use client";

import Link from "next/link";
import StacksTable from "@/components/stacks-table";
import clsx from "clsx";

const TABS = [
  { label: "Все стаки", href: "/stacks", active: true },
  { label: "Беты", href: "/" },
  { label: "Результат", href: "#", disabled: true },
];

export default function StacksPage() {
  return (
    <div className="flex flex-col h-screen bg-[#0d0d0d] text-slate-200">
      <header className="flex items-center gap-4 px-4 py-2 border-b border-[#2a2a2a] bg-[#111] shrink-0">
        <span className="text-slate-400 font-bold tracking-widest text-sm uppercase">
          Assistant
        </span>
        <nav className="flex gap-1">
          {TABS.map(({ label, href, active, disabled }) =>
            disabled ? (
              <span key={label} className="px-3 py-1 rounded text-xs font-medium text-slate-700 cursor-not-allowed">{label}</span>
            ) : (
              <Link key={label} href={href} className={clsx("px-3 py-1 rounded text-xs font-medium", active ? "bg-blue-600 text-white" : "text-slate-400 hover:text-slate-200")}>
                {label}
              </Link>
            )
          )}
        </nav>
        <div className="flex-1" />
        <span className="text-xs text-slate-600">
          Список тикеров: <code className="text-slate-400">data/stacks.json</code>
        </span>
      </header>

      <main className="flex-1 overflow-hidden">
        <StacksTable />
      </main>
    </div>
  );
}
