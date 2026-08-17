import { useState, type ComponentType } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  LayoutGrid,
  Building2,
  MapPin,
  CreditCard,
  Server,
  Router,
  LineChart,
  Activity,
  LifeBuoy,
  ScrollText,
  Settings,
  Sun,
  Moon,
  LogOut,
  Menu,
  X,
  TerminalSquare,
  CalendarClock,
  FileText,
  ChevronsLeft,
  ChevronsRight,
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
  {
    to: "/master/demo-requests",
    label: "Demo Requests",
    icon: CalendarClock,
    cap: "demo-requests",
  },
  { to: "/master/quotations", label: "Quotations", icon: FileText, cap: "quotations" },
  { to: "/master/audit", label: "Audit Logs", icon: ScrollText, cap: "audit" },
  { to: "/master/settings", label: "Platform Settings", icon: Settings, cap: "settings" },
];

/** Purely presentational grouping of `MASTER_NAV`'s items for the sidebar
 * (labelled sections, same pattern as the customer console's
 * `CUSTOMER_NAV_GROUPS`, see src/lib/customerNav.ts). Deliberately kept
 * separate from `MASTER_NAV`/`CAP_PERMISSIONS` themselves -- this is only a
 * list of `to` paths, never anything permission-bearing, so grouping the
 * nav visually can't change which items a given operator can see. Render
 * time still filters strictly against the same real, backend-issued
 * `caps` set as before (see `useOperatorCaps`) and simply skips over any
 * group left empty by that filter, exactly like `customerNavGroupsForRole`
 * does. */
