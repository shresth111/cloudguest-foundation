/**
 * Access Rules at a NAS-only venue (Aruba Instant On): which of the limits on
 * Guest WiFi Limits / Access Tiers reach a guest there, and the sentence that
 * says how.
 *
 * WHY A SEPARATE MODULE, NOT FOUR MORE CASES IN `omada-client-controls.ts`
 * ------------------------------------------------------------------------
 * That ladder's union is exhaustive and every Omada and MikroTik answer runs
 * through it. The fields here have no Omada or MikroTik question at all --
 * at every other vendor they are `available` and render nothing, exactly as
 * before. Keeping them out of the ladder makes that a property of the code
 * (one early return on `isNasOnlyVendor`), not of a test.
 *
 * WHERE THE ANSWERS COME FROM
 * ---------------------------
 * An Instant On access point is a RADIUS NAS and nothing else: no router API,
 * no controller API, no CoA into the venue's NAT. A rule therefore reaches a
 * guest there only at the portal sign-in, and in the RADIUS reply the AP gets
 * (Accept/Reject, Session-Timeout, Idle-Timeout). Nothing can end a session
 * once the AP has admitted it. Aruba spec (PM_SPEC §3.1) and the backend's
 * `RadiusService.authorize` / `nas_only_authorize_standing`.
 *
 *  - Devices per user: SUPPORTED. The sign-in refuses the extra device.
 *  - Data limit: CAVEAT. Hardware check V3 is MEASURED (2026-10-03,
 *    ~/wyfy-ops/aruba-ap21/ACCESS_RULES.md): the AP21 sends Interim-Updates
 *    every ~306 s with real octet counts, so usage IS counted and a guest over
 *    the cap is refused at the next sign-in. Nothing can end the live session
 *    early (no CoA), so the guest stays online until their session ends.
 *  - Idle timeout: CAVEAT. Sent as Idle-Timeout; whether the AP honours it is
 *    hardware check V2 (still unmeasured). If it does not, the session simply
 *    runs to its time -- which IS enforced (see Session-Timeout below).
 *  - Guest Allow-list: CAVEAT. Allow rules and "only people on this list" are
 *    decided at sign-in for every vendor; a change cannot take an Instant On
 *    guest who is already online off the network.
 *  - Max daily session: ENFORCED, mid-session too. A guest who has used
 *    today's time can't sign in again, and the remaining time caps
 *    Session-Timeout. Hardware check V1 is MEASURED (2026-10-03, AP21): the AP
 *    ends the session at Session-Timeout (Acct-Terminate-Cause=
 *    Session-Timeout), so the guest is signed out when the time runs out.
 *  - Open Hours: ENFORCED, mid-session too. Sign-in is refused while closed,
 *    and the time until closing caps Session-Timeout, so a guest online at
 *    closing time is signed out then (same V1 measurement).
 *  - Speed: NOT SUPPORTED through sign-in. MEASURED 2026-10-03: the AP ignores
 *    the bandwidth attributes Wyfy can send (512/256 kbps sent, ~200 Mbps
 *    measured). Copy lives in `omada-client-controls.ts` (`NAS_ONLY_SPEED`).
 *
 * Session timeout, speed and blocking keep their verdicts in
 * `omada-client-controls.ts` (`NAS_ONLY_SESSION_TIMEOUT`, `NAS_ONLY_SPEED`,
 * `NAS_ONLY_BLOCK_SIGNIN`); this module does not restate them.
 */
import type { ControlVerdict } from "@/lib/omada-client-controls";
import { isNasOnlyVendor } from "@/lib/router-vendors";

export type NasOnlyLimitId =
  | "data-limit"
  | "idle-timeout"
  | "daily-limit"
  | "open-hours"
  | "devices"
  | "allow-list"
  | "trusted-devices";

export type NasOnlyLimitVerdict = ControlVerdict<NasOnlyLimitId>;

/** Data limit after V3 (usage reporting) was measured on the AP21. Replaces
 * U3a ("aren't available yet"), which was true only while nothing counted
 * the bytes. Claims only the measured half plus the sign-in gate. */
export const NAS_ONLY_DATA_LIMIT =
  "Usage is counted. When a guest reaches the limit they can't sign in again, but Wyfy " +
  "can't disconnect a device from Aruba Instant On access points, so they stay online " +
  "until their session ends.";

/** Data limit with Instant On cloud control ON for the venue (backend #348):
 * at the interim that crosses the cap Wyfy blocks the device on Instant On
 * (then lifts the block after a short hold) and ends the session only once
 * Instant On lists the block. Says what is confirmed and what is not claimed. */
export const NAS_ONLY_DATA_LIMIT_CLOUD =
  "Usage is counted. When a guest reaches the limit, Wyfy takes their device off the WiFi " +
  "through Instant On, within about 5 minutes of crossing it (usage arrives every ~5 " +
  "minutes), and they can't sign in again until the limit resets. If Instant On doesn't " +
  "confirm the block, the guest is refused at their next sign-in instead.";

