import { useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { FileText, Info, Megaphone, ScrollText, ShieldOff, Users } from "lucide-react";
import i18n from "@/lib/i18n";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

export type MarketingTab = "campaigns" | "templates" | "audience" | "deliveries";
const TABS: { id: MarketingTab; icon: typeof Megaphone; fallback: string; i18nKey: string }[] = [
  { id: "campaigns", icon: Megaphone, fallback: "Campaigns", i18nKey: "tabs.campaigns" },
  { id: "templates", icon: FileText, fallback: "Templates", i18nKey: "tabs.templates" },
  { id: "audience", icon: Users, fallback: "Audience", i18nKey: "tabs.audience" },
  { id: "deliveries", icon: ScrollText, fallback: "Delivery logs", i18nKey: "tabs.logs" },
];

function isTab(v: unknown): v is MarketingTab {
  return v === "campaigns" || v === "templates" || v === "audience" || v === "deliveries";
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
 *   - demo workspace: an honest "not available" panel. The demo has no
 *     backend session and this screen has no fixtures -- it sends real
 *     messages to real people, so there is nothing truthful to fake.
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
}: {
  locationId?: string;
  syncWithUrl?: boolean;
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

  const intro = (
    <p className="max-w-3xl text-sm text-muted-foreground">
      {t(
        "intro",
        "Send WhatsApp, SMS and email campaigns to guests who opted in to hear from you on your WiFi login page.",
      )}
    </p>
  );

  if (demo) {
    return (
      <div className="space-y-5">
        {intro}
        <EmptyState
          icon={Info}
          title={t("demo.title", "Not available in the demo workspace")}
          description={t(
            "demo.body",
            "Marketing sends real messages to real guests, so there is nothing honest to show here. Sign in to a live account to use it.",
          )}
        />
      </div>
    );
  }

  const code = status.error ? marketingErrorCode(status.error) : null;

  // Locked: the backend's 402 is the truth. `/me/entitlements` saying
  // "off" is the same fact from the same snapshot, so it is allowed to show
  // the upsell without waiting for the status call -- but it is never
  // allowed to UNLOCK anything; only a 2xx from /marketing/status does that.
  if (code === "feature_not_entitled" || (entitled === false && !status.data)) {
    return <MarketingLockedUpsell locationId={locationId} />;
  }
  if (code === "license_not_active") {
    return <MarketingLicenceLapsed />;
  }
  if (status.isLoading) {
    return <PageSkeleton />;
  }
  if (status.error) {
    if (code === "forbidden" || code === "permission_denied") {
      return (
        <EmptyState
          icon={ShieldOff}
          title="Your role doesn't include Marketing"
          description="Ask your account owner to give your role Marketing access in Staff Access."
        />
      );
    }
    return (
      <ErrorState
        title="Couldn't load Marketing"
        description={marketingErrorMessage(status.error, "The server didn't answer.")}
        onRetry={() => void status.refetch()}
      />
    );
  }
  if (!status.data) return <PageSkeleton />;

  return (
    <div className="space-y-5">
      {intro}
      <ChannelStatusStrip channels={status.data.channels} />

      <Tabs value={tab} onValueChange={(v) => isTab(v) && go({ tab: v, campaign: null })}>
        <TabsList className="h-auto w-full flex-wrap justify-start sm:w-auto">
          {TABS.map((o) => {
            const Icon = o.icon;
            return (
              <TabsTrigger key={o.id} value={o.id} className="gap-2 px-3 py-1.5">
                <Icon className="h-4 w-4" aria-hidden="true" />
                {t(o.i18nKey, o.fallback)}
              </TabsTrigger>
            );
          })}
        </TabsList>

        <TabsContent value="campaigns" className="mt-5">
          <CampaignList
            status={status.data}
            onOpenCampaign={(id) => go({ campaign: id })}
            onGoToTab={(t2) => go({ tab: t2, campaign: null })}
          />
        </TabsContent>
        <TabsContent value="templates" className="mt-5">
          <TemplateGallery status={status.data} />
        </TabsContent>
        <TabsContent value="audience" className="mt-5">
          <AudienceTab status={status.data} />
        </TabsContent>
        <TabsContent value="deliveries" className="mt-5">
          <DeliveryLogTable onOpenCampaign={(id) => go({ campaign: id })} />
        </TabsContent>
      </Tabs>

      <CampaignDetailSheet
        campaignId={openCampaignId}
        status={status.data}
        onClose={() => go({ campaign: null })}
      />
    </div>
  );
}

export default MarketingView;
