import type { LucideIcon } from "lucide-react";
import {
  Home,
  Users,
  Megaphone,
  FileText,
  Palette,
  ShieldCheck,
  Wrench,
  LifeBuoy,
  Settings,
} from "lucide-react";
import { CUSTOMER_NAVS, type CustomerLoginRole, type CustomerNavItem } from "@/lib/customerNav";
import { navItemAllowed } from "@/lib/customerNavPermissions";

/**
 * The venue owner's navigation: nine destinations, not twenty-six features.
 *
 * WHY THIS EXISTS
 * ---------------
 * `customerNav.ts` has 26 items in seven groups, and those groups are
 * byte-identical to `customerFeatureCatalog.ts`'s -- whose own docstring
 * says what it is for: "A feature id is the unit an owner grants to an
 * agent." The sidebar was the RBAC grant catalogue rendered. That is why it
 * has the granularity of an API surface: `customerNavPermissions.ts` maps
 * each id 1:1 onto a backend module (`dhcp.read`, `vlan.read`, `qos.read`,
 * `firewall.read`, `content_filtering.read`), so the taxonomy a cafe owner
 * navigated by was the one an engineer used to partition the API.
 *
 * The cost was not tidiness. A venue owner opens this to answer three
 * questions, and the answer to the most urgent one was scattered widest:
 *
 *   "how many guests today"  -> 4 destinations across 2 groups
 *   "why is the WiFi down"   -> 7 destinations across 4 of the 7 groups,
 *                               with the two most useful (Connection Tools,
 *                               Support Tickets) at positions 23 and 25 of 26
 *   "send an offer"          -> 5 destinations across 3 groups
 *
 * It was also mostly off-screen: 26 rows at 48px plus seven group labels is
 * ~1590px of nav in a ~740px well on a 900px laptop, so the fold landed
 * around item 12 and everything from Network down was never seen.
 *
 * WHAT THIS IS NOT
 * ----------------
 * Not a rename of the 26, and not a deletion of anything. Every feature id
 * below is a real, still-registered route: `customerFeatureHref()` remains
 * the single source of truth for where each one lives, every deep link,
 * bookmark and support link keeps working, and the command palette (Cmd-K)
 * can still reach all 26 by name. This changes what is *offered*, which is
 * the same distinction the permission filter already makes.
 *
 * Nor is it a second permission model. `sections` are ordinary feature ids
 * and are filtered by exactly the table in `customerNavPermissions.ts`.
 *
 * THE NAMES ARE THE POINT
 * -----------------------
 * If the nine are just prettier module names then nothing moved. Each one
 * below is named for something an owner would say out loud -- "Guests",
 * "Offers", "Fix a Problem" -- not for the domain behind it. The two that
 * were hardest: "Portal" became **Login Screen** (it is the screen guests
 * log in on; "Portal" collided so badly with the guest-facing captive portal
 * that the route had to become `/guest-portal`), and "Users" became
 * **Guests** (the product is called Wyfy *Guest*; "Users" sat next to "Guest
 * Groups", "Devices" and "Trusted Devices" with nothing in the labels to say
 * which held people and which held hardware).
 */
export interface CustomerDestination {
  id: string;
  label: string;
  icon: LucideIcon;
  /** Short line under the heading, in the owner's words. */
  blurb: string;
  /** Which sidebar block it sits in. `null` = ungrouped (Home, Settings). */
  group: "guests" | "wifi" | "health" | null;
  /**
   * Feature ids this destination contains, in the order their tabs render.
   * The first one the caller may actually open is where the destination
   * navigates to -- see `destinationHome()`.
   */
  sections: string[];
}

