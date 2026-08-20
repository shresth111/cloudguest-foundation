import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { RouterFleetSetupWizard } from "@/components/routers/fleet-wizard/RouterFleetSetupWizard";
import { MasterShell } from "@/components/master/MasterShell";
import { MButton, MPageShell } from "@/components/master/MasterKit";
import { useRouter } from "@/hooks/useRouters";
import { isDemo } from "@/services/customer.service";

export const Route = createFileRoute("/master/routers/setup/$routerId")({
  component: RouterFleetSetupRoute,
});

function RouterFleetSetupRoute() {
  const { routerId } = Route.useParams();
  const navigate = useNavigate();
  const demo = isDemo();
  const { data: router, isLoading, isError } = useRouter(routerId);

  if (demo) {
    return (
      <MasterShell title="Provisioning wizard">
        <MPageShell>
          <div className="rounded-xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
            The server-driven provisioning wizard is not available in the demo session. Sign in with
            a platform operator account to run discovery and WAN apply against a real router.
          </div>
          <div className="mt-4 flex justify-center">
            <MButton variant="outline" onClick={() => navigate({ to: "/master/routers" })}>
              Back to Router Fleet
            </MButton>
          </div>
        </MPageShell>
      </MasterShell>
    );
  }

  if (isLoading) {
    return (
      <MasterShell title="Provisioning wizard">
        <div className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading router…
        </div>
      </MasterShell>
    );
  }

  if (isError || !router) {
    return (
      <MasterShell title="Provisioning wizard">
        <MPageShell>
          <div className="rounded-xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
            Router not found or you do not have access.
          </div>
          <div className="mt-4 flex justify-center">
            <MButton variant="outline" onClick={() => navigate({ to: "/master/routers" })}>
              Back to Router Fleet
            </MButton>
          </div>
        </MPageShell>
      </MasterShell>
    );
  }

  return (
    <RouterFleetSetupWizard router={router} onBack={() => navigate({ to: "/master/routers" })} />
  );
}
