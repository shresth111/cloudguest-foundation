import type { RuntimeSession, RuntimeSessionAuthMethod } from "@/types/portal-runtime";
import type { NextCampaign } from "@/types/campaign";

/**
 * Demo-only helpers for the prospect-facing captive-portal DEMO
 * (src/routes/preview.portal.demo.tsx, gated on `PortalRuntimeState.demoMode`).
 *
 * None of this touches the network, a backend, SMS/RADIUS or the NAS -- it is
 * the believable DUMMY substitute for the real `portalRuntimeService.*` login
 * calls, so a prospect clicking the demo sees the whole flow run
 * (identifier -> OTP -> campaign -> "You're connected" -> the venue's own
 * post-login page) instead of a dead placeholder. Kept out of any component
 * module on purpose (react-refresh only wants component exports in a
 * component file, and all of these are plain data).
 */

/** The OTP the demo pre-fills into the code field so a prospect can tap
 * Verify immediately. Any 6-digit code is accepted in demo mode; this is
 * only the convenient default the field starts on. */
export const DEMO_OTP_CODE = "123456";

/**
 * A fully-shaped, fake in-memory `RuntimeSession` for the demo's "connected"
 * screen. Every id is an obvious demo placeholder; `hasPassword` is false so
 * the demo mirrors a first-time OTP guest. Nothing here is ever sent anywhere
 * -- it exists only to drive the self-contained connected card.
 */
export function buildDemoSession(
  identifier: string,
  authMethod: RuntimeSessionAuthMethod,
): RuntimeSession {
  const nowIso = new Date().toISOString();
  return {
    guestId: "demo-guest",
    identifier,
    sessionId: "demo-session",
    deviceId: "demo-device",
    routerId: "demo",
    locationId: "demo",
    organizationId: "demo",
    authMethod,
    status: "active",
    startedAt: nowIso,
    endedAt: null,
    lastActivityAt: nowIso,
    ipAddress: "192.0.2.10",
    bytesUploaded: 0,
    bytesDownloaded: 0,
    dataLimitMb: null,
    sessionTimeoutMinutes: null,
    isNewGuest: true,
    deviceMacAddress: null,
    deviceName: "This device",
    hasPassword: false,
    // The demo mirrors a first-time guest who has answered nothing: both
    // false, so the walkthrough shows whatever the previewed venue's own
    // post-connect settings would actually ask for.
    hasProfile: false,
    hasOpenedReviewLink: false,
  };
}

/* ── The demo account's own active campaign ─────────────────────
 *
 * The walkthrough used to be handed no campaign at all, so its whole
 * campaign step -- the one thing an operator builds on the Campaigns page
 * and the one part of the guest journey a prospect is most likely to be
 * sold on -- simply never appeared. The demo now runs
 * sign-in -> campaign (this) -> connected -> the venue's own post-login
 * page.
 *
 * A BUILT-IN fixture, and that is the honest shape here rather than a
 * shortcut: on `demo.wyfyguest.com` the session is the browser-only demo
 * login (`admin@example.com`/`test` -- see `src/lib/demo-host.ts` and
 * `isDemo()`), so there is no backend behind this tab at all. Nothing can
 * resolve a real campaign -- `campaignService.resolveActivePreviewCampaign`
 * is never called on this path -- and the demo account's Campaigns page is
 * itself fed `CampaignsPage`'s own `DEMO_SEED` ("Summer Promo", a BANNER,
 * ACTIVE). The copy below is the SAME coupon that page's demo asset editor
 * renders, because `CampaignsPage`'s `demoAssetSeed` reads these constants:
 * the coupon a prospect sees in the preview is the coupon the demo account
 * actually carries, not a second, drifting invention.
 *
 * Honest by construction. `CampaignOverlay` suppresses its impression and
 * survey-response writes under `demoMode` (its own `isSimulated`) and
 * `campaignId` is a literal placeholder, so running the walkthrough for
 * five prospects records nothing against any campaign anywhere. */
export const DEMO_CAMPAIGN_NAME = "Summer Promo";
/** Banner & Discounts copy -- rendered by `CampaignOverlay` as a coupon
 * card (a real, tappable code), which is why these live together rather
 * than inline at either call site. */
export const DEMO_CAMPAIGN_HEADLINE = "Flat 20% off this weekend";
export const DEMO_CAMPAIGN_SUBTEXT = "Show this coupon at checkout to redeem your discount.";
export const DEMO_CAMPAIGN_COUPON_CODE = "SAVE20";
export const DEMO_CAMPAIGN_COUPON_EXPIRES_AT = "2026-12-31T23:59:59Z";

/** The `NextCampaign` shape `CampaignOverlay` consumes -- the same type
 * `campaignPortalService.getNextCampaign` returns to a real guest, and the
 * same one `resolveActivePreviewCampaign` returns to the real preview. */
export const DEMO_PORTAL_CAMPAIGN: NextCampaign = {
  campaignId: "demo-campaign",
  campaignType: "banner",
  isSkippable: true,
  questions: [],
  asset: {
    imageUrl: null,
    clickUrl: null,
    altText: DEMO_CAMPAIGN_HEADLINE,
    headline: DEMO_CAMPAIGN_HEADLINE,
    subtext: DEMO_CAMPAIGN_SUBTEXT,
    couponCode: DEMO_CAMPAIGN_COUPON_CODE,
    couponExpiresAt: DEMO_CAMPAIGN_COUPON_EXPIRES_AT,
  },
};
