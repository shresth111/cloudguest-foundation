import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronDown, Filter, Loader2, Router as RouterIcon, ShieldCheck } from "lucide-react";
import i18n from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { EmptyState } from "@/components/common/EmptyState";
import { ControllerRoutersNote } from "@/components/network/RouterPickerItems";
import { ControllerManagedFeatureNotice } from "@/components/customer/ControllerManagedFeatureNotice";
import { useCustomerStore } from "@/stores/customerStore";
import { routerService } from "@/services/router.service";
import { isDemo, resolveOrgId } from "@/services/customer.service";
import { requestErrorOf } from "@/services/api";
import {
  featureAppliesToControllerVenue,
  partitionRoutersByDeviceWrite,
} from "@/lib/router-vendors";
import { locationControllerVendor, locationIsControllerManaged } from "@/lib/location-liveness";
import {
  useSetWebFilterLocationPolicy,
  useWebCategories,
  useWebFilterLocationPolicy,
  useWebFilterRouterAction,
  useWebFilterRouterStatus,
} from "@/hooks/useDnsFiltering";
import {
  NOT_SET_UP_SENTENCE,
  ROUTER_STATE_LABEL,
  canonicalIds,
  describeIds,
  groupState,
  isSelectable,
  orderedGroups,
  policySourceSentence,
  sameIds,
  toggleCategory,
  webFilterErrorSentence,
  type WebFilterErrorExplained,
} from "@/lib/web-filtering";
import type { WebCategory, WebFilterLocationPolicy } from "@/types/dns-filtering";
import type { RouterDevice } from "@/types/router";

/**
 * Security -> Web Filtering. Pick the kinds of website to block at this
 * venue (Cloudflare's categories), and switch it on per router.
 *
 * ## How it works, and why the confirmation says what it says
 *
 * cloud-guest#307. RouterOS has no category list of its own, so switching a
 * router on points ALL of its website lookups at a Cloudflare Gateway
 * address made for that router, and Cloudflare answers "blocked" for the
 * chosen categories. That is a change to how the router looks up every
 * website for everyone on it, which is why Turn on asks first and says so.
 * The backend checks lookups still work straight after the switch and, if
 * not, puts the router's own settings back by itself -- the dialog says that
 * too, because it is true and it is what makes the change safe to try.
 *
 * ## Not set up
 *
 * With no Cloudflare account connected on the platform the backend answers
 * 503, and a backend without #307 answers 404. Both mean nothing on this page
 * can work, so the page says "Not set up yet" and mounts no control at all.
 *
 * ## The venue's list and the account default
 *
 * A venue either has its own list or uses the account (organization)
 * default. Saving here always gives the venue its own list -- the backend has
 * no "go back to the default" -- and the page says so before Save.
 *
 * ## Controller-managed venues
 *
 * MikroTik only. "web-filtering" is in `CONTROLLER_UNSUPPORTED_FEATURE_IDS`,
 * so the owner shell shows `ControllerManagedFeatureNotice` instead, and this
 * component applies the same gate itself for the staff `/agent` shell.
 */
