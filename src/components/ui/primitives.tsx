"use client";

import { forwardRef, type ButtonHTMLAttributes, type HTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { RiskLevel, Verdict } from "@/lib/types";

/* ── Surfaces ──────────────────────────────────────────────────────────── */

export function Panel({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("panel", className)} {...props} />;
}

export function SectionHeading({
  title,
  hint,
  action,
  className,
}: {
  title: ReactNode;
  hint?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-baseline justify-between gap-4", className)}>
      <div className="min-w-0">
        <h2 className="text-[0.8125rem] font-semibold tracking-tight text-ink-900">{title}</h2>
        {hint ? <p className="mt-0.5 text-xs text-ink-500">{hint}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

/* ── Buttons ───────────────────────────────────────────────────────────── */

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md";
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", className, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-[0.1875rem] font-medium transition-colors",
        "disabled:cursor-not-allowed disabled:opacity-40",
        size === "sm" ? "h-7 px-2.5 text-xs" : "h-8 px-3 text-[0.8125rem]",
        variant === "primary" && "bg-accent-600 text-white hover:bg-accent-700",
        variant === "secondary" &&
          "border border-[--hairline-strong] bg-white text-ink-800 hover:bg-ink-50",
        variant === "ghost" && "text-ink-600 hover:bg-ink-100 hover:text-ink-900",
        className,
      )}
      {...props}
    />
  );
});

/* ── Status ────────────────────────────────────────────────────────────── */

/*
  Status is carried by a text label first. The dot is a secondary cue and never
  appears on its own, so the information survives greyscale printing and any
  form of colour blindness.
*/

const verdictText: Record<Verdict, string> = {
  pass: "text-pass-700",
  flag: "text-flag-700",
  escalate: "text-escalate-700",
};

const verdictDot: Record<Verdict, string> = {
  pass: "bg-pass-600",
  flag: "bg-flag-600",
  escalate: "bg-escalate-600",
};

export function VerdictBadge({
  verdict,
  label,
  size = "sm",
  className,
}: {
  verdict: Verdict;
  label: string;
  size?: "sm" | "lg";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 font-semibold uppercase tracking-wide",
        size === "sm" ? "text-[0.6875rem]" : "text-xs",
        verdictText[verdict],
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", verdictDot[verdict])} />
      {label}
    </span>
  );
}

const riskText: Record<RiskLevel, string> = {
  low: "text-ink-600",
  medium: "text-flag-700",
  high: "text-escalate-700",
};

export function RiskBadge({
  risk,
  label,
  className,
}: {
  risk: RiskLevel;
  label: string;
  className?: string;
}) {
  return (
    <span className={cn("text-[0.75rem] font-medium", riskText[risk], className)}>{label}</span>
  );
}

export function Chip({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: "neutral" | "info" | "warn" | "danger" | "good";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-[0.1875rem] border px-1.5 py-0.5 text-[0.6875rem] font-medium",
        tone === "neutral" && "border-ink-200 bg-ink-50 text-ink-700",
        tone === "info" && "border-accent-500/25 bg-accent-50 text-accent-700",
        tone === "warn" && "border-flag-600/25 bg-flag-50 text-flag-700",
        tone === "danger" && "border-escalate-600/25 bg-escalate-50 text-escalate-700",
        tone === "good" && "border-pass-600/25 bg-pass-50 text-pass-700",
        className,
      )}
    >
      {children}
    </span>
  );
}

/* ── Data display ──────────────────────────────────────────────────────── */

export function Field({
  label,
  value,
  mono,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  mono?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <dt className="label">{label}</dt>
      <dd
        className={cn(
          "mt-0.5 truncate text-[0.8125rem] text-ink-900",
          mono && "numeric font-mono text-xs",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

/** Horizontal budget/utilisation meter. */
export function Meter({
  value,
  tone = "accent",
  className,
}: {
  /** 0–1; values above 1 render as a full bar with an over-budget tone. */
  value: number;
  tone?: "accent" | "warn" | "danger" | "good";
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(1, value));
  return (
    <div className={cn("h-1 w-full overflow-hidden rounded-full bg-ink-200", className)}>
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-500 ease-out",
          tone === "accent" && "bg-accent-600",
          tone === "good" && "bg-pass-600",
          tone === "warn" && "bg-flag-600",
          tone === "danger" && "bg-escalate-600",
        )}
        style={{ width: `${clamped * 100}%` }}
      />
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-[0.1875rem] bg-ink-100", className)} />;
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      <p className="text-[0.8125rem] font-medium text-ink-800">{title}</p>
      <p className="max-w-sm text-xs leading-relaxed text-ink-500">{body}</p>
      {action}
    </div>
  );
}
