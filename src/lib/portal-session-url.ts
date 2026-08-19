/** Builds the real `/portal/session` URL -- same organizationId/
 * locationId/routerId this exact guest's portal link always carries (see
 * src/routes/portal.tsx's own search schema) -- for RouterOS's `dst`
 * field to land the guest's browser on once its own hotspot-login
 * processing finishes. `dst` used to point back at `/portal/success`
 * itself (see `submitHotspotLogin`'s own docstring there); that produced
 * a redundant second "you're connected" screen with its own full copy of
 * the connected-status UI, duplicating `/portal/session` (the real,
 * already-redesigned "you're connected" resting page) -- exactly the
 * extra unwanted page type the founder kept landing on. Landing the
 * guest on `/portal/session` directly instead means `/portal/success` is
 * now only ever visible for the brief moment between OTP/password/voucher
 * verification and that POST actually firing -- a few hundred ms at most,
 * not a second full page the guest has to sit through.
 *
 * Lives here rather than in `portal.success.tsx` because two different
 * routes need the identical URL: that page's `dst` field and its
 * cooldown-skip, and `portal.index.tsx`'s own document-load hand-off (see
 * that file's Real incident #4 comment). Importing a non-`Route` export
 * across route files is the exact anti-pattern vite.config.ts's
 * manualChunks comment documents at length (`c.index.tsx`), so this is a
 * plain lib module both can depend on.
 *
 * Always an absolute URL: every caller feeds it to a real navigation
 * (`window.location.assign`, or a form field RouterOS itself will
 * redirect to), never to the client-side router.
 */
export function buildSessionUrl(
  organizationId: string,
  locationId: string,
  routerId: string,
): string {
  const url = new URL("/portal/session", window.location.origin);
  url.searchParams.set("organizationId", organizationId);
  url.searchParams.set("locationId", locationId);
  url.searchParams.set("routerId", routerId);
  return url.toString();
}
