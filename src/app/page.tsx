import { headers } from "next/headers";
import { SignIn } from "@/components/auth/sign-in";
import { CommandCentre } from "@/components/dashboard/command-centre";
import { auth, ensureAuthSchema } from "@/lib/auth";
import { entraRolesOf, hasRequiredAppRole, REQUIRED_APP_ROLE } from "@/lib/server/app-role";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; error_description?: string }>;
}) {
  await ensureAuthSchema();
  const session = await auth.api.getSession({ headers: await headers() });
  const params = await searchParams;
  if (!session || !hasRequiredAppRole(entraRolesOf(session.user))) {
    const configured = Boolean(
      process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET && process.env.MICROSOFT_TENANT_ID,
    );
    return (
      <SignIn
        requiredRole={REQUIRED_APP_ROLE}
        configured={configured}
        error={params.error}
        description={params.error_description}
      />
    );
  }

  return <CommandCentre userName={session.user.name} userEmail={session.user.email} />;
}
