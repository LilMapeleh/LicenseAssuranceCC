import { mapCase } from "@/lib/case-utils";
import type { CaseItem, RawCase, ResolutionMetrics, SalesforceData, TrendPoint } from "@/lib/types";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

function requestHeaders(json = false): HeadersInit {
  return json ? { "Content-Type": "application/json" } : {};
}

export async function fetchCases(): Promise<CaseItem[]> {
  const response = await fetch(`${API_BASE}/api/cases`, { headers: requestHeaders(), cache: "no-store" });
  if (!response.ok) throw new Error(`Cases request failed (${response.status})`);
  const raw = (await response.json()) as RawCase[];
  return raw.map((item, index) => mapCase(item, index));
}

export async function fetchTrend(timeframe: string): Promise<TrendPoint[]> {
  const response = await fetch(`${API_BASE}/api/analytics/trend?timeframe=${encodeURIComponent(timeframe)}`, {
    headers: requestHeaders(),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Trend request failed (${response.status})`);
  return (await response.json()) as TrendPoint[];
}

export async function fetchResolution(): Promise<ResolutionMetrics> {
  const response = await fetch(`${API_BASE}/api/analytics/resolution-time`, {
    headers: requestHeaders(),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Resolution request failed (${response.status})`);
  return (await response.json()) as ResolutionMetrics;
}

export async function updateCaseStage(caseId: string, stage: string): Promise<void> {
  const response = await fetch(`${API_BASE}/api/cases/${caseId}/stage`, {
    method: "PATCH",
    headers: requestHeaders(true),
    body: JSON.stringify({ stage }),
  });
  if (!response.ok) throw new Error(`Stage update failed (${response.status})`);
}

export async function updateCaseDetails(caseId: string, payload: Record<string, unknown>): Promise<void> {
  const response = await fetch(`${API_BASE}/api/cases/${caseId}`, {
    method: "PUT",
    headers: requestHeaders(true),
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`Case update failed (${response.status})`);
}

export async function refreshSalesforce(caseId: string): Promise<SalesforceData | null> {
  const response = await fetch(`${API_BASE}/api/cases/${caseId}/salesforce`, {
    method: "POST",
    headers: requestHeaders(),
  });
  if (!response.ok) return null;
  const json = (await response.json()) as { salesforce_data?: SalesforceData };
  return json.salesforce_data ?? null;
}
