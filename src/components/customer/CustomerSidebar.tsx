import { useEffect, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronRight, Shield, Eye, Loader2, Lock } from "lucide-react";
import { useTranslation } from "react-i18next";
import i18n from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  customerFeatureHref,
  customerSidebarGroupsForRole,
  getCustomerLoginRole,
  type CustomerNavGroup,
} from "@/lib/customerNav";
import {
  filterNavGroupsByPermissions,
  navItemsHiddenByPermissions,
} from "@/lib/customerNavPermissions";
import { locationControllerVendor, locationIsControllerManaged } from "@/lib/location-liveness";
import {
  controllerVenueFeatureReason,
  featureAppliesToControllerVenue,
} from "@/lib/router-vendors";
import { useCustomerStore } from "@/stores/customerStore";
import { DataMaskingOtpDialog } from "@/components/features/HeaderControls";
import { useFeatureEntitled, useMyPermissions } from "@/hooks/useCustomerDashboard";
import { GUEST_MARKETING_FEATURE_KEY } from "@/types/marketing";
import { TRAFFIC_LENS_FEATURE_KEY } from "@/types/traffic-lens";
import type { useDataMasking } from "@/hooks/useCustomerDashboard";

/**
 * The one shared sidebar every customer page renders: every feature in
 * its group (Home / Guests / Login Page / Network / Security / Help / Logs),
 * straight off `CUSTOMER_NAV_GROUPS` via `customerSidebarGroupsForRole`,
 * role-filtered and then permission-filtered. Staff Access is the one
 * feature not here -- it is in the avatar menu (CustomerHeader.tsx).
 *
 * ON THE GROUPING
 * ---------------
 * A previous change folded these rows into nine "destinations" with the
 * rest reachable as tabs inside them. That grouping was reverted: the
 * one-row-per-screen menu is what this product's customers navigate by, and
 * the destination layer is gone rather than left half-wired. `customerNav.ts`
 * is the single source of truth for what is offered and
 * `customerFeatureHref()` for where each one lives, exactly as before.
 *
 * The rows are grouped by task rather than by subsystem. The old eight
 * groups answered "why is the WiFi down" across four of them and ran 30 rows
 * plus eight labels past the bottom of a laptop viewport. Now Home holds the
 * three rows for "something is wrong" (Dashboard, Alerts, Fix a Problem),
 * Network holds the hardware and the uplink together, and the three audit
 * records sit in Logs, which is collapsed until opened (or until the current
 * page is one of them) -- 29 rows, 26 visible on first load, seven labels.
 *
 * WHAT IS NOT REVERTED, AND WHY
 * -----------------------------
 * The shell underneath is still `components/ui/sidebar.tsx`, the shadcn
 * primitive this repo already ships and already uses for the Master Console
 * (AppSidebar, TopNavbar, `_authenticated.tsx`). Customers were the only
 * audience without:
 *
 *   - collapse state that survives navigation. The hand-rolled `<aside>`
 *     held it in `useState(true)` inside a component every route remounts,
 *     so collapsing the sidebar and clicking anything sprang it back open.
 *     The primitive persists it to a cookie for a week.
 *   - Cmd/Ctrl-B to toggle.
 *   - a real mobile drawer. The old one was a `translate-x` div beside a
 *     click-scrim: no focus trap, no Escape, no body-scroll lock, no dialog
 *     semantics. The primitive uses Radix `Sheet` and gets all four.
 *   - focus-visible rings on the nav rows.
 *
 * Those were bug fixes that happened to travel with the grouping change;
 * undoing them would be a regression on top of a revert. Same for the rows
 * being `<Link>` rather than `<button onClick>`: the old rows had no href,
 * so there was no cmd-click, no open-in-new-tab, no `aria-current`, and a
 * screen reader announced 26 unlabelled buttons with no indication of which
 * page you were on. `customerFeatureHref()` was already the single source of
 * truth for the URLs; only the element type changed.
 *
 * COLORS
 * ------
 * The rail was a dark indigo gradient painted inline. It is now the console
 * surface: `wy-console` re-points the primitive's `--sidebar*` tokens at the
 * `--wy-*` console tokens (styles.css; contract in
 * docs/design/console-tokens.md), so it is light or dark with the theme and
 * the only colour in it is the active row's accent. Row styling is
 * `ROW_CLASS` below.
 */
