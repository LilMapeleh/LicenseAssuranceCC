"use client";

import { getCaseTitleColor } from "@/lib/case-utils";
import type { CaseItem } from "@/lib/types";

function sourceLabel(source?: string): string | null {
  const value = (source || "").trim().toLowerCase();
  if (value === "email" || value === "outlook") return "Outlook";
  if (value === "teams") return "Teams";
  return source?.trim() || null;
}

export function CaseDrawer({
  item,
  saving,
  onChange,
  onClose,
  onSave,
}: {
  item: CaseItem;
  saving: boolean;
  onChange: (next: CaseItem) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const history = item.email_history || [];
  const sources = Array.from(new Set(history.map((entry) => entry.source || "Email")));
  const historyLabel =
    history.length === 0 ? "Communication History (0)" : `${sources.join(" / ")} Thread History (${history.length})`;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/40" onClick={onClose}>
      <aside
        className="flex h-full w-[480px] max-w-full flex-col gap-5 overflow-y-auto bg-white p-6 shadow-[-4px_0_16px_rgba(15,23,42,0.15)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-slate-200 pb-4">
          <div>
            <h3 className="text-lg font-extrabold" style={{ color: getCaseTitleColor(item) }}>
              {item.customerName}
            </h3>
            <p className="text-xs text-slate-500">Stage: {item.stage}</p>
          </div>
          <button type="button" onClick={onClose} className="text-xl leading-none text-slate-500" aria-label="Close">
            ×
          </button>
        </div>

        <label className="block text-xs font-bold text-slate-700">
          Status Summary
          <textarea
            value={item.status || ""}
            onChange={(event) => onChange({ ...item, status: event.target.value })}
            className="mt-1.5 h-20 w-full rounded-md border border-slate-300 p-2 text-xs font-normal"
          />
        </label>

        <label className="block text-xs font-bold text-slate-700">
          Next Step Action
          <input
            value={item.nextStep || ""}
            onChange={(event) => onChange({ ...item, nextStep: event.target.value })}
            className="mt-1.5 w-full rounded-md border border-slate-300 p-2 text-xs font-normal"
          />
        </label>

        <label className="block text-xs font-bold text-slate-700">
          Strategic Approach
          <input
            value={item.approach || ""}
            onChange={(event) => onChange({ ...item, approach: event.target.value })}
            className="mt-1.5 w-full rounded-md border border-slate-300 p-2 text-xs font-normal"
          />
        </label>

        <label className="block text-xs font-bold text-slate-700">
          Evidence Summary (Email / Teams context)
          <textarea
            value={item.evidenceSummary || ""}
            onChange={(event) => onChange({ ...item, evidenceSummary: event.target.value })}
            className="mt-1.5 h-20 w-full rounded-md border border-slate-300 p-2 text-xs font-normal"
          />
        </label>

        <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
          <input
            type="checkbox"
            checked={item.isActionOnMe ?? false}
            onChange={(event) => onChange({ ...item, isActionOnMe: event.target.checked })}
          />
          Mark as &quot;Action on me&quot;
        </label>

        <div className="border-t border-slate-200 pt-4">
          <p className="mb-2 text-xs font-bold text-slate-700">{historyLabel}</p>
          <div className="max-h-64 space-y-2 overflow-y-auto rounded-md border border-slate-200 bg-slate-50 p-2.5">
            {history.length > 0 ? (
              history.map((email, index) => (
                <div key={email.message_id || index} className="rounded-md border border-slate-300 bg-white p-2.5 text-[11px]">
                  <div className="mb-1 flex justify-between gap-3 font-bold text-slate-950">
                    <span>{email.sender}</span>
                    <span className="shrink-0 text-right text-[10px] font-medium text-slate-500">
                      {sourceLabel(email.source) && (
                        <span className="mr-1.5 font-bold text-slate-700">{sourceLabel(email.source)}</span>
                      )}
                      {new Date(email.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <p className="mb-1 font-semibold text-slate-600">{email.subject}</p>
                  <p className="whitespace-pre-wrap leading-snug text-slate-700">{email.body}</p>
                </div>
              ))
            ) : (
              <p className="py-3 text-center text-[11px] text-slate-500">No email history recorded for this case yet.</p>
            )}
          </div>
        </div>

        {(item.salesforce_data || item.oppID) && (
          <div className="rounded-lg border border-green-200 bg-green-50 p-3.5">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-extrabold text-green-800">Salesforce Opportunity Update</span>
              {item.oppID && (
                <a
                  href={`https://sitecore.lightning.force.com/lightning/r/Opportunity/${item.oppID}/view`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] font-bold text-blue-600"
                >
                  View in SF ↗
                </a>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px] text-green-700">
              <div>
                <span className="block text-slate-500">Stage:</span>
                {item.salesforce_data?.StageName || item.salesforce_data?.status || "Active"}
              </div>
              <div>
                <span className="block text-slate-500">Opportunity ID:</span>
                <strong className="text-slate-950">{item.oppID}</strong>
              </div>
              {item.salesforce_data?.Amount != null && (
                <div className="col-span-2">
                  <span className="block text-slate-500">Amount:</span>
                  <strong className="text-slate-950">{String(item.salesforce_data.Amount)}</strong>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="mt-auto flex justify-end gap-3 border-t border-slate-200 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="rounded-md bg-[#0f766e] px-4 py-2 text-xs font-semibold text-white disabled:opacity-70"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </aside>
    </div>
  );
}
