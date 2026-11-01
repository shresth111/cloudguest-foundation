/** QUEUED-RENEWAL pure helpers. */

export const QUEUE_STATUS_LABEL: Record<string, string> = {
  pending: "Queued",
  active: "Started",
  cancelled: "Cancelled",
};

export function queueTone(status: string): string {
  return status === "active" ? "active" : status === "pending" ? "pending" : "offline";
}

/** A key of 8-64 chars, one per dialog, so a retry never bills twice. */
export function queueKey(): string {
  const c = globalThis.crypto as Crypto | undefined;
  const r = c?.randomUUID
    ? c.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  return `queue-${r}`.slice(0, 64);
}

/** The plan can only be queued while today's is still running. */
export function canQueue(validUntil: string | null, now: number = Date.now()): boolean {
  return !!validUntil && Date.parse(validUntil) > now;
}

/** Cancelling a paid queued renewal voids its receipt first. */
export function cancelNeedsVoid(inv: { paid_paise: number } | null): boolean {
  return !!inv && inv.paid_paise > 0;
}
