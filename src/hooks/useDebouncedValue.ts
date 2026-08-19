import { useEffect, useState } from "react";

/**
 * Returns `value` after it has stayed unchanged for `delay` ms.
 * Used to keep fast typing from re-filtering large lists on every keystroke.
 */
export function useDebouncedValue<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    if (Object.is(value, debounced)) return;
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay, debounced]);

  return debounced;
}
