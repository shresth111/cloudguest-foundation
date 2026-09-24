/**
 * Security -> Web Filtering, the pure half: the category picker's selection
 * rules, and every backend answer turned into a sentence a venue owner can
 * act on. No React, no requests -- executed directly by
 * `scripts/test-controller-venue-network-screens.mjs`.
 */
import type {
  WebCategory,
  WebFilterPolicySource,
  WebFilterRouterState,
} from "@/types/dns-filtering";

// ---------------------------------------------------------------------------
// The catalogue.
// ---------------------------------------------------------------------------

/** Classes Cloudflare will not let a policy block. The backend refuses them
 * with a 400, so the picker never offers them. */
const UNSELECTABLE_CLASSES = new Set(["noBlock", "removalPending"]);

export function isSelectable(c: Pick<WebCategory, "categoryClass">): boolean {
  return !UNSELECTABLE_CLASSES.has(c.categoryClass);
}

/** Every category and subcategory, by id. */
export function flattenCategories(items: WebCategory[]): Map<number, WebCategory> {
  const out = new Map<number, WebCategory>();
  const walk = (c: WebCategory) => {
    out.set(c.id, c);
    c.subcategories.forEach(walk);
  };
  items.forEach(walk);
  return out;
}

/** Security threats first (it is the one most venues want), then the rest in
 * the catalogue's own order. */
export function orderedGroups(items: WebCategory[]): WebCategory[] {
  return [...items.filter((c) => c.isSecurity), ...items.filter((c) => !c.isSecurity)];
}

/** The ids ticking a group covers: the group itself and every selectable
 * subcategory. Sent explicitly, so the list means the same thing whether or
 * not Cloudflare treats a parent id as covering its children. */
export function groupIds(c: WebCategory): number[] {
  return [c, ...c.subcategories].filter(isSelectable).map((x) => x.id);
}

export function groupState(selected: ReadonlySet<number>, c: WebCategory): "all" | "some" | "none" {
  const ids = groupIds(c);
  if (ids.length === 0) return "none";
  const n = ids.filter((id) => selected.has(id)).length;
  return n === 0 ? "none" : n === ids.length ? "all" : "some";
}

/** Tick or untick a group (all of it) or a single subcategory. Unticking a
 * subcategory also unticks its group's own id: "the whole group" is no
 * longer true. Returns a new set. */
export function toggleCategory(
  selected: ReadonlySet<number>,
  c: WebCategory,
  on: boolean,
  parent?: WebCategory,
): Set<number> {
  const next = new Set(selected);
  const ids = parent ? [c.id] : groupIds(c);
  for (const id of ids) {
    if (on) next.add(id);
    else next.delete(id);
  }
  if (parent) {
    if (!on) next.delete(parent.id);
    else if (parent.subcategories.filter(isSelectable).every((s) => next.has(s.id))) {
      if (isSelectable(parent)) next.add(parent.id);
    }
  }
  return next;
}

/** Sorted and de-duplicated, as the backend stores it. */
export function canonicalIds(ids: Iterable<number>): number[] {
  return [...new Set(ids)].sort((a, b) => a - b);
}

export function sameIds(a: Iterable<number>, b: Iterable<number>): boolean {
  const x = canonicalIds(a);
  const y = canonicalIds(b);
  return x.length === y.length && x.every((v, i) => v === y[i]);
}

/** Names for a list of ids, a group standing in for its whole membership so
 * "Security threats" is not followed by every one of its subcategories. Ids
 * the catalogue does not know (it changes on Cloudflare's schedule) are
 * counted, not invented. */
export function describeIds(
  ids: Iterable<number>,
  items: WebCategory[],
): { names: string[]; unknown: number } {
  const set = new Set(ids);
  const names: string[] = [];
  const covered = new Set<number>();
  for (const g of items) {
    if (groupState(set, g) === "all") {
      names.push(g.name);
      groupIds(g).forEach((id) => covered.add(id));
      covered.add(g.id);
    }
  }
  const byId = flattenCategories(items);
  let unknown = 0;
  for (const id of set) {
    if (covered.has(id)) continue;
    const c = byId.get(id);
    if (c) names.push(c.name);
    else unknown += 1;
  }
  return { names, unknown };
}

