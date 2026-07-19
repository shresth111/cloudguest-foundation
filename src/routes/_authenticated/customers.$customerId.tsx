import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  Activity,
  Building2,
  ChevronRight,
  CreditCard,
  Layers,
  MapPin,
  Receipt,
  Router as RouterIcon,
  ScrollText,
  Settings as SettingsIcon,
  ShieldCheck,
  Users,
  Wifi,
} from "lucide-react";
import { useMemo, useState } from "react";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState } from "@/components/common/ErrorState";
import { PageSkeleton } from "@/components/common/LoadingSkeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useCustomer, useLocationResources } from "@/hooks/useCustomer";
import type { ExistingCustomer } from "@/services/customer.service";
import { cn } from "@/lib/utils";

type SectionKey =
  | "organization"
  | "locations"
  | "subscription"
  | "billing"
  | "features"
  | "audit"
  | "settings";

type SubResource = "routers" | "staff" | "guests" | "analytics";

const searchSchema = z.object({
  section: z
    .enum(["organization", "locations", "subscription", "billing", "features", "audit", "settings"])
    .optional(),
  locationId: z.string().optional(),
  sub: z.enum(["routers", "staff", "guests", "analytics"]).optional(),
});

export const Route = createFileRoute("/_authenticated/customers/$customerId")({
  validateSearch: searchSchema,
  component: CustomerDetailPage,
});

