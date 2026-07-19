import { useEffect, useState } from "react";

/**
 * useState variant that persists to sessionStorage so navigation
 * (e.g. leaving a list page to view a detail and coming back) preserves
 * filters, pagination and sort without adding search-param plumbing.
 */
export function usePersistentState<T>(key: string, initial: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [state, setState] = useState<T>(() => {
    if (typeof window === "undefined") return initial;
    try {
      const raw = window.sessionStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.sessionStorage.setItem(key, JSON.stringify(state));
    } catch {
      /* ignore quota / serialization errors */
    }
  }, [key, state]);

  return [state, setState];
}
