/**
 * Which floors a venue's Network Hardware screens may offer and group by.
 *
 * ## The defect this exists to prevent
 *
 * `stores/deviceStore.ts` held
 * `export const FLOORS = ["5F","4F","3F","2F","1F","GF"]` -- six strings,
 * hardcoded, identical for every venue on the platform. A hotel with
 * twelve floors, a mall with two basement levels, and a single-storey cafe
 * that wants no floor label at all were all shown the same six.
 *
 * It is the same shape as the `TEAMS` literal that `UserReports.tsx`
 * showed every venue as if it were their own data (fixed in FE #246), with
 * one extra sting: `FLOORS` was not only offered as input, it was used as
 * the *output* filter too --
 *
 *     FLOORS.filter((f) => devices.some((d) => d.floor === f))
 *
 * -- in two places on the location screen. The backend has always stored
 * `MonitoredHardware.floor` as free text (`String(50)`, nullable, with an
 * explicit comment that a venue's own floor naming varies too much to
 * constrain server-side), so a device registered on `"B1"` or `"7F"` --
 * through the API, or through any future client -- was accepted, stored,
 * and then **silently dropped from the floor tiles and filter chips**. Not
 * mislabelled: absent.
 *
 * ## Why this is not solved by making the array longer
 *
 * A longer array is still a guess, and it is still every venue's list
 * rather than this venue's. The list a venue actually has is already in
 * the data: it is the set of distinct floors on that venue's own hardware
 * rows, which the screen has already fetched. No new column, no new
 * endpoint, and nothing to keep in sync.
 *
 * Unlike guest teams, floors need no `GET /floors` to be real -- they are
 * a property of the rows themselves, so FE #246's principle applies here
 * while its mechanism is unnecessary.
 *
 * The one thing derived-from-data cannot do is name a floor that has no
 * hardware on it yet, which is every floor on the day a venue starts. So
 * the *input* is free text, with the venue's existing floors offered first
 * and a generous ladder behind them -- and the *grouping* is purely
 * derived, so whatever gets typed is grouped correctly forever after.
 */

/**
 * Suggestions offered to a venue that has not yet registered hardware on
 * any floor. Purely a starting point for a text field the user may ignore
 * or overwrite -- never a constraint, never a filter, and never rendered
 * as though it described this venue.
 */
export const FLOOR_SUGGESTION_LADDER: readonly string[] = [
  "B2",
  "B1",
  "GF",
  ...Array.from({ length: 20 }, (_, i) => `${i + 1}F`),
];

/**
 * Sort key placing floors the way a building does: basements below ground
 * level, then ascending storeys. Labels this cannot parse (`"Roof"`,
 * `"Annexe"`, `"Pool Deck"`) get the lowest rank, so they collect at the
 * end of the list rather than being dropped -- an unrecognised floor is
 * still a real floor, and guessing where "Roof" belongs in a numeric
 * stack would be inventing an ordering nobody stated.
 */
function floorRank(label: string): number {
  const trimmed = label.trim();
  const basement = /^b(?:asement)?\s*(\d*)$/i.exec(trimmed);
  if (basement) return -(basement[1] ? Number(basement[1]) : 1);
  if (/^(?:g|gf|ground(?:\s*floor)?)$/i.test(trimmed)) return 0;
  if (/^(?:m|mezz(?:anine)?)$/i.test(trimmed)) return 0.5;
  const numbered = /^(\d+)\s*(?:f|fl|floor|st|nd|rd|th)?$/i.exec(trimmed);
  if (numbered) return Number(numbered[1]);
  return Number.NEGATIVE_INFINITY;
}

/** Orders floor labels high-to-low, the way an elevator panel reads.
 * Unparseable labels keep a stable alphabetical order at the bottom. */
export function sortFloors(labels: Iterable<string>): string[] {
  return [...labels].sort((a, b) => {
    const ra = floorRank(a);
    const rb = floorRank(b);
    if (ra !== rb) return rb - ra;
    return a.localeCompare(b);
  });
}

/** A row this module can read a floor off. Structural, so both the demo
 * store's `MonitoredDevice` and the real API's `MonitoredDeviceRow`
 * satisfy it. */
interface HasFloor {
  floor: string;
}

/**
 * The floors this venue actually has hardware on -- the real list, in
 * building order.
 *
 * This replaces `FLOORS.filter(...)` everywhere hardware is grouped or
 * filtered by floor. Any label survives it, so a `"B1"` device is grouped
 * under `"B1"` instead of vanishing.
 *
 * Blank floors are excluded: `MonitoredHardware.floor` is nullable and the
 * service maps null to `""`, so a device with no floor recorded must not
 * conjure an empty tile. Callers that want to show those rows should count
 * them separately -- see `unplacedCount`.
 */
export function floorsInUse(devices: readonly HasFloor[]): string[] {
  return sortFloors(new Set(devices.map((d) => d.floor.trim()).filter((f) => f !== "")));
}

/** How many rows carry no floor at all. A single-storey cafe leaves this
 * blank for every device, and that is a legitimate answer, not an error --
 * so those rows must still be reachable on a screen that groups by floor. */
export function unplacedCount(devices: readonly HasFloor[]): number {
  return devices.filter((d) => d.floor.trim() === "").length;
}

/**
 * What the "Floor" field offers as suggestions: this venue's own floors
 * first (they are real, and are what the next device is most likely to
 * join), then the generic ladder for anything not yet used.
 *
 * The field itself stays free text. These are hints, not options.
 */
export function floorSuggestions(devices: readonly HasFloor[]): string[] {
  const own = floorsInUse(devices);
  const seen = new Set(own.map((f) => f.toLowerCase()));
  return [...own, ...FLOOR_SUGGESTION_LADDER.filter((f) => !seen.has(f.toLowerCase()))];
}

/**
 * Normalises what someone typed. Trimmed, and capped at the backend's own
 * `String(50)` so a paste cannot produce a 500 on save. Empty stays empty
 * -- "no floor" is a real answer for a venue with one storey.
 */
export function normalizeFloor(raw: string): string {
  return raw.trim().slice(0, 50);
}
