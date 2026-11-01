import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Shield, Layers } from "lucide-react";
import { useTranslation } from "react-i18next";
import i18n from "@/lib/i18n";
import { PageHeader, SubTabs, type PageScope } from "@/components/customer/console";
import LocationPolicies from "./LocationPolicies";
import CreateGroup from "./CreateGroup";
import SsidSpeedTiers from "./SsidSpeedTiers";
import { useClientControls } from "@/hooks/useClientControls";
import { isNasOnlyVendor } from "@/lib/router-vendors";
import { useCustomerStore } from "@/stores/customerStore";

// Renamed from generic/technical "Location Policies"/"User Policies"/
// "Group Policies" -- none of those said what they actually configure. Each
// new name matches what the tab does in the venue-owner's own words:
// "Guest WiFi Limits" caps bandwidth/session/data per Business Unit (kept in
// sync with LocationPolicies.tsx's own card titles after real-customer
// feedback that "Usage Limits" didn't read as clearly), the "Guest Access"
// trio is per-guest allow/block/sign-in control, "Access Tiers" is the
// bandwidth/limit package guests get mapped into -- deliberately not
// "Guest Groups" (a real, different feature already has that name in the
// sidebar, ManageTeamsPage.tsx's staff/shared-account teams).
//
// Flattened to one tab level after owner feedback that a "Guest Access"
// top-level tab containing its own sub-tabs read as tabs nested inside
// tabs -- two visually near-identical pill bars stacked, so it was never
// obvious which level a click landed in. There's no real hierarchy being
// lost by flattening: each of these destinations is already a fully
// self-contained section with its own heading (see LocationPolicies.tsx/
// CreateGroup.tsx's own `<h2>`), so "Guest Access" was a navigation-only
// grouping, not a shared piece of content. That grouping is now carried by
// adjacency and by the rose/blocked color coding the sub-tabs already used
// (see GuestBadges.tsx / OperationsFeatures.tsx), plus a static divider on
// either side, a visual hint rather than a second clickable layer.
//
// Two tabs were removed from this row because each was the second copy of a
// setting that already had a home, and a setting with two homes is a
// setting two people can leave disagreeing:
//
//   - "Always Allowed" mounted `<WhiteList locationId={locationId} />` --
//     byte-for-byte the same component, with the same prop, that the
//     sidebar's own "Always Allowed" row renders one nav group above this
//     page (see config/customerFeatures.tsx). Not a summary or a narrower
//     view of it: the same screen, reachable twice, but only one of the two
//     had a URL you could link to or bookmark. The sidebar row kept it.
//
//   - "Sign-in Methods" mounted `SmartIdPage`, which wrote
//     `otp_sms_enabled`/`otp_email_enabled`/`otp_whatsapp_enabled`/
//     `voucher_enabled` on the same `captive_portal_configs` row, resolved
//     by the same most-specific-wins order, that Portal -> Auth Methods
//     writes. Those two really could disagree on screen. Portal kept it,
//     and `pin_login_enabled` -- the one flag only this tab wrote, and a
//     genuinely enforced one -- moved there rather than being deleted with
//     the tab. See PortalPage.tsx's AUTH_OPTIONS.
//
// And "Blocked Guests" left for the same reason, in the other direction: it
// is now the "Guests & devices" tab of Security -> Blocking, next to website
// and address blocking, so everything a venue can block is in one place
// (see lib/blocking.ts). The same `BlockUsers` component, moved rather than
// mounted twice. The line under the tabs below points there, because an
// owner who blocked guests here last week will look here first.
const ACCESS_TABS = [
  {
    id: "location",
    i18nKey: "tabLimits",
    label: "Guest WiFi Limits",
    icon: Shield,
  },
  {
    id: "group",
    i18nKey: "tabTiers",
    label: "Access Tiers",
    icon: Layers,
  },
] as const;

type AccessTabId = (typeof ACCESS_TABS)[number]["id"];

export default function PoliciesHub({
  locationId,
  scope,
}: {
  locationId?: string;
  /** Title + venue from the shell (OWN_PAGE_HEADER_FEATURES). */
  scope?: PageScope;
} = {}) {
  const [tab, setTab] = useState<AccessTabId>("location");
  const { t } = useTranslation("accessRules", { i18n });
  const { vendor } = useClientControls();
  const nasOnlyVenue = isNasOnlyVendor(vendor);
  const activeLocationId = useCustomerStore((s) => s.activeLocationId);
  const tiersLocationId = locationId ?? activeLocationId ?? null;
  // Aruba Instant On: no Access Tiers tab (owner, 2026-10-05: "access tier
  // hata do aruba se"). A tier is a different speed per group of guests, and
  // Instant On has no per-guest speed on any path -- one speed per WiFi
  // network, set in the section below Guest WiFi Limits. Every other venue
  // keeps both tabs.
  const tabs = nasOnlyVenue ? ACCESS_TABS.filter((item) => item.id !== "group") : ACCESS_TABS;
  const activeTab: AccessTabId = nasOnlyVenue && tab === "group" ? "location" : tab;

  return (
    <div className="wy-console space-y-5">
      {/* One header: the icon tile, the second title and the shield
          illustration are gone (design review §2 issue 1). */}
      <PageHeader
        title={scope?.title ?? t("nav:customerItem.policies", "Usage Limits")}
        venue={scope?.venue}
        description={t("subtitle", "Set usage limits and access tiers for this location.")}
      />

      {/* One flat tab row (no second level underneath it). SubTabs scrolls
          sideways on its own at narrow widths, so the old min-width and the
          hand-made edge fade are gone with the pill bar. */}
      <SubTabs
        idPrefix="access-rules"
        ariaLabel={t("nav:customerItem.policies", "Usage Limits")}
        value={activeTab}
        onChange={setTab}
        options={tabs.map((item) => {
          const Icon = item.icon;
          return {
            value: item.id,
            label: (
              <>
                <Icon className="h-4 w-4" aria-hidden="true" />
                {t(item.i18nKey, item.label)}
              </>
            ),
          };
        })}
      />

      <p className="text-[13px] text-[var(--wy-text-muted)]">
        {t("blockedMovedPrefix", "Looking for blocked guests? They are now under")}{" "}
        <Link
          to="/blocking"
          search={{ tab: "guests" }}
          className="rounded-sm font-medium text-[var(--wy-accent)] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--wy-accent)]"
        >
          {t("nav:customerGroup.security", "Security")} &rarr;{" "}
          {t("nav:customerItem.blocking", "Blocking")}
        </Link>
        {t("blockedMovedSuffix", ", together with blocked websites.")}
      </p>

      {/* Content -- each section draws its own section heading (h2) under
          this page's one h1. */}
      <div
        id="access-rules-panel"
        role="tabpanel"
        aria-labelledby={`access-rules-tab-${activeTab}`}
        className="space-y-5"
      >
        {activeTab === "location" && <LocationPolicies locationId={locationId} />}
        {/* Aruba Instant On only: one speed per WiFi network is the only speed
            control that venue has, so the per-network tiers live here, under
            Guest WiFi Limits. Every other vendor renders nothing new. */}
        {activeTab === "location" && nasOnlyVenue && tiersLocationId && (
          <SsidSpeedTiers locationId={tiersLocationId} />
        )}
        {activeTab === "group" && <CreateGroup locationId={locationId} />}
      </div>
    </div>
  );
}