export interface CustomerSidebarProps {
  /** The feature id of the current page, e.g. "reports", "mac-auth" -- the
   * row that renders active. */
  activeFeatureId: string;
  /** Shown under the brand mark -- the active venue's name. */
  subtitle?: string;
  /** See the previous implementation's note: "hide sensitive data" is an
   * account-level setting, so it lives with navigation rather than as a
   * transient header pill. The OTP dialog travels with it. */
  dataMasking: ReturnType<typeof useDataMasking>;
}

const GROUP_LABEL_CLASS =
  "h-7 px-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--wy-text-faint)]";

/** Nav row: quiet by default, surface-2 on hover, accent-soft + accent text
 * when current. Overrides the primitive's hover (which would otherwise use
 * the same accent tint as the active row and blur the two together). */
const ROW_CLASS =
  "h-8 gap-2.5 rounded-[var(--wy-radius)] px-2 text-[13px] text-[var(--wy-text-muted)] hover:bg-[var(--wy-surface-2)] hover:text-[var(--wy-text)] active:bg-[var(--wy-surface-2)] data-[active=true]:bg-[var(--wy-accent-soft)] data-[active=true]:font-semibold data-[active=true]:text-[var(--wy-accent)] focus-visible:ring-[var(--wy-accent)] [&>svg]:text-current";

/** Groups rendered collapsed until opened. Only Logs: Staff Activity, Guest
 * Connection Records and NetLogs are records an owner looks up after the
 * fact, rarely, and three rows of them were most of what pushed the rail past
 * a laptop's fold. Collapsing it costs one click on the rare visit and buys
 * the everyday rows their place on screen. */
const COLLAPSIBLE_GROUP_IDS: ReadonlySet<string> = new Set(["logs"]);

const groupOpenStorageKey = (groupId: string) => `cg_sidebar_group_open:${groupId}`;

function readStoredGroupOpen(groupId: string): boolean | null {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(groupOpenStorageKey(groupId));
    return v === "1" ? true : v === "0" ? false : null;
  } catch {
    return null;
  }
}

/**
 * A sidebar group whose label is a disclosure button.
 *
 * Closed by default; open when the current page is one of its rows (a page
 * whose own row is hidden reads as "where am I?"); and once the user toggles
 * it, their choice is kept in localStorage and wins on later page loads --
 * except that landing on one of its rows always shows that row.
 *
 * In the collapsed icon rail the label is invisible (the primitive fades it
 * out), so the group is forced open and the trigger disabled there: the rail
 * shows every icon, as it always has, and nothing invisible takes focus.
 * The trigger is Radix's, so `aria-expanded` / `aria-controls` come with it.
 */
function CollapsibleNavGroup({
  group,
  label,
  activeFeatureId,
  railCollapsed,
  children,
}: {
  group: CustomerNavGroup;
  label: string;
  activeFeatureId: string;
  railCollapsed: boolean;
  children: ReactNode;
}) {
  const containsActive = group.items.some((item) => item.id === activeFeatureId);
  const [open, setOpen] = useState<boolean>(
    () => containsActive || (readStoredGroupOpen(group.id) ?? false),
  );
  // The sidebar is not always remounted on navigation; arriving on one of
  // this group's pages must still reveal its row.
  useEffect(() => {
    if (containsActive) setOpen(true);
  }, [containsActive]);

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    try {
      window.localStorage.setItem(groupOpenStorageKey(group.id), next ? "1" : "0");
    } catch {
      // Private mode / storage full: the toggle still works for this page.
    }
  };

  return (
    <Collapsible
      open={railCollapsed || open}
      onOpenChange={onOpenChange}
      disabled={railCollapsed}
      asChild
    >
      <SidebarGroup>
        <SidebarGroupLabel asChild className={GROUP_LABEL_CLASS}>
          <CollapsibleTrigger className="group/collapsible w-full cursor-pointer hover:text-[var(--wy-text-muted)]">
            <span className="flex-1 text-left">{label}</span>
            <ChevronRight
              aria-hidden
              className="transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90"
            />
          </CollapsibleTrigger>
        </SidebarGroupLabel>
        <CollapsibleContent>{children}</CollapsibleContent>
      </SidebarGroup>
    </Collapsible>
  );
}

