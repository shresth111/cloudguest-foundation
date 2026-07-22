import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Building2,
  Clock,
  Globe,
  LifeBuoy,
  MapPin,
  Router,
  Users,
  Wifi,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { LoadingSkeleton } from "@/components/common/LoadingSkeleton";
import { ComingSoonPanel } from "@/components/ui-ext/ComingSoonPanel";
import { StatusBadge } from "./StatusBadge";
import { api } from "@/services/api";
import type { Organization } from "@/types/organization";

interface Props { org: Organization; initialTab?: string }

interface BackendLocation {
  id: string;
  name: string;
  city: string;
  status: string;
}

function useOrgLocations(orgId: string) {
  return useQuery({
    queryKey: ["organizations", orgId, "locations"],
    queryFn: async () => {
      const { data } = await api.get<{ items: BackendLocation[]; total_items: number }>(
        `/organizations/${orgId}/locations`,
        { params: { page_size: 50 }, headers: { "X-Organization-Id": orgId } },
      );
      return data;
    },
  });
}

export function OrganizationDetailTabs({ org, initialTab = "overview" }: Props) {
  const [tab, setTab] = useState(initialTab);
  const locations = useOrgLocations(org.id);

  return (
    <Tabs value={tab} onValueChange={setTab} className="space-y-6">
      <div className="overflow-x-auto">
        <TabsList className="h-auto flex-wrap gap-1 bg-muted/40 p-1">
          {[
            ["overview", "Overview"],
            ["locations", "Locations"],
            ["routers", "Routers"],
            ["users", "Users"],
            ["wifi", "Guest WiFi"],
            ["portal", "Captive Portal"],
            ["analytics", "Analytics"],
            ["billing", "Billing"],
            ["audit", "Audit Logs"],
            ["support", "Support Tickets"],
          ].map(([k, l]) => (
            <TabsTrigger key={k} value={k} className="rounded-lg px-3 py-1.5 text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm">
              {l}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>

      <TabsContent value="overview" className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-2">
          <Card className="rounded-2xl border-border/70 shadow-sm">
            <CardContent className="flex flex-col gap-3 p-4">
              <div className="grid h-9 w-9 place-items-center rounded-lg text-indigo-500 bg-indigo-500/10">
                <MapPin className="h-4 w-4" />
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Locations</div>
                <div className="text-2xl font-semibold tabular-nums">
                  {locations.isLoading ? "—" : locations.data?.total_items ?? 0}
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-border/70 shadow-sm">
            <CardContent className="flex flex-col gap-3 p-4">
              <div className="grid h-9 w-9 place-items-center rounded-lg text-emerald-500 bg-emerald-500/10">
                <Building2 className="h-4 w-4" />
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Subscription</div>
                <div className="text-2xl font-semibold capitalize">{org.subscriptionTier ?? "—"}</div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="rounded-2xl border-border/70 shadow-sm lg:col-span-2">
            <CardHeader><CardTitle className="text-base">Company profile</CardTitle></CardHeader>
            <CardContent className="grid gap-4 text-sm sm:grid-cols-2">
              <Field label="Legal name" value={org.legalName ?? "—"} />
              <Field label="Organization type" value={org.orgType} />
              <Field label="Timezone" value={org.timezone} />
              <Field label="Default locale" value={org.defaultLocale} />
              <Field label="Created" value={new Date(org.createdAt).toLocaleDateString()} icon={Clock} />
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-border/70 shadow-sm">
            <CardHeader><CardTitle className="text-base">Contact</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Field label="Email" value={org.contactEmail} />
              <Field label="Phone" value={org.contactPhone ?? "—"} />
            </CardContent>
          </Card>
        </div>

        <Card className="rounded-2xl border-border/70 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Subscription</CardTitle>
            <StatusBadge status={org.status} />
          </CardHeader>
          <CardContent className="grid gap-4 text-sm sm:grid-cols-2">
            <Field label="Tier" value={org.subscriptionTier ?? "—"} />
            <Field label="Status" value={org.status} />
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="locations">
        {locations.isLoading ? (
          <LoadingSkeleton rows={4} />
        ) : locations.isError ? (
          <ErrorState onRetry={() => locations.refetch()} />
        ) : !locations.data?.items.length ? (
          <EmptyState icon={MapPin} title="No locations yet" />
        ) : (
          <Card className="overflow-hidden rounded-2xl border-border/70 shadow-sm">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead>Name</TableHead>
                  <TableHead>City</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {locations.data.items.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell>{l.name}</TableCell>
                    <TableCell>{l.city}</TableCell>
                    <TableCell><span className="capitalize">{l.status}</span></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </TabsContent>
      <TabsContent value="routers">
        <ComingSoonPanel
          icon={Router}
          title="Routers"
          description="Per-organization router inventory rolls out once the router domain is wired into this console."
        />
      </TabsContent>
      <TabsContent value="users">
        <EmptyState icon={Users} title="No user accounts yet" description="Users invited to this organization will appear here." />
      </TabsContent>
      <TabsContent value="wifi">
        <EmptyState icon={Wifi} title="Guest WiFi networks" description="Configure SSIDs, VLANs and bandwidth policies for this tenant." />
      </TabsContent>
      <TabsContent value="portal">
        <EmptyState icon={Globe} title="Captive portal" description="Customize splash pages, auth methods and legal notices." />
      </TabsContent>
      <TabsContent value="analytics">
        <EmptyState icon={Building2} title="Analytics coming soon" description="Guest, session and revenue trends will render here." />
      </TabsContent>
      <TabsContent value="billing">
        <ComingSoonPanel
          icon={Building2}
          title="Billing"
          description="Invoices and payment history roll out once this console is wired to the Billing domain."
        />
      </TabsContent>
      <TabsContent value="audit">
        <ComingSoonPanel
          icon={Building2}
          title="Audit logs"
          description="A per-organization audit trail rolls out once this console is wired to the Audit Log domain."
        />
      </TabsContent>
      <TabsContent value="support">
        <EmptyState icon={LifeBuoy} title="No support tickets" description="Tickets raised by this organization will show up here." />
      </TabsContent>
    </Tabs>
  );
}

function Field({ label, value, icon: Icon }: { label: string; value: string; icon?: typeof Globe }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 flex items-center gap-2 text-sm text-foreground capitalize">
        {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" />}
        <span className="truncate">{value}</span>
      </div>
    </div>
  );
}
