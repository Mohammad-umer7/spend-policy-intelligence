"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { animate, useReducedMotion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { Panel } from "@/components/ui/primitives";

/**
 * Counts a value up on first paint. Values are formatted through the same
 * helpers as the rest of the app so the animated figure always lands on the
 * exact number the ledger reports.
 */
export function AnimatedNumber({
  value,
  format,
  className,
}: {
  value: number;
  format: (value: number) => string;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();
  if (reduceMotion) {
    return <span className={cn("numeric", className)}>{format(value)}</span>;
  }
  return <CountingNumber value={value} format={format} className={className} />;
}

/** Split out so the motion path never runs when motion is reduced. */
function CountingNumber({
  value,
  format,
  className,
}: {
  value: number;
  format: (value: number) => string;
  className?: string;
}) {
  const [display, setDisplay] = useState(value);
  const previous = useRef(value);

  useEffect(() => {
    const controls = animate(previous.current, value, {
      duration: 0.85,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (latest) => setDisplay(latest),
      onComplete: () => setDisplay(value),
    });
    previous.current = value;
    return () => controls.stop();
  }, [value]);

  return <span className={cn("numeric", className)}>{format(display)}</span>;
}

export interface StatTileProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: LucideIcon;
  tone?: "neutral" | "good" | "warn" | "danger" | "info";
  /** Making a tile a link is what turns an insight into a next step. */
  href?: string;
  footer?: ReactNode;
}

const toneRing: Record<NonNullable<StatTileProps["tone"]>, string> = {
  neutral: "text-mist-400",
  good: "text-pass-400",
  warn: "text-flag-400",
  danger: "text-escalate-400",
  info: "text-info-400",
};

export function StatTile({
  label,
  value,
  hint,
  icon: Icon,
  tone = "neutral",
  href,
  footer,
}: StatTileProps) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[0.6875rem] uppercase tracking-wide text-mist-500">{label}</p>
        {Icon ? <Icon className={cn("h-3.5 w-3.5 shrink-0", toneRing[tone])} /> : null}
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-mist-50">{value}</p>
      {hint ? <p className="mt-1 text-xs leading-relaxed text-mist-400">{hint}</p> : null}
      {footer ? <div className="mt-3">{footer}</div> : null}
      {href ? (
        <ArrowUpRight className="absolute end-3 bottom-3 h-3.5 w-3.5 text-mist-600 opacity-0 transition-opacity group-hover:opacity-100" />
      ) : null}
    </>
  );

  if (href) {
    return (
      <Link href={href} className="group">
        <Panel variant="glass" className="elevate relative h-full px-4 py-3.5">
          {body}
        </Panel>
      </Link>
    );
  }

  return (
    <Panel variant="glass" className="relative h-full px-4 py-3.5">
      {body}
    </Panel>
  );
}
