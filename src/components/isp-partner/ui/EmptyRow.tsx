/**
 * UX-PASS: the one empty row for partner tables, so a table never shows a
 * bare header. Three kinds (RESEARCH_PREMIUM_UI_BRIEF §2.6):
 *  - "first-run": nothing exists yet; say what goes here (optional action);
 *  - "no-results": filters hide everything; offer "Clear filters";
 *  - "off": the feature is switched off for this ISP.
 */
import type { ReactNode } from "react";

export function EmptyRow({
  kind = "first-run",
  title,
  hint,
  onClear,
  action,
  colSpan = 99,
}: {
  kind?: "first-run" | "no-results" | "off";
  title?: string;
  hint?: string;
  onClear?: () => void;
  action?: ReactNode;
  colSpan?: number;
}) {
  const heading =
    title ??
    (kind === "no-results"
      ? "Nothing matches these filters"
      : kind === "off"
        ? "Not switched on for your ISP"
        : "Nothing here yet");
  const sub = hint ?? (kind === "off" ? "Ask Wyfy Guest support to switch it on." : undefined);
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-8 text-center">
        <p className="text-sm font-medium text-foreground">{heading}</p>
        {sub && <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">{sub}</p>}
        {(onClear || action) && (
          <div className="mt-3 flex justify-center gap-2">
            {onClear && (
              <button
                type="button"
                onClick={onClear}
                className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Clear filters
              </button>
            )}
            {action}
          </div>
        )}
      </td>
    </tr>
  );
}
