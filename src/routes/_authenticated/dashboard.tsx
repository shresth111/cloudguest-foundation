import { createFileRoute } from "@tanstack/react-router";
import { Activity, Building2, MapPin, Users, Wifi } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/common/EmptyState";
import { useAuth } from "@/context/AuthContext";
import { ROLE_BADGE_VARIANT, ROLE_LABELS } from "@/lib/roles";
import type { UserRole } from "@/types/auth";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

interface StatCard {
  label: string;
  value: string;
  hint: string;
  icon: typeof Wifi;
}

const STATS_BY_ROLE: Record<UserRole, StatCard[]> = {
  super_admin: [
    { label: "Organizations", value: "128", hint: "+4 this month", icon: Building2 },
    { label: "Active locations", value: "1,204", hint: "98.6% online", icon: MapPin },
    { label: "Concurrent guests", value: "42,918", hint: "Live", icon: Users },
    { label: "Platform uptime", value: "99.99%", hint: "Last 30 days", icon: Activity },
  ],
  org_admin: [
    { label: "Locations", value: "36", hint: "All regions", icon: MapPin },
    { label: "Networks", value: "72", hint: "12 SSIDs", icon: Wifi },
    { label: "Guests today", value: "5,412", hint: "+8% WoW", icon: Users },
    { label: "Avg. session", value: "42m", hint: "Steady", icon: Activity },
  ],
  location_manager: [
    { label: "Access points", value: "18", hint: "17 online", icon: Wifi },
    { label: "Guests today", value: "324", hint: "+12% WoW", icon: Users },
    { label: "Peak clients", value: "196", hint: "at 13:20", icon: Activity },
    { label: "Bandwidth", value: "1.2 Gbps", hint: "Peak today", icon: Activity },
  ],
  support_engineer: [
    { label: "Open tickets", value: "17", hint: "3 high priority", icon: Activity },
    { label: "Devices offline", value: "6", hint: "Across 4 sites", icon: Wifi },
    { label: "MTTR", value: "1h 12m", hint: "Last 7 days", icon: Activity },
    { label: "SLA compliance", value: "98.4%", hint: "This month", icon: Activity },
  ],
  read_only: [
    { label: "Locations", value: "36", hint: "View only", icon: MapPin },
    { label: "Guests this week", value: "38,204", hint: "+6% WoW", icon: Users },
    { label: "Reports", value: "12", hint: "Available", icon: Activity },
    { label: "Networks", value: "72", hint: "Monitored", icon: Wifi },
  ],
};

function DashboardPage() {
  const { user } = useAuth();
  if (!user) return null;
  const stats = STATS_BY_ROLE[user.role];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Welcome back, {user.name.split(" ")[0]}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Here's a snapshot of your CloudGuest workspace.
          </p>
        </div>
        <Badge variant={ROLE_BADGE_VARIANT[user.role]} className="h-6">
          {ROLE_LABELS[user.role]}
        </Badge>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="rounded-2xl border-border/70 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardDescription className="text-xs font-medium uppercase tracking-wide">
                {s.label}
              </CardDescription>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <s.icon className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold text-foreground">{s.value}</div>
              <div className="mt-1 text-xs text-muted-foreground">{s.hint}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="rounded-2xl border-border/70 shadow-sm lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
            <CardDescription>Live events from your CloudGuest deployments.</CardDescription>
          </CardHeader>
          <CardContent>
            <EmptyState
              title="No modules connected yet"
              description="Business modules will appear here once they're enabled for your workspace."
            />
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border/70 shadow-sm">
          <CardHeader>
            <CardTitle>Getting started</CardTitle>
            <CardDescription>Foundation is ready for module development.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>✓ Authentication &amp; role-based access</li>
              <li>✓ Sidebar, top navbar, theming</li>
              <li>✓ Reusable UI + API layer</li>
              <li className="text-foreground">→ Build business modules next</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
