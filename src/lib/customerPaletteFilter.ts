import { defaultFilter } from "cmdk";

/**
 * The customer command palette's ranking (cmdk `filter`), so that what you
 * typed by NAME beats what merely matches a synonym or a fuzzy subsequence.
 *
 * Why not cmdk's default: it is one fuzzy score over one string. Once every
 * screen also carries synonyms (`CustomerNavItem.keywords` -- needed because
 * most screens are tabs now, not sidebar rows), a long synonym list contains
 * the letters of nearly any short query in order, and "reports" picked Fix a
 * Problem while "netlogs" picked Login Page Offers. So the tiers are explicit:
 *
 *   1    the entry's own text starts with the query ("vou" -> Vouchers)
 *   0.9  a word of its own text starts with the query ("zones" -> Network Zones)
 *   0.8  its own text contains the query
 *   0.7  a synonym starts with the query ("coupon" -> Vouchers)
 *   0.6  a synonym contains it
 *   <=0.5 cmdk's own fuzzy score over its own text, halved -- the behaviour
 *         this replaced, kept as the last resort so typos still find things
 *   0    no match (hidden)
 *
 * "Its own text" is the item's `value`: translated name, section, English
 * name, English section -- see CustomerCommandPalette.
 */
export function rankCustomerPaletteMatch(
  value: string,
  search: string,
  keywords?: string[],
): number {
  const q = search.trim().toLowerCase();
  if (!q) return 1;
  const v = value.toLowerCase();
  if (v.startsWith(q)) return 1;
  if (v.split(/\s+/).some((w) => w.startsWith(q))) return 0.9;
  if (v.includes(q)) return 0.8;
  const kws = (keywords ?? []).map((k) => k.toLowerCase());
  if (kws.some((k) => k.startsWith(q) || k.split(/\s+/).some((w) => w.startsWith(q)))) return 0.7;
  if (kws.some((k) => k.includes(q))) return 0.6;
  return defaultFilter(value, search) * 0.5;
}

/**
 * The lowest score worth showing for `search`, given every screen entry.
 *
 * cmdk (1.1.1) sorts items within a group but does not reorder the groups
 * themselves here, so the palette's FIRST hit -- the one Enter opens -- is
 * the first match in menu order, not the best one. Before synonyms that was
 * already why "staff" opened Traffic Lens. So rather than rely on sorting,
 * only the best band is shown: if any screen matches by its own name, the
 * synonym-only and fuzzy-only matches are hidden; if none does but a synonym
 * matches, the fuzzy ones are hidden; only when nothing matches either way
 * does the fuzzy fallback show (typos).
 */
export function customerPaletteFloor(
  search: string,
  entries: ReadonlyArray<{ value: string; keywords?: string[] }>,
): number {
  if (!search.trim()) return 0;
  const best = Math.max(
    0,
    ...entries.map((e) => rankCustomerPaletteMatch(e.value, search, e.keywords)),
  );
  return best >= 0.8 ? 0.8 : best >= 0.6 ? 0.6 : Number.MIN_VALUE;
}
