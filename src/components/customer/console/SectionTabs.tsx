import { Fragment, useEffect, useRef } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ChevronDown, Lock, SlidersHorizontal } from "lucide-react";
import { useTranslation } from "react-i18next";
import i18n from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
  CUSTOMER_NAV_GROUPS,
  customerFeatureHref,
  customerSidebarGroupsForRole,
  getCustomerLoginRole,
  sectionTabEntries,
  type CustomerNavItem,
} from "@/lib/customerNav";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { resolveSectionTabs } from "@/lib/customerNavPermissions";
import { locationControllerVendor, locationIsControllerManaged } from "@/lib/location-liveness";
import {
  controllerVenueFeatureReason,
  featureAppliesToControllerVenue,
} from "@/lib/router-vendors";
import { useCustomerStore } from "@/stores/customerStore";
import { useFeatureEntitled, useMyPermissions } from "@/hooks/useCustomerDashboard";
import { GUEST_MARKETING_FEATURE_KEY } from "@/types/marketing";
import { TRAFFIC_LENS_FEATURE_KEY } from "@/types/traffic-lens";

/**
 * The tab bar at the top of every page that lives in a sidebar section
 * (docs/design/nav-consolidation.md): Guests › Vouchers, Network › IP
 * Addresses, and so on.
 *
 * Every tab is a `<Link>` to the screen's own, unchanged URL
 * (`customerFeatureHref`), so back/forward, deep links, cmd-click and
 * bookmarks all work per tab -- this is navigation, not an in-page tablist,
 * which is why it is a `<nav>` of links with `aria-current="page"` rather
 * than `role="tablist"`.
 *
 * The tabs are the ones the sidebar would have offered as rows: role, then
 * real grants, through `resolveSectionTabs`. Controller-managed venues mute
 * the tabs this venue cannot use (with the reason as their title, and still
 * a link -- same rule and reasoning as the sidebar rows), and paid add-ons
 * the org has not bought carry the same "Add-on" badge the rows did.
 *
 * Tabs that share a `tabMenu` (Network's four installer screens) render as
 * ONE dropdown tab, "Advanced ▾" -- "Advanced · IP Addresses", highlighted,
 * while one of them is open. The menu's entries are still links to their
 * own URLs; Radix gives the trigger Enter/Space/Arrow-key opening, roving
 * focus inside and Escape back to the trigger.
 *
 * Renders nothing for a page outside a section (Home's rows, Staff Access)
 * and when the section has a single tab -- a one-tab bar is a heading that
 * looks clickable.
 */
