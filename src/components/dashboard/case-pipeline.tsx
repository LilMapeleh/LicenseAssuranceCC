"use client";

import { KANBAN_STAGES, getCaseTitleColor, getNextResponsibility, isMovedOn } from "@/lib/case-utils";
import type { CaseItem, PipelineTab } from "@/lib/types";
import { PillButton } from "@/components/dashboard/ui";

const TABS: PipelineTab[] = ["Moved on", "Needs me today", "Action on me", "All open"];
const CONFIDENCE = ["Not set", "Commit", "Best case", "Pipeline", "At risk"];

export function CasePipeline({
  cases,
  activeTab,
  onTabChange,
  searchQuery,
  onSearchChange,
  selectedCaseId,
  onToggleDraft,
  onOpenCase,
  onConfidenceChange,
  draggedCaseId,
  onDragStart,
  onDropStage,
}: {
  cases: CaseItem[];
  activeTab: PipelineTab;
  onTabChange: (tab: PipelineTab) => void;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  selectedCaseId: string | null;
  onToggleDraft: (id: string) => void;
  onOpenCase: (item: CaseItem) => void;
  onConfidenceChange: (id: string, value: string) => void;
  draggedCaseId: string | null;
  onDragStart: (id: string) => void;
  onDropStage: (stage: string, caseId: string) => void;
}) {
  return (
    <section className="mb-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-bold text-slate-950">Case Pipeline</h2>
          <input
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search account, owner..."
            className="w-52 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800 outline-none placeholder:text-slate-400 focus:border-[#0f766e]"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {TABS.map((tab) => (
            <PillButton key={tab} active={activeTab === tab} onClick={() => onTabChange(tab)}>
              {tab}
            </PillButton>
          ))}
        </div>
      </div>

      <div className="pipeline-scroll flex gap-4 overflow-x-auto pb-4">
        {KANBAN_STAGES.map((stage) => {
          const stageCases = cases.filter((item) => item.stage === stage);
          return (
            <div
              key={stage}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                const caseId = event.dataTransfer.getData("text/plain") || draggedCaseId || "";
                if (caseId) onDropStage(stage, caseId);
              }}
              className="flex min-h-[540px] w-[280px] shrink-0 flex-col rounded-xl bg-[#f3f6fa] p-4"
            >
              <div className="mb-3 flex items-center justify-between border-b border-slate-200/80 pb-2.5">
                <span className="text-[13px] font-bold text-slate-700">{stage}</span>
                <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-slate-500">{stageCases.length}</span>
              </div>
              <div className="flex flex-1 flex-col gap-3">
                {stageCases.map((item) => (
                  <CaseCard
                    key={item.id}
                    item={item}
                    selected={selectedCaseId === item.id}
                    dragging={draggedCaseId === item.id}
                    onToggleDraft={() => onToggleDraft(item.id)}
                    onOpen={() => onOpenCase(item)}
                    onConfidenceChange={(value) => onConfidenceChange(item.id, value)}
                    onDragStart={() => onDragStart(item.id)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function CaseCard({
  item,
  selected,
  dragging,
  onToggleDraft,
  onOpen,
  onConfidenceChange,
  onDragStart,
}: {
  item: CaseItem;
  selected: boolean;
  dragging: boolean;
  onToggleDraft: () => void;
  onOpen: () => void;
  onConfidenceChange: (value: string) => void;
  onDragStart: () => void;
}) {
  const responsibility = getNextResponsibility(item);
  const mine = responsibility === "Andrew";
  const salesforceStage = item.salesforce_data?.StageName;
  const latestActivity = item.email_history?.[item.email_history.length - 1];

  return (
    <article
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData("text/plain", item.id);
        event.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onClick={onOpen}
      className={`cursor-pointer rounded-lg border bg-white p-3.5 shadow-[0_1px_3px_rgba(15,23,42,0.05)] ${
        selected ? "border-2 border-[#0f766e]" : "border-slate-200"
      } ${dragging ? "opacity-50" : ""}`}
    >
      <div
        onClick={(event) => {
          event.stopPropagation();
          onToggleDraft();
        }}
        className={`mb-2 flex cursor-pointer items-center gap-2 rounded px-2 py-1 ${
          selected ? "border border-[#0f766e] bg-[#e6f4f1]" : "border border-slate-200 bg-slate-50"
        }`}
      >
        <input type="checkbox" readOnly checked={selected} className="h-3.5 w-3.5 accent-[#0f766e]" />
        <span className={`text-[11px] font-bold ${selected ? "text-[#0f766e]" : "text-slate-500"}`}>
          {selected ? "✓ Selected for Draft" : "Select for Draft"}
        </span>
      </div>

      <div className="mb-1.5 flex items-start justify-between gap-2">
        <h3 className="text-sm font-extrabold" style={{ color: getCaseTitleColor(item) }}>
          {item.customerName}
        </h3>
        {item.dealValue && (
          <span className="shrink-0 rounded bg-[#0f766e] px-1.5 py-0.5 text-[10px] font-bold text-white">{item.dealValue}</span>
        )}
      </div>

      {item.category && <p className="mb-1 text-[10px] font-semibold uppercase text-slate-500">{item.category}</p>}

      {item.dueDateText && item.dueDateText !== "New" && (
        <p className="mb-2 text-[11px] font-semibold text-slate-500">{item.dueDateText}</p>
      )}

      <div className="mb-2.5 text-xs leading-snug text-slate-700">
        <p>
          <strong>Next:</strong> {item.nextStep}
        </p>
        <p className="text-slate-500">{item.status}</p>
      </div>

      <div className="flex items-start justify-between gap-2 border-t border-slate-100 pt-2">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] text-slate-400">Owner: {item.owner}</span>
          {latestActivity?.source && (
            <span className="w-fit rounded-full border border-slate-300 bg-white px-1.5 py-0.5 text-[9px] font-bold text-slate-600">
              {latestActivity.source}
            </span>
          )}
          {salesforceStage && salesforceStage !== item.stage && (
            <span className="w-fit rounded-full border border-green-200 bg-green-50 px-1.5 py-0.5 text-[9px] font-bold text-green-800">
              SF: {salesforceStage}
            </span>
          )}
          {isMovedOn(item) && (
            <span className="w-fit rounded-full border border-slate-300 bg-white px-1.5 py-0.5 text-[9px] font-bold text-slate-700">
              Moved on
            </span>
          )}
          <span
            className={`w-fit rounded-full border px-1.5 py-0.5 text-[9px] font-bold ${
              mine ? "border-green-200 bg-green-50 text-[#0f766e]" : "border-slate-300 bg-slate-100 text-slate-600"
            }`}
          >
            {mine ? "Action on me" : `Action on ${responsibility}`}
          </span>
        </div>
        <select
          value={item.closeConfidence || "Not set"}
          onClick={(event) => event.stopPropagation()}
          onChange={(event) => onConfidenceChange(event.target.value)}
          className="rounded border border-slate-300 bg-white px-1 py-0.5 text-[10px]"
        >
          {CONFIDENCE.map((option) => (
            <option key={option}>{option}</option>
          ))}
        </select>
      </div>
    </article>
  );
}
