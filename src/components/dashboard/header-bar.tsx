"use client";

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

      <div className="flex items-center gap-3 pt-1">
        <div className={`inline-flex items-center gap-2 text-[13px] font-medium ${statusClass}`}>
          <span className={`h-2 w-2 rounded-full ${connected ? "bg-emerald-600" : "bg-red-600"}`} />
          {connected ? "Ingestion Live" : "Ingestion Offline"}
        </div>
        {onSignOut && (
          <button
            type="button"
            onClick={onSignOut}
            title={userEmail || userName || "Sign out"}
            className="cursor-pointer rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-700 hover:border-slate-300 hover:bg-slate-50"
          >
            Log out
          </button>
        )}
      </div>
    </header>
  );
}
