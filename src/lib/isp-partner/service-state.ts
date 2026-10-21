/** Labels for a customer's service state (ADDENDUM_01 §A.4). */

export const SERVICE_STATE_LABEL: Record<string, string> = {
  active: "Internet on",
  suspend_pending: "Suspending…",
  suspended: "Internet cut (suspended)",
  resume_pending: "Resuming…",
};

export function serviceTone(state: string): string {
  if (state === "active") return "active";
  if (state === "suspended") return "suspended";
  return "pending";
}
