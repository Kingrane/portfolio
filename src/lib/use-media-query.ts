"use client";

import { useCallback, useSyncExternalStore } from "react";

/** Browser preferences without a synchronous state update after hydration. */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback((notify: () => void) => {
    const media = window.matchMedia(query);
    media.addEventListener("change", notify);
    return () => media.removeEventListener("change", notify);
  }, [query]);

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}
