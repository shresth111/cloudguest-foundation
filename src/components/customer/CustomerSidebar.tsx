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
import {
  customerFeatureHref,
  customerNavGroupsForRole,
  getCustomerLoginRole,
} from "@/lib/customerNav";
import { filterNavGroupsByPermissions } from "@/lib/customerNavPermissions";
import { DataMaskingOtpDialog } from "@/components/features/HeaderControls";
import { useMyPermissions } from "@/hooks/useCustomerDashboard";
import type { useDataMasking } from "@/hooks/useCustomerDashboard";

/**
 * The one shared sidebar every customer page renders: the 26 features in
 * their seven groups (Overview / Engagement / Access & Policy / Devices &
 * Team / Network / Operations / Support & Logs), straight off
 * `CUSTOMER_NAV_GROUPS`, role-filtered and then permission-filtered.
 *
 * ON THE GROUPING
 * ---------------
 * A previous change folded these 26 into nine "destinations" with the other
 * seventeen reachable as tabs inside them. That grouping was reverted: the
 * one-row-per-screen menu is what this product's customers navigate by, and
 * the destination layer is gone rather than left half-wired. `customerNav.ts`
 * is the single source of truth for what is offered and
 * `customerFeatureHref()` for where each one lives, exactly as before.
 *
 * The known costs of this shape are real and are not fixed here -- "why is
 * the WiFi down" is answered across four of the seven groups, and 26 rows
 * plus seven group labels is more nav than a laptop viewport holds, so the
 * last groups sit below the fold. Both want an ordering/labelling pass
 * inside this structure, which is a separate change from restoring it.
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
  const navGroups = filterNavGroupsByPermissions(customerNavGroupsForRole(role), permissions);
  // A brief, honest "still looking" instead of painting the full nav and
  // letting it shrink under the pointer once grants arrive. `isLoading` is
  // false for demo, failed and empty alike, so all three still fall through
  // to the fail-open full nav.
  const showSkeleton = permissionsLoading && !permissions;

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
                these rows is filtered to it -- see the scope line each
                feature page renders for the same reason. */}
            <span className="truncate text-[11px] text-sidebar-foreground/50">
              {subtitle ?? "Your venue"}
            </span>
          </div>
        </div>
      </SidebarHeader>

      {/* The primitive sets `overflow-hidden` in icon mode -- fine for the
          nine-row nav it was last used with, but 26 icon rows are taller
          than a short viewport and the ones past the bottom would simply be
          unreachable in the rail. Scroll instead of clip; the expanded
          sidebar already scrolls. */}
      <SidebarContent className="group-data-[collapsible=icon]:overflow-y-auto">
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
          navGroups.map((group) => (
            <SidebarGroup key={group.id}>
              <SidebarGroupLabel className="text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/55">
                {t(`customerGroup.${group.id}`, group.label)}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const active = item.id === activeFeatureId;
                    const label = t(`customerItem.${item.id}`, item.label);
                    return (
                      <SidebarMenuItem key={item.id}>
                        <SidebarMenuButton
                          asChild
                          isActive={active}
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
                          >
                            <Icon className="h-4 w-4 shrink-0" />
                            <span className="flex-1 truncate">{label}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))
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
