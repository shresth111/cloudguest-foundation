import { useState, type ReactNode } from "react";
import { Menu, MapPinned, KeyRound, ShieldCheck, LogOut, RefreshCw } from "lucide-react";
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
  onMobileMenuClick: () => void;
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
 * missing refresh button there). Extracted so it can't drift again, and
 * given the same dark indigo treatment as the sidebar it sits beside --
 * previously plain `bg-background/80`, the one piece of chrome still light
 * after every other page went dark.
 */
export function CustomerHeader({
  title,
  locationId,
  planExpiryIso,
  onMobileMenuClick,
  onRefresh,
  user,
  onSwitchLocation,
  onChangePassword,
  onTfaSettings,
  onLogout,
}: CustomerHeaderProps) {
  const [menu, setMenu] = useState(false);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-white/10 bg-gradient-to-r from-[#1e1b4b] to-[#241f4d] px-4 text-white backdrop-blur-xl sm:px-6">
      {/* -ml-2 keeps the icon on the same optical left edge it always sat on
          while the button itself grows to 40px. It was a bare 20px icon with
          no padding -- the smallest tap target in the product, and the only
          way to reach navigation at all on a phone, on every page. */}
      <button
        type="button"
        aria-label="Open navigation menu"
        className="-ml-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white/70 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 lg:hidden"
        onClick={onMobileMenuClick}
      >
        <Menu className="h-5 w-5" />
      </button>
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
      <span className="[&_button]:text-white/70 [&_button:hover]:bg-white/10 [&_button:hover]:text-white">
        <NotificationBell scope="org" viewAllPath={customerFeatureHref("alerts")} />
      </span>

      <div className="relative">
        <button onClick={() => setMenu((m) => !m)} className="ml-1">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-white/15 text-xs font-semibold text-white">
              {user?.firstName?.[0] ?? "A"}
              {user?.lastName?.[0] ?? "U"}
            </AvatarFallback>
          </Avatar>
        </button>
        {menu && (
          <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-xl border border-white/10 bg-[#241f4d] p-1 text-white shadow-xl">
            <div className="px-3 py-2">
              <p className="text-sm font-medium">{user?.name ?? "Admin"}</p>
              <p className="text-xs text-white/50">{user?.email}</p>
            </div>
            <div className="my-1 border-t border-white/10" />
            <button
              onClick={() => {
                setMenu(false);
                onSwitchLocation();
              }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-white/10"
            >
              <MapPinned className="h-4 w-4" />
              Switch location
            </button>
            <button
              onClick={() => {
                setMenu(false);
                onChangePassword();
              }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-white/10"
            >
              <KeyRound className="h-4 w-4" />
              Change password
            </button>
            <button
              onClick={() => {
                setMenu(false);
                onTfaSettings();
              }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-white/10"
            >
              <ShieldCheck className="h-4 w-4" />
              2FA settings
            </button>
            <div className="my-1 border-t border-white/10" />
            <button
              onClick={() => {
                setMenu(false);
                onLogout();
              }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-rose-400 hover:bg-rose-500/10"
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
