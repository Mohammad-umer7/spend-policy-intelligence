"use client";

import { Suspense } from "react";
import { AuditClient } from "@/components/audit/audit-client";
import { Skeleton } from "@/components/ui/primitives";

export default function AuditPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-[30rem] w-full" />
        </div>
      }
    >
      <AuditClient />
    </Suspense>
  );
}
