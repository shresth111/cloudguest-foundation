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
import { TeamsPage, NetworkingPage, AdvancedPage } from "@/components/features/FeatureComponents";
import WhiteList from "@/components/features/WhiteList";
import UserReports from "@/components/features/UserReports";
import { AgentsPage } from "@/components/features/AgentsPage";
import {
  AlertsView, BusinessHoursView, NotificationView, TopUpView, IspDetailsView,
  AdminLogsView, MacAuthView, PortForwardingView, DhcpView, VlansView, VoipView,
  IspRoutingView, DebuggingView, HotspotView, RaasDashboardView, RaasUsersView,
  RaasReportsView, GenericFeatureView,
} from "@/components/features/OperationsFeatures";
import {
  BasicDashboardView, BasicUsersView, BasicAnalyticsView, BasicDevicesView,
  BasicAuditView, BasicHelpView,
} from "@/components/customer/BasicFeatureViews";

export {
  FEATURE_GROUPS, ALL_FEATURES, FEATURE_BY_ID, CORE_FEATURE_IDS,
} from "@/config/customerFeatureCatalog";
export type { FeatureDef } from "@/config/customerFeatureCatalog";

/** Render a feature by id. `locationId` is threaded to views that need it. */
export function renderFeature(id: string, ctx: { locationId?: string } = {}): ReactNode {
  switch (id) {
    case "dashboard": return <BasicDashboardView locationId={ctx.locationId} />;
    case "users": return <BasicUsersView />;
    case "analytics": return <BasicAnalyticsView />;
    case "devices": return <BasicDevicesView />;
    case "audit": return <BasicAuditView />;
    case "help": return <BasicHelpView />;
    case "reports": return <UserReports />;
    case "campaigns": return <CampaignsPage />;
    case "portal": return <PortalPage />;
    case "vouchers": return <VouchersPage />;
    case "policies": return <PoliciesHub />;
    case "whitelist": return <WhiteList />;
    case "teams": return <TeamsPage />;
    case "agents": return <AgentsPage />;
    case "networking": return <NetworkingPage />;
    case "advanced": return <AdvancedPage />;
    case "alerts": return <AlertsView />;
    case "business-hours": return <BusinessHoursView />;
    case "notification": return <NotificationView />;
    case "topup": return <TopUpView />;
    case "isp-details": return <IspDetailsView />;
    case "admin-logs": return <AdminLogsView />;
    case "mac-auth": return <MacAuthView />;
    case "port-forwarding": return <PortForwardingView />;
    case "dhcp": return <DhcpView />;
    case "vlans": return <VlansView />;
    case "voip": return <VoipView />;
    case "isp-routing": return <IspRoutingView />;
    case "debugging": return <DebuggingView />;
    case "hotspot": return <HotspotView />;
    case "raas-dashboard": return <RaasDashboardView />;
    case "raas-users": return <RaasUsersView />;
    case "raas-reports": return <RaasReportsView />;
    default: return <GenericFeatureView feature={id} />;
  }
}
