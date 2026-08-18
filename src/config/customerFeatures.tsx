/**
 * Render registry for customer features. Maps a feature id (from the pure
 * data catalog) to its view. Shared by the customer owner dashboard, the
 * owner's Agent permission manager, and the agent dynamic dashboard.
 */
import type { ReactNode } from "react";

import { CampaignsPage } from "@/components/features/CampaignsPage";
import { VouchersPage } from "@/components/features/VouchersPage";
import { PortalPage } from "@/components/features/PortalPage";
import PoliciesHub from "@/components/features/PoliciesHub";
import { AdvancedPage } from "@/components/features/FeatureComponents";
import ManageTeamsPage from "@/components/features/ManageTeamsPage";
import WhiteList from "@/components/features/WhiteList";
import UserReports from "@/components/features/UserReports";
import NetworkActivityLog from "@/components/features/NetworkActivityLog";
import { AgentsPage } from "@/components/features/AgentsPage";
import TicketsPage from "@/components/features/TicketsPage";
import BrandAssetPage from "@/components/features/BrandAssetPage";
import {
  AlertsView, OpenHoursView, NotificationView, IspDetailsView,
  AdminLogsView, MacAuthView, PortForwardingView, DhcpView, VlansView, VoipView,
  DebuggingView, HotspotView, GenericFeatureView,
} from "@/components/features/OperationsFeatures";
import {
  BasicDashboardView, BasicUsersView, BasicDevicesView, BasicAuditView, NetworkHardwareView,
} from "@/components/customer/BasicFeatureViews";

export {
  FEATURE_GROUPS, ALL_FEATURES, FEATURE_BY_ID, CORE_FEATURE_IDS,
} from "@/config/customerFeatureCatalog";
export type { FeatureDef } from "@/config/customerFeatureCatalog";

/** Render a feature by id. `locationId` is threaded to views that need it.
 * `masked` is the viewing agent's per-agent data-masking setting (see
 * AgentsPage.tsx's "Data masking" switch / agentPermissionStore's
 * `AgentRecord.dataMasking`) -- threaded to whichever views actually show
 * guest PII (email/phone) so the switch has a real, visible effect on the
 * `/agent` staff-preview dashboard that renders through here. Omitted
 * (`undefined`) callers get each view's own safer-by-default fallback. */
export function renderFeature(id: string, ctx: { locationId?: string; masked?: boolean } = {}): ReactNode {
  switch (id) {
    case "dashboard": return <BasicDashboardView locationId={ctx.locationId} masked={ctx.masked} />;
    case "users": return <BasicUsersView masked={ctx.masked} />;
    case "devices": return <div className="space-y-4"><NetworkHardwareView locationId={ctx.locationId} /><BasicDevicesView /></div>;
    case "audit": return <BasicAuditView masked={ctx.masked} />;
    case "tickets": return <TicketsPage locationId={ctx.locationId} />;
    case "reports": return <UserReports masked={ctx.masked} />;
    case "campaigns": return <CampaignsPage locationId={ctx.locationId} />;
    case "portal": return <PortalPage locationId={ctx.locationId} />;
    case "vouchers": return <VouchersPage locationId={ctx.locationId} />;
    case "policies": return <PoliciesHub locationId={ctx.locationId} />;
    case "whitelist": return <WhiteList locationId={ctx.locationId} />;
    case "teams": return <ManageTeamsPage locationId={ctx.locationId} />;
    case "agents": return <AgentsPage />;
    case "advanced": return <AdvancedPage />;
    case "alerts": return <AlertsView />;
    case "business-hours": return <OpenHoursView locationId={ctx.locationId} />;
    case "background-image": return <BrandAssetPage title="Background Image" description="Set a customized background image on the login screen for a complete branding experience." tableTitle="Current Background Images" tableSubtitle="This shows you a quick snapshot of all the Background Images setup." aspect="wide" />;
    case "notification": return <NotificationView />;
    case "isp-details": return <IspDetailsView />;
    case "admin-logs": return <AdminLogsView />;
    case "network-activity": return <NetworkActivityLog masked={ctx.masked} />;
    case "mac-auth": return <MacAuthView locationId={ctx.locationId} />;
    case "port-forwarding": return <PortForwardingView locationId={ctx.locationId} />;
    case "dhcp": return <DhcpView locationId={ctx.locationId} />;
    case "vlans": return <VlansView locationId={ctx.locationId} />;
    case "voip": return <VoipView locationId={ctx.locationId} />;
    case "debugging": return <DebuggingView />;
    case "hotspot": return <HotspotView locationId={ctx.locationId} />;
    default: return <GenericFeatureView feature={id} />;
  }
}
