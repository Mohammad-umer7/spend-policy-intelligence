"use client";

import { Suspense } from "react";
import { QueueClient } from "@/components/queue/queue-client";
import { Skeleton } from "@/components/ui/primitives";

export default function QueuePage() {
  return (
    <Suspense fallback={<QueueSkeleton />}>
      <QueueClient />
    </Suspense>
  );
}

function QueueSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-7 w-56" />
      <Skeleton className="h-11 w-full" />
      <Skeleton className="h-[28rem] w-full" />
    </div>
  );
}
