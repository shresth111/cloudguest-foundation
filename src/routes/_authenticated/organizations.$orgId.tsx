import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, KeyRound, LogIn, MoreHorizontal, PauseCircle, PlayCircle, Trash2 } from "lucide-react";
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
import { OrganizationDetailTabs } from "@/components/organizations/OrganizationDetailTabs";
import { StatusBadge } from "@/components/organizations/StatusBadge";
import {
  useDeleteOrganizations,
  useOrganization,
  useUpdateOrgStatus,
} from "@/hooks/useOrganizations";
import { useState } from "react";

const searchSchema = z.object({ tab: z.string().optional() });

export const Route = createFileRoute("/_authenticated/organizations/$orgId")({
  validateSearch: searchSchema,
  component: OrganizationDetailPage,
});

function OrganizationDetailPage() {
  const { orgId } = Route.useParams();
  const { tab } = Route.useSearch();
  const navigate = useNavigate();
  const { data: org, isLoading, isError, refetch } = useOrganization(orgId);
  const updateStatus = useUpdateOrgStatus();
  const remove = useDeleteOrganizations();
  const [confirm, setConfirm] = useState<null | { title: string; description: string; onConfirm: () => void; destructive?: boolean }>(null);

  if (isLoading) return <PageSkeleton />;
  if (isError) return <ErrorState onRetry={() => refetch()} />;
  if (!org) return <ErrorState title="Organization not found" description="This organization may have been deleted." />;

  const suspended = org.status === "suspended";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <Link to="/organizations" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3 w-3" /> Back to organizations
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{org.name}</h1>
            <StatusBadge status={org.status} />
          </div>
          <p className="text-sm text-muted-foreground">{org.slug}</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={suspended ? "default" : "outline"}
            onClick={() => setConfirm({
              title: suspended ? `Activate ${org.name}?` : `Suspend ${org.name}?`,
              description: suspended ? "Access will be restored immediately." : "Users will lose access until re-activated.",
              destructive: !suspended,
              onConfirm: async () => {
                await updateStatus.mutateAsync({ ids: [org.id], status: suspended ? "active" : "suspended" });
                toast.success(suspended ? "Organization activated" : "Organization suspended");
              },
            })}
          >
            {suspended ? <PlayCircle className="h-4 w-4" /> : <PauseCircle className="h-4 w-4" />}
            <span className="ml-2">{suspended ? "Activate" : "Suspend"}</span>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => toast.info("Admin password reset — coming soon")}>
                <KeyRound className="h-4 w-4" /><span className="ml-2">Reset admin password</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => toast.info(`Logged in as ${org.name} (placeholder)`)}>
                <LogIn className="h-4 w-4" /><span className="ml-2">Login as organization</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => toast.info("Plan change flow — coming soon")}>
                Change plan
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => setConfirm({
                  title: `Archive ${org.name}?`,
                  description: "This archives the organization.",
                  destructive: true,
                  onConfirm: async () => {
                    await remove.mutateAsync([org.id]);
                    toast.success("Organization archived");
                    navigate({ to: "/organizations" });
                  },
                })}
              >
                <Trash2 className="h-4 w-4" /><span className="ml-2">Archive organization</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <OrganizationDetailTabs org={org} initialTab={tab ?? "overview"} />

      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={confirm?.title ?? ""}
        description={confirm?.description ?? ""}
        destructive={confirm?.destructive}
        onConfirm={() => { confirm?.onConfirm(); setConfirm(null); }}
      />
    </div>
  );
}
