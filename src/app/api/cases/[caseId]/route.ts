import { publishDetails, updateDetails } from "@/lib/server/case-service";
import { json, options } from "@/lib/server/http";
import { requireAppUser } from "@/lib/server/session";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return options();
}

export async function PUT(request: Request, context: { params: Promise<{ caseId: string }> }) {
  const denied = await requireAppUser();
  if (denied) return denied;
  const { caseId } = await context.params;
  const payload = (await request.json()) as {
    status?: string;
    next_step?: string;
    approach?: string;
    evidence?: string;
    close_confidence?: string;
    is_action_on_me?: boolean;
  };
  const updated = await updateDetails(caseId, payload);
  if (!updated) return json({ detail: "Case not found" }, 404);
  publishDetails(caseId, updated);
  return json({ status: "success", case_id: caseId, updated_fields: payload, updated_in_db: true });
}
