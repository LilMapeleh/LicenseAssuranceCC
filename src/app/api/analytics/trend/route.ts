import { resolutionTrend } from "@/lib/server/case-service";
import { json, options } from "@/lib/server/http";
import { requireAppUser } from "@/lib/server/session";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return options();
}

export async function GET() {
  const denied = await requireAppUser();
  if (denied) return denied;
  return json(await resolutionTrend());
}
