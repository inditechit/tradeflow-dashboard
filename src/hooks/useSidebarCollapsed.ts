import { useCallback, useState } from "react";

/** Persist sidebar collapsed/expanded preference in localStorage. */
export function useSidebarCollapsed(storageKey: string) {
  const [collapsed, setCollapsedState] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem(storageKey) === "1";
    } catch {
      return false;
    }
  });

  const setCollapsed = useCallback(
    (next: boolean) => {
      setCollapsedState(next);
      try {
        window.localStorage.setItem(storageKey, next ? "1" : "0");
      } catch {
        // ignore quota / private mode
      }
    },
    [storageKey],
  );

  const toggleCollapsed = useCallback(() => {
    setCollapsedState((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(storageKey, next ? "1" : "0");
      } catch {
        // ignore
      }
      return next;
    });
  }, [storageKey]);

  return { collapsed, setCollapsed, toggleCollapsed };
}
