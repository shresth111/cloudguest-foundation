import { useEffect, useRef, useState } from "react";

interface Props {
  /** Numeric target. Non-numeric values are rendered as-is. */
  value: number | string;
  /** Duration of the count-up in ms. */
  duration?: number;
  /** Format callback for numeric formatting (currency, %). */
  format?: (n: number) => string;
  className?: string;
}

/**
 * Smoothly counts up to a numeric target. Falls back to the raw
 * string when `value` isn't a number (e.g. "12.4 TB"). Uses rAF
 * for jank-free animation and respects prefers-reduced-motion.
 */
export function AnimatedCounter({ value, duration = 900, format, className }: Props) {
  const [display, setDisplay] = useState<string>(() =>
    typeof value === "number" ? (format ? format(0) : "0") : String(value),
  );
  const raf = useRef<number | null>(null);
  const from = useRef(0);

  useEffect(() => {
    if (typeof value !== "number" || Number.isNaN(value)) {
      setDisplay(String(value));
      return;
    }
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setDisplay(format ? format(value) : value.toLocaleString());
      return;
    }
    const start = performance.now();
    const startVal = from.current;
    const delta = value - startVal;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const cur = startVal + delta * eased;
      setDisplay(format ? format(cur) : Math.round(cur).toLocaleString());
      if (t < 1) raf.current = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [value, duration, format]);

  return <span className={className}>{display}</span>;
}
