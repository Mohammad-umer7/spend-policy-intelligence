"use client";

import { useState } from "react";

/**
 * Runs `apply` once each time `key` changes, during render rather than in an
 * effect.
 *
 * This is React's documented pattern for adjusting state when an input
 * changes: setting state during render re-runs the component immediately,
 * before anything is painted, instead of causing the extra commit-then-render
 * cascade an effect would produce. It is what we want for deep links — the
 * first paint already reflects the URL.
 */
export function useAppliedOnce(key: string, apply: () => void): void {
  const [applied, setApplied] = useState<string | null>(null);
  if (applied !== key) {
    setApplied(key);
    apply();
  }
}
