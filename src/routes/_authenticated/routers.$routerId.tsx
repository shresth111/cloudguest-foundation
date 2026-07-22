import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, MoreHorizontal, PauseCircle, PlayCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { ErrorState } from "@/components/common/ErrorState";
import { PageSkeleton } from "@/components/common/LoadingSkeleton";
import { RouterDetailTabs } from "@/components/routers/RouterDetailTabs";
import { RouterStatusBadge } from "@/components/routers/RouterStatusBadge";
import { useDeleteRouters, useRouter, useUpdateRouterStatus } from "@/hooks/useRouters";
import type { AppError } from "@/services/api";

const searchSchema = z.object({ tab: z.string().optional() });

export const Route = createFileRoute("/_authenticated/routers/$routerId")({
  validateSearch: searchSchema,
  component: RouterDetailPage,
});

function RouterDetailPage() {
  const { routerId } = Route.useParams();
  const { tab } = Route.useSearch();
  const navigate = useNavigate();
  const { data: router, isLoading, isError, refetch } = useRouter(routerId);
  const updateStatus = useUpdateRouterStatus();
  const remove = useDeleteRouters();
  const [confirm, setConfirm] = useState<null | {
    title: string;
    description: string;
    onConfirm: () => void;
    destructive?: boolean;
  }>(null);

  if (isLoading) return <PageSkeleton />;
  if (isError) return <ErrorState onRetry={() => refetch()} />;
  if (!router)
    return <ErrorState title="Router not found" description="This router may have been deleted." />;

  // Mirrors the backend's real ROUTER_STATUS_TRANSITIONS graph: suspend is
  // only legal from online/offline, reinstate only from suspended (and it
  // lands on offline, not online -- only a device heartbeat may ever assert
  // "online"). Every other status (pending_provisioning, provisioning,
  // decommissioned) has neither edge, so the toggle has nothing valid to do.
  const canSuspend = router.status === "online" || router.status === "offline";
  const canReinstate = router.status === "suspended";
  const showToggle = canSuspend || canReinstate;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <Link
            to="/routers"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" /> Back to routers
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{router.name}</h1>
            <RouterStatusBadge status={router.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            {router.model} · {router.locationName} · {router.publicIpAddress ?? "no public IP"}
          </p>
        </div>
        <div className="flex gap-2">
          {showToggle && (
            <Button
              variant={canReinstate ? "default" : "outline"}
              onClick={() =>
                setConfirm({
                  title: canReinstate ? `Reinstate ${router.name}?` : `Suspend ${router.name}?`,
                  description: canReinstate
                    ? "The router moves back to offline. Only the device's own heartbeat can mark it online again."
                    : "Guest traffic through this router will stop until re-enabled.",
                  destructive: canSuspend,
                  onConfirm: async () => {
                    try {
                      await updateStatus.mutateAsync({
                        ids: [router.id],
                        status: canReinstate ? "offline" : "suspended",
                      });
                      toast.success(canReinstate ? "Router reinstated" : "Router suspended");
                    } catch (err) {
                      toast.error(
                        (err as unknown as AppError).message || "Failed to update router status",
                      );
                    }
                  },
                })
              }
            >
              {canReinstate ? (
                <PlayCircle className="h-4 w-4" />
              ) : (
                <PauseCircle className="h-4 w-4" />
              )}
              <span className="ml-2">{canReinstate ? "Reinstate" : "Suspend"}</span>
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() =>
                  setConfirm({
                    title: `Decommission ${router.name}?`,
                    description: "This decommissions the router.",
                    destructive: true,
                    onConfirm: async () => {
                      try {
                        await remove.mutateAsync([router.id]);
                        toast.success("Router decommissioned");
                        navigate({ to: "/routers" });
                      } catch (err) {
                        toast.error(
                          (err as unknown as AppError).message || "Failed to decommission",
                        );
                      }
                    },
                  })
                }
              >
                <Trash2 className="h-4 w-4" />
                <span className="ml-2">Decommission router</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <RouterDetailTabs router={router} initialTab={tab ?? "overview"} />

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
