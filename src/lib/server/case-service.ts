import { broadcast, readCases, withCases, type CaseRecord } from "@/lib/server/case-store";

const MONTHS: Record<string, number> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

export interface IngestPayload {
  account_name?: string | null;
  source: string;
  sender: string;
  owner?: string | null;
  subject?: string | null;
  message_body?: string | null;
  timestamp?: string | null;
  financial_tag?: string | null;
  due_tag?: string | null;
  sub_header?: string | null;
  status_text?: string | null;
  next_step?: string | null;
  approach?: string | null;
  stage?: string | null;
  days_offset?: number | null;
  is_action_on_me?: boolean | null;
  oppID?: string | null;
}

export interface CaseUpdate {
  status?: string | null;
  next_step?: string | null;
  approach?: string | null;
  evidence?: string | null;
  close_confidence?: string | null;
  is_action_on_me?: boolean | null;
}

export function calculateDaysOffset(dueTag?: string | null, daysOffsetParam?: number | null): number {
  if (daysOffsetParam !== undefined && daysOffsetParam !== null) return daysOffsetParam;
  if (!dueTag) return 30;

  const lateMatch = dueTag.match(/(\d+)\s*d?\s*late/i);
  if (lateMatch) return -Number(lateMatch[1]);

  const clean = dueTag.replace(/Sept\b/i, "Sep").trim();
  const named = clean.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  const iso = clean.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  let parsed: Date | null = null;

  if (named) {
    const month = MONTHS[named[2].toLowerCase().slice(0, 3)];
    if (month !== undefined) parsed = new Date(Number(named[3]), month, Number(named[1]));
  } else if (iso) {
    parsed = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  }

  if (!parsed || Number.isNaN(parsed.getTime())) return 30;
  const today = new Date();
  return Math.round((parsed.getTime() - today.getTime()) / 86_400_000);
}

const STAGE_SIGNALS: { stage: string; words: string[] }[] = [
  { stage: "Legal / Escalation", words: ["legal", "procurement", "escalation", "approval", "novation", "contract review"] },
  { stage: "Propose & Commit", words: ["proposal", "commit", "quote", "pricing"] },
  { stage: "Contract to Close", words: ["signing", "signature", "closing", "final execution"] },
  { stage: "Differentiate", words: ["rebuttal", "review", "negotiation", "counter"] },
  { stage: "Discover", words: ["discover", "assessment", "audit", "overage check"] },
];

function stageFromText(text: string): string | null {
  const value = text.toLowerCase();
  if (!value.trim()) return null;
  for (const signal of STAGE_SIGNALS) {
    if (signal.words.some((word) => value.includes(word))) return signal.stage;
  }
  return null;
}

export function inferStageFromCase(item: CaseRecord): string {
  const history = item.email_history ?? [];
  const chunks: string[] = [];
  const newest = history[history.length - 1];
  if (newest) chunks.push(`${newest.subject || ""} ${newest.body || ""}`);
  chunks.push(`${item.status || ""} ${item.approach || ""} ${item.next_step || ""} ${item.sub_header || ""}`);
  for (let index = history.length - 2; index >= 0; index -= 1) {
    const message = history[index];
    chunks.push(`${message.subject || ""} ${message.body || ""}`);
  }

  for (const chunk of chunks) {
    const stage = stageFromText(chunk);
    if (stage) return stage;
  }
  return item.stage || "Qualify";
}

function stamp(item: CaseRecord): CaseRecord {
  const stage = inferStageFromCase(item);
  const daysOffset = calculateDaysOffset(item.due_tag, item.days_offset);
  return { ...item, stage, stage_locked: false, days_offset: daysOffset, _ts: item._ts || Math.floor(Date.now() / 1000) };
}

export async function listCases() {
  return withCases(async (cases) => {
    const next = cases.map((item) => {
      const stage = inferStageFromCase(item);
      const daysOffset = calculateDaysOffset(item.due_tag, item.days_offset);
      if (item.stage === stage && item.days_offset === daysOffset && !item.stage_locked) return item;
      return { ...item, stage, stage_locked: false, days_offset: daysOffset };
    });
    next.sort((a, b) => (b._ts ?? 0) - (a._ts ?? 0));
    return { cases: next, result: next };
  });
}

export async function updateStage(caseId: string, stage: string) {
  return withCases(async (cases) => {
    const index = cases.findIndex((item) => item.id === caseId);
    if (index === -1) return { cases, result: null };
    cases[index] = { ...cases[index], stage, stage_locked: true, _ts: Math.floor(Date.now() / 1000) };
    const updated = cases[index];
    return { cases, result: updated };
  });
}

