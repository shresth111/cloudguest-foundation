import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { ErrorState } from "@/components/common/ErrorState";
import { PageSkeleton } from "@/components/common/LoadingSkeleton";
import { useDeleteNas, useNas } from "@/hooks/useNas";
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
  const remove = useDeleteNas();

  const [confirm, setConfirm] = useState<null | {
    title: string;
    description: string;
    onConfirm: () => void;
    destructive?: boolean;
  }>(null);
  if (isLoading) return <PageSkeleton />;
  if (isError) return <ErrorState onRetry={() => refetch()} />;
  if (!nas)
    return <ErrorState title="NAS not found" description="This NAS may have been removed." />;

  // NO canActivate/canDisable HERE ANY MORE (2026-09-02). This page used to
  // mirror the backend's NasStatus transition graph into buttons, which is
  // how a venue owner ended up with a one-click switch that stopped every
  // guest login at their own venue. An internal lifecycle model is not a
  // feature; see the Actions card below.
  const canDelete = nas.status !== "deleted";

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

      {/* NO "REGENERATE SECRET", "ACTIVATE" OR "DISABLE" BUTTON HERE,
          deliberately. Regenerate went on 2026-09-02; Activate and Disable
          went the same day, once it turned out all three had been gated on
          the same organization-scoped `radius.execute` and only one had
          been moved.

          Rotating the RADIUS shared secret changes the platform's record
          and the FreeRADIUS hub's copy but cannot change the router's, so
          the old secret keeps being rejected until an engineer re-pastes
          the RADIUS chunk over WinBox -- not something a venue owner can
          finish from a dashboard.

          Disable was worse in one way and better in another. Worse: it is a
          pure database write, so it took effect instantly and silently --
          every guest login at this venue rejected, with nothing the guest
          or the router could see explaining why. Better: it was reversible,
          by Activate, which sat right next to it. The reason it is gone is
          not that it could not be undone; it is that nobody ever asked for
          a kill switch here. These buttons existed because the backend's
          internal NasStatus graph had been mirrored into this page. If you
          want guest WiFi to stop at certain times, that is business hours
          and the closed-portal state, which is built for it. */}
      <Card className="rounded-2xl border-border/70">
        <CardHeader>
          <CardTitle className="text-base">Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Taking this NAS in or out of service — activating it, disabling it, or rotating its
            RADIUS shared secret — is done by Wyfy support, not from here. Each one stops or starts
            guest authentication for the whole venue, and a rotation also needs the new secret
            written onto the router on site. Raise a support ticket and we will do it with you.
          </p>
          <p className="text-xs text-muted-foreground">
            To stop serving guests on a schedule, use business hours instead — that closes the
            portal without touching this venue's RADIUS registration.
          </p>
          <div className="flex flex-wrap gap-2">
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
          </div>
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
    </div>
  );
}
