import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Shield, Eye, Loader2, Lock } from "lucide-react";
import { useTranslation } from "react-i18next";
import i18n from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  customerFeatureHref,
  customerNavGroupOf,
  customerSidebarEntries,
  customerSidebarGroupsForRole,
  getCustomerLoginRole,
  type CustomerNavItem,
  type CustomerSidebarEntry,
} from "@/lib/customerNav";
import {
  filterNavGroupsByPermissions,
  navItemsHiddenByPermissions,
} from "@/lib/customerNavPermissions";
import { locationControllerVendor, locationIsControllerManaged } from "@/lib/location-liveness";
import {
  controllerVenueFeatureReason,
  featureAppliesToControllerVenue,
  isNasOnlyVendor,
} from "@/lib/router-vendors";
import { useCustomerStore } from "@/stores/customerStore";
import { DataMaskingOtpDialog } from "@/components/features/HeaderControls";
import { useFeatureEntitled, useMyPermissions } from "@/hooks/useCustomerDashboard";
import { GUEST_MARKETING_FEATURE_KEY } from "@/types/marketing";
import { TRAFFIC_LENS_FEATURE_KEY } from "@/types/traffic-lens";
import { useVenueSnapshotRefresh } from "@/hooks/useVenueSnapshotRefresh";
import type { useDataMasking } from "@/hooks/useCustomerDashboard";

/**
 * The one shared sidebar every customer page renders: ten rows, straight off
 * `CUSTOMER_NAV_GROUPS` via `customerSidebarGroupsForRole`, role-filtered and
 * then permission-filtered, turned into rows by `customerSidebarEntries`.
 * Staff Access is the one feature not here -- it is in the avatar menu
 * (CustomerHeader.tsx).
 *
 * ON THE GROUPING (docs/design/nav-consolidation.md)
 * --------------------------------------------------
 * Home's three screens (Dashboard, Alerts, Fix a Problem) are rows of their
 * own. Every other group is ONE row -- Guests, Marketing, Login Page,
 * Network, Security, then Logs and Help below a divider -- that opens the
 * first screen in it the caller can see; the rest are tabs on that page
 * (`SectionTabs`). The owner asked for it on 2026-10-31: "too many options".
 *
 * A previous change (#219) folded the menu into nine "destinations" and was
 * reverted (#220): the one-row-per-screen menu was what customers navigated
 * by. This version keeps what that one lost. There is no second nav module
 * -- the groups are the sections -- every screen keeps its URL and is still
 * its own command-palette entry by its own name (plus synonyms), a tab is
 * shown exactly when its row would have been, and the collapsed rail's
 * flyout lists every screen behind each icon.
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
 * Those were bug fixes that happened to travel with the first grouping
 * change, and #220 kept them. Same for the rows
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

/** Nav row: quiet by default, surface-2 on hover, accent-soft + accent text
 * when current. Overrides the primitive's hover (which would otherwise use
 * the same accent tint as the active row and blur the two together). */
const ROW_CLASS =
  "h-10 gap-3 rounded-[var(--wy-radius)] px-3 text-[15px] text-[var(--wy-text-muted)] hover:bg-[var(--wy-surface-2)] hover:text-[var(--wy-text)] active:bg-[var(--wy-surface-2)] data-[active=true]:bg-[var(--wy-accent-soft)] data-[active=true]:font-semibold data-[active=true]:text-[var(--wy-accent)] focus-visible:ring-[var(--wy-accent)] [&>svg]:text-current";

/** Sections drawn below a divider at the foot of the menu: the records and
 * the help, which an owner opens after the fact rather than to run the venue.
 * (Logs used to be a collapsible group, closed by default, to save its three
 * rows; as one row it has nothing left to collapse.) */
const TRAILING_SECTION_IDS: ReadonlySet<string> = new Set(["logs", "help"]);

/** A paid add-on the org has not bought, by feature id. */
type LockedFn = (id: string) => boolean;

/**
 * The collapsed rail's flyout for a section row: the section's name, then
 * its tabs as links, so the rail still shows -- and reaches -- every screen
 * behind the icon. Rendered inside the primitive's Radix tooltip, which
 * keeps hoverable content open while the pointer is on it. Keyboard users
 * get the row's own link (the first tab) and the tab bar on that page.
 */
