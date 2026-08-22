import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { GuidedSetup } from "@/components/routers/guided-setup/GuidedSetup";
import { GuidedDevanagariFont } from "@/components/routers/guided-setup/GuidedDevanagariFont";
import { MasterShell } from "@/components/master/MasterShell";
import { MButton, MPageShell } from "@/components/master/MasterKit";
import masterI18n from "@/lib/master-i18n";
import { useRouter } from "@/hooks/useRouters";
import { isDemo } from "@/services/customer.service";
import type { RouterDevice } from "@/types/router";

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
  const { t } = useTranslation("guided", { i18n: masterI18n });
  const navigate = useNavigate();
  const demo = isDemo();
  const { data: router, isLoading, isError } = useRouter(routerId);

  const backToFleet = () => navigate({ to: "/master/routers" });

  // `GuidedDevanagariFont` is rendered once here, above every branch,
  // rather than inside `GuidedSetup` -- the demo, loading and not-found
  // screens are translated too, so they need the face as much as the
  // wizard does. It emits only a <style> element, so its position in the
  // tree is irrelevant to layout.
  return (
    <>
      <GuidedDevanagariFont />
      <GuidedSetupBody
        demo={demo}
        isLoading={isLoading}
        isError={isError}
        router={router}
        backToFleet={backToFleet}
        t={t}
      />
    </>
  );
}

function GuidedSetupBody({
  demo,
  isLoading,
  isError,
  router,
  backToFleet,
  t,
}: {
  demo: boolean;
  isLoading: boolean;
  isError: boolean;
  router: RouterDevice | null | undefined;
  backToFleet: () => void;
  t: TFunction<"guided">;
}) {
  if (demo) {
    return (
      <MasterShell title={t("route.title")}>
        <MPageShell>
          <div className="guided-setup-surface rounded-xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
            {t("route.demo")}
          </div>
          <div className="mt-4 flex justify-center">
            <MButton variant="outline" onClick={backToFleet}>
              {t("route.backToFleet")}
            </MButton>
          </div>
        </MPageShell>
      </MasterShell>
    );
  }

  if (isLoading) {
    return (
      <MasterShell title={t("route.title")}>
        <div className="guided-setup-surface flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> {t("route.loading")}
        </div>
      </MasterShell>
    );
  }

  if (isError || !router) {
    return (
      <MasterShell title={t("route.title")}>
        <MPageShell>
          <div className="guided-setup-surface rounded-xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
            {t("route.notFound")}
          </div>
          <div className="mt-4 flex justify-center">
            <MButton variant="outline" onClick={backToFleet}>
              {t("route.backToFleet")}
            </MButton>
          </div>
        </MPageShell>
      </MasterShell>
    );
  }

  return <GuidedSetup router={router} onBack={backToFleet} />;
}
