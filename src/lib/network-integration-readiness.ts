/**
 * Whether a network integration is actually authorising anybody -- and if
 * not, exactly what is missing and where it gets fixed.
 *
 * THE DEFECT THIS EXISTS FOR
 * --------------------------
 * The Omada connect flow cannot collect everything before it writes a row.
 * Listing an Omada controller's sites needs an authenticated call, which
 * needs stored credentials, which needs the integration row the wizard is
 * only creating at that moment (`GET /{id}/sites` -- there is no `{id}`
 * until the row exists). So the row is created as soon as the connection
 * test passes and the site / venue / guest-SSID choices are PATCHed onto it
 * afterwards. That is the right design and CONTRACT.md §3 names the state it
 * produces: `unconfigured`.
 *
 * What was missing is what happens when an operator stops there -- which is
 * an ordinary thing to do, because the Master device wizard's own last step
 * says "now go and map the site in Integrations" and the operator is
 * usually mid-way through onboarding a venue. The row then exists, reads
 * `Connecting` or `Setup incomplete`, and **authorises nobody**. A guest at
 * that venue completes the whole sign-in journey -- OTP delivered, code
 * accepted, "you're connected" -- and has no internet, because the network
 * enforcement step at the end has no site and no SSID to send.
 *
 * Nothing shouted about that. The customer page rendered one amber badge
 * among six other badges; the master console rendered a status tag in a
 * column of status tags; the fleet showed a controller row that looked
 * exactly like a working one. The venue finds out from a guest.
 *
 * WHY THIS IS DERIVED FROM THE FIELDS AND NOT FROM `status`
 * ---------------------------------------------------------
 * `status === "unconfigured"` is the backend's summary of this, and it is
 * usually right. It is not the thing that is true. What makes the
 * difference between "a guest gets online" and "a guest does not" is
 * whether there is a site and a guest network to send to, whether a
 * credential is on file to send it with, and whether a location resolves to
 * this integration at all -- and those are four separate columns which can
 * disagree with a single status word. In particular a row that is still
 * `connecting` (the first sync has not landed) with no site mapped is
 * exactly as dead as an `unconfigured` one, and reading the status alone
 * would report it as merely "waiting on the controller's first reply,
 * usually seconds".
 *
 * Deriving from the fields also means this cannot drift: if the backend
 * later stops writing `unconfigured`, or writes it for a new reason, the
 * question "is anything actually being authorised" still has the same
 * answer.
 *
 * DEPENDENCY-FREE ON PURPOSE. Three surfaces have to agree about this --
 * the customer page, the master console and the fleet -- and a shared
 * predicate is the only thing that stops them disagreeing about the same
 * venue. Same reasoning as `src/lib/router-vendors.ts`.
 */

import type { NetworkIntegration } from "@/types/network-integration";

/** What is missing. One per thing an operator can go and do. */
export type IntegrationGapKey = "credentials" | "venue" | "site" | "guestNetwork";

export interface IntegrationGap {
  key: IntegrationGapKey;
  /** Two or three words for a chip or a list item. */
  label: string;
  /** One sentence: what is missing, and what its absence means. */
  detail: string;
}

/**
 * The subset of an integration this derivation reads. Declared as its own
 * shape rather than taking the whole `NetworkIntegration` so a caller that
 * has only a list row -- or a test -- can ask without fabricating twenty
 * fields it does not have.
 */
export type IntegrationSetupInput = Pick<
  NetworkIntegration,
  | "status"
  | "isEnabled"
  | "hasCredentials"
  | "locationId"
  | "externalSiteId"
  | "externalSiteName"
  | "guestSsidId"
  | "guestSsidName"
> &
  Partial<Pick<NetworkIntegration, "name" | "locationName" | "organizationName">>;

export interface IntegrationSetupState {
  /**
   * True only when there is nothing left to do AND the integration is
   * switched on. This is the one predicate every "is this venue fine"
   * decision must go through -- the same role
   * `locationLivenessIsReassuring` plays for router liveness, and for the
   * same reason: so no surface can independently decide that a
   * half-configured controller looks close enough to working.
   */
  authorizesGuests: boolean;
  /**
   * Configuration that is missing. Empty for a fully-mapped integration --
   * including one that is switched off, which is not half-configured, it is
   * off. The two are different problems with different fixes and must not
   * be collapsed.
   */
  gaps: IntegrationGap[];
  /** `gaps.length > 0`. The state this module is named for. */
  isHalfConfigured: boolean;
  /** Switched off deliberately, either by the flag or by the status. */
  isSwitchedOff: boolean;
  /** Heading for the warning. Null when there is nothing to warn about. */
  title: string | null;
  /** What is true right now, in a venue owner's words. Never "misconfigured". */
  summary: string | null;
  /** Where it gets fixed. Null when there is nothing to fix. */
  nextStep: string | null;
}

const GAP_ORDER: IntegrationGapKey[] = ["credentials", "venue", "site", "guestNetwork"];