export function SectionTabs({ featureId, className }: { featureId: string; className?: string }) {
  const { t } = useTranslation("nav", { i18n });
  const navigate = useNavigate();
  const { data: permissions } = useMyPermissions();
  const model = resolveSectionTabs(
    featureId,
    CUSTOMER_NAV_GROUPS,
    customerSidebarGroupsForRole(getCustomerLoginRole()),
    permissions,
    customerFeatureHref,
  );
  const activeLocation = useCustomerStore((s) => s.activeLocation);
  const controllerManaged = locationIsControllerManaged(activeLocation?.liveness);
  const controllerVendor = locationControllerVendor(activeLocation?.liveness);
  const controllerReason = controllerVenueFeatureReason(controllerVendor);
  const marketingEntitled = useFeatureEntitled(GUEST_MARKETING_FEATURE_KEY);
  const trafficLensEntitled = useFeatureEntitled(TRAFFIC_LENS_FEATURE_KEY);

  const redirectTo = model.redirectTo;
  useEffect(() => {
    if (redirectTo) navigate({ to: redirectTo, replace: true });
  }, [redirectTo, navigate]);

  // On a narrow screen the bar scrolls sideways; bring the current tab into
  // view so Reports (the fourth Guests tab) is not off the right edge on a
  // phone. Horizontal only -- the page itself must not jump.
  const navRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const nav = navRef.current;
    const current = nav?.querySelector<HTMLElement>('[aria-current="page"], [data-active="true"]');
    if (!nav || !current) return;
    const overflowRight =
      current.offsetLeft + current.offsetWidth - (nav.scrollLeft + nav.clientWidth);
    if (overflowRight > 0 || current.offsetLeft < nav.scrollLeft) {
      nav.scrollLeft = Math.max(0, current.offsetLeft - 16);
    }
  }, [featureId]);

  if (!model.section || model.tabs.length < 2) return null;
  const muted = (item: CustomerNavItem) =>
    controllerManaged ? !featureAppliesToControllerVenue(item.id, controllerVendor) : false;
  const sectionLabel = t(`customerGroup.${model.section.id}`, model.section.label);

  return (
    <nav
      ref={navRef}
      data-section-tabs={model.section.id}
      aria-label={t("sectionTabs.label", {
        section: sectionLabel,
        defaultValue: "{{section}} pages",
      })}
      className={cn(
        // Wraps on a phone instead of scrolling sideways: a tab off the
        // right edge is a tab nobody sees. Icons go too below `sm`, so the
        // usual section fits one or two rows.
        "relative -mx-1 mb-4 flex flex-wrap items-end gap-x-1 border-b border-[var(--wy-border)] px-1 sm:flex-nowrap sm:overflow-x-auto [scrollbar-width:thin]",
        className,
      )}
    >
      {sectionTabEntries(model.tabs).map((entry, idx) => {
        if (entry.kind === "menu") {
          const current = entry.items.find((i) => i.id === featureId);
          const menuLabel = t(`customerTabMenu.${entry.menu.id}`, entry.menu.label);
          const allMuted =
            controllerManaged &&
            entry.items.every((i) => !featureAppliesToControllerVenue(i.id, controllerVendor));
          return (
            <DropdownMenu key={`menu:${entry.menu.id}`}>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  data-tab-menu={entry.menu.id}
                  data-active={current ? "true" : undefined}
                  className={cn(tabClass(!!current), "bg-transparent", allMuted && "opacity-60")}
                >
                  <SlidersHorizontal aria-hidden className="hidden h-3.5 w-3.5 shrink-0 sm:block" />
                  {menuLabel}
                  {current && (
                    <span className="font-normal">
                      <span aria-hidden> · </span>
                      {t(`customerItem.${current.id}`, current.label)}
                    </span>
                  )}
                  <ChevronDown aria-hidden className="h-3.5 w-3.5 shrink-0 opacity-70" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                sideOffset={4}
                className="wy-console min-w-[13rem] rounded-[var(--wy-radius-lg)] border-[var(--wy-border)] bg-[var(--wy-surface)] p-1 text-[var(--wy-text)]"
              >
                {entry.items.map((item) => {
                  const active = item.id === featureId;
                  const viaController = muted(item);
                  const Icon = item.icon;
                  return (
                    <DropdownMenuItem key={item.id} asChild>
                      <Link
                        to={customerFeatureHref(item.id)}
                        aria-current={active ? "page" : undefined}
                        title={viaController ? controllerReason : undefined}
                        className={cn(
                          "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[13px] focus:bg-[var(--wy-surface-2)] focus:text-[var(--wy-text)]",
                          active
                            ? "font-semibold text-[var(--wy-accent)]"
                            : "text-[var(--wy-text-muted)]",
                          viaController && "opacity-60",
                        )}
                      >
                        <Icon aria-hidden className="h-3.5 w-3.5 shrink-0" />
                        {t(`customerItem.${item.id}`, item.label)}
                      </Link>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        }
        const item = entry.item;
        const active = item.id === featureId;
        const label = t(`customerItem.${item.id}`, item.label);
        const viaController = muted(item);
        const locked =
          (item.id === "marketing" && marketingEntitled === false) ||
          (item.id === "traffic-lens" && trafficLensEntitled === false);
        const Icon = item.icon;
        return (
          <Fragment key={item.id}>
            {item.tabGroup && idx > 0 && (
              <span
                className="ml-2 flex shrink-0 items-center gap-2 self-center pb-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--wy-text-faint)]"
                aria-hidden
              >
                <span className="h-4 w-px bg-[var(--wy-border)]" />
                {t(`customerTabGroup.${item.tabGroup.id}`, item.tabGroup.label)}
              </span>
            )}
            <Link
              to={customerFeatureHref(item.id)}
              aria-current={active ? "page" : undefined}
              title={viaController ? controllerReason : undefined}
              className={cn(tabClass(active), viaController && "opacity-60")}
            >
              <Icon aria-hidden className="hidden h-3.5 w-3.5 shrink-0 sm:block" />
              {label}
              {locked && (
                <span
                  className="inline-flex shrink-0 items-center gap-1 rounded border border-[var(--wy-border)] bg-[var(--wy-surface-2)] px-1.5 py-px text-[10px] font-semibold text-[var(--wy-text-faint)]"
                  title={t("customerItemBadge.addonTitle", {
                    label,
                    defaultValue: "{{label}} is an add-on that isn't enabled for your organisation",
                  })}
                >
                  <Lock aria-hidden className="h-2.5 w-2.5" />
                  {t("customerItemBadge.addon", "Add-on")}
                </span>
              )}
            </Link>
          </Fragment>
        );
      })}
    </nav>
  );
}

/** One tab's look -- shared by the link tabs and the dropdown tab's trigger,
 * so "Advanced · IP Addresses" is highlighted exactly like an active tab. */
function tabClass(active: boolean): string {
  return cn(
    "relative -mb-px inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-t-[var(--wy-radius)] border-b-2 px-2.5 text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--wy-accent)]",
    active
      ? "border-[var(--wy-accent)] font-semibold text-[var(--wy-accent)]"
      : "border-transparent text-[var(--wy-text-muted)] hover:border-[var(--wy-border-strong)] hover:text-[var(--wy-text)]",
  );
}