function SectionFlyout({
  label,
  tabs,
  activeFeatureId,
  isLocked,
  labelOf,
}: {
  label: string;
  tabs: CustomerNavItem[];
  activeFeatureId: string;
  isLocked: LockedFn;
  labelOf: (item: CustomerNavItem) => string;
}) {
  return (
    <div className="min-w-[11rem] py-0.5">
      <p className="px-1.5 pb-1 text-[11px] font-semibold uppercase tracking-wider opacity-70">
        {label}
      </p>
      <ul className="space-y-px">
        {tabs.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.id}>
              <Link
                to={customerFeatureHref(item.id)}
                aria-current={item.id === activeFeatureId ? "page" : undefined}
                className="flex items-center gap-2 rounded px-1.5 py-1 text-[12px] hover:bg-black/10 aria-[current=page]:font-semibold dark:hover:bg-white/10"
              >
                <Icon aria-hidden className="h-3.5 w-3.5 shrink-0 opacity-80" />
                <span className="flex-1 truncate">{labelOf(item)}</span>
                {isLocked(item.id) && <Lock aria-hidden className="h-3 w-3 shrink-0 opacity-70" />}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
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
  // DASHBOARD_PLAN P1-J: re-read an Aruba Instant On venue snapshot once per
  // app load. The dashboard refreshes it from its own read instead. A
  // MikroTik, Omada or failed-read snapshot makes no request here.
  useVenueSnapshotRefresh(activeFeatureId !== "dashboard");
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
  const isLocked: LockedFn = (id) =>
    (id === "marketing" && marketingEntitled === false) ||
    (id === "traffic-lens" && trafficLensEntitled === false);

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
            <span className="truncate text-[15px] font-semibold tracking-tight text-[var(--wy-text)]">
              Wyfy Guest
            </span>
            {/* The venue name lives in the top bar's LocationSwitcher, not
                here as well. */}
            <span className="truncate text-[12px] text-[var(--wy-text-faint)]">
              {t("consoleShell.brandSubtitle", "Customer Portal")}
            </span>
          </div>
        </div>
      </SidebarHeader>

      {/* The primitive sets `overflow-hidden` in icon mode. Ten rows fit a
          laptop, but not a short landscape phone or a zoomed window, and
          rows past the bottom would simply be unreachable in the rail.
          Scroll instead of clip (kept from the 26-row menu); the expanded
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
          <SidebarEntries
            entries={customerSidebarEntries(navGroups)}
            activeFeatureId={activeFeatureId}
            collapsed={collapsed}
            controllerManaged={controllerManaged}
            controllerVendor={controllerVendor}
            controllerReason={controllerReason}
            isLocked={isLocked}
          />
        )}
        {!showSkeleton && hiddenByPermissions.length > 0 && !collapsed && (
          <div className="px-4 pb-3 pt-1">
            <p
              className="flex items-start gap-1.5 text-[11px] leading-snug text-[var(--wy-text-faint)]"
              title={t("consoleShell.hiddenList", {
                list: hiddenByPermissions.map((i) => t(`customerItem.${i.id}`, i.label)).join(", "),
                defaultValue: "Hidden by your permissions: {{list}}",
              })}
            >
              <Lock aria-hidden className="mt-[1px] h-3 w-3 shrink-0" />
              <span>
                {t("consoleShell.hiddenCount", {
                  count: hiddenByPermissions.length,
                  defaultValue_one: "{{count}} screen hidden by your permissions",
                  defaultValue_other: "{{count}} screens hidden by your permissions",
                })}
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
                  ? t(
                      "consoleShell.privacyHiddenHint",
                      "Guest details are hidden. Click to verify it's you and show them.",
                    )
                  : t(
                      "consoleShell.privacyShownHint",
                      "Guest details are visible. Click to hide them again.",
                    )
              }
            >
              {dataMasking.sending ? (
                <Loader2 className="h-[18px] w-[18px] animate-spin" />
              ) : dataMasking.masked ? (
                <Shield className="h-[18px] w-[18px]" />
              ) : (
                <Eye className="h-[18px] w-[18px]" />
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

/**
 * The menu: Home's rows, then the sections, then the trailing sections (Logs,
 * Help) below a divider. One `<Link>` per row with `aria-current`, exactly as
 * before; a section row links to its first visible tab and is current when
 * the page is any of its tabs.
 */
function SidebarEntries({
  entries,
  activeFeatureId,
  collapsed,
  controllerManaged,
  controllerVendor,
  controllerReason,
  isLocked,
}: {
  entries: CustomerSidebarEntry[];
  activeFeatureId: string;
  collapsed: boolean;
  controllerManaged: boolean;
  controllerVendor: string | null;
  controllerReason: string;
  isLocked: LockedFn;
}) {
  const { t } = useTranslation("nav", { i18n });
  const labelOf = (item: CustomerNavItem) => t(`customerItem.${item.id}`, item.label);
  // Contract §11.5, per screen -- the same test the rows always used.
  const unsupported = (id: string) =>
    controllerManaged && !featureAppliesToControllerVenue(id, controllerVendor);
  // A page whose own tab the filters hid (opened by URL) still lights its
  // section: "where am I?" must always have an answer in the menu.
  const activeGroupId = customerNavGroupOf(activeFeatureId)?.id;

  const renderEntry = (entry: CustomerSidebarEntry) => {
    let key: string;
    let Icon: CustomerNavItem["icon"];
    let label: string;
    let href: string;
    let active: boolean;
    let muted: boolean;
    let locked: boolean;
    let tooltip: string | { children: ReactNode; className: string };
    if (entry.kind === "item") {
      const { item } = entry;
      key = item.id;
      Icon = item.icon;
      label = labelOf(item);
      href = customerFeatureHref(item.id);
      active = item.id === activeFeatureId;
      muted = unsupported(item.id);
      locked = isLocked(item.id);
      tooltip = label;
    } else {
      const { group } = entry;
      const tabs = group.items;
      key = `section:${group.id}`;
      Icon = group.icon ?? tabs[0].icon;
      label = t(`customerGroup.${group.id}`, group.label);
      href = customerFeatureHref(tabs[0].id);
      active = activeGroupId === group.id;
      // Muted / badged only when EVERY screen behind the row is: a row that
      // still opens something usable must not look unusable.
      muted = tabs.every((i) => unsupported(i.id));
      locked = tabs.every((i) => isLocked(i.id));
      tooltip = {
        // Radix portals the tooltip onto <body>, outside the rail, so it
        // needs the console scope (and the rail's indigo) by class.
        className:
          "wy-console customer-rail border border-white/10 bg-[#241f5c] p-2 text-[#d6d3f0]",
        children: (
          <SectionFlyout
            label={label}
            tabs={tabs}
            activeFeatureId={activeFeatureId}
            isLocked={isLocked}
            labelOf={labelOf}
          />
        ),
      };
    }
    return (
      <SidebarMenuItem key={key}>
        <SidebarMenuButton
          asChild
          isActive={active}
          className={cn(ROW_CLASS, muted && "opacity-60")}
          // The collapsed rail is icons only, so the tooltip is the label --
          // and, for a section, the list of its tabs. The primitive hides it
          // when expanded and on mobile.
          tooltip={collapsed ? tooltip : undefined}
        >
          <Link
            to={href}
            aria-current={active ? "page" : undefined}
            className="relative"
            title={muted ? controllerReason : undefined}
          >
            {/* Active accent bar on the row's leading edge; hidden in the
             * icon rail, where it would shove the icon off-centre. */}
            {active && !collapsed && (
              <span
                aria-hidden
                className="absolute -left-2 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-[var(--wy-accent)]"
              />
            )}
            <Icon className="h-[18px] w-[18px] shrink-0" />
            <span className="flex-1 truncate">{label}</span>
            {/* Aruba #413: a row none of whose screens this venue can use
                (e.g. Network at an Aruba Instant On venue) says so with a
                lock, not just a dimmed label. */}
            {muted && !locked && (
              <Lock
                aria-label={controllerReason}
                data-testid={`sidebar-locked-${key}`}
                className="ml-auto h-3 w-3 shrink-0 opacity-70 group-data-[collapsible=icon]:hidden"
              />
            )}
            {locked && (
              <span
                className="ml-auto inline-flex shrink-0 items-center gap-1 rounded border border-[var(--wy-border)] bg-[var(--wy-surface-2)] px-1.5 py-px text-[10px] font-semibold text-[var(--wy-text-faint)] group-data-[collapsible=icon]:hidden"
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
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  const blocks: CustomerSidebarEntry[][] = [
    entries.filter((e) => e.kind === "item"),
    entries.filter((e) => e.kind === "section" && !TRAILING_SECTION_IDS.has(e.group.id)),
    entries.filter((e) => e.kind === "section" && TRAILING_SECTION_IDS.has(e.group.id)),
  ].filter((b) => b.length > 0);
  // One quiet line when anything behind the menu is greyed for this venue --
  // a muted tab is only found by someone already on its section.
  const anyUnsupported = entries.some((e) =>
    e.kind === "item" ? unsupported(e.item.id) : e.group.items.some((i) => unsupported(i.id)),
  );

  return (
    <>
      {blocks.map((block, i) => (
        <SidebarGroup
          key={i}
          className={cn(
            i > 0 && "border-t border-sidebar-border/70 group-data-[collapsible=icon]:border-t",
          )}
        >
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">{block.map(renderEntry)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ))}
      {/* Not at a NAS-only (Aruba Instant On) venue: there the reason is the
          bare "This feature isn't available for this venue yet.", which under
          Help read as a stray error on every screen (live walk 2026-11-07).
          The muted rows keep it as their tooltip. MikroTik never gets here
          (`controllerManaged` is false); Omada is unchanged. */}
      {controllerManaged && !isNasOnlyVendor(controllerVendor) && !collapsed && anyUnsupported && (
        <p className="px-4 pb-2 pt-1 text-[11px] leading-snug text-[var(--wy-text-faint)]">
          {controllerReason}
        </p>
      )}
    </>
  );
}
