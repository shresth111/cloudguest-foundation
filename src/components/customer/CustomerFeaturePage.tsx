import { Suspense, useState } from "react";
import { lazyView } from "@/lib/lazy-view";
import { useNavigate } from "@tanstack/react-router";
import { motion, useReducedMotion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/context/AuthContext";
import { useCustomerStore } from "@/stores/customerStore";
import { CustomerSidebar } from "@/components/customer/CustomerSidebar";
import { CustomerPageScope } from "@/components/customer/CustomerPageScope";
import {
  CustomerCommandPalette,
  useCustomerCommandPalette,
} from "@/components/customer/CustomerCommandPalette";
import { SidebarProvider } from "@/components/ui/sidebar";
import { CustomerHeader } from "@/components/customer/CustomerHeader";
import { CUSTOMER_NAVS, customerFeatureHref } from "@/lib/customerNav";
import { AgentsPage } from "@/components/features/AgentsPage";
import { CampaignsPage } from "@/components/features/CampaignsPage";
import { VouchersPage } from "@/components/features/VouchersPage";
import { PortalPage } from "@/components/features/PortalPage";
import PoliciesHub from "@/components/features/PoliciesHub";
import { AdvancedPage } from "@/components/features/FeatureComponents";
import ManageTeamsPage from "@/components/features/ManageTeamsPage";
import WhiteList from "@/components/features/WhiteList";
import UserReports from "@/components/features/UserReports";
import NetworkActivityLog from "@/components/features/NetworkActivityLog";
import { ChangePasswordDialog } from "@/components/features/ChangePasswordDialog";
import { TwoFactorDialog } from "@/components/features/TwoFactorDialog";
import AssistantWidget from "@/components/features/AssistantWidget";
import TicketsPage from "@/components/features/TicketsPage";
import { HowItWorksView } from "@/components/customer/HowItWorksPage";
const NetworkHardwareView = lazyView(
  () => import("@/components/customer/BasicFeatureViews"),
  "NetworkHardwareView",
);
import { DeviceHealthTrafficView } from "@/components/customer/DeviceHealthTrafficView";
import { maskMac, DEMO_PLAN_RENEWAL_ISO } from "@/components/features/HeaderControls";
import { LoadingSkeleton } from "@/components/common/LoadingSkeleton";
import { EmptyState } from "@/components/common/EmptyState";
import { useMyBillingDashboard } from "@/hooks/useBilling";
import { useCustomerFeatureData } from "@/hooks/useCustomerDashboard";
import { useIsDemo, useDataMasking } from "@/hooks/useCustomerDashboard";
// Lazy, not static. This was the last remaining eager importer of
// OperationsFeatures -- a 446 kB chunk, the largest in the build after the
// React and charts vendors. Because `routeTree.gen.ts` statically imports
// all 180 routes, one static import anywhere in a route's component tree
// puts the whole chunk in the graph the browser must fetch before first
// paint. With this and the registry in `config/customerFeatures.tsx` both
// deferred, nothing imports it statically any more, so it is fetched when
// an operations feature is actually opened.
//
// All fourteen views live in one module, so opening any one of them fetches
// the same chunk. Splitting that module is a separate change; the point
// here is *when* it is fetched, not how finely it is divided.
const OPS = () => import("@/components/features/OperationsFeatures");
const AlertsView = lazyView(OPS, "AlertsView");
const OpenHoursView = lazyView(OPS, "OpenHoursView");
const IspDetailsView = lazyView(OPS, "IspDetailsView");
const AdminLogsView = lazyView(OPS, "AdminLogsView");
const MacAuthView = lazyView(OPS, "MacAuthView");
const PortForwardingView = lazyView(OPS, "PortForwardingView");
const DhcpView = lazyView(OPS, "DhcpView");
const VlansView = lazyView(OPS, "VlansView");
const VoipView = lazyView(OPS, "VoipView");
const WebsiteBlockingView = lazyView(OPS, "WebsiteBlockingView");
const DebuggingView = lazyView(OPS, "DebuggingView");
const HotspotView = lazyView(OPS, "HotspotView");
const GenericFeatureView = lazyView(OPS, "GenericFeatureView");
import { Wifi, Activity } from "lucide-react";

/**
 * The shared shell + content-switch for every customer feature page
 * (reports, alerts, campaigns, portal, vouchers, policies, ...) --
 * extracted from what used to be c.$feature.tsx's own route component so
 * each feature can get a real, distinct top-level URL (see e.g.
 * reports.tsx, alerts.tsx) instead of all sharing one `/c/$feature`
 * dynamic route, while still sharing this one ~900-line implementation
 * instead of duplicating it per file.
 *
 * `feature` is now a plain prop (each thin route file passes its own
 * fixed id in) rather than read from `Route.useParams()` -- this
 * component has no route context of its own anymore. The few feature ids
 * that couldn't get their bare name as a URL (campaigns/portal/vouchers
 * already belong to the pre-existing operator-shell/guest-portal routes
 * -- see customerNav.ts's own comment) still pass their real feature id
 * here unchanged; only the URL segment differs, not the id used for
 * sidebar highlighting/permissions/labels.
 */
export function CustomerFeaturePage({ feature }: { feature: string }) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { activeLocation, activeLocationId } = useCustomerStore();
  // Every route file rendering this component guards on
  // requireActiveLocationId() in its own beforeLoad before mounting this.
  const locationId = activeLocationId!;
  // Read through the SSR-safe useIsDemo() hook, not isDemo() directly --
  // isDemo() reads localStorage synchronously, so calling it straight in
  // render flips value between the server pass (no window -> false) and
  // the client's first hydration pass (real token -> true), which changes
  // whether PlanRenewalTicket's chip renders at all and threw a real
  // "Hydration failed" (#418) on every feature page load (dashboard's own
  // equivalent computation happened to dodge it, but the same fragile
  // pattern -- fixed here rather than left as a footgun).
  const demoFlag = useIsDemo();
  const billing = useMyBillingDashboard(
    demoFlag ? undefined : activeLocation?.organizationId,
    activeLocation?.organizationName,
  );
  const planExpiryIso = demoFlag ? DEMO_PLAN_RENEWAL_ISO : billing.data?.renewalDate;
  const { open: paletteOpen, setOpen: setPaletteOpen } = useCustomerCommandPalette();
  const dataMasking = useDataMasking();
  const masked = dataMasking.masked;
  const [changePwOpen, setChangePwOpen] = useState(false);
  const [tfaOpen, setTfaOpen] = useState(false);

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
          // The indigo brand accent from login/select-location/dashboard
          // never reached this shell -- every feature page nested under it
          // (Reports, Campaigns, Portal, Vouchers, Policies, Whitelist,
          // Devices, Teams, Agents, Alerts, Open Hours,
          // ISP Details, Admin Logs, Mac Auth, Port Forwarding, DHCP,
          // VLANs, VOIP, ISP Routing, Debugging, Hotspot, Tickets) was
          // still rendering every `text-primary`/`bg-primary`/`ring-primary`
          // utility with the old teal token, which is what kept reading as
          // "still old" no matter how many individual pages got polished.
          // One override here fixes it everywhere at once.
          "--primary": "#6C4EFF",
          "--primary-foreground": "#ffffff",
          "--ring": "#6366f1",
        } as React.CSSProperties
      }
    >
      {/* The hand-rolled scrim + translate-x drawer that used to live here
          is gone: `SidebarProvider` owns open/collapsed state (persisted to
          a cookie, so it survives this shell remounting on every route
          change), binds Cmd/Ctrl-B, and renders the mobile drawer as a Radix
          Sheet -- focus trap, Escape and scroll lock included. */}
      <CustomerSidebar
        activeFeatureId={feature}
        subtitle={activeLocation?.name}
        dataMasking={dataMasking}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <CustomerHeader
          title={
            // Label from the same CUSTOMER_NAVS list the palette and the
            // page scope line read, never the raw feature id -- the old fallback
            // CSS-`capitalize`d it and so kept showing retired technical
            // names ("Whitelist", "Isp-Details") after the rename. The venue
            // stays in the bar as well as on the page: the bar is where you
            // check it deliberately, the page heading is where you read it
            // without meaning to. See CustomerPageScope for why that
            // matters once lists are scoped server-side.
            <p className="truncate text-sm font-semibold capitalize">
              {CUSTOMER_NAVS.find((n) => n.id === feature)?.label ?? feature} ·{" "}
              {activeLocation?.name ?? ""}
            </p>
          }
          locationId={locationId}
          planExpiryIso={planExpiryIso}
          onOpenSearch={() => setPaletteOpen(true)}
          user={user}
          onSwitchLocation={handleSwitchLocation}
          onChangePassword={() => setChangePwOpen(true)}
          onTfaSettings={() => setTfaOpen(true)}
          onLogout={handleLogout}
        />

        {/* pb-24 clears the fixed AssistantWidget launcher (h-14, bottom-6 ==
            80px) that floats over every feature page below -- without it,
            the last row/card on a page that fills the viewport renders
            partly behind the button (seen concretely on Alerts' "Recent
            alerts" list). One padding bump here covers all ~22 feature
            views this shell renders. */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 pb-24 overflow-y-auto">
          <div className="mx-auto max-w-7xl">
            {/* What this screen is, and which venue it is scoped to. */}
            <CustomerPageScope featureId={feature} locationName={activeLocation?.name} />
            {/* Every branch below can be a lazily-loaded view, so the whole
                group sits behind one boundary. Only one branch matches at a
                time, and a single fallback keeps the page from flickering
                between them. It has to wrap the *whole* group: an earlier
                version started halfway down and left the views above it
                uncovered, which would have thrown on first render. */}
            <Suspense
              fallback={
                <div className="flex min-h-[240px] items-center justify-center">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </div>
              }
            >
              {/* No `dashboard`/`users` branch here on purpose. Both were
                  dead: `/` renders CustomerDashboardPage (routes/index.tsx)
                  and `/users` is its own route (routes/users.tsx), and no
                  route file has passed `feature="dashboard"` or
                  `feature="users"` into this shell since location ids moved
                  out of the URL. The two views behind these branches sat
                  here for ~700 lines as a second, unreachable copy of both
                  screens -- and kept attracting fixes: the `pb-24`
                  AssistantWidget clearance and the uptime-formatting change
                  both landed on the dead dashboard while the live one at `/`
                  went without. Deleted rather than re-wired; if this
                  shell ever needs to render a dashboard again it should
                  render the live component, not a fork of it. */}
              {feature === "reports" && <UserReports masked={masked} />}
              {feature === "campaigns" && <CampaignsPage locationId={locationId} />}
              {feature === "portal" && <PortalPage locationId={locationId} />}
              {feature === "vouchers" && <VouchersPage locationId={locationId} />}
              {feature === "policies" && <PoliciesHub locationId={locationId} />}
              {feature === "whitelist" && <WhiteList locationId={locationId} />}
              {feature === "devices" && (
                <div className="space-y-4">
                  <NetworkHardwareView locationId={locationId} />
                  {/* The venue's own network hardware and how it has been
                    performing, above the guest devices connected to it. */}
                  <DeviceHealthTrafficView locationId={locationId} />
                  <DevicesView locationId={locationId} masked={masked} />
                </div>
              )}
              {feature === "teams" && <ManageTeamsPage locationId={locationId} />}
              {feature === "agents" && <AgentsPage locationId={locationId} />}
              {feature === "advanced" && <AdvancedPage />}
              {/* "audit" no longer has its own nav entry (merged into Admin
                Logs' Account Activity section) -- keep old bookmarks/links
                to /customer/:id/audit landing somewhere real instead of the
                generic-feature fallback. */}
              {feature === "audit" && <AdminLogsView locationId={locationId} />}
              {feature === "tickets" && <TicketsPage locationId={locationId} />}
              {feature === "how-it-works" && <HowItWorksView />}
              {feature === "alerts" && <AlertsView />}
              {feature === "business-hours" && <OpenHoursView locationId={locationId} />}
              {/* "background-image" no longer renders here -- the login-screen
                backdrop is uploaded from Portal -> Design (PortalPage.tsx),
                beside the logo and headline it has to stay legible against.
                Unlike "audit" above, old links don't need a fallback branch:
                /background-image redirects to /guest-portal at beforeLoad,
                so nothing reaches this switch with that id. */}
              {feature === "isp-details" && <IspDetailsView locationId={locationId} />}
              {feature === "admin-logs" && <AdminLogsView locationId={locationId} />}
              {feature === "network-activity" && <NetworkActivityLog masked={masked} />}
              {feature === "mac-auth" && <MacAuthView locationId={locationId} />}
              {feature === "port-forwarding" && <PortForwardingView locationId={locationId} />}
              {feature === "dhcp" && <DhcpView locationId={locationId} />}
              {feature === "vlans" && <VlansView locationId={locationId} />}
              {feature === "voip" && <VoipView locationId={locationId} />}
              {feature === "website-blocking" && <WebsiteBlockingView locationId={locationId} />}
              {/* `masked` matters here now: this page looks a guest up by
                  phone number, so it renders an identifier the account
                  holder's own masking preference applies to. */}
              {feature === "debugging" && <DebuggingView locationId={locationId} masked={masked} />}
              {feature === "hotspot" && <HotspotView locationId={locationId} />}
              {/* "audit" is handled above (redirected to AdminLogsView, see
                that render line's own comment) -- excluded here too so it
                doesn't also fall through to the generic placeholder. */}
              {feature !== "audit" && !CUSTOMER_NAVS.some((n) => n.id === feature) && (
                <GenericFeatureView feature={feature} />
              )}
            </Suspense>
          </div>
        </main>
      </div>
      <ChangePasswordDialog open={changePwOpen} onOpenChange={setChangePwOpen} />
      <TwoFactorDialog open={tfaOpen} onOpenChange={setTfaOpen} />
      <CustomerCommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
      <AssistantWidget />
    </SidebarProvider>
  );
}

