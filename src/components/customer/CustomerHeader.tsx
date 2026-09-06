import { useState, type ReactNode } from "react";
import { MapPinned, KeyRound, ShieldCheck, LogOut, RefreshCw } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { CommandPaletteTrigger } from "@/components/customer/CustomerCommandPalette";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { PlanRenewalTicket } from "@/components/features/HeaderControls";
import { DashboardLanguageSwitcher } from "@/components/layout/DashboardLanguageSwitcher";
import { customerFeatureHref } from "@/lib/customerNav";

interface CustomerHeaderProps {
  /** Left-side content -- each page composes its own (page title, location
   * name, optionally a live status dot), everything to the right is
   * identical across every customer page and lives here. */
  title: ReactNode;
  locationId: string;
  /** Real ISO renewal date (e.g. `current_period_end`/`renewalDate` from
   * `GET /billing/dashboard/me`), not pre-formatted -- `PlanRenewalTicket`
   * needs the raw date to compute the real countdown/urgency tier, and
   * formats it for display itself. */
  planExpiryIso?: string;
  /** Opens the Cmd/Ctrl-K palette. The 26 features are now folded into
   * nine sidebar destinations, so search is how anyone who knew where a
   * thing used to live still gets to it in one step -- and a shortcut with
   * no visible control only serves the people who already know it exists. */
  onOpenSearch: () => void;
  /** Shown only on pages that actually have something to refresh. */
  onRefresh?: () => void;
  user: { firstName?: string; lastName?: string; name?: string; email?: string } | null;
  onSwitchLocation: () => void;
  onChangePassword: () => void;
  onTfaSettings: () => void;
  onLogout: () => void;
}

/**
 * The one shared top bar every `/customer/$locationId/*` page renders --
 * same lesson as `CustomerSidebar.tsx`: this exact markup used to be
 * hand-rolled independently in three places (customer.$locationId.$feature
 * .tsx, customer.$locationId.dashboard.tsx, customer.$locationId.users.tsx),
 * each drifting slightly out of sync (a dead "search" button here, a
 * missing refresh button there). Extracted so it can't drift again. Briefly
 * given a dark indigo gradient to match the sidebar it sits beside; reverted
 * back to the original plain `bg-background/80` -- the sidebar itself is
 * back to its own original light chrome too (see `CustomerSidebar.tsx`).
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
  const [menu, setMenu] = useState(false);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur-xl sm:px-6">
      {/* The sidebar primitive's own trigger. #218 had already grown the
          hand-rolled hamburger from a bare 20px <Menu/> -- the smallest tap
          target in the product, and the only route to navigation on a phone
          -- to a 40px labelled button; this replaces that button outright,
          because the trigger has to talk to the provider that now owns the
          mobile Sheet and the Cmd/Ctrl-B binding. Same 40px box, same
          optical left edge, and aria-label="Toggle Sidebar" comes from the
          primitive rather than being spelled here. */}
      <SidebarTrigger className="-ml-1 h-10 w-10 shrink-0" />
      <div className="min-w-0 flex-1">{title}</div>

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
        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={onRefresh}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      )}
      {/* Was missing entirely on this header -- the dashboard i18n rollout
          only wired DashboardLanguageSwitcher into TopNavbar.tsx (the
          Master Console layout), leaving every real customer/org-admin page
          (everything under /c/$locationId, which is what this component
          renders) with no way to switch language short of a trip to Account
          settings. Styled to match the refresh button beside it. */}
      <DashboardLanguageSwitcher className="h-9 w-9" />
      <NotificationBell scope="org" viewAllPath={customerFeatureHref("alerts")} />

      <div className="relative">
        <button onClick={() => setMenu((m) => !m)} className="ml-1">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
              {user?.firstName?.[0] ?? "A"}
              {user?.lastName?.[0] ?? "U"}
            </AvatarFallback>
          </Avatar>
        </button>
        {menu && (
          <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-xl border bg-popover p-1 shadow-xl">
            <div className="px-3 py-2">
              <p className="text-sm font-medium">{user?.name ?? "Admin"}</p>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
            </div>
            <div className="my-1 border-t" />
            <button
              onClick={() => {
                setMenu(false);
                onSwitchLocation();
              }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground hover:bg-accent"
            >
              <MapPinned className="h-4 w-4" />
              Switch location
            </button>
            <button
              onClick={() => {
                setMenu(false);
                onChangePassword();
              }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground hover:bg-accent"
            >
              <KeyRound className="h-4 w-4" />
              Change password
            </button>
            <button
              onClick={() => {
                setMenu(false);
                onTfaSettings();
              }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground hover:bg-accent"
            >
              <ShieldCheck className="h-4 w-4" />
              2FA settings
            </button>
            <div className="my-1 border-t" />
            <button
              onClick={() => {
                setMenu(false);
                onLogout();
              }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-destructive hover:bg-destructive/5"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
