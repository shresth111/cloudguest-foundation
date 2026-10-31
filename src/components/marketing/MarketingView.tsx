import { useState, type ReactNode } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { FileText, Megaphone, ScrollText, ShieldOff, Users, KeyRound, Coins } from "lucide-react";
import i18n from "@/lib/i18n";
import { Callout, PageHeader, SubTabs, type PageScope } from "@/components/customer/console";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { PageSkeleton } from "@/components/common/LoadingSkeleton";
import { useFeatureEntitled, useIsDemo } from "@/hooks/useCustomerDashboard";
import { useMarketingStatus } from "@/hooks/useMarketing";
import { marketingErrorCode } from "@/services/marketing.service";
import { GUEST_MARKETING_FEATURE_KEY } from "@/types/marketing";
import { MarketingLockedUpsell, MarketingLicenceLapsed } from "./MarketingLockedUpsell";
import { ChannelStatusStrip } from "./ChannelStatusStrip";
import { marketingErrorMessage } from "./marketing-helpers";
import { CampaignList } from "./campaigns/CampaignList";
import { CampaignDetailSheet } from "./campaigns/CampaignDetailSheet";
import { TemplateGallery } from "./templates/TemplateGallery";
import { AudienceTab } from "./audience/AudienceTab";
import { DeliveryLogTable } from "./deliveries/DeliveryLogTable";
import { ChannelsTab } from "./channels/ChannelsTab";
import { CreditsTab } from "./credits/CreditsTab";
import { CreditsChip } from "./credits/CreditsChip";

export type MarketingTab =
  | "campaigns"
  | "templates"
  | "audience"
  | "deliveries"
  | "channels"
  | "credits";
const TABS: { id: MarketingTab; icon: typeof Megaphone; fallback: string; i18nKey: string }[] = [
  { id: "campaigns", icon: Megaphone, fallback: "Campaigns", i18nKey: "tabs.campaigns" },
  { id: "templates", icon: FileText, fallback: "Templates", i18nKey: "tabs.templates" },
  { id: "audience", icon: Users, fallback: "Audience", i18nKey: "tabs.audience" },
  { id: "deliveries", icon: ScrollText, fallback: "Delivery logs", i18nKey: "tabs.logs" },
  { id: "channels", icon: KeyRound, fallback: "Channels", i18nKey: "tabs.channels" },
  { id: "credits", icon: Coins, fallback: "Credits", i18nKey: "tabs.credits" },
];

function isTab(v: unknown): v is MarketingTab {
  return (
    v === "campaigns" ||
    v === "templates" ||
    v === "audience" ||
    v === "deliveries" ||
    v === "channels" ||
    v === "credits"
  );
}

/**
 * Marketing -> Campaigns · Templates · Audience · Delivery logs.
 * (wyfy-specs/guest-marketing-campaigns.md §8.)
 *
 * THE GATE
 * --------
 * `GET /marketing/status` is read once here and passed down. Its answer
 * decides what renders, in this order:
 *
 *   - demo workspace: every tab runs against the in-memory demo backend
 *     (components/marketing/demo, via `useMarketingApi`), never locked, with
 *     a banner saying the data is sample data and nothing is sent. No
 *     request leaves the browser.
 *   - 402 `feature_not_entitled` (or `/me/entitlements` already saying the
 *     add-on is off): the upsell. Not an error state -- a locked add-on is
 *     an answer.
 *   - 402 `license_not_active`: a licence banner, no tabs.
 *   - 403: the caller's role has no `marketing.read`.
 *   - anything else: the server's own message with a retry.
 *
 * Only after a 2xx does any tab mount, so no tab ever renders a number the
 * backend did not send.
 *
 * THE URL CARRIES THE TAB (and the open campaign), with `syncWithUrl`, the
 * same way `/blocking` does. Without it (the `/agent` shell, one URL for
 * every feature) both are local state.
 */
