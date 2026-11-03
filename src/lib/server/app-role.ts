export const REQUIRED_APP_ROLE = process.env.ENTRA_REQUIRED_APP_ROLE?.trim() || "User";

export function roleList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => roleList(item));
  }
  if (typeof value !== "string" || !value.trim()) return [];
  const text = value.trim();
  if (text.startsWith("[")) {
    try {
      return roleList(JSON.parse(text) as unknown);
    } catch {
      return [];
    }
  }
  return [text];
}

export function hasRequiredAppRole(value: unknown): boolean {
  return roleList(value).includes(REQUIRED_APP_ROLE);
}

export function entraRolesOf(user: object): unknown {
  return "entraRoles" in user ? user.entraRoles : undefined;
}
