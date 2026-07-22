import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Eye, Power, Router as RouterIcon, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageShell, SectionHeader } from "@/components/ui-ext";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { useActivateNas, useAllNas, useDeleteNas, useDisableNas } from "@/hooks/useNas";
import { NAS_STATUS_LABEL, type NasStatus } from "@/types/nas";
import type { AppError } from "@/services/api";

export const Route = createFileRoute("/_authenticated/nas/")({
  component: NasManagementPage,
});

const STATUS_VARIANT: Record<NasStatus, "default" | "secondary" | "destructive" | "outline"> = {
  active: "default",
  pending: "secondary",
  disabled: "outline",
  suspended: "secondary",
  deleted: "destructive",
};

function NasManagementPage() {
  const [search, setSearch] = useState("");
  const nas = useAllNas();
  const activate = useActivateNas();
  const disable = useDisableNas();
  const remove = useDeleteNas();
  const [confirm, setConfirm] = useState<null | {
    title: string;
    description: string;
    destructive?: boolean;
    onConfirm: () => void;
  }>(null);

  const filtered = useMemo(() => {
    const rows = nas.data ?? [];
    const s = search.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) =>
      [r.nasCode, r.nasIdentifier, r.name, r.locationName, r.organizationName].some((v) =>
        (v ?? "").toLowerCase().includes(s),
      ),
    );
  }, [nas.data, search]);

  async function handleActivate(nasId: string) {
    try {
      await activate.mutateAsync(nasId);
      toast.success("NAS activated");
    } catch (err) {
      toast.error((err as unknown as AppError).message || "Failed to activate NAS");
    }
  }

  async function handleDisable(nasId: string) {
    try {
      await disable.mutateAsync({ nasId });
      toast.success("NAS disabled");
    } catch (err) {
      toast.error((err as unknown as AppError).message || "Failed to disable NAS");
    }
  }

  async function handleDelete(nasId: string) {
    try {
      await remove.mutateAsync(nasId);
      toast.success("NAS deleted");
    } catch (err) {
      toast.error((err as unknown as AppError).message || "Failed to delete NAS");
    }
  }

  return (
    <PageShell mesh>
      <SectionHeader
        eyebrow="Infrastructure"
        title="NAS Management"
        description="Every registered RADIUS client across every organization and location."
        actions={
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search identifier, code, location…"
              className="w-72 pl-8"
            />
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
                  <TableHead>Name</TableHead>
                  <TableHead>NAS code</TableHead>
                  <TableHead>NAS identifier</TableHead>
                  <TableHead>Organization</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Router</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((n) => (
                  <TableRow key={n.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <RouterIcon className="h-4 w-4 text-muted-foreground" />
                        {n.name ?? "Unnamed"}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{n.nasCode ?? "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{n.nasIdentifier}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {n.organizationName}
                    </TableCell>
                    <TableCell>
                      <Link
                        to="/locations/$locationId"
                        params={{ locationId: n.locationId }}
                        className="text-primary hover:underline"
                      >
                        {n.locationName}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link
                        to="/routers/$routerId"
                        params={{ routerId: n.routerId }}
                        className="text-primary hover:underline"
                      >
                        View router
                      </Link>
                    </TableCell>
                    <TableCell>{n.vendor}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[n.status]}>{NAS_STATUS_LABEL[n.status]}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(n.createdAt).toLocaleDateString()}
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
                        {(n.status === "pending" ||
                          n.status === "disabled" ||
                          n.status === "suspended") && (
                          <Button size="icon" variant="ghost" onClick={() => handleActivate(n.id)}>
                            <Power className="h-4 w-4" />
                          </Button>
                        )}
                        {(n.status === "pending" || n.status === "active") && (
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() =>
                              setConfirm({
                                title: `Disable ${n.nasCode ?? n.nasIdentifier}?`,
                                description: "Guest authentication through this NAS will stop.",
                                onConfirm: () => handleDisable(n.id),
                              })
                            }
                          >
                            <Power className="h-4 w-4" />
                          </Button>
                        )}
                        {n.status !== "deleted" && (
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() =>
                              setConfirm({
                                title: `Delete ${n.nasCode ?? n.nasIdentifier}?`,
                                description: "This permanently removes the NAS registration.",
                                destructive: true,
                                onConfirm: () => handleDelete(n.id),
                              })
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && !nas.isLoading && (
                  <TableRow>
                    <TableCell
                      colSpan={10}
                      className="py-12 text-center text-sm text-muted-foreground"
                    >
                      No NAS devices match your search.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={confirm?.title ?? ""}
        description={confirm?.description ?? ""}
        destructive={confirm?.destructive}
        onConfirm={() => {
          confirm?.onConfirm();
          setConfirm(null);
        }}
      />
    </PageShell>
  );
}
