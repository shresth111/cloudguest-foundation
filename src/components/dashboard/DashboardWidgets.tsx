import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { WidgetCard } from "./WidgetCard";
import {
  useRecentAudit,
  useRecentLocations,
  useRecentOrgs,
  useRecentPayments,
  useRecentRouters,
  useRecentSessions,
  useRecentTickets,
} from "@/hooks/useDashboardData";
import type { EntityStatus, NotificationItem } from "@/types/dashboard";
import { AlertOctagon, Bell, CreditCard, Info, ShieldAlert, Wifi } from "lucide-react";

function statusBadge(status: EntityStatus) {
  const map: Record<EntityStatus, { label: string; className: string }> = {
    active:    { label: "Active",    className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/20" },
    online:    { label: "Online",    className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/20" },
    paid:      { label: "Paid",      className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/20" },
    resolved:  { label: "Resolved",  className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/20" },
    inactive:  { label: "Inactive",  className: "bg-muted text-muted-foreground border-border" },
    pending:   { label: "Pending",   className: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/20" },
    warning:   { label: "Warning",   className: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/20" },
    open:      { label: "Open",      className: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/20" },
    offline:   { label: "Offline",   className: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/20" },
    failed:    { label: "Failed",    className: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/20" },
  };
  const v = map[status];
  return <Badge variant="outline" className={v.className}>{v.label}</Badge>;
}

function ViewAll() {
  return <Button variant="ghost" size="sm">View all</Button>;
}

export function RecentOrgsWidget() {
  const { data, isLoading, isError, refetch } = useRecentOrgs();
  return (
    <WidgetCard title="Recent organizations" action={<ViewAll />} isLoading={isLoading} isError={isError} isEmpty={!!data && data.length === 0} onRetry={() => refetch()}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Plan</TableHead>
            <TableHead className="hidden md:table-cell">Locations</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data?.map((o) => (
            <TableRow key={o.id}>
              <TableCell>
                <div className="font-medium">{o.name}</div>
                <div className="text-xs text-muted-foreground">{o.createdAt}</div>
              </TableCell>
              <TableCell><Badge variant="secondary">{o.plan}</Badge></TableCell>
              <TableCell className="hidden md:table-cell">{o.locations}</TableCell>
              <TableCell>{statusBadge(o.status)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </WidgetCard>
  );
}

export function RecentLocationsWidget() {
  const { data, isLoading, isError, refetch } = useRecentLocations();
  return (
    <WidgetCard title="Recently added locations" action={<ViewAll />} isLoading={isLoading} isError={isError} isEmpty={!!data && data.length === 0} onRetry={() => refetch()}>
      <ul className="divide-y divide-border">
        {data?.map((l) => (
          <li key={l.id} className="flex items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <div className="truncate font-medium">{l.name}</div>
              <div className="truncate text-xs text-muted-foreground">{l.org} · {l.city}</div>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <span className="text-xs text-muted-foreground">{l.addedAt}</span>
              {statusBadge(l.status)}
            </div>
          </li>
        ))}
      </ul>
    </WidgetCard>
  );
}

export function RecentRoutersWidget() {
  const { data, isLoading, isError, refetch } = useRecentRouters();
  return (
    <WidgetCard title="Latest router registrations" action={<ViewAll />} isLoading={isLoading} isError={isError} isEmpty={!!data && data.length === 0} onRetry={() => refetch()}>
      <ul className="divide-y divide-border">
        {data?.map((r) => (
          <li key={r.id} className="flex items-center justify-between gap-3 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-muted">
                <Wifi className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <div className="truncate font-mono text-sm font-medium">{r.serial}</div>
                <div className="truncate text-xs text-muted-foreground">{r.model} · {r.org}</div>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <span className="text-xs text-muted-foreground">{r.registeredAt}</span>
              {statusBadge(r.status)}
            </div>
          </li>
        ))}
      </ul>
    </WidgetCard>
  );
}

export function RecentSessionsWidget() {
  const { data, isLoading, isError, refetch } = useRecentSessions();
  return (
    <WidgetCard title="Latest guest sessions" action={<ViewAll />} isLoading={isLoading} isError={isError} isEmpty={!!data && data.length === 0} onRetry={() => refetch()}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Guest</TableHead>
            <TableHead className="hidden md:table-cell">Location</TableHead>
            <TableHead>Started</TableHead>
            <TableHead className="text-right">Duration</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data?.map((s) => (
            <TableRow key={s.id}>
              <TableCell>
                <div className="font-mono text-sm">{s.guest}</div>
                <div className="text-xs text-muted-foreground">{s.org}</div>
              </TableCell>
              <TableCell className="hidden md:table-cell">{s.location}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{s.startedAt}</TableCell>
              <TableCell className="text-right font-medium">{s.duration}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </WidgetCard>
  );
}

export function RecentPaymentsWidget() {
  const { data, isLoading, isError, refetch } = useRecentPayments();
  return (
    <WidgetCard title="Recent payments" action={<ViewAll />} isLoading={isLoading} isError={isError} isEmpty={!!data && data.length === 0} onRetry={() => refetch()}>
      <ul className="divide-y divide-border">
        {data?.map((p) => (
          <li key={p.id} className="flex items-center justify-between gap-3 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-muted">
                <CreditCard className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <div className="truncate font-medium">{p.org}</div>
                <div className="truncate text-xs text-muted-foreground">{p.method} · {p.paidAt}</div>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <span className="font-semibold">${p.amount.toLocaleString()}</span>
              {statusBadge(p.status)}
            </div>
          </li>
        ))}
      </ul>
    </WidgetCard>
  );
}

const PRIORITY_COLOR: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  high: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  urgent: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
};

export function RecentTicketsWidget() {
  const { data, isLoading, isError, refetch } = useRecentTickets();
  return (
    <WidgetCard title="Recent support tickets" action={<ViewAll />} isLoading={isLoading} isError={isError} isEmpty={!!data && data.length === 0} onRetry={() => refetch()}>
      <ul className="divide-y divide-border">
        {data?.map((t) => (
          <li key={t.id} className="flex items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <div className="truncate font-medium">{t.subject}</div>
              <div className="truncate text-xs text-muted-foreground">{t.org} · {t.updatedAt}</div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${PRIORITY_COLOR[t.priority]}`}>{t.priority}</span>
              {statusBadge(t.status)}
            </div>
          </li>
        ))}
      </ul>
    </WidgetCard>
  );
}

export function RecentAuditWidget() {
  const { data, isLoading, isError, refetch } = useRecentAudit();
  return (
    <WidgetCard title="Recent audit logs" action={<ViewAll />} isLoading={isLoading} isError={isError} isEmpty={!!data && data.length === 0} onRetry={() => refetch()}>
      <ul className="space-y-3">
        {data?.map((a) => (
          <li key={a.id} className="flex items-start gap-3">
            <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
            <div className="min-w-0 flex-1">
              <p className="text-sm">
                <span className="font-medium">{a.actor}</span>{" "}
                <span className="text-muted-foreground">{a.action}</span>{" "}
                <span className="font-medium">{a.target}</span>
              </p>
              <p className="text-xs text-muted-foreground">{a.at}</p>
            </div>
          </li>
        ))}
      </ul>
    </WidgetCard>
  );
}

const NOTIF_ICON = {
  alert: AlertOctagon,
  warning: ShieldAlert,
  billing: CreditCard,
  router: Wifi,
  subscription: Bell,
  system: Info,
} as const;

export function NotificationsWidget({ items, isLoading, isError, onRetry }: { items?: NotificationItem[]; isLoading?: boolean; isError?: boolean; onRetry?: () => void }) {
  return (
    <WidgetCard title="Recent notifications" action={<ViewAll />} isLoading={isLoading} isError={isError} isEmpty={!!items && items.length === 0} onRetry={onRetry}>
      <ul className="space-y-3">
        {items?.slice(0, 5).map((n) => {
          const Icon = NOTIF_ICON[n.kind];
          return (
            <li key={n.id} className="flex items-start gap-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-muted">
                <Icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-medium">{n.title}</p>
                  {n.unread && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />}
                </div>
                <p className="line-clamp-2 text-xs text-muted-foreground">{n.message}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{n.at}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </WidgetCard>
  );
}
