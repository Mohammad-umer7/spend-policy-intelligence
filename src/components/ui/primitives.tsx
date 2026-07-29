"use client";

import { forwardRef, type ButtonHTMLAttributes, type HTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { RiskLevel, Verdict } from "@/lib/types";

/* ── Panels ────────────────────────────────────────────────────────────── */

type PanelProps = HTMLAttributes<HTMLDivElement> & {
  /** Glass is for chrome and summaries; solid is for anything read closely. */
  variant?: "glass" | "solid" | "raised";
};

export function Panel({ variant = "solid", className, ...props }: PanelProps) {
  return (
    <div
      className={cn(
        variant === "glass" && "glass",
        variant === "solid" && "panel",
        variant === "raised" && "panel-raised",
        className,
      )}
      {...props}
    />
  );
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
    <div className={cn("flex items-start justify-between gap-4", className)}>
      <div className="min-w-0">
        <h2 className="text-[0.95rem] font-semibold tracking-tight text-mist-50">{title}</h2>
        {hint ? <p className="mt-1 text-xs leading-relaxed text-mist-400">{hint}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

/* ── Buttons ───────────────────────────────────────────────────────────── */

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "success";
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
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors",
        "disabled:cursor-not-allowed disabled:opacity-45",
        size === "sm" ? "h-8 px-3 text-xs" : "h-9 px-3.5 text-[0.8125rem]",
        variant === "primary" &&
          "bg-gradient-to-r from-accent-600 to-info-500 text-white shadow-[0_6px_18px_-8px_rgb(79_70_229/0.9)] hover:from-accent-500 hover:to-info-400",
        variant === "secondary" &&
          "border border-white/12 bg-white/5 text-mist-100 hover:border-white/22 hover:bg-white/8",
        variant === "ghost" && "text-mist-300 hover:bg-white/6 hover:text-mist-50",
        variant === "danger" &&
          "border border-escalate-500/35 bg-escalate-500/12 text-escalate-400 hover:bg-escalate-500/20",
        variant === "success" &&
          "border border-pass-500/35 bg-pass-500/12 text-pass-400 hover:bg-pass-500/20",
        className,
      )}
      {...props}
    />
  );
});

/* ── Badges ────────────────────────────────────────────────────────────── */

const verdictStyles: Record<Verdict, string> = {
  pass: "border-pass-500/30 bg-pass-500/12 text-pass-400",
  flag: "border-flag-500/30 bg-flag-500/12 text-flag-400",
  escalate: "border-escalate-500/30 bg-escalate-500/12 text-escalate-400",
};

const riskStyles: Record<RiskLevel, string> = {
  low: "border-white/12 bg-white/5 text-mist-300",
  medium: "border-flag-500/30 bg-flag-500/10 text-flag-400",
  high: "border-escalate-500/30 bg-escalate-500/12 text-escalate-400",
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
        "inline-flex items-center rounded-md border font-semibold uppercase tracking-wide",
        size === "sm" ? "px-2 py-0.5 text-[0.6875rem]" : "px-3 py-1 text-xs",
        verdictStyles[verdict],
        className,
      )}
    >
      {label}
    </span>
  );
}

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
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-[0.6875rem] font-medium",
        riskStyles[risk],
        className,
      )}
    >
      {label}
    </span>
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
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[0.6875rem] font-medium",
        tone === "neutral" && "border-white/10 bg-white/4 text-mist-300",
        tone === "info" && "border-info-500/25 bg-info-500/10 text-info-400",
        tone === "warn" && "border-flag-500/25 bg-flag-500/10 text-flag-400",
        tone === "danger" && "border-escalate-500/25 bg-escalate-500/10 text-escalate-400",
        tone === "good" && "border-pass-500/25 bg-pass-500/10 text-pass-400",
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
      <dt className="text-[0.6875rem] uppercase tracking-wide text-mist-500">{label}</dt>
      <dd
        className={cn(
          "mt-1 truncate text-sm text-mist-100",
          mono && "numeric font-mono text-[0.8125rem]",
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
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-white/8", className)}>
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-700 ease-out",
          tone === "accent" && "bg-gradient-to-r from-accent-500 to-info-400",
          tone === "good" && "bg-pass-500",
          tone === "warn" && "bg-flag-500",
          tone === "danger" && "bg-escalate-500",
        )}
        style={{ width: `${clamped * 100}%` }}
      />
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon?: ReactNode;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      {icon ? <div className="text-mist-500">{icon}</div> : null}
      <p className="text-sm font-medium text-mist-100">{title}</p>
      <p className="max-w-sm text-xs leading-relaxed text-mist-400">{body}</p>
      {action}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-white/6", className)} />;
}

/** Small inline help affordance; native title keeps it accessible and cheap. */
export function InfoHint({ text }: { text: string }) {
  return (
    <span
      title={text}
      aria-label={text}
      tabIndex={0}
      className="inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-white/15 text-[0.5625rem] font-semibold text-mist-400"
    >
      ?
    </span>
  );
}
