import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Bot, MapPinned, KeyRound, ShieldCheck, LogOut, RefreshCw } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { CommandPaletteTrigger } from "@/components/customer/CustomerCommandPalette";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { PlanRenewalTicket } from "@/components/features/HeaderControls";
import { DashboardLanguageSwitcher } from "@/components/layout/DashboardLanguageSwitcher";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import {
  customerFeatureHref,
  customerNavGroupsForRole,
  getCustomerLoginRole,
} from "@/lib/customerNav";
import { filterNavGroupsByPermissions } from "@/lib/customerNavPermissions";
import { useMyPermissions } from "@/hooks/useCustomerDashboard";
import { LocationSwitcher } from "@/components/customer/LocationSwitcher";

interface CustomerHeaderProps {
  /** Left-side content after the venue switcher -- each page composes its
   * own (page title, optionally a live status dot). The venue name itself
   * is rendered by `LocationSwitcher`, so titles must not repeat it. */
  title: ReactNode;
  locationId: string;
  /** Real ISO renewal date (e.g. `current_period_end`/`renewalDate` from
   * `GET /billing/dashboard/me`), not pre-formatted -- `PlanRenewalTicket`
   * needs the raw date to compute the real countdown/urgency tier, and
   * formats it for display itself. */
  planExpiryIso?: string;
  /** Opens the Cmd/Ctrl-K palette: one step to any feature by name, however
   * the sidebar groups it -- and a shortcut with no visible control only
   * serves the people who already know it exists. */
  onOpenSearch: () => void;
  /** Shown only on pages that actually have something to refresh. */
  onRefresh?: () => void;
  user: { firstName?: string; lastName?: string; name?: string; email?: string } | null;
  onSwitchLocation: () => void;
  onChangePassword: () => void;
  onTfaSettings: () => void;
  onLogout: () => void;
}

const MENU_ITEM =
  "cursor-pointer gap-2 rounded-lg px-3 py-2 text-white hover:bg-white/10 focus:bg-white/10 focus:text-white";

/**
 * The one shared top bar every `/customer/$locationId/*` page renders --
 * same lesson as `CustomerSidebar.tsx`: this exact markup used to be
 * hand-rolled independently in three places (customer.$locationId.$feature
 * .tsx, customer.$locationId.dashboard.tsx, customer.$locationId.users.tsx),
 * each drifting slightly out of sync (a dead "search" button here, a
 * missing refresh button there). Extracted so it can't drift again, and
 * given the same dark indigo chrome as the sidebar it sits beside --
 * matching the product screenshots on wyfyguest.com. The light
 * `bg-background/80` treatment that preceded it lives in git history.
 */
