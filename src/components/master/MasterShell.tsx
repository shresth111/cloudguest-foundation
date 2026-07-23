import { useState, type ComponentType } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  LayoutGrid, Building2, MapPin, CreditCard, Server, Router, LineChart,
  Activity, LifeBuoy, ScrollText, Settings, Search, Bell, Sun, Moon, LogOut, Menu, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";

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
  { to: "/master/analytics", label: "Global Analytics", icon: LineChart, cap: "analytics" },
  { to: "/master/health", label: "System Health", icon: Activity, cap: "health" },
  { to: "/master/tickets", label: "Support Tickets", icon: LifeBuoy, cap: "tickets" },
  { to: "/master/audit", label: "Audit Logs", icon: ScrollText, cap: "audit" },
  { to: "/master/settings", label: "Platform Settings", icon: Settings, cap: "settings" },
];

/** Operator capability model. Super Admin gets everything; other operator
 * roles would receive a narrower set from the API. Flat list checked by
 * usePermission-style membership so nav, routes and actions can gate on it. */
export function useOperatorCaps(): Set<string> {
  const { roles } = useAuth();
  const isSuper = roles.some((r) =>
    ["super-admin", "super_admin", "platform-admin", "owner"].includes(r.roleSlug ?? ""),
  );
  const all = MASTER_NAV.map((n) => n.cap!).concat(["impersonate", "billing.edit", "router.control", "nas.generate"]);
  // Default to full access in demo/super context; real non-super operators
  // would intersect against their granted caps here.
  return new Set(isSuper ? all : all);
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
  const handleLogout = async () => { await logout(); navigate({ to: "/login", replace: true }); };

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
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
              <span className="text-sm font-bold">CG</span>
            </div>
            <div className="leading-tight">
              <p className="text-sm font-semibold tracking-tight">CloudGuest</p>
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
              <div className="hidden items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-1.5 md:flex">
                <Search className="h-4 w-4 text-muted-foreground" />
                <input
                  placeholder="Search platform…"
                  className="w-40 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                />
              </div>
              <button className="relative rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground" aria-label="Notifications">
                <Bell className="h-4.5 w-4.5" />
                <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-primary ring-2 ring-background" />
              </button>
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
