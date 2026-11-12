/**
 * Unblocking a guest from their row on Guests -- the front desk's path.
 *
 * Owner decision, 2026-10-31: front-desk staff may UNBLOCK a guest at their
 * own venue (not block, not edit rules). Blocked guests otherwise live only
 * under Guests -> Guests & devices (`/blocked-guests`), which is owner-only.
 *
 * WHAT THE BACKEND ALREADY ENFORCES (cloud-guest, guest_access)
 * -------------------------------------------------------------
 *   - `POST /guest-access/{rules,device-rules}/{id}/deactivate` is guarded by
 *     `guest_access.update` at an explicit LOCATION scope. The seeded
 *     front-desk roles (Reception Staff, Guest Operator, Location Manager)
 *     hold it at their venue; Helpdesk holds only `.read`.
 *   - A venue-scoped caller must name its venue in `X-Location-Id`, or the
 *     check (and the rule listing) 403s. The rule's own venue is then
 *     compared with the caller's GRANTS, not with that header.
 *   - An organization-wide rule (`locationId: null`, a ban at every venue)
 *     cannot be lifted by a venue-scoped caller. So this file never offers
 *     that Unblock to one -- it says who can instead.
 *   - The release from the router / controller is the same service path the
 *     owner's Unblock on Guests & devices takes; nothing here talks to a device.
 *
 * Pure and dependency-free so scripts/test-guest-unblock.mjs can execute it.
 */

/** The backend key the deactivate routes check. */
export const GUEST_UNBLOCK_PERMISSION = "guest_access.update";

/** The fields of an access rule this file reads (both rule kinds). */
export interface UnblockRule {
  id: string;
  kind: "identifier" | "device";
  ruleType: string;
  isActive: boolean;
  locationId: string | null;
  expiresAt: string | null;
  /** Phone (E.164) or email, for an identifier rule. */
  identifier?: string;
  /** For a device rule. */
  macAddress?: string;
}

/** The fields of a Guests row this file reads. Phone and email may arrive
 * masked by the server ("XXXXXXX43210", "j****3@gmail.com") for an account
 * that has not unmasked itself -- which is the usual front-desk account. */
export interface UnblockGuest {
  phone?: string | null;
  email?: string | null;
  mac?: string | null;
}

/**
 * May this caller be offered Unblock at all?
 *
 * Fails OPEN like the nav (`null`/`undefined`/`[]` mean "we don't know"):
 * the backend refuses a caller without the key, and hiding the button from a
 * legitimate owner whose permission fetch failed is the worse error. A real,
 * non-empty grant set without the key hides it (Helpdesk, a custom role).
 */
export function canOfferUnblock(permissions: readonly string[] | null | undefined): boolean {
  if (!permissions || permissions.length === 0) return true;
  return permissions.includes(GUEST_UNBLOCK_PERMISSION);
}

const digits = (s: string) => s.replace(/\D/g, "");
const MASKED_PHONE = /^X+\d{5}$/;
const MASKED_EMAIL_LOCAL = /^.\*{4}.?$/;

/** Does the row's phone (raw or server-masked) name this rule identifier? */
export function phoneMatches(rowPhone: string | null | undefined, ruleIdentifier: string): boolean {
  if (!rowPhone || ruleIdentifier.includes("@")) return false;
  const ruleDigits = digits(ruleIdentifier);
  if (!ruleDigits) return false;
  const compact = rowPhone.replace(/[\s-]/g, "");
  if (MASKED_PHONE.test(compact)) {
    // The server keeps the last five digits and replaces every other digit
    // with one X, so the length is the rule's digit count exactly.
    return compact.length === ruleDigits.length && ruleDigits.endsWith(compact.slice(-5));
  }
  return digits(compact) === ruleDigits;
}

/** Does the row's email (raw or server-masked) name this rule identifier? */
export function emailMatches(rowEmail: string | null | undefined, ruleIdentifier: string): boolean {
  if (!rowEmail || !ruleIdentifier.includes("@")) return false;
  const [rowLocal, rowDomain] = splitEmail(rowEmail.trim().toLowerCase());
  const [ruleLocal, ruleDomain] = splitEmail(ruleIdentifier.trim().toLowerCase());
  if (!rowDomain || rowDomain !== ruleDomain) return false;
  if (MASKED_EMAIL_LOCAL.test(rowLocal)) {
    // "a****l" keeps the first and last character; "a****" a one-letter local.
    const first = rowLocal[0];
    const last = rowLocal.length > 5 ? rowLocal[rowLocal.length - 1] : null;
    if (last === null) return ruleLocal.length <= 1 && ruleLocal[0] === first;
    return ruleLocal.length >= 2 && ruleLocal[0] === first && ruleLocal.endsWith(last);
  }
  return rowLocal === ruleLocal;
}

function splitEmail(value: string): [string, string] {
  const at = value.lastIndexOf("@");
  return at < 0 ? [value, ""] : [value.slice(0, at), value.slice(at + 1)];
}

const normMac = (m: string) => m.toUpperCase().replace(/[^0-9A-F]/g, "");

/**
 * The active block rules that keep this guest off `venueId`, newest first.
 *
 * "Active" is what the backend enforces: a `blocklist` rule, `isActive`, not
 * past `expiresAt`, at this venue or organization-wide. An allow rule or an
 * old, lifted block never shows an Unblock.
 */
export function blocksForGuest<R extends UnblockRule>(
  guest: UnblockGuest,
  rules: readonly R[],
  venueId: string | null,
  nowMs: number = Date.now(),
): R[] {
  const mac = guest.mac && guest.mac !== "Unknown" ? normMac(guest.mac) : "";
  return rules.filter((r) => {
    if (r.ruleType !== "blocklist" || !r.isActive) return false;
    if (r.expiresAt && Date.parse(r.expiresAt) <= nowMs) return false;
    if (r.locationId !== null && venueId !== null && r.locationId !== venueId) return false;
    if (r.kind === "device") return !!mac && !!r.macAddress && normMac(r.macAddress) === mac;
    const id = r.identifier ?? "";
    return phoneMatches(guest.phone, id) || emailMatches(guest.email, id);
  });
}

/** Why a matched block cannot be lifted by THIS caller, or `null` when it
 * can. `venueScoped` is from the caller's real role assignments
 * (`resolveMarketingScope(...).kind === "location"`), never the login radio. */
export function unblockRefusal(
  rule: Pick<UnblockRule, "locationId">,
  venueScoped: boolean,
): "organization-wide" | null {
  return venueScoped && rule.locationId === null ? "organization-wide" : null;
}
