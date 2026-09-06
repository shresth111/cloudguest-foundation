/**
 * What to tell a venue owner after they block somebody, given what the
 * server actually said it did.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * Blocked Guests used to assert `"N numbers blocked."` on any 2xx. That
 * one sentence covered three materially different outcomes and read as
 * the strongest of them:
 *
 *   * the guest was blocked AND taken off the WiFi;
 *   * the guest was blocked and was not online in the first place;
 *   * the guest was blocked and the venue's router could not be reached,
 *     so they are still connected right now.
 *
 * An owner walking across the lobby to tell somebody to leave needs to
 * know which of those they got. The backend already carries the answer on
 * the created rule -- `enforcement_status` and `sessions_ended`
 * (`AccessRuleResponse` in guest_access/schemas.py) -- so no backend work
 * was needed; the dashboard was simply discarding both fields.
 *
 * Lives in `src/lib/` rather than inside the screen so the ladder can be
 * executed for real by `scripts/test-block-users-e164.mjs`. A copy of it
 * in a test would drift from the copy that ships, which is the same class
 * of bug as two normalisers.
 */
import type { AnyAccessRule, GuestAccessRule } from "@/types/guest";

/**
 * Which branch of the ladder applies. Named separately from the copy so a
 * test can assert the decision without pinning the wording, and so the
 * caller could style the toast by severity later.
 */
export type BlockOutcome =
  | "failed"
  | "pending"
  | "sessions-ended"
  | "unenforced"
  | "nobody-online"
  | "unknown";

/**
 * Order matters: the worst TRUE thing is said first. A failure is never
 * summarised away by a sibling success, because the rule that failed is
 * the one somebody is still connected under.
 */
export function blockOutcome(created: readonly AnyAccessRule[]): {
  outcome: BlockOutcome;
  sessionsEnded: number;
} {
  const rules = created.filter((r): r is GuestAccessRule => r.kind === "identifier");
  const statuses = rules.map((r) => r.enforcementStatus);
  // `?? 0` only for summing -- a null count contributes nothing rather
  // than being read as a zero we can quote back.
  const sessionsEnded = rules.reduce((sum, r) => sum + (r.sessionsEnded ?? 0), 0);

  if (statuses.includes("failed")) return { outcome: "failed", sessionsEnded };
  if (statuses.includes("pending")) return { outcome: "pending", sessionsEnded };
  if (sessionsEnded > 0) return { outcome: "sessions-ended", sessionsEnded };
  // The rule is real and future sign-ins are barred, but nothing looked at
  // live sessions. Saying "nobody was online" here would be an inference
  // we did not earn.
  if (statuses.includes("unenforced")) return { outcome: "unenforced", sessionsEnded };
  if (statuses.length > 0 && statuses.every((s) => s === "enforced"))
    return { outcome: "nobody-online", sessionsEnded };
  // An older API omits the fields entirely, and rows written before
  // enforcement existed carry nulls. Claim only the part we can see for
  // ourselves: the rule was created.
  return { outcome: "unknown", sessionsEnded };
}

/**
 * The toast text. `identifierNoun` comes from the screen because the same
 * ladder serves "1 number" and "3 email addresses".
 */
export function blockOutcomeMessage(
  created: readonly AnyAccessRule[],
  identifierNoun: (n: number) => string,
): string {
  const n = created.length;
  const head = `${n} ${identifierNoun(n)} blocked`;
  const { outcome, sessionsEnded } = blockOutcome(created);
  switch (outcome) {
    case "failed":
      return `${head}, but we could not take them off the WiFi — they may still be online. Check the router and try again.`;
    case "pending":
      return `${head}. Ending their current sessions now…`;
    case "sessions-ended":
      return `${head}. ${sessionsEnded} active session${sessionsEnded === 1 ? "" : "s"} ended.`;
    case "unenforced":
      return `${head} — they cannot sign in again. Current sessions were not checked.`;
    case "nobody-online":
      return `${head}. Nobody was online to disconnect.`;
    case "unknown":
      return `${head}.`;
  }
}