// ── Dashboard ───────────────────────────────────────────────
/** Operator-voice lines, not fabricated testimonials -- same idea as the
 * Select Location page's rotating quotes, scoped to this location's own
 * dashboard so the hero's secondary-stat row doesn't leave dead space next
 * to the corner illustration. */
const DASHBOARD_QUOTES = [
  "Uptime is a feature nobody thanks you for — until it's gone.",
  "Check it before a guest has to tell you it's down.",
  "The best network is the one nobody notices.",
  "A dropped connection is a dropped guest.",
  "Numbers you check daily are numbers that stay healthy.",
];

/**
 * Compact corner illustration for the Dashboard hero card: a mini brand
 * shield-and-signal mark beside a live pulse-monitor with a calm "all
 * clear" checkmark, and a signal-bars motif -- same filled-flat-shape
 * character language as the Select Location page's hero illustration
 * (both now built from the same shield mark), but a quieter pose sized
 * for a hero-card corner accent rather than a full side panel, since this
 * page is a data-first "check the numbers" moment, not a "which venue"
 * moment. Kept small and semi-transparent so it never competes with the
 * three big KPI numbers already carrying this card. Replaces the earlier
 * cartoon figure, which read as consumer clip-art rather than enterprise
 * network monitoring.
 *
 * Purely decorative -- aria-hidden. The pulse sweep and "all clear" ring
 * loop, so both respect useReducedMotion.
 */