/**
 * The consequence sentence. Deliberately concrete about what a guest
 * experiences, because "not configured" reads as a settings nit and this is
 * not one: the guest completes the entire sign-in journey and then has no
 * internet, which the venue will read as the platform being broken.
 */
export const INTEGRATION_DEAD_CONSEQUENCE =
  "Guests at this venue can finish signing in and still have no internet: the sign-in works, " +
  "and the step that puts them on the network has nothing to send.";

function gapsFor(i: IntegrationSetupInput): IntegrationGap[] {
  const gaps: IntegrationGap[] = [];

  if (!i.hasCredentials) {
    gaps.push({
      key: "credentials",
      label: "Controller credentials",
      detail:
        "No credentials are stored for this controller, so nothing here can sign in to it. " +
        "Add them with Replace credentials.",
    });
  }

  // A location is not decoration: the portal's authorise call resolves the
  // enabled integration *for a location* (CONTRACT.md §3). An integration
  // attached to no location is reachable from no venue's sign-in.
  if (!i.locationId) {
    gaps.push({
      key: "venue",
      label: "Venue",
      detail:
        "This integration is not attached to a venue, so no venue's guest sign-in resolves to " +
        "it. Pick the venue it serves.",
    });
  }

  // Either half counts. In legacy (hotspot operator) mode the controller
  // cannot list its own sites, so the site is typed in by hand and arrives
  // as a name with no id -- refusing that would report a correctly
  // configured legacy venue as broken. Same for the SSID.
  if (!i.externalSiteId && !i.externalSiteName) {
    gaps.push({
      key: "site",
      label: "Omada site",
      detail:
        "No site on the controller has been chosen, so there is nowhere to authorise a guest.",
    });
  }

  if (!i.guestSsidId && !i.guestSsidName) {
    gaps.push({
      key: "guestNetwork",
      label: "Guest network",
      detail:
        "No guest network (SSID) has been chosen, so a guest who signs in is never put onto one.",
    });
  }

  return gaps.sort((a, b) => GAP_ORDER.indexOf(a.key) - GAP_ORDER.indexOf(b.key));
}

/** Joins gap labels into a readable clause: "a, b and c". */
function listLabels(gaps: IntegrationGap[]): string {
  const labels = gaps.map((g) => g.label.toLowerCase());
  if (labels.length === 1) return labels[0];
  return `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
}

export function deriveIntegrationSetup(i: IntegrationSetupInput): IntegrationSetupState {
  const gaps = gapsFor(i);
  const isSwitchedOff = !i.isEnabled || i.status === "disabled";
  const isHalfConfigured = gaps.length > 0;

  if (!isHalfConfigured) {
    return {
      // A fully-mapped integration that is switched off authorises nobody
      // either -- but on purpose, which the `disabled` status already says
      // in its own words. Reported here so no caller has to remember to
      // check the flag separately, and NOT as a gap, because "turn it back
      // on" and "finish setting it up" are different actions.
      authorizesGuests: !isSwitchedOff,
      gaps: [],
      isHalfConfigured: false,
      isSwitchedOff,
      title: null,
      summary: null,
      nextStep: null,
    };
  }

  const who = i.name ? `“${i.name}”` : "This controller";
  const where = i.locationName ? ` at ${i.locationName}` : "";

  return {
    authorizesGuests: false,
    gaps,
    isHalfConfigured: true,
    isSwitchedOff,
    // Not "Setup incomplete". That is a description of a form; this is a
    // description of what a guest gets.
    title: "Connected, but authorising nobody",
    summary:
      `${who}${where} was connected but never finished: ${listLabels(gaps)} ` +
      `${gaps.length === 1 ? "is" : "are"} still missing. ${INTEGRATION_DEAD_CONSEQUENCE}`,
    nextStep:
      gaps.length === 1 && gaps[0].key === "credentials"
        ? "Use Replace credentials on this integration."
        : "Open this integration and use Finish setup.",
  };
}

/** The one predicate. See {@link IntegrationSetupState.authorizesGuests}. */
export function integrationAuthorizesGuests(i: IntegrationSetupInput): boolean {
  return deriveIntegrationSetup(i).authorizesGuests;
}

/** Short tag text for a table cell or a chip, or `null` when nothing is wrong. */
export function integrationGapTagLabel(i: IntegrationSetupInput): string | null {
  return deriveIntegrationSetup(i).isHalfConfigured ? "Authorising nobody" : null;
}

/**
 * The half-configured rows in a list, in the order given.
 *
 * A helper rather than an inline `.filter` at three call sites, so the three
 * surfaces cannot end up counting slightly different things -- which is how
 * a master console and a customer dashboard start disagreeing about the same
 * venue in a support call.
 */
export function halfConfiguredIntegrations<T extends IntegrationSetupInput>(rows: T[]): T[] {
  return rows.filter((r) => deriveIntegrationSetup(r).isHalfConfigured);
}
