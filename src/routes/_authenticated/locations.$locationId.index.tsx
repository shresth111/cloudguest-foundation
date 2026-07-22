import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  Lock,
  MoreHorizontal,
  PauseCircle,
  PlayCircle,
  Trash2,
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
import { LocationDetailTabs } from "@/components/locations/LocationDetailTabs";
import { LocationStatusBadge } from "@/components/locations/LocationStatusBadge";
import {
  useDeleteLocations,
  useLocation,
  useUpdateLocationStatus,
} from "@/hooks/useLocations";
import { usePermissions } from "@/hooks/usePermissions";

const searchSchema = z.object({ tab: z.string().optional() });

export const Route = createFileRoute("/_authenticated/locations/$locationId/")({
  validateSearch: searchSchema,
  component: LocationDetailPage,
});

function LocationDetailPage() {
  const { locationId } = Route.useParams();
  const { tab } = Route.useSearch();
  const navigate = useNavigate();
  const { data: location, isLoading, isError, refetch } = useLocation(locationId);
  const { can } = usePermissions();
  const updateStatus = useUpdateLocationStatus();
  const remove = useDeleteLocations();
  const [confirm, setConfirm] = useState<null | {
    title: string;
    description: string;
    onConfirm: () => void;
    destructive?: boolean;
  }>(null);

  if (isLoading) return <PageSkeleton />;
  if (isError) return <ErrorState onRetry={() => refetch()} />;
  if (!location)
    return <ErrorState title="Location not found" description="This location may have been deleted." />;

  const disabled = location.status === "inactive" || location.status === "suspended";

  const canEdit = can("location-master", "edit");
  const canDelete = can("location-master", "delete");
  const canRestart = can("location-master", "restart");
  const canExport = can("location-master", "export");
  const anyMenu = canRestart || canExport || canDelete;


  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <Link
            to="/locations"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" /> Back to locations
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{location.name}</h1>
            <LocationStatusBadge status={location.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            {location.slug} · {location.organizationName} · {location.city}, {location.country}
          </p>
        </div>
        <div className="flex gap-2">
          {canEdit ? (
            <Button
              variant={disabled ? "default" : "outline"}
              onClick={() =>
                setConfirm({
                  title: disabled ? `Activate ${location.name}?` : `Suspend ${location.name}?`,
                  description: disabled
                    ? "Guest WiFi and services will resume immediately."
                    : "Guest access at this site will stop until re-activated.",
                  destructive: !disabled,
                  onConfirm: async () => {
                    await updateStatus.mutateAsync({
                      ids: [location.id],
                      status: disabled ? "active" : "suspended",
                    });
                    toast.success(disabled ? "Location activated" : "Location suspended");
                  },
                })
              }
            >
              {disabled ? <PlayCircle className="h-4 w-4" /> : <PauseCircle className="h-4 w-4" />}
              <span className="ml-2">{disabled ? "Activate" : "Suspend"}</span>
            </Button>
          ) : (
            <Button variant="outline" disabled title="Access restricted. Contact your Administrator.">
              <Lock className="h-4 w-4" />
              <span className="ml-2">{disabled ? "Activate" : "Suspend"}</span>
            </Button>
          )}
          {anyMenu && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                {canDelete && (
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() =>
                      setConfirm({
                        title: `Archive ${location.name}?`,
                        description: "This archives the location.",
                        destructive: true,
                        onConfirm: async () => {
                          await remove.mutateAsync([location.id]);
                          toast.success("Location archived");
                          navigate({ to: "/locations" });
                        },
                      })
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                    <span className="ml-2">Archive location</span>
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      <LocationDetailTabs location={location} initialTab={tab ?? "overview"} />

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
