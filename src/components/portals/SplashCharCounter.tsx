import { countSplashLength } from "@/lib/splash-limits";

/**
 * Live "42 / 78" counter for the two backend-limited splash fields (see
 * src/lib/splash-limits.ts for the contract). Rendered next to the field's
 * label wherever a venue can type `splash_headline` /
 * `splash_welcome_message` -- the whole point is refusing at authoring time
 * with a visible reason instead of silently truncating at render, so this
 * counts exactly what the backend counts (code points, trimmed) and flips to
 * the destructive tone the moment the value goes over.
 */
export function SplashCharCounter({ value, max }: { value: string; max: number }) {
  const count = countSplashLength(value);
  const over = count > max;
  return (
    <span
      aria-live="polite"
      className={`text-xs tabular-nums ${
        over ? "font-medium text-destructive" : "text-muted-foreground"
      }`}
    >
      {count} / {max}
    </span>
  );
}
