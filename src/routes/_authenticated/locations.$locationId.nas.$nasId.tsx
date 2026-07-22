import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Copy, KeyRound, Power, RotateCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { ErrorState } from "@/components/common/ErrorState";
import { PageSkeleton } from "@/components/common/LoadingSkeleton";
import {
  useActivateNas,
  useDeleteNas,
  useDisableNas,
  useNas,
  useRegenerateNasSecret,
} from "@/hooks/useNas";
import { NAS_STATUS_LABEL } from "@/types/nas";
import type { AppError } from "@/services/api";

export const Route = createFileRoute("/_authenticated/locations/$locationId/nas/$nasId")({
  component: NasDetailPage,
});

const STATUS_TONE: Record<string, string> = {
  active: "border-emerald-500/30 text-emerald-600 dark:text-emerald-400",
  pending: "border-zinc-500/30 text-zinc-600 dark:text-zinc-400",
  disabled: "border-amber-500/30 text-amber-600 dark:text-amber-400",
  suspended: "border-fuchsia-500/30 text-fuchsia-600 dark:text-fuchsia-400",
  deleted: "border-rose-500/30 text-rose-600 dark:text-rose-400",
};

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground">{value}</dd>
    </div>
  );
}

function NasDetailPage() {
  const { locationId, nasId } = Route.useParams();
  const navigate = useNavigate();
  const { data: nas, isLoading, isError, refetch } = useNas(nasId);
  const activate = useActivateNas();
  const disable = useDisableNas();
  const regenerate = useRegenerateNasSecret();
  const remove = useDeleteNas();

  const [confirm, setConfirm] = useState<null | {
    title: string;
    description: string;
    onConfirm: () => void;
    destructive?: boolean;
  }>(null);
  const [disableReasonOpen, setDisableReasonOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [reveal, setReveal] = useState<string | null>(null);

  if (isLoading) return <PageSkeleton />;
  if (isError) return <ErrorState onRetry={() => refetch()} />;
  if (!nas)
    return <ErrorState title="NAS not found" description="This NAS may have been removed." />;

  // Mirrors the real backend's NasStatus transition graph: activate is legal
  // from pending/disabled/suspended, disable only from pending/active, and
  // delete from anything non-terminal. There is no direct "suspend" action
  // exposed by the API -- suspended is reached some other way -- so only the
  // transitions the backend actually offers are ever shown here.
  const canActivate =
    nas.status === "pending" || nas.status === "disabled" || nas.status === "suspended";
  const canDisable = nas.status === "pending" || nas.status === "active";
  const canDelete = nas.status !== "deleted";

  async function handleActivate() {
    try {
      await activate.mutateAsync(nasId);
      toast.success("NAS activated");
    } catch (err) {
      toast.error((err as unknown as AppError).message || "Failed to activate NAS");
    }
  }

  async function handleDisable() {
    try {
      await disable.mutateAsync({ nasId, reason: reason || undefined });
      toast.success("NAS disabled");
      setDisableReasonOpen(false);
      setReason("");
    } catch (err) {
      toast.error((err as unknown as AppError).message || "Failed to disable NAS");
    }
  }

  async function handleRegenerate() {
    try {
      const result = await regenerate.mutateAsync(nasId);
      setReveal(result.sharedSecret);
      toast.success("Secret regenerated");
    } catch (err) {
      toast.error((err as unknown as AppError).message || "Failed to regenerate secret");
    }
  }

  async function handleDelete() {
    try {
      await remove.mutateAsync(nasId);
      toast.success("NAS deleted");
      navigate({ to: "/locations/$locationId", params: { locationId }, search: { tab: "nas" } });
    } catch (err) {
      toast.error((err as unknown as AppError).message || "Failed to delete NAS");
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Link
          to="/locations/$locationId"
          params={{ locationId }}
          search={{ tab: "nas" }}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" /> Back to location
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">
            {nas.nasCode ?? nas.nasIdentifier}
          </h1>
          <Badge variant="outline" className={STATUS_TONE[nas.status] ?? ""}>
            {NAS_STATUS_LABEL[nas.status]}
          </Badge>
          <Badge variant="outline">{nas.vendor}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {nas.name ?? "Unnamed"} · {nas.organizationName} · {nas.locationName}
        </p>
      </div>

      {reveal && (
        <Card className="rounded-2xl border-primary/40 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-base">New shared secret — shown once</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between gap-3 rounded-lg bg-background/70 px-3 py-2">
              <code className="text-sm">{reveal}</code>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  navigator.clipboard.writeText(reveal);
                  toast.success("Copied");
                }}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Configure the router's RADIUS client with this secret now — it will not be shown
              again.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="rounded-2xl border-border/70">
          <CardHeader>
            <CardTitle className="text-base">Device</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              A NAS wraps exactly one router. Device details (model, firmware, IPs) live on the
              router's own record.
            </p>
            <Button asChild variant="outline" size="sm">
              <Link to="/routers/$routerId" params={{ routerId: nas.routerId }}>
                View router
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/70">
          <CardHeader>
            <CardTitle className="text-base">Identity</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
              <Field label="NAS identifier" value={nas.nasIdentifier} />
              <Field label="IP address" value={nas.ipAddress ?? "—"} />
              <Field label="Description" value={nas.description ?? "—"} />
              <Field label="Created" value={new Date(nas.createdAt).toLocaleString()} />
              <Field label="Updated" value={new Date(nas.updatedAt).toLocaleString()} />
            </dl>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl border-border/70">
        <CardHeader>
          <CardTitle className="text-base">Actions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {canActivate && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleActivate}
              disabled={activate.isPending}
            >
              <Power className="h-4 w-4" /> <span className="ml-2">Activate</span>
            </Button>
          )}
          {canDisable && (
            <Button size="sm" variant="outline" onClick={() => setDisableReasonOpen(true)}>
              <Power className="h-4 w-4" /> <span className="ml-2">Disable</span>
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={handleRegenerate}
            disabled={regenerate.isPending}
          >
            <RotateCw className="h-4 w-4" /> <span className="ml-2">Regenerate secret</span>
          </Button>
          {canDelete && (
            <Button
              size="sm"
              variant="destructive"
              onClick={() =>
                setConfirm({
                  title: `Delete ${nas.nasCode ?? nas.nasIdentifier}?`,
                  description:
                    "This permanently removes the NAS registration. This cannot be undone.",
                  destructive: true,
                  onConfirm: handleDelete,
                })
              }
            >
              <Trash2 className="h-4 w-4" /> <span className="ml-2">Delete</span>
            </Button>
          )}
        </CardContent>
      </Card>

      <Dialog open={disableReasonOpen} onOpenChange={setDisableReasonOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disable NAS</DialogTitle>
            <DialogDescription>
              Guest authentication through this NAS will stop until it's reactivated.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="disable-reason">Reason (optional)</Label>
            <Textarea
              id="disable-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Maintenance window, decommissioning, etc."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDisableReasonOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleDisable} disabled={disable.isPending}>
              <KeyRound className="h-4 w-4" /> <span className="ml-2">Disable</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
    </div>
  );
}
