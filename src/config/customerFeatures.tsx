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
import { AgentsPage } from "@/components/features/AgentsPage";
import TicketsPage from "@/components/features/TicketsPage";
import BrandAssetPage from "@/components/features/BrandAssetPage";
import {
  AlertsView, BusinessHoursView, NotificationView, IspDetailsView,
  AdminLogsView, MacAuthView, PortForwardingView, DhcpView, VlansView, VoipView,
  IspRoutingView, DebuggingView, HotspotView, GenericFeatureView,
} from "@/components/features/OperationsFeatures";
import {
  BasicDashboardView, BasicUsersView, BasicDevicesView, BasicAuditView,
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
    case "devices": return <BasicDevicesView />;
    case "audit": return <BasicAuditView />;
    case "tickets": return <TicketsPage />;
    case "reports": return <UserReports />;
    case "campaigns": return <CampaignsPage />;
    case "portal": return <PortalPage />;
    case "vouchers": return <VouchersPage />;
    case "policies": return <PoliciesHub />;
    case "whitelist": return <WhiteList />;
    case "teams": return <ManageTeamsPage />;
    case "agents": return <AgentsPage />;
    case "networking": return <NetworkingPage />;
    case "advanced": return <AdvancedPage />;
    case "alerts": return <AlertsView />;
    case "business-hours": return <BusinessHoursView />;
    case "background-image": return <BrandAssetPage title="Background Image" description="Set a customized background image on the login screen for a complete branding experience." tableTitle="Current Background Images" tableSubtitle="This shows you a quick snapshot of all the Background Images setup." aspect="wide" />;
    case "notification": return <NotificationView />;
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
    default: return <GenericFeatureView feature={id} />;
  }
}
