import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  Building2, MapPin, Users, DollarSign, Router, Server, AlertTriangle, Timer, Plus, ArrowRight,
} from "lucide-react";
import { MasterShell } from "@/components/master/MasterShell";
import { MSectionHeader, MStat, MTag, MButton, MTable, MTh, MTd, MTr } from "@/components/master/MasterKit";
import { CUSTOMERS, PLATFORM_KPIS, REGIONS, SESSIONS_24H, TICKETS } from "@/lib/masterData";

export const Route = createFileRoute("/master/")({
  component: PlatformOverview,
});

const KPI_ICONS = [Building2, MapPin, Users, DollarSign, Router, Server, AlertTriangle, Timer];

function PlatformOverview() {
  const recent = CUSTOMERS.slice(0, 5);
  const incidents = TICKETS.filter((t) => t.status !== "Resolved").slice(0, 4);

  return (
    <MasterShell title="Platform Overview">
      <MSectionHeader
        eyebrow="CloudGuest · Operator"
        title="Platform Overview"
        actions={
          <Link to="/master/customers">
            <MButton variant="primary"><Plus /> Add Customer</MButton>
          </Link>
        }
      />

      {/* 8-KPI grid */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {PLATFORM_KPIS.map((k, i) => {
          const Icon = KPI_ICONS[i];
          return <MStat key={k.key} label={k.label} value={k.value} delta={k.delta} icon={Icon} accent={k.key === "incidents"} />;
        })}
      </div>

      {/* Charts */}
      <div className="grid gap-3 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm lg:col-span-2">
          <div className="mb-3 flex items-center justify-between border-b border-border pb-2">
            <p className="text-sm font-semibold">Platform Sessions · 24h</p>
            <span className="text-xs font-medium text-muted-foreground">peak 3,520</span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={SESSIONS_24H} margin={{ left: -18, right: 6, top: 6, bottom: 0 }}>
              <defs>
                <linearGradient id="sess" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="hour" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} interval={3} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} width={44} />
              <Tooltip
                contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", background: "var(--popover)", fontSize: 12, boxShadow: "0 4px 16px -4px rgb(0 0 0 / 0.12)" }}
                labelStyle={{ fontWeight: 600 }}
              />
              <Area type="monotone" dataKey="sessions" stroke="var(--primary)" strokeWidth={2} fill="url(#sess)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between border-b border-border pb-2">
            <p className="text-sm font-semibold">Tenants by Region</p>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={REGIONS} margin={{ left: -22, right: 6, top: 6, bottom: 0 }}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="region" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} width={44} allowDecimals={false} />
              <Tooltip
                cursor={{ fill: "var(--accent)" }}
                contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", background: "var(--popover)", fontSize: 12, boxShadow: "0 4px 16px -4px rgb(0 0 0 / 0.12)" }}
              />
              <Bar dataKey="tenants" fill="var(--primary)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent customers + incidents */}
      <div className="grid gap-3 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold">Recently Active Customers</p>
            <Link to="/master/customers" className="inline-flex items-center gap-1 text-xs font-medium text-primary">
              View all <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <MTable head={<><MTh>Customer</MTh><MTh>Plan</MTh><MTh className="hidden sm:table-cell">Locations</MTh><MTh>Online</MTh><MTh>MRR</MTh><MTh>Status</MTh></>}>
            {recent.map((c) => (
              <MTr key={c.id}>
                <MTd>
                  <p className="font-semibold">{c.name}</p>
                  <p className="text-xs text-muted-foreground">{c.type} · {c.region}</p>
                </MTd>
                <MTd className="text-sm">{c.plan}</MTd>
                <MTd className="hidden tabular-nums sm:table-cell">{c.locations}</MTd>
                <MTd className="tabular-nums">{c.online}</MTd>
                <MTd className="font-semibold tabular-nums">${c.mrr}</MTd>
                <MTd><MTag label={c.status} /></MTd>
              </MTr>
            ))}
          </MTable>
        </div>

        <div>
          <p className="mb-2 text-sm font-semibold">System Incidents</p>
          <div className="rounded-xl border border-border bg-card shadow-sm">
            {incidents.map((t) => (
              <div key={t.id} className="flex items-start gap-3 border-b border-border/70 p-3.5 last:border-0">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{t.subject}</p>
                  <p className="text-xs text-muted-foreground">{t.customer} · {t.updated}</p>
                </div>
                <MTag label={t.priority} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </MasterShell>
  );
}
