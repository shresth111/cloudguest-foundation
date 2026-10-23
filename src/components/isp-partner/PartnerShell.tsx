/**
 * The partner console's chrome: sidebar + top bar, the same visual language
 * as the Master console (`MasterShell`), with the nav built from the grants
 * `GET /isp/me` returned. A hidden item is a convenience, not the boundary:
 * the backend pins every `/isp/*` key.
 */
import { useState, type ComponentType, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Building2,
  Cpu,
  FileBarChart,
  LayoutGrid,
  LogOut,
  Menu,
  Receipt,
  Router,
  ScrollText,
  Send,
  Settings,
  Ticket,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { endPartnerSession } from "@/lib/isp-partner/sign-out";
import { useTheme } from "@/context/ThemeContext";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { usePartner } from "@/components/isp-partner/PartnerContext";
import { roleLabel } from "@/lib/isp-partner/format";
import { MEmptyState } from "@/components/master/MasterKit";

interface NavItem {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  /** Any one of these grants shows the item. */
  anyOf?: string[];
}

const PARTNER_NAV: NavItem[] = [
  { to: "/partner", label: "Overview", icon: LayoutGrid, anyOf: ["isp_partner.read"] },
  { to: "/partner/customers", label: "Customers", icon: Building2, anyOf: ["isp_partner.read"] },
  { to: "/partner/routers", label: "Routers", icon: Router, anyOf: ["isp_partner.read"] },
  { to: "/partner/tr069", label: "TR-069 devices", icon: Cpu, anyOf: ["tr069.read"] },
  {
    to: "/partner/logs",
    label: "Logs",
    icon: ScrollText,
    anyOf: ["isp_logs.read", "isp_ipdr.read"],
  },
  {
    to: "/partner/plans",
    label: "Plans & coupons",
    icon: Ticket,
    anyOf: ["isp_plans.read", "isp_coupons.read", "isp_subscribers.read"],
  },
  { to: "/partner/invoices", label: "Invoices", icon: Receipt, anyOf: ["isp_invoices.read"] },
  { to: "/partner/billing", label: "Billing", icon: Wallet, anyOf: ["isp_billing.read"] },
  { to: "/partner/messaging", label: "Messaging", icon: Send, anyOf: ["isp_engage.read"] },
  { to: "/partner/reports", label: "Reports", icon: FileBarChart, anyOf: ["isp_partner.read"] },
  { to: "/partner/users", label: "Staff users", icon: Users, anyOf: ["isp_partner.assign"] },
  { to: "/partner/settings", label: "Settings", icon: Settings },
];

export function PartnerShell({ children }: { children: ReactNode }) {
  const { me, can } = usePartner();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const theme = useTheme();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [mobile, setMobile] = useState(false);
  const [menu, setMenu] = useState(false);

  const nav = PARTNER_NAV.filter((n) => !n.anyOf || n.anyOf.some((p) => can(p)));
  // QA-017: a page whose nav item this role cannot see is not mounted on a
  // direct URL either, so it never fires a request that can only 403 (and
  // land in Staff Activity as permission_denied).
  const denied = PARTNER_NAV.find(
    (n) =>
      n.to !== "/partner" &&
      n.anyOf &&
      (pathname === n.to || pathname.startsWith(`${n.to}/`)) &&
      !n.anyOf.some((p) => can(p)),
  );
  const isActive = (to: string) =>
    to === "/partner"
      ? pathname === "/partner" || pathname === "/partner/"
      : pathname.startsWith(to);

  const queryClient = useQueryClient();
  // QA-020: cancel + drain partner calls before the token goes, so a poll
  // that lands afterwards cannot 401 the user onto "session expired".
  const signOut = async () => {
    await endPartnerSession({ queryClient, logout });
    navigate({ to: "/partner/login", replace: true });
  };

  return (
    <div className={cn("master-theme", theme?.theme === "dark" && "dark")}>
      <div className="flex min-h-screen bg-background text-foreground">
        {mobile && (
          <div
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={() => setMobile(false)}
          />
        )}
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-white/10 bg-gradient-to-b from-[#1e1b4b] to-[#181530] text-white transition-transform lg:static lg:translate-x-0",
            mobile ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <div className="flex h-16 shrink-0 items-center gap-3 border-b border-white/10 px-5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#6C4EFF] to-[#8B5CF6]">
              <img src="/brand/mark-compact-white.svg" alt="" className="h-5 w-5" />
            </div>
            <div className="min-w-0 leading-tight">
              <p className="truncate text-sm font-semibold tracking-tight">{me.isp.name}</p>
              <p className="text-[11px] font-medium text-white/45">Wyfy Guest Network</p>
            </div>
            <button
              className="ml-auto lg:hidden"
              onClick={() => setMobile(false)}
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <nav className="flex-1 space-y-1 overflow-y-auto px-2.5 py-3">
            {nav.map((item) => {
              const active = isActive(item.to);
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobile(false)}
                  className={cn(
                    "group flex items-center gap-3 rounded-lg border-l-[3px] px-2.5 py-2.5 text-[13px] font-medium transition-all",
                    active
                      ? "border-[#6C4EFF] bg-gradient-to-r from-[#6C4EFF]/25 via-[#6C4EFF]/10 to-transparent text-white"
                      : "border-transparent text-white/60 hover:bg-white/[0.06] hover:text-white",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
                      active ? "bg-white/15 text-white" : "bg-white/5 text-white/60",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </nav>
          <div className="border-t border-white/10 px-5 py-3 text-[11px] font-medium text-white/50">
            {roleLabel(me.user.role)}
            {me.confined_customer_ids && ` · ${me.confined_customer_ids.length} customer(s)`}
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/90 px-4 backdrop-blur sm:px-6">
            <button className="lg:hidden" onClick={() => setMobile(true)} aria-label="Open menu">
              <Menu className="h-5 w-5" />
            </button>
            <p className="truncate text-sm font-semibold tracking-tight">{me.isp.name}</p>
            <div className="ml-auto flex items-center gap-1.5">
              <ThemeToggle />
              <div className="relative">
                <button
                  onClick={() => setMenu((m) => !m)}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground shadow-sm"
                  aria-label="Account menu"
                >
                  {(me.user.name || me.user.email || "?").slice(0, 2).toUpperCase()}
                </button>
                {menu && (
                  <div className="absolute right-0 top-full z-50 mt-2 w-60 rounded-xl border border-border bg-popover p-1 shadow-lg">
                    <div className="px-3 py-2">
                      <p className="truncate text-sm font-semibold">{me.user.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{me.user.email}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {roleLabel(me.user.role)}
                      </p>
                    </div>
                    <div className="my-1 border-t border-border" />
                    <button
                      onClick={signOut}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-primary hover:bg-accent"
                    >
                      <LogOut className="h-4 w-4" /> Sign out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </header>
          <main className="flex-1 overflow-x-hidden p-4 sm:p-6 lg:p-8">
            <div className="mx-auto w-full max-w-[1400px] space-y-6">
              {denied ? (
                <MEmptyState
                  icon={denied.icon}
                  title={`Your role does not include ${denied.label.toLowerCase()}`}
                  description="Ask your ISP Owner or Admin if you need it."
                />
              ) : (
                children
              )}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
