import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  Bell,
  Router as RouterIcon,
  ShieldCheck,
  Sparkles,
  Ticket,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Can } from "@/components/permissions/Can";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useWorkspaceScope } from "@/hooks/useWorkspace";
import { usePermissions } from "@/hooks/usePermissions";

export const Route = createFileRoute("/_authenticated/workspace/agent")({
  component: AgentDashboardPage,
});

/**
 * A deliberately smaller dashboard than workspace/index.tsx's full
 * DashboardWidgets -- each section below is wrapped in <Can/> and only
 * renders when the signed-in agent's real, backend-assigned permissions
 * allow it. Nothing here is a separate/fake permission system: the Owner
 * grants an agent access by creating/assigning a role with specific
 * permissions in the real Roles & Permissions console (/rbac); this page
 * just reflects whatever that grants.
 */
function AgentDashboardPage() {
  const { customer, activeLocation, locations } = useWorkspace();
  const { aggregated } = useWorkspaceScope();
  const { modules } = usePermissions();

  const visibleCount = Object.values(modules).filter((m) => m?.view).length;
  const location = activeLocation ?? locations[0];

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-semibold tracking-tight">Agent dashboard</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          {customer?.organizationName ?? "Your workspace"}
          {location ? ` · ${location.name}` : ""} — showing only what's been assigned to your
          account.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Can module="guests-live" mode="hidden">
          <StatCard
            icon={Users}
            label="Active guests"
            value={aggregated.analytics.activeSessions}
          />
        </Can>
        <Can module="routers" mode="hidden">
          <StatCard
            icon={RouterIcon}
            label="Routers online"
            value={aggregated.routers.filter((r) => r.status === "online").length}
          />
        </Can>
        <Can module="monitoring" mode="hidden">
          <StatCard icon={Activity} label="Guest sessions" value={aggregated.analytics.totalSessions} />
        </Can>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Can module="guests-live" mode="hidden">
          <QuickLinkCard
            icon={Users}
            title="Guests"
            description="View and manage guests currently on this location's network."
            to="/guests"
          />
        </Can>
        <Can module="voucher-master" mode="hidden">
          <QuickLinkCard
            icon={Ticket}
            title="Vouchers"
            description="Generate and manage guest access vouchers."
            to="/vouchers"
          />
        </Can>
        <Can module="monitoring" mode="hidden">
          <QuickLinkCard
            icon={Activity}
            title="Monitoring"
            description="Router and network health for your location."
            to="/monitoring"
          />
        </Can>
        <Can module="notifications" mode="hidden">
          <QuickLinkCard
            icon={Bell}
            title="Notifications"
            description="Recent alerts and system notices."
            to="/notifications"
          />
        </Can>
      </div>

      {visibleCount === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-2 p-10 text-center">
            <Sparkles className="h-6 w-6 text-muted-foreground" />
            <p className="text-sm font-medium">No features assigned yet</p>
            <p className="text-xs text-muted-foreground">
              Ask your Owner to grant access via Roles &amp; Permissions.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users;
  label: string;
  value: number;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-xl font-semibold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function QuickLinkCard({
  icon: Icon,
  title,
  description,
  to,
}: {
  icon: typeof Users;
  title: string;
  description: string;
  to: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">{description}</p>
        <Button asChild size="sm" variant="outline">
          <Link to={to}>Open</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