export async function updateDetails(caseId: string, payload: CaseUpdate) {
  return withCases(async (cases) => {
    const index = cases.findIndex((item) => item.id === caseId);
    if (index === -1) return { cases, result: null };
    const current = { ...cases[index] };
    if (payload.status !== undefined && payload.status !== null) current.status = payload.status;
    if (payload.next_step !== undefined && payload.next_step !== null) current.next_step = payload.next_step;
    if (payload.approach !== undefined && payload.approach !== null) current.approach = payload.approach;
    if (payload.evidence !== undefined && payload.evidence !== null) current.evidence = payload.evidence;
    if (payload.close_confidence !== undefined && payload.close_confidence !== null) current.close_confidence = payload.close_confidence;
    if (payload.is_action_on_me !== undefined && payload.is_action_on_me !== null) current.is_action_on_me = payload.is_action_on_me;
    const stamped = stamp(current);
    stamped._ts = Math.floor(Date.now() / 1000);
    cases[index] = stamped;
    return { cases, result: stamped };
  });
}

export async function refreshSalesforce(caseId: string) {
  const cases = await readCases();
  const current = cases.find((item) => item.id === caseId);
  if (!current) return { missing: true as const };
  if (!current.oppID) return { missing: false as const, skipped: true as const, salesforce_data: null };

  const lookupUrl = process.env.SALESFORCE_LOOKUP_URL;
  let salesforceData: Record<string, unknown> | null = null;
  if (lookupUrl) {
    try {
      const response = await fetch(lookupUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opportunityID: current.oppID }),
      });
      if (response.ok) {
        const raw = (await response.json()) as Record<string, unknown>;
        const body = (raw.body as Record<string, unknown> | undefined) ?? raw;
        const value = body.value;
        salesforceData = Array.isArray(value) && value[0] && typeof value[0] === "object" ? (value[0] as Record<string, unknown>) : body;
      }
    } catch (error) {
      console.error("Salesforce lookup failed", error);
    }
  }

  if (!salesforceData) return { missing: false as const, skipped: false as const, salesforce_data: null };

  const saved = await withCases(async (items) => {
    const index = items.findIndex((item) => item.id === caseId);
    if (index === -1) return { cases: items, result: null };
    const stageName = typeof salesforceData?.StageName === "string" ? salesforceData.StageName : undefined;
    items[index] = {
      ...items[index],
      salesforce_data: salesforceData,
      ...(stageName ? { salesforce_stage: stageName } : {}),
      _ts: Math.floor(Date.now() / 1000),
    };
    return { cases: items, result: items[index] };
  });

  return { missing: false as const, skipped: false as const, salesforce_data: saved?.salesforce_data ?? salesforceData, stage: saved?.stage };
}

function asText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (!value || typeof value !== "object") return "";

  const record = value as Record<string, unknown>;
  const emailAddress = record.emailAddress;
  if (emailAddress && typeof emailAddress === "object") {
    const mail = emailAddress as Record<string, unknown>;
    const name = asText(mail.name);
    const address = asText(mail.address);
    if (name && address) return `${name} <${address}>`;
    return name || address;
  }
  return asText(record.displayName) || asText(record.name) || asText(record.address) || asText(record.email);
}

function asOffset(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
}

export function normalizeIngestBody(body: Record<string, unknown>): IngestPayload {
  const timestamp = asText(body.timestamp);
  return {
    account_name: asText(body.account_name ?? body.accountName),
    source: asText(body.source) || "Email",
    sender: asText(body.sender),
    owner: asText(body.owner) || null,
    subject: asText(body.subject),
    message_body: asText(body.message_body ?? body.messageBody),
    timestamp: timestamp || null,
    financial_tag: asText(body.financial_tag ?? body.forecastBadge) || null,
    due_tag: asText(body.due_tag ?? body.statusTag) || null,
    sub_header: asText(body.sub_header ?? body.issueCategory) || null,
    status_text: asText(body.status_text ?? body.statusDescription) || null,
    next_step: asText(body.next_step ?? body.nextStep) || null,
    approach: asText(body.approach) || null,
    stage: asText(body.stage) || null,
    days_offset: asOffset(body.days_offset),
    is_action_on_me: typeof body.is_action_on_me === "boolean" ? body.is_action_on_me : null,
    oppID: asText(body.oppID ?? body.oppId) || null,
  };
}

