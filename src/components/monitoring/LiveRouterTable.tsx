import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Download,
  MoreHorizontal,
  Pause,
  Play,
  RefreshCw,
  Search,
  ArrowUpDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { HealthBadge } from "./MonitoringBadges";
import { useLiveRouters, useRestartRouter } from "@/hooks/useMonitoring";
import type { LiveRouterRow } from "@/types/monitoring";
import { cn } from "@/lib/utils";

type SortKey = "name" | "cpu" | "memory" | "temperature" | "latencyMs" | "packetLoss" | "activeGuests" | "uptimeHours";

const PAGE_SIZE = 10;

export function LiveRouterTable() {
  const [autoRefresh, setAutoRefresh] = useState(true);
  const { data, isLoading, isError, refetch } = useLiveRouters(autoRefresh ? 10000 : false);
  const restart = useRestartRouter();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "name", dir: "asc" });
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const list = (data ?? []).filter((r) => {
      const q = search.toLowerCase();
      const matchesQ = !q || r.name.toLowerCase().includes(q) || r.organization.toLowerCase().includes(q) || r.location.toLowerCase().includes(q);
      const matchesS = statusFilter === "all" || r.status === statusFilter;
      return matchesQ && matchesS;
    });
    return [...list].sort((a, b) => {
      const av = a[sort.key] as number | string;
      const bv = b[sort.key] as number | string;
      if (av < bv) return sort.dir === "asc" ? -1 : 1;
      if (av > bv) return sort.dir === "asc" ? 1 : -1;
      return 0;
    });
  }, [data, search, statusFilter, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const toggleSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));

  const exportCsv = () => {
    const headers = ["Name", "Organization", "Location", "WAN", "CPU", "Memory", "Temperature", "Latency", "PacketLoss", "Guests", "Uptime(h)", "Status", "LastHeartbeat"];
    const rows = filtered.map((r) => [
      r.name, r.organization, r.location, r.wanStatus, r.cpu, r.memory, r.temperature, r.latencyMs, r.packetLoss, r.activeGuests, r.uptimeHours, r.status, r.lastHeartbeat,
    ].join(","));
    const blob = new Blob([[headers.join(","), ...rows].join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "live-routers.csv";
    a.click();
    toast.success("Export ready");
  };

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b p-3">
        <div className="flex flex-1 items-center gap-2">
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search routers…" className="pl-8" />
          </div>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="online">Online</SelectItem>
              <SelectItem value="offline">Offline</SelectItem>
              <SelectItem value="maintenance">Maintenance</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setAutoRefresh((v) => !v)}>
            {autoRefresh ? <Pause className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />}
            {autoRefresh ? "Pause auto-refresh" : "Resume auto-refresh"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh
          </Button>
          <Button size="sm" variant="outline" onClick={exportCsv}>
            <Download className="mr-2 h-4 w-4" /> Export CSV
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2 p-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-md" />)}
        </div>
      ) : isError ? (
        <div className="p-6"><ErrorState onRetry={refetch} /></div>
      ) : filtered.length === 0 ? (
        <div className="p-6"><EmptyState title="No routers match" description="Try adjusting your filters or search." /></div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <SortHead label="Router" onClick={() => toggleSort("name")} />
                <TableHead>Organization</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>WAN</TableHead>
                <SortHead label="CPU" onClick={() => toggleSort("cpu")} />
                <SortHead label="Memory" onClick={() => toggleSort("memory")} />
                <SortHead label="Temp" onClick={() => toggleSort("temperature")} />
                <SortHead label="Latency" onClick={() => toggleSort("latencyMs")} />
                <SortHead label="Loss" onClick={() => toggleSort("packetLoss")} />
                <SortHead label="Guests" onClick={() => toggleSort("activeGuests")} />
                <SortHead label="Uptime" onClick={() => toggleSort("uptimeHours")} />
                <TableHead>Heartbeat</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageRows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell className="text-muted-foreground">{r.organization}</TableCell>
                  <TableCell className="text-muted-foreground">{r.location}</TableCell>
                  <TableCell>
                    <HealthBadge status={r.wanStatus === "up" ? "healthy" : r.wanStatus === "degraded" ? "degraded" : "down"} />
                  </TableCell>
                  <MetricCell value={r.cpu} unit="%" danger={70} />
                  <MetricCell value={r.memory} unit="%" danger={80} />
                  <MetricCell value={r.temperature} unit="°C" danger={70} />
                  <TableCell className={cn(r.latencyMs > 150 && "text-amber-600")}>{Math.round(r.latencyMs)} ms</TableCell>
                  <TableCell className={cn(r.packetLoss > 2 && "text-red-500")}>{r.packetLoss.toFixed(2)}%</TableCell>
                  <TableCell>{r.activeGuests}</TableCell>
                  <TableCell>{Math.round(r.uptimeHours)}h</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{timeAgo(r.lastHeartbeat)}</TableCell>
                  <TableCell>
                    <HealthBadge status={r.status === "online" ? "healthy" : r.status === "maintenance" ? "degraded" : "down"} />
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setConfirmId(r.id)}>Restart router</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toast.success(`Diagnostics started on ${r.name}`)}>Run diagnostics</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toast.success(`Logs opened for ${r.name}`)}>View logs</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="flex items-center justify-between gap-3 border-t p-3 text-xs text-muted-foreground">
        <span>{filtered.length} routers · Page {page} / {totalPages}</span>
        <div className="flex gap-1">
          <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Prev</Button>
          <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      </div>

      <ConfirmDialog
        open={!!confirmId}
        onOpenChange={(o) => !o && setConfirmId(null)}
        title="Restart router?"
        description="The router will enter maintenance mode and reconnect within ~60 seconds."
        destructive
        confirmLabel="Restart"
        onConfirm={() => {
          if (confirmId) restart.mutate(confirmId, { onSuccess: () => toast.success("Router restart queued") });
          setConfirmId(null);
        }}
      />
    </Card>
  );
}

function SortHead({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <TableHead>
      <button onClick={onClick} className="inline-flex items-center gap-1 hover:text-foreground">
        {label} <ArrowUpDown className="h-3 w-3" />
      </button>
    </TableHead>
  );
}

function MetricCell({ value, unit, danger }: { value: number; unit: string; danger: number }) {
  return (
    <TableCell>
      <div className="flex items-center gap-2">
        <div className="w-14">
          <Progress value={Math.min(100, value)} className={cn("h-1.5", value >= danger && "[&>div]:bg-red-500")} />
        </div>
        <span className={cn("tabular-nums text-xs", value >= danger && "text-red-500 font-medium")}>
          {Math.round(value)}{unit}
        </span>
      </div>
    </TableCell>
  );
}

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

// keep imports used
export type { LiveRouterRow };
