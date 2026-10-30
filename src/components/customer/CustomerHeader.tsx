import type { ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  Bot,
  ChevronRight,
  KeyRound,
  LogOut,
  MapPinned,
  Moon,
  RefreshCw,
  ShieldCheck,
  Sun,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import i18n from "@/lib/i18n";
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
import { useTheme } from "@/context/ThemeContext";
import {
  CUSTOMER_NAV_GROUPS,
  customerFeatureHref,
  customerNavGroupsForRole,
  getCustomerLoginRole,
} from "@/lib/customerNav";
import { filterNavGroupsByPermissions } from "@/lib/customerNavPermissions";
import { useMyPermissions } from "@/hooks/useCustomerDashboard";
import { LocationSwitcher } from "@/components/customer/LocationSwitcher";
import { ConsoleHealthPill } from "@/components/customer/ConsoleHealth";

interface CustomerHeaderProps {
  /** Optional content after the breadcrumb -- a page may add a status chip.
   * The page name itself comes from the breadcrumb (derived from the route
   * via `customerNav.ts`), and the venue name from `LocationSwitcher`, so a
   * title must repeat neither. */
  title?: ReactNode;
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

const ICON_BUTTON =
  "h-8 w-8 rounded-[var(--wy-radius)] text-[var(--wy-text-muted)] hover:bg-[var(--wy-surface-2)] hover:text-[var(--wy-text)] focus-visible:ring-2 focus-visible:ring-[var(--wy-accent)]";

const MENU_ITEM =
  "cursor-pointer gap-2 rounded-md px-2.5 py-1.5 text-[13px] text-[var(--wy-text)] focus:bg-[var(--wy-surface-2)] focus:text-[var(--wy-text)]";

/**
 * Group and page for the current route, from `CUSTOMER_NAV_GROUPS` -- the
 * same list the sidebar and palette render, so the crumb can never name a
 * screen differently from the row that led to it. `null` off the nav (an
 * unknown path renders no breadcrumb rather than a guessed one).
 */
function useCurrentNavCrumb(): {
  groupId: string;
  groupLabel: string;
  itemId: string;
  itemLabel: string;
} | null {
  // Whole state rather than a `select`: the render harnesses in scripts/
  // stub `useRouterState` as a plain object return, and the header
  // re-renders on navigation anyway.
  const pathname = useRouterState().location.pathname;
  const path = pathname.replace(/\/+$/, "") || "/";
  for (const group of CUSTOMER_NAV_GROUPS) {
    for (const item of group.items) {
      if (customerFeatureHref(item.id) === path) {
        return {
          groupId: group.id,
          groupLabel: group.label,
          itemId: item.id,
          itemLabel: item.label,
        };
      }
    }
  }
  return null;
}

/**
 * The one shared top bar every customer page renders (extracted so the
 * three shells that used to hand-roll it cannot drift).
 *
 * Console layout, left to right: rail toggle, venue switcher (with that
 * venue's live dot), breadcrumb; then the venue health pill, search (Cmd/
 * Ctrl-K), plan ticket, refresh, language, theme, notifications, account.
 *
 * The bar follows the theme (`--wy-surface`), where it used to be a
 * permanent indigo gradient: a status-first console keeps its chrome quiet
 * so the only colour on screen is the colour that means something. The
 * liveness badge some pages pass in `title` is re-coloured from the console
 * status tokens by `.wy-topbar [data-liveness-tone]` in styles.css.
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
  const { t } = useTranslation("nav", { i18n });
  const theme = useTheme();
  const crumb = useCurrentNavCrumb();
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

  const initials = `${user?.firstName?.[0] ?? "A"}${user?.lastName?.[0] ?? "U"}`;

  return (
    <header className="wy-topbar sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-[var(--wy-border)] bg-[color-mix(in_oklab,var(--wy-surface)_92%,transparent)] px-3 text-[var(--wy-text)] backdrop-blur-md sm:gap-3 sm:px-4">
      {/* The sidebar primitive's own trigger: it talks to the provider that
          owns the mobile Sheet and the Cmd/Ctrl-B binding, and carries
          aria-label="Toggle Sidebar". */}
      <SidebarTrigger className={`-ml-0.5 shrink-0 ${ICON_BUTTON}`} />
      <span aria-hidden className="hidden h-5 w-px bg-[var(--wy-border)] sm:block" />
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <LocationSwitcher />
        {crumb && (
          <nav
            aria-label={t("consoleShell.breadcrumb", "Breadcrumb")}
            className="hidden min-w-0 md:block"
          >
            <ol className="flex min-w-0 items-center gap-1 text-[13px]">
              <li aria-hidden>
                <ChevronRight className="h-3.5 w-3.5 text-[var(--wy-text-faint)]" />
              </li>
              <li className="shrink-0 text-[var(--wy-text-faint)]">
                {t(`customerGroup.${crumb.groupId}`, crumb.groupLabel)}
              </li>
              <li aria-hidden>
                <ChevronRight className="h-3.5 w-3.5 text-[var(--wy-text-faint)]" />
              </li>
              <li aria-current="page" className="truncate font-medium text-[var(--wy-text)]">
                {t(`customerItem.${crumb.itemId}`, crumb.itemLabel)}
              </li>
            </ol>
          </nav>
        )}
        {/* From `md:` with the breadcrumb: on a phone the switcher's dot
            already carries the venue's state, and the name needs the room. */}
        {title != null && <div className="hidden min-w-0 md:block">{title}</div>}
      </div>

      {/* From `sm:` up: on a phone the switcher's dot carries the same
          verdict, and the name gets the room. */}
      <div className="hidden sm:contents">
        <ConsoleHealthPill locationId={locationId} />
      </div>
      <CommandPaletteTrigger onClick={onOpenSearch} />
      {/* Plan renewal ticket: from `xl:` up only -- below that it squeezed
          the venue name and breadcrumb to a clipped letter. */}
      <PlanRenewalTicket
        expiryIso={planExpiryIso}
        className="hidden h-8 shrink-0 items-stretch xl:flex"
      />
      <div className="flex shrink-0 items-center gap-0.5">
        {onRefresh && (
          <Button
            variant="ghost"
            size="icon"
            className={`hidden sm:inline-flex ${ICON_BUTTON}`}
            onClick={onRefresh}
            aria-label={t("consoleShell.refresh", "Refresh")}
            title={t("consoleShell.refresh", "Refresh")}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        )}
        {/* The language switcher stays visible at every width: on a phone it
            is the only way out of a language you cannot read. */}
        <DashboardLanguageSwitcher className={ICON_BUTTON} />
        {/* Theme is also in the account menu, so the bar can drop it on a
            phone without losing the control. */}
        <span className="hidden sm:contents">
          <ThemeToggle className={ICON_BUTTON} />
        </span>
        <span className="[&_button]:h-8 [&_button]:w-8 [&_button]:rounded-[var(--wy-radius)] [&_button]:text-[var(--wy-text-muted)] [&_button:hover]:bg-[var(--wy-surface-2)] [&_button:hover]:text-[var(--wy-text)]">
          <NotificationBell scope="org" viewAllPath={customerFeatureHref("alerts")} />
        </span>
      </div>

      {/* Radix: closes on outside click / Escape, arrow-key navigation, and
          focus returns to the avatar. `focus:` mirrors every `hover:` because
          Radix moves real focus between items. */}
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Account menu"
          className="shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wy-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--wy-surface)]"
        >
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-[var(--wy-accent-soft)] text-[11px] font-semibold text-[var(--wy-accent)]">
              {initials}
            </AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          sideOffset={8}
          className="wy-console w-60 rounded-[var(--wy-radius-lg)] border-[var(--wy-border)] bg-[var(--wy-surface)] p-1 text-[var(--wy-text)] shadow-lg"
        >
          <DropdownMenuLabel className="flex items-center gap-2.5 px-2.5 py-2 font-normal">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-[var(--wy-accent-soft)] text-[11px] font-semibold text-[var(--wy-accent)]">
                {initials}
              </AvatarFallback>
            </Avatar>
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-semibold">
                {user?.name ?? "Admin"}
              </span>
              <span className="block truncate text-xs text-[var(--wy-text-muted)]">
                {user?.email}
              </span>
            </span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator className="bg-[var(--wy-border)]" />
          <DropdownMenuItem onSelect={onSwitchLocation} className={MENU_ITEM}>
            <MapPinned className="h-4 w-4 text-[var(--wy-text-muted)]" />
            {t("consoleShell.account.switchLocation", "Switch location")}
          </DropdownMenuItem>
          {showStaffAccess && (
            <DropdownMenuItem asChild className={MENU_ITEM}>
              <Link to={customerFeatureHref("agents")}>
                <Bot className="h-4 w-4 text-[var(--wy-text-muted)]" />
                {t("consoleShell.account.staffAccess", "Staff access")}
              </Link>
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onSelect={onChangePassword} className={MENU_ITEM}>
            <KeyRound className="h-4 w-4 text-[var(--wy-text-muted)]" />
            {t("consoleShell.account.changePassword", "Change password")}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onTfaSettings} className={MENU_ITEM}>
            <ShieldCheck className="h-4 w-4 text-[var(--wy-text-muted)]" />
            {t("consoleShell.account.tfa", "2FA settings")}
          </DropdownMenuItem>
          {theme && (
            <DropdownMenuItem onSelect={() => theme.toggle()} className={MENU_ITEM}>
              {theme.theme === "dark" ? (
                <Sun className="h-4 w-4 text-[var(--wy-text-muted)]" />
              ) : (
                <Moon className="h-4 w-4 text-[var(--wy-text-muted)]" />
              )}
              {theme.theme === "dark"
                ? t("consoleShell.account.lightMode", "Light mode")
                : t("consoleShell.account.darkMode", "Dark mode")}
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator className="bg-[var(--wy-border)]" />
          <DropdownMenuItem
            onSelect={onLogout}
            className="cursor-pointer gap-2 rounded-md px-2.5 py-1.5 text-[13px] text-[var(--wy-crit)] focus:bg-[var(--wy-crit-soft)] focus:text-[var(--wy-crit)]"
          >
            <LogOut className="h-4 w-4" />
            {t("consoleShell.account.signOut", "Sign out")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
