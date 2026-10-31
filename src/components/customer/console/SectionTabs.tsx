import { Fragment, useEffect } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { useTranslation } from "react-i18next";
import i18n from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
  CUSTOMER_NAV_GROUPS,
  customerFeatureHref,
  customerSidebarGroupsForRole,
  getCustomerLoginRole,
} from "@/lib/customerNav";
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

  if (!model.section || model.tabs.length < 2) return null;
  const sectionLabel = t(`customerGroup.${model.section.id}`, model.section.label);

  return (
    <nav
      data-section-tabs={model.section.id}
      aria-label={t("sectionTabs.label", {
        section: sectionLabel,
        defaultValue: "{{section}} pages",
      })}
      className={cn(
        "-mx-1 mb-4 flex items-end gap-1 overflow-x-auto border-b border-[var(--wy-border)] px-1 [scrollbar-width:thin]",
        className,
      )}
    >
      {model.tabs.map((item, idx) => {
        const active = item.id === featureId;
        const label = t(`customerItem.${item.id}`, item.label);
        const viaController = controllerManaged
          ? !featureAppliesToControllerVenue(item.id, controllerVendor)
          : false;
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
              className={cn(
                "relative -mb-px inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-t-[var(--wy-radius)] border-b-2 px-2.5 text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--wy-accent)]",
                active
                  ? "border-[var(--wy-accent)] font-semibold text-[var(--wy-accent)]"
                  : "border-transparent text-[var(--wy-text-muted)] hover:border-[var(--wy-border-strong)] hover:text-[var(--wy-text)]",
                viaController && "opacity-60",
              )}
            >
              <Icon aria-hidden className="h-3.5 w-3.5 shrink-0" />
              {label}
              {locked && (
                <span
                  className="inline-flex shrink-0 items-center gap-1 rounded border border-[var(--wy-border)] bg-[var(--wy-surface-2)] px-1.5 py-px text-[10px] font-semibold text-[var(--wy-text-faint)]"
                  title={`${label} is an add-on that isn't enabled for your organisation`}
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
