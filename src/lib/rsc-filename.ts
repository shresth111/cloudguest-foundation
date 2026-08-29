/**
 * Filenames for downloaded RouterOS `.rsc` scripts.
 *
 * RouterOS's `/import file=<name>` takes the filename as a bare, unquoted
 * parameter, so **a space in the name ends the parameter**. A venue called
 * "huda city center" produced `mikrotik-huda city center.rsc`, and the
 * documented command then failed with:
 *
 *     /import file=mikrotik-huda city center.rsc
 *     bad parameter city (line 1 column 32)
 *
 * — RouterOS reading `city` as the next parameter. Reported live on
 * 2026-08-27, on a router whose script was otherwise fine. Nothing in the
 * failure points at the filename, so it reads as a broken script rather
 * than a broken name.
 *
 * The guided-setup path already slugified (`guided-setup/rsc.ts`); the
 * Advanced panel interpolated `router.locationName` raw. This is the one
 * place both now go through, so they cannot diverge again.
 */

/** Lowercase, alphanumerics and single dashes only — safe as a bare
 * RouterOS parameter, and still recognisable in a folder of downloads. */
export function rscSlug(name: string): string {
  return (name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * The filename offered for a full-config download.
 *
 * Falls back to the router id when the venue name slugifies to nothing —
 * a name written entirely in a non-Latin script does, and an empty
 * `mikrotik-.rsc` would be worse than an unmemorable but valid one. The id
 * is already `[a-f0-9-]`, so it needs no further cleaning.
 */
export function routerRscFilename(
  locationName: string | null | undefined,
  routerId: string,
): string {
  const slug = rscSlug(locationName ?? "");
  return `mikrotik-${slug || routerId}.rsc`;
}
