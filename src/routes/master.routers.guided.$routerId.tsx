import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { GuidedSetup } from "@/components/routers/guided-setup/GuidedSetup";
import { MasterShell } from "@/components/master/MasterShell";
import { MButton, MPageShell } from "@/components/master/MasterKit";
import { useRouter } from "@/hooks/useRouters";
import { isDemo } from "@/services/customer.service";

/**
 * Guided Setup for one router -- the "no thinking required" provisioning
 * path: one phase on screen, copy, then answer Haan/Nahi.
 *
 * Deliberately its own route rather than a tab inside the fleet page: it
 * is used standing at a rack with WinBox open next to it, so it needs the
 * full width, a URL that can be reopened directly, and nothing else on
 * screen competing for attention. Mirrors the existing
 * `/master/routers/setup/$routerId` wizard route's own shape (demo guard,
 * loading, not-found), so both provisioning entry points behave the same.
 */
export const Route = createFileRoute("/master/routers/guided/$routerId")({
  component: GuidedSetupRoute,
});

function GuidedSetupRoute() {
  const { routerId } = Route.useParams();
  const navigate = useNavigate();
  const demo = isDemo();
  const { data: router, isLoading, isError } = useRouter(routerId);

  const backToFleet = () => navigate({ to: "/master/routers" });

  if (demo) {
    return (
      <MasterShell title="Guided Setup">
        <MPageShell>
          <div className="rounded-xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
            Guided Setup demo session me available nahi hai — yeh ek asli router ke against chalta
            hai. Platform operator account se sign in karo.
          </div>
          <div className="mt-4 flex justify-center">
            <MButton variant="outline" onClick={backToFleet}>
              Back to Router Fleet
            </MButton>
          </div>
        </MPageShell>
      </MasterShell>
    );
  }

  if (isLoading) {
    return (
      <MasterShell title="Guided Setup">
        <div className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Router load ho raha hai…
        </div>
      </MasterShell>
    );
  }

  if (isError || !router) {
    return (
      <MasterShell title="Guided Setup">
        <MPageShell>
          <div className="rounded-xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
            Router nahi mila, ya tumhare paas iska access nahi hai.
          </div>
          <div className="mt-4 flex justify-center">
            <MButton variant="outline" onClick={backToFleet}>
              Back to Router Fleet
            </MButton>
          </div>
        </MPageShell>
      </MasterShell>
    );
  }

  return <GuidedSetup router={router} onBack={backToFleet} />;
}
