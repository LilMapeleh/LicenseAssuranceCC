import type { ButtonHTMLAttributes, ReactNode } from "react";

export function PillButton({
  active = false,
  children,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-1.5 rounded-md border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
        active
          ? "border-[#0f766e] bg-[#0f766e] text-white"
          : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
      } ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function SolidButton({
  children,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-1.5 rounded-md bg-[#0f766e] px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#115e59] disabled:cursor-wait disabled:opacity-70 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-[#e6ebf2] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] ${className}`}>
      {children}
    </section>
  );
}
