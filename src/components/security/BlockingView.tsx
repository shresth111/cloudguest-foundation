import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ChevronDown, Globe2, Loader2, Router as RouterIcon, UserX } from "lucide-react";
import i18n from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { EmptyState } from "@/components/common/EmptyState";
import { ContentFilterManagement } from "@/components/network/ContentFilterManagement";
import { ControllerRoutersNote } from "@/components/network/RouterPickerItems";
import BlockUsers from "@/components/features/BlockUsers";
import { ControllerManagedFeatureNotice } from "@/components/customer/ControllerManagedFeatureNotice";
import { WebsiteBlockBox } from "@/components/security/WebsiteBlockBox";
import { AppBlockBox, AppBlockLimits } from "@/components/security/AppBlockBox";
import { WebFilteringView } from "@/components/security/WebFilteringView";
import { useMyPermissions } from "@/hooks/useCustomerDashboard";
import { useCustomerStore } from "@/stores/customerStore";
import { routerService } from "@/services/router.service";
import { isDemo, resolveOrgId } from "@/services/customer.service";
import { requestErrorOf } from "@/services/api";
import { locationControllerVendor, locationIsControllerManaged } from "@/lib/location-liveness";
import {
  featureAppliesToControllerVenue,
  partitionRoutersByDeviceWrite,
} from "@/lib/router-vendors";
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

/** In-page anchors on the Websites tab. `/web-filtering` redirects to
 * `#categories`; the Security Score's "Block an internet address" link opens
 * `#advanced`, which also unfolds it. */
export const BLOCK_WEBSITES_SECTION_IDS = {
  specific: "specific-websites",
  apps: "apps",
  categories: "categories",
  advanced: "advanced",
} as const;

/**
 * Security -> Block Websites. The one place to block a website, plus the
 * guests & devices tab that has always lived beside it.
 *
 * A shell and nothing else: every section mounts the screen that already did
 * the job (see `lib/blocking.ts` for which, and why each one moved rather than
 * being copied). No request is made here that those screens did not already
 * make, apart from the venue's router list, which shares its cache key with
 * the categories section so the page asks for it once.
 *
 * ## The Websites tab, top to bottom
 *
 *  1. "Specific websites": the `WebsiteBlockBox` (type a name, press Block,
 *     the bypass switch), once per router this platform can write -- picked
 *     exactly as Firewall picks them (`partitionRoutersByDeviceWrite`, with
 *     `ControllerRoutersNote` naming any controller left out).
 *  2. "Apps": `AppBlockBox`, one switch per app in the backend's curated
 *     catalogue, per writable router. Switching one off blocks every website
 *     name the app uses with the same push a typed-in website gets; the
 *     section says plainly that this is name matching and some apps get
 *     through. The Security Score's "Block particular apps" link lands here.
 *  3. "Categories": `WebFilteringView`, mounted whole. It already handles
 *     "not set up", demo and its own controller gate, so embedding it costs
 *     nothing and a link out would only have been a second page to find.
 *  4. "Advanced", folded: `ContentFilterManagement`, the full rule list. It
 *     is the only place an internet address (IP or range) is blocked, and it
 *     shows every website rule with its status, so nothing that screen could
 *     do is lost; it is folded because a venue owner almost never needs it.
 *
 * ## Controller-managed venues
 *
 * Same rule as `CustomerFeaturePage`, applied per tab rather than per page.
 * Everything on "Websites" writes to a MikroTik; at a venue whose only router
 * is an Omada controller there is nothing for it to write to, so that tab
 * shows the existing `ControllerManagedFeatureNotice` and none of the three
 * sections is mounted. "Guests & devices" keeps working there exactly as it
 * did under Access Rules -- `BlockUsers` already reports what the controller
 * did with each block. The page therefore opens on that tab at such a venue.
 *
 * Reads the venue from the store rather than taking it as props, so the
 * owner's `/blocking` route and the staff `/agent` shell mount it the same
 * way and cannot disagree about which tab is gated.
 *
 * ## The URL carries the tab
 *
 * With `syncWithUrl`, `?tab=websites|guests` picks the tab and switching tabs
 * rewrites it. That is what lets the Security Score and old
 * `/website-blocking` and `/web-filtering` bookmarks land on the right tab.
 * The `/agent` shell has one URL for every feature, so it leaves this off and
 * keeps the tab local.
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
          "blockWebsites.intro",
          "Stop websites from opening on your guest WiFi, or stop a guest or device from using it.",
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
                <WebsitesTab locationId={locationId} />
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

function currentHash(): string {
  if (typeof window === "undefined") return "";
  return window.location.hash.replace(/^#/, "");
}

function SectionHeading({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="space-y-0.5">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      {hint && <p className="max-w-3xl text-sm text-muted-foreground">{hint}</p>}
    </div>
  );
}

function WebsitesTab({ locationId }: { locationId?: string }) {
  const { t } = useTranslation("nav", { i18n });
  const [advancedOpen, setAdvancedOpen] = useState(
    () => currentHash() === BLOCK_WEBSITES_SECTION_IDS.advanced,
  );
  const rootRef = useRef<HTMLDivElement>(null);

  // A deep link to a section (`/web-filtering` -> `#categories`, the Security
  // Score's address link -> `#advanced`) scrolls to it once the tab mounts.
  useEffect(() => {
    const hash = currentHash();
    if (!hash) return;
    const el = rootRef.current?.querySelector(`#${CSS.escape(hash)}`);
    if (el && "scrollIntoView" in el) el.scrollIntoView({ block: "start" });
  }, []);

  return (
    <div ref={rootRef} className="space-y-8">
      <section id={BLOCK_WEBSITES_SECTION_IDS.specific} className="scroll-mt-20 space-y-3">
        <SectionHeading
          title={t("blockWebsites.specificTitle", "Specific websites")}
          hint={t(
            "blockWebsites.specificHint",
            "Type a website's name and press Block. It stops opening on your guest WiFi, along with every page under it.",
          )}
        />
        <PerRouter locationId={locationId} render={(id) => <WebsiteBlockBox routerId={id} />} />
      </section>

      <section id={BLOCK_WEBSITES_SECTION_IDS.apps} className="scroll-mt-20 space-y-3">
        <SectionHeading
          title={t("blockApps.title", "Apps")}
          hint={t(
            "blockApps.hint",
            "Switch an app on to block it on your guest WiFi. This blocks the website names the app uses — it does not recognise the app itself, so some apps may still get through.",
          )}
        />
        <AppBlockLimits />
        <PerRouter locationId={locationId} render={(id) => <AppBlockBox routerId={id} />} />
      </section>

      <section id={BLOCK_WEBSITES_SECTION_IDS.categories} className="scroll-mt-20 space-y-3">
        <SectionHeading title={t("blockWebsites.categoriesTitle", "Categories")} />
        <WebFilteringView locationId={locationId} />
      </section>

      <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
        <section id={BLOCK_WEBSITES_SECTION_IDS.advanced} className="scroll-mt-20 space-y-3">
          <CollapsibleTrigger className="flex w-full items-start justify-between gap-3 rounded-lg border border-border/60 bg-muted/30 px-4 py-3 text-left">
            <span className="space-y-0.5">
              <span className="block text-sm font-semibold text-foreground">
                {t("blockWebsites.advancedTitle", "Advanced: block an internet address")}
              </span>
              <span className="block text-xs text-muted-foreground">
                {t(
                  "blockWebsites.advancedHint",
                  "For blocking a number like 203.0.113.7 instead of a name, and for seeing every block on each router with its status.",
                )}
              </span>
            </span>
            <ChevronDown
              className={cn(
                "mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                advancedOpen && "rotate-180",
              )}
              aria-hidden="true"
            />
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2">
            <ContentFilterManagement locationId={locationId} />
          </CollapsibleContent>
        </section>
      </Collapsible>
    </div>
  );
}

/** One box per router this platform can write, chosen the same way Firewall
 * chooses them -- the website box and the apps box both use it, so the two
 * sections can never disagree about which routers they act on. */
