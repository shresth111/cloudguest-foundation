/**
 * How a guest is named in operator-facing surfaces (Reports, the Users
 * table, the dashboard's recent-guest list).
 *
 * ## Why this is its own module
 *
 * The resolution used to live inline in `customer.service.ts` as
 * `guest?.display_name || "Guest"`. That single `|| "Guest"` is the whole
 * of the "every user is called Guest" defect: it replaced the one
 * identifying fact the row actually carries (`identifier`) with a word
 * that reads like a real name, so an operator could not tell three
 * different people apart, and could not tell "this venue doesn't collect
 * names" apart from "this guest is literally called Guest".
 *
 * Extracted here -- same reasoning as `csv-export.ts` -- so the rule is
 * stated once, pinned by `scripts/test-guest-identity.mjs`, and cannot be
 * quietly reimplemented slightly differently by the next surface that
 * needs to name a guest.
 *
 * ## The data, as it actually is
 *
 * `Guest.identifier` is `NOT NULL` (backend
 * `app/domains/guest/models.py`): it is the phone number or email the
 * guest presented at sign-in, and it is always present.
 *
 * `Guest.display_name` is nullable and, in practice, almost always NULL.
 * There is exactly one code path in the whole backend that ever writes a
 * non-null value -- `GuestService.update_guest_profile`, reached only from
 * `POST /guest/profile`, which is only called by the post-connect
 * `GuestProfileNudge` card. That card renders only when the venue has
 * turned on `collect_guest_name`, **which defaults to false for every
 * venue**. Every login path (OTP included) creates the guest row with
 * `display_name=None` and sets `identifier` alone.
 *
 * So a blank name is not a join bug and not missing plumbing -- it is the
 * honest state of a product that does not ask guests their name unless the
 * venue opts in. The UI must say that rather than paper over it, which is
 * what `GUEST_NAME_NOT_COLLECTED_NOTICE` below is for.
 *
 * ## Masking
 *
 * Both fields are already masked server-side at serialization time when
 * the caller's masking context says so -- `display_name` is `MaskedName`
 * and `identifier` is `MaskedIdentifier` (`app/common/masking.py`). So
 * everything this module returns is whatever the API chose to disclose;
 * nothing here widens disclosure, and nothing here should re-mask a value
 * the server already masked. (Note that `mask_mac` in that same backend
 * module is a documented no-op while `mask_name`/`mask_identifier` are
 * not -- do not reason about one from the other.)
 */

/** The subset of `RawGuest` (`customer.service.ts`) this resolution reads. */
export interface GuestIdentitySource {
  identifier?: string | null;
  display_name?: string | null;
}

export interface GuestIdentity {
  /**
   * The guest's real, self-supplied name, or `null` when none is on file.
   *
   * Never a placeholder. Surfaces that show the identifier in its own
   * column (Reports' "Mobile Number", the Users table's "Phone") should
   * render this and let a missing name read as an explicit blank -- see
   * `GUEST_NAME_NOT_COLLECTED_NOTICE` for the copy that explains the
   * blank, which those surfaces are expected to show alongside it.
   */
  name: string | null;
  /** The identifier when it is an email address, else `""`. */
  email: string;
  /** The identifier when it is a phone number, else `""`. */
  phone: string;
  /**
   * Single-column identity, for surfaces that have nowhere else to put
   * the identifier (the dashboard's recent-guest list, which shows only a
   * name and an email). Falls back to the identifier -- the one
   * identifying fact the row carries -- and only then to a clearly
   * non-name marker.
   */
  label: string;
}

/**
 * Shown by any surface that renders `identity.name` and finds it blank for
 * every row. Names the setting an operator would actually have to turn on,
 * so the blank column reads as a deliberate product state with a fix,
 * rather than as a broken join.
 */
export const GUEST_NAME_NOT_COLLECTED_NOTICE =
  "No guest names on file. Guests are identified by the phone number or email they " +
  "sign in with; this venue only collects a name if “Ask for guest name” is turned " +
  "on under Portal › After they connect.";

/**
 * Used only when there is no guest row to read at all (a session whose
 * `guest_id` matched nothing -- a failed fetch, or a guest created after
 * the page loaded). Deliberately not a name-shaped word: it must not be
 * mistakable for something the guest actually called themselves.
 */
export const UNIDENTIFIED_GUEST_LABEL = "Unknown guest";

export function identityFromGuest(guest: GuestIdentitySource | undefined): GuestIdentity {
  // `?.trim() ||` rather than `??`: a guest who submitted only whitespace,
  // or a row holding "", must be treated as having no name on file rather
  // than rendering an invisible one.
  const name = guest?.display_name?.trim() || null;
  const identifier = guest?.identifier?.trim() ?? "";
  const isEmail = identifier.includes("@");
  return {
    name,
    email: isEmail ? identifier : "",
    phone: !isEmail ? identifier : "",
    label: name ?? (identifier || UNIDENTIFIED_GUEST_LABEL),
  };
}

/**
 * True when a report/table has a name column but not one row in it carries
 * a real name -- the exact condition `GUEST_NAME_NOT_COLLECTED_NOTICE`
 * explains. Returns false for an empty result set (there is nothing to
 * explain) and false as soon as a single real name is present (the column
 * is working; those rows are simply the guests who filled the card in).
 */
export function shouldExplainMissingGuestNames(
  rows: readonly { readonly [key: string]: string | number | null }[] | null,
  nameKey = "name",
): boolean {
  if (!rows || rows.length === 0) return false;
  if (!(nameKey in rows[0])) return false;
  return rows.every((r) => r[nameKey] == null || r[nameKey] === "");
}
