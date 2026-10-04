/**
 * Access Rules: which tabs the page has, who may see each, and which one
 * opens first.
 *
 * Pure and dependency-free on purpose (same reason as `lib/blocking.ts`), so
 * the guards can execute it rather than grep it -- see
 * scripts/test-access-rules-guests-tab.mjs.
 *
 * ## Guests & devices lives here
 *
 * Owner instruction (2026-10-04): blocking a guest or a device belongs under
 * Access Rules, right after Access Tiers, on every dashboard (the owner's,
 * the staff `/agent` shell, and Master's "View as customer", which renders
 * the owner's own routes). It is the same `BlockUsers` component that was
 * the "Guests & devices" tab of Security -> Block Websites -- moved, not
 * copied, so the setting still has exactly one home. Its requests, its
 * per-vendor copy (Omada / Aruba Instant On caveats) and its outcome toasts
 * are BlockUsers' own and travel with it unchanged.
 *
 * `/blocking?tab=guests` (the old address) redirects to
 * `/policies?tab=guests`.
 */

export type AccessRulesTabId = "location" | "group" | "guests";

export const ACCESS_RULES_TAB_IDS: readonly AccessRulesTabId[] = ["location", "group", "guests"];

/** The backend key the Guests & devices tab's reads are guarded by
 * (`/guest-access/rules` checks `guest_access.read`) -- the same key the tab
 * was gated on under Block Websites (`BLOCKING_TABS` before the move). */
export const GUESTS_TAB_PERMISSION_KEYS: readonly string[] = ["guest_access.read"];

/** Access Rules' own key (`NAV_PERMISSION_KEYS.policies`' first entry). */
export const POLICY_PERMISSION_KEYS: readonly string[] = ["policy.read"];

export function isAccessRulesTabId(value: unknown): value is AccessRulesTabId {
  return ACCESS_RULES_TAB_IDS.includes(value as AccessRulesTabId);
}

/**
 * The tabs a caller holding `permissions` is offered.
 *
 * Fails open exactly as `blockingTabsFor` did: `null`, `undefined` and `[]`
 * are "we don't know", not "denied", and return every tab. With a real grant
 * set, Guests & devices is offered only on `guest_access.read` -- the same
 * rule it had under Block Websites. Guest WiFi Limits and Access Tiers were
 * never permission-filtered inside this page and still are not, EXCEPT that a
 * caller who reached the page on `guest_access.read` alone (the nav row
 * offers it on either key) is shown just the tab they can use, matching how
 * Block Websites showed such a caller only its Guests tab.
 */
export function accessRulesTabsFor(
  permissions: readonly string[] | null | undefined,
): readonly AccessRulesTabId[] {
  if (!permissions || permissions.length === 0) return ACCESS_RULES_TAB_IDS;
  const granted = new Set(permissions);
  const guests = GUESTS_TAB_PERMISSION_KEYS.some((k) => granted.has(k));
  const policy = POLICY_PERMISSION_KEYS.some((k) => granted.has(k));
  if (guests && !policy) return ["guests"];
  if (guests) return ACCESS_RULES_TAB_IDS;
  if (policy) return ["location", "group"];
  // Neither key: the caller reached the URL directly. Show everything and let
  // the backend answer, rather than an empty page (same as blockingTabsFor).
  return ACCESS_RULES_TAB_IDS;
}

/** An explicit, offered `requested` tab wins (a deep link such as the
 * Security Score's "Block a guest or device", or an old
 * `/blocking?tab=guests` bookmark); otherwise the first offered tab. */
export function initialAccessRulesTab(
  requested: unknown,
  offered: readonly AccessRulesTabId[],
): AccessRulesTabId {
  if (isAccessRulesTabId(requested) && offered.includes(requested)) return requested;
  return offered[0] ?? "location";
}
