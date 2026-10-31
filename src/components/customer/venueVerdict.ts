/**
 * The top bar's one health verdict, from the venue's shared issue list
 * (`venueIssues.ts`). Pure and import-light so it can be tested directly.
 */
import type {
  AttentionItem,
  NeedsAttentionState,
} from "@/components/customer/dashboard/needsAttentionModel";
import type { ConsoleStatus } from "@/components/customer/console/StatusDot";

export type VenueIssuesSource =
  /** The Dashboard's full list: routers, alerts, devices, internet lines... */
  | "full"
  /** Router liveness only -- nothing else has been checked on this page. */
  | "routers";

export interface VenueIssues extends NeedsAttentionState {
  source: VenueIssuesSource;
  /** When the list was computed; `null` for a router snapshot of unknown age. */
  checkedAt: number | null;
}

export type VerdictLabel =
  | { key: "allNormal" }
  | { key: "routersCheckingIn" }
  | { key: "checking" }
  | { key: "notAllChecked" }
  | { key: "needAttention"; count: number }
  | { key: "single"; item: AttentionItem }
  | { key: "liveness" };

export interface VenueVerdict {
  status: ConsoleStatus;
  label: VerdictLabel;
}

/**
 * The pill's one verdict, from the issue list. Pure; exported for tests.
 *
 * "All systems normal" needs the FULL list, with every source that may be
 * asked having answered and nothing on it. A router-only list can say no
 * more than "Routers checking in". Anything on the list -- any source, any
 * severity -- turns the pill, and the count is the list's length, so it is
 * the same number the Needs-attention card shows.
 */
export function venueVerdict(issues: VenueIssues): VenueVerdict {
  const { items } = issues;
  if (items.length > 0) {
    const status: ConsoleStatus = items.some((i) => i.severity === "error")
      ? "crit"
      : items.some((i) => i.severity === "warning")
        ? "warn"
        : "info";
    return {
      status,
      label:
        items.length === 1
          ? { key: "single", item: items[0] }
          : { key: "needAttention", count: items.length },
    };
  }
  const routersChecked = issues.checked.includes("routers");
  if (issues.source === "routers") {
    return routersChecked
      ? { status: "ok", label: { key: "routersCheckingIn" } }
      : { status: "offline", label: { key: "liveness" } };
  }
  if (issues.unchecked.length > 0) return { status: "offline", label: { key: "notAllChecked" } };
  if (issues.pending.length > 0) return { status: "offline", label: { key: "checking" } };
  if (!routersChecked) return { status: "offline", label: { key: "liveness" } };
  return { status: "ok", label: { key: "allNormal" } };
}
