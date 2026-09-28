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
  WebFilterRouterStatus,
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

/** One translatable sentence: `template` is the English with `{{name}}`
 * placeholders (also the i18n default), `params` fills them. */
export interface WebFilterPhrase {
  /** i18n key under `webFilteringPage.err`. */
  key: string;
  template: string;
  params?: Record<string, string | number>;
}

export interface WebFilterErrorExplained {
  /** i18n key under `webFilteringPage.err`, or null when the backend's own
   * message is the sentence. */
  key: string | null;
  /** The whole explanation in English, placeholders filled -- what a
   * translator-less render shows. */
  sentence: string;
  /** English template for `key` and its placeholder values. */
  template?: string;
  params?: Record<string, string | number>;
  /** Further sentences shown after the first (e.g. how the closest category
   * set differs). */
  more?: WebFilterPhrase[];
  /** The backend's or router's own words, shown under the sentence. */
  detail: string | null;
  /** A category list the owner can load into the picker with one click (the
   * closest set already in use). Loading it never saves. */
  suggestedIds?: number[] | null;
}

/** What the page already knows that makes a refusal concrete: the catalogue
 * (category names) and which of this venue's routers are filtering now. */
export interface WebFilterErrorContext {
  items?: WebCategory[];
  activeRouterNames?: string[];
}

export const NOT_SET_UP_SENTENCE = "Not set up yet for this account — contact support.";

export function fillTemplate(
  template: string,
  params: Record<string, string | number> = {},
): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (whole, name: string) =>
    name in params ? String(params[name]) : whole,
  );
}

/** Render an explanation through a translator (`t` in the view; plain
 * English by default). Keys are relative to `webFilteringPage.err`. */
export function renderWebFilterError(
  e: WebFilterErrorExplained,
  tr: (key: string, template: string, params?: Record<string, string | number>) => string = (
    _k,
    tpl,
    p,
  ) => fillTemplate(tpl, p),
): string {
  const first = e.key && e.template ? tr(e.key, e.template, e.params) : e.sentence;
  return [first, ...(e.more ?? []).map((m) => tr(m.key, m.template, m.params))].join(" ");
}

function idList(v: unknown): number[] | null {
  return Array.isArray(v) && v.every((x) => typeof x === "number") ? (v as number[]) : null;
}

function namesFor(ids: number[], items: WebCategory[] | undefined): string {
  const byId = items ? flattenCategories(items) : new Map<number, WebCategory>();
  return ids.map((id) => byId.get(id)?.name ?? `#${id}`).join(", ");
}

/**
 * One sentence per refusal cloud-guest#307 can give on a list save, enable,
 * disable or bypass hardening. Anything unrecognised falls back to the
 * backend's own message: a real reason beats a generic one.
 */
export function webFilterErrorSentence(
  err: ActionFailure | null | undefined,
  ctx: WebFilterErrorContext = {},
): WebFilterErrorExplained {
  const data = err?.data ?? {};
  const code = typeof data.code === "string" ? data.code : null;
  const message = err?.message?.trim() || null;
  const say = (
    key: string,
    template: string,
    detail: string | null = null,
    extra: Partial<WebFilterErrorExplained> = {},
  ): WebFilterErrorExplained => {
    const out: WebFilterErrorExplained = {
      key,
      template,
      params: extra.params,
      sentence: "",
      detail,
      ...extra,
    };
    out.sentence = renderWebFilterError(out);
    return out;
  };
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

  // A NEW distinct category set past the platform's location cap
  // (CategorySetLimitError). Nothing was written; the closest set in use is
  // offered, never applied for them.
  if (typeof data.limit === "number" && typeof data.in_use === "number") {
    const nearest = idList(data.nearest_category_ids);
    const adds = idList(data.nearest_adds) ?? [];
    const removes = idList(data.nearest_removes) ?? [];
    const more: WebFilterPhrase[] = [];
    if (nearest) {
      const a = namesFor(adds, ctx.items);
      const r = namesFor(removes, ctx.items);
      if (adds.length && removes.length) {
        more.push({
          key: "closestAddsRemoves",
          template: "The closest existing set differs by: adding {{adds}}, removing {{removes}}.",
          params: { adds: a, removes: r },
        });
      } else if (adds.length) {
        more.push({
          key: "closestAdds",
          template: "The closest existing set differs by: adding {{adds}}.",
          params: { adds: a },
        });
      } else if (removes.length) {
        more.push({
          key: "closestRemoves",
          template: "The closest existing set differs by: removing {{removes}}.",
          params: { removes: r },
        });
      }
    }
    return say(
      "setLimit",
      "Your account can use up to {{limit}} different filter sets and all are in use.",
      null,
      { params: { limit: data.limit }, more, suggestedIds: nearest },
    );
  }

  // Clearing the list while routers still filter with it
  // (DnsFilteringRoutersStillEnabledError). The backend sends a count; the
  // page names the routers when its own statuses account for all of them.
  if (typeof data.routers === "number" || Array.isArray(data.routers)) {
    const count = Array.isArray(data.routers) ? data.routers.length : (data.routers as number);
    const fromBackend = Array.isArray(data.routers)
      ? data.routers
          .map((r) =>
            typeof r === "string"
              ? r
              : r && typeof r === "object" && typeof (r as { name?: unknown }).name === "string"
                ? (r as { name: string }).name
                : null,
          )
          .filter((n): n is string => !!n)
      : [];
    const names =
      fromBackend.length === count && count > 0
        ? fromBackend
        : ctx.activeRouterNames && ctx.activeRouterNames.length === count && count > 0
          ? ctx.activeRouterNames
          : null;
    return names
      ? say("routersStillOn", "Turn off web filtering on these routers first: {{routers}}.", null, {
          params: { routers: names.join(", ") },
        })
      : say(
          "routersStillOnCount",
          "Turn off web filtering on {{count}} router(s) at this venue first, or keep at least one category.",
          null,
          { params: { count } },
        );
  }

  if (typeof data.resource === "string" && typeof data.limit === "number") {
    return say(
      "ceiling",
      "Web filtering can't take on another category list right now. Contact support.",
      message,
    );
  }
  return { key: null, sentence: message ?? "Something went wrong. Try again.", detail: null };
}

/** Filtering, but the move to the venue's current list failed: the router
 * still blocks with its previous list (cloud-guest#307 keeps it `active` and
 * records the failure). */
export function stillOnPreviousSet(
  s: Pick<WebFilterRouterStatus, "state" | "devicePushStatus"> | null | undefined,
): boolean {
  return s?.state === "active" && s.devicePushStatus === "failed";
}
