import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  Wifi,
  Router,
  Activity,
  Users,
  TrendingUp,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Ticket,
  QrCode,
} from "lucide-react";
import { CustomerSidebar } from "@/components/customer/CustomerSidebar";
import {
  CustomerCommandPalette,
  useCustomerCommandPalette,
} from "@/components/customer/CustomerCommandPalette";
import { SidebarProvider } from "@/components/ui/sidebar";
import { CustomerHeader } from "@/components/customer/CustomerHeader";
import { ChangePasswordDialog } from "@/components/features/ChangePasswordDialog";
import { TwoFactorDialog } from "@/components/features/TwoFactorDialog";
import AssistantWidget from "@/components/features/AssistantWidget";
import { maskEmail, DEMO_PLAN_RENEWAL_ISO } from "@/components/features/HeaderControls";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { useCustomerStore } from "@/stores/customerStore";
import { useCustomerDashboard, useIsDemo, useDataMasking } from "@/hooks/useCustomerDashboard";
import {
  LocationLivenessBadge,
  LocationLivenessExplainer,
} from "@/components/customer/LocationLiveness";
import {
  livenessTone,
  locationLivenessIsReassuring,
  CHECKING_LIVENESS,
  UNKNOWN_LIVENESS,
} from "@/lib/location-liveness";
import type { LocationLiveness, LivenessTone } from "@/lib/location-liveness";
import { useMyBillingDashboard } from "@/hooks/useBilling";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from "recharts";
import { customerFeatureHref } from "@/lib/customerNav";
import { formatUptimePercent } from "@/lib/uptime-format";
import { BlurFade } from "@/components/magicui/blur-fade";
import {
  ChartEmptyState,
  WanStatusCard,
  BandwidthUtilizationCard,
  DeviceStatusCard,
} from "@/components/customer/dashboard";

// Moved out of src/routes/c.index.tsx (see that file's own note) -- this
// component (and its recharts/framer-motion/etc. dependencies) is real,
// substantial UI, but it was never actually reachable through the "/c/"
// route's own createFileRoute() registration (that route is just a
// beforeLoad redirect to "/", see c.index.tsx). It was only ever imported
// cross-file by index.tsx ("/") to render the real dashboard in place.
//
// Keeping it inside c.index.tsx anyway was a real, live production bug:
// routeTree.gen.ts statically imports every route file (c.index.tsx
// included, purely to register the "/c/" redirect) into the app's
// root/entry chunk -- the one every route loads, guest captive portal
// included. Since JS modules execute as a whole unit, that static import
// pulled this entire file's top-level code along with it, recharts import
// and ~1000 lines of dashboard JSX included, regardless of the fact that
// none of it is used by "/c/"'s own beforeLoad. TanStack Router's
// automatic code-splitting only extracts a route's own `component`/
// `loader`/etc. properties -- it has no visibility into an unrelated named
// export living in the same file, so this never had a chance to be split
// away as long as it lived in a route-registered file.
//
// A guest hitting /portal/welcome (no chart anywhere on that page) was
// downloading the full ~418KB recharts vendor chunk as a direct result --
// confirmed via a real browser network trace, not just static bundle
// analysis (see docs/captive-portal-v5-design-spec.md's own note on why
// static analysis alone missed this). Living here, in a plain component
// file no route file imports, this module is only ever reachable through
// index.tsx's own already-correctly-split `component` (IndexRedirect),
// same as any other regular component.

// Categorical, brand-checked -- indigo/cyan/magenta/orange/violet. The old
// palette here included green, which conflicts with this project's
// "never green as a decorative/brand accent" rule (semantic status green
// elsewhere is a different, intentional thing).
const DEVICE_COLORS = ["#4338ca", "#0891b2", "#c026d3", "#c2410c", "#6d28d9"];

/** Narrow-viewport fallback for the header's liveness badge. `neutral`
 * ("no router yet" / "can't tell") gets a slate dot, not the red one the
 * old ternary's else-branch handed it. */
/** Icon tint for the "Core systems" strip. Emerald is earned, not default. */
const CORE_ICON: Record<LivenessTone, string> = {
  live: "text-emerald-500",
  warn: "text-amber-500",
  down: "text-destructive",
  neutral: "text-muted-foreground",
};

const HEADER_DOT: Record<LivenessTone, string> = {
  live: "bg-emerald-400",
  warn: "bg-amber-400",
  down: "bg-rose-400",
  neutral: "bg-white/40",
};

/** The real customer dashboard, rendered both at the bare "/" root
 * (index.tsx, the normal path for an authenticated customer) and as the
 * redirect target every "/c" (c.index.tsx) alias resolves to. Lives in its
 * own file, not a route file -- see this file's header comment for why
 * that split matters (routeTree.gen.ts eagerly imports every route file,
 * so a route file was the one place this could NOT safely live). */
