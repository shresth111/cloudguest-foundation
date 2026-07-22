import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { WidgetCard } from "./WidgetCard";
import {
  useRecentAudit,
  useRecentLocations,
  useRecentOrgs,
  useRecentRouters,
} from "@/hooks/useDashboardData";
import { Wifi } from "lucide-react";

interface BadgeTone {
  label: string;
  className: string;
}

const ORG_STATUS_BADGE: Record<string, BadgeTone> = {
  active: { label: "Active", className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/20" },
  trial: { label: "Trial", className: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/20" },
  suspended: { label: "Suspended", className: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/20" },
  archived: { label: "Archived", className: "bg-muted text-muted-foreground border-border" },
};

const ROUTER_STATUS_BADGE: Record<string, BadgeTone> = {
  pending_provisioning: { label: "Pending", className: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/20" },
  provisioning: { label: "Provisioning", className: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/20" },
  online: { label: "Online", className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/20" },
  offline: { label: "Offline", className: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/20" },
  suspended: { label: "Suspended", className: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/20" },
  decommissioned: { label: "Decommissioned", className: "bg-muted text-muted-foreground border-border" },
};

const DEFAULT_BADGE: BadgeTone = { label: "Unknown", className: "bg-muted text-muted-foreground border-border" };

function toneFor(map: Record<string, BadgeTone>, status: string): BadgeTone {
  return map[status] ?? { ...DEFAULT_BADGE, label: status };
}

function orgStatusBadge(status: string) {
  const tone = toneFor(ORG_STATUS_BADGE, status);
  return <Badge variant="outline" className={tone.className}>{tone.label}</Badge>;
}

function routerStatusBadge(status: string) {
  const tone = toneFor(ROUTER_STATUS_BADGE, status);
  return <Badge variant="outline" className={tone.className}>{tone.label}</Badge>;
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
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data?.map((o) => (
            <TableRow key={o.id}>
              <TableCell>
                <div className="font-medium">{o.name}</div>
                <div className="text-xs text-muted-foreground">{new Date(o.createdAt).toLocaleString()}</div>
              </TableCell>
              <TableCell><Badge variant="secondary">{o.plan ?? "—"}</Badge></TableCell>
              <TableCell>{orgStatusBadge(o.status)}</TableCell>
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
              <div className="truncate text-xs text-muted-foreground">{l.organizationName} · {l.city}</div>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <span className="text-xs text-muted-foreground">{new Date(l.createdAt).toLocaleString()}</span>
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
                <div className="truncate font-mono text-sm font-medium">{r.serialNumber}</div>
                <div className="truncate text-xs text-muted-foreground">{r.model} · {r.organizationName}</div>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <span className="text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleString()}</span>
              {routerStatusBadge(r.status)}
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
                <span className="font-medium capitalize">{a.action.replace(/_/g, " ")}</span>{" "}
                <span className="text-muted-foreground">{a.entityType}</span>
              </p>
              {a.description && <p className="text-xs text-muted-foreground">{a.description}</p>}
              <p className="text-xs text-muted-foreground">{new Date(a.createdAt).toLocaleString()}</p>
            </div>
          </li>
        ))}
      </ul>
    </WidgetCard>
  );
}
