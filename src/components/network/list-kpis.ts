/**
 * Stat tiles derived from the list a network page already loaded.
 *
 * ## Why there is no separate KPI request
 *
 * Every one of these pages used to pair its table with a `getKpis()` call
 * that hit the SAME endpoint with the SAME `page_size=100` -- a second,
 * byte-identical request on every page load (two of the four `/dhcp` and
 * `/port-forwarding` requests a live capture showed came from exactly this).
 * The list response already carries everything the three tiles need, so they
 * are computed from it here instead.
 *
 * ## Why the counts are qualified rather than stated flat
 *
 * The old KPI call was also quietly wrong: it reported `total_items` -- the
 * true server-side total -- next to `enabled`/`disabled` counted over at most
 * the rows in one page. Past 100 rows the three tiles stopped summing, and
 * nothing on screen said so.
 *
 * There is no honest way to get an exact enabled count out of these endpoints
 * today: none of `/vlans`, `/dhcp-pools`, `/port-forwarding/rules`,
 * `/qos-rules`, `/content-filter-rules` or `/hotspot-profiles` accepts an
 * `is_enabled` filter (verified against each domain's `router.py`), and every
 * one of them caps `page_size` at 100 -- so a `page_size=1` count read has
 * nothing to filter on, and walking every page would be far more traffic than
 * the duplicate request this replaces. So the numbers stay exact for the rows
 * actually in hand and the tile says which rows those were. A count that
 * looks exact and is not is worse than a count that admits its own scope.
 */

/**
 * The `hint` for a stat tile counted over `counted` rows when the server says
 * there are `total` in all -- `undefined` (no hint, the number is the whole
 * truth) whenever the loaded rows already cover the total.
 *
 * `total` of 0 while rows are still loading also yields no hint: an empty
 * table with "counted across the first 0 of 0" on it is noise, not honesty.
 */
export function partialCountHint(counted: number, total: number): string | undefined {
  if (total <= counted) return undefined;
  return `counted across the ${counted} loaded of ${total}`;
}
