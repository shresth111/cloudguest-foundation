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
  /** The guest's CURRENT language, carried across the document boundary --
   * see this parameter's own note below. Optional: every caller that has no
   * runtime in hand still compiles and still produces exactly the URL it
   * used to. */
  language?: string,
  /** RouterOS's own `$(mac)`. The one identifier that survives this
   * document boundary on a browser where Web Storage throws -- iOS's
   * captive sheet being the case that matters. `/portal/session` lands as
   * a brand-new document, so without this it has no way to re-discover a
   * session it cannot read from storage, and shows a guest who just
   * successfully signed in "your session has expired" while their
   * internet works perfectly. */
  deviceMac?: string,
): string {
  const url = new URL("/portal/session", window.location.origin);
  url.searchParams.set("organizationId", organizationId);
  url.searchParams.set("locationId", locationId);
  url.searchParams.set("routerId", routerId);
  if (language) url.searchParams.set("lang", language);
  if (deviceMac) url.searchParams.set("mac", deviceMac);
  return url.toString();
}

/* WHY `lang` IS ON THIS URL AND NOT IN STORAGE.
 *
 * A guest who switches the portal to Tamil and then signs in crosses a real
 * document boundary: `portal.success.tsx` fires a full-page form POST at
 * RouterOS, RouterOS redirects the browser to this `dst`, and a brand-new
 * document loads with a brand-new React tree. Everything held in memory --
 * including `PortalRuntimeContext`'s `language` state -- is gone.
 *
 * `localStorage` is what normally carries a choice across that boundary, and
 * it is exactly what cannot be relied on here. Per
 * docs/captive-portal-v7-design-spec.md §0.2, Apple's Captive Network
 * Assistant does not merely fail to persist: touching `localStorage` THROWS.
 * `persistLanguage` already swallows that (best-effort by design), so on iOS
 * the write silently never happened, and after the POST the portal fell back
 * to the venue's `defaultLanguage` -- an English portal for a guest who had
 * just chosen Tamil, on the single screen (a live session, a countdown, a
 * disconnect button) where being able to read it matters most.
 *
 * A query parameter is the one channel that genuinely survives this trip: it
 * is part of the URL RouterOS itself redirects to, so it is carried by the
 * navigation rather than by any storage the webview may refuse. It needs no
 * new backend field, no cookie (which the CNA is equally free to drop), and
 * it degrades to today's behaviour when absent.
 *
 * Deliberately NOT a replacement for `persistLanguage`. Storage still wins on
 * every browser where it works, and covers the case this cannot: a returning
 * guest on a later visit, where there is no URL to carry anything. The two
 * are complementary, and `PortalRuntimeContext` reads the URL first because a
 * `lang` in it is this session's own explicit, just-made choice, while a
 * stored value may be months old. */
