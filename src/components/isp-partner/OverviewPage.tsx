/** `/partner`: the ISP's portfolio at a glance (PRD §4.2). Every number is
 * `GET /isp/overview`; nothing here is a fixture. */
import { Link } from "@tanstack/react-router";
import { AlertTriangle, Building2, Cpu, MapPin, Router, Users, Wifi } from "lucide-react";
import {
  MEmptyState,
  MSectionHeader,
  MStat,
  MTable,
  MTag,
  MTd,
  MTh,
  MTr,
} from "@/components/master/MasterKit";
import { Card, ErrorBlock } from "@/components/isp-partner/kit";
import { useIspOverview } from "@/hooks/isp-partner/useIsp";
import { formatAgo, formatBytes, formatDateTime, formatNumber } from "@/lib/isp-partner/format";
import type { IspAttentionItem } from "@/services/isp-partner/types";

const ATTENTION_LABEL: Record<string, string> = {
  router_offline: "Router offline",
  router_pending: "Router never finished setup",
  cpe_silent: "CPE stopped checking in",
};

function AttentionLink({ item }: { item: IspAttentionItem }) {
  if (item.isp_router_id) {
    return (
      <Link
        to="/partner/routers/$ispRouterId"
        params={{ ispRouterId: item.isp_router_id }}
        className="font-medium text-primary hover:underline"
      >
        {item.label}
      </Link>
    );
  }
  if (item.cpe_id) {
    return (
      <Link
        to="/partner/tr069/$cpeId"
        params={{ cpeId: item.cpe_id }}
        className="font-medium text-primary hover:underline"
      >
        {item.label}
      </Link>
    );
  }
  return <span className="font-medium">{item.label}</span>;
}

export function OverviewPage() {
  const q = useIspOverview();
  const o = q.data;
  const loading = q.isLoading;

  return (
    <>
      <MSectionHeader
        eyebrow="Overview"
        title="Your network"
        description={
          o ? `Updated ${formatDateTime(o.generated_at)}. Refreshes every minute.` : undefined
        }
      />
      {q.error && !o ? (
        <ErrorBlock error={q.error} onRetry={() => q.refetch()} what="the overview" />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <MStat
              label="Customers"
              icon={Building2}
              loading={loading}
              value={o?.customers.total ?? 0}
              delta={
                o ? `${o.customers.active} active · ${o.customers.suspended} suspended` : undefined
              }
            />
            <MStat
              label="Locations"
              icon={MapPin}
              loading={loading}
              value={o?.locations.total ?? 0}
              delta={o ? `${o.locations.active} active` : undefined}
            />
            <MStat
              label="Routers online"
              icon={Router}
              tone={o && o.routers.offline > 0 ? "warning" : "success"}
              loading={loading}
              value={o ? `${o.routers.online} / ${o.routers.total}` : "–"}
              delta={
                o ? `${o.routers.offline} offline · ${o.routers.pending} awaiting setup` : undefined
              }
            />
            <MStat
              label="Guests today"
              icon={Users}
              loading={loading}
              value={o?.guests.today_unique ?? 0}
              delta={o ? "Unique guests, in your ISP's timezone" : undefined}
            />
            <MStat
              label="Active sessions"
              icon={Wifi}
              tone="info"
              loading={loading}
              value={o?.guests.active_sessions ?? 0}
            />
            <MStat
              label="TR-069 CPEs online"
              icon={Cpu}
              loading={loading}
              value={o ? `${o.cpes.online} / ${o.cpes.total}` : "–"}
              delta={o ? `${o.cpes.offline} offline · ${o.cpes.unassigned} unassigned` : undefined}
            />
          </div>

          {o && o.customers.total === 0 ? (
            <MEmptyState
              icon={Building2}
              title="No customers yet"
              description="Add your first customer, then a location and its MikroTik router. Everything you set up shows up here."
              action={
                <Link
                  to="/partner/customers"
                  className="rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground"
                >
                  Go to customers
                </Link>
              }
            />
          ) : (
            o && (
              <>
                <Card title={`Needs attention (${o.attention.length})`}>
                  {o.attention.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Nothing needs attention: no router offline for more than 15 minutes, none
                      stuck in setup for more than a day, and no silent CPEs.
                    </p>
                  ) : (
                    <ul className="divide-y divide-border">
                      {o.attention.map((a, i) => (
                        <li
                          key={`${a.kind}-${a.isp_router_id ?? a.cpe_id ?? i}`}
                          className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm"
                        >
                          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
                          <span className="text-xs font-medium text-muted-foreground">
                            {ATTENTION_LABEL[a.kind] ?? a.kind}
                          </span>
                          <AttentionLink item={a} />
                          <Link
                            to="/partner/customers/$ispCustomerId"
                            params={{ ispCustomerId: a.isp_customer_id }}
                            className="text-xs text-muted-foreground hover:underline"
                          >
                            {a.customer_name}
                          </Link>
                          <span className="ml-auto text-xs text-muted-foreground">
                            since {formatAgo(a.since)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>

                <MTable
                  head={
                    <>
                      <MTh>Customer</MTh>
                      <MTh>Status</MTh>
                      <MTh className="text-right">Locations</MTh>
                      <MTh className="text-right">Routers online</MTh>
                      <MTh className="text-right">Guests today</MTh>
                      <MTh className="text-right">Data today</MTh>
                    </>
                  }
                >
                  {o.per_customer.map((c) => (
                    <MTr key={c.isp_customer_id}>
                      <MTd>
                        <Link
                          to="/partner/customers/$ispCustomerId"
                          params={{ ispCustomerId: c.isp_customer_id }}
                          className="font-medium text-primary hover:underline"
                        >
                          {c.name}
                        </Link>
                      </MTd>
                      <MTd>
                        <MTag label={c.status} />
                      </MTd>
                      <MTd className="text-right tabular-nums">{formatNumber(c.locations)}</MTd>
                      <MTd className="text-right tabular-nums">
                        {c.routers_online} / {c.routers_total}
                      </MTd>
                      <MTd className="text-right tabular-nums">{formatNumber(c.guests_today)}</MTd>
                      <MTd className="text-right tabular-nums">{formatBytes(c.bytes_today)}</MTd>
                    </MTr>
                  ))}
                </MTable>
              </>
            )
          )}
        </>
      )}
    </>
  );
}