export const CUSTOMER_DESTINATIONS: CustomerDestination[] = [
  {
    id: "home",
    label: "Home",
    icon: Home,
    blurb: "How today is going",
    group: null,
    sections: ["dashboard"],
  },

  // -- What the venue makes money from -------------------------------------
  {
    id: "guests",
    label: "Guests",
    icon: Users,
    blurb: "Who connected, and when",
    group: "guests",
    // `network-activity` is already keyed to `guest_sessions.read`, the same
    // permission as `users` (customerNavPermissions.ts) -- the codebase
    // already knew these were one domain; only the sidebar disagreed.
    sections: ["users", "network-activity"],
  },
  {
    id: "offers",
    label: "Offers",
    icon: Megaphone,
    blurb: "Reach the guests you already have",
    group: "guests",
    sections: ["campaigns", "vouchers", "notification"],
  },
  {
    id: "reports",
    label: "Reports",
    icon: FileText,
    blurb: "Longer view, and downloads",
    group: "guests",
    sections: ["reports"],
  },

  // -- The thing the guest actually touches ---------------------------------
  {
    id: "login-screen",
    label: "Login Screen",
    icon: Palette,
    blurb: "What guests see before they get online",
    group: "wifi",
    // `business-hours` shares `captive_portal.read` with `portal`, and its
    // own note in customerNavPermissions.ts already calls it "a
    // captive-portal config surface... same domain as Portal itself".
    sections: ["portal", "business-hours"],
  },
  {
    id: "access",
    label: "Access Rules",
    icon: ShieldCheck,
    blurb: "Who gets on, and what they can reach",
    group: "wifi",
    sections: ["policies", "whitelist", "mac-auth", "teams", "website-blocking"],
  },

  // -- "Why is the WiFi down" ----------------------------------------------
  {
    id: "status",
    label: "Fix a Problem",
    icon: Wrench,
    blurb: "Is it working, and what to try",
    group: "health",
    // Named for the job, not the domain, and deliberately NOT "Diagnostics".
    //
    // That name has since been confirmed from the other direction: #216
    // replaced the old "Connection Tools" page with FixAProblem.tsx and
    // renamed the feature itself to "Fix a Problem", moving it to
    // roles ["owner", "agent"]. So the destination and its central section
    // now share a name. That is left as-is rather than papered over with a
    // per-section tab-label override: `debugging` leads the list, so the
    // destination opens straight onto the fix-it page and the first tab
    // reads as that page, the way an "Overview" tab does. The other three
    // are what you check when the tool says the network is fine.
    //
    // Role gating stays on the sections, never here. `debugging` becoming
    // owner+agent required no change to this file, which is the property
    // worth keeping: front-desk staff are the people standing in front of
    // the unhappy guest, and a `roles` field on a destination would have
    // frozen the old owner-only assumption in a second place.
    sections: ["debugging", "devices", "alerts", "isp-details"],
  },
  {
    id: "help",
    label: "Help",
    icon: LifeBuoy,
    blurb: "Ask us, or read how it works",
    group: "health",
    sections: ["tickets", "how-it-works"],
  },

  // -- Set once, then rarely -----------------------------------------------
  {
    id: "settings",
    label: "Settings",
    icon: Settings,
    blurb: "Staff, records, and network setup",
    group: null,
    // The last four are the old "Network" group: IP Addresses, Network
    // Zones, Port Forwarding, Call Priority. They are installer/MSP tasks --
    // a cafe owner will never port-forward -- and they were 6 of 26 rows,
    // 23% of the nav, at the same visual weight as Home. Demoted two levels
    // rather than deleted, because deleting them from the customer product
    // is a product decision, not a navigation one.
    sections: ["agents", "admin-logs", "dhcp", "vlans", "port-forwarding", "voip"],
  },
];

export const DESTINATION_GROUPS: { id: "guests" | "wifi" | "health"; label: string }[] = [
  { id: "guests", label: "Guests" },
  { id: "wifi", label: "WiFi" },
  { id: "health", label: "Health" },
];

const NAV_BY_ID: Record<string, CustomerNavItem> = Object.fromEntries(
  CUSTOMER_NAVS.map((n) => [n.id, n]),
);

/** Which destination owns a feature id, for active-state highlighting and
 * for the section tabs a feature page renders. */
export function destinationForFeature(featureId: string): CustomerDestination | undefined {
  return CUSTOMER_DESTINATIONS.find((d) => d.sections.includes(featureId));
}

/**
 * A destination's sections, narrowed to what this caller can actually open.
 *
 * Role and permissions compose exactly as they did before -- role first
 * (`CustomerNavItem.roles`, the sign-in landing preference), then the real
 * backend grants (`navItemAllowed`). Both only ever remove.
 *
 * `permissions` is `null`/`undefined` while the fetch is in flight or if it
 * failed, and `[]` for an account the backend resolved to no grants. All
 * three mean "we don't know", not "denied", and leave the section list
 * untouched -- the same fail-open direction, and for the same reason: an
 * extra visible entry is cosmetic, a missing one locks a paying customer out
 * of something they bought.
 */
export function sectionsFor(
  destination: CustomerDestination,
  role: CustomerLoginRole,
  permissions: readonly string[] | null | undefined,
): CustomerNavItem[] {
  const known = permissions && permissions.length > 0 ? new Set(permissions) : null;
  return destination.sections
    .map((id) => NAV_BY_ID[id])
    .filter((item): item is CustomerNavItem => !!item)
    .filter((item) => item.roles.includes(role))
    .filter((item) => (known ? navItemAllowed(item.id, known) : true));
}

/**
 * The nine destinations, minus any the caller cannot open a single section
 * of.
 *
 * THE RULE, stated once: **a destination is offered when the caller can open
 * at least one of its sections, and it then shows only the sections they can
 * open.** Hidden entirely at zero.
 *
 * The alternative -- always show all nine and let a destination open onto
 * nothing -- recreates one layer up the defect where a page advertised
 * screens the reader could not reach. Offering a door that opens onto an
 * empty room is worse than not offering it, because the reader concludes the
 * product is broken rather than that they lack a grant.
 *
 * The converse mistake would be requiring *all* sections, which would hide
 * "Guests" from a front-desk account that can read the guest list but not
 * the session log -- the exact population this nav exists for. Hence "any",
 * not "all".
 *
 * Note what this does NOT do: it never adds a destination, and it never
 * shows a section the old 26-item nav would have hidden. Every narrowing
 * still comes from `roles` and `navItemAllowed`.
 */
export function destinationsFor(
  role: CustomerLoginRole,
  permissions: readonly string[] | null | undefined,
): { destination: CustomerDestination; sections: CustomerNavItem[] }[] {
  return CUSTOMER_DESTINATIONS.map((destination) => ({
    destination,
    sections: sectionsFor(destination, role, permissions),
  })).filter((d) => d.sections.length > 0);
}

/** Where clicking a destination goes: its first openable section. There are
 * no separate destination routes -- the 26 feature routes remain canonical,
 * so a destination is a grouping in the sidebar, not a new URL to bookmark
 * or redirect. */
export function destinationHome(
  destination: CustomerDestination,
  role: CustomerLoginRole,
  permissions: readonly string[] | null | undefined,
): string | undefined {
  return sectionsFor(destination, role, permissions)[0]?.id;
}
