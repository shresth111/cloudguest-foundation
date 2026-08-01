import { useState, type ComponentType } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  LayoutGrid, Building2, MapPin, CreditCard, Server, Router, LineChart,
  Activity, LifeBuoy, ScrollText, Settings, Sun, Moon, LogOut, Menu, X,
  TerminalSquare, CalendarClock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { MasterSearch } from "@/components/master/MasterSearch";

export interface MasterNavItem {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  /** Capability key required to see this item; undefined = always. */
  cap?: string;
}

export const MASTER_NAV: MasterNavItem[] = [
  { to: "/master", label: "Platform Overview", icon: LayoutGrid, cap: "overview" },
  { to: "/master/customers", label: "Customers", icon: Building2, cap: "customers" },
  { to: "/master/locations", label: "All Locations", icon: MapPin, cap: "locations" },
  { to: "/master/billing", label: "Subscriptions & Billing", icon: CreditCard, cap: "billing" },
  { to: "/master/nas", label: "NAS / RADIUS", icon: Server, cap: "nas" },
  { to: "/master/routers", label: "Router Fleet", icon: Router, cap: "routers" },
  { to: "/master/console", label: "Device Console", icon: TerminalSquare, cap: "console" },
  { to: "/master/analytics", label: "Global Analytics", icon: LineChart, cap: "analytics" },
  { to: "/master/health", label: "System Health", icon: Activity, cap: "health" },
  { to: "/master/tickets", label: "Support Tickets", icon: LifeBuoy, cap: "tickets" },
  { to: "/master/demo-requests", label: "Demo Requests", icon: CalendarClock, cap: "demo-requests" },
  { to: "/master/audit", label: "Audit Logs", icon: ScrollText, cap: "audit" },
  { to: "/master/settings", label: "Platform Settings", icon: Settings, cap: "settings" },
];

/** Maps each Master console capability key to the real backend
 * `permission_key`(s) (`{module}.{action}`, per
 * `app/domains/rbac/enums.py`'s `PermissionModule`/`PermissionAction`) that
 * unlock it -- confirmed against the actual `RequirePermission(...)`
 * dependency each nav destination's own backend router enforces (e.g.
 * `app/domains/audit/router.py` requires `audit_logs.read`,
 * `app/domains/billing/router.py` requires `billing.read`/`billing.update`,
 * `app/domains/provisioning_engine/router.py`'s device-console-command
 * endpoint requires `device_console.execute`). A capability is granted iff
 * at least one of its listed keys is present in the operator's own
 * effective grants.
 *
 * `impersonate` has no corresponding permission anywhere in the RBAC model
 * (no `PermissionModule`/action pair, no `RequirePermission("*impersonate*")`
 * call site) because no impersonation feature exists in the console yet --
 * this key itself has zero call sites today (nothing calls
 * `caps.has("impersonate")`). Gated on `users.manage`, the closest existing
 * permission, as a conservative placeholder; wiring an actual "log in as
 * this customer" feature needs its own dedicated `users.impersonate`
 * permission_key added to the backend first, a product/RBAC decision, not
 * something to invent here.
 */
const CAP_PERMISSIONS: Record<string, string[]> = {
  overview: ["dashboard.view"],
  customers: ["organizations.read"],
  locations: ["locations.read"],
  billing: ["billing.read"],
  nas: ["radius.read"],
  routers: ["routers.read"],
  console: ["device_console.read", "device_console.execute"],
  analytics: ["analytics.read", "analytics.view"],
  health: ["monitoring.read", "monitoring.view"],
  tickets: ["support_tickets.read"],
  "demo-requests": ["demo_requests.read"],
  audit: ["audit_logs.read"],
  settings: ["system_settings.read"],
  "billing.edit": ["billing.update", "billing.manage"],
  "router.control": ["routers.execute", "routers.manage"],
  "nas.generate": ["radius.execute", "radius.manage"],
  impersonate: ["users.manage"],
};

