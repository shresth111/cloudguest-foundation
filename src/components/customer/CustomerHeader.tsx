import { useState, type ReactNode } from "react";
import { Menu, MapPinned, KeyRound, ShieldCheck, LogOut, RefreshCw } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { PlanRenewalTicket, OtpMaskToggle } from "@/components/features/HeaderControls";

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
  masked: boolean;
  setMasked: (fn: (m: boolean) => boolean) => void;
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
  masked,
  setMasked,
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
      <button className="text-white/70 hover:text-white lg:hidden" onClick={onMobileMenuClick}><Menu className="h-5 w-5" /></button>
      <div className="min-w-0 flex-1">{title}</div>

      {/* Plan renewal + demo CTA are one perforated "ticket" object, and the
          masking indicator is a notched security tag -- neither is a
          rounded pill anymore. See HeaderControls.tsx for the reasoning. */}
      <PlanRenewalTicket expiryIso={planExpiryIso} />
      <OtpMaskToggle masked={masked} setMasked={setMasked} />
      {onRefresh && (
        <Button variant="ghost" size="icon" className="h-9 w-9 text-white/70 hover:bg-white/10 hover:text-white" onClick={onRefresh}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      )}
      <span className="[&_button]:text-white/70 [&_button:hover]:bg-white/10 [&_button:hover]:text-white">
        <NotificationBell scope="org" viewAllPath={`/customer/${locationId}/alerts`} />
      </span>

      <div className="relative">
        <button onClick={() => setMenu((m) => !m)} className="ml-1">
          <Avatar className="h-8 w-8"><AvatarFallback className="bg-white/15 text-xs font-semibold text-white">{user?.firstName?.[0] ?? "A"}{user?.lastName?.[0] ?? "U"}</AvatarFallback></Avatar>
        </button>
        {menu && (
          <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-xl border border-white/10 bg-[#241f4d] p-1 text-white shadow-xl">
            <div className="px-3 py-2"><p className="text-sm font-medium">{user?.name ?? "Admin"}</p><p className="text-xs text-white/50">{user?.email}</p></div>
            <div className="my-1 border-t border-white/10" />
            <button onClick={() => { setMenu(false); onSwitchLocation(); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-white/10"><MapPinned className="h-4 w-4" />Switch location</button>
            <button onClick={() => { setMenu(false); onChangePassword(); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-white/10"><KeyRound className="h-4 w-4" />Change password</button>
            <button onClick={() => { setMenu(false); onTfaSettings(); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-white/10"><ShieldCheck className="h-4 w-4" />2FA settings</button>
            <div className="my-1 border-t border-white/10" />
            <button onClick={() => { setMenu(false); onLogout(); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-rose-400 hover:bg-rose-500/10"><LogOut className="h-4 w-4" />Sign out</button>
          </div>
        )}
      </div>
    </header>
  );
}
