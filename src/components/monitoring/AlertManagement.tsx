import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Search, UserPlus, Check, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { SeverityBadge, AlertStatusBadge } from "./MonitoringBadges";
import { useAlerts, useAssignAlert, useSetAlertStatus } from "@/hooks/useMonitoring";
import type { AlertSeverity, AlertStatus } from "@/types/monitoring";

const ENGINEERS = ["Priya Shah", "Marco Rossi", "Ada Chen", "Kenji Tanaka", "Lucas Silva"];

export function AlertManagement() {
  const { data, isLoading, isError, refetch } = useAlerts();
  const setStatus = useSetAlertStatus();
  const assign = useAssignAlert();

  const [q, setQ] = useState("");
  const [sev, setSev] = useState<string>("all");
  const [st, setSt] = useState<string>("all");

  const filtered = useMemo(() => {
    return (data ?? []).filter((a) => {
      const ql = q.toLowerCase();
      const matchesQ = !ql || a.name.toLowerCase().includes(ql) || a.router.toLowerCase().includes(ql) || a.organization.toLowerCase().includes(ql);
      const matchesSev = sev === "all" || a.severity === (sev as AlertSeverity);
      const matchesSt = st === "all" || a.status === (st as AlertStatus);
      return matchesQ && matchesSev && matchesSt;
    });
  }, [data, q, sev, st]);

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b p-3">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search alerts…" className="pl-8" />
        </div>
        <Select value={sev} onValueChange={setSev}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Severity" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All severity</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="info">Info</SelectItem>
          </SelectContent>
        </Select>
        <Select value={st} onValueChange={setSt}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="acknowledged">Acknowledged</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
          </SelectContent>
        </Select>
        <div className="ml-auto text-xs text-muted-foreground">{filtered.length} alerts</div>
      </div>

      {isLoading ? (
        <div className="space-y-2 p-4">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-md" />)}</div>
      ) : isError ? (
        <div className="p-6"><ErrorState onRetry={refetch} /></div>
      ) : filtered.length === 0 ? (
        <div className="p-6"><EmptyState title="No alerts" description="All systems are operating within thresholds." /></div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Alert</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Organization</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Router</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Assigned</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="max-w-xs">
                    <div className="font-medium">{a.name}</div>
                    <div className="truncate text-xs text-muted-foreground">{a.message}</div>
                  </TableCell>
                  <TableCell><SeverityBadge severity={a.severity} /></TableCell>
                  <TableCell className="text-muted-foreground">{a.organization}</TableCell>
                  <TableCell className="text-muted-foreground">{a.location}</TableCell>
                  <TableCell>{a.router}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{new Date(a.createdAt).toLocaleString()}</TableCell>
                  <TableCell><AlertStatusBadge status={a.status} /></TableCell>
                  <TableCell className="text-xs">{a.assignedEngineer ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="sm" variant="ghost">Actions</Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setStatus.mutate({ id: a.id, status: "acknowledged" }, { onSuccess: () => toast.success("Alert acknowledged") })}>
                          <Check className="mr-2 h-4 w-4" /> Acknowledge
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setStatus.mutate({ id: a.id, status: "resolved" }, { onSuccess: () => toast.success("Alert resolved") })}>
                          <Check className="mr-2 h-4 w-4" /> Resolve
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setStatus.mutate({ id: a.id, status: "open" }, { onSuccess: () => toast.success("Alert reopened") })}>
                          <RotateCcw className="mr-2 h-4 w-4" /> Reopen
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuLabel className="text-xs">Assign engineer</DropdownMenuLabel>
                        {ENGINEERS.map((e) => (
                          <DropdownMenuItem key={e} onClick={() => assign.mutate({ id: a.id, engineer: e }, { onSuccess: () => toast.success(`Assigned to ${e}`) })}>
                            <UserPlus className="mr-2 h-4 w-4" /> {e}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </Card>
  );
}
