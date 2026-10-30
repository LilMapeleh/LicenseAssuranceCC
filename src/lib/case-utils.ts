import type { CaseItem, MovementGroup, RawCase, ResponsibilityType } from "@/lib/types";

export const KANBAN_STAGES = [
  "Qualify",
  "Discover",
  "Differentiate",
  "Legal / Escalation",
  "Propose & Commit",
  "Contract to Close",
] as const;

export const RUNWAY_BUCKETS = [-21, -14, -7, 0, 7, 14, 21, 30] as const;

export const RUNWAY_LABELS = ["21d late", "14d late", "7d late", "TODAY", "+7d", "+14d", "+21d", "No date"];

export function getFormattedDate(): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kuala_Lumpur",
  }).format(new Date());
}

export function getDaysUntilQuarterEnd(): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kuala_Lumpur",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());

  const read = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  const now = new Date(read("year"), read("month") - 1, read("day"), read("hour"), read("minute"), read("second"));
  const quarterEndMonth = Math.floor(now.getMonth() / 3) * 3 + 2;
  const quarterEnd = new Date(now.getFullYear(), quarterEndMonth + 1, 0, 23, 59, 59);
  return Math.max(0, Math.ceil((quarterEnd.getTime() - now.getTime()) / 86_400_000));
}

export function calculateColumnBucket(daysOffset?: number): number {
  if (daysOffset !== undefined && daysOffset !== null) {
    if (daysOffset === 30) return 30;
    if (daysOffset <= -18) return -21;
    if (daysOffset > -18 && daysOffset <= -11) return -14;
    if (daysOffset > -11 && daysOffset <= -3) return -7;
    if (daysOffset > -3 && daysOffset <= 3) return 0;
    if (daysOffset > 3 && daysOffset <= 10) return 7;
    if (daysOffset > 10 && daysOffset <= 18) return 14;
    if (daysOffset > 18) return 21;
  }
  return 30;
}

export function checkIsOverdue(item: CaseItem): boolean {
  if (item.daysOffset !== undefined && item.daysOffset !== null && item.daysOffset < 0) {
    return true;
  }
  const tag = (item.dueDateText || item.statusTag || "").toLowerCase();
  const approach = (item.approach || "").toLowerCase();
  return tag.includes("late") || tag.includes("overdue") || approach.includes("passed") || approach.includes("late");
}

export function isMovedOn(item: CaseItem): boolean {
  const isFutureScheduled = (item.daysOffset ?? 0) > 0 && item.daysOffset !== 30;
  const now = Date.now();
  const hasVeryRecentActivity =
    Array.isArray(item.email_history) &&
    item.email_history.some((email) => {
      if (!email.timestamp) return false;
      return now - new Date(email.timestamp).getTime() <= 86_400_000;
    });
  return isFutureScheduled || hasVeryRecentActivity;
}

export function getNextResponsibility(item: CaseItem): ResponsibilityType {
  const text = `${item.status || ""} ${item.approach || ""} ${item.nextStep || ""} ${item.category || ""}`.toLowerCase();
  const stage = item.stage;

  if (
    stage === "Legal / Escalation" ||
    text.includes("contract review") ||
    text.includes("dispute") ||
    text.includes("msa") ||
    text.includes("amendment review") ||
    text.includes("read access")
  ) {
    return "Legal";
  }

  if (
    text.includes("waiting for customer") ||
    text.includes("provide deployment") ||
    text.includes("usage statistics") ||
    text.includes("customer approval") ||
    text.includes("awaiting client")
  ) {
    return "Client";
  }

  if (
    stage === "Propose & Commit" ||
    stage === "Contract to Close" ||
    text.includes("commercial discussion") ||
    text.includes("settlement") ||
    text.includes("pricing") ||
    text.includes("renewal") ||
    text.includes("offer")
  ) {
    return "Sales";
  }

  return "Andrew";
}

export function getCaseTitleColor(item: CaseItem): string {
  if (checkIsOverdue(item)) return "#dc2626";
  const days = item.daysOffset;
  if (days === 30 || days === undefined || days === null) return "#0f172a";
  if (days >= -9 && days <= -5) return "#d97706";
  if (days > 7) return "#0f766e";
  return "#0f172a";
}

export function mapCase(item: RawCase, index = 0): CaseItem {
  const financial = item.financial_tag;
  const showValue = financial && financial !== "Pending Review" && financial !== "Unknown";
  const stage = item.stage && KANBAN_STAGES.includes(item.stage as (typeof KANBAN_STAGES)[number]) ? item.stage : "Qualify";

  return {
    id: item.id || `case-${index}-${Date.now()}`,
    customerName: item.account_name || "Unknown Account",
    dealValue: showValue ? financial : undefined,
    dueDateText: item.due_tag || "New",
    category: item.sub_header || "General",
    status: item.status || "No status details available.",
    nextStep: item.next_step || "Needs Triage",
    approach: item.approach || "Pending Review",
    evidenceSummary: item.evidence || "",
    closeConfidence: item.close_confidence || item.closeConfidence || "Not set",
    isActionOnMe: item.is_action_on_me ?? true,
    stage,
    daysOffset: item.days_offset !== undefined && item.days_offset !== null ? item.days_offset : 30,
    statusTag: item.due_tag || "New",
    owner: item.owner || "Unassigned",
    email_history: item.email_history || [],
    oppID: item.oppID,
    salesforce_data: item.salesforce_data,
  };
}

export function getMovementData(cases: CaseItem[], lookbackDays: number): MovementGroup[] {
  const cutoff = Date.now() - lookbackDays * 86_400_000;
  const groups: MovementGroup[] = [];

  cases.forEach((item) => {
    if (!item.email_history?.length) return;
    const recent = item.email_history.filter((email) => email.timestamp && new Date(email.timestamp).getTime() >= cutoff);
    if (recent.length === 0) return;
    groups.push({
      accountName: item.customerName,
      items: recent.map((email) => ({
        source: email.source || "Email",
        subject: email.subject || email.body?.slice(0, 50) || "New activity",
        sender: email.sender || "Unknown",
        timestamp: email.timestamp,
      })),
    });
  });

  return groups;
}

export function formatMovementTime(timestamp: string): string {
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) return timestamp;
  const date = parsed.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  const time = parsed.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return `${date}, ${time}`;
}

export function fallbackTrend(caseCount: number, resolved: number) {
  return [
    { date: "Sep 23", created: 0, resolved: 0 },
    { date: "Sep 30", created: 0, resolved: 0 },
    { date: "Oct 07", created: 0, resolved: 0 },
    { date: "Oct 14", created: caseCount, resolved },
    { date: "Today", created: caseCount, resolved },
  ];
}
