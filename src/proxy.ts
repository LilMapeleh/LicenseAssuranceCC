import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { auth, ensureAuthSchema } from "@/lib/auth";
import { entraRolesOf, hasRequiredAppRole } from "@/lib/server/app-role";

const publicApi = [/^\/api\/auth(?:\/|$)/, /^\/api\/ingest(?:\/|$)/];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (publicApi.some((pattern) => pattern.test(pathname))) return NextResponse.next();

  await ensureAuthSchema();
  const session = await auth.api.getSession({ headers: await headers() });
  const allowed = Boolean(session && hasRequiredAppRole(entraRolesOf(session.user)));

  if (pathname.startsWith("/api/")) {
    if (!allowed) return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
    return NextResponse.next();
  }

  if (!allowed && pathname !== "/") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
