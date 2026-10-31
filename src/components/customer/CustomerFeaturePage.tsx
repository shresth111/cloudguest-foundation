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
import { resolveMarketingScope } from "@/lib/marketing-scope";
import { resolveActiveOrganizationId } from "@/services/api";
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
import { locationControllerVendor, locationIsControllerManaged } from "@/lib/location-liveness";
import { featureAppliesToControllerVenue } from "@/lib/router-vendors";
import { ControllerManagedFeatureNotice } from "@/components/customer/ControllerManagedFeatureNotice";
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
const ConnectedDevicesPanel = lazyView(
  () => import("@/components/customer/devices/ConnectedDevicesPanel"),
  "ConnectedDevicesPanel",
);
import {
  SectionBoundary,
  SectionFailed,
} from "@/components/customer/dashboard/overview/console-ui";
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
const DebuggingView = lazyView(OPS, "DebuggingView");
const HotspotView = lazyView(OPS, "HotspotView");
const GenericFeatureView = lazyView(OPS, "GenericFeatureView");
// Its own module rather than a member of the OperationsFeatures barrel -- this
// page reads nothing from that chunk, and the barrel is the single largest
// thing in the build (see the note above), so adding to it for a page that
// needs none of it would make opening Security fetch it.
const SECURITY = () => import("@/components/security/SecurityOverviewView");
const SecurityOverviewView = lazyView(SECURITY, "SecurityOverviewView");
// Same reasoning: its own module, and it mounts the Website Blocking screen
// straight from components/network rather than through the ops barrel.
const BlockingView = lazyView(() => import("@/components/security/BlockingView"), "BlockingView");
// The Marketing add-on. Its own module, lazily fetched, for the same reason
// as Security and Blocking above: nothing on the way to first paint needs
// it (wyfy-specs/guest-marketing-campaigns.md §8.1).
const MarketingView = lazyView(
  () => import("@/components/marketing/MarketingView"),
  "MarketingView",
);
const FirewallView = lazyView(() => import("@/components/security/FirewallView"), "FirewallView");
// Traffic Lens (paid add-on). Its own lazily fetched module, like Marketing.
const TrafficLensView = lazyView(
  () => import("@/components/traffic-lens/TrafficLensView"),
  "TrafficLensView",
);
// NetLogs. Its own lazily fetched module, like Traffic Lens; its charts are a
// further lazy chunk inside it, so recharts is not fetched until one draws.
const NetLogsView = lazyView(() => import("@/components/netlogs/NetLogsView"), "NetLogsView");
/** Not part of the OperationsFeatures barrel -- its own module, so opening
 * "Network Integrations" fetches only the Omada connect wizard and its
 * service layer rather than the whole 446 kB ops chunk. Lazy for the same
 * reason everything else on this shell is: `routeTree.gen.ts` statically
 * imports every route, so a static import anywhere in this component tree is
 * a chunk the browser fetches before first paint. */
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
  const { user, logout, roles } = useAuth();
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

  // Contract §11.5, customer side. The Network-group screens below are
  // RouterOS writes, and at a venue whose only router is a vendor controller
  // there is no RouterOS to write to -- the backend refuses, but not until
  // the owner has filled in the form.
  //
  // Read off the active venue's liveness, which is where the vendor already
  // is: `deriveRouterLiveness` assigns `state: "not-applicable"` to a
  // controller row, and `locationIsControllerManaged` is `every`, not
  // `some`, so a venue with a MikroTik alongside the controller keeps all
  // five screens -- they act on the MikroTik and they work. A venue whose
  // routers could not be read keeps them too. A MikroTik-only venue can
  // never reach this branch at all.
  //
  // The vendor STRING is read separately and is allowed to be null (a venue
  // summary persisted before `RouterLiveness` carried one). The gate is the
  // boolean; the vendor only decides whether the copy can name a brand.
  const controllerGated =
    locationIsControllerManaged(activeLocation?.liveness) &&
    !featureAppliesToControllerVenue(feature, locationControllerVendor(activeLocation?.liveness));
  const controllerVendor = locationControllerVendor(activeLocation?.liveness);

  const handleLogout = async () => {
    await logout();
    navigate({ to: "/login", replace: true });
  };
  const handleSwitchLocation = () => {
    navigate({ to: "/switch-location" });
  };

  return (
    // `wy-console` scopes the console tokens (styles.css,
    // docs/design/console-tokens.md) to the whole shell. It also re-points
    // `--primary`/`--ring` at the console accent, which replaces the inline
    // `#6C4EFF` override this wrapper used to carry for the same purpose.
    <SidebarProvider className="wy-console bg-[var(--wy-bg)]">
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
        {/* No `title`: the page name is the header's breadcrumb, read from
            the same CUSTOMER_NAVS list the palette and the page scope line
            read, so it can never show a retired technical name. */}
        <CustomerHeader
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
            {/* Marketing is organisation-wide for an org-scoped caller (no
                X-Location-Id; lists and campaigns span every venue), so the
                scope line says so instead of naming the venue in the top bar.
                Decided from the real role assignments, not the login radio --
                see lib/marketing-scope.ts. */}
            <CustomerPageScope
              featureId={feature}
              locationName={
                // NetLogs names its scope in its own Location filter (which
                // can read "All locations"), so the line does not repeat a
                // venue the filter may have moved away from.
                feature === "netlogs"
                  ? undefined
                  : feature === "marketing" &&
                      resolveMarketingScope(roles, resolveActiveOrganizationId(), activeLocationId)
                        .kind === "organization"
                    ? "All venues"
                    : activeLocation?.name
              }
            />
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
              {/* Allow-list and Trusted Devices are live everywhere except a
                  NAS-only venue (Aruba Instant On), where `controllerGated`
                  is true for them and the notice below renders instead. */}
              {feature === "whitelist" && !controllerGated && <WhiteList locationId={locationId} />}
              {feature === "devices" && (
                // Fleet strip + inventory, then how the hardware has been
                // performing, then the guest devices connected to it. Each
                // section fails on its own (SectionBoundary), never the page.
                <div className="space-y-6">
                  <SectionBoundary name="devices-hardware" fallback={devicesSectionFailed}>
                    <NetworkHardwareView locationId={locationId} />
                  </SectionBoundary>
                  <SectionBoundary name="devices-traffic" fallback={devicesSectionFailed}>
                    <DeviceHealthTrafficView locationId={locationId} />
                  </SectionBoundary>
                  <SectionBoundary name="devices-connected" fallback={devicesSectionFailed}>
                    <ConnectedDevicesPanel locationId={locationId} masked={masked} />
                  </SectionBoundary>
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
              {/* No "network-integrations" branch -- FIX-PLAN FE-0. Backend
                  `074d719` moved every `network_integrations.*` route to
                  ScopeType.GLOBAL and `rbac.seed`'s RETIRED_NON_GLOBAL_MODULES
                  dropped the org-scoped grants, so this page 403s on every
                  call for a venue owner. Its route, nav row and catalog entry
                  are gone with it; the component stays because it is the
                  console's only complete connect flow and is moving to the
                  Master console (FE-0 step 3, not done here). */}
              {feature === "admin-logs" && <AdminLogsView locationId={locationId} />}
              {feature === "network-activity" && <NetworkActivityLog masked={masked} />}
              {feature === "netlogs" && <NetLogsView locationId={locationId} />}
              {feature === "mac-auth" && !controllerGated && (
                <MacAuthView locationId={locationId} />
              )}
              {/* The RouterOS screens. On a controller-managed venue
                  the view is NOT MOUNTED -- this is not a disabled form over
                  a live one. Each of these components fetches its own rules
                  on mount and offers Add/Edit/Apply, and a form that submits
                  into a typed backend refusal is the defect being fixed; a
                  greyed-out copy of it, still fetching, would be the same
                  defect with worse manners. What replaces it says which
                  controller owns the setting and links to it. */}
              {controllerGated ? (
                <ControllerManagedFeatureNotice
                  featureId={feature}
                  featureLabel={CUSTOMER_NAVS.find((n) => n.id === feature)?.label ?? feature}
                  venueName={activeLocation?.name ?? null}
                  vendor={controllerVendor}
                />
              ) : (
                <>
                  {feature === "port-forwarding" && <PortForwardingView locationId={locationId} />}
                  {feature === "dhcp" && <DhcpView locationId={locationId} />}
                  {feature === "vlans" && <VlansView locationId={locationId} />}
                  {feature === "voip" && <VoipView locationId={locationId} />}
                  {/* Security -> Firewall writes the venue's MikroTik, so it
                      sits behind the same gate as the Network screens. */}
                  {feature === "firewall" && <FirewallView locationId={locationId} />}
                  {/* No "website-blocking" or "web-filtering" branch: both
                      are the "Websites" tab of Security -> Block Websites
                      now, which applies this same controller gate to that
                      one tab (see BlockingView), and both old addresses
                      redirect there. */}
                </>
              )}
              {/* `masked` matters here now: this page looks a guest up by
                  phone number, so it renders an identifier the account
                  holder's own masking preference applies to. */}
              {feature === "security" && <SecurityOverviewView />}
              {feature === "blocking" && <BlockingView locationId={locationId} syncWithUrl />}
              {feature === "marketing" && <MarketingView locationId={locationId} syncWithUrl />}
              {/* Not behind the controller gate above: the view shows its own
                  "not available at this venue" from the backend's answer, and
                  the lock screen has to show at any venue. */}
              {feature === "traffic-lens" && <TrafficLensView locationId={locationId} />}
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
// The Devices page's sections live in `@/components/customer/devices/`
// (and NetworkHardwareView / DeviceHealthTrafficView). This is only the
// fallback a section shows if it fails to render.
const devicesSectionFailed = (
  <SectionFailed
    title="This section couldn't be shown"
    body="The rest of the page is unaffected. Reload to try again."
  />
);
