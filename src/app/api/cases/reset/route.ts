import { resetCases } from "@/lib/server/case-service";
import { json, options } from "@/lib/server/http";
import { requireAppUser } from "@/lib/server/session";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return options();
}

export async function DELETE() {
  const denied = await requireAppUser();
  if (denied) return denied;
  await resetCases();
  return json({ status: "success", message: "All case data deleted." });
}
