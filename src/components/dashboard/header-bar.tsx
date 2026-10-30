"use client";

import { useEffect, useRef, useState } from "react";

export function HeaderBar({
  dateLabel,
  openCases,
  quarterDays,
  connected,
  userName,
  userEmail,
  onSignOut,
}: {
  dateLabel: string;
  openCases: number;
  quarterDays: number;
  connected: boolean;
  userName?: string;
  userEmail?: string;
  onSignOut?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [open]);

  const statusClass = connected ? "text-emerald-700" : "text-red-600";

  return (
    <header className="mb-6 flex items-start justify-between gap-6">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
          Licence Assurance · EMEA & APJ (Malaysia Time)
        </p>
        <h1 className="mt-1 text-[30px] font-extrabold leading-none tracking-tight text-slate-950">Command Centre</h1>
        <p className="mt-2 text-[13px] text-slate-500" suppressHydrationWarning>
          {dateLabel} · {openCases} open {openCases === 1 ? "case" : "cases"} ·{" "}
          <span className="font-bold text-slate-800">{quarterDays} days to quarter end</span>
        </p>
      </div>

      <div className="relative pt-1" ref={menuRef}>
        {onSignOut ? (
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className={`inline-flex items-center gap-2 text-[13px] font-medium ${statusClass}`}
          >
            <span className={`h-2 w-2 rounded-full ${connected ? "bg-emerald-600" : "bg-red-600"}`} />
            {connected ? "Ingestion Live" : "Ingestion Offline"}
          </button>
        ) : (
          <div className={`inline-flex items-center gap-2 text-[13px] font-medium ${statusClass}`}>
            <span className={`h-2 w-2 rounded-full ${connected ? "bg-emerald-600" : "bg-red-600"}`} />
            {connected ? "Ingestion Live" : "Ingestion Offline"}
          </div>
        )}

        {open && onSignOut && (
          <div className="absolute right-0 z-30 mt-2 w-60 rounded-lg border border-slate-200 bg-white p-3 text-left shadow-lg">
            <p className="text-xs font-bold text-slate-900">{userName || "Signed in"}</p>
            {userEmail && <p className="mt-0.5 truncate text-[11px] text-slate-500">{userEmail}</p>}
            <button
              type="button"
              onClick={onSignOut}
              className="mt-3 w-full rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-800"
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
