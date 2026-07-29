"use client";

import { useEffect } from "react";
import { AlertOctagon } from "lucide-react";

/**
 * Route-level error boundary. Kept free of store hooks so it still renders if
 * the failure came from state.
 */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Route error:", error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-2xl border border-white/10 bg-[#0d1226] px-6 py-14 text-center">
      <AlertOctagon className="h-6 w-6 text-escalate-400" />
      <p className="text-sm font-medium text-mist-100">Something went wrong</p>
      <p className="max-w-sm text-xs leading-relaxed text-mist-400">
        This screen failed to render. Reloading usually clears it.
      </p>
      {error.digest ? (
        <p className="font-mono text-[0.625rem] text-mist-600">{error.digest}</p>
      ) : null}
      <button
        onClick={reset}
        className="mt-1 rounded-lg border border-white/12 bg-white/5 px-3.5 py-2 text-[0.8125rem] text-mist-100 transition-colors hover:border-white/25 hover:bg-white/8"
      >
        Try again
      </button>
    </div>
  );
}
