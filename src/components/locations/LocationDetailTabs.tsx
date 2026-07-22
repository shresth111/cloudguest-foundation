import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  BarChart3,
  Building2,
  Gauge,
  Globe,
  MapPin,
  Router,
  ScrollText,
  ShieldCheck,
  Users,
  Wifi,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/common/EmptyState";
import { ComingSoonPanel } from "@/components/ui-ext/ComingSoonPanel";
import { NasDevicesPanel } from "./NasDevicesPanel";
import { api } from "@/services/api";
import type { Location } from "@/types/location";
import { LocationStatusBadge, SiteTypeBadge } from "./LocationStatusBadge";
import { usePermissions } from "@/hooks/usePermissions";
import type { ModuleId } from "@/types/permissions";
import { Lock } from "lucide-react";

interface Props {
  location: Location;
  initialTab?: string;
}

type TabDef = { key: string; label: string; module?: ModuleId };

const TABS: TabDef[] = [
  { key: "overview", label: "Overview" },
  { key: "nas", label: "NAS Devices", module: "nas-management" },
  { key: "routers", label: "Routers", module: "routers" },
  { key: "wifi", label: "Guest WiFi", module: "guests" },
  { key: "portal", label: "Captive Portal", module: "captive-portal" },
  { key: "voucher", label: "Voucher", module: "voucher-master" },
  { key: "guests", label: "Guests", module: "guests-live" },
  { key: "monitoring", label: "Monitoring", module: "monitoring" },
  { key: "analytics", label: "Analytics", module: "analytics" },
  { key: "bandwidth", label: "Bandwidth", module: "policy-bandwidth" },
  { key: "billing", label: "Billing", module: "billing" },
  { key: "audit", label: "Audit Logs", module: "audit" },
];

interface BackendOverview {
  router_count: number;
  connected_device_count: number;
  vlan_count: number;
  campaign_count: number;
  audit_log_count: number;
}

function useLocationOverview(locationId: string) {
  return useQuery({
    queryKey: ["locations", locationId, "overview"],
    queryFn: async () => {
      const { data } = await api.get<BackendOverview>(`/locations/${locationId}/overview`);
      return data;
    },
  });
}

export function LocationDetailTabs({ location, initialTab = "overview" }: Props) {
  const { can, isLocked } = usePermissions();
  const visibleTabs = TABS.filter((t) => !t.module || can(t.module, "view") || isLocked(t.module));
  const allowedKeys = new Set(visibleTabs.map((t) => t.key));
  const activeTab = allowedKeys.has(initialTab) ? initialTab : "overview";
  const [tab, setTab] = useState(activeTab);
  const overview = useLocationOverview(location.id);

  return (
    <Tabs value={tab} onValueChange={setTab} className="space-y-6">
      <div className="overflow-x-auto">
        <TabsList className="h-auto flex-wrap gap-1 bg-muted/40 p-1">
          {visibleTabs.map((t) => {
            const locked = t.module ? isLocked(t.module) && !can(t.module, "view") : false;
            return (
              <TabsTrigger
                key={t.key}
                value={t.key}
                disabled={locked}
                title={locked ? "Access restricted. Contact your Administrator." : undefined}
                className="rounded-lg px-3 py-1.5 text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm"
              >
                {locked && <Lock className="mr-1.5 h-3 w-3" />}
                {t.label}
              </TabsTrigger>
            );
          })}
        </TabsList>
      </div>

      <TabsContent value="overview" className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi icon={Router} tone="text-emerald-500 bg-emerald-500/10" label="Routers" value={overview.data?.router_count} />
          <Kpi icon={Users} tone="text-indigo-500 bg-indigo-500/10" label="Connected devices" value={overview.data?.connected_device_count} />
          <Kpi icon={Activity} tone="text-sky-500 bg-sky-500/10" label="VLANs" value={overview.data?.vlan_count} />
          <Kpi icon={ScrollText} tone="text-amber-500 bg-amber-500/10" label="Audit entries" value={overview.data?.audit_log_count} />
        </div>

        <Card className="rounded-2xl border-border/70 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Location profile</CardTitle>
            <div className="flex items-center gap-2">
              <SiteTypeBadge type={location.propertyType} />
              <LocationStatusBadge status={location.status} />
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm sm:grid-cols-2">
            <Field label="Organization" value={location.organizationName} icon={Building2} />
            <Field label="Location code" value={location.locationCode ?? "—"} />
            <Field
              label="Address"
              value={`${location.addressLine1}, ${location.city}, ${location.stateProvince}, ${location.country} ${location.postalCode}`}
              full
              icon={MapPin}
            />
            <Field label="Timezone" value={location.timezone} />
            <Field
              label="Coordinates"
              value={location.latitude != null && location.longitude != null ? `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}` : "—"}
            />
            <Field label="Created" value={new Date(location.createdAt).toLocaleDateString()} />
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="nas">
        <NasDevicesPanel locationId={location.id} />
      </TabsContent>
      <TabsContent value="routers">
        <ComingSoonPanel icon={Router} title="Routers" description="Per-location router inventory rolls out once the router domain is wired into this console." />
      </TabsContent>
      <TabsContent value="voucher">
        <EmptyState icon={Wifi} title="Voucher batches" description="Prepaid access codes for this location will render here — scoped per NAS." />
      </TabsContent>
      <TabsContent value="wifi">
        <EmptyState icon={Wifi} title="No WiFi networks configured" description="SSIDs, VLANs and bandwidth policies will show up here." />
      </TabsContent>
      <TabsContent value="guests">
        <EmptyState icon={Users} title="No connected guests" description="Active guest sessions will appear here in real time." />
      </TabsContent>
      <TabsContent value="portal">
        <EmptyState icon={Globe} title="Captive portal" description="Customize splash pages, auth methods and legal notices." />
      </TabsContent>
      <TabsContent value="monitoring">
        <EmptyState icon={ShieldCheck} title="Live monitoring" description="Real-time router and WAN health streams will render here." />
      </TabsContent>
      <TabsContent value="analytics">
        <EmptyState icon={BarChart3} title="Analytics coming soon" description="Guest, session and revenue trends will render here." />
      </TabsContent>
      <TabsContent value="bandwidth">
        <EmptyState icon={Gauge} title="Bandwidth insights" description="Per-SSID and per-guest bandwidth breakdown coming soon." />
      </TabsContent>
      <TabsContent value="billing">
        <ComingSoonPanel icon={Building2} title="Billing" description="Invoices and payment history roll out once this console is wired to the Billing domain." />
      </TabsContent>
      <TabsContent value="audit">
        <ComingSoonPanel icon={ScrollText} title="Audit logs" description="A per-location audit trail rolls out once this console is wired to the Audit Log domain." />
      </TabsContent>
    </Tabs>
  );
}

function Kpi({ icon: Icon, tone, label, value }: { icon: typeof Router; tone: string; label: string; value: number | undefined }) {
  return (
    <Card className="rounded-2xl border-border/70 shadow-sm">
      <CardContent className="flex flex-col gap-3 p-4">
        <div className={`grid h-9 w-9 place-items-center rounded-lg ${tone}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="text-2xl font-semibold tabular-nums">{value ?? "—"}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  value,
  icon: Icon,
  full,
}: {
  label: string;
  value: string;
  icon?: typeof Globe;
  full?: boolean;
}) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 flex items-center gap-2 text-sm text-foreground">
        {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" />}
        <span className="truncate">{value}</span>
      </div>
    </div>
  );
}
