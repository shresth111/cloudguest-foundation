/**
 * Whitelist-only mode -- the pure decision layer behind the Always Allowed
 * screen's per-property switch (`captive_portal_configs.whitelist_only_enabled`).
 *
 * OFF (every property's default, and today's behaviour): a guest signs in
 * on the captive portal, is recorded, gets online.
 *
 * ON for one property: the access resolver's "matched nothing" answer flips
 * from allow to deny (backend `guest_access.service`, PR #167). Everyone
 * still reaches the captive portal -- nobody is silently dropped off the
 * WiFi -- but a guest with no Always Allowed entry is refused *there*, in
 * the venue's own words, and never costs the venue an OTP SMS.
 *
 * Nothing in this file talks to the network or to React. It exists as its
 * own module because the two interesting guardrails are data judgements
 * that have to be exactly right before a venue's WiFi closes to the public,
 * and a judgement worth getting right is worth testing without a browser --
 * see `scripts/test-whitelist-only-guardrails.mjs`.
 */

/**
 * `GuestLoginHistory.failure_reason` for a guest turned away by
 * whitelist-only mode. Must stay byte-identical to the backend's
 * `app.domains.guest.constants.WHITELIST_ONLY_LOGIN_FAILURE_REASON` --
 * every refusal writes a row carrying exactly this string, and the
 * refused-guest count is a filter on it.
 */
export const WHITELIST_ONLY_DENIAL_FAILURE_REASON = "WhitelistOnlyAccessDeniedError";

/** How far back the refused-guest counter looks. */
export const DENIAL_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * The canonical stored spelling of a phone rule identifier, copied from the
 * backend's own `app.domains.guest_access.validators._PHONE_RE`
 * (`^\+[1-9]\d{7,14}$`). Rule matching is string equality against the
 * identifier the guest signed in with, which is always E.164, so this
 * regex is not a formatting preference -- it is the difference between a
 * rule that matches a person and a rule that matches nobody.
 */
export const E164_RE = /^\+[1-9]\d{7,14}$/;

/** Backend `_EMAIL_RE`. An identifier rule may legitimately key an email
 * address rather than a phone number; those are not the 2026-09 defect. */
export const RULE_EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Backend `normalize_mac_address`'s output shape: six colon-separated
 * uppercase hex pairs. */
export const RULE_MAC_RE = /^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/;

/** One row of the Always Allowed list, in the shape `WhiteList.tsx` already
 * holds it. `endDate` is `""` for a rule with no expiry (`expires_at IS
 * NULL`), which the backend treats as *permanent*, not expired. */
export interface WhitelistOnlyEntry {
  id: string;
  tab: "number" | "device";
  identifier: string;
  name: string;
  endDate: string;
}

/** An entry whose identifier cannot match any real guest. */
export interface MalformedEntry {
  id: string;
  identifier: string;
  name: string;
  /** Why it can never match: the wrong shape for a phone rule, or for a
   * device rule. */
  kind: "identifier" | "device";
}

export type WhitelistOnlyBlocker =
  | { kind: "empty" }
  | { kind: "malformed"; entries: MalformedEntry[] }
  | { kind: "no-portal-config" };

export interface WhitelistOnlyReadiness {
  activeNumbers: number;
  activeDevices: number;
  activeTotal: number;
  expired: number;
  blockers: WhitelistOnlyBlocker[];
  /** True only when there is at least one active rule and every active rule
   * is in a shape that can actually match. */
  canEnable: boolean;
}

/**
 * Whether a rule is live right now.
 *
 * An empty `endDate` means the rule carries no `expires_at` at all, which
 * on the backend is a rule that never expires. Reading that as "expired"
 * (which `new Date("") > new Date()` does, because Invalid Date compares
 * false) would tell a venue whose whole list is permanent that their list
 * is empty.
 */
export function isRuleActive(endDate: string, nowMs: number): boolean {
  if (!endDate) return true;
  const t = new Date(endDate).getTime();
  if (Number.isNaN(t)) return false;
  return t > nowMs;
}

/**
 * Whether this identifier is in a shape the backend's rule matcher can ever
 * compare equal to a real guest login.
 *
 * This is guardrail #2, and it is the sharp one. Every rule the Always
 * Allowed form wrote before 2026-09-06 stored bare national digits
 * (`9876543210`) while guests sign in as E.164 (`+919876543210`). Under the
 * default-allow that shipped until today, a rule that matched nobody simply
 * did nothing and nobody noticed. Under whitelist-only, that same
 * unchanged row refuses *every* guest at the property while the dashboard
 * goes on rendering a full, correct-looking list of allowed people. The
 * form's fix and the backend's canonicalization both landed today (PRs
 * #225, #160) -- but the rows written before them are still in the
 * database, in the old shape.
 */
export function isMatchableIdentifier(identifier: string): boolean {
  const value = identifier.trim();
  if (!value) return false;
  if (value.includes("@")) return RULE_EMAIL_RE.test(value);
  return E164_RE.test(value);
}

