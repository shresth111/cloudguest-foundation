/**
 * Security -> Firewall: the one section that holds everything a venue does to
 * keep its guest network safe -- firewall rules, Block Websites and the
 * Security Check -- and which parts of it the Firewall add-on locks.
 *
 * Pure and dependency-free, like `lib/blocking.ts`, so the nav guards can
 * execute it rather than grep it.
 *
 * ## One row, three tabs
 *
 * "Security Score" (`/security`) and "Block Websites" (`/blocking`) used to
 * be rows of their own next to Firewall. They are tabs of Firewall now, with
 * the same components, the same requests and the same permissions; only the
 * address moved, and both old addresses redirect here
 * (`/firewall?section=security`, `/firewall?section=blocking&tab=...`).
 *
 * ## What the Firewall add-on locks
 *
 * The add-on (`firewall` in `/me/entitlements`, `PlanFeatureKey.FIREWALL`
 * on the backend, switched per organisation from the Master console) covers
 * what the backend gates with `RequireFeature(FIREWALL)`:
 *
 *  - "Firewall rules" -- `/firewall-rules` (rules, Apply, flood limit, guest
 *    isolation).
 *  - the "Websites" tab of "Block websites" -- `/content-filter-rules` and
 *    `/dns-filtering`.
 *
 * It does NOT lock, because the backend does not gate them either:
 *
 *  - "Security check" -- read-only, and a venue can always read its own
 *    exposure (the backend's security router is ungated on purpose).
 *  - the "Guests & devices" tab of "Block websites" -- blocking a guest is an
 *    Access Rules feature that lived here before the add-on existed, and this
 *    is its only home.
 *
 * So a locked organisation still has a working page: it opens Firewall, sees
 * its security check and its blocked guests, and sees the add-on screen where
 * the paid parts would be. Nothing it could do before the add-on, and that
 * the backend still lets it do, is hidden.
 */

/** The `/me/entitlements` key of the Firewall add-on. */
export const FIREWALL_FEATURE_KEY = "firewall";

export type FirewallSectionId = "rules" | "blocking" | "security";

export interface FirewallSection {
  id: FirewallSectionId;
  /** English label; the page reads `nav:firewallSection.<id>` first. */
  label: string;
  /** Backend keys the section's own reads are guarded by -- any one is
   * enough, the same OR shape as `NAV_PERMISSION_KEYS`. */
  permissionKeys: readonly string[];
  /** Whether the Firewall add-on locks this section. "blocking" is
   * `"websites-only"`: its Websites tab is locked, its Guests tab is not. */
  addon: "locked" | "websites-only" | "free";
}

export const FIREWALL_SECTIONS: readonly FirewallSection[] = [
  {
    id: "rules",
    label: "Firewall rules",
    permissionKeys: ["firewall.read"],
    addon: "locked",
  },
  {
    id: "blocking",
    label: "Block websites",
    // The same two keys `lib/blocking.ts` offers its two tabs on.
    permissionKeys: ["content_filtering.read", "guest_access.read"],
    addon: "websites-only",
  },
  {
    id: "security",
    label: "Security check",
    permissionKeys: ["security.read"],
    addon: "free",
  },
];

/** Every key any section reads -- the Firewall nav row's permission keys. */
export const FIREWALL_SECTION_PERMISSION_KEYS: readonly string[] = Array.from(
  new Set(FIREWALL_SECTIONS.flatMap((s) => s.permissionKeys)),
);

export function isFirewallSectionId(value: unknown): value is FirewallSectionId {
  return FIREWALL_SECTIONS.some((s) => s.id === value);
}

/**
 * The sections a caller holding `permissions` is offered. Fails open exactly
 * as `blockingTabsFor` does: `null`, `undefined` and `[]` are "we don't
 * know" and return every section; a real grant set narrows; and a grant set
 * that would leave nothing (the URL was reached directly) shows everything
 * and lets the backend answer.
 */
export function firewallSectionsFor(
  permissions: readonly string[] | null | undefined,
): readonly FirewallSection[] {
  if (!permissions || permissions.length === 0) return FIREWALL_SECTIONS;
  const granted = new Set(permissions);
  const allowed = FIREWALL_SECTIONS.filter((s) => s.permissionKeys.some((k) => granted.has(k)));
  return allowed.length > 0 ? allowed : FIREWALL_SECTIONS;
}

/**
 * Which section opens. An explicit, offered `requested` section always wins
 * (a deep link, or an old `/security` / `/blocking` bookmark). Otherwise the
 * first offered one -- "Firewall rules" for an owner.
 */
export function initialFirewallSection(
  requested: unknown,
  offered: readonly FirewallSection[],
): FirewallSectionId {
  if (isFirewallSectionId(requested) && offered.some((s) => s.id === requested)) {
    return requested;
  }
  return (offered[0] ?? FIREWALL_SECTIONS[0]).id;
}

/**
 * Whether the add-on locks this section's main content. `entitled` is
 * `useFeatureEntitled(FIREWALL_FEATURE_KEY)`: only a definite `false` locks.
 * `null` (loading, failed, demo, no organisation) shows the real screen and
 * lets the backend's own 402 be the answer, the same rule Marketing and
 * Traffic Lens follow.
 */
export function firewallSectionLocked(
  section: FirewallSectionId,
  entitled: boolean | null,
): boolean {
  if (entitled !== false) return false;
  const found = FIREWALL_SECTIONS.find((s) => s.id === section);
  return found?.addon === "locked";
}

/** Whether Block Websites' Websites tab is locked (its Guests tab never is). */
export function blockingWebsitesLocked(entitled: boolean | null): boolean {
  return entitled === false;
}

/** The support ticket subject an "Ask Wyfy to enable it" request files. */
export const FIREWALL_ENABLE_SUBJECT = "Enable Firewall add-on";