function DashboardWatchIllustration() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 300 210"
      className="h-auto w-full max-w-[260px] opacity-90"
      fill="none"
    >
      <defs>
        <filter id="watch-illo-glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="12" />
        </filter>
        <linearGradient id="watch-pulse-stroke" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#22d3ee" />
          <stop offset="100%" stopColor="#f0abfc" />
        </linearGradient>
        <linearGradient
          id="watch-shield-grad"
          x1="54"
          y1="114"
          x2="115"
          y2="190"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#7c3aed" />
        </linearGradient>
      </defs>

      <circle
        cx="215"
        cy="70"
        r="46"
        fill="#7c3aed"
        opacity="0.16"
        filter="url(#watch-illo-glow)"
      />

      <rect
        x="118"
        y="46"
        width="118"
        height="80"
        rx="10"
        fill="#241f4d"
        stroke="white"
        strokeOpacity="0.12"
        strokeWidth="1.5"
      />
      <rect
        x="118"
        y="46"
        width="118"
        height="80"
        rx="10"
        fill="url(#watch-pulse-stroke)"
        fillOpacity="0.05"
      />
      <motion.path
        d="M130 90h16l8-22 10 40 8-28 6 10h56"
        stroke="url(#watch-pulse-stroke)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        initial={shouldReduceMotion ? false : { pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 1, delay: 0.3, ease: "easeOut" }}
      />
      <rect x="164" y="126" width="26" height="10" rx="2" fill="#241f4d" />
      <rect x="150" y="136" width="54" height="5" rx="2.5" fill="white" fillOpacity="0.1" />

      <motion.g
        animate={
          shouldReduceMotion ? { opacity: 0.9 } : { scale: [1, 1.08, 1], opacity: [0.85, 1, 0.85] }
        }
        transition={
          shouldReduceMotion ? undefined : { duration: 2.4, repeat: Infinity, ease: "easeInOut" }
        }
      >
        <circle cx="228" cy="54" r="13" fill="#1e1b4b" stroke="#22d3ee" strokeWidth="2" />
        <path
          d="M222 54l4 4 8-8"
          stroke="#22d3ee"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </motion.g>

      <path
        d="M84.5 116 L112.68 127.07 V147.8 C112.68 165.69 101.25 179.6 84.5 185.5 C67.75 179.6 56.32 165.69 56.32 147.8 V127.07 Z"
        fill="url(#watch-shield-grad)"
      />
      <path
        d="M65.26 138.76a27.54 27.54 0 0 1 38.48 0"
        stroke="#ffffff"
        strokeWidth="5.45"
        strokeLinecap="round"
        fill="none"
        opacity="0.75"
      />
      <path
        d="M73.43 148.71a16.76 16.76 0 0 1 22.15 0"
        stroke="#ffffff"
        strokeWidth="5.45"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="84.5" cy="157.58" r="4.3" fill="#ffffff" />

      <g>
        {[0, 1, 2, 3].map((i) => (
          <motion.rect
            key={i}
            x={20 + i * 10}
            y={188 - (i + 1) * 9}
            width="6"
            height={(i + 1) * 9}
            rx="2"
            fill={["#8B5CF6", "#22d3ee", "#f0abfc", "#8B5CF6"][i]}
            initial={shouldReduceMotion ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.6 + i * 0.08, ease: "easeOut" }}
          />
        ))}
      </g>

      <line x1="10" y1="196" x2="250" y2="196" stroke="white" strokeOpacity="0.1" strokeWidth="1" />
    </svg>
  );
}

