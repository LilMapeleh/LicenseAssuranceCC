import { ingestCase, normalizeIngestBody, publishNewCase } from "@/lib/server/case-service";
import { json, options } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return options();
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ detail: "Request body must be JSON." }, 400);
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return json({ detail: "Request body must be a JSON object." }, 400);
  }

  const result = await ingestCase(normalizeIngestBody(body as Record<string, unknown>));
  if (result.status === "ignored") return json(result);
  publishNewCase(result.data);
  return json(result);
}
