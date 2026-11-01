/** Non-component exports split out of `InsightCard.tsx` so that file
 * only exports components (react-refresh/only-export-components). */
import { INSIGHT_PRIMARY } from "./InsightCard";

/** `INSIGHT_PRIMARY` at `alpha` (0-1) over transparent. */
export function primaryAt(alpha: number): string {
  return `color-mix(in srgb, ${INSIGHT_PRIMARY} ${Math.round(alpha * 100)}%, transparent)`;
}
