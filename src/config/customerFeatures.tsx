import { Suspense, type ReactNode } from "react";
import { lazyView } from "@/lib/lazy-view";

/**
 * Every feature page is loaded on demand, not up front.
 *
 * This registry used to import all of them statically. Because
 * `customerNav.ts` imports this module and is itself reachable from the
 * eagerly-built route graph (`routeTree.gen.ts` statically imports all 180
 * routes), that put the entire feature set into the initial bundle --
 * including `OperationsFeatures` at 446 kB, `PortalShell` at 153 kB and
 * `RouterDetailTabs` at 142 kB, none of which a venue owner opens on the
 * way to a login form.
 *
 * Measured before this change: the entry chunk referenced 290 chunks, and
 * demo.wyfyguest.com fetched 43 of them before the sign-in form painted.
 * That gap is the white screen.
 *
 * Note the two barrel modules below: pulling one view out of
 * `OperationsFeatures` still fetches that whole chunk, because it is one
 * module. That is fine here -- the point is that it is fetched when a
 * feature is opened rather than on every first paint. Splitting the barrel
 * itself is a separate, larger change.
 */
const ops = () => import("@/components/features/OperationsFeatures");
const basic = () => import("@/components/customer/BasicFeatureViews");

const CampaignsPage = lazyView(
  () => import("@/components/features/CampaignsPage"),
  "CampaignsPage",
);
const VouchersPage = lazyView(() => import("@/components/features/VouchersPage"), "VouchersPage");
const PortalPage = lazyView(() => import("@/components/features/PortalPage"), "PortalPage");
const PoliciesHub = lazyView(() => import("@/components/features/PoliciesHub"), "default");
const AdvancedPage = lazyView(
  () => import("@/components/features/FeatureComponents"),
  "AdvancedPage",
);
const ManageTeamsPage = lazyView(() => import("@/components/features/ManageTeamsPage"), "default");
const WhiteList = lazyView(() => import("@/components/features/WhiteList"), "default");
const UserReports = lazyView(() => import("@/components/features/UserReports"), "default");
const NetworkActivityLog = lazyView(
  () => import("@/components/features/NetworkActivityLog"),
  "default",
);
const AgentsPage = lazyView(() => import("@/components/features/AgentsPage"), "AgentsPage");
const TicketsPage = lazyView(() => import("@/components/features/TicketsPage"), "default");
const DeviceHealthTrafficView = lazyView(
  () => import("@/components/customer/DeviceHealthTrafficView"),
  "DeviceHealthTrafficView",
);

const AlertsView = lazyView(ops, "AlertsView");
const OpenHoursView = lazyView(ops, "OpenHoursView");
const IspDetailsView = lazyView(ops, "IspDetailsView");
const AdminLogsView = lazyView(ops, "AdminLogsView");
const MacAuthView = lazyView(ops, "MacAuthView");
const PortForwardingView = lazyView(ops, "PortForwardingView");
const DhcpView = lazyView(ops, "DhcpView");
const VlansView = lazyView(ops, "VlansView");
const VoipView = lazyView(ops, "VoipView");
const DebuggingView = lazyView(ops, "DebuggingView");
const HotspotView = lazyView(ops, "HotspotView");
const GenericFeatureView = lazyView(ops, "GenericFeatureView");

const BasicDashboardView = lazyView(basic, "BasicDashboardView");
const BasicUsersView = lazyView(basic, "BasicUsersView");
const BasicDevicesView = lazyView(basic, "BasicDevicesView");
const BasicAuditView = lazyView(basic, "BasicAuditView");
const NetworkHardwareView = lazyView(basic, "NetworkHardwareView");

/** Shown while a feature's chunk is in flight. */
function FeatureLoading() {
  return (
    <div className="flex min-h-[240px] items-center justify-center">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}

export {
  FEATURE_GROUPS,
  ALL_FEATURES,
  FEATURE_BY_ID,
  CORE_FEATURE_IDS,
} from "@/config/customerFeatureCatalog";
export type { FeatureDef } from "@/config/customerFeatureCatalog";

/** Render a feature by id. `locationId` is threaded to views that need it.
 * `masked` is the viewing agent's per-agent data-masking setting (see
 * AgentsPage.tsx's "Data masking" switch / agentPermissionStore's
 * `AgentRecord.dataMasking`) -- threaded to whichever views actually show
 * guest PII (email/phone) so the switch has a real, visible effect on the
 * `/agent` staff-preview dashboard that renders through here. Omitted
 * (`undefined`) callers get each view's own safer-by-default fallback. */
export function renderFeature(
  id: string,
  ctx: { locationId?: string; masked?: boolean } = {},
): ReactNode {
  return <Suspense fallback={<FeatureLoading />}>{featureElement(id, ctx)}</Suspense>;
}

function featureElement(id: string, ctx: { locationId?: string; masked?: boolean }): ReactNode {
  switch (id) {
    case "dashboard":
      return <BasicDashboardView locationId={ctx.locationId} masked={ctx.masked} />;
    case "users":
      return <BasicUsersView masked={ctx.masked} />;
    case "devices":
      return (
        <div className="space-y-4">
          <NetworkHardwareView locationId={ctx.locationId} />
          {/* Same surface as the owner's /devices page. This path passes
              no locationId, and the view renders its own honest "pick a
              venue" state rather than an empty chart. */}
          <DeviceHealthTrafficView locationId={ctx.locationId} />
          <BasicDevicesView />
        </div>
      );
    case "audit":
      return <BasicAuditView masked={ctx.masked} />;
    case "tickets":
      return <TicketsPage locationId={ctx.locationId} />;
    case "reports":
      return <UserReports masked={ctx.masked} />;
    case "campaigns":
      return <CampaignsPage locationId={ctx.locationId} />;
    case "portal":
      return <PortalPage locationId={ctx.locationId} />;
    case "vouchers":
      return <VouchersPage locationId={ctx.locationId} />;
    case "policies":
      return <PoliciesHub locationId={ctx.locationId} />;
    case "whitelist":
      return <WhiteList locationId={ctx.locationId} />;
    case "teams":
      return <ManageTeamsPage locationId={ctx.locationId} />;
    case "agents":
      return <AgentsPage />;
    case "advanced":
      return <AdvancedPage />;
    case "alerts":
      return <AlertsView />;
    case "business-hours":
      return <OpenHoursView locationId={ctx.locationId} />;
    case "isp-details":
      return <IspDetailsView />;
    case "admin-logs":
      return <AdminLogsView />;
    case "network-activity":
      return <NetworkActivityLog masked={ctx.masked} />;
    case "mac-auth":
      return <MacAuthView locationId={ctx.locationId} />;
    case "port-forwarding":
      return <PortForwardingView locationId={ctx.locationId} />;
    case "dhcp":
      return <DhcpView locationId={ctx.locationId} />;
    case "vlans":
      return <VlansView locationId={ctx.locationId} />;
    case "voip":
      return <VoipView locationId={ctx.locationId} />;
    case "debugging":
      return <DebuggingView />;
    case "hotspot":
      return <HotspotView locationId={ctx.locationId} />;
    default:
      return <GenericFeatureView feature={id} />;
  }
}