function PerRouter({
  locationId,
  render,
}: {
  locationId?: string;
  render: (routerId: string) => ReactNode;
}) {
  const { t } = useTranslation("nav", { i18n });
  const activeLocation = useCustomerStore((s) => s.activeLocation);
  const demo = isDemo();

  // Same key and request as WebFilteringView's own router list just below,
  // so the page fetches the venue's routers once.
  const routersQuery = useQuery({
    queryKey: ["dns-filtering", "venue-routers", locationId],
    enabled: !!locationId && !demo,
    queryFn: async () => {
      const orgId = activeLocation?.organizationId || (await resolveOrgId());
      return routerService.listForLocation(locationId as string, orgId);
    },
  });

  if (demo) {
    return (
      <EmptyState
        icon={Globe2}
        title={t("blockWebsites.demoTitle", "Not part of the demo account")}
        description={t(
          "blockWebsites.demoBody",
          "Blocking a website changes a real router, and the demo account has none.",
        )}
      />
    );
  }

  if (!locationId) {
    return <EmptyState icon={Globe2} title={t("blockWebsites.noVenue", "Choose a venue first")} />;
  }

  if (routersQuery.isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        {t("blockWebsites.loadingRouters", "Loading this venue's routers…")}
      </div>
    );
  }

  if (routersQuery.isError) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {requestErrorOf(routersQuery.error)?.message ??
          t("blockWebsites.routersError", "Couldn't load this venue's routers.")}
      </p>
    );
  }

  const rows = routersQuery.data ?? [];
  const { writable } = partitionRoutersByDeviceWrite(rows);

  if (writable.length === 0) {
    return (
      <EmptyState
        icon={RouterIcon}
        title={t("blockWebsites.noRouterTitle", "No router here can block websites")}
        description={
          rows.length === 0
            ? t("blockWebsites.noRouterBody", "This venue has no router yet.")
            : undefined
        }
      >
        <ControllerRoutersNote rows={rows} />
      </EmptyState>
    );
  }

  return (
    <div className="space-y-3">
      <ControllerRoutersNote rows={rows} />
      {writable.map((router) => (
        <div key={router.id} className="space-y-2">
          {/* The router's name only matters when there is a choice of them. */}
          {writable.length > 1 && (
            <p className="flex items-center gap-2 text-sm font-medium text-foreground">
              <RouterIcon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              {router.name}
            </p>
          )}
          {render(router.id)}
        </div>
      ))}
    </div>
  );
}

export default BlockingView;