function CustomerDetailPage() {
  const { customerId } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { data: customer, isLoading, isError, refetch } = useCustomer(customerId);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const section: SectionKey = search.section ?? "organization";
  const activeLocationId = search.locationId ?? null;
  const activeSub: SubResource | null = search.sub ?? null;

  if (isLoading) return <PageSkeleton />;
  if (isError || !customer)
    return <ErrorState title="Customer not found" onRetry={() => refetch()} />;

  const go = (patch: Partial<z.infer<typeof searchSchema>>) =>
    navigate({
      to: "/customers/$customerId",
      params: { customerId },
      search: { ...search, ...patch },
    });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/customers">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{customer.name}</h1>
              <Badge
                variant={
                  customer.status === "active"
                    ? "default"
                    : customer.status === "trial"
                      ? "secondary"
                      : "destructive"
                }
                className="capitalize"
              >
                {customer.status}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {customer.id} · Owner {customer.owner.name} · {customer.locations.length} locations
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        {/* Tree navigator */}
        <aside className="rounded-lg border bg-card p-2 text-sm">
          <TreeGroup label="Customer" icon={<Building2 className="h-4 w-4" />}>
            <TreeItem
              label="Organization"
              icon={<Building2 className="h-4 w-4" />}
              active={section === "organization" && !activeLocationId}
              onClick={() => go({ section: "organization", locationId: undefined, sub: undefined })}
            />

            <TreeExpandable
              label="Locations"
              icon={<MapPin className="h-4 w-4" />}
              badge={customer.locations.length}
              defaultOpen
            >
              {customer.locations.map((loc) => {
                const isOpen = expanded[loc.id] ?? loc.id === activeLocationId;
                return (
                  <div key={loc.id}>
                    <TreeItem
                      label={loc.name}
                      subtle={loc.city}
                      icon={<ChevronRight className={cn("h-3 w-3 transition-transform", isOpen && "rotate-90")} />}
                      indent
                      active={activeLocationId === loc.id && !activeSub}
                      onClick={() => {
                        setExpanded((s) => ({ ...s, [loc.id]: !isOpen }));
                        go({ section: "locations", locationId: loc.id, sub: undefined });
                      }}
                    />
                    {isOpen && (
                      <div className="ml-6 border-l pl-2">
                        <TreeItem
                          label="Routers"
                          icon={<RouterIcon className="h-3.5 w-3.5" />}
                          indent
                          active={activeLocationId === loc.id && activeSub === "routers"}
                          onClick={() => go({ section: "locations", locationId: loc.id, sub: "routers" })}
                        />
                        <TreeItem
                          label="Staff"
                          icon={<Users className="h-3.5 w-3.5" />}
                          indent
                          active={activeLocationId === loc.id && activeSub === "staff"}
                          onClick={() => go({ section: "locations", locationId: loc.id, sub: "staff" })}
                        />
                        <TreeItem
                          label="Guests"
                          icon={<Wifi className="h-3.5 w-3.5" />}
                          indent
                          active={activeLocationId === loc.id && activeSub === "guests"}
                          onClick={() => go({ section: "locations", locationId: loc.id, sub: "guests" })}
                        />
                        <TreeItem
                          label="Analytics"
                          icon={<Activity className="h-3.5 w-3.5" />}
                          indent
                          active={activeLocationId === loc.id && activeSub === "analytics"}
                          onClick={() => go({ section: "locations", locationId: loc.id, sub: "analytics" })}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </TreeExpandable>

            <TreeItem
              label="Subscription"
              icon={<CreditCard className="h-4 w-4" />}
              active={section === "subscription"}
              onClick={() => go({ section: "subscription", locationId: undefined, sub: undefined })}
            />
            <TreeItem
              label="Billing"
              icon={<Receipt className="h-4 w-4" />}
              active={section === "billing"}
              onClick={() => go({ section: "billing", locationId: undefined, sub: undefined })}
            />
            <TreeItem
              label="Feature access"
              icon={<Layers className="h-4 w-4" />}
              active={section === "features"}
              onClick={() => go({ section: "features", locationId: undefined, sub: undefined })}
            />
            <TreeItem
              label="Audit logs"
              icon={<ScrollText className="h-4 w-4" />}
              active={section === "audit"}
              onClick={() => go({ section: "audit", locationId: undefined, sub: undefined })}
            />
            <TreeItem
              label="Settings"
              icon={<SettingsIcon className="h-4 w-4" />}
              active={section === "settings"}
              onClick={() => go({ section: "settings", locationId: undefined, sub: undefined })}
            />
          </TreeGroup>
        </aside>

        {/* Content */}
        <div className="min-w-0">
          {section === "organization" && <OrganizationPanel customer={customer} />}
          {section === "locations" && !activeLocationId && <LocationsOverview customer={customer} onOpen={(id) => go({ section: "locations", locationId: id, sub: undefined })} />}
          {section === "locations" && activeLocationId && (
            <LocationPanel
              locationId={activeLocationId}
              locationName={
                customer.locations.find((l) => l.id === activeLocationId)?.name ?? "Location"
              }
              sub={activeSub}
              onSub={(s) => go({ sub: s })}
            />
          )}
          {section === "subscription" && <SubscriptionPanel customer={customer} />}
          {section === "billing" && <BillingPanel customer={customer} />}
          {section === "features" && <FeaturesPanel />}
          {section === "audit" && <AuditPanel customer={customer} />}
          {section === "settings" && <SettingsPanel customer={customer} />}
        </div>
      </div>
    </div>
  );
}

/* ------------ Tree primitives ------------ */

function TreeGroup({
  label,
  icon,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 px-2 py-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function TreeItem({
  label,
  subtle,
  icon,
  active,
  indent,
  onClick,
}: {
  label: string;
  subtle?: string;
  icon?: React.ReactNode;
  active?: boolean;
  indent?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
        active ? "bg-primary/10 text-primary" : "hover:bg-muted",
        indent && "pl-4",
      )}
    >
      {icon}
      <span className="flex-1 truncate">{label}</span>
      {subtle && <span className="text-xs text-muted-foreground">{subtle}</span>}
    </button>
  );
}

function TreeExpandable({
  label,
  icon,
  badge,
  defaultOpen,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  badge?: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
      >
        <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-90")} />
        {icon}
        <span className="flex-1">{label}</span>
        {badge != null && (
          <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
            {badge}
          </Badge>
        )}
      </button>
      {open && <div className="ml-2">{children}</div>}
    </div>
  );
}

/* ------------ Panels ------------ */

function KV({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b py-2 text-sm last:border-b-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function OrganizationPanel({ customer }: { customer: ExistingCustomer }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Organization</CardTitle>
        </CardHeader>
        <CardContent>
          <KV label="Legal name" value={customer.name} />
          <KV label="Organization ID" value={customer.organizationId} />
          <KV label="Customer ID" value={customer.id} />
          <KV label="Status" value={<span className="capitalize">{customer.status}</span>} />
          <KV label="Locations" value={customer.locations.length} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Owner</CardTitle>
        </CardHeader>
        <CardContent>
          <KV label="Name" value={customer.owner.name} />
          <KV label="Email" value={customer.owner.email} />
          <KV label="Mobile" value={customer.owner.mobile} />
          <KV label="Role" value={customer.owner.role} />
          <KV label="Assigned locations" value={customer.owner.assignedLocations} />
        </CardContent>
      </Card>
    </div>
  );
}

function LocationsOverview({
  customer,
  onOpen,
}: {
  customer: ExistingCustomer;
  onOpen: (id: string) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Locations ({customer.locations.length})</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>City</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {customer.locations.map((loc) => (
              <TableRow key={loc.id}>
                <TableCell className="font-medium">{loc.name}</TableCell>
                <TableCell className="capitalize">{loc.siteType}</TableCell>
                <TableCell>{loc.city}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" onClick={() => onOpen(loc.id)}>
                    Open
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function LocationPanel({
  locationId,
  locationName,
  sub,
  onSub,
}: {
  locationId: string;
  locationName: string;
  sub: SubResource | null;
  onSub: (s: SubResource | undefined) => void;
}) {
  const { data, isLoading } = useLocationResources(locationId);
  const tabs: { id: SubResource; label: string; icon: React.ReactNode }[] = [
    { id: "routers", label: "Routers", icon: <RouterIcon className="h-4 w-4" /> },
    { id: "staff", label: "Staff", icon: <Users className="h-4 w-4" /> },
    { id: "guests", label: "Guests", icon: <Wifi className="h-4 w-4" /> },
    { id: "analytics", label: "Analytics", icon: <Activity className="h-4 w-4" /> },
  ];
  const active: SubResource = sub ?? "routers";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <MapPin className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">{locationName}</h2>
        <Badge variant="outline">{locationId}</Badge>
      </div>
      <div className="flex gap-1 rounded-lg border bg-muted/40 p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => onSub(t.id)}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors",
              active === t.id ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {isLoading || !data ? (
        <PageSkeleton />
      ) : (
        <Card>
          <CardContent className="p-0">
            {active === "routers" && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Router</TableHead>
                    <TableHead>Model</TableHead>
                    <TableHead>Public IP</TableHead>
                    <TableHead>Uptime</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.routers.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell>{r.model}</TableCell>
                      <TableCell className="font-mono text-xs">{r.publicIp}</TableCell>
                      <TableCell>{r.uptime}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            r.status === "online"
                              ? "default"
                              : r.status === "degraded"
                                ? "secondary"
                                : "destructive"
                          }
                          className="capitalize"
                        >
                          {r.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            {active === "staff" && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Last active</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.staff.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell>{s.role}</TableCell>
                      <TableCell className="text-muted-foreground">{s.email}</TableCell>
                      <TableCell>{s.lastActive}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            {active === "guests" && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Guest</TableHead>
                    <TableHead>Device</TableHead>
                    <TableHead>MAC</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Connected</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.guests.map((g) => (
                    <TableRow key={g.id}>
                      <TableCell className="font-medium">{g.name}</TableCell>
                      <TableCell>{g.device}</TableCell>
                      <TableCell className="font-mono text-xs">{g.mac}</TableCell>
                      <TableCell>{g.dataMb} MB</TableCell>
                      <TableCell>{g.connectedAt}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            {active === "analytics" && (
              <div className="grid gap-3 p-4 md:grid-cols-3">
                <Metric label="Active guests" value={data.analytics.activeGuests} />
                <Metric label="Peak concurrent" value={data.analytics.peakConcurrent} />
                <Metric label="Daily sessions" value={data.analytics.dailySessions} />
                <Metric label="Data consumed" value={`${data.analytics.dataConsumedGb} GB`} />
                <Metric label="Top device" value={data.analytics.topDevice} />
                <Metric label="Satisfaction" value={`${data.analytics.satisfaction}%`} />
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
    </div>
  );
}

function SubscriptionPanel({ customer }: { customer: ExistingCustomer }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Subscription</CardTitle>
      </CardHeader>
      <CardContent>
        <KV label="Plan" value={<span className="capitalize">{customer.subscription.plan}</span>} />
        <KV label="Billing cycle" value={<span className="capitalize">{customer.subscription.billingCycle}</span>} />
        <KV label="Status" value={<span className="capitalize">{customer.subscription.status}</span>} />
        <KV
          label="Expires"
          value={new Date(customer.subscription.expiryDate).toLocaleDateString()}
        />
      </CardContent>
    </Card>
  );
}

function BillingPanel({ customer }: { customer: ExistingCustomer }) {
  const invoices = useMemo(
    () =>
      Array.from({ length: 4 }, (_, i) => ({
        id: `INV-${2025 - Math.floor(i / 4)}-${String(i + 1).padStart(4, "0")}`,
        date: new Date(Date.now() - i * 30 * 86400000).toLocaleDateString(),
        amount: 1200 + i * 90,
        status: i === 0 ? "due" : "paid",
      })),
    [],
  );
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Billing summary</CardTitle>
        </CardHeader>
        <CardContent>
          <KV label="Customer" value={customer.name} />
          <KV label="Plan" value={<span className="capitalize">{customer.subscription.plan}</span>} />
          <KV label="Payment method" value="Visa •••• 4242" />
          <KV label="Next invoice" value={new Date(Date.now() + 30 * 86400000).toLocaleDateString()} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent invoices</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((i) => (
                <TableRow key={i.id}>
                  <TableCell className="font-mono text-xs">{i.id}</TableCell>
                  <TableCell>{i.date}</TableCell>
                  <TableCell>${i.amount}</TableCell>
                  <TableCell>
                    <Badge variant={i.status === "paid" ? "default" : "secondary"} className="capitalize">
                      {i.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function FeaturesPanel() {
  const features: Array<{ group: string; items: Array<[string, boolean]> }> = [
    { group: "Networking", items: [["WireGuard", true], ["Multi-WAN", true], ["QoS", false]] },
    { group: "Auth", items: [["Mobile OTP", true], ["Voucher", true], ["Social login", true], ["PMS", false]] },
    { group: "Analytics", items: [["Real-time", true], ["Retention", true], ["Custom reports", false]] },
    { group: "Branding", items: [["Custom domain", true], ["White label email", true]] },
    { group: "Management", items: [["Multi-location", true], ["Role delegation", true]] },
  ];
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {features.map((f) => (
        <Card key={f.group}>
          <CardHeader>
            <CardTitle className="text-base">{f.group}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {f.items.map(([name, on]) => (
              <div key={name} className="flex items-center justify-between text-sm">
                <span>{name}</span>
                <Badge variant={on ? "default" : "outline"}>{on ? "Enabled" : "Disabled"}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function AuditPanel({ customer }: { customer: ExistingCustomer }) {
  const events = useMemo(
    () => [
      { at: "2m ago", who: customer.owner.name, action: "Updated router config", target: "Hotel Delhi" },
      { at: "1h ago", who: "System", action: "Auto-renewed subscription", target: customer.name },
      { at: "3h ago", who: "Anjali Rao", action: "Disconnected guest session", target: "Cafe Jaipur" },
      { at: "1d ago", who: customer.owner.name, action: "Added new location", target: "Warehouse Pune" },
      { at: "3d ago", who: "System", action: "Firmware update completed", target: "Hospital Noida" },
    ],
    [customer],
  );
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Recent activity</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Actor</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Target</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {events.map((e, i) => (
              <TableRow key={i}>
                <TableCell className="text-muted-foreground">{e.at}</TableCell>
                <TableCell>{e.who}</TableCell>
                <TableCell>{e.action}</TableCell>
                <TableCell>{e.target}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function SettingsPanel({ customer }: { customer: ExistingCustomer }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Account</CardTitle>
        </CardHeader>
        <CardContent>
          <KV label="Timezone" value="Asia/Kolkata" />
          <KV label="Locale" value="en-IN" />
          <KV label="Contact email" value={customer.owner.email} />
          <KV label="Support tier" value="Priority" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Security</CardTitle>
        </CardHeader>
        <CardContent>
          <KV label="MFA required" value="Yes" />
          <KV label="Session timeout" value="30 min" />
          <KV label="IP allowlist" value="Disabled" />
          <KV
            label="Data residency"
            value={
              <span className="inline-flex items-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5" /> India
              </span>
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}
