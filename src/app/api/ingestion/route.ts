import { API_BASE } from "@/lib/api";

export async function GET() {
  try {
    const response = await fetch(`${API_BASE}/api/cases`, { cache: "no-store" });
    const body = await response.text();
    if (response.ok) return Response.json({ state: "live" });
    if (/web app is stopped/i.test(body)) return Response.json({ state: "stopped" });
    return Response.json({ state: "offline", status: response.status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    if (/stopped|403/i.test(message)) return Response.json({ state: "stopped" });
    return Response.json({ state: "offline" });
  }
}
