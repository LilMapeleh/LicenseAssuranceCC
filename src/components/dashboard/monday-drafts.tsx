"use client";

import { Clipboard } from "lucide-react";
import type { Audience } from "@/lib/types";
import { Panel, PillButton, SolidButton } from "@/components/dashboard/ui";

const AUDIENCES: { id: Audience; label: string }[] = [
  { id: "APJ", label: "Darren — APJ" },
  { id: "EMEA", label: "Jason — EMEA" },
  { id: "Tanya", label: "Tanya — one-liners" },
];

export function MondayDrafts({
  audience,
  onAudienceChange,
  draft,
  onBuild,
  onCopy,
}: {
  audience: Audience;
  onAudienceChange: (audience: Audience) => void;
  draft: string;
  onBuild: () => void;
  onCopy: () => void;
}) {
  return (
    <Panel className="p-6">
      <h2 className="mb-4 text-lg font-bold text-slate-950">Monday drafts</h2>
      <div className="mb-4 flex flex-wrap gap-2">
        {AUDIENCES.map((item) => (
          <PillButton key={item.id} active={audience === item.id} onClick={() => onAudienceChange(item.id)}>
            {item.label}
          </PillButton>
        ))}
      </div>
      <div className="mb-3 flex flex-wrap gap-3">
        <SolidButton onClick={onBuild}>Build the draft</SolidButton>
        <PillButton onClick={onCopy} className="py-2">
          <Clipboard className="h-3.5 w-3.5" />
          Copy to clipboard
        </PillButton>
      </div>
      <textarea
        readOnly
        value={draft}
        placeholder={'Tick a case box above and click "Build the draft".'}
        className="h-28 w-full resize-y rounded-md border border-slate-200 bg-[#fafafa] p-3 font-mono text-xs text-slate-700"
      />
    </Panel>
  );
}
