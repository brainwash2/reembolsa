"use client";

import { Building2, Search } from "lucide-react";

export function Topbar() {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white/80 px-4 backdrop-blur-sm sm:px-6 lg:px-8 pl-16 lg:pl-8">
      <div className="flex items-center gap-2">
        <Building2 className="h-4 w-4 text-slate-400" />
        <span className="text-sm font-medium text-slate-700">
          Exportadora Valle Sur SpA
        </span>
        <span className="hidden rounded-md bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-500 sm:inline">
          demo
        </span>
      </div>

      <div className="flex items-center gap-3">
        <button
          className="hidden h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 sm:flex"
          aria-label="Search"
        >
          <Search className="h-4 w-4" />
        </button>
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-600 text-xs font-semibold text-white">
          VS
        </div>
      </div>
    </header>
  );
}