export function CustomerDashboardPage() {
  const navigate = useNavigate();
  const { user, roles, logout } = useAuth();
  const { activeLocation, activeLocationId } = useCustomerStore();
  // index.tsx (this component's only real caller now) already guarantees
  // activeLocationId is set before rendering this -- non-null assertion
  // documents that invariant rather than threading an unnecessary
  // undefined check through every hook call below that expects a plain
  // string.
  const locationId = activeLocationId!;
  const { data: d, isLoading, refetch } = useCustomerDashboard(locationId);
  // There was a `useCustomerUsers(locationId, { page: 1, pageSize: 6 })`
  // here whose result was never read by anything -- the "Recent Users"
  // table below renders `d.recentUsers`, which `getDashboard()` builds from
  // its own `/guest-sessions?page_size=100` leg. It survived because
  // `@typescript-eslint/no-unused-vars` is off in this repo's eslint
  // config, so nothing ever flagged the binding.
  //
  // It was not free: `customerService.getUsers()` issues THREE requests --
  // `/guest-sessions?page=1&page_size=6`, `/connected-devices?page_size=100`
  // and `/guests?page_size=100`. That last one is byte-identical to the
  // `/guests` read `getDashboard()` already makes for the same table's
  // identities, which is how a live capture of app.wyfyguest.com caught
  // `/guests` twice per load. It was not even a useful cache warm: no other
  // caller asks for pageSize 6 (the Users page uses 8, the feature-page
  // Users view 20), so the entry it filled was never read either.
  // Read through the SSR-safe useIsDemo() hook, not isDemo() directly --
  // isDemo() reads localStorage synchronously, so calling it straight in
  // render can flip value between the server pass (no window -> false)
  // and the client's first hydration pass (real token -> true), which
  // changes whether PlanRenewalTicket's chip renders at all (a real
  // "Hydration failed" #418 -- see the sibling fix in
  // customer.$locationId.$feature.tsx for the concrete repro).
  const demoFlag = useIsDemo();
  const billing = useMyBillingDashboard(
    demoFlag ? undefined : activeLocation?.organizationId,
    activeLocation?.organizationName,
  );
  // Raw ISO, not pre-formatted -- CustomerHeader's PlanRenewalTicket needs
  // the real date to compute a live countdown/urgency tier, not just a label.
  const planExpiryIso = demoFlag ? DEMO_PLAN_RENEWAL_ISO : billing.data?.renewalDate;
  // A `useCustomerLocations()` fetch and a store-resync effect/guard used
  // to sit here. Their original argument, kept verbatim so it can be
  // answered rather than deleted:
  //
  //   "The store's activeLocationId is only populated by clicking a
  //    location card on /customer (see customer.index.tsx's handleSelect)
  //    -- a direct deep link/bookmark/refresh of this URL arrives with it
  //    unset or pointing at a different location. Previously that
  //    hard-blocked the whole page behind a bare 'Back' button even though
  //    every fetch here (useCustomerDashboard/useCustomerUsers) is already
  //    keyed off the URL's own locationId, not the store. Resync the store
  //    from the same locations list /customer itself uses instead of
  //    blocking."
  //
  // That was right when this component took its locationId from the URL.
  // It no longer does. Since the move to the bare "/" route this file's
  // header comment describes, the route carries no params and `locationId`
  // is assigned from `activeLocationId` five lines above -- so
  // `activeLocationId !== locationId` is not merely usually false, it is
  // false by construction, on every render, forever. The effect returned on
  // its first line and the guard's whole branch (spinner / "Location not
  // found" / `return null`) was unreachable.
  //
  // The fetch behind it was not free. `customerService.listLocations()`
  // fans out `/organizations/{id}/locations` and then, per location,
  // `/locations/{id}/routers?page_size=100` and
  // `/guest-sessions?location_id=…&page_size=50`. That routers read is
  // byte-identical -- same params, same X-Organization-Id + X-Location-Id
  // -- to the one `getDashboard()` makes for this same location's liveness,
  // which is the second `/locations/{id}/routers` a live capture of
  // app.wyfyguest.com found on every dashboard load.
  //
  // Nothing rendered changes: no JSX read `locationsList`. The one thing
  // lost is a cache warm of `customerKeys.locations`, which only the legacy
  // `/customer/$locationId/*` compat redirects consume (via
  // `resolveCustomerLocationById`) and which /switch-location fetches for
  // itself anyway -- neither is reachable *from* this page without a
  // navigation that would fetch it regardless.
  //
  // IF THIS COMPONENT EVER TAKES A locationId FROM THE URL AGAIN, restore
  // the resync (git history has it): the guard becomes live the moment
  // `locationId` stops being `activeLocationId`.
  const { open: paletteOpen, setOpen: setPaletteOpen } = useCustomerCommandPalette();
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const dataMasking = useDataMasking();
  const masked = dataMasking.masked;
  const [changePwOpen, setChangePwOpen] = useState(false);
  const [tfaOpen, setTfaOpen] = useState(false);

  // The header renders above the `isLoading ? ... : d ? ...` split, so it
  // needs an answer in all three of those states. Two of them are not
  // "offline":
  //  - still loading -> "Checking…", not a red dot;
  //  - loaded but no liveness on the object (a location summary persisted
  //    by an older build of this app, read back out of zustand's
  //    localStorage) -> "Can't tell", not a colour chosen by an else.
  const headerLiveness: LocationLiveness =
    d?.liveness ?? activeLocation?.liveness ?? (isLoading ? CHECKING_LIVENESS : UNKNOWN_LIVENESS);

  // (The `activeLocationId !== locationId` guard that stood here -- spinner
  // / "Location not found" / `return null` -- was unreachable by
  // construction and is gone with the fetch that fed it. See the comment
  // above the `sidebar` state for the full argument and for exactly what
  // would have to change to make it live again.)

  const handleNav = (id: string) => navigate({ to: customerFeatureHref(id) });
  const handleLogout = async () => {
    await logout();
    navigate({ to: "/login", replace: true });
  };
  const handleSwitchLocation = () => {
    navigate({ to: "/switch-location" });
  };

  return (
    <SidebarProvider
      className="bg-muted/30"
      style={
        {
          "--primary": "#6C4EFF",
          "--primary-foreground": "#ffffff",
          "--ring": "#6366f1",
        } as React.CSSProperties
      }
    >
      {/* Sidebar -- same shared component/grouped-nav data source every
          other customer page (Reports, Campaigns, Policies, Vouchers,
          Portal, Devices, ISP Details, Admin Logs, etc., all rendered via
          customer.$locationId.$feature.tsx) uses, so Dashboard can't drift
          out of visual/structural sync with its siblings again. */}
      <CustomerSidebar
        activeFeatureId="dashboard"
        subtitle={activeLocation?.name}
        dataMasking={dataMasking}
      />

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <CustomerHeader
          title={
            <div className="flex min-w-0 flex-1 items-center gap-3">
              {/* Was a three-way ternary over `activeLocation?.status`
               * whose else-branch was a red dot -- so a location that had
               * simply not loaded yet, or whose routers could not be read,
               * rendered as a confident "offline", and the label beside it
               * was the raw backend enum word `capitalize`d.
               *
               * Reads the live dashboard query's own verdict rather than
               * the persisted store: `activeLocation` comes out of a
               * zustand `persist` store, so a summary written before this
               * field existed has no `liveness` at all -- which must show
               * as "can't tell", never as a colour picked by an else. */}
              <LocationLivenessBadge
                liveness={headerLiveness}
                surface="dark"
                className="hidden sm:inline-flex"
              />
              <span
                aria-hidden
                className={cn(
                  "h-2 w-2 rounded-full sm:hidden",
                  HEADER_DOT[livenessTone(headerLiveness.state)],
                )}
              />
            </div>
          }
          locationId={locationId}
          planExpiryIso={planExpiryIso}
          onOpenSearch={() => setPaletteOpen(true)}
          onRefresh={() => refetch()}
          user={user}
          onSwitchLocation={handleSwitchLocation}
          onChangePassword={() => setChangePwOpen(true)}
          onTfaSettings={() => setTfaOpen(true)}
          onLogout={handleLogout}
        />

        {/* Content -- main carries NO horizontal padding of its own: the
         * hero band below is full-bleed to the content column, and every
         * element inside it (hero copy, KPI grid, divider, cards) shares
         * ONE mx-auto max-w-7xl px-* container, so all left/right edges
         * line up at every viewport width. */}
        <main className="flex-1">
          {isLoading ? (
            <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
              <div className="space-y-6 animate-pulse">
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="h-24 rounded-2xl bg-muted" />
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="h-28 rounded-2xl bg-muted" />
                  ))}
                </div>
                <div className="grid gap-4 lg:grid-cols-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="h-72 rounded-2xl bg-muted" />
                  ))}
                </div>
              </div>
            </div>
          ) : d ? (
            <div>
              {/* Full-bleed dark section: spans the content column edge to
               * edge (main has no padding, so no negative margins needed),
               * while its INNER content uses the same shared container as
               * the cards below -- one horizontal grid from hero through
               * the whole dashboard. */}
              <div className="relative overflow-hidden bg-gradient-to-br from-[#1e1b4b] via-[#312e81] to-[#4c1d95] text-white shadow-xl shadow-indigo-950/30">
                <div
                  aria-hidden
                  className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-[#6C4EFF]/30 blur-3xl"
                />
                <div
                  aria-hidden
                  className="pointer-events-none absolute -bottom-24 -left-10 h-72 w-72 rounded-full bg-[#8B5CF6]/20 blur-3xl"
                />
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 opacity-[0.15]"
                  style={{
                    backgroundImage: "radial-gradient(rgba(255,255,255,0.5) 1px, transparent 1px)",
                    backgroundSize: "22px 22px",
                  }}
                />
                <div className="relative mx-auto max-w-7xl px-4 pt-3 pb-4 sm:px-6 lg:px-8">
                  <div className="relative flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.15em] text-white/60">
                        This location, right now
                      </p>
                      <p className="mt-0.5 text-xs text-white/40">
                        Live snapshot for {activeLocation?.name ?? "this venue"}
                      </p>
                    </div>
                    {/* Security-relevant alert surfaced beside the KPIs.
                     * `null` (fetch failed/denied) shows an honest "couldn't
                     * check" chip rather than a confident zero; zero shows
                     * nothing -- a clean day stays clean. */}
                    {d.kpis.failedLogins != null && d.kpis.failedLogins > 0 && (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-400/40 bg-rose-500/20 px-2.5 py-1 text-[11px] font-semibold text-rose-100">
                        <AlertTriangle className="h-3 w-3" />
                        {d.kpis.failedLogins} failed login
                        {d.kpis.failedLogins === 1 ? "" : "s"} today
                      </span>
                    )}
                    {d.kpis.failedLogins === null &&
                      roles.some(
                        (r) =>
                          r.roleSlug === "owner" ||
                          r.roleSlug === "organization-owner" ||
                          r.roleName?.toLowerCase().includes("owner") ||
                          r.scopeType === "global",
                      ) && (
                        <span
                          title="The failed-login check could not read this venue's login audit log."
                          className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/30 bg-amber-400/10 px-2.5 py-1 text-[11px] font-medium text-amber-100/80"
                        >
                          <AlertTriangle className="h-3 w-3" />
                          Login check unavailable
                        </span>
                      )}
                  </div>

                  {/* Three KPIs, equal weight -- one 3-column CSS grid with
                   * no manual gaps: divide-x draws the vertical rules at
                   * the exact column boundaries, and each column pads its
                   * content symmetrically, so the lines always bisect the
                   * spaces between columns at any viewport width. */}
                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 sm:divide-x sm:divide-white/10">
                    {[
                      {
                        label: "Guests today",
                        value: d.kpis.todayGuests.toLocaleString(),
                        context: null,
                      },
                      {
                        label: "Online right now",
                        value: d.kpis.onlineUsers.toLocaleString(),
                        context: `Today's peak: ${d.kpis.peakConcurrent.toLocaleString()}`,
                      },
                      // Omitted entirely (not a fake "--%") when there's no
                      // active uplink / no health-check data yet to compute
                      // a real figure from -- see getDashboard()'s comment.
                      ...(d.kpis.slaUptime != null
                        ? [
                            {
                              label: "Uptime",
                              value: formatUptimePercent(d.kpis.slaUptime),
                              context: null,
                            },
                          ]
                        : []),
                    ].map((k, i) => (
                      <motion.div
                        key={k.label}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.06 }}
                        className="sm:px-6 sm:first:pl-0 sm:last:pr-0"
                      >
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-white/50">
                          {k.label}
                        </p>
                        <p className="font-display mt-1 text-3xl font-bold tracking-tight tabular-nums sm:leading-none">
                          {k.value}
                        </p>
                        {k.context && (
                          <p className="mt-1 text-xs font-medium text-white/60">{k.context}</p>
                        )}
                      </motion.div>
                    ))}
                  </div>

                  {/* Session meta -- starts exactly at the same content edge
                   * as the Guests today column above (no leading icon, which
                   * would indent the label off the shared grid edge). */}
                  <div className="mt-4 border-t border-white/10 pt-2.5 text-xs tabular-nums text-white/70">
                    <span className="font-semibold text-white">{d.kpis.avgSession} min</span>{" "}
                    <span className="text-white/50">avg session</span>
                  </div>
                </div>
              </div>

              {/* Cards + charts live in the SAME horizontal container as the
               * hero copy above (mx-auto max-w-7xl px-*) so the status
               * card's left edge is exactly the KPI grid's left edge at
               * every viewport width. */}
              <div className="mx-auto max-w-7xl space-y-8 px-4 pt-8 sm:px-6 lg:px-8">
                {/* Status strip -- one compact card instead of a sprawling
                 * single row: a label up top, then each infrastructure
                 * verdict as its own bordered chip so System/Routers/ISP
                 * read as separate facts, not one run-on sentence.
                 *
                 * The two icons that used to be hard-coded
                 * `text-emerald-500` regardless of value now read off the
                 * real verdict, so "Routers 0/1" can no longer sit behind
                 * a green tick. The ISP chip keeps NO status icon at all:
                 * `d.health.isp` is derived from `/dashboard/organization`
                 * answering, not from any uplink's health (see
                 * getDashboard()), and a green tick on it would be the
                 * same fabricated reassurance as the "WireGuard:
                 * Reachable" stat the fleet wizard had to remove. */}
                <div className="space-y-3">
                  <div className="rounded-2xl px-5 py-3.5 premium-card">
                    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                      <p className="text-xs font-medium text-muted-foreground">
                        Core systems, checked continuously
                      </p>
                      {locationLivenessIsReassuring(d.liveness) && (
                        <LocationLivenessBadge liveness={d.liveness} className="shrink-0" />
                      )}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-lg border border-border/80 bg-background/60 px-2.5 py-1.5 text-xs">
                        <CheckCircle
                          aria-hidden
                          className={cn("h-3.5 w-3.5", CORE_ICON[livenessTone(d.liveness.state)])}
                        />
                        <span className="text-muted-foreground">System</span>
                        <span className="font-semibold text-foreground">
                          {d.health.systemHealth}
                        </span>
                      </span>
                      <span className="inline-flex items-center gap-1.5 rounded-lg border border-border/80 bg-background/60 px-2.5 py-1.5 text-xs">
                        <Router
                          aria-hidden
                          className={cn("h-3.5 w-3.5", CORE_ICON[livenessTone(d.liveness.state)])}
                        />
                        <span className="text-muted-foreground">Routers</span>
                        <span className="font-semibold text-foreground">
                          {d.health.routersOnline}
                        </span>
                      </span>
                      <span className="inline-flex items-center gap-1.5 rounded-lg border border-border/80 bg-background/60 px-2.5 py-1.5 text-xs">
                        <Activity aria-hidden className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-muted-foreground">ISP</span>
                        <span className="font-semibold text-foreground">{d.health.isp}</span>
                      </span>
                    </div>
                  </div>

                  {/* Which precondition is unmet, in the operator's words,
                   * plus when we last actually heard from the router.
                   * Renders nothing when the venue is plainly live. */}
                  <LocationLivenessExplainer liveness={d.liveness} />
                </div>

                {/* Quick Actions -- 1-click access to most frequent operational tasks */}
                <div className="rounded-2xl border border-border/70 bg-card/60 p-3.5 backdrop-blur-sm shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Quick Actions
                    </p>
                    <span className="text-[11px] text-muted-foreground/80">
                      Common front-desk &amp; venue tasks
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                    <button
                      type="button"
                      onClick={() => handleNav("vouchers")}
                      className="group flex items-center gap-2.5 rounded-xl border border-border/80 bg-background/80 p-2.5 text-left transition-all hover:border-primary/50 hover:bg-primary/5 hover:shadow-sm"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 transition-colors group-hover:bg-primary group-hover:text-white dark:text-indigo-400">
                        <Ticket className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-foreground group-hover:text-primary">
                          Create Voucher
                        </p>
                        <p className="truncate text-[10px] text-muted-foreground">
                          Issue WiFi pass
                        </p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleNav("debugging")}
                      className="group flex items-center gap-2.5 rounded-xl border border-border/80 bg-background/80 p-2.5 text-left transition-all hover:border-amber-500/50 hover:bg-amber-500/5 hover:shadow-sm"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 transition-colors group-hover:bg-amber-500 group-hover:text-white dark:text-amber-400">
                        <Wifi className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-foreground group-hover:text-amber-600 dark:group-hover:text-amber-400">
                          Fix a Problem
                        </p>
                        <p className="truncate text-[10px] text-muted-foreground">
                          Rescue guest WiFi
                        </p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleNav("portal")}
                      className="group flex items-center gap-2.5 rounded-xl border border-border/80 bg-background/80 p-2.5 text-left transition-all hover:border-violet-500/50 hover:bg-violet-500/5 hover:shadow-sm"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600 transition-colors group-hover:bg-violet-500 group-hover:text-white dark:text-violet-400">
                        <QrCode className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-foreground group-hover:text-violet-600 dark:group-hover:text-violet-400">
                          Splash &amp; QR
                        </p>
                        <p className="truncate text-[10px] text-muted-foreground">
                          Portal branding
                        </p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleNav("users")}
                      className="group flex items-center gap-2.5 rounded-xl border border-border/80 bg-background/80 p-2.5 text-left transition-all hover:border-emerald-500/50 hover:bg-emerald-500/5 hover:shadow-sm"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 transition-colors group-hover:bg-emerald-500 group-hover:text-white dark:text-emerald-400">
                        <Users className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-foreground group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                          Live Guests
                        </p>
                        <p className="truncate text-[10px] text-muted-foreground">
                          Active sessions
                        </p>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Charts */}
                <div>
                  <p className="mb-3 text-xs font-medium text-muted-foreground">
                    Traffic and hardware, throughout today.
                  </p>
                  <div className="grid gap-6 lg:grid-cols-3">
                    <Card className="h-full lg:col-span-1 premium-card premium-card-hover">
                      <CardHeader className="flex flex-row items-center gap-2.5 space-y-0">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#6C4EFF] to-[#8B5CF6]">
                          <TrendingUp className="h-3.5 w-3.5 text-white" />
                        </div>
                        <CardTitle className="text-sm">Guests online (by hour)</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="h-52">
                          {/* Real (non-demo) dashboards always hand back a
                           * full 24-bucket array here -- one entry per hour,
                           * `users: 0` for every hour nothing happened --
                           * never a genuinely empty array, so checking every
                           * bucket for `users === 0` (true for both a
                           * genuinely empty array and an all-zero one) is
                           * what actually catches "no guest activity today." */}
                          {d.usersTrend.every((h) => h.users === 0) ? (
                            <ChartEmptyState
                              label="No guest activity yet today."
                              action={{
                                label: "Preview Splash Portal",
                                onClick: () => handleNav("portal"),
                              }}
                            />
                          ) : (
                            // Settles in rather than popping on mount -- Magic
                            // UI's "Blur Fade" idea, wrapping the chart's
                            // container only; Recharts' own render/animation
                            // props are untouched (design v3 Part 4).
                            <BlurFade inView className="h-full w-full" blur="4px" offset={4}>
                              <ResponsiveContainer width="100%" height="100%">
                                <AreaChart
                                  data={d.usersTrend}
                                  margin={{ top: 8, right: 8, left: -6, bottom: 0 }}
                                >
                                  <defs>
                                    <linearGradient id="ug" x1="0" y1="0" x2="0" y2="1">
                                      <stop
                                        offset="0%"
                                        stopColor="var(--primary)"
                                        stopOpacity={0.35}
                                      />
                                      <stop
                                        offset="100%"
                                        stopColor="var(--primary)"
                                        stopOpacity={0.02}
                                      />
                                    </linearGradient>
                                  </defs>
                                  <CartesianGrid
                                    strokeDasharray="3 3"
                                    vertical={false}
                                    stroke="var(--border)"
                                    strokeOpacity={0.6}
                                  />
                                  <XAxis
                                    dataKey="hour"
                                    tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                                    tickLine={false}
                                    axisLine={false}
                                    interval={3}
                                    tickFormatter={(val: string) =>
                                      `${String(val).padStart(2, "0")}:00`
                                    }
                                  />
                                  <YAxis
                                    tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                                    tickLine={false}
                                    axisLine={false}
                                    width={38}
                                    // Scale to the data rather than Recharts'
                                    // default padded range: snap the ceiling to
                                    // a round number so quiet days don't waste
                                    // the top half of the chart.
                                    domain={[
                                      0,
                                      (dataMax: number) =>
                                        Math.max(20, Math.ceil(dataMax / 20) * 20),
                                    ]}
                                    tickCount={6}
                                  />
                                  <Tooltip
                                    cursor={{ stroke: "var(--primary)", strokeOpacity: 0.35 }}
                                    contentStyle={{
                                      borderRadius: "12px",
                                      border: "1px solid var(--border)",
                                      background: "var(--popover)",
                                      color: "var(--popover-foreground)",
                                      fontSize: 12,
                                      boxShadow: "0 8px 24px -12px rgb(0 0 0 / 0.35)",
                                    }}
                                    formatter={(value: unknown) => [
                                      `${typeof value === "number" ? value : 0} guests`,
                                      "Online",
                                    ]}
                                    labelFormatter={(label: unknown) =>
                                      `Hour ${String(label).padStart(2, "0")}:00`
                                    }
                                  />
                                  <Area
                                    type="monotone"
                                    dataKey="users"
                                    stroke="var(--primary)"
                                    fill="url(#ug)"
                                    strokeWidth={2.25}
                                    activeDot={{
                                      r: 4,
                                      strokeWidth: 2,
                                      stroke: "var(--background)",
                                    }}
                                  />
                                </AreaChart>
                              </ResponsiveContainer>
                            </BlurFade>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="h-full lg:col-span-1 premium-card premium-card-hover">
                      <CardHeader className="flex flex-row items-center gap-2.5 space-y-0">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#6C4EFF] to-[#8B5CF6]">
                          <Router className="h-3.5 w-3.5 text-white" />
                        </div>
                        <CardTitle className="text-sm">Devices by OS</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="h-52">
                          {d.deviceDistribution.length === 0 ? (
                            <ChartEmptyState label="No devices connected yet." />
                          ) : (
                            <BlurFade inView className="h-full w-full" blur="4px" offset={4}>
                              <div className="flex h-full flex-col justify-center gap-3">
                                {(() => {
                                  const max = Math.max(
                                    ...d.deviceDistribution.map((x) => x.value),
                                    1,
                                  );
                                  return d.deviceDistribution.map((item, i) => (
                                    <div key={item.name} className="flex items-center gap-3">
                                      <span className="w-20 shrink-0 truncate text-xs text-muted-foreground">
                                        {item.name}
                                      </span>
                                      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                                        <div
                                          className="h-full rounded-full"
                                          style={{
                                            width: `${(item.value / max) * 100}%`,
                                            backgroundColor:
                                              DEVICE_COLORS[i % DEVICE_COLORS.length],
                                          }}
                                        />
                                      </div>
                                      <span className="w-6 shrink-0 text-right text-xs font-semibold tabular-nums">
                                        {item.value}
                                      </span>
                                    </div>
                                  ));
                                })()}
                              </div>
                            </BlurFade>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="h-full lg:col-span-1 premium-card premium-card-hover">
                      <CardHeader className="flex flex-row items-center gap-2.5 space-y-0">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#6C4EFF] to-[#8B5CF6]">
                          <Activity className="h-3.5 w-3.5 text-white" />
                        </div>
                        <CardTitle className="text-sm">Guest arrivals (by hour)</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="h-52">
                          {/* Same real-data shape as usersTrend above -- a
                           * full 24-hour array of `sessions: 0` buckets, not
                           * an empty one, so the "all zero" check (not just
                           * "empty") is what actually catches a quiet day. */}
                          {d.hourlySessions.every((h) => h.sessions === 0) ? (
                            <ChartEmptyState
                              label="No session activity yet today."
                              action={{
                                label: "Generate Voucher",
                                onClick: () => handleNav("vouchers"),
                              }}
                            />
                          ) : (
                            <BlurFade inView className="h-full w-full" blur="4px" offset={4}>
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                  data={d.hourlySessions}
                                  margin={{ top: 8, right: 8, left: -6, bottom: 0 }}
                                >
                                  <defs>
                                    <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
                                      <stop
                                        offset="0%"
                                        stopColor="var(--primary)"
                                        stopOpacity={0.95}
                                      />
                                      <stop
                                        offset="100%"
                                        stopColor="var(--chart-1)"
                                        stopOpacity={0.55}
                                      />
                                    </linearGradient>
                                  </defs>
                                  <CartesianGrid
                                    strokeDasharray="3 3"
                                    vertical={false}
                                    stroke="var(--border)"
                                    strokeOpacity={0.6}
                                  />
                                  <XAxis
                                    dataKey="hour"
                                    tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                                    tickLine={false}
                                    axisLine={false}
                                    interval={3}
                                    tickFormatter={(val: string) =>
                                      `${String(val).padStart(2, "0")}:00`
                                    }
                                  />
                                  <YAxis
                                    tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                                    tickLine={false}
                                    axisLine={false}
                                    width={38}
                                    // Scale to the data rather than Recharts'
                                    // default padded range: snap the ceiling to
                                    // a round number so quiet days don't waste
                                    // the top half of the chart.
                                    domain={[
                                      0,
                                      (dataMax: number) =>
                                        Math.max(20, Math.ceil(dataMax / 20) * 20),
                                    ]}
                                    tickCount={6}
                                  />
                                  <Tooltip
                                    cursor={{ fill: "var(--muted)", fillOpacity: 0.5 }}
                                    contentStyle={{
                                      borderRadius: "12px",
                                      border: "1px solid var(--border)",
                                      background: "var(--popover)",
                                      color: "var(--popover-foreground)",
                                      fontSize: 12,
                                      boxShadow: "0 8px 24px -12px rgb(0 0 0 / 0.35)",
                                    }}
                                    formatter={(value: unknown) => [
                                      `${typeof value === "number" ? value : 0} arrivals`,
                                      "Joined",
                                    ]}
                                    labelFormatter={(label: unknown) =>
                                      `Hour ${String(label).padStart(2, "0")}:00`
                                    }
                                  />
                                  <Bar
                                    dataKey="sessions"
                                    fill="url(#sg)"
                                    radius={[6, 6, 0, 0]}
                                    maxBarSize={26}
                                  />
                                </BarChart>
                              </ResponsiveContainer>
                            </BlurFade>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>

                {/* Bandwidth Utilization -- a real, live-updating graph
                 * (not just a single "right now" number), so a congestion
                 * spike or drop is visible on-screen as it happens. Its
                 * own full-width row, deliberately not folded into either
                 * the 3-card "Charts" grid above (a 4th card there would
                 * wrap 3+1) or either column of the "Activity" split below
                 * (which stays exactly as balanced as it already was) --
                 * see BandwidthUtilizationCard's own comment for the full
                 * reasoning. */}
                <div>
                  <p className="mb-3 text-xs font-medium text-muted-foreground">
                    Bandwidth on your primary uplink, sampled roughly every 30 seconds.
                  </p>
                  <BandwidthUtilizationCard
                    locationId={locationId}
                    onManage={() => handleNav("isp-details")}
                  />
                </div>

                {/* Activity -- Recent Users stays a data table (it already
                 * is one, correctly); Recent Alerts becomes a left-accent
                 * timeline instead of a second plain list, so the two cards
                 * read as different kinds of information, not visual
                 * twins. Their `time` fields are pre-formatted strings
                 * ("2 min ago"), not real timestamps, so they aren't
                 * safely mergeable into one interleaved feed.
                 *
                 * Both columns are a real 2-card stack, not a 1-vs-3 split.
                 * An earlier pass put Recent Alerts, Internet Connection,
                 * AND Network Hardware all in the right column with
                 * `items-start` so the short Recent Users table stopped
                 * being CSS-stretched to match -- that fixed the stretch
                 * bug but not the actual complaint: the right column still
                 * ran ~2x taller than the left, leaving a wide strip of
                 * empty page background beside Recent Users. Moving
                 * Network Hardware over here (a compact per-type summary,
                 * not a big card) instead of leaving it in the tall stack
                 * brings both columns to comparable real content height --
                 * a genuine rebalance, not another alignment tweak. */}
                <div>
                  <p className="mb-3 text-xs font-medium text-muted-foreground">
                    Who showed up, what needed a look, and whether the internet's up.
                  </p>
                  {/* items-start still matters even with two balanced 2-card
                   * columns: their exact heights won't ever match to the
                   * pixel (a table's row count vs. prose content), so this
                   * keeps each column sized to its own content rather than
                   * Grid stretching one to match the other. */}
                  <div className="grid items-start gap-6 lg:grid-cols-2">
                    <div className="flex flex-col gap-6">
                      <Card className="premium-card premium-card-hover">
                        <CardHeader className="flex flex-row items-center justify-between">
                          <CardTitle className="text-sm">Recent Users</CardTitle>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs text-primary"
                            onClick={() => handleNav("users")}
                          >
                            View all →
                          </Button>
                        </CardHeader>
                        <CardContent className="p-0">
                          {d.recentUsers.length === 0 ? (
                            <div className="flex flex-col items-center justify-center px-6 py-8 text-center">
                              <p className="text-xs text-muted-foreground">
                                No guests have connected yet — check back once someone joins the
                                network.
                              </p>
                              <button
                                type="button"
                                onClick={() => handleNav("portal")}
                                className="mt-2 text-xs font-medium text-primary hover:underline"
                              >
                                Test Splash Page →
                              </button>
                            </div>
                          ) : (
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="text-xs font-medium uppercase tracking-wide">
                                    User
                                  </TableHead>
                                  <TableHead className="text-xs font-medium uppercase tracking-wide hidden md:table-cell">
                                    Device
                                  </TableHead>
                                  <TableHead className="text-xs font-medium uppercase tracking-wide">
                                    Time
                                  </TableHead>
                                  <TableHead className="text-xs font-medium uppercase tracking-wide">
                                    Status
                                  </TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {d.recentUsers.map((u) => (
                                  <TableRow key={u.id} className="border-b">
                                    <TableCell>
                                      <p className="text-sm font-medium">{u.name}</p>
                                      <p className="text-xs text-muted-foreground">
                                        {masked ? maskEmail(u.email) : u.email}
                                      </p>
                                    </TableCell>
                                    <TableCell className="text-sm hidden md:table-cell">
                                      {u.device}
                                    </TableCell>
                                    <TableCell className="text-xs text-muted-foreground">
                                      {u.time}
                                    </TableCell>
                                    <TableCell>
                                      <span
                                        className={cn(
                                          "inline-flex items-center gap-1 text-xs font-medium",
                                          u.status === "online"
                                            ? "text-emerald-500"
                                            : "text-muted-foreground",
                                        )}
                                      >
                                        <span
                                          className={cn(
                                            "h-1.5 w-1.5 rounded-full",
                                            u.status === "online"
                                              ? "bg-emerald-500"
                                              : "bg-muted-foreground",
                                          )}
                                        />
                                        {u.status}
                                      </span>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          )}
                        </CardContent>
                      </Card>
                      {/* Internet Connection pairs with Recent Users (both
                       * naturally the fuller of their row -- a real 6-row
                       * table and, once the on-demand Speed Test/Uplinks UI
                       * was added, the taller of the two bottom cards) so
                       * this column and the Recent Alerts/Network Hardware
                       * one stay comparable in real content height. Network
                       * Hardware's empty state is genuinely short whenever a
                       * location has no monitored hardware yet, same as
                       * Recent Alerts' "All clear" state is short when
                       * there's nothing to flag -- pairing the two short
                       * ones together (and the two full ones together)
                       * rebalances the columns without any CSS stretch
                       * trick, matching the comment above this grid. */}
                      <WanStatusCard
                        locationId={locationId}
                        onManage={() => handleNav("isp-details")}
                      />
                    </div>
                    <div className="flex flex-col gap-6">
                      <Card className="premium-card premium-card-hover">
                        <CardHeader className="flex flex-row items-center justify-between">
                          <CardTitle className="text-sm">Recent Alerts</CardTitle>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs text-primary"
                            onClick={() => handleNav("alerts")}
                          >
                            All →
                          </Button>
                        </CardHeader>
                        <CardContent className="space-y-2 p-3">
                          {d.recentAlerts.length === 0 ? (
                            <p className="py-8 text-center text-xs text-muted-foreground">
                              All clear. Nothing needs your attention right now.
                            </p>
                          ) : (
                            d.recentAlerts.map((a, i) => {
                              const border =
                                a.type === "error"
                                  ? "border-rose-500"
                                  : a.type === "warning"
                                    ? "border-amber-500"
                                    : a.type === "success"
                                      ? "border-emerald-500"
                                      : "border-sky-500";
                              return (
                                <div
                                  key={i}
                                  className={cn(
                                    "flex items-start gap-3 rounded-xl border-l-4 bg-muted/40 py-2.5 pl-3 pr-3",
                                    border,
                                  )}
                                >
                                  {a.type === "error" && (
                                    <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
                                  )}
                                  {a.type === "warning" && (
                                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                                  )}
                                  {a.type === "success" && (
                                    <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                                  )}
                                  {a.type === "info" && (
                                    <Activity className="mt-0.5 h-4 w-4 shrink-0 text-sky-500" />
                                  )}
                                  <div className="min-w-0 flex-1">
                                    <p className="text-sm">{a.msg}</p>
                                    <p className="text-xs text-muted-foreground">{a.time}</p>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </CardContent>
                      </Card>
                      <DeviceStatusCard
                        locationId={locationId}
                        onManage={() => handleNav("devices")}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
                <p className="mb-1 font-medium text-foreground">Couldn't load this dashboard</p>
                <p className="mb-4 text-sm">Your connection or our servers hiccuped — try again.</p>
                <Button variant="outline" onClick={() => refetch()}>
                  Retry
                </Button>
              </div>
            </div>
          )}
        </main>
      </div>
      <ChangePasswordDialog open={changePwOpen} onOpenChange={setChangePwOpen} />
      <TwoFactorDialog open={tfaOpen} onOpenChange={setTfaOpen} />
      <CustomerCommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
      <AssistantWidget />
    </SidebarProvider>
  );
}
