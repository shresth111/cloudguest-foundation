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
 *  - Data limit: UNSUPPORTED until hardware check V3 shows the access points
 *    report usage (copy U3a). Without usage reports nothing counts the bytes,
 *    so a saved cap would never be reached -- a control that does nothing.
 *  - Idle timeout: CAVEAT. Sent as Idle-Timeout; whether the AP honours it is
 *    hardware check V2. If it does not, the session simply runs to its time.
 *  - Guest Allow-list: CAVEAT. Allow rules and "only people on this list" are
 *    decided at sign-in for every vendor; a change cannot take an Instant On
 *    guest who is already online off the network.
 *  - Max daily session: CAVEAT. A guest who has used today's time can't sign
 *    in again (works now). The remaining time also caps Session-Timeout, which
 *    ends a session in progress only if the AP honours it (V1).
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
  | "devices"
  | "allow-list";

export type NasOnlyLimitVerdict = ControlVerdict<NasOnlyLimitId>;

/** PM_SPEC U3a, verbatim. */
export const NAS_ONLY_DATA_LIMIT =
  "Data limits aren't available on Aruba Instant On yet.";

/** Idle timeout before hardware check V2. Says what happens either way. */
export const NAS_ONLY_IDLE_TIMEOUT =
  "Wyfy sends this to your Aruba Instant On access points, but whether they sign out an " +
  "idle device hasn't been confirmed yet. If they don't, the guest stays online until " +
  "their session time runs out.";

/** Max daily session: the sign-in half works now; the mid-session half is V1. */
export const NAS_ONLY_DAILY_LIMIT =
  "Applies the next time a guest signs in: someone who has used today's time can't sign " +
  "in again. Wyfy also asks the access point to end a session when the time runs out, " +
  "but whether Aruba Instant On does that hasn't been confirmed yet.";

/** Guest Allow-list (allow rules by phone/MAC, "only people on this list"):
 * decided at sign-in for every vendor, so it works -- but a change cannot
 * take anyone off an Instant On access point who is already online. */
export const NAS_ONLY_ALLOW_LIST =
  "These rules apply when a guest signs in. Wyfy can't disconnect a device from Aruba " +
  "Instant On access points, so removing someone, or switching on \"only people on this " +
  "list\", doesn't take anyone offline who is online right now. They stay on until their " +
  "session ends.";

/** The form footer at a NAS-only venue: nothing on it reaches a guest who is
 * already online, data limit included (it is greyed here). */
export const NAS_ONLY_LIMITS_FOOTER =
  "These apply the next time each guest signs in. Wyfy can't disconnect a device from " +
  "Aruba Instant On access points, so anyone online right now keeps going until their " +
  "session ends.";

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
): NasOnlyLimitVerdict {
  if (!isNasOnlyVendor(vendor)) return AVAILABLE(control);
  switch (control) {
    case "devices":
      return AVAILABLE(control);
    case "data-limit":
      return { control, availability: "unavailable", reason: NAS_ONLY_DATA_LIMIT };
    case "idle-timeout":
      return { control, availability: "qualified", reason: NAS_ONLY_IDLE_TIMEOUT };
    case "daily-limit":
      return { control, availability: "qualified", reason: NAS_ONLY_DAILY_LIMIT };
    case "allow-list":
      return { control, availability: "qualified", reason: NAS_ONLY_ALLOW_LIST };
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
