/**
 * BULKBAR (founder-approved UX proposal #3): the rules for the subscriber
 * directory's bulk bar, kept pure so scripts/test-isp-partner-leftovers.mjs
 * can pin them.
 *
 *  - No bar until at least one row is ticked.
 *  - "All matching the filters" is a second, explicit step, offered only
 *    once the whole page is ticked and more subscribers match than are ticked.
 *  - Every action runs its dry run first; Block and Move above
 *    TYPED_CONFIRM_ABOVE eligible subscribers also need the count (or the
 *    action word) typed in.
 */
export type BulkAction = "renew" | "block" | "unblock" | "freeze" | "unfreeze" | "move";
export type BulkScope = "selected" | "filter";

/** Above this many eligible subscribers, Block / Move need a typed confirm. */
export const TYPED_CONFIRM_ABOVE = 10;

/** Actions that take service away or bill / move people: dry run + confirm. */
export const DESTRUCTIVE_ACTIONS: readonly BulkAction[] = ["block", "freeze", "move", "renew"];

export function bulkBarVisible(selectedCount: number): boolean {
  return selectedCount > 0;
}

/** Step 2 is offered only after step 1 (the whole page ticked). */
export function canOfferSelectAllMatching(o: {
  scope: BulkScope;
  allOnPage: boolean;
  selectedCount: number;
  total: number | undefined;
}): boolean {
  return (
    o.scope === "selected" &&
    o.allOnPage &&
    o.selectedCount > 0 &&
    o.total !== undefined &&
    o.total > o.selectedCount
  );
}

/** Scope after a "select all matching" click: only from a fully ticked page. */
export function scopeAfterSelectAllMatching(o: {
  scope: BulkScope;
  allOnPage: boolean;
  selectedCount: number;
  total: number | undefined;
}): BulkScope {
  return canOfferSelectAllMatching(o) ? "filter" : o.scope;
}

export function needsTypedConfirm(action: BulkAction, eligible: number): boolean {
  return (action === "block" || action === "move") && eligible > TYPED_CONFIRM_ABOVE;
}

/** The typed confirm accepts the eligible count or the action word (any case). */
export function typedConfirmOk(action: BulkAction, eligible: number, typed: string): boolean {
  const t = typed.trim().replace(/,/g, "");
  return t === String(eligible) || t.toUpperCase() === action.toUpperCase();
}

/** Can the apply button be pressed? Needs a dry run with someone eligible. */
export function canApply(
  action: BulkAction,
  preview: { eligible: number } | null,
  typed: string,
): boolean {
  if (!preview || preview.eligible === 0) return false;
  if (needsTypedConfirm(action, preview.eligible))
    return typedConfirmOk(action, preview.eligible, typed);
  return true;
}
