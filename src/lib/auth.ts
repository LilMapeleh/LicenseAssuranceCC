import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { betterAuth } from "better-auth";
import { hasRequiredAppRole, REQUIRED_APP_ROLE, roleList } from "@/lib/server/app-role";

const dataDirectory = path.join(process.cwd(), "data");
fs.mkdirSync(dataDirectory, { recursive: true });

const grantedRoles = new Map<string, string>();

function profileEmail(profile: Record<string, unknown> | undefined, fallback?: string | null): string {
  const candidates = [profile?.email, profile?.preferred_username, profile?.upn, fallback];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim().toLowerCase();
  }
  return "";
}

export const auth = betterAuth({
  database: new Database(path.join(dataDirectory, "auth.sqlite")),
  trustedOrigins: process.env.BETTER_AUTH_URL ? [process.env.BETTER_AUTH_URL] : undefined,
  user: {
    additionalFields: {
      entraRoles: {
        type: "string",
        required: false,
        defaultValue: "[]",
        input: false,
        returned: true,
      },
    },
    validateUserInfo: async (data, context) => {
      const oauth = data.source.oauth;
      if (data.source.method !== "oauth" || oauth?.providerId !== "microsoft") {
        return { error: "unsupported_sign_in", errorDescription: "Sign in with Microsoft Entra ID." };
      }

      const roles = roleList(oauth.profile?.roles);
      const email = profileEmail(oauth.profile, typeof data.user.email === "string" ? data.user.email : "");
      const allowed = hasRequiredAppRole(roles);

      if (!allowed) {
        if (data.source.action !== "create-user" && data.user.id) {
          await context.context.internalAdapter.updateUser(data.user.id, { entraRoles: JSON.stringify(roles) });
          await context.context.internalAdapter.deleteUserSessions(data.user.id);
        }
        return {
          error: "missing_app_role",
          errorDescription: `The ${REQUIRED_APP_ROLE} app role is required to use this app.`,
        };
      }

      if (email) grantedRoles.set(email, JSON.stringify(roles));
      if (data.source.action !== "create-user" && data.user.id) {
        await context.context.internalAdapter.updateUser(data.user.id, { entraRoles: JSON.stringify(roles) });
      }
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          const email = user.email.toLowerCase();
          const roles = grantedRoles.get(email);
          grantedRoles.delete(email);
          if (!roles || !hasRequiredAppRole(roles)) return false;
          return { data: { entraRoles: roles } };
        },
      },
    },
  },
  socialProviders: {
    microsoft: {
      clientId: process.env.MICROSOFT_CLIENT_ID as string,
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET as string,
      tenantId: process.env.MICROSOFT_TENANT_ID,
      prompt: "select_account",
      disableProfilePhoto: true,
      mapProfileToUser: (profile) => {
        const email = profile.email || profile.preferred_username || profile.upn || "";
        return {
          email,
          name: profile.name || email,
          image: "",
        };
      },
    },
  },
});

let schemaReady: Promise<void> | null = null;

export function ensureAuthSchema() {
  schemaReady ??= auth.$context.then(async (ctx) => {
    await ctx.runMigrations();
  });
  return schemaReady;
}