export async function ingestCase(payload: IngestPayload) {
  const rawName = (payload.account_name || "").trim();
  if (!rawName || rawName.toLowerCase() === "unknown account") {
    return { status: "ignored" as const, reason: "Missing or unknown account name." };
  }

  const normalized = rawName.replace(/\s*\(.*?\)/g, "").trim().toLowerCase();
  const calculatedOffset = calculateDaysOffset(payload.due_tag, payload.days_offset);
  const sender = payload.sender || "Unknown";
  const senderLower = sender.toLowerCase();
  const isService = senderLower.includes("automation_service") || senderLower.includes("service");
  const determinedOwner = payload.owner || (isService ? "Unassigned" : sender);
  const salesforceData = await lookupSalesforce(payload.oppID);
  const receivedAt = payload.timestamp || new Date().toISOString();

  const email = {
    message_id: `msg-${crypto.randomUUID().slice(0, 8)}`,
    timestamp: receivedAt,
    sender,
    subject: payload.subject || payload.status_text || "New activity",
    body: payload.message_body || "",
    source: payload.source || "Email",
  };

  return withCases<{ status: "updated"; case_id: string; data: CaseRecord } | { status: "created"; data: CaseRecord }>(
    async (cases) => {
    const index = cases.findIndex((item) => item.account_name.toLowerCase().includes(normalized));
    if (index !== -1) {
      const existing = { ...cases[index] };
      existing.status = payload.status_text || payload.message_body || existing.status;
      existing.next_step = payload.next_step || existing.next_step;
      existing.approach = payload.approach || existing.approach;
      existing.financial_tag = payload.financial_tag || existing.financial_tag;
      existing.due_tag = payload.due_tag || existing.due_tag;
      existing.sub_header = payload.sub_header || existing.sub_header;
      if (payload.oppID) existing.oppID = payload.oppID;
      if (salesforceData) existing.salesforce_data = salesforceData;
      const owner = existing.owner || "Unassigned";
      if (owner === "Unassigned" || owner.toLowerCase().includes("automation_service")) existing.owner = determinedOwner;
      existing.evidence = `Latest update via ${email.source} (${sender}, ${receivedAt})`;
      existing.email_history = [...(existing.email_history || []), email];
      existing.days_offset = calculatedOffset;
      const stamped = stamp({ ...existing, days_offset: calculatedOffset });
      stamped._ts = Math.floor(Date.now() / 1000);
      cases[index] = stamped;
      return { cases, result: { status: "updated" as const, case_id: stamped.id, data: stamped } };
    }

    const created = stamp({
      id: `case-${crypto.randomUUID().slice(0, 8)}`,
      account_name: rawName,
      financial_tag: payload.financial_tag,
      due_tag: payload.due_tag,
      sub_header: payload.sub_header || `Ingested via ${payload.source}`,
      status: payload.status_text || payload.message_body,
      next_step: payload.next_step || "Review incoming communication details.",
      approach: payload.approach || "Requires Triage",
      evidence: `${email.source}, ${sender}, ${receivedAt}`,
      stage: payload.stage || "Qualify",
      days_offset: calculatedOffset,
      is_action_on_me: payload.is_action_on_me ?? true,
      owner: determinedOwner,
      oppID: payload.oppID,
      salesforce_data: salesforceData,
      email_history: [email],
      _ts: Math.floor(Date.now() / 1000),
    });
    cases.unshift(created);
    return { cases, result: { status: "created" as const, data: created } };
  });
}

async function lookupSalesforce(oppId?: string | null) {
  if (!oppId || !process.env.SALESFORCE_LOOKUP_URL) return null;
  try {
    const response = await fetch(process.env.SALESFORCE_LOOKUP_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ opportunityID: oppId }),
    });
    if (!response.ok) return null;
    return (await response.json()) as Record<string, unknown>;
  } catch (error) {
    console.error("Salesforce lookup failed", error);
    return null;
  }
}

export async function resetCases() {
  await withCases(async () => ({ cases: [], result: true }));
  broadcast({ event: "DATABASE_RESET" });
}

export async function resolutionTrend() {
  const items = await readCases();
  const now = new Date();
  const points = [];
  for (let i = 4; i >= 0; i -= 1) {
    const date = new Date(now);
    date.setDate(now.getDate() - i * 7);
    const label = i === 0 ? "Today" : date.toLocaleDateString("en-US", { month: "short", day: "2-digit" });
    const cutoff = Math.floor(date.getTime() / 1000);
    points.push({
      date: label,
      created: items.filter((item) => (item._ts ?? 0) <= cutoff).length,
      resolved: items.filter((item) => (item._ts ?? 0) <= cutoff && item.stage === "Contract to Close").length,
    });
  }
  return points;
}

export async function resolutionTime() {
  const items = await readCases();
  const resolved = items.filter((item) => item.stage === "Contract to Close");
  if (resolved.length === 0) return { avg_days: 0, change_pct: 0, timeframe: "vs. previous period" };
  const now = Date.now() / 1000;
  const total = resolved.reduce((sum, item) => sum + (now - (item._ts ?? now)), 0);
  return {
    avg_days: Math.round((total / resolved.length / 86400) * 10) / 10,
    change_pct: 0,
    timeframe: "vs. previous period",
  };
}

export function publishNewCase(data: CaseRecord) {
  broadcast({ event: "NEW_CASE_ENTRY", data });
}

export function publishStage(caseId: string, stage: string) {
  broadcast({ event: "STAGE_UPDATE", id: caseId, stage });
}

export function publishDetails(caseId: string, item: CaseRecord) {
  broadcast({
    event: "CASE_DETAILS_UPDATE",
    id: caseId,
    account_name: item.account_name,
    data: {
      closeConfidence: item.close_confidence,
      status: item.status,
      nextStep: item.next_step,
      approach: item.approach,
      stage: item.stage,
      isActionOnMe: item.is_action_on_me,
      dealValue: item.financial_tag,
      dueDateText: item.due_tag,
      category: item.sub_header,
      daysOffset: item.days_offset,
      evidenceSummary: item.evidence,
      owner: item.owner,
      oppID: item.oppID,
      salesforce_data: item.salesforce_data,
    },
  });
}