export function WebFilteringView({ locationId }: { locationId?: string }) {
  const { t } = useTranslation("nav", { i18n });
  const activeLocation = useCustomerStore((s) => s.activeLocation);
  const demo = isDemo();
  const controllerGated =
    locationIsControllerManaged(activeLocation?.liveness) &&
    !featureAppliesToControllerVenue("web-filtering");
  const live = !!locationId && !demo && !controllerGated;

  const categories = useWebCategories(locationId, live);

  const intro = (
    <p className="max-w-3xl text-sm text-muted-foreground">
      {t(
        "webFilteringPage.intro",
        "Block whole kinds of website on your guest WiFi, such as adult sites or gambling. Cloudflare keeps the list of which website belongs to which kind.",
      )}
    </p>
  );

  if (controllerGated) {
    return (
      <ControllerManagedFeatureNotice
        featureId="web-filtering"
        featureLabel={t("customerItem.web-filtering", "Web filtering")}
        venueName={activeLocation?.name ?? null}
        vendor={locationControllerVendor(activeLocation?.liveness)}
      />
    );
  }

  if (demo) {
    return (
      <div className="space-y-5">
        {intro}
        <EmptyState
          icon={Filter}
          title={t("webFilteringPage.demoTitle", "Not part of the demo account")}
          description={t(
            "webFilteringPage.demoBody",
            "Web filtering changes a real router, and the demo account has none.",
          )}
        />
      </div>
    );
  }

  if (!locationId) {
    return (
      <div className="space-y-5">
        {intro}
        <EmptyState icon={Filter} title={t("webFilteringPage.noVenue", "Choose a venue first")} />
      </div>
    );
  }

  if (categories.isLoading) {
    return (
      <div className="space-y-5">
        {intro}
        <Loading label={t("webFilteringPage.loading", "Loading…")} />
      </div>
    );
  }

  if (categories.isError) {
    return (
      <div className="space-y-5">
        {intro}
        <div role="alert" className="space-y-2 text-sm">
          <p className="text-destructive">
            {requestErrorOf(categories.error)?.message ??
              t("webFilteringPage.categoriesError", "Couldn't load the list of categories.")}
          </p>
          <Button variant="outline" size="sm" onClick={() => void categories.refetch()}>
            {t("webFilteringPage.retry", "Try again")}
          </Button>
        </div>
      </div>
    );
  }

  if (!categories.data || categories.data.state === "not_configured") {
    // Calm and final: no button, no form, nothing that would 503.
    return (
      <div className="space-y-5">
        {intro}
        <EmptyState
          icon={Filter}
          title={t("webFilteringPage.err.notSetUp", NOT_SET_UP_SENTENCE)}
          description={t(
            "webFilteringPage.notSetUpBody",
            "Once it is, this is where you'll choose the kinds of website to block at this venue.",
          )}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {intro}
      <CategoriesCard locationId={locationId as string} items={categories.data.items} />
      <VenueRouters
        locationId={locationId as string}
        organizationId={activeLocation?.organizationId}
      />
    </div>
  );
}

function Loading({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      {label}
    </div>
  );
}

function ErrorBox({ explained }: { explained: WebFilterErrorExplained }) {
  const { t } = useTranslation("nav", { i18n });
  return (
    <div
      role="alert"
      className="space-y-1 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm"
    >
      <p className="font-medium text-destructive">
        {explained.key
          ? t(`webFilteringPage.err.${explained.key}`, explained.sentence)
          : explained.sentence}
      </p>
      {explained.detail && (
        <p className="text-xs text-muted-foreground">
          {t("webFilteringPage.routerSaid", "Details:")} {explained.detail}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// The venue's list.
// ---------------------------------------------------------------------------

function CategoriesCard({ locationId, items }: { locationId: string; items: WebCategory[] }) {
  const { t } = useTranslation("nav", { i18n });
  const policy = useWebFilterLocationPolicy(locationId);
  const save = useSetWebFilterLocationPolicy(locationId);

  return (
    <Card className="border-border/60">
      <CardHeader className="space-y-1">
        <CardTitle className="text-base font-semibold">
          {t("webFilteringPage.listTitle", "What to block at this venue")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {policy.isLoading ? (
          <Loading label={t("webFilteringPage.loadingPolicy", "Loading this venue's list…")} />
        ) : policy.isError || !policy.data ? (
          <p role="alert" className="text-sm text-destructive">
            {requestErrorOf(policy.error)?.message ??
              t("webFilteringPage.policyError", "Couldn't load this venue's list.")}
          </p>
        ) : (
          <CategoryPicker
            key={canonicalIds(policy.data.effectiveCategoryIds).join(",")}
            policy={policy.data}
            items={items}
            saving={save.isPending}
            onSave={(ids) =>
              save.mutate(ids, {
                onSuccess: () =>
                  toast.success(t("webFilteringPage.savedToast", "Saved this venue's list.")),
                onError: (err) => {
                  const e = webFilterErrorSentence(requestErrorOf(err));
                  toast.error(e.key ? t(`webFilteringPage.err.${e.key}`, e.sentence) : e.sentence);
                },
              })
            }
          />
        )}
      </CardContent>
    </Card>
  );
}

function CategoryPicker({
  policy,
  items,
  saving,
  onSave,
}: {
  policy: WebFilterLocationPolicy;
  items: WebCategory[];
  saving: boolean;
  onSave: (ids: number[]) => void;
}) {
  const { t } = useTranslation("nav", { i18n });
  const [selected, setSelected] = useState<Set<number>>(() => new Set(policy.effectiveCategoryIds));
  const groups = useMemo(() => orderedGroups(items), [items]);
  const orgIds = policy.organizationCategoryIds;
  const orgNames = orgIds ? describeIds(orgIds, items) : null;
  const changed = !sameIds(selected, policy.effectiveCategoryIds);
  const matchesDefault = orgIds ? sameIds(selected, orgIds) : false;

  return (
    <div className="space-y-4">
      <div className="space-y-1 rounded-lg border border-border bg-muted/30 p-3 text-sm">
        <p>{t(`webFilteringPage.source.${policy.source}`, policySourceSentence(policy.source))}</p>
        <p className="text-muted-foreground">
          {orgNames === null
            ? t("webFilteringPage.noDefault", "Your account has no default list.")
            : orgNames.names.length === 0 && orgNames.unknown === 0
              ? t("webFilteringPage.defaultEmpty", "Your account's default list blocks nothing.")
              : t("webFilteringPage.defaultIs", "Your account's default list blocks: {{names}}", {
                  names: [
                    ...orgNames.names,
                    ...(orgNames.unknown
                      ? [
                          t("webFilteringPage.unknownCount", "{{count}} other(s)", {
                            count: orgNames.unknown,
                          }),
                        ]
                      : []),
                  ].join(", "),
                })}
        </p>
        {policy.source === "location" &&
          orgIds &&
          !sameIds(policy.effectiveCategoryIds, orgIds) && (
            <p className="text-muted-foreground">
              {t(
                "webFilteringPage.overrides",
                "This venue's own list is used here instead of the account default.",
              )}
            </p>
          )}
      </div>

      <ul className="divide-y divide-border rounded-lg border border-border">
        {groups.map((g) => (
          <CategoryGroupRow key={g.id} group={g} selected={selected} onChange={setSelected} />
        ))}
      </ul>

      {changed && policy.source !== "location" && (
        <p className="text-xs text-muted-foreground">
          {t(
            "webFilteringPage.ownListNote",
            "Saving gives this venue its own list. Later changes to your account's default won't apply here.",
          )}
        </p>
      )}
      {changed && (
        <p className="text-xs text-muted-foreground">
          {t(
            "webFilteringPage.appliesNote",
            "Where web filtering is already on at a router here, saving changes what it blocks.",
          )}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button disabled={!changed || saving} onClick={() => onSave(canonicalIds(selected))}>
          {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden="true" />}
          {t("webFilteringPage.save", "Save list")}
        </Button>
        {orgIds && !matchesDefault && (
          <Button variant="outline" onClick={() => setSelected(new Set(orgIds))}>
            {t("webFilteringPage.useDefault", "Copy the account default")}
          </Button>
        )}
        {changed && (
          <Button variant="ghost" onClick={() => setSelected(new Set(policy.effectiveCategoryIds))}>
            {t("webFilteringPage.undo", "Undo changes")}
          </Button>
        )}
      </div>
    </div>
  );
}

function CategoryGroupRow({
  group,
  selected,
  onChange,
}: {
  group: WebCategory;
  selected: Set<number>;
  onChange: (next: Set<number>) => void;
}) {
  const { t } = useTranslation("nav", { i18n });
  const state = groupState(selected, group);
  const selectable = isSelectable(group) || group.subcategories.some(isSelectable);
  const subs = group.subcategories;
  const id = `wf-cat-${group.id}`;
  return (
    <li className="p-3">
      <Collapsible>
        <div className="flex items-start gap-3">
          <Checkbox
            id={id}
            className="mt-0.5"
            checked={state === "all" ? true : state === "some" ? "indeterminate" : false}
            disabled={!selectable}
            onCheckedChange={(v) => onChange(toggleCategory(selected, group, v === true))}
          />
          <div className="min-w-0 flex-1">
            <label htmlFor={id} className="flex flex-wrap items-center gap-2 text-sm font-medium">
              {group.isSecurity && (
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
              )}
              {group.name}
              {group.beta && (
                <Badge variant="outline" className="rounded-full text-[10px]">
                  {t("webFilteringPage.beta", "Beta")}
                </Badge>
              )}
            </label>
            {group.description && (
              <p className="text-xs text-muted-foreground">{group.description}</p>
            )}
            {!selectable && (
              <p className="text-xs text-muted-foreground">
                {t("webFilteringPage.notBlockable", "Cloudflare doesn't allow blocking this one.")}
              </p>
            )}
          </div>
          {subs.length > 0 && (
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="shrink-0 text-xs">
                {t("webFilteringPage.showSubs", "{{count}} more specific", {
                  count: subs.length,
                })}
                <ChevronDown className="ml-1 h-3.5 w-3.5" aria-hidden="true" />
              </Button>
            </CollapsibleTrigger>
          )}
        </div>
        {subs.length > 0 && (
          <CollapsibleContent>
            <ul className="mt-2 space-y-2 pl-7">
              {subs.map((s) => {
                const sid = `wf-cat-${s.id}`;
                const ok = isSelectable(s);
                return (
                  <li key={s.id} className="flex items-start gap-3">
                    <Checkbox
                      id={sid}
                      className="mt-0.5"
                      checked={selected.has(s.id)}
                      disabled={!ok}
                      onCheckedChange={(v) =>
                        onChange(toggleCategory(selected, s, v === true, group))
                      }
                    />
                    <label htmlFor={sid} className="text-sm">
                      {s.name}
                      {!ok && (
                        <span className="ml-1 text-xs text-muted-foreground">
                          ({t("webFilteringPage.notBlockableShort", "can't be blocked")})
                        </span>
                      )}
                    </label>
                  </li>
                );
              })}
            </ul>
          </CollapsibleContent>
        )}
      </Collapsible>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Routers.
// ---------------------------------------------------------------------------

function VenueRouters({
  locationId,
  organizationId,
}: {
  locationId: string;
  organizationId?: string;
}) {
  const { t } = useTranslation("nav", { i18n });
  const routersQuery = useQuery({
    queryKey: ["dns-filtering", "venue-routers", locationId],
    queryFn: async () => {
      const orgId = organizationId || (await resolveOrgId());
      return routerService.listForLocation(locationId, orgId);
    },
  });
  const rows = routersQuery.data ?? [];
  const { writable } = partitionRoutersByDeviceWrite(rows);

  if (routersQuery.isLoading) {
    return (
      <Loading label={t("webFilteringPage.loadingRouters", "Loading this venue's routers…")} />
    );
  }
  if (routersQuery.isError) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {requestErrorOf(routersQuery.error)?.message ??
          t("webFilteringPage.routersError", "Couldn't load this venue's routers.")}
      </p>
    );
  }
  if (writable.length === 0) {
    return (
      <EmptyState
        icon={RouterIcon}
        title={t("webFilteringPage.noRouterTitle", "No router here can use web filtering")}
        description={
          rows.length === 0
            ? t("webFilteringPage.noRouterBody", "This venue has no router yet.")
            : undefined
        }
      >
        <ControllerRoutersNote rows={rows} />
      </EmptyState>
    );
  }
  return (
    <div className="space-y-3">
      <ControllerRoutersNote rows={rows} />
      {writable.map((router) => (
        <RouterFilterCard key={router.id} router={router} />
      ))}
    </div>
  );
}

const STATE_STYLE: Record<keyof typeof ROUTER_STATE_LABEL, string> = {
  active: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:text-emerald-400",
  disabled: "bg-zinc-500/10 text-zinc-600 border-zinc-500/20 dark:text-zinc-400",
  pending: "bg-amber-500/10 text-amber-700 border-amber-500/20 dark:text-amber-400",
  failed: "bg-rose-500/10 text-rose-700 border-rose-500/20 dark:text-rose-400",
};

function formatWhen(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleString();
}

function RouterFilterCard({ router }: { router: RouterDevice }) {
  const { t } = useTranslation("nav", { i18n });
  const status = useWebFilterRouterStatus(router.id);
  const action = useWebFilterRouterAction(router.id);
  const [confirm, setConfirm] = useState<"enable" | "disable" | null>(null);
  const [error, setError] = useState<WebFilterErrorExplained | null>(null);

  const s = status.data;

  function run(a: Parameters<typeof action.mutate>[0], done: string) {
    setConfirm(null);
    setError(null);
    action.mutate(a, {
      onSuccess: () => toast.success(done),
      onError: (err) => setError(webFilterErrorSentence(requestErrorOf(err))),
    });
  }

  const isOn = s?.state === "active";
  const hasCategories = (s?.effectiveCategoryIds.length ?? 0) > 0;
  const lastWhen = formatWhen(s?.devicePushedAt ?? null);

  return (
    <Card className="border-border/60">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <RouterIcon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            {router.name}
          </CardTitle>
          {s && (
            <Badge
              variant="outline"
              className={cn("rounded-full font-medium", STATE_STYLE[s.state])}
            >
              {t(`webFilteringPage.state.${s.state}`, ROUTER_STATE_LABEL[s.state])}
            </Badge>
          )}
        </div>
        {s && (
          <div className="flex flex-wrap items-center gap-2">
            {isOn ? (
              <Button
                variant="outline"
                disabled={action.isPending}
                onClick={() => setConfirm("disable")}
              >
                {action.isPending && (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden="true" />
                )}
                {t("webFilteringPage.turnOff", "Turn off")}
              </Button>
            ) : (
              <Button
                disabled={action.isPending || !hasCategories}
                onClick={() => setConfirm("enable")}
              >
                {action.isPending && (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden="true" />
                )}
                {t("webFilteringPage.turnOn", "Turn on")}
              </Button>
            )}
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {status.isLoading ? (
          <Loading label={t("webFilteringPage.loadingStatus", "Checking this router…")} />
        ) : status.isError || !s ? (
          <p role="alert" className="text-destructive">
            {requestErrorOf(status.error)?.message ??
              t(
                "webFilteringPage.statusError",
                "Couldn't read this router's web filtering status.",
              )}
          </p>
        ) : (
          <>
            {!isOn && !hasCategories && (
              <p className="text-xs text-muted-foreground">
                {t(
                  "webFilteringPage.needsCategories",
                  "Choose at least one category above and save before turning this on.",
                )}
              </p>
            )}

            {s.devicePushStatus && (
              <p className="text-muted-foreground">
                {s.devicePushStatus === "failed"
                  ? t("webFilteringPage.lastFailed", "Last attempt failed")
                  : s.devicePushStatus === "active"
                    ? t("webFilteringPage.lastWorked", "Last attempt worked")
                    : t("webFilteringPage.lastPending", "Last attempt still in progress")}
                {lastWhen ? ` · ${lastWhen}` : ""}
              </p>
            )}
            {s.devicePushStatus === "failed" && s.devicePushError && (
              <p className="text-xs text-muted-foreground">
                {t("webFilteringPage.routerSaid", "Details:")} {s.devicePushError}
              </p>
            )}

            {error && <ErrorBox explained={error} />}

            <div className="flex items-start justify-between gap-4 rounded-lg border border-border p-3">
              <div className="space-y-1">
                <p className="font-medium">
                  {t("webFilteringPage.bypassTitle", "Stop guests getting around the filter")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t(
                    "webFilteringPage.bypassBody",
                    "Stops signed-in guests' devices using their own private lookup service instead of the filter. It can't catch every workaround, and a few apps that insist on their own may not load.",
                  )}
                </p>
                {!isOn && !s.bypassHardeningEnabled && (
                  <p className="text-xs text-muted-foreground">
                    {t("webFilteringPage.bypassNeedsOn", "Available once web filtering is on.")}
                  </p>
                )}
                {s.bypassHardeningStatus === "failed" && (
                  <p className="text-xs text-destructive">
                    {t("webFilteringPage.bypassFailed", "The last change to this didn't work.")}
                    {s.bypassHardeningError ? ` ${s.bypassHardeningError}` : ""}
                  </p>
                )}
              </div>
              <Switch
                checked={s.bypassHardeningEnabled}
                disabled={action.isPending || (!isOn && !s.bypassHardeningEnabled)}
                onCheckedChange={(v) =>
                  run(
                    { kind: "bypass", enabled: v },
                    v
                      ? t("webFilteringPage.bypassOnToast", "Turned on at {{router}}", {
                          router: router.name,
                        })
                      : t("webFilteringPage.bypassOffToast", "Turned off at {{router}}", {
                          router: router.name,
                        }),
                  )
                }
                aria-label={t(
                  "webFilteringPage.bypassTitle",
                  "Stop guests getting around the filter",
                )}
              />
            </div>

            {s.limitations.length > 0 && (
              <Collapsible>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="px-0 text-xs text-muted-foreground">
                    {t("webFilteringPage.limitsTitle", "What web filtering can't do")}
                    <ChevronDown className="ml-1 h-3.5 w-3.5" aria-hidden="true" />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                    {s.limitations.map((l) => (
                      <li key={l}>{l}</li>
                    ))}
                  </ul>
                </CollapsibleContent>
              </Collapsible>
            )}
          </>
        )}
      </CardContent>

      <AlertDialog open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm === "enable"
                ? t("webFilteringPage.enableTitle", "Turn on web filtering at {{router}}?", {
                    router: router.name,
                  })
                : t("webFilteringPage.disableTitle", "Turn off web filtering at {{router}}?", {
                    router: router.name,
                  })}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                {confirm === "enable" ? (
                  <>
                    <p>
                      {t(
                        "webFilteringPage.enableWhat",
                        "This changes how {{router}} looks up every website, for everyone on its network — guests and your own devices.",
                        { router: router.name },
                      )}
                    </p>
                    <p>
                      {t(
                        "webFilteringPage.enableSafety",
                        "Straight after the change we check that websites still open. If that check fails, the router switches back to its own settings automatically.",
                      )}
                    </p>
                  </>
                ) : (
                  <p>
                    {t(
                      "webFilteringPage.disableWhat",
                      "The router goes back to the website lookup settings it had before, and the categories on your list stop being blocked.",
                    )}
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("webFilteringPage.cancel", "Cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                confirm === "enable"
                  ? run(
                      { kind: "enable" },
                      t("webFilteringPage.enabledToast", "Web filtering is on at {{router}}", {
                        router: router.name,
                      }),
                    )
                  : run(
                      { kind: "disable" },
                      t("webFilteringPage.disabledToast", "Web filtering is off at {{router}}", {
                        router: router.name,
                      }),
                    )
              }
            >
              {confirm === "enable"
                ? t("webFilteringPage.turnOn", "Turn on")
                : t("webFilteringPage.turnOff", "Turn off")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

export default WebFilteringView;
