import { useMemo, useState } from "react";
import { format } from "date-fns";
import {
  Search, ArrowUpDown, ChevronLeft, ChevronRight, Wifi, XCircle, Eye,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { RightDrawer } from "@/components/ui-ext/RightDrawer";
import { cn } from "@/lib/utils";

interface Session {
  id: string;
  username: string;
  mac: string;
  ip: string;
  ssid: string;
  nas: string;
  router: string;
  device: string;
  signal: number;
  sessionTime: number;
  download: number;
  upload: number;
  status: "active" | "idle" | "disconnected";
}

const DEVICES = ["iPhone 15", "Samsung Galaxy S24", "MacBook Pro", "Pixel 8", "iPad Air", "Windows Laptop", "Xiaomi 14", "OnePlus 12"];
const ROUTERS = ["GW-01 (Mumbai)", "GW-02 (Mumbai)", "GW-03 (Delhi)", "GW-04 (Bangalore)", "GW-05 (Chennai)"];
const SSIDS = ["CloudGuest-Corporate", "CloudGuest-Guest", "CloudGuest-IoT", "CloudGuest-VIP"];

function rand<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

const SESSIONS: Session[] = Array.from({ length: 45 }, (_, i) => ({
  id: `sess-${i + 1}`,
  username: `user${i + 1}@email.com`,
  mac: `00:1A:${String(2 + i).padStart(2, "0")}:${String(3 + i).padStart(2, "0")}:${String(i).padStart(2, "0")}:${String(i * 3).slice(-2).padStart(2, "0")}`,
  ip: `10.0.${Math.floor(i / 10)}.${100 + i}`,
  ssid: rand(SSIDS),
  nas: `NAS-${String(Math.floor(i / 5) + 1).padStart(2, "0")}`,
  router: rand(ROUTERS),
  device: rand(DEVICES),
  signal: Math.floor(Math.random() * 40) + 60,
  sessionTime: Math.floor(Math.random() * 36000),
  download: Math.floor(Math.random() * 50000),
  upload: Math.floor(Math.random() * 15000),
  status: i < 30 ? "active" : i < 38 ? "idle" : "disconnected",
}));

const PAGE_SIZE = 10;

function formatBytes(bytes: number): string {
  if (bytes >= 1000) return `${(bytes / 1000).toFixed(1)} MB`;
  return `${bytes.toFixed(0)} KB`;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function LiveSessionExplorer() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortKey, setSortKey] = useState<keyof Session>("sessionTime");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(0);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);

  const filtered = useMemo(() => {
    let items = [...SESSIONS];
    if (search) {
      const q = search.toLowerCase();
      items = items.filter((s) =>
        s.username.toLowerCase().includes(q) ||
        s.mac.toLowerCase().includes(q) ||
        s.ip.toLowerCase().includes(q) ||
        s.router.toLowerCase().includes(q)
      );
    }
    if (statusFilter !== "all") items = items.filter((s) => s.status === statusFilter);
    items.sort((a, b) => {
      const av = a[sortKey] ?? "";
      const bv = b[sortKey] ?? "";
      if (typeof av === "string") return sortDir === "asc" ? av.localeCompare(bv as string) : (bv as string).localeCompare(av);
      return sortDir === "asc" ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
    return items;
  }, [search, statusFilter, sortKey, sortDir]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageItems = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const toggleSort = (key: keyof Session) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
    setPage(0);
  };

  const SortHeader = ({ column, label }: { column: keyof Session; label: string }) => (
    <TableHead className="cursor-pointer select-none" onClick={() => toggleSort(column)}>
      <div className="flex items-center gap-1">
        {label}
        <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
      </div>
    </TableHead>
  );

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search username, MAC, IP…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            className="h-9 pl-8"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
          <SelectTrigger className="w-36 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="idle">Idle</SelectItem>
            <SelectItem value="disconnected">Disconnected</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">
          {filtered.length} session{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <SortHeader column="username" label="Username" />
              <SortHeader column="mac" label="MAC" />
              <SortHeader column="ip" label="IP" />
              <SortHeader column="ssid" label="SSID" />
              <SortHeader column="nas" label="NAS" />
              <SortHeader column="router" label="Router" />
              <SortHeader column="device" label="Device" />
              <SortHeader column="signal" label="Signal" />
              <SortHeader column="sessionTime" label="Time" />
              <SortHeader column="download" label="Download" />
              <SortHeader column="upload" label="Upload" />
              <SortHeader column="status" label="Status" />
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={13} className="py-12 text-center text-sm text-muted-foreground">
                  No sessions found
                </TableCell>
              </TableRow>
            ) : (
              pageItems.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.username}</TableCell>
                  <TableCell className="font-mono text-xs">{s.mac}</TableCell>
                  <TableCell className="font-mono text-xs">{s.ip}</TableCell>
                  <TableCell className="text-xs">{s.ssid}</TableCell>
                  <TableCell className="text-xs">{s.nas}</TableCell>
                  <TableCell className="text-xs">{s.router}</TableCell>
                  <TableCell className="text-xs">{s.device}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <div className={cn(
                        "h-1.5 w-8 rounded-full",
                        s.signal > 85 ? "bg-emerald-500" : s.signal > 70 ? "bg-amber-500" : "bg-rose-500",
                      )} style={{ width: `${s.signal}%` }} />
                      <span className="text-xs text-muted-foreground">{s.signal}%</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs">{formatDuration(s.sessionTime)}</TableCell>
                  <TableCell className="text-xs">{formatBytes(s.download)}</TableCell>
                  <TableCell className="text-xs">{formatBytes(s.upload)}</TableCell>
                  <TableCell>
                    <Badge variant={s.status === "active" ? "default" : s.status === "idle" ? "secondary" : "outline"} className="capitalize">
                      {s.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelectedSession(s)}>
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive">
                        <XCircle className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            Page {page + 1} of {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            {Array.from({ length: Math.min(totalPages, 5) }).map((_, i) => (
              <Button
                key={i}
                variant={page === i ? "default" : "outline"}
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setPage(i)}
              >
                {i + 1}
              </Button>
            ))}
            <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Detail drawer */}
      <RightDrawer
        open={!!selectedSession}
        onOpenChange={() => setSelectedSession(null)}
        title={selectedSession?.username ?? ""}
        description="Session details"
        size="md"
      >
        {selectedSession && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "MAC", value: selectedSession.mac },
                { label: "IP", value: selectedSession.ip },
                { label: "SSID", value: selectedSession.ssid },
                { label: "Router", value: selectedSession.router },
                { label: "Device", value: selectedSession.device },
                { label: "Signal", value: `${selectedSession.signal}%` },
                { label: "Duration", value: formatDuration(selectedSession.sessionTime) },
                { label: "Download", value: formatBytes(selectedSession.download) },
                { label: "Upload", value: formatBytes(selectedSession.upload) },
              ].map((f) => (
                <div key={f.label} className="rounded-lg bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">{f.label}</p>
                  <p className="mt-0.5 text-sm font-medium">{f.value}</p>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Button variant="destructive" size="sm" className="flex-1">
                <XCircle className="mr-2 h-4 w-4" /> Disconnect
              </Button>
              <Button variant="outline" size="sm" className="flex-1">
                Block device
              </Button>
            </div>
          </div>
        )}
      </RightDrawer>
    </div>
  );
}
