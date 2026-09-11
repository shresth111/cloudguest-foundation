/**
 * Ending one guest's access on an Omada venue: the request shape, and the
 * only place that decides what the answer MEANS.
 *
 * WHY THIS FILE IS PURE AND SEPARATE
 * ----------------------------------
 * The backend (cloud-guest #214) answers with **three** booleans, and the
 * entire history of this feature is people collapsing them into one:
 *
 *   disconnected              the device stopped forwarding traffic.
 *                             THE ONLY ONE THAT MEANS THAT.
 *   had_active_authorization  there was a live grant to remove. FALSE
 *                             ALONGSIDE A TRUE `disconnected` IS NORMAL --
 *                             the grant had already lapsed, so the end
 *                             state the operator asked for already held.
 *                             It is not a warning and must never render as
 *                             one.
 *   guest_session_ended       our own GuestSession row was closed. False
 *                             just means it was already over.
 *
 * Keeping the mapping in a pure module is what lets
 * `scripts/test-omada-disconnect-verdicts.mjs` drive every combination,
 * including the ones a browser would make you click through.
 *
 * WHAT THIS FEATURE IS NOT
 * ------------------------
 * `unauth` ends the session. The guest can walk back to the portal and sign
 * in again. **It is not a ban.** A permanent block is the controller's
 * `blockClient`, which needs an explicit unblock to undo, and is
 * deliberately not wired to this button. No copy in this file may imply
 * otherwise.
 *
 * A NOTE ON THE AUTH MODE, BECAUSE THE WRITTEN RECORD IS WRONG
 * -----------------------------------------------------------
 * `~/wyfy-omada/CHANGE-REQUESTS.md` CR-006 tells the frontend to enable
 * this for `openapi` integrations and disable it for `legacy` ones. That is
 * backwards, and was disproved on real hardware (an Omada Software
 * Controller 5.15.24.19) on 2026-09-11. The disconnect rides the hotspot
 * *operator* session, in either auth mode, and `legacy` is the mode this
 * fleet actually runs. The one configuration that genuinely cannot do it is
 * an integration with no operator account at all -- which is also the one
 * that could never have authorized the guest in the first place.
 *
 * So: **nothing here reads `authMode`.** The gate is the backend's 501.
 */

/** What the operator sends. The backend normalizes the MAC itself, so any
 * of colon / hyphen / bare hex is accepted and we do not reformat. */
export interface OmadaDisconnectRequest {
  clientMac: string;
  /** Staff-visible only, never shown to the guest. Backend caps it at 255. */
  reason?: string;
}

export const DISCONNECT_REASON_MAX_LENGTH = 255;

/** The 200 body, camelCased. */
export interface OmadaDisconnectResult {
  disconnected: boolean;
  provider: string;
  clientMac: string;
  hadActiveAuthorization: boolean;
  deauthorizedAt: string | null;
  guestSessionId: string | null;
  guestSessionEnded: boolean;
}

export type DisconnectTone = "success" | "warning" | "error";

export interface DisconnectVerdict {
  tone: DisconnectTone;
  title: string;
  /** Plain sentences, rendered in order. Never a code, never a status. */
  lines: string[];
  /**
   * True only when the controller confirmed the device is no longer
   * authorized. Mirrors `disconnected` and nothing else -- in particular it
   * is NOT weakened by `had_active_authorization: false`.
   */
  accessEnded: boolean;
  /**
   * True when we can promise the venue is exactly as it was. An operator who
   * believes a half-action occurred does something worse next, so this is
   * only ever set where the backend guarantees it (it calls the controller
   * first and raises before touching any row).
   */
  nothingChanged: boolean;
}

/** Said on every successful end, because it is the thing operators get
 * wrong about this button. */
const NOT_A_BAN = "This is not a ban — the guest can open the portal and sign in again.";

export function describeDisconnectResult(result: OmadaDisconnectResult): DisconnectVerdict {
  if (!result.disconnected) {
    // Not a shape the backend is known to produce (it treats "no live row"
    // as success). Handled anyway: a future firmware that reports a refusal
    // must not render as a green tick.
    return {
      tone: "warning",
      title: "Not confirmed",
      lines: [
        "The controller did not confirm that this device was removed.",
        "Treat the guest as still online, and try again.",
      ],
      accessEnded: false,
      nothingChanged: false,
    };
  }

  const lines: string[] = [];

  if (result.hadActiveAuthorization) {
    lines.push("The controller had a live grant for this device, and it has been removed.");
  } else {
    // THE LAPSED-GRANT SUCCESS. Reads as an explanation of a success, never
    // as a caveat on one.
    lines.push(
      "This device had no live grant left on the controller — it had already lapsed on its own. Either way, it is not on the network now.",
    );
  }

  if (result.guestSessionEnded) {
    lines.push("The guest's Wyfy session was closed at the same time.");
  } else if (result.guestSessionId) {
    lines.push("The linked Wyfy session was already closed.");
  } else {
    lines.push("No open Wyfy session was linked to this device.");
  }

  lines.push(NOT_A_BAN);

  return {
    tone: "success",
    title: "Access ended",
    lines,
    accessEnded: true,
    nothingChanged: false,
  };
}

