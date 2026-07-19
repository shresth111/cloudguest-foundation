import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { fallback, zodValidator } from "@tanstack/zod-adapter";
import {
  Activity,
  BadgeCheck,
  Bell,
  Building2,
  ChevronRight,
  KeyRound,
  Layers,
  MapPin,
  Palette,
  Plug,
  Receipt,
  RocketIcon,
  Router as RouterIcon,
  ScrollText,
  Search,
  ShieldCheck,
  ToggleRight,
  Users,
  UsersRound,
  Wifi,
} from "lucide-react";
import { useMemo } from "react";
import { z } from "zod";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { PageHeader } from "@/components/system/PageHeader";
import { PageSkeleton } from "@/components/common/LoadingSkeleton";
import { Button } from "@/components/ui/button";
import { useCustomer } from "@/hooks/useCustomer";
import {
  ApiPanel,
  AuditPanel,
  BrandingPanel,
  CustomerProfilePanel,
  IntegrationsPanel,
  LocationsPanel,
  ModulesPanel,
  NasGroupsPanel,
  NotificationsPanel,
  PermissionsPanel,
  PoliciesPanel,
  RoutersPanel,
  SecurityPanel,
  SubscriptionPanel,
  UsagePanel,
  UsersPanel,
} from "@/components/tenant/panels";

const SECTIONS = [
  { key: "profile", label: "Customer profile", icon: Building2, group: "Overview" },
  { key: "onboarding", label: "Onboarding", icon: RocketIcon, group: "Overview" },
  { key: "branding", label: "Branding", icon: Palette, group: "Overview" },
  { key: "subscription", label: "Subscription", icon: Receipt, group: "Overview" },
  { key: "modules", label: "Modules", icon: ToggleRight, group: "Configuration" },
  { key: "policies", label: "Policies", icon: BadgeCheck, group: "Configuration" },
  { key: "nas-groups", label: "NAS Groups", icon: Layers, group: "Network" },
  { key: "routers", label: "Routers / NAS", icon: RouterIcon, group: "Network" },
  { key: "locations", label: "Locations", icon: MapPin, group: "Network" },
  { key: "users", label: "Users", icon: Users, group: "Access" },
  { key: "permissions", label: "Permissions", icon: UsersRound, group: "Access" },
  { key: "integrations", label: "Integrations", icon: Plug, group: "Developer" },
  { key: "api", label: "API", icon: KeyRound, group: "Developer" },
  { key: "security", label: "Security", icon: ShieldCheck, group: "Governance" },
  { key: "notifications", label: "Notifications", icon: Bell, group: "Governance" },
  { key: "usage", label: "Usage", icon: Activity, group: "Governance" },
  { key: "audit", label: "Audit", icon: ScrollText, group: "Governance" },
] as const;

type SectionKey = (typeof SECTIONS)[number]["key"];

const searchSchema = z.object({
  section: fallback(z.enum(SECTIONS.map((s) => s.key) as [SectionKey, ...SectionKey[]]), "profile").default("profile"),
  q: fallback(z.string(), "").default(""),
});

type TenantSearch = z.infer<typeof searchSchema>;

export const Route = createFileRoute("/_authenticated/customers/$customerId/tenant")({
  validateSearch: zodValidator(searchSchema),
  component: TenantConfigPage,
});

function TenantConfigPage() {
  const { customerId } = Route.useParams();
  const { section, q } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const { data: cust, isLoading } = useCustomer(customerId);

  const grouped = useMemo(() => {
    const filter = q.trim().toLowerCase();
    const groups: Record<string, typeof SECTIONS[number][]> = {};
    SECTIONS.forEach((s) => {
      if (filter && !s.label.toLowerCase().includes(filter) && !s.group.toLowerCase().includes(filter)) return;
      (groups[s.group] ??= []).push(s);
    });
    return groups;
  }, [q]);

  if (isLoading) return <PageSkeleton />;

  const activeMeta = SECTIONS.find((s) => s.key === section);

  return (
    <div className="space-y-4">
      <PageHeader
        title={cust ? `${cust.name} · Tenant configuration` : "Tenant configuration"}
        description="Configure every module, policy and NAS independently for this customer."
        actions={
          <Button asChild variant="outline">
            <Link to="/customers/$customerId" params={{ customerId }}>Back to customer</Link>
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => navigate({ search: (prev: TenantSearch) => ({ ...prev, q: e.target.value }), replace: true })}
              placeholder="Search customer, location, router, NAS…" className="pl-8" />
          </div>
          <Card className="p-2">
            <nav className="flex flex-col gap-4">
              {Object.entries(grouped).map(([groupLabel, items]) => (
                <div key={groupLabel}>
                  <div className="px-2 pb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{groupLabel}</div>
                  <div className="flex flex-col">
                    {items.map((s) => {
                      const Icon = s.icon;
                      const active = s.key === section;
                      return (
                        <button key={s.key} type="button"
                          onClick={() => {
                            if (s.key === "onboarding") {
                              navigate({ to: "/customers/$customerId/onboarding", params: { customerId } });
                              return;
                            }
                            navigate({ search: (prev: TenantSearch) => ({ ...prev, section: s.key }), replace: true });
                          }}
                          className={
                            "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition " +
                            (active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground")
                          }>
                          <Icon className="h-4 w-4" />
                          <span className="truncate">{s.label}</span>
                          {active && <ChevronRight className="ml-auto h-3.5 w-3.5" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>
          </Card>
        </aside>

        <section className="min-w-0 space-y-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {activeMeta && <activeMeta.icon className="h-4 w-4" />}
            <span>{activeMeta?.group}</span>
            <Separator orientation="vertical" className="h-3" />
            <span className="font-medium text-foreground">{activeMeta?.label}</span>
          </div>
          <SectionRenderer section={section} customerId={customerId} />
        </section>
      </div>
    </div>
  );
}

function SectionRenderer({ section, customerId }: { section: SectionKey; customerId: string }) {
  switch (section) {
    case "profile": return <CustomerProfilePanel customerId={customerId} />;
    case "branding": return <BrandingPanel customerId={customerId} />;
    case "subscription": return <SubscriptionPanel customerId={customerId} />;
    case "modules": return <ModulesPanel customerId={customerId} />;
    case "policies": return <PoliciesPanel customerId={customerId} />;
    case "nas-groups": return <NasGroupsPanel customerId={customerId} />;
    case "routers": return <RoutersPanel customerId={customerId} />;
    case "locations": return <LocationsPanel customerId={customerId} />;
    case "users": return <UsersPanel customerId={customerId} />;
    case "permissions": return <PermissionsPanel customerId={customerId} />;
    case "integrations": return <IntegrationsPanel customerId={customerId} />;
    case "api": return <ApiPanel customerId={customerId} />;
    case "security": return <SecurityPanel customerId={customerId} />;
    case "notifications": return <NotificationsPanel customerId={customerId} />;
    case "usage": return <UsagePanel customerId={customerId} />;
    case "audit": return <AuditPanel customerId={customerId} />;
    default: return null;
  }
}

// Silence unused imports
export const _icons = { Wifi };
