import { Suspense } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Ban, BrickWall, Lock, ShieldAlert } from "lucide-react";
import i18n from "@/lib/i18n";
import { lazyView } from "@/lib/lazy-view";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FirewallAddonLocked } from "@/components/security/FirewallAddonLocked";
import { useFeatureEntitled, useMyPermissions } from "@/hooks/useCustomerDashboard";
import {
  FIREWALL_FEATURE_KEY,
  blockingWebsitesLocked,
  firewallSectionLocked,
  firewallSectionsFor,
  initialFirewallSection,
  isFirewallSectionId,
  type FirewallSectionId,
} from "@/lib/firewall-section";

// Each tab is its own lazily fetched module, exactly as each was when it was
// a page of its own, so opening Firewall fetches only the tab on screen.
const FirewallView = lazyView(() => import("@/components/security/FirewallView"), "FirewallView");
const BlockingView = lazyView(() => import("@/components/security/BlockingView"), "BlockingView");
const SecurityOverviewView = lazyView(
  () => import("@/components/security/SecurityOverviewView"),
  "SecurityOverviewView",
);

const SECTION_ICON: Record<FirewallSectionId, typeof BrickWall> = {
  rules: BrickWall,
  blocking: Ban,
  security: ShieldAlert,
};

/**
 * Security -> Firewall: firewall rules, Block Websites and the Security Check
 * as three tabs of one page (see `lib/firewall-section.ts` for why, and for
 * exactly what the Firewall add-on locks).
 *
 * A shell and nothing else. Each tab mounts the screen that was already its
 * own page -- `FirewallView`, `BlockingView`, `SecurityOverviewView` -- with
 * the same props, so every request, permission check and controller-venue
 * rule is the one that screen already had. The only thing this adds is the
 * lock: where `/me/entitlements` says the add-on is off, a locked tab shows
 * the add-on screen instead of mounting a view whose every request would
 * answer 402.
 *
 * ## The URL carries the tab
 *
 * `?section=rules|blocking|security` picks the tab and
 * switching rewrites it; Block Websites keeps its own `?tab=websites|guests`
 * beside it. That is what `/security`, `/blocking`, `/website-blocking` and
 * `/web-filtering` redirect into, so their bookmarks still land where they
 * did.
 */
export function FirewallSectionView({ locationId }: { locationId?: string }) {
  const { t } = useTranslation("nav", { i18n });
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { section?: unknown };
  const { data: permissions } = useMyPermissions();
  const entitled = useFeatureEntitled(FIREWALL_FEATURE_KEY);
  const offered = firewallSectionsFor(permissions);

  // From the URL, recomputed each render so the back button moves the tab.
  const section: FirewallSectionId = initialFirewallSection(search.section, offered);

  const selectSection = (next: string) => {
    if (!isFirewallSectionId(next)) return;
    void navigate({ to: "/firewall", search: { section: next }, replace: true });
  };

  return (
    <Tabs value={section} onValueChange={selectSection} className="space-y-5">
      {offered.length > 1 && (
        <TabsList className="h-auto flex-wrap">
          {offered.map((s) => {
            const Icon = SECTION_ICON[s.id];
            const locked = firewallSectionLocked(s.id, entitled);
            return (
              <TabsTrigger key={s.id} value={s.id} className="gap-2 px-3 py-1.5">
                <Icon className="h-4 w-4" aria-hidden="true" />
                {t(`firewallSection.${s.id}`, s.label)}
                {locked && <Lock className="h-3 w-3 opacity-70" aria-label="Add-on" />}
              </TabsTrigger>
            );
          })}
        </TabsList>
      )}

      <Suspense
        fallback={
          <div className="flex min-h-[200px] items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        }
      >
        {offered.map((s) => (
          <TabsContent key={s.id} value={s.id} className="mt-0">
            {s.id === "rules" &&
              (firewallSectionLocked("rules", entitled) ? (
                <FirewallAddonLocked />
              ) : (
                <FirewallView locationId={locationId} />
              ))}
            {s.id === "blocking" && (
              <BlockingView
                locationId={locationId}
                syncWithUrl
                websitesLocked={blockingWebsitesLocked(entitled)}
              />
            )}
            {s.id === "security" && <SecurityOverviewView />}
          </TabsContent>
        ))}
      </Suspense>
    </Tabs>
  );
}

export default FirewallSectionView;
