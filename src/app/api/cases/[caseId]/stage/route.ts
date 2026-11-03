import { publishStage, updateStage } from "@/lib/server/case-service";
import { json, options } from "@/lib/server/http";
import { requireAppUser } from "@/lib/server/session";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return options();
}

export async function PATCH(request: Request, context: { params: Promise<{ caseId: string }> }) {
  const denied = await requireAppUser();
  if (denied) return denied;
  const { caseId } = await context.params;
  const payload = (await request.json()) as { stage?: string };
  if (!payload.stage) return json({ detail: "Stage parameter is required" }, 400);
  const updated = await updateStage(caseId, payload.stage);
  if (!updated) return json({ detail: "Case not found" }, 404);
  publishStage(caseId, payload.stage);
  return json({ status: "success", case_id: caseId, stage: payload.stage, updated_in_db: true });
}
