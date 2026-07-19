import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  Download,
  MoreHorizontal,
  PauseCircle,
  PlayCircle,
  Power,
  RefreshCw,
  RotateCw,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { ErrorState } from "@/components/common/ErrorState";
import { PageSkeleton } from "@/components/common/LoadingSkeleton";
import { RouterDetailTabs } from "@/components/routers/RouterDetailTabs";
import { RouterStatusBadge } from "@/components/routers/RouterStatusBadge";
import {
  useDeleteRouters,
  useRebootRouters,
  useRouter,
  useUpdateRouterStatus,
  useUpgradeRouters,
} from "@/hooks/useRouters";

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
  const reboot = useRebootRouters();
  const upgrade = useUpgradeRouters();
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

  const disabled = router.status === "suspended" || router.status === "offline" || router.status === "error";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <Link to="/routers" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3 w-3" /> Back to routers
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{router.name}</h1>
            <RouterStatusBadge status={router.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            {router.id} · {router.model} · {router.locationName} · {router.publicIp}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={disabled ? "default" : "outline"}
            onClick={() =>
              setConfirm({
                title: disabled ? `Enable ${router.name}?` : `Suspend ${router.name}?`,
                description: disabled
                  ? "The router will be marked online and start serving guests again."
                  : "Guest traffic through this router will stop until re-enabled.",
                destructive: !disabled,
                onConfirm: async () => {
                  await updateStatus.mutateAsync({
                    ids: [router.id],
                    status: disabled ? "online" : "suspended",
                  });
                  toast.success(disabled ? "Router enabled" : "Router suspended");
                },
              })
            }
          >
            {disabled ? <PlayCircle className="h-4 w-4" /> : <PauseCircle className="h-4 w-4" />}
            <span className="ml-2">{disabled ? "Enable" : "Suspend"}</span>
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              setConfirm({
                title: `Reboot ${router.name}?`,
                description: "Router will be unreachable for ~2 minutes.",
                onConfirm: async () => {
                  await reboot.mutateAsync([router.id]);
                  toast.success("Reboot command sent");
                },
              })
            }
          >
            <RotateCw className="h-4 w-4" /><span className="ml-2">Reboot</span>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => toast.success("Configuration sync started")}>
                <RefreshCw className="h-4 w-4" /><span className="ml-2">Sync configuration</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => toast.success("Configuration pushed")}>
                <UploadCloud className="h-4 w-4" /><span className="ml-2">Push configuration</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => toast.success("Backup queued")}>
                <Download className="h-4 w-4" /><span className="ml-2">Backup configuration</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => upgrade.mutate([router.id], { onSuccess: () => toast.success("Firmware upgrade queued") })}>
                <UploadCloud className="h-4 w-4" /><span className="ml-2">Upgrade firmware</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => toast.success("Shutdown command sent")}>
                <Power className="h-4 w-4" /><span className="ml-2">Shutdown</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() =>
                  setConfirm({
                    title: `Delete ${router.name}?`,
                    description: "This permanently removes the router and its configuration.",
                    destructive: true,
                    onConfirm: async () => {
                      await remove.mutateAsync([router.id]);
                      toast.success("Router deleted");
                      navigate({ to: "/routers" });
                    },
                  })
                }
              >
                <Trash2 className="h-4 w-4" /><span className="ml-2">Delete router</span>
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