export function MarketingView({
  locationId,
  syncWithUrl = false,
  scope,
}: {
  locationId?: string;
  syncWithUrl?: boolean;
  /** The shell's title + venue ("All venues" for an org-wide caller) for the one PageHeader. */
  scope?: PageScope;
}) {
  const { t } = useTranslation("marketing", { i18n });
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { tab?: unknown; campaign?: unknown };
  const demo = useIsDemo();
  const entitled = useFeatureEntitled(GUEST_MARKETING_FEATURE_KEY);
  const status = useMarketingStatus();

  const [localTab, setLocalTab] = useState<MarketingTab>("campaigns");
  const [localCampaign, setLocalCampaign] = useState<string | null>(null);

  const tab: MarketingTab = syncWithUrl ? (isTab(search.tab) ? search.tab : "campaigns") : localTab;
  const openCampaignId: string | null = syncWithUrl
    ? typeof search.campaign === "string"
      ? search.campaign
      : null
    : localCampaign;

  const go = (next: { tab?: MarketingTab; campaign?: string | null }) => {
    const nextTab = next.tab ?? tab;
    const nextCampaign = next.campaign === undefined ? openCampaignId : next.campaign;
    if (syncWithUrl) {
      void navigate({
        to: "/marketing",
        search: {
          tab: nextTab === "campaigns" ? undefined : nextTab,
          campaign: nextCampaign ?? undefined,
        },
      });
    } else {
      setLocalTab(nextTab);
      setLocalCampaign(nextCampaign);
    }
  };

  const intro = t(
    "intro",
    "Send WhatsApp, SMS and email campaigns to guests who opted in to hear from you on your WiFi login page.",
  );
  // The one header, on every state: locked, lapsed, loading, refused, live.
  const withHeader = (body: ReactNode, actions?: ReactNode) => (
    <div className="space-y-5">
      <PageHeader
        title={scope?.title ?? t("title", "Guest Messaging")}
        venue={scope?.venue}
        description={intro}
        actions={actions}
      />
      {body}
    </div>
  );

  const code = status.error ? marketingErrorCode(status.error) : null;

  // Locked: the backend's 402 is the truth. `/me/entitlements` saying
  // "off" is the same fact from the same snapshot, so it is allowed to show
  // the upsell without waiting for the status call -- but it is never
  // allowed to UNLOCK anything; only a 2xx from /marketing/status does that.
  if (!demo && (code === "feature_not_entitled" || (entitled === false && !status.data))) {
    return withHeader(<MarketingLockedUpsell locationId={locationId} />);
  }
  if (code === "license_not_active") {
    return withHeader(<MarketingLicenceLapsed />);
  }
  if (status.isLoading) {
    return withHeader(<PageSkeleton />);
  }
  if (status.error) {
    if (code === "forbidden" || code === "permission_denied") {
      return withHeader(
        <EmptyState
          icon={ShieldOff}
          title="Your role doesn't include Guest Messaging"
          description="Ask your account owner to give your role Marketing access in Staff Access."
        />,
      );
    }
    return withHeader(
      <ErrorState
        title="Couldn't load Guest Messaging"
        description={marketingErrorMessage(status.error, "The server didn't answer.")}
        onRetry={() => void status.refetch()}
      />,
    );
  }
  if (!status.data) return withHeader(<PageSkeleton />);

  return withHeader(
    <>
      {demo && (
        <div data-testid="marketing-demo-banner">
          <Callout role="note" tone="info">
            {t(
              "demo.banner",
              "Demo workspace: sample guests, campaigns and numbers. Everything works, but nothing is actually sent, and your changes last only until you reload.",
            )}
          </Callout>
        </div>
      )}
      <ChannelStatusStrip channels={status.data.channels} />

      <div>
        <SubTabs
          ariaLabel={scope?.title ?? t("title", "Guest Messaging")}
          idPrefix="marketing-tab"
          value={tab}
          onChange={(v) => go({ tab: v, campaign: null })}
          options={TABS.map((o) => {
            const Icon = o.icon;
            return {
              value: o.id,
              label: (
                <>
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {t(o.i18nKey, o.fallback)}
                </>
              ),
            };
          })}
        />
        <div
          id="marketing-tab-panel"
          role="tabpanel"
          aria-labelledby={`marketing-tab-tab-${tab}`}
          className="mt-5"
        >
          {tab === "campaigns" && (
            <CampaignList
              status={status.data}
              onOpenCampaign={(id) => go({ campaign: id })}
              onGoToTab={(t2) => go({ tab: t2, campaign: null })}
            />
          )}
          {tab === "templates" && <TemplateGallery status={status.data} />}
          {tab === "audience" && <AudienceTab status={status.data} />}
          {tab === "credits" && <CreditsTab />}
          {tab === "channels" && <ChannelsTab status={status.data} />}
          {tab === "deliveries" && (
            <DeliveryLogTable onOpenCampaign={(id) => go({ campaign: id })} />
          )}
        </div>
      </div>

      <CampaignDetailSheet
        campaignId={openCampaignId}
        status={status.data}
        onClose={() => go({ campaign: null })}
        onGoToChannels={() => go({ tab: "channels", campaign: null })}
      />
    </>,
    <CreditsChip onOpen={() => go({ tab: "credits", campaign: null })} />,
  );
}

export default MarketingView;