/** Idle timeout before hardware check V2. Says what happens either way. */
export const NAS_ONLY_IDLE_TIMEOUT =
  "Wyfy sends this to your Aruba Instant On access points, but whether they sign out an " +
  "idle device hasn't been confirmed yet. If they don't, the guest stays online until " +
  "their session time runs out.";

/** Max daily session after V1 was measured on the AP21 (2026-10-03): the
 * remaining allowance caps the session time the access point enforces. */
export const NAS_ONLY_DAILY_LIMIT =
  "Enforced. When a guest's time for today runs out, Aruba Instant On access points end " +
  "their session, and they can't sign in again until the allowance resets.";

/** Open Hours after V1: the time until closing caps the session time. */
export const NAS_ONLY_OPEN_HOURS =
  "Enforced at Aruba Instant On access points too: a guest who is online at closing time " +
  "is signed out then, and nobody can sign in until you open again.";

/** Guest Allow-list (allow rules by phone/MAC, "only people on this list"):
 * decided at sign-in for every vendor, so it works -- but a change cannot
 * take anyone off an Instant On access point who is already online. */
export const NAS_ONLY_ALLOW_LIST =
  "These rules apply when a guest signs in. Wyfy can't disconnect a device from Aruba " +
  'Instant On access points, so removing someone, or switching on "only people on this ' +
  "list\", doesn't take anyone offline who is online right now. They stay on until their " +
  "session ends.";

/** Trusted Devices: Instant On has no MAC authentication, so a trusted
 * device still lands on the portal, which signs it in by itself
 * (src/lib/portal-aruba-trusted.ts). Says what the owner will see. */
export const NAS_ONLY_TRUSTED_DEVICES =
  "At Aruba Instant On access points a trusted device still opens the WiFi sign-in page " +
  "for a moment, then connects on its own, with no code. Removing a device takes effect " +
  "when its current session ends.";

/** The form footer at a NAS-only venue. A guest's session length (and the
 * daily allowance / closing time that cap it) is fixed when they sign in and
 * then enforced by the access point; a change reaches each guest at their
 * next sign-in. */
export const NAS_ONLY_LIMITS_FOOTER =
  "Changes apply the next time each guest signs in. Aruba Instant On access points end " +
  "each session when its time is up, so anyone online right now keeps the limits they " +
  "signed in with until then.";

const AVAILABLE = (control: NasOnlyLimitId): NasOnlyLimitVerdict => ({
  control,
  availability: "available",
  reason: null,
});

/**
 * The verdict for one limit at this venue. Every vendor that is not NAS-only
 * -- MikroTik, Omada, a mixed venue, an unreadable one (`vendor` null) -- gets
 * `available` with a null reason, which renders nothing.
 */
export function nasOnlyLimitVerdict(
  control: NasOnlyLimitId,
  vendor: string | null | undefined,
  /** Aruba Instant On cloud control is on for the venue (only `true` counts).
   * Changes only the data limit's sentence. */
  opts: { cloudControl?: boolean } = {},
): NasOnlyLimitVerdict {
  if (!isNasOnlyVendor(vendor)) return AVAILABLE(control);
  switch (control) {
    case "devices":
      return AVAILABLE(control);
    case "data-limit":
      return {
        control,
        availability: "qualified",
        reason: opts.cloudControl === true ? NAS_ONLY_DATA_LIMIT_CLOUD : NAS_ONLY_DATA_LIMIT,
      };
    case "idle-timeout":
      return { control, availability: "qualified", reason: NAS_ONLY_IDLE_TIMEOUT };
    case "daily-limit":
      return { control, availability: "qualified", reason: NAS_ONLY_DAILY_LIMIT };
    case "open-hours":
      return { control, availability: "qualified", reason: NAS_ONLY_OPEN_HOURS };
    case "allow-list":
      return { control, availability: "qualified", reason: NAS_ONLY_ALLOW_LIST };
    case "trusted-devices":
      return { control, availability: "qualified", reason: NAS_ONLY_TRUSTED_DEVICES };
  }
}

/**
 * The kbps a saved speed label stands for, including the `"<n> Kbps"` labels
 * `kbpsToLabel` produces for a rate that is not on the picker. Used where a
 * GREYED speed control must write back what the policy already holds: looking
 * the label up in the picker's own table alone turns every off-list rate into
 * 0 ("Unlimited") on the next save, silently uncapping the tier everywhere it
 * is mapped -- including at the MikroTik venues of the same account.
 */
export function heldKbpsFromLabel(
  label: string | null | undefined,
  table: Record<string, number>,
): number {
  if (!label) return 0;
  if (label in table) return table[label];
  const m = /^(\d+)\s*Kbps$/i.exec(label.trim());
  return m ? parseInt(m[1], 10) : 0;
}
