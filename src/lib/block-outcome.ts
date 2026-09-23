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
import type { AnyAccessRule, ControllerBlock, GuestAccessRule } from "@/types/guest";

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
  /**
   * True when every access point at this venue is a vendor controller.
   *
   * ONE BRANCH, AND ONLY ON `failed`. At such a venue `_enforce_block` raises
   * on every call -- `get_guest_access_adapter` has exactly one vendor
   * registered and a controller's synthetic router row carries no API
   * credentials -- so the rule always persists with
   * `enforcement_status: "failed"` and `sessions_ended: 0`. The rule itself is
   * real and future sign-ins ARE barred; only the live-session half never
   * happens.
   *
   * The stock sentence ends "Check the router and try again", and both halves
   * of that are wrong here: there is no router to check, and a retry cannot
   * succeed. Sending an owner to inspect hardware that is behaving correctly,
   * every time they block somebody, is worse than saying nothing. So this
   * branch says what is true and what to expect, and claims no more than the
   * other five do.
   *
   * Optional and defaulting to `false`, so every existing caller and every
   * assertion in `scripts/test-block-users-e164.mjs` is untouched.
   */
  controllerManagedVenue = false,
): string {
  const n = created.length;
  const head = `${n} ${identifierNoun(n)} blocked`;
  const { outcome, sessionsEnded } = blockOutcome(created);
  switch (outcome) {
    case "failed":
      if (controllerManagedVenue) {
        return `${head} — they cannot sign in again. This venue's Wi-Fi is run by a controller we can't ask to end a session, so anyone already online may stay connected until they reconnect.`;
      }
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

// ---------------------------------------------------------------------------
// The device half: what the venue's controller did about their devices.
// ---------------------------------------------------------------------------
//
// SEPARATE FROM THE LADDER ABOVE, AND DELIBERATELY SO. `blockOutcome`
// answers "what happened to the sessions this guest was in" and is
// unchanged by this file's second half -- same branches, same order, same
// sentences. `controller_blocks` answers "and what about their devices",
// which the backend returns as a SIBLING of `enforcement_status` and never
// folded into it (cloud-guest #277). Folding them here would undo that
// decision one layer up and lose the only distinction a venue admin can
// act on.
//
// PARTIAL SUCCESS IS THE NORMAL CASE. A guest may have three devices and
// the controller may know two of them. Every function below is built to
// say "2 of 3" without either rounding it up to a tick or down to a
// failure.

/**
 * How many of a block's devices landed in each state, across every rule
 * the admin just created.
 *
 * Counted rather than summarised: the four states have four different
 * renderings and three of them are not failures.
 */
export interface BlockDeviceTally {
  /** The controller confirmed it is holding the device off. */
  enforced: number;
  /** The controller has no record of the device. NOT a failure. */
  unknownToController: number;
  /** The controller refused, or could not be reached. Actionable. */
  refused: number;
  /** This venue's integration cannot block at all. */
  cannotBlockHere: number;
  /** A status this dashboard does not recognise. Claims nothing. */
  unrecognised: number;
  /** Every device row, across every rule. */
  total: number;
}

/**
 * The reason to show for the states that carry one, in the backend's own
 * words. `failed` and `unenforced` both do; the other two never do.
 */
export function blockDeviceReasons(created: readonly AnyAccessRule[]): string[] {
  const seen = new Set<string>();
  for (const rule of created) {
    if (rule.kind !== "identifier") continue;
    for (const block of rule.controllerBlocks) {
      if (block.status !== "failed" && block.status !== "unenforced") continue;
      const reason = block.errorMessage?.trim();
      // The provider's sentence names what the venue would have to change,
      // which no paraphrase here would. De-duplicated because one venue's
      // reason repeats once per device and an admin needs to read it once.
      if (reason) seen.add(reason);
    }
  }
  return [...seen];
}

export function blockDeviceTally(created: readonly AnyAccessRule[]): BlockDeviceTally {
  const tally: BlockDeviceTally = {
    enforced: 0,
    unknownToController: 0,
    refused: 0,
    cannotBlockHere: 0,
    unrecognised: 0,
    total: 0,
  };
  for (const rule of created) {
    if (rule.kind !== "identifier") continue;
    for (const block of rule.controllerBlocks) {
      tally.total += 1;
      switch (block.status) {
        case "enforced":
          tally.enforced += 1;
          break;
        // `not_applicable` carries the vendor's not-found code and is
        // explicitly not a failure: there was no device to keep off.
        case "not_applicable":
          tally.unknownToController += 1;
          break;
        case "failed":
          tally.refused += 1;
          break;
        case "unenforced":
          tally.cannotBlockHere += 1;
          break;
        // `pending`, null, and anything this dashboard has not heard of.
        // Counted, never described: a status with no rendering must not
        // borrow one from a status that has.
        default:
          tally.unrecognised += 1;
          break;
      }
    }
  }
  return tally;
}

/**
 * The device sentences, in the order a venue admin needs them: what we did
 * first, then each way we did not, worst last so it is what they are left
 * looking at.
 *
 * RETURNS AN EMPTY ARRAY WHEN NOTHING WAS ASKED, and that is the whole
 * MikroTik guarantee. `controller_blocks` is `[]` at every venue this
 * platform reaches over the router API, so this returns `[]`, so the panel
 * renders nothing and the screen is the screen it was before this change.
 * It is also `[]` for a guest with no recorded device, which means the
 * same thing -- nothing was asked -- and says the same nothing.
 */
export function blockDeviceSentences(created: readonly AnyAccessRule[]): string[] {
  const tally = blockDeviceTally(created);
  if (tally.total === 0) return [];

  const lines: string[] = [];
  const devices = (n: number) => `${n} device${n === 1 ? "" : "s"}`;

  if (tally.enforced > 0) {
    // "N of M" whenever there is more than one device in play, because a
    // bare "2 devices blocked" reads as all of them.
    lines.push(
      tally.enforced === tally.total
        ? `${devices(tally.enforced)} ${tally.enforced === 1 ? "is" : "are"} now blocked on this venue's network too.`
        : `${tally.enforced} of ${devices(tally.total)} ${tally.enforced === 1 ? "is" : "are"} now blocked on this venue's network too.`,
    );
  }
  if (tally.unknownToController > 0) {
    lines.push(
      `This venue's network has no record of ${devices(tally.unknownToController)}, so there was nothing to keep off.`,
    );
  }
  if (tally.cannotBlockHere > 0) {
    lines.push(
      `${devices(tally.cannotBlockHere)} could not be kept off, because this venue's network cannot block a device at all.`,
    );
  }
  if (tally.refused > 0) {
    lines.push(
      `This venue's network did not keep ${devices(tally.refused)} off. Nothing changed for ${tally.refused === 1 ? "it" : "them"}.`,
    );
  }
  return lines;
}

/**
 * What a block DOES and does not guarantee, said once, under the counts.
 *
 * Rendered only when at least one device was actually blocked: it is the
 * caveat on a thing that happened, and showing it where nothing happened
 * would be a warning about a capability the admin did not just use.
 *
 * CAPABILITY-MATRIX §10.5 in the first half. The second half is the part
 * an admin most needs and is the only unqualified promise this screen
 * makes: the rule is vendor-neutral and is consulted at every sign-in.
 *
 * Says NOTHING about a guest holding a live authorization right now --
 * §10.6 is unmeasured, and the session question is answered by
 * `blockOutcomeMessage` above from what the server actually did.
 */
export const BLOCK_DEVICE_GUARANTEE =
  "A phone can come back under a new random Wi-Fi address, so treat keeping a device off as a " +
  "deterrent. Being blocked from signing in is what actually refuses the person, on any device.";

/**
 * What to say after an unblock, from the released device rows.
 *
 * WHY THIS EXISTS AT ALL. The controller publishes no readable list of
 * blocked clients (CAPABILITY-MATRIX §10.8; the backend declined to build
 * one for the same reason), so our row is the only trace anywhere that a
 * device was being held off a venue's network. If the screen does not say
 * the hold was lifted, nothing does, and an admin who unblocks somebody has
 * no way to find out whether their device can actually get back on.
 *
 * The backend releases BEFORE the rule stops applying -- the open rows are
 * found by `rule_id`, so a release attempted afterwards is one nobody could
 * start -- and a release that did not land stays in the set its 10-minute
 * sweep retries. That is why the failure sentence below promises a retry
 * rather than asking the admin to do something: there is nothing for them
 * to do, and telling them otherwise would send them looking for a control
 * that does not exist.
 *
 * Returns the plain sentence when nothing was being held, so a MikroTik
 * venue -- where the list is always empty -- reads exactly as it did.
 */
export function unblockDeviceMessage(blocks: readonly ControllerBlock[]): string {
  const head = "Unblocked — they can sign in again.";
  if (blocks.length === 0) return head;

  const released = blocks.filter((b) => b.clearedAt);
  const stillHeld = blocks.filter((b) => !b.clearedAt && b.status === "enforced");
  const devices = (n: number) => `${n} device${n === 1 ? "" : "s"}`;

  if (stillHeld.length > 0) {
    // The worst TRUE thing last, so it is what the admin is left holding --
    // the same ordering rule as the ladder at the top of this file.
    const lead =
      released.length > 0
        ? `${head} ${devices(released.length)} ${released.length === 1 ? "was" : "were"} let back onto the network.`
        : head;
    return (
      `${lead} ${devices(stillHeld.length)} ${stillHeld.length === 1 ? "is" : "are"} still being ` +
      "held off and the network has not confirmed letting them back on. We keep retrying."
    );
  }
  if (released.length > 0) {
    return `${head} ${devices(released.length)} ${released.length === 1 ? "was" : "were"} let back onto the network.`;
  }
  // Rows exist but none was ever enforced -- the controller had no record
  // of the device, or could not block it in the first place. There was
  // nothing to release, and claiming a release would invent one.
  return head;
}
