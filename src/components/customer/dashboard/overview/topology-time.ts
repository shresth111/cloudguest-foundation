/** Non-component exports split out of `TopologyMap.tsx` so that file
 * only exports components (react-refresh/only-export-components). */
import { formatRelative } from "@/lib/format";

/** "2 min ago" / "2 मिनट पहले" -- the console's shared formatter. An
 * unparseable value is shown as-is rather than as a dash. */
export function relativeTime(iso: string, lang: string, now = Date.now()): string {
  if (!Number.isFinite(new Date(iso).getTime())) return iso;
  return formatRelative(iso, lang, { now, style: "short" });
}
