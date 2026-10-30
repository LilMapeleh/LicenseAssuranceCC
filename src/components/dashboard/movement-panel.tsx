import { RefreshCw } from "lucide-react";
import { formatMovementTime } from "@/lib/case-utils";
import type { MovementGroup } from "@/lib/types";
import { Panel, SolidButton } from "@/components/dashboard/ui";

const LOOKBACKS = [
  { value: 1, label: "Since yesterday" },
  { value: 3, label: "3 days" },
  { value: 7, label: "7 days" },
  { value: 14, label: "14 days" },
];

export function MovementPanel({
  groups,
  lookbackDays,
  onLookbackChange,
  onRefresh,
  refreshing,
}: {
  groups: MovementGroup[];
  lookbackDays: number;
  onLookbackChange: (days: number) => void;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  const totalItems = groups.reduce((sum, group) => sum + group.items.length, 0);
  const dayLabel = lookbackDays === 1 ? "1 day" : `${lookbackDays} days`;

  return (
    <Panel className="mb-8 p-6">
      <div className="mb-3 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-extrabold text-slate-950">Check for movement</h2>
          <p className="mt-1 text-xs text-slate-500">
            Pulls your recent mail, Teams chats and calendar, matches it against open cases.
          </p>
        </div>
        <div className="flex items-end gap-3">
          <label className="flex flex-col items-end gap-1">
            <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Look back</span>
            <select
              value={lookbackDays}
              onChange={(event) => onLookbackChange(Number(event.target.value))}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-900"
            >
              {LOOKBACKS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <SolidButton onClick={onRefresh} disabled={refreshing}>
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            Refresh now
          </SolidButton>
        </div>
      </div>

      <p className="mb-4 text-xs font-semibold text-slate-500">
        {totalItems} item{totalItems === 1 ? "" : "s"} in the last {dayLabel} · {groups.length} case
        {groups.length === 1 ? "" : "s"} with movement
      </p>

      {groups.length > 0 ? (
        <div className="space-y-3">
          {groups.map((group) => (
            <div key={group.accountName} className="rounded-lg border border-slate-100 bg-[#fafafa] p-4">
              <div className="mb-3 flex items-center gap-2">
                <span className="text-sm font-extrabold text-slate-950">{group.accountName}</span>
                <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                  {group.items.length} item{group.items.length === 1 ? "" : "s"}
                </span>
              </div>
              <div className="space-y-2">
                {group.items.map((item, index) => (
                  <div key={`${item.timestamp}-${index}`} className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded border border-slate-300 bg-white px-1.5 py-0.5 text-[10px] font-bold text-slate-600">
                      {item.source}
                    </span>
                    <span className="font-bold text-slate-950">{item.subject}</span>
                    <span className="text-slate-500">
                      — {item.sender} · {formatMovementTime(item.timestamp)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-slate-200 px-4 py-4 text-center text-xs text-slate-400">
          No email or message movement recorded in the selected look back window.
        </div>
      )}
    </Panel>
  );
}
