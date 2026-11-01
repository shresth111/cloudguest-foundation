/** BE-HARDEN "Sync now" helpers (pure). */

/** The toast text for a sync result. */
export function syncToast(applied: number): string {
  if (applied === 0) return "Up to date: no new coupon sign-ins to add.";
  return applied === 1 ? "Synced 1 subscriber." : `Synced ${applied} subscribers.`;
}
