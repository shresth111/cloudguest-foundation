/**
 * What the "Omada site" field must contain, and why it is an id and never a
 * name.
 *
 * ## THE DEFECT
 *
 * The live QA integration was stored with `external_site_id: "wyfyguest"`
 * and `external_site_name: "wyfyguest"`. The controller's real site id is
 * `6aa3913c3ee1605f71ac35a1`. Three typed-entry fields -- this wizard's
 * Device step, `OmadaSiteMapping`'s legacy branch and the customer page's
 * step 2 -- each asked for the "site name", suggested `Default`, and wrote
 * the typed string into BOTH `external_site_id` and `external_site_name`.
 *
 * ## WHY A NAME CANNOT WORK
 *
 * Two independent reasons, both measured rather than reasoned about:
 *
 * 1. **The redirect carries the id.** Driven against the live controller on
 *    2026-09-12, `GET /portal/entry` answered with
 *    `...&site=6aa3913c3ee1605f71ac35a1&...` -- never `wyfyguest`. The
 *    backend compares that value against the stored one
 *    (`service.authorize_portal_client`) and refuses on a mismatch with the
 *    same opaque 403 every other failure returns. A name-stored integration
 *    therefore turns away EVERY guest at the venue, and the guest-visible
 *    symptom carries no hint of the cause.
 *
 * 2. **Every controller call is addressed by id.** The backend passes
 *    `external_site_id` straight through as `site_id` into
 *    `/{omadacId}/api/v2/sites/{siteId}/...` -- listing devices and clients,
 *    writing the external-portal configuration, disconnecting a guest. A
 *    name in that position addresses a site that does not exist.
 *
 * ## WHY THE OLD FIELD COPY PRODUCED EXACTLY THIS VALUE
 *
 * The instruction was right and the label was wrong. All three fields told
 * the operator the correct method -- "read the `site=` value out of the
 * address bar when the sign-in page appears" -- which yields the id. Then
 * they called the field the site NAME and offered `Default` as the
 * placeholder. `Default` is a display name; even a single-site controller's
 * `site=` parameter is an id. An operator who trusts the label over the
 * method types a name, and nothing downstream ever contradicts them.
 *
 * ## THE SHAPE, AND HOW CONFIDENT IT IS
 *
 * Omada site ids are MongoDB ObjectIds: 24 lowercase hex characters.
 * VERIFIED on one controller (Omada Software Controller 5.15.24.19,
 * site `wyfyguest` = `6aa3913c3ee1605f71ac35a1`); the same shape is what
 * `omadacId` uses at 32 hex. UNVERIFIED across other controller
 * generations, and deliberately checked in ONE place on each side of the
 * wire so that widening it, if a real id ever fails this, is a one-line
 * change rather than a hunt.
 *
 * Refusing at the boundary is the point. The alternative -- what shipped --
 * is to accept the value, store it, pass it into every controller call, and
 * discover the mistake as "guests at this venue cannot get online", with no
 * error anywhere that names the field.
 */

/** 24 lowercase hex characters. See this module's docstring. */
export const OMADA_SITE_ID_PATTERN = /^[0-9a-f]{24}$/;

/** A real one, for placeholders and copy. Our own controller's. */
export const OMADA_SITE_ID_EXAMPLE = "6aa3913c3ee1605f71ac35a1";

export function isOmadaSiteId(value: string): boolean {
  return OMADA_SITE_ID_PATTERN.test(value.trim());
}

/**
 * The error to show beside the field, or `null` when the value is usable.
 *
 * Empty is reported as a separate, plainer message: an operator who has not
 * filled the field in yet is not making the name-versus-id mistake, and
 * telling them about hex digits before they have typed anything is noise.
 */
export function omadaSiteIdError(value: string): string | null {
  const v = value.trim();
  if (!v) return "Required — the controller cannot let a guest online without it";
  if (isOmadaSiteId(v)) return null;
  return `That looks like a site name, not a site id. Omada's site id is 24 letters and digits (for example ${OMADA_SITE_ID_EXAMPLE}) — it is the site= value in the guest's sign-in URL. A name here refuses every guest at this venue.`;
}
