"use client";

import { QueueClient } from "@/components/queue/queue-client";

/*
  No Suspense boundary: the deep-link query string is read after mount by
  useQueryParams, so nothing here suspends and the page prerenders whole.
*/
export default function QueuePage() {
  return <QueueClient />;
}