export function CustomerHeader({
  title,
  locationId,
  planExpiryIso,
  onOpenSearch,
  onRefresh,
  user,
  onSwitchLocation,
  onChangePassword,
  onTfaSettings,
  onLogout,
}: CustomerHeaderProps) {
  // Staff Access left the sidebar for this menu (customerNav.ts's "account"
  // group, `inSidebar: false`). Offered by the exact gate the sidebar row
  // used -- owner login role, then `users.read` from the caller's real
  // grants, failing open on an absent/failed/empty answer -- by asking the
  // same expression the command palette evaluates rather than restating it.
  const { data: permissions } = useMyPermissions();
  const showStaffAccess = filterNavGroupsByPermissions(
    customerNavGroupsForRole(getCustomerLoginRole()),
    permissions,
  ).some((g) => g.items.some((item) => item.id === "agents"));

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-white/10 bg-gradient-to-r from-[#1e1b4b] to-[#312e81] px-4 text-white backdrop-blur-xl sm:px-6">
      {/* The sidebar primitive's own trigger. #218 had already grown the
          hand-rolled hamburger from a bare 20px <Menu/> -- the smallest tap
          target in the product, and the only route to navigation on a phone
          -- to a 40px labelled button; this replaces that button outright,
          because the trigger has to talk to the provider that now owns the
          mobile Sheet and the Cmd/Ctrl-B binding. Same 40px box, same
          optical left edge, and aria-label="Toggle Sidebar" comes from the
          primitive rather than being spelled here. */}
      <SidebarTrigger className="-ml-1 h-10 w-10 shrink-0 text-white/70 hover:bg-white/10 hover:text-white" />
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <LocationSwitcher />
        <div className="min-w-0">{title}</div>
      </div>

      {/* Plan renewal + demo CTA is one perforated "ticket" object, not a
          rounded pill. See HeaderControls.tsx for the reasoning. Defaults to
          appearing from `sm:` (640px) up, which -- once the location name/
          status title on the left and the refresh/bell/avatar icons on the
          right are also in the row -- left almost no room for the title in
          the ~640-1024px tablet band specifically: it measured out to an
          8px-wide `min-w-0` remainder, rendering as a single clipped letter
          ("M" instead of "Mumbai HQ") with no visible overflow to point at.
          Pushed to `lg:` (1024px) here instead, so the tablet band gets the
          same hidden treatment phones already get, rather than a half-shown
          one. (The data-masking toggle that used to sit here moved to the
          sidebar footer -- see CustomerSidebar.tsx.) */}
      <CommandPaletteTrigger onClick={onOpenSearch} />
      <PlanRenewalTicket
        expiryIso={planExpiryIso}
        className="mr-1 hidden h-9 shrink-0 items-stretch lg:flex"
      />
      {onRefresh && (
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-white/70 hover:bg-white/10 hover:text-white"
          onClick={onRefresh}
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      )}
      {/* Was missing entirely on this header -- the dashboard i18n rollout
          only wired DashboardLanguageSwitcher into TopNavbar.tsx (the
          Master Console layout), leaving every real customer/org-admin page
          (everything under /c/$locationId, which is what this component
          renders) with no way to switch language short of a trip to Account
          settings. Styled to match the refresh button beside it since the
          default ghost styling isn't legible on this header's dark gradient. */}
      <DashboardLanguageSwitcher className="h-9 w-9 text-white/70 hover:bg-white/10 hover:text-white" />
      {/* Exactly the gap the language switcher had: the theme context, the
          `.dark` class and the pre-paint script all work on every surface,
          but the only place with a control was the operator console's
          TopNavbar. A customer on a dark-OS machine got dark mode applied by
          `prefers-color-scheme` with no way out of it -- and this console's
          content well is token-driven, so the switch genuinely changes it. */}
      <ThemeToggle className="h-9 w-9 text-white/70 hover:bg-white/10 hover:text-white" />
      <span className="[&_button]:text-white/70 [&_button:hover]:bg-white/10 [&_button:hover]:text-white">
        <NotificationBell scope="org" viewAllPath={customerFeatureHref("alerts")} />
      </span>

      {/* Radix, not the useState toggle it replaces: that one never closed
          on an outside click or Escape, announced nothing to a screen reader
          and left focus on the avatar. The primitive does all of that plus
          arrow-key navigation. `focus:` mirrors every `hover:` because Radix
          moves real focus between items -- a hover-only highlight would be
          invisible to a keyboard user. */}
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Account menu"
          className="ml-1 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
        >
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-white/15 text-xs font-semibold text-white">
              {user?.firstName?.[0] ?? "A"}
              {user?.lastName?.[0] ?? "U"}
            </AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          sideOffset={8}
          className="w-56 rounded-xl border-white/10 bg-[#241f4d] p-1 text-white shadow-xl"
        >
          <DropdownMenuLabel className="px-3 py-2 font-normal">
            <p className="text-sm font-medium">{user?.name ?? "Admin"}</p>
            <p className="text-xs text-white/50">{user?.email}</p>
          </DropdownMenuLabel>
          <DropdownMenuSeparator className="bg-white/10" />
          <DropdownMenuItem onSelect={onSwitchLocation} className={MENU_ITEM}>
            <MapPinned className="h-4 w-4" />
            Switch location
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onChangePassword} className={MENU_ITEM}>
            <KeyRound className="h-4 w-4" />
            Change password
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onTfaSettings} className={MENU_ITEM}>
            <ShieldCheck className="h-4 w-4" />
            2FA settings
          </DropdownMenuItem>
          {showStaffAccess && (
            <DropdownMenuItem asChild className={MENU_ITEM}>
              <Link to={customerFeatureHref("agents")}>
                <Bot className="h-4 w-4" />
                Staff access
              </Link>
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator className="bg-white/10" />
          <DropdownMenuItem
            onSelect={onLogout}
            className="cursor-pointer gap-2 rounded-lg px-3 py-2 text-rose-400 hover:bg-rose-500/10 focus:bg-rose-500/10 focus:text-rose-400"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
