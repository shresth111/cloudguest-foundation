import { useState } from "react";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Globe2, UserX } from "lucide-react";
import i18n from "@/lib/i18n";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ContentFilterManagement } from "@/components/network/ContentFilterManagement";
import BlockUsers from "@/components/features/BlockUsers";
import { ControllerManagedFeatureNotice } from "@/components/customer/ControllerManagedFeatureNotice";
import { useMyPermissions } from "@/hooks/useCustomerDashboard";
import { useCustomerStore } from "@/stores/customerStore";
import { locationControllerVendor, locationIsControllerManaged } from "@/lib/location-liveness";
import { featureAppliesToControllerVenue } from "@/lib/router-vendors";
import {
  blockingTabsFor,
  initialBlockingTab,
  isBlockingTabId,
  type BlockingTabId,
} from "@/lib/blocking";

const TAB_ICON: Record<BlockingTabId, typeof Globe2> = {
  websites: Globe2,
  guests: UserX,
};

/**
 * Security -> Blocking. One place to block a website, an address or a guest.
 *
 * A shell and nothing else: every tab mounts the screen that already did the
 * job (see `lib/blocking.ts` for which, and why each one moved rather than
 * being copied). No request is made here that those screens did not already
 * make, and there is no save on this page of its own.
 *
 * ## Controller-managed venues
 *
 * Same rule as `CustomerFeaturePage`, applied per tab rather than per page.
 * "Websites & IPs" writes to a MikroTik; at a venue whose only router is an
 * Omada controller there is nothing for it to write to, so that tab shows
 * the existing `ControllerManagedFeatureNotice` and the form is never
 * mounted. "Guests & devices" keeps working there exactly as it did under
 * Access Rules -- `BlockUsers` already reports what the controller did with
 * each block. The page therefore opens on that tab at such a venue.
 *
 * Reads the venue from the store rather than taking it as props, so the
 * owner's `/blocking` route and the staff `/agent` shell mount it the same
 * way and cannot disagree about which tab is gated.
 *
 * ## The URL carries the tab
 *
 * With `syncWithUrl`, `?tab=websites|guests` picks the tab and switching tabs
 * rewrites it. That is what lets the Security overview and an old
 * `/website-blocking` bookmark land on the right tab. The `/agent` shell has
 * one URL for every feature, so it leaves this off and keeps the tab local.
 */
export function BlockingView({
  locationId,
  syncWithUrl = false,
}: {
  locationId?: string;
  syncWithUrl?: boolean;
}) {
  const { t } = useTranslation("nav", { i18n });
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { tab?: unknown };
  const activeLocation = useCustomerStore((s) => s.activeLocation);
  const { data: permissions } = useMyPermissions();

  const controllerManaged = locationIsControllerManaged(activeLocation?.liveness);
  const controllerVendor = locationControllerVendor(activeLocation?.liveness);
  const offered = blockingTabsFor(permissions);

  const [localTab, setLocalTab] = useState<BlockingTabId>(() =>
    initialBlockingTab(syncWithUrl ? search.tab : undefined, offered, controllerManaged),
  );
  // From the URL when it carries a tab we offer; otherwise the local choice.
  // Recomputed each render, so the browser's back button moves the tab too.
  const tab: BlockingTabId =
    syncWithUrl && isBlockingTabId(search.tab) && offered.some((o) => o.id === search.tab)
      ? search.tab
      : offered.some((o) => o.id === localTab)
        ? localTab
        : initialBlockingTab(undefined, offered, controllerManaged);

  const selectTab = (next: string) => {
    if (!isBlockingTabId(next)) return;
    setLocalTab(next);
    if (syncWithUrl) {
      void navigate({ to: "/blocking", search: { tab: next }, replace: true });
    }
  };

  return (
    <div className="space-y-5">
      <p className="max-w-3xl text-sm text-muted-foreground">
        {t(
          "blockingPage.intro",
          "Stop a website, an internet address or a guest from using your guest WiFi.",
        )}{" "}
        {t("blockingPage.onlyAllowedPrefix", "To let in only people you have listed, use")}{" "}
        <Link
          to="/whitelist"
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          {t("customerItem.whitelist", "Only Allowed")}
        </Link>
        .
      </p>

      <Tabs value={tab} onValueChange={selectTab}>
        {offered.length > 1 && (
          <TabsList className="h-auto flex-wrap">
            {offered.map((o) => {
              const Icon = TAB_ICON[o.id];
              return (
                <TabsTrigger key={o.id} value={o.id} className="gap-2 px-3 py-1.5">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {t(`blockingTab.${o.id}`, o.label)}
                </TabsTrigger>
              );
            })}
          </TabsList>
        )}

        {offered.map((o) => {
          const gated =
            controllerManaged &&
            o.controllerGatedAs !== null &&
            !featureAppliesToControllerVenue(o.controllerGatedAs);
          return (
            <TabsContent key={o.id} value={o.id} className="mt-5">
              {gated && o.controllerGatedAs ? (
                <ControllerManagedFeatureNotice
                  featureId={o.controllerGatedAs}
                  featureLabel={t(`blockingTab.${o.id}`, o.label)}
                  venueName={activeLocation?.name ?? null}
                  vendor={controllerVendor}
                />
              ) : o.id === "websites" ? (
                <ContentFilterManagement locationId={locationId} />
              ) : (
                <BlockUsers locationId={locationId} />
              )}
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}

export default BlockingView;
