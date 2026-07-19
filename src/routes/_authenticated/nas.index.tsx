import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Router as RouterIcon, Search, Trash2, Power, Replace, Eye } from "lucide-react";
import { PageShell, SectionHeader } from "@/components/ui-ext";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { nasService } from "@/services/nas.service";
import { locationService } from "@/services/location.service";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/nas/")({
  component: NasManagementPage,
});

function NasManagementPage() {
  const [search, setSearch] = useState("");

  const locations = useQuery({
    queryKey: ["locations", "all"],
    queryFn: () => locationService.listAll(),
  });

  const seedIds = useMemo(
    () => (locations.data ?? []).slice(0, 20).map((l) => l.id),
    [locations.data],
  );

  const nas = useQuery({
    queryKey: ["nas", "all", seedIds],
    queryFn: () => nasService.listAllNas(seedIds),
    enabled: seedIds.length > 0,
  });

  const locNameById = useMemo(() => {
    const m = new Map<string, { name: string; org: string }>();
    (locations.data ?? []).forEach((l) => m.set(l.id, { name: l.name, org: l.organizationName }));
    return m;
  }, [locations.data]);

  const filtered = useMemo(() => {
    const rows = nas.data ?? [];
    const s = search.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) =>
      [r.id, r.nasIdentifier, r.routerIdentity, r.name, r.model, r.publicIp].some((v) =>
        String(v).toLowerCase().includes(s),
      ),
    );
  }, [nas.data, search]);

  return (
    <PageShell mesh>
      <SectionHeader
        eyebrow="Infrastructure"
        title="NAS Management"
        description="Every registered NAS across every customer and location. Platform Admin only."
        actions={
          <div className="flex gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search identifier, model, IP…"
                className="w-72 pl-8"
              />
            </div>
            <Button asChild variant="outline">
              <Link to="/nas/id-generator">Open NAS ID Generator</Link>
            </Button>
          </div>
        }
      />

      <Card>
        <CardContent className="p-0">
          {nas.isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Friendly Name</TableHead>
                  <TableHead>NAS Identifier</TableHead>
                  <TableHead>Router Identity</TableHead>
                  <TableHead>Customer / Org</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead>RouterOS</TableHead>
                  <TableHead>Public IP</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Seen</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((n) => {
                  const loc = locNameById.get(n.locationId);
                  return (
                    <TableRow key={`${n.locationId}-${n.id}`}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <RouterIcon className="h-4 w-4 text-muted-foreground" />
                          {n.name}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{n.id}</TableCell>
                      <TableCell className="font-mono text-xs">{n.routerIdentity}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{loc?.org ?? "—"}</TableCell>
                      <TableCell>
                        <Link
                          to="/locations/$locationId"
                          params={{ locationId: n.locationId }}
                          className="text-primary hover:underline"
                        >
                          {loc?.name ?? n.locationId}
                        </Link>
                      </TableCell>
                      <TableCell>{n.model}</TableCell>
                      <TableCell>{n.routerOsVersion}</TableCell>
                      <TableCell className="font-mono text-xs">{n.publicIp}</TableCell>
                      <TableCell>
                        <Badge
                          variant={n.status === "online" ? "default" : n.status === "degraded" ? "secondary" : "destructive"}
                        >
                          {n.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {n.status === "online" ? "moments ago" : "12 min ago"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" asChild>
                            <Link
                              to="/locations/$locationId/nas/$nasId"
                              params={{ locationId: n.locationId, nasId: n.id }}
                            >
                              <Eye className="h-4 w-4" />
                            </Link>
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => toast(`Replace ${n.id}`)}>
                            <Replace className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => toast(`Disabled ${n.id}`)}>
                            <Power className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => toast.error(`Delete ${n.id}`)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filtered.length === 0 && !nas.isLoading && (
                  <TableRow>
                    <TableCell colSpan={11} className="py-12 text-center text-sm text-muted-foreground">
                      No NAS devices match your search.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </PageShell>
  );
}
