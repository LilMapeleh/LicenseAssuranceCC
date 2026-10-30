import { KANBAN_STAGES, RUNWAY_BUCKETS, RUNWAY_LABELS, calculateColumnBucket, checkIsOverdue } from "@/lib/case-utils";
import type { CaseItem } from "@/lib/types";
import { Panel } from "@/components/dashboard/ui";

export function CloseRunway({
  cases,
  movedOn,
  overdue,
  confidenceSet,
}: {
  cases: CaseItem[];
  movedOn: number;
  overdue: number;
  confidenceSet: number;
}) {
  return (
    <Panel className="mb-6 p-6">
      <div className="mb-5 flex items-start justify-between gap-6">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight text-slate-950">Close runway</h2>
          <p className="mt-0.5 text-[13px] text-slate-500">Where every open case sits against its own next-action deadline.</p>
        </div>
        <div className="flex gap-8 text-center">
          <Stat label="Moved on" value={movedOn} valueClass="text-[#0f766e]" />
          <Stat label="Overdue" value={overdue} valueClass="text-red-600" />
          <Stat label="Confidence set" value={`${confidenceSet}/${cases.length}`} valueClass="text-slate-950" />
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-100 bg-[#fafafa] px-5 pt-4 pb-3">
        <div
          className="grid items-center border-b border-slate-200 pb-3 text-center text-[11px] font-semibold text-slate-500"
          style={{ gridTemplateColumns: "148px repeat(7, minmax(0, 1fr)) 92px" }}
        >
          <div />
          {RUNWAY_LABELS.map((label) => (
            <div key={label} className={label === "TODAY" ? "font-extrabold text-[#0f766e]" : ""}>
              {label}
            </div>
          ))}
        </div>

        <div className="pt-2">
          {KANBAN_STAGES.map((stage) => (
            <div
              key={stage}
              className="grid h-11 items-center"
              style={{ gridTemplateColumns: "148px repeat(7, minmax(0, 1fr)) 92px" }}
            >
              <div className="text-left text-xs font-bold text-slate-800">{stage}</div>
              {RUNWAY_BUCKETS.map((bucket) => {
                const dots = cases.filter((item) => item.stage === stage && calculateColumnBucket(item.daysOffset) === bucket);
                return (
                  <div key={bucket} className="relative flex h-full items-center justify-center gap-1">
                    {bucket === 0 && <span className="absolute inset-y-0 left-1/2 w-[2px] -translate-x-1/2 bg-[#0f766e]" />}
                    {bucket === 30 && <span className="absolute inset-y-0 left-0 border-l border-dashed border-slate-300" />}
                    {dots.map((dot) => {
                      const late = checkIsOverdue(dot);
                      const noDate = dot.daysOffset === 30;
                      return (
                        <span
                          key={dot.id}
                          title={`${dot.customerName} (${dot.dueDateText || "No date"})`}
                          className={`relative z-10 h-3 w-3 rounded-full shadow-sm ${dot.isActionOnMe ? "ring-2 ring-slate-950 ring-offset-1" : ""}`}
                          style={{ backgroundColor: late ? "#dc2626" : noDate ? "#475569" : "#0f766e" }}
                        />
                      );
                    })}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <div className="mt-2 flex justify-between px-1 text-[11px] font-semibold text-slate-400">
          <span>Slipped</span>
          <span>Room to work</span>
        </div>
      </div>
    </Panel>
  );
}

function Stat({ label, value, valueClass }: { label: string; value: string | number; valueClass: string }) {
  return (
    <div>
      <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`text-2xl font-extrabold leading-tight ${valueClass}`}>{value}</div>
    </div>
  );
}
