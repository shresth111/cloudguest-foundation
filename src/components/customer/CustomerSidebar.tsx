import { Link } from "@tanstack/react-router";
import { Shield, Eye, Loader2 } from "lucide-react";
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
import { customerFeatureHref, getCustomerLoginRole } from "@/lib/customerNav";
import {
  DESTINATION_GROUPS,
  destinationForFeature,
  destinationHome,
  destinationsFor,
} from "@/lib/customerDestinations";
import { DataMaskingOtpDialog } from "@/components/features/HeaderControls";
import { useMyPermissions } from "@/hooks/useCustomerDashboard";
import type { useDataMasking } from "@/hooks/useCustomerDashboard";

/**
 * The customer sidebar: nine destinations, built on the shadcn `Sidebar`
 * primitive this repo already ships.
 *
 * TWO CHANGES, AND THE SECOND IS WHY THIS FILE SHRANK
 * ---------------------------------------------------
 * 1. It renders `CUSTOMER_DESTINATIONS` (see customerDestinations.ts for
 *    why 26 became 9) rather than `CUSTOMER_NAV_GROUPS` directly. Every one
 *    of the 26 features still exists and still has its own route; a
 *    destination navigates to its first openable section and the shell
 *    renders the rest as tabs.
 *
 * 2. It is `components/ui/sidebar.tsx` now, not a hand-rolled `<aside>`.
 *    That primitive was already in this repo and already used -- by
 *    AppSidebar, TopNavbar and `_authenticated.tsx`, i.e. the Master
 *    Console. Customers got the hand-rolled one, which meant they were the
 *    only audience without:
 *
 *      - collapse state that survives navigation. The old one held it in
 *        `useState(true)` inside a component every route remounts (each
 *        feature is its own top-level route with its own arrow-function
 *        component), so collapsing the sidebar and clicking anything sprang
 *        it back open. The primitive persists it to a cookie for a week.
 *      - Cmd/Ctrl-B to toggle.
 *      - a real mobile drawer. The old one was a `translate-x` div beside a
 *        click-scrim: no focus trap, no Escape, no body-scroll lock, no
 *        dialog semantics. The primitive uses Radix `Sheet` and gets all
 *        four.
 *      - focus-visible rings on the nav rows.
 *
 * Nav rows are `<Link>`, not `<button onClick>`. The old rows had no href,
 * so there was no cmd-click, no open-in-new-tab, no `aria-current`, and a
 * screen reader announced 26 unlabelled buttons with no indication of which
 * page you were on. `customerFeatureHref()` was already the single source of
 * truth for the URLs; nothing but the element type had to change.
 */
export interface CustomerSidebarProps {
  /** The *feature* id of the current page, e.g. "reports", "mac-auth". The
   * destination that owns it is what renders active. */
  activeFeatureId: string;
  /** Shown under the brand mark -- the active venue's name. */
  subtitle?: string;
  /** See the previous implementation's note: "hide sensitive data" is an
   * account-level setting, so it lives with navigation rather than as a
   * transient header pill. The OTP dialog travels with it. */
  dataMasking: ReturnType<typeof useDataMasking>;
}

export function CustomerSidebar({ activeFeatureId, subtitle, dataMasking }: CustomerSidebarProps) {
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
  const destinations = destinationsFor(role, permissions);
  const activeDestinationId = destinationForFeature(activeFeatureId)?.id;
  // A brief, honest "still looking" instead of painting the full nav and
  // letting it shrink under the pointer once grants arrive. `isLoading` is
  // false for demo, failed and empty alike, so all three still fall through
  // to the fail-open full nav.
  const showSkeleton = permissionsLoading && !permissions;

  const renderRows = (rows: ReturnType<typeof destinationsFor>) =>
    rows.map(({ destination, sections }) => {
      const Icon = destination.icon;
      const first = destinationHome(destination, role, permissions);
      const label = t(`customerDestination.${destination.id}`, destination.label);
      return (
        <SidebarMenuItem key={destination.id}>
          <SidebarMenuButton
            asChild
            isActive={destination.id === activeDestinationId}
            // The collapsed rail is icons only, so the tooltip is the label.
            // The primitive renders it as a real Radix tooltip and hides it
            // when expanded, rather than the old `title=` attribute that
            // showed nothing on touch.
            tooltip={collapsed ? label : undefined}
          >
            <Link
              to={first ? customerFeatureHref(first) : "/"}
              aria-current={destination.id === activeDestinationId ? "page" : undefined}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="flex-1 truncate">{label}</span>
              {/* How many things live behind this door. Only where it is
                  more than one, and never in the rail. */}
              {sections.length > 1 && !collapsed && (
                <span className="ml-auto text-[10px] tabular-nums text-sidebar-foreground/40">
                  {sections.length}
                </span>
              )}
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      );
    });

  const ungrouped = destinations.filter((d) => d.destination.group === null);
  const home = ungrouped.filter((d) => d.destination.id === "home");
  const settings = ungrouped.filter((d) => d.destination.id === "settings");

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2.5 px-2 py-2">
          <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#6C4EFF] to-[#8B5CF6]">
            <img src="/brand/mark-compact-white.svg" alt="" className="h-4.5 w-4.5" />
          </div>
          <div className="flex min-w-0 flex-col group-data-[collapsible=icon]:hidden">
            <span className="truncate text-sm font-bold tracking-tight">Wyfy Guest</span>
            {/* The venue this whole shell is scoped to. Every list behind
                these nine doors is filtered to it -- see the scope line each
                feature page renders for the same reason. */}
            <span className="truncate text-[11px] text-sidebar-foreground/50">
              {subtitle ?? "Your venue"}
            </span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {showSkeleton ? (
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {Array.from({ length: 6 }).map((_, i) => (
                  <SidebarMenuItem key={i}>
                    <SidebarMenuSkeleton showIcon />
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : (
          <>
            {home.length > 0 && (
              <SidebarGroup>
                <SidebarGroupContent>
                  <SidebarMenu>{renderRows(home)}</SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            )}
            {DESTINATION_GROUPS.map((group) => {
              const rows = destinations.filter((d) => d.destination.group === group.id);
              if (rows.length === 0) return null;
              return (
                <SidebarGroup key={group.id}>
                  <SidebarGroupLabel className="text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/55">
                    {t(`customerDestinationGroup.${group.id}`, group.label)}
                  </SidebarGroupLabel>
                  <SidebarGroupContent>
                    <SidebarMenu>{renderRows(rows)}</SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
              );
            })}
            {settings.length > 0 && (
              <SidebarGroup className="mt-auto">
                <SidebarGroupContent>
                  <SidebarMenu>{renderRows(settings)}</SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            )}
          </>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              disabled={dataMasking.sending}
              onClick={dataMasking.requestToggle}
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
                <Eye className={cn("h-4 w-4", "text-sky-400")} />
              )}
              <span className="flex-1 truncate">Guest Privacy</span>
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
