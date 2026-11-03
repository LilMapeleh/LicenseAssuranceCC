"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export function SignIn({
  requiredRole,
  configured,
  error,
  description,
}: {
  requiredRole: string;
  configured: boolean;
  error?: string;
  description?: string;
}) {
  const [pending, setPending] = useState(false);
  const [localError, setLocalError] = useState("");
  const message = localError || signInMessage(requiredRole, error, description);
  const setupMessage =
    "Microsoft Entra ID is not configured yet. Add MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET, and MICROSOFT_TENANT_ID to .env, then restart the app.";

  async function startSignIn() {
    if (!configured) return;
    setPending(true);
    setLocalError("");
    try {
      const result = await authClient.signIn.social({
        provider: "microsoft",
        callbackURL: "/",
        errorCallbackURL: "/",
      });
      if (result.error) {
        setLocalError(result.error.message || "Microsoft sign-in could not be started.");
        setPending(false);
      }
    } catch (caught) {
      setLocalError(caught instanceof Error ? caught.message : "Microsoft sign-in could not be started.");
      setPending(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f6f8fb] px-6 text-slate-950">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white px-8 py-9 shadow-sm">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Licence Assurance</p>
        <h1 className="mt-2 text-[28px] font-extrabold tracking-tight">Command Centre</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Sign in with your Microsoft Entra ID account. Access is limited to people assigned the {requiredRole} app role.
        </p>
        {!configured && <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">{setupMessage}</p>}
        {message && <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{message}</p>}
        <button
          type="button"
          disabled={pending}
          onClick={() => void startSignIn()}
          className="mt-6 w-full cursor-pointer rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-70"
        >
          {pending ? "Redirecting to Microsoft…" : "Sign in with Microsoft"}
        </button>
      </section>
    </main>
  );
}

function signInMessage(requiredRole: string, error?: string, description?: string) {
  if (error === "missing_app_role") {
    return description || `The ${requiredRole} app role is required to use this app.`;
  }
  if (!error) return "";
  return description || "Microsoft sign-in could not be completed.";
}