export function isMatchableMac(mac: string): boolean {
  return RULE_MAC_RE.test(mac.trim());
}

/**
 * Everything the switch needs to decide whether it may turn on, and what to
 * tell the owner if it may not.
 *
 * Only *active* rules are considered on both counts: an expired rule grants
 * nobody access, so it neither fills an empty list nor -- being already
 * inert -- can it block the switch for being mis-keyed.
 */
export function evaluateWhitelistOnlyReadiness(
  entries: readonly WhitelistOnlyEntry[],
  nowMs: number = Date.now(),
): WhitelistOnlyReadiness {
  const active = entries.filter((e) => isRuleActive(e.endDate, nowMs));
  const activeNumbers = active.filter((e) => e.tab === "number").length;
  const activeDevices = active.filter((e) => e.tab === "device").length;

  const malformed: MalformedEntry[] = [];
  for (const e of active) {
    const ok =
      e.tab === "number" ? isMatchableIdentifier(e.identifier) : isMatchableMac(e.identifier);
    if (ok) continue;
    malformed.push({
      id: e.id,
      identifier: e.identifier,
      name: e.name,
      kind: e.tab === "number" ? "identifier" : "device",
    });
  }

  const blockers: WhitelistOnlyBlocker[] = [];
  if (active.length === 0) blockers.push({ kind: "empty" });
  if (malformed.length > 0) blockers.push({ kind: "malformed", entries: malformed });

  return {
    activeNumbers,
    activeDevices,
    activeTotal: active.length,
    expired: entries.length - active.length,
    blockers,
    canEnable: blockers.length === 0,
  };
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * The one sentence the switch must show before it is flipped: what is on
 * the list, at which property, and what happens to everyone else.
 */
export function whitelistOnlySummary(
  readiness: Pick<WhitelistOnlyReadiness, "activeNumbers" | "activeDevices">,
  locationName: string,
): string {
  const where = locationName ? ` for ${locationName}` : "";
  return (
    `${plural(readiness.activeNumbers, "guest", "guests")} and ` +
    `${plural(readiness.activeDevices, "device", "devices")} are on the list${where}. ` +
    `Everyone else will still reach the WiFi login page and be refused there.`
  );
}

/** Human copy for one blocker: a heading, and what the owner has to do
 * about it. Kept beside the rule it explains so the two cannot drift. */
export function describeBlocker(
  blocker: WhitelistOnlyBlocker,
  locationName: string,
): { title: string; detail: string } {
  const where = locationName || "this property";
  switch (blocker.kind) {
    case "empty":
      return {
        title: "The list is empty, so nobody could get online",
        detail:
          `There are no active entries for ${where}. Turning this on with an empty list ` +
          `locks out every guest, your own staff, and whoever is trying to work out why. ` +
          `Add at least one number or device below first.`,
      };
    case "malformed": {
      const names = blocker.entries
        .map((e) => (e.name && e.name !== "—" ? `${e.identifier} (${e.name})` : e.identifier))
        .join(", ");
      return {
        title: `${plural(blocker.entries.length, "entry", "entries")} could never match a guest`,
        detail:
          `${names} ${blocker.entries.length === 1 ? "is" : "are"} not stored in the form a guest ` +
          `signs in with. A number must carry its country code (+919876543210, not 9876543210) ` +
          `and a device must be a full address like AA:BB:CC:DD:EE:FF. These were saved before ` +
          `the form started adding the country code, so they look correct in the list below and ` +
          `match nobody. Open each one, re-save it, then switch this on.`,
      };
    }
    case "no-portal-config":
      return {
        title: `${where} has no WiFi login page of its own yet`,
        detail:
          `This setting is stored per property, on that property's own login page settings. ` +
          `${where} is currently inheriting your organisation's default page, and this switch ` +
          `is deliberately refused on a default — it would close every property at once. ` +
          `Create a login page for ${where} under Captive Portal, then come back.`,
      };
  }
}

interface LoginAttemptRow {
  failure_reason?: string | null;
  success?: boolean;
  attempted_at?: string | null;
}

/**
 * How many guests this property turned away in the last 24 hours.
 *
 * Guardrail #4, and the reason it exists: given how quietly a mis-keyed
 * list fails, the first question anyone has after switching this on is
 * "who did we turn away?". This number is how a venue finds out before it
 * becomes a support call.
 */
export function countRecentDenials(
  rows: readonly LoginAttemptRow[],
  nowMs: number = Date.now(),
  windowMs: number = DENIAL_WINDOW_MS,
): number {
  const since = nowMs - windowMs;
  return rows.filter((r) => {
    if (r.failure_reason !== WHITELIST_ONLY_DENIAL_FAILURE_REASON) return false;
    if (!r.attempted_at) return false;
    const t = new Date(r.attempted_at).getTime();
    return !Number.isNaN(t) && t >= since && t <= nowMs;
  }).length;
}