/** The shape `toAppError` hands back; narrowed to what we actually read. */
export interface DisconnectFailure {
  status: number | null;
  message?: string;
}

/**
 * The controller is called BEFORE any row is written, and a controller
 * failure raises -- so a gateway error is a promise that the venue is
 * untouched. That promise is the whole point of separating 502/504 from a
 * generic failure.
 */
const NOTHING_CHANGED = "Nothing was changed — this guest's access is exactly as it was.";

export function describeDisconnectFailure(error: DisconnectFailure): DisconnectVerdict {
  const status = error.status;

  if (status === 501) {
    // NOT "Omada cannot do this". It can, and does, on this fleet. What is
    // missing is a credential, and we say which one.
    return {
      tone: "error",
      title: "This controller connection can't end a guest's access",
      lines: [
        "It has no hotspot operator account saved, and that account is what lets us ask the controller to end a guest's access.",
        "Add hotspot operator credentials to this controller connection, then try again.",
        NOTHING_CHANGED,
      ],
      accessEnded: false,
      nothingChanged: true,
    };
  }

  if (status === 502 || status === 504) {
    return {
      tone: "error",
      title: "The controller didn't answer — nothing changed",
      lines: [
        "We could not reach this venue's controller, so the request never got there.",
        NOTHING_CHANGED,
        "Wait a moment and try again.",
      ],
      accessEnded: false,
      nothingChanged: true,
    };
  }

  if (status === 409) {
    return {
      tone: "error",
      title: "Finish this controller's setup first",
      lines: [
        "No site has been chosen for this controller connection yet, so there is nowhere to send the request.",
        NOTHING_CHANGED,
      ],
      accessEnded: false,
      nothingChanged: true,
    };
  }

  if (status === 422) {
    return {
      tone: "error",
      title: "The controller rejected this device's address",
      lines: ["The MAC address we hold for this device was not accepted.", NOTHING_CHANGED],
      accessEnded: false,
      nothingChanged: true,
    };
  }

  if (status === 403) {
    return {
      tone: "error",
      title: "You don't have access to this venue's controller",
      lines: [NOTHING_CHANGED],
      accessEnded: false,
      nothingChanged: true,
    };
  }

  if (status === 404) {
    return {
      tone: "error",
      title: "That controller connection no longer exists",
      lines: ["It may have been removed since this page was loaded.", NOTHING_CHANGED],
      accessEnded: false,
      nothingChanged: true,
    };
  }

  if (status === null) {
    return {
      tone: "error",
      title: "We couldn't reach Wyfy — nothing changed",
      lines: [
        "The request never left this browser.",
        NOTHING_CHANGED,
        "Check your connection and try again.",
      ],
      accessEnded: false,
      nothingChanged: true,
    };
  }

  // Deliberately does NOT promise the venue is untouched. A 500 can land
  // after the controller call succeeded, and inventing a guarantee here
  // would be the exact falsehood 502/504 exists to avoid.
  return {
    tone: "error",
    title: "We couldn't confirm what happened",
    lines: [
      error.message?.trim() || "The request failed.",
      "Check this guest's session before trying again.",
    ],
    accessEnded: false,
    nothingChanged: false,
  };
}

/**
 * WHICH CONTROLLER A SESSION BELONGS TO -- AND WHY THIS IS THE VENDOR GATE
 * -----------------------------------------------------------------------
 * `NetworkIntegrationProvider` is a single-member union: `"omada"`. A venue
 * having a network integration at all IS the statement "this venue is an
 * Omada venue". So this function is the whole vendor gate, and nothing here
 * reads `router-vendors.ts`, `location-liveness.ts` or a router row --
 * files another engineer owns this week, and a dependency this feature does
 * not actually need.
 *
 * A MikroTik venue has no integration row, so this returns `null`, so the
 * control never renders. That is the mechanism behind the "MikroTik renders
 * unchanged" guarantee, and it is one `null` rather than a vendor switch.
 *
 * Ambiguity returns `null` on purpose. Two integrations could match a venue
 * (someone made a second one during a migration); guessing which controller
 * to send a disconnect to is worse than not offering the button.
 */
export interface IntegrationLike {
  id: string;
  locationId: string | null;
  provider: string;
  name: string;
}

export function pickIntegrationForLocation<T extends IntegrationLike>(
  integrations: readonly T[],
  locationId: string | null,
): T | null {
  const omada = integrations.filter((i) => i.provider === "omada");

  if (locationId) {
    const exact = omada.filter((i) => i.locationId === locationId);
    if (exact.length === 1) return exact[0];
    if (exact.length > 1) return null;
  }

  // An org-wide integration (no location of its own) covers every venue in
  // the organization -- but only when it is the only one that could.
  const orgWide = omada.filter((i) => i.locationId === null);
  return orgWide.length === 1 ? orgWide[0] : null;
}
