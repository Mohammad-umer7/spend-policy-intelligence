"use client";

import { Suspense } from "react";
import { PolicyClient } from "@/components/policy/policy-client";
import { Skeleton } from "@/components/ui/primitives";

export default function PolicyPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-[26rem] w-full" />
        </div>
      }
    >
      <PolicyClient />
    </Suspense>
  );
}
