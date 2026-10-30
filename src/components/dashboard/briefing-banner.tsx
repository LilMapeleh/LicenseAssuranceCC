import { Sparkles } from "lucide-react";
import type { CaseItem } from "@/lib/types";
import { checkIsOverdue } from "@/lib/case-utils";

export function BriefingBanner({ cases }: { cases: CaseItem[] }) {
  const overdue = cases.filter(checkIsOverdue);
  const legal = cases.filter((item) => item.stage === "Legal / Escalation");
  const legalNames = legal.map((item) => item.customerName).join(", ");

  return (
    <section className="mb-6 rounded-xl border border-[#c9f0d6] bg-[#f3fbf6] px-6 py-4">
      <div className="mb-1.5 flex items-center gap-2 text-sm font-extrabold text-[#166534]">
        <Sparkles className="h-4 w-4" strokeWidth={2.25} />
        AI Intelligence Briefing & Focus for Today
      </div>
      <div className="space-y-1 text-[13px] leading-relaxed text-[#17803d]">
        <p>
          <span className="font-bold text-[#166534]">Priority Focus:</span> You currently have{" "}
          <span className="font-bold">{overdue.length} overdue item(s)</span> requiring immediate attention
          {legalNames ? (
            <>
              , with active legal/escalation reviews for <em>{legalNames}</em>
            </>
          ) : null}
          .
        </p>
        <p>
          <span className="font-bold text-[#166534]">Recent Pipeline Activity:</span> {legal.length} case(s) currently
          require oversight in Legal / Escalation. Ensure pending reviews and contract terms are cleared before
          quarter-end.
        </p>
      </div>
    </section>
  );
}
