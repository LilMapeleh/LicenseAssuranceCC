import { headers } from "next/headers";
import { auth, ensureAuthSchema } from "@/lib/auth";
import { entraRolesOf, hasRequiredAppRole } from "@/lib/server/app-role";
import { json } from "@/lib/server/http";

export async function requireAppUser() {
  await ensureAuthSchema();
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || !hasRequiredAppRole(entraRolesOf(session.user))) {
    return json({ detail: "Unauthorized" }, 401);
  }
  return null;
}