// ── Devices ───────────────────────────────────────────────
const DEMO_DEVICES = [
  { m: "00:1A:2B:3C:4D:5E", i: "10.0.1.42", d: "iPhone 15", fs: "Today", ls: "Just now" },
  { m: "AA:BB:CC:DD:EE:FF", i: "10.0.1.87", d: "MacBook Pro", fs: "Yesterday", ls: "2 min ago" },
  { m: "11:22:33:44:55:66", i: "10.0.2.15", d: "Galaxy S24", fs: "Today", ls: "5 min ago" },
  { m: "AB:CD:EF:01:23:45", i: "10.0.2.34", d: "iPad Air", fs: "2 days ago", ls: "1 hour ago" },
];

function ConnectedDevicesIllustration() {
  const shouldReduceMotion = useReducedMotion();
  const nodes = [
    { x: 12, y: 10, color: "#22d3ee" },
    { x: 12, y: 34, color: "#f0abfc" },
    { x: 68, y: 8, color: "#8B5CF6" },
    { x: 70, y: 36, color: "#22d3ee" },
  ];
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 84 46"
      className="hidden h-11 w-auto shrink-0 sm:block"
      fill="none"
    >
      {nodes.map((n, i) => (
        <motion.line
          key={i}
          x1="42"
          y1="23"
          x2={n.x}
          y2={n.y}
          stroke={n.color}
          strokeOpacity="0.5"
          strokeWidth="1.4"
          strokeDasharray="1 4"
          strokeLinecap="round"
          initial={shouldReduceMotion ? false : { pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.1 * i, ease: "easeOut" }}
        />
      ))}
      {nodes.map((n, i) => (
        <g key={i} transform={`translate(${n.x}, ${n.y})`}>
          <rect
            x="-6"
            y="-5"
            width="12"
            height="10"
            rx="2.5"
            fill="#2e2a5c"
            stroke={n.color}
            strokeWidth="1.3"
          />
          <circle cx="0" cy="0" r="1.4" fill={n.color} />
        </g>
      ))}
      <motion.circle
        cx="42"
        cy="23"
        r="9"
        fill="#1e1b4b"
        stroke="#6C4EFF"
        strokeWidth="2"
        animate={
          shouldReduceMotion ? { opacity: 0.9 } : { scale: [1, 1.08, 1], opacity: [0.85, 1, 0.85] }
        }
        transition={
          shouldReduceMotion ? undefined : { duration: 2.3, repeat: Infinity, ease: "easeInOut" }
        }
      />
      <path d="M38 23h8M42 19v8" stroke="#8B5CF6" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function DevicesView({ locationId, masked }: { locationId: string; masked: boolean }) {
  const { data, isLoading } = useCustomerFeatureData("devices", locationId);
  const demo = useIsDemo();
  const devices = data?.devices?.length
    ? data.devices.map((d) => ({ m: d.mac, i: d.ip, d: d.device, fs: d.firstSeen, ls: d.lastSeen }))
    : demo
      ? DEMO_DEVICES
      : [];
  return (
    <Card className="premium-card premium-card-hover">
      <CardHeader className="flex flex-row items-center justify-between gap-2.5 space-y-0">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#6C4EFF] to-[#8B5CF6]">
            <Wifi className="h-3.5 w-3.5 text-white" />
          </div>
          <CardTitle className="text-sm">Connected Devices</CardTitle>
        </div>
        <ConnectedDevicesIllustration />
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-4">
            <LoadingSkeleton rows={4} />
          </div>
        ) : devices.length === 0 ? (
          <EmptyState
            icon={Wifi}
            title="No connected devices yet"
            description="Devices that connect to this location's network will show up here."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs font-medium uppercase tracking-wide">MAC</TableHead>
                <TableHead className="text-xs font-medium uppercase tracking-wide">IP</TableHead>
                <TableHead className="text-xs font-medium uppercase tracking-wide">
                  Device
                </TableHead>
                <TableHead className="text-xs font-medium uppercase tracking-wide">
                  First Seen
                </TableHead>
                <TableHead className="text-xs font-medium uppercase tracking-wide">
                  Last Seen
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {devices.map((d) => (
                <TableRow key={d.m} className="border-b">
                  <TableCell className="font-mono text-xs">{masked ? maskMac(d.m) : d.m}</TableCell>
                  <TableCell className="font-mono text-xs">{d.i}</TableCell>
                  <TableCell>{d.d}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{d.fs}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{d.ls}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
