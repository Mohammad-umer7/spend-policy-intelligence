"use client";

import { useMemo, useSyncExternalStore } from "react";

/**
 * Reads the deep-link query string without suspending.
 *
 * `useSearchParams()` forces the calling component under a `<Suspense>`
 * boundary, and a boundary whose child suspends during hydration proved
 * fragile: a suspended render is discarded, so anything derived from the URL
 * has to survive being thrown away and retried.
 *
 * The browser URL is an external store, so it is read as one. The server
 * snapshot is empty, which keeps the server render and the first client render
 * identical; React then re-renders with the real query string immediately after
 * hydration. No boundary, no effect, no set-state-during-render.
 *
 * Callers treat the result as the *base* for their filter state and layer user
 * interaction on top, so there is nothing to synchronise in either direction.
 */

function subscribe(onChange: () => void): () => void {
  window.addEventListener("popstate", onChange);
  return () => window.removeEventListener("popstate", onChange);
}

const EMPTY = "";

export function useQueryParams(): URLSearchParams {
  const search = useSyncExternalStore(
    subscribe,
    () => window.location.search,
    () => EMPTY,
  );
  return useMemo(() => new URLSearchParams(search), [search]);
}
