import { useState } from "react";
import {
  Activity,
  Building2,
  Clock,
  CreditCard,
  DollarSign,
  FileText,
  Globe,
  LifeBuoy,
  MapPin,
  Router,
  ShieldCheck,
  Users,
  Wifi,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/common/EmptyState";
import { PlanBadge, StatusBadge } from "./StatusBadge";
import type { Organization } from "@/types/organization";

interface Props { org: Organization; initialTab?: string }

const KPIS = (o: Organization) => [
  { label: "Total Locations", value: o.activeLocations, icon: MapPin, tone: "text-indigo-500 bg-indigo-500/10" },
  { label: "Active Routers", value: o.activeRouters, icon: Router, tone: "text-sky-500 bg-sky-500/10" },
  { label: "Connected Guests", value: o.activeGuests.toLocaleString(), icon: Users, tone: "text-emerald-500 bg-emerald-500/10" },
  { label: "Monthly Revenue", value: `$${o.monthlyRevenue.toLocaleString()}`, icon: DollarSign, tone: "text-amber-500 bg-amber-500/10" },
  { label: "Active Sessions", value: o.activeSessions, icon: Activity, tone: "text-fuchsia-500 bg-fuchsia-500/10" },
  { label: "Uptime", value: `${o.uptimePct}%`, icon: ShieldCheck, tone: "text-teal-500 bg-teal-500/10" },
];

export function OrganizationDetailTabs({ org, initialTab = "overview" }: Props) {
  const [tab, setTab] = useState(initialTab);

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
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {KPIS(org).map((k) => (
            <Card key={k.label} className="rounded-2xl border-border/70 shadow-sm">
              <CardContent className="flex flex-col gap-3 p-4">
                <div className={`grid h-9 w-9 place-items-center rounded-lg ${k.tone}`}>
                  <k.icon className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">{k.label}</div>
                  <div className="text-2xl font-semibold tabular-nums">{k.value}</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="rounded-2xl border-border/70 shadow-sm lg:col-span-2">
            <CardHeader><CardTitle className="text-base">Company profile</CardTitle></CardHeader>
            <CardContent className="grid gap-4 text-sm sm:grid-cols-2">
              <Field label="Business name" value={org.businessName} />
              <Field label="Industry" value={org.industry} />
              <Field label="Company size" value={org.companySize} />
              <Field label="GST / Tax ID" value={org.gstNumber ?? "—"} />
              <Field label="Website" value={org.website ?? "—"} icon={Globe} />
              <Field label="Created" value={new Date(org.createdAt).toLocaleDateString()} icon={Clock} />
              <Field label="Address" value={`${org.address}, ${org.city}, ${org.state}, ${org.country} ${org.zipCode}`} full />
              <Field label="Timezone" value={org.timezone} />
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-border/70 shadow-sm">
            <CardHeader><CardTitle className="text-base">Primary contact</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Field label="Name" value={org.contactName} />
              <Field label="Designation" value={org.contactDesignation} />
              <Field label="Email" value={org.contactEmail} />
              <Field label="Phone" value={org.contactPhone} />
            </CardContent>
          </Card>
        </div>

        <Card className="rounded-2xl border-border/70 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Subscription</CardTitle>
            <div className="flex items-center gap-2">
              <PlanBadge plan={org.plan} />
              <StatusBadge status={org.status} />
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm sm:grid-cols-3">
            <Field label="Billing cycle" value={org.billingCycle} />
            <Field label="MRR" value={`$${org.monthlyRevenue.toLocaleString()}`} />
            <Field label="Expires" value={new Date(org.expiryDate).toLocaleDateString()} />
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="locations"><ListTab icon={MapPin} title="Locations" org={org} keyName="locations" /></TabsContent>
      <TabsContent value="routers"><ListTab icon={Router} title="Routers" org={org} keyName="routers" /></TabsContent>
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
        <EmptyState icon={Activity} title="Analytics coming soon" description="Guest, session and revenue trends will render here." />
      </TabsContent>
      <TabsContent value="billing"><BillingTab org={org} /></TabsContent>
      <TabsContent value="audit"><AuditTab org={org} /></TabsContent>
      <TabsContent value="support">
        <EmptyState icon={LifeBuoy} title="No support tickets" description="Tickets raised by this organization will show up here." />
      </TabsContent>
    </Tabs>
  );
}

function Field({ label, value, icon: Icon, full }: { label: string; value: string; icon?: typeof Globe; full?: boolean }) {
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

function ListTab({ icon: Icon, title, org, keyName }: { icon: typeof MapPin; title: string; org: Organization; keyName: "locations" | "routers" }) {
  const count = keyName === "locations" ? org.activeLocations : org.activeRouters;
  if (count === 0) return <EmptyState icon={Icon} title={`No ${title.toLowerCase()} yet`} />;
  const rows = Array.from({ length: Math.min(count, 8) }).map((_, i) => ({
    id: `${keyName === "locations" ? "LOC" : "RTR"}-${String(1000 + i).padStart(4, "0")}`,
    name: keyName === "locations" ? `${org.city} Branch ${i + 1}` : `AP-${org.city.slice(0, 3).toUpperCase()}-${100 + i}`,
    status: i % 5 === 0 ? "offline" : "online",
  }));
  return (
    <Card className="overflow-hidden rounded-2xl border-border/70 shadow-sm">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30">
            <TableHead>ID</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="font-mono text-xs">{r.id}</TableCell>
              <TableCell>{r.name}</TableCell>
              <TableCell>
                <Badge variant="outline" className={r.status === "online" ? "border-emerald-500/30 text-emerald-600" : "border-rose-500/30 text-rose-600"}>
                  {r.status}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

function BillingTab({ org }: { org: Organization }) {
  const invoices = Array.from({ length: 6 }).map((_, i) => ({
    id: `INV-${2024001 + i}`,
    date: new Date(Date.now() - i * 30 * 86400000).toLocaleDateString(),
    amount: org.monthlyRevenue,
    status: i === 0 ? "pending" : "paid",
  }));
  return (
    <Card className="overflow-hidden rounded-2xl border-border/70 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base"><CreditCard className="h-4 w-4" /> Recent invoices</CardTitle>
        <PlanBadge plan={org.plan} />
      </CardHeader>
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30">
            <TableHead>Invoice</TableHead>
            <TableHead>Date</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invoices.map((i) => (
            <TableRow key={i.id}>
              <TableCell className="font-mono text-xs">{i.id}</TableCell>
              <TableCell>{i.date}</TableCell>
              <TableCell className="text-right tabular-nums">${i.amount.toLocaleString()}</TableCell>
              <TableCell>
                <Badge variant="outline" className={i.status === "paid" ? "border-emerald-500/30 text-emerald-600" : "border-amber-500/30 text-amber-600"}>
                  {i.status}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

function AuditTab({ org }: { org: Organization }) {
  const logs = [
    { at: "2 hours ago", actor: "system", event: "Router AP-102 reconnected" },
    { at: "Yesterday", actor: org.contactName, event: "Updated captive portal branding" },
    { at: "3 days ago", actor: "super_admin", event: "Plan changed to " + org.plan },
    { at: "Last week", actor: org.contactName, event: "Invited 2 new location managers" },
  ];
  return (
    <Card className="rounded-2xl border-border/70 shadow-sm">
      <CardHeader><CardTitle className="flex items-center gap-2 text-base"><FileText className="h-4 w-4" /> Audit log</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {logs.map((l, i) => (
          <div key={i} className="flex items-start gap-3 rounded-lg border border-border/60 p-3">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-muted"><Building2 className="h-4 w-4 text-muted-foreground" /></div>
            <div className="flex-1">
              <div className="text-sm">{l.event}</div>
              <div className="text-xs text-muted-foreground">by {l.actor} · {l.at}</div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
