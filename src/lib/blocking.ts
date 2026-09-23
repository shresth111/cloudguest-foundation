/**
 * Security -> Blocking: which tabs the page has, who may see each, and which
 * one opens first.
 *
 * Pure and dependency-free on purpose, so the nav guards can execute it
 * rather than grep it (see scripts/test-controller-venue-network-screens.mjs
 * and scripts/test-customer-nav-shell.mjs).
 *
 * ## One home per setting
 *
 * Nothing on this page is new behaviour. Each tab mounts the component that
 * already did the job somewhere else, and that somewhere else stops doing it:
 *
 *  - "Websites & IPs" is `ContentFilterManagement` -- the screen that was
 *    Network -> Website Blocking. That row is gone from the sidebar and
 *    `/website-blocking` redirects here, so an old bookmark lands on the same
 *    rules.
 *  - "Guests & devices" is `BlockUsers` -- the screen that was the "Blocked
 *    Guests" tab of Access Rules. That tab is gone from Access Rules.
 *
 * Two homes for one setting is how two people end up looking at different
 * screens and believing different things (see PoliciesHub's note on why
 * "Always Allowed" and "Sign-in Methods" left it), so this moves them rather
 * than copying them.
 *
 * "Only Allowed" (`whitelist`) is deliberately NOT a tab. It is the opposite
 * switch -- turn it on and everyone not on the list is refused -- and it keeps
 * its own row in Access & Policy. The page links to it instead of mounting a
 * second copy.
 */

export type BlockingTabId = "websites" | "guests";

export interface BlockingTab {
  id: BlockingTabId;
  /** English label; the page reads `nav:blockingTab.<id>` first. */
  label: string;
  /** Backend keys the tab's own reads are guarded by -- the same keys the
   * endpoints it calls check (`content_filtering.read` on
   * `/content-filter/rules`, `guest_access.read` on `/guest-access/rules`).
   * Any one is enough, the same OR shape as `NAV_PERMISSION_KEYS`. */
  permissionKeys: readonly string[];
  /** The id `CONTROLLER_UNSUPPORTED_FEATURE_IDS` knows this tab's screen by,
   * when a controller-managed venue cannot use it. The Websites tab writes
   * RouterOS DNS and address-list entries; there is no RouterOS at an
   * Omada-only venue. `null` for a tab that works on both -- blocking a
   * guest is enforced at sign-in on our side and, at a controller venue,
   * reaches the controller through its own client-block call. */
  controllerGatedAs: string | null;
}

export const BLOCKING_TABS: readonly BlockingTab[] = [
  {
    id: "websites",
    label: "Websites & IPs",
    permissionKeys: ["content_filtering.read"],
    controllerGatedAs: "website-blocking",
  },
  {
    id: "guests",
    label: "Guests & devices",
    permissionKeys: ["guest_access.read"],
    controllerGatedAs: null,
  },
];

export function isBlockingTabId(value: unknown): value is BlockingTabId {
  return BLOCKING_TABS.some((t) => t.id === value);
}

/**
 * The tabs a caller holding `permissions` is offered.
 *
 * Fails open exactly as `filterNavGroupsByPermissions` does: `null`,
 * `undefined` and `[]` are "we don't know", not "denied", and return every
 * tab. A short, real grant set narrows. The backend enforces every request
 * regardless; this only stops a tab from being offered to someone whose every
 * request on it would 403.
 */
export function blockingTabsFor(
  permissions: readonly string[] | null | undefined,
): readonly BlockingTab[] {
  if (!permissions || permissions.length === 0) return BLOCKING_TABS;
  const granted = new Set(permissions);
  const allowed = BLOCKING_TABS.filter((t) => t.permissionKeys.some((k) => granted.has(k)));
  // The nav row is only offered when at least one of these keys is held, so
  // an empty result means the caller reached the URL directly. Show them
  // everything and let the backend answer, rather than an empty page.
  return allowed.length > 0 ? allowed : BLOCKING_TABS;
}

/**
 * Which tab opens.
 *
 * An explicit, offered `requested` tab always wins -- that is a deep link
 * (the Security overview, or an old `/website-blocking` bookmark) and it
 * must land where it says. Otherwise a controller-managed venue opens on the
 * first tab that works there, because opening on a panel that says "not
 * here" is a worse first screen than the one that does something.
 */
export function initialBlockingTab(
  requested: unknown,
  offered: readonly BlockingTab[],
  controllerManaged: boolean,
): BlockingTabId {
  if (isBlockingTabId(requested) && offered.some((t) => t.id === requested)) return requested;
  if (controllerManaged) {
    const working = offered.find((t) => t.controllerGatedAs === null);
    if (working) return working.id;
  }
  return (offered[0] ?? BLOCKING_TABS[0]).id;
}
