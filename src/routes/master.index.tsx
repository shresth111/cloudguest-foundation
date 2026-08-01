import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  Building2, MapPin, Users, DollarSign, Router, UserCheck, AlertTriangle, Sparkles, Plus, ArrowRight,
} from "lucide-react";
import { MasterShell } from "@/components/master/MasterShell";
import { MSectionHeader, MStat, MTag, MButton, MTable, MTh, MTd, MTr } from "@/components/master/MasterKit";
import { useAnalyticsSnapshot } from "@/hooks/useAnalytics";
import { useBillingSnapshot } from "@/hooks/useBilling";

export const Route = createFileRoute("/master/")({
  component: PlatformOverview,
});

function money(n: number) {
  return `$${n >= 1000 ? `${(n / 1000).toFixed(1)}k` : n}`;
}

/**
 * This used to be entirely static mock data from lib/masterData.ts (8
 * fixed KPI numbers, an always-identical "recent customers" table, a
 * synthetic 24h sessions curve, a "Tenants by Region" chart backed by a
 * field no real Organization row has). Real, platform-wide data for most
 * of this exists (see analytics.service.ts's own module comment for the
 * exact boundary of what GET /dashboard/super-admin/unified does and
 * doesn't cover) -- wired to that plus the real billing snapshot
 * (already real+demo-wired, see billing.service.ts) for MRR/plan mix/
 * billing reminders, which the analytics endpoint has no equivalent for.
 * "Tenants by Region" is dropped (no real region field on Organization
 * anywhere in the backend) in favor of a real plan-mix chart.
 */
function PlatformOverview() {
  const analytics = useAnalyticsSnapshot("last30");
  const billing = useBillingSnapshot();

  const kpis = analytics.data?.kpis;
  const billingKpis = billing.data?.kpis;
  const orgRows = analytics.data?.organizations ?? [];
  const subscriptions = billing.data?.subscriptions ?? [];
  const planDistribution = billing.data?.revenue.planDistribution ?? [];
  const reminders = billing.data?.reminders ?? [];

  const recent = orgRows.slice(0, 5).map((o) => ({
    ...o,
    sub: subscriptions.find((s) => s.organizationId === o.id),
  }));

  const KPI_TILES = kpis && billingKpis
    ? [
        { key: "tenants", label: "Tenants", value: String(kpis.totalOrganizations), icon: Building2 },
        { key: "locations", label: "Active Locations", value: String(kpis.totalLocations), icon: MapPin },
        { key: "guests", label: "Active Sessions", value: kpis.activeGuests.toLocaleString(), icon: Users },
        { key: "mrr", label: "MRR", value: money(billingKpis.mrr), icon: DollarSign },
        { key: "routers", label: "Routers Online", value: `${kpis.activeRouters}/${kpis.totalRouters}`, icon: Router },
        { key: "totalGuests", label: "Total Guests", value: kpis.totalGuests.toLocaleString(), icon: UserCheck },
        { key: "reminders", label: "Billing Reminders", value: String(reminders.length), icon: AlertTriangle, accent: reminders.length > 0 },
        { key: "trials", label: "Trials", value: String(billingKpis.trialOrganizations), icon: Sparkles },
      ]
    : [];

  return (
    <MasterShell title="Platform Overview">
      <MSectionHeader
        eyebrow="Wyfy Guest · Operator"
        title="Platform Overview"
        actions={
          <Link to="/master/customers">
            <MButton variant="primary"><Plus /> Add Customer</MButton>
          </Link>
        }
      />

      {analytics.isLoading || billing.isLoading ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-24 animate-pulse rounded-xl border border-border bg-card" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {KPI_TILES.map((k) => <MStat key={k.key} label={k.label} value={k.value} icon={k.icon} accent={k.accent} />)}
        </div>
      )}

      {/* Charts */}
      <div className="grid gap-3 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm lg:col-span-2">
          <div className="mb-3 flex items-center justify-between border-b border-border pb-2">
            <p className="text-sm font-semibold">Revenue Trend</p>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={billing.data?.revenue.trend ?? []} margin={{ left: -18, right: 6, top: 6, bottom: 0 }}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} width={44} />
              <Tooltip
                contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", background: "var(--popover)", fontSize: 12, boxShadow: "0 4px 16px -4px rgb(0 0 0 / 0.12)" }}
                labelStyle={{ fontWeight: 600 }}
              />
              <Bar dataKey="revenue" fill="var(--primary)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between border-b border-border pb-2">
            <p className="text-sm font-semibold">Subscribers by Plan Tier</p>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={planDistribution} margin={{ left: -22, right: 6, top: 6, bottom: 0 }}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="tier" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} width={44} allowDecimals={false} />
              <Tooltip
                cursor={{ fill: "var(--accent)" }}
                contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", background: "var(--popover)", fontSize: 12, boxShadow: "0 4px 16px -4px rgb(0 0 0 / 0.12)" }}
              />
              <Bar dataKey="count" fill="var(--primary)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent customers + billing reminders */}
      <div className="grid gap-3 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold">Organizations</p>
            <Link to="/master/customers" className="inline-flex items-center gap-1 text-xs font-medium text-primary">
              View all <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <MTable head={<><MTh>Customer</MTh><MTh>Plan</MTh><MTh className="hidden sm:table-cell">Locations</MTh><MTh>Routers</MTh><MTh>MRR</MTh><MTh>Status</MTh></>}>
            {recent.map((c) => (
              <MTr key={c.id}>
                <MTd><p className="font-semibold">{c.name}</p></MTd>
                <MTd className="text-sm">{c.sub?.planName ?? "—"}</MTd>
                <MTd className="hidden tabular-nums sm:table-cell">{c.activeLocations}</MTd>
                <MTd className="tabular-nums">{c.activeRouters}</MTd>
                <MTd className="font-semibold tabular-nums">{c.sub ? money(c.sub.amount) : "—"}</MTd>
                <MTd>{c.sub ? <MTag label={c.sub.status} /> : <MTag label="no plan" />}</MTd>
              </MTr>
            ))}
            {recent.length === 0 && (
              <MTr><MTd className="py-8 text-center text-muted-foreground">No organizations yet.</MTd></MTr>
            )}
          </MTable>
        </div>

        <div>
          <p className="mb-2 text-sm font-semibold">Billing Reminders</p>
          <div className="rounded-xl border border-border bg-card shadow-sm">
            {reminders.length === 0 ? (
              <p className="p-3.5 text-sm text-muted-foreground">Nothing needs attention.</p>
            ) : reminders.slice(0, 4).map((r) => (
              <div key={r.id} className="flex items-start gap-3 border-b border-border/70 p-3.5 last:border-0">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{r.title}</p>
                  <p className="text-xs text-muted-foreground">{r.organizationName}</p>
                </div>
                <MTag label={r.severity} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </MasterShell>
  );
}
