import { publishDetails, refreshSalesforce } from "@/lib/server/case-service";
import { readCases } from "@/lib/server/case-store";
import { json, options } from "@/lib/server/http";
import { requireAppUser } from "@/lib/server/session";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return options();
}

export async function POST(_request: Request, context: { params: Promise<{ caseId: string }> }) {
  const denied = await requireAppUser();
  if (denied) return denied;
  const { caseId } = await context.params;
  const result = await refreshSalesforce(caseId);
  if (result.missing) return json({ detail: "Case not found" }, 404);
  if (result.skipped) return json({ status: "skipped", message: "No oppID associated with this case." });
  if (result.salesforce_data) {
    const saved = (await readCases()).find((item) => item.id === caseId);
    if (saved) publishDetails(caseId, saved);
  }
  return json({ status: "success", salesforce_data: result.salesforce_data });
}
