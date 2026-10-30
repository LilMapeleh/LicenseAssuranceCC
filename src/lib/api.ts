import { mapCase } from "@/lib/case-utils";
import type { CaseItem, RawCase, ResolutionMetrics, SalesforceData, TrendPoint } from "@/lib/types";

export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://lacc-be-bjhdcbesbmbwbkba.westus3-01.azurewebsites.net";

export function dashboardWebSocketUrl(): string {
  const url = new URL(API_BASE);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = "/ws/dashboard";
  url.search = "";
  url.hash = "";
  return url.toString();
}

function authHeaders(token: string | null, json = false): HeadersInit {
  return {
    ...(json ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function fetchCases(token: string | null): Promise<CaseItem[]> {
  const response = await fetch(`${API_BASE}/api/cases`, { headers: authHeaders(token), cache: "no-store" });
  if (!response.ok) throw new Error(`Cases request failed (${response.status})`);
  const raw = (await response.json()) as RawCase[];
  return raw.map((item, index) => mapCase(item, index));
}

export async function fetchTrend(token: string | null, timeframe: string): Promise<TrendPoint[]> {
  const response = await fetch(`${API_BASE}/api/analytics/trend?timeframe=${encodeURIComponent(timeframe)}`, {
    headers: authHeaders(token),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Trend request failed (${response.status})`);
  return (await response.json()) as TrendPoint[];
}

export async function fetchResolution(token: string | null): Promise<ResolutionMetrics> {
  const response = await fetch(`${API_BASE}/api/analytics/resolution-time`, {
    headers: authHeaders(token),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Resolution request failed (${response.status})`);
  return (await response.json()) as ResolutionMetrics;
}

export async function updateCaseStage(token: string | null, caseId: string, stage: string): Promise<void> {
  const response = await fetch(`${API_BASE}/api/cases/${caseId}/stage`, {
    method: "PATCH",
    headers: authHeaders(token, true),
    body: JSON.stringify({ stage }),
  });
  if (!response.ok) throw new Error(`Stage update failed (${response.status})`);
}

export async function updateCaseDetails(
  token: string | null,
  caseId: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const response = await fetch(`${API_BASE}/api/cases/${caseId}`, {
    method: "PUT",
    headers: authHeaders(token, true),
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`Case update failed (${response.status})`);
}

export async function refreshSalesforce(token: string | null, caseId: string): Promise<SalesforceData | null> {
  const response = await fetch(`${API_BASE}/api/cases/${caseId}/salesforce`, {
    method: "POST",
    headers: authHeaders(token),
  });
  if (!response.ok) return null;
  const json = (await response.json()) as { salesforce_data?: SalesforceData };
  return json.salesforce_data ?? null;
}