const MASTER_NAV_GROUPS: { label: string; items: string[] }[] = [
  {
    label: "Growth",
    items: ["/master", "/master/customers", "/master/locations", "/master/billing"],
  },
  {
    label: "Infrastructure",
    items: ["/master/nas", "/master/routers", "/master/console", "/master/health"],
  },
  {
    label: "Operations",
    items: [
      "/master/analytics",
      "/master/tickets",
      "/master/demo-requests",
      "/master/quotations",
      "/master/audit",
      "/master/settings",
    ],
  },
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
  quotations: ["quotations.read"],
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
  const [collapsed, setCollapsed] = useState(false);
  const expanded = !collapsed;

  // Identical filter to before grouping was introduced -- every item
  // rendered anywhere in the sidebar still has to pass this same
  // `caps.has(...)` check first. Grouping (below) only decides where an
  // already-permitted item is drawn, never whether it is.
  const nav = MASTER_NAV.filter((n) => !n.cap || caps.has(n.cap));
  const navByPath = new Map(nav.map((n) => [n.to, n]));
  const groups = MASTER_NAV_GROUPS.map((g) => ({
    label: g.label,
    items: g.items.map((to) => navByPath.get(to)).filter((n): n is MasterNavItem => !!n),
  })).filter((g) => g.items.length > 0);
  const isActive = (to: string) =>
    to === "/master" ? pathname === "/master" : pathname.startsWith(to);
  const handleLogout = async () => {
    await logout();
    navigate({ to: "/master-login", replace: true });
  };

  return (
    <div className={cn("master-theme", dark && "dark")}>
      <div className="flex min-h-screen bg-background text-foreground">
        {mobile && (
          <div
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={() => setMobile(false)}
          />
        )}

        {/* Sidebar -- grouped nav + chip icons + left-indicator active
            state, same visual language as the customer console's
            CustomerSidebar (see src/components/customer/CustomerSidebar.tsx),
            built from Master's own "Clean Enterprise" tokens (border/
            bg-sidebar/bg-primary) rather than the customer surface's
            dark-indigo gradient -- the two chrome systems are deliberately
            kept visually distinct (see MasterKit.tsx's own module comment)
            even while sharing this structural pattern. Collapsible to an
            icon rail on desktop; always full-width on the mobile overlay. */}
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-50 flex flex-col border-r border-border bg-sidebar text-sidebar-foreground transition-all lg:static",
            expanded ? "w-64" : "lg:w-[72px]",
            mobile ? "w-64 translate-x-0" : "-translate-x-full lg:translate-x-0",
          )}
        >
          <div className="flex h-16 shrink-0 items-center gap-3 border-b border-border px-5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary shadow-sm">
              <img src="/brand/mark-compact-white.svg" alt="" className="h-5 w-5" />
            </div>
            {(expanded || mobile) && (
              <div className="leading-tight">
                <p className="text-sm font-semibold tracking-tight">Wyfy Guest</p>
                <p className="text-[11px] font-medium text-muted-foreground">Master Console</p>
              </div>
            )}
            <button className="ml-auto lg:hidden" onClick={() => setMobile(false)}>
              <X className="h-5 w-5" />
            </button>
          </div>
          <nav className="flex-1 space-y-4 overflow-y-auto px-2.5 py-3">
            {groups.map((g) => (
              <div key={g.label} className="space-y-1">
                {(expanded || mobile) && (
                  <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                    {g.label}
                  </p>
                )}
                {g.items.map((item) => {
                  const active = isActive(item.to);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      onClick={() => setMobile(false)}
                      title={item.label}
                      className={cn(
                        "group relative flex items-center gap-3 rounded-lg border-l-[3px] px-2.5 py-2.5 text-[13px] font-medium transition-all duration-150",
                        active
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-transparent text-muted-foreground hover:bg-accent hover:text-foreground",
                        !expanded && !mobile && "justify-center px-0",
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors duration-150",
                          active
                            ? "bg-primary/15 text-primary"
                            : "bg-muted text-muted-foreground group-hover:bg-accent-foreground/10 group-hover:text-foreground",
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                      </span>
                      {(expanded || mobile) && <span className="truncate">{item.label}</span>}
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>
          <div className="border-t border-border px-5 py-3 text-[11px] font-medium text-muted-foreground">
            {expanded || mobile ? (
              "Platform Operator"
            ) : (
              <span className="sr-only">Platform Operator</span>
            )}
          </div>
          <div className="hidden border-t border-border p-2 lg:block">
            <button
              onClick={() => setCollapsed((c) => !c)}
              className="flex w-full items-center justify-center rounded-lg px-3 py-2 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
              aria-label={expanded ? "Collapse sidebar" : "Expand sidebar"}
            >
              {expanded ? (
                <ChevronsLeft className="h-4 w-4" />
              ) : (
                <ChevronsRight className="h-4 w-4" />
              )}
            </button>
          </div>
        </aside>

        {/* Main */}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/90 px-4 backdrop-blur sm:px-6">
            <button className="lg:hidden" onClick={() => setMobile(true)}>
              <Menu className="h-5 w-5" />
            </button>
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
                <button
                  onClick={() => setMenu((m) => !m)}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground shadow-sm"
                >
                  {user?.firstName?.[0] ?? "S"}
                  {user?.lastName?.[0] ?? "A"}
                </button>
                {menu && (
                  <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-xl border border-border bg-popover p-1 shadow-lg">
                    <div className="px-3 py-2">
                      <p className="text-sm font-semibold">{user?.name ?? "Super Admin"}</p>
                      <p className="text-xs text-muted-foreground">
                        {user?.email ?? "operator@cloudguest.io"}
                      </p>
                    </div>
                    <div className="my-1 border-t border-border" />
                    <button
                      onClick={handleLogout}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-primary hover:bg-accent"
                    >
                      <LogOut className="h-4 w-4" /> Sign out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </header>

          {/* Max-width + vertical rhythm used to live in a hard-coded div
              right here -- every child pays for it no matter what. Moved
              into MPageShell (src/components/master/MasterKit.tsx),
              a thin master-scoped wrapper around the customer console's
              own PageShell primitive, so each of the 14 master routes
              renders it explicitly (same as every _authenticated/* and
              customer/* page already does) instead of it being baked
              silently into the shell. See `MPageShell` there. */}
          <main className="flex-1 overflow-x-hidden p-4 sm:p-6 lg:p-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
