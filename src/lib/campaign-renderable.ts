import type { NextCampaign } from "@/types/campaign";

/** True only when there is real, renderable content for this campaign --
 * the founder's own live "test" campaign is a real, current, ACTIVE
 * SURVEY with zero `CampaignQuestion` rows (a data-completeness gap on
 * the admin side, not a bug here), and an admin could equally forget to
 * attach a `CampaignAsset` to a BANNER/REDIRECT. Both are honestly treated
 * as "nothing to show" rather than rendering an empty card or crashing on
 * a missing field. */
export function campaignHasRenderableContent(campaign: NextCampaign): boolean {
  if (campaign.campaignType === "survey") return campaign.questions.length > 0;
  const asset = campaign.asset;
  // A banner is renderable as a tappable image, a bare click-through, or --
  // for a "Banner & Discounts" campaign -- as a text/coupon card with a
  // headline and/or a coupon code (no image or link required).
  return !!(asset?.imageUrl || asset?.clickUrl || asset?.headline || asset?.couponCode);
}
