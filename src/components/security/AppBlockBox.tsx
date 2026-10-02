import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ChevronDown, Loader2, RotateCw, Smartphone } from "lucide-react";
import i18n from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { requestErrorOf } from "@/services/api";
import { useContentFilterApps, useToggleContentFilterApp } from "@/hooks/useContentFilter";
import {
  appFailedNames,
  appHandBlockedNames,
  appSwitchBlocked,
  appToggleView,
  type AppToggleView,
} from "@/lib/app-blocking";
import type { ContentFilterApp } from "@/types/contentFilter";

const VIEW_STYLE: Record<AppToggleView, string> = {
  allowed: "text-muted-foreground",
  blocked: "text-emerald-700 dark:text-emerald-400",
  sending: "text-zinc-600 dark:text-zinc-400",
  failed: "text-rose-700 dark:text-rose-400",
  partial: "text-amber-700 dark:text-amber-400",
};

const VIEW_LABEL: Record<AppToggleView, string> = {
  allowed: "Allowed",
  blocked: "Blocked on the router",
  sending: "Blocked, not on the router yet",
  failed: "Some of it didn't reach the router",
  partial: "Partly blocked",
};

/**
 * Block Websites -> Apps, for one router: one switch per app in the backend's
 * curated catalogue (`content_filtering.app_catalogue`).
 *
 * Switching an app off asks the backend to block every website name that app
 * uses and send each one to the router -- the same block a typed-in website
 * gets (by name in the router's DNS, and by name on secure connections). It
 * is name matching, not app recognition, and the copy says so before the
 * owner touches a switch: some apps will still get through.
 *
 * A block that only partly reached the router is a real error from the
 * backend; the row then says so and offers "Try again", which re-sends only
 * what did not land. Switching back on removes only what the switch added --
 * a website the owner blocked by hand stays blocked, and the row says that.
 */
export function AppBlockBox({ routerId }: { routerId: string }) {
  const { t } = useTranslation("nav", { i18n });
  const apps = useContentFilterApps(routerId);
  const toggle = useToggleContentFilterApp(routerId);

  function run(app: ContentFilterApp, block: boolean) {
    toggle.mutate(
      { appKey: app.key, block },
      {
        onSuccess: () =>
          toast.success(
            block
              ? t("blockApps.blockedToast", "{{app}} is blocked on the router.", { app: app.name })
              : t("blockApps.allowedToast", "{{app}} is allowed again.", { app: app.name }),
          ),
        onError: (err) =>
          toast.error(
            requestErrorOf(err)?.message ??
              (block
                ? t("blockApps.blockFailed", "Couldn't block all of {{app}} on the router.", {
                    app: app.name,
                  })
                : t(
                    "blockApps.allowFailed",
                    "Couldn't reach the router, so {{app}} is still blocked.",
                    {
                      app: app.name,
                    },
                  )),
          ),
      },
    );
  }

  if (apps.isLoading) {
    return (
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        {t("blockApps.loading", "Loading apps…")}
      </p>
    );
  }
  if (apps.isError || !apps.data) {
    return (
      <p role="alert" className="text-xs text-destructive">
        {requestErrorOf(apps.error)?.message ??
          t("blockApps.loadError", "Couldn't load the list of apps for this router.")}
      </p>
    );
  }

  return (
    <section className="space-y-3 rounded-lg border border-border/60 bg-muted/30 p-4">
      <ul className="divide-y divide-border/60" aria-label={t("blockApps.listLabel", "Apps")}>
        {apps.data.items.map((app) => {
          const view = appToggleView(app);
          const busy = toggle.isPending && toggle.variables?.appKey === app.key;
          const failed = appFailedNames(app);
          const byHand = appHandBlockedNames(app);
          return (
            <li key={app.key} className="flex items-start justify-between gap-4 py-2.5">
              <div className="min-w-0 space-y-0.5">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <Smartphone className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  {app.name}
                </p>
                <p className={cn("text-xs", VIEW_STYLE[view])}>
                  {t(`blockApps.view.${view}`, VIEW_LABEL[view])}
                </p>
                {app.note && view !== "allowed" && (
                  <p className="text-xs text-muted-foreground">
                    {t(`blockApps.note.${app.key}`, app.note)}
                  </p>
                )}
                {failed.length > 0 && (
                  <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {t("blockApps.failedNames", "Not on the router: {{names}}", {
                      names: failed.join(", "),
                    })}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-6 px-2 text-xs"
                      disabled={busy}
                      onClick={() => run(app, true)}
                    >
                      <RotateCw className={cn("mr-1 h-3 w-3", busy && "animate-spin")} />
                      {t("blockApps.retry", "Try again")}
                    </Button>
                  </p>
                )}
                {byHand.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {t(
                      "blockApps.handBlocked",
                      "{{names}} is also blocked on its own, and stays blocked if you allow this app.",
                      { names: byHand.join(", ") },
                    )}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {busy && (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden />
                )}
                <Switch
                  checked={appSwitchBlocked(view)}
                  disabled={toggle.isPending}
                  aria-label={t("blockApps.switchLabel", "Block {{app}}", { app: app.name })}
                  onCheckedChange={(v) => run(app, v)}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** What app blocking cannot do, in the owner's words. Shown once above the
 * routers, folded. */
export function AppBlockLimits() {
  const { t } = useTranslation("nav", { i18n });
  return (
    <Collapsible>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="px-0 text-xs text-muted-foreground">
          {t("blockApps.limitsTitle", "Why some apps may still get through")}
          <ChevronDown className="ml-1 h-3.5 w-3.5" aria-hidden="true" />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
          <li>
            {t(
              "blockApps.limitNames",
              "This blocks the website names an app uses. It does not recognise the app itself, so some apps may still get through.",
            )}
          </li>
          <li>
            {t(
              "blockApps.limitOpen",
              "An app that is already open, or that connects without looking up a name, can keep working until it reconnects.",
            )}
          </li>
          <li>
            {t(
              "blockApps.limitBypass",
              "A phone using its own DNS or a VPN, or on mobile data, is not covered.",
            )}
          </li>
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
}

export default AppBlockBox;