/** Operator capability model. Previously returned the *same* full capability
 * set regardless of role ("return new Set(isSuper ? all : all)" -- both
 * branches were identical, so every authenticated Master-console operator,
 * not just Super Admin, saw and could act on every nav item and every
 * gated action). Real operator roles are genuinely narrower -- e.g.
 * "Platform Support" is READ-only outside a handful of overrides and holds
 * no `system_settings.*`/`billing.*` grants at all, "Billing Manager" holds
 * no `organizations.*`/`locations.*`/`routers.*` grants (see
 * `app/domains/rbac/seed.py`'s `SYSTEM_ROLES`) -- so this now checks each
 * capability against the operator's real, backend-issued effective
 * permissions (`useAuth().can()`, populated from `GET /me/permissions`,
 * itself resolved from the operator's actual role grants in Postgres --
 * never client-side-only state or a hardcoded default). */
export function useOperatorCaps(): Set<string> {
  const { can } = useAuth();
  const granted = new Set<string>();
  for (const [cap, permissionKeys] of Object.entries(CAP_PERMISSIONS)) {
    if (permissionKeys.some((key) => can(key))) granted.add(cap);
  }
  return granted;
}

export function MasterShell({ title, children }: { title: string; children: React.ReactNode }) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const caps = useOperatorCaps();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [dark, setDark] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [menu, setMenu] = useState(false);

  const nav = MASTER_NAV.filter((n) => !n.cap || caps.has(n.cap));
  const isActive = (to: string) => (to === "/master" ? pathname === "/master" : pathname.startsWith(to));
  const handleLogout = async () => { await logout(); navigate({ to: "/master-login", replace: true }); };

  return (
    <div className={cn("master-theme", dark && "dark")}>
      <div className="flex min-h-screen bg-background text-foreground">
        {mobile && <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setMobile(false)} />}

        {/* Sidebar */}
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-border bg-sidebar text-sidebar-foreground transition-transform lg:static lg:translate-x-0",
            mobile ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <div className="flex h-16 items-center gap-3 border-b border-border px-5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary shadow-sm">
              <img src="/brand/mark-compact-white.svg" alt="" className="h-5 w-5" />
            </div>
            <div className="leading-tight">
              <p className="text-sm font-semibold tracking-tight">ZIP WiFi</p>
              <p className="text-[11px] font-medium text-muted-foreground">Master Console</p>
            </div>
            <button className="ml-auto lg:hidden" onClick={() => setMobile(false)}><X className="h-5 w-5" /></button>
          </div>
          <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-3">
            {nav.map((item) => {
              const active = isActive(item.to);
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobile(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors",
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </nav>
          <div className="border-t border-border px-5 py-3 text-[11px] font-medium text-muted-foreground">
            Platform Operator
          </div>
        </aside>

        {/* Main */}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/90 px-4 backdrop-blur sm:px-6">
            <button className="lg:hidden" onClick={() => setMobile(true)}><Menu className="h-5 w-5" /></button>
            <h1 className="text-base font-semibold tracking-tight">{title}</h1>
            <div className="ml-auto flex items-center gap-1.5">
              <MasterSearch />
              {/* Platform-wide: every organization's alerts, not just one --
                  a genuinely different data scope from the customer bell
                  below (see NotificationBellProps.scope). No dedicated
                  platform alerts page exists yet, so there's no "view all"
                  link -- the dropdown itself is the real destination. */}
              <NotificationBell scope="platform" />
              <button
                onClick={() => setDark((d) => !d)}
                className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
                aria-label="Toggle theme"
              >
                {dark ? <Sun className="h-4.5 w-4.5" /> : <Moon className="h-4.5 w-4.5" />}
              </button>
              <div className="relative">
                <button onClick={() => setMenu((m) => !m)} className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground shadow-sm">
                  {(user?.firstName?.[0] ?? "S")}{(user?.lastName?.[0] ?? "A")}
                </button>
                {menu && (
                  <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-xl border border-border bg-popover p-1 shadow-lg">
                    <div className="px-3 py-2">
                      <p className="text-sm font-semibold">{user?.name ?? "Super Admin"}</p>
                      <p className="text-xs text-muted-foreground">{user?.email ?? "operator@cloudguest.io"}</p>
                    </div>
                    <div className="my-1 border-t border-border" />
                    <button onClick={handleLogout} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-primary hover:bg-accent">
                      <LogOut className="h-4 w-4" /> Sign out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </header>

          <main className="flex-1 overflow-x-hidden p-4 sm:p-6 lg:p-8">
            <div className="mx-auto max-w-[1400px] space-y-6">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