export function CustomerSidebar({ activeFeatureId, dataMasking }: CustomerSidebarProps) {
  const { t } = useTranslation("nav", { i18n });
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const role = getCustomerLoginRole();
  // Role is a sign-in landing preference kept in localStorage, never an
  // authorization decision; the caller's real grants narrow it further and
  // the two only ever compose in the removing direction. An absent, failed
  // or empty permission set means "we don't know" and leaves the nav alone.
  // See customerNavPermissions.ts for why every ambiguity resolves toward
  // the customer.
  const { data: permissions, isLoading: permissionsLoading } = useMyPermissions();
  const roleNavGroups = customerSidebarGroupsForRole(role);
  const navGroups = filterNavGroupsByPermissions(roleNavGroups, permissions);
  // A PRESENT BUT INCOMPLETE grant set is the case the fail-open rules
  // above deliberately do not cover: it is a real answer, so the filter
  // really does subtract, and subtraction here is invisible. A row that
  // was removed and a row that never existed render identically -- which
  // is how `dashboard.read` (a key the backend never seeded, so nobody
  // could ever hold it) hid the Dashboard from every customer, owner
  // included, with no error anywhere to explain it.
  //
  // So say so. One quiet line, only when something was actually removed,
  // naming the sections on hover. It grants nothing -- the backend still
  // enforces every request -- but it turns "this product does not have
  // that" into "your role does not include that", which is a question a
  // user can take to their owner. Hidden in the collapsed icon rail,
  // where there is no room for a sentence and the tooltip would fight
  // the nav's own.
  const hiddenByPermissions = navItemsHiddenByPermissions(roleNavGroups, permissions);
  // A brief, honest "still looking" instead of painting the full nav and
  // letting it shrink under the pointer once grants arrive. `isLoading` is
  // false for demo, failed and empty alike, so all three still fall through
  // to the fail-open full nav.
  const showSkeleton = permissionsLoading && !permissions;
  // Contract §11.5. The active venue's own liveness already knows this --
  // `deriveRouterLiveness` marks a controller row `not-applicable` -- so the
  // nav asks that rather than inventing a second notion of "is this a
  // controller". Read straight off the store, the same place `subtitle` and
  // every other venue fact on this shell comes from.
  //
  // Fails open in every direction it can: a venue with no liveness yet, a
  // venue whose routers could not be read, and a MIXED venue (a MikroTik
  // beside the controller, where the five screens act on the MikroTik and
  // genuinely work) all render exactly the nav they render today.
  const activeLocation = useCustomerStore((s) => s.activeLocation);
  const controllerManaged = locationIsControllerManaged(activeLocation?.liveness);
  const controllerVendor = locationControllerVendor(activeLocation?.liveness);
  const controllerReason = controllerVenueFeatureReason(controllerVendor);

  // The Marketing add-on's lock badge (wyfy-specs/guest-marketing-campaigns.md
  // §3.5). From `/me/entitlements` -- the backend's own entitlement snapshot,
  // the same one `RequireFeature` enforces -- never from the login-role radio.
  // `null` (loading, failed, demo) shows no badge; the page itself resolves the
  // truth from the backend's 402. The row stays visible and clickable when
  // locked (spec D5): a customer cannot ask for a feature they cannot see.
  const marketingEntitled = useFeatureEntitled(GUEST_MARKETING_FEATURE_KEY);
  // Traffic Lens: the same badge, the same source, the same rules.
  const trafficLensEntitled = useFeatureEntitled(TRAFFIC_LENS_FEATURE_KEY);

  return (
    <Sidebar
      collapsible="icon"
      // Console rail: a quiet surface (`--wy-surface`, light or dark with the
      // theme) instead of the indigo gradient it used to paint inline. The
      // `--sidebar*` tokens are re-pointed at the console ones by
      // `.wy-console` in styles.css. `wy-console` is on the rail itself (not
      // only the page wrapper) because ui/sidebar.tsx forwards this className
      // to the portal-rendered mobile Sheet, which mounts outside the page.
      // `customer-rail` keeps the sitewide brand sheen off this surface.
      className="wy-console customer-rail"
    >
      {/* `h-14` -- the top bar's height -- so this header's bottom border and
          the topbar's land on the same y. They read as one rule across the page -- the rule above
          "Overview" in the rail is the same rule that runs above "This
          location, right now" in the content well -- so any height
          disagreement shows up as a visible step where they meet at the
          rail's edge. The topbar is `h-16` (see CustomerShell), and the
          hand-rolled `<aside>` this replaced set `h-16` on its own header row
          to match. `SidebarHeader` has no height of its own -- it is `p-2`
          plus whatever it wraps -- so when the markup came across to the
          primitive the height did not, and the border settled wherever the
          brand block happened to end. Pinned now; `justify-center` keeps the
          block centred in the fixed box. */}
      <SidebarHeader className="h-14 justify-center border-b border-sidebar-border">
        {/* `px-0` in the collapsed icon rail. This row's own `px-2` sits
            inside `SidebarHeader`'s `p-2`, so the 32px brand chip starts
            16px in -- fine in the 16rem expanded rail, but the icon rail is
            `--sidebar-width-icon` (3rem), which leaves the row a 15px
            content box. The chip is `shrink-0`, so it kept its 32px and its
            right edge landed at 48px: past the rail's own painted edge, with
            the rail's right border ruled straight through the logo. The
            pre-primitive `<aside>` this replaced was a 64px rail with
            `overflow-hidden`, so neither the width nor the clip carried
            over. Dropping the inset also puts the chip's centre on x=24 --
            the same axis the nav icons below it centre on. */}
        {/* No `py-` here: the height is the header's now, and this row's own
            16px of vertical padding would make it 52.5px inside a 47px
            content box and spill back over the border we just pinned. */}
        <div className="flex items-center gap-2.5 px-2 group-data-[collapsible=icon]:px-0">
          <img src="/brand/mark-primary-blue.svg" alt="" className="h-8 w-8 shrink-0" />
          <div className="flex min-w-0 flex-col leading-tight group-data-[collapsible=icon]:hidden">
            <span className="truncate text-[13px] font-semibold tracking-tight text-[var(--wy-text)]">
              Wyfy Guest
            </span>
            {/* The venue name lives in the top bar's LocationSwitcher, not
                here as well. */}
            <span className="truncate text-[11px] text-[var(--wy-text-faint)]">
              {t("consoleShell.brandSubtitle", "Customer Portal")}
            </span>
          </div>
        </div>
      </SidebarHeader>

      {/* The primitive sets `overflow-hidden` in icon mode -- fine for the
          nine-row nav it was last used with, but 26 icon rows are taller
          than a short viewport and the ones past the bottom would simply be
          unreachable in the rail. Scroll instead of clip; the expanded
          sidebar already scrolls. Also drop the primitive's hardcoded
          `bg-background` so the wrapper gradient shows through. */}
      <SidebarContent className="gap-0 bg-transparent py-1 group-data-[collapsible=icon]:overflow-y-auto">
        {showSkeleton ? (
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {Array.from({ length: 8 }).map((_, i) => (
                  <SidebarMenuItem key={i}>
                    <SidebarMenuSkeleton showIcon />
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : (
          navGroups.map((group) => {
            const groupLabel = t(`customerGroup.${group.id}`, group.label);
            const body = (
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const active = item.id === activeFeatureId;
                    const label = t(`customerItem.${item.id}`, item.label);
                    // Contract §11.5. Muted, titled, and still a link --
                    // not removed, and not a dead `disabled` button.
                    //
                    // Removed loses the question: a row that was never there
                    // and a row this venue cannot use look identical, and an
                    // absence cannot be asked why. `disabled` loses the
                    // ANSWER: a disabled button takes no pointer events, so
                    // neither its `title` nor a Radix tooltip on it ever
                    // fires, and the owner gets a grey row with no way to
                    // find out what it means. Left as a link, it costs one
                    // click to read the whole explanation, and the
                    // destination is a panel with no form on it -- so
                    // nothing here can still be filled in and refused.
                    const viaController = controllerManaged
                      ? !featureAppliesToControllerVenue(item.id, controllerVendor)
                      : false;
                    return (
                      <SidebarMenuItem key={item.id}>
                        <SidebarMenuButton
                          asChild
                          isActive={active}
                          className={cn(ROW_CLASS, viaController && "opacity-60")}
                          // The collapsed rail is icons only, so the tooltip
                          // is the label. The primitive renders it as a real
                          // Radix tooltip and hides it when expanded, rather
                          // than the old `title=` attribute that showed
                          // nothing on touch.
                          tooltip={collapsed ? label : undefined}
                        >
                          <Link
                            to={customerFeatureHref(item.id)}
                            aria-current={active ? "page" : undefined}
                            className="relative"
                            title={viaController ? controllerReason : undefined}
                          >
                            {/* Active-page accent bar -- a 2px accent rail on
                             * the row's leading edge so the current section
                             * reads instantly when the sidebar is expanded.
                             * Hidden in the collapsed icon rail: the rail is
                             * one icon wide, so a bar pinned to the row's
                             * left edge optically shoves the icon off-center
                             * (the active pill fill is the indicator there). */}
                            {active && !collapsed && (
                              <span
                                aria-hidden
                                className="absolute -left-2 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-r-full bg-[var(--wy-accent)]"
                              />
                            )}
                            <Icon className="h-4 w-4 shrink-0" />
                            <span className="flex-1 truncate">{label}</span>
                            {((item.id === "marketing" && marketingEntitled === false) ||
                              (item.id === "traffic-lens" && trafficLensEntitled === false)) && (
                              <span
                                className="ml-auto inline-flex shrink-0 items-center gap-1 rounded border border-[var(--wy-border)] bg-[var(--wy-surface-2)] px-1.5 py-px text-[10px] font-semibold text-[var(--wy-text-faint)] group-data-[collapsible=icon]:hidden"
                                title={`${label} is an add-on that isn't enabled for your organisation`}
                              >
                                <Lock aria-hidden className="h-2.5 w-2.5" />
                                {t("customerItemBadge.addon", "Add-on")}
                              </span>
                            )}
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
                {/* One quiet line, in the group it is about, and only when
                    something in that group is actually greyed -- the same
                    treatment (and the same reasoning) as the
                    "hidden by your permissions" note below. A tooltip on a
                    muted row is only found by the owner who already hovers
                    it; this is the sentence for the one who does not. */}
                {controllerManaged &&
                  !collapsed &&
                  group.items.some(
                    (item) => !featureAppliesToControllerVenue(item.id, controllerVendor),
                  ) && (
                    <p className="px-2 pt-1 text-[11px] leading-snug text-[var(--wy-text-faint)]">
                      {controllerReason}
                    </p>
                  )}
              </SidebarGroupContent>
            );
            return COLLAPSIBLE_GROUP_IDS.has(group.id) ? (
              <CollapsibleNavGroup
                key={group.id}
                group={group}
                label={groupLabel}
                activeFeatureId={activeFeatureId}
                railCollapsed={collapsed}
              >
                {body}
              </CollapsibleNavGroup>
            ) : (
              <SidebarGroup key={group.id}>
                <SidebarGroupLabel className={GROUP_LABEL_CLASS}>{groupLabel}</SidebarGroupLabel>
                {body}
              </SidebarGroup>
            );
          })
        )}
        {!showSkeleton && hiddenByPermissions.length > 0 && !collapsed && (
          <div className="px-4 pb-3 pt-1">
            <p
              className="flex items-start gap-1.5 text-[11px] leading-snug text-[var(--wy-text-faint)]"
              title={`Hidden by your permissions: ${hiddenByPermissions
                .map((i) => t(`customerItem.${i.id}`, i.label))
                .join(", ")}`}
            >
              <Lock aria-hidden className="mt-[1px] h-3 w-3 shrink-0" />
              <span>
                {hiddenByPermissions.length} section
                {hiddenByPermissions.length === 1 ? "" : "s"} hidden by your permissions
              </span>
            </p>
          </div>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              disabled={dataMasking.sending}
              onClick={dataMasking.requestToggle}
              className={ROW_CLASS}
              tooltip={
                dataMasking.masked
                  ? "Guest details are hidden. Click to verify and show them."
                  : "Guest details are visible. Click to hide them again."
              }
            >
              {dataMasking.sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : dataMasking.masked ? (
                <Shield className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
              <span className="flex-1 truncate">
                {t("consoleShell.guestPrivacy", "Guest Privacy")}
              </span>
              {/* The state, in words -- the icon alone was the only cue. */}
              <span
                className={cn(
                  "ml-auto shrink-0 rounded px-1.5 py-px text-[10px] font-semibold group-data-[collapsible=icon]:hidden",
                  dataMasking.masked
                    ? "bg-[var(--wy-ok-soft)] text-[var(--wy-ok)]"
                    : "bg-[var(--wy-warn-soft)] text-[var(--wy-warn)]",
                )}
              >
                {dataMasking.masked
                  ? t("consoleShell.privacyOn", "Hidden")
                  : t("consoleShell.privacyOff", "Visible")}
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      {/* Drag-or-click edge handle. Carries aria-label="Toggle Sidebar" and
          the Cmd/Ctrl-B binding from the primitive -- the old rail had a
          bare "◄"/"►" glyph with no accessible name at all. */}
      <SidebarRail />

      <DataMaskingOtpDialog
        open={dataMasking.otpOpen}
        maskingOn={dataMasking.pendingTarget}
        sentTo={dataMasking.sentTo}
        verifying={dataMasking.verifying}
        onVerify={dataMasking.verifyToggle}
        onCancel={dataMasking.cancel}
      />
    </Sidebar>
  );
}