// ---------------------------------------------------------------------------
// Where the venue's list comes from.
// ---------------------------------------------------------------------------

export function policySourceSentence(source: WebFilterPolicySource): string {
  switch (source) {
    case "location":
      return "This venue uses its own list.";
    case "organization":
      return "This venue uses your account's default list.";
    default:
      return "Nothing is chosen for this venue yet, and your account has no default list.";
  }
}

// ---------------------------------------------------------------------------
// Router status.
// ---------------------------------------------------------------------------

export const ROUTER_STATE_LABEL: Record<WebFilterRouterState, string> = {
  active: "On",
  disabled: "Off",
  pending: "Being switched on",
  failed: "Didn't switch on",
};

// ---------------------------------------------------------------------------
// Errors.
// ---------------------------------------------------------------------------

interface ActionFailure {
  status?: number | null;
  message?: string;
  data?: Record<string, unknown>;
}

export interface WebFilterErrorExplained {
  /** i18n key under `webFilteringPage.err`, or null when the backend's own
   * message is the sentence. */
  key: string | null;
  sentence: string;
  /** The backend's or router's own words, shown under the sentence. */
  detail: string | null;
}

export const NOT_SET_UP_SENTENCE = "Not set up yet for this account — contact support.";

/**
 * One sentence per refusal cloud-guest#307 can give on enable, disable or
 * bypass hardening. Anything unrecognised falls back to the backend's own
 * message: a real reason beats a generic one.
 */
export function webFilterErrorSentence(
  err: ActionFailure | null | undefined,
): WebFilterErrorExplained {
  const data = err?.data ?? {};
  const code = typeof data.code === "string" ? data.code : null;
  const message = err?.message?.trim() || null;
  const say = (key: string, sentence: string, detail: string | null = null) => ({
    key,
    sentence,
    detail,
  });
  if (err?.status === 503) return say("notSetUp", NOT_SET_UP_SENTENCE);
  switch (code) {
    case "ROUTEROS_TOO_OLD":
    case "ROUTEROS_VERSION_UNKNOWN":
      return say(
        "tooOld",
        "This router's software is too old for web filtering, so nothing was changed. Contact support to update it.",
        message,
      );
    case "DNS_BOOTSTRAP_MISSING":
      return say(
        "noBootstrap",
        "This router has no website lookup settings of its own for us to start from, so nothing was changed. Contact support.",
        message,
      );
    case "TRUST_SETTING_UNKNOWN":
      return say(
        "trustUnknown",
        "We couldn't read one of this router's security settings, so nothing was changed. Contact support.",
        message,
      );
    case "DNS_CHANGED_EXTERNALLY":
      return say(
        "changedElsewhere",
        "This router's website lookup settings were changed outside Wyfy Guest, so we left them as they are. Contact support.",
        message,
      );
    case "BYPASS_ANCHOR_MISSING":
      return say(
        "bypassAnchor",
        "This router is missing the basic protection rules this option builds on, so nothing was changed. Contact support.",
        message,
      );
    default:
      break;
  }
  if (data.rolled_back === true) {
    return say(
      "rolledBack",
      "The check after switching failed, so the router was switched back to its own settings. Guests can browse as before.",
      message,
    );
  }
  if (data.rolled_back === false) {
    return say(
      "notRolledBack",
      "The check after switching failed and we could not confirm the router switched back. Guests may not be able to open websites — contact support now.",
      message,
    );
  }
  if (typeof data.resource === "string" && typeof data.limit === "number") {
    return say(
      "ceiling",
      "Web filtering can't be switched on for another router right now. Contact support.",
      message,
    );
  }
  return { key: null, sentence: message ?? "Something went wrong. Try again.", detail: null };
}
