import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Loader2,
  Pencil,
  Plus,
  Router as RouterIcon,
  ShieldAlert,
  Trash2,
  UploadCloud,
} from "lucide-react";
import i18n from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { useCustomerStore } from "@/stores/customerStore";
import { routerService } from "@/services/router.service";
import { isDemo, resolveOrgId } from "@/services/customer.service";
import { requestErrorOf } from "@/services/api";
import {
  featureAppliesToControllerVenue,
  partitionRoutersByDeviceWrite,
} from "@/lib/router-vendors";
import { locationControllerVendor, locationIsControllerManaged } from "@/lib/location-liveness";
import { ControllerManagedFeatureNotice } from "@/components/customer/ControllerManagedFeatureNotice";
import {
  useCreateFirewallRule,
  useDeleteFirewallRule,
  useFirewallBand,
  useFirewallRules,
  usePushFirewallRules,
  useUpdateFirewallRule,
} from "@/hooks/useFirewall";
import {
  BAND_MISSING_SENTENCE,
  FIREWALL_SERVICES,
  PUSH_STATUS_LABEL,
  applySummary,
  describeAction,
  describeService,
  describeWhere,
  describeWho,
  draftToFields,
  firewallPushErrorSentence,
  inRouterOrder,
  isCustomerEditable,
  ruleToDraft,
  validateFirewallDraft,
  type FirewallRuleDraft,
  type FirewallServiceId,
  type PushErrorExplained,
} from "@/lib/firewall-rules";
import type { FirewallPushResult, FirewallRule } from "@/types/firewall";
import type { RouterDevice } from "@/types/router";

/**
 * Security -> Firewall. Who may reach what, from the venue's guest network,
 * on the venue's MikroTik -- and the one button that puts it on the router.
 *
 * ## What this screen is, and is not
 *
 * The rules are the existing `/firewall-rules` rows (the same ones the
 * operator screen, `network/FirewallManagement.tsx`, edits), read and written
 * through the same `firewallService` and `useFirewall` hooks. Nothing here is
 * a second store. What is new is the vocabulary -- no chain, no protocol
 * dropdown, no "place-before" -- which lives entirely in
 * `lib/firewall-rules.ts`, and the Apply action from cloud-guest#304.
 *
 * ## Saved is not applied
 *
 * Saving a rule changes nothing on the router. Apply sends the router its
 * whole set in order (#304 pushes per router, never per rule, because order
 * is a property of the set), and every row carries its own status from that
 * push: "Saved, not applied", "Applied" or "Failed" with the reason. A
 * customer who is shown "Applied" can believe it -- the backend only sets it
 * after reading the rule back off the router.
 *
 * ## Controller-managed venues
 *
 * The rules screen is never mounted there: `CustomerFeaturePage` renders
 * the existing `ControllerManagedFeatureNotice` instead ("firewall" is in
 * `CONTROLLER_UNSUPPORTED_FEATURE_IDS`), and this component applies the same
 * gate itself for the staff `/agent` shell, which has no gate of its own. At a
 * MIXED venue it lists only the MikroTik(s), and `ControllerRoutersNote`
 * names the controller it left out.
 */
export function FirewallView({ locationId }: { locationId?: string }) {
  const { t } = useTranslation("nav", { i18n });
  const activeLocation = useCustomerStore((s) => s.activeLocation);
  const demo = isDemo();
  const controllerGated =
    locationIsControllerManaged(activeLocation?.liveness) &&
    !featureAppliesToControllerVenue("firewall");

  const routersQuery = useQuery({
    queryKey: ["firewall", "venue-routers", locationId],
    enabled: !!locationId && !demo && !controllerGated,
    queryFn: async () => {
      const orgId = activeLocation?.organizationId || (await resolveOrgId());
      return routerService.listForLocation(locationId as string, orgId);
    },
  });

  const intro = (
    <p className="max-w-3xl text-sm text-muted-foreground">
      {t(
        "firewallPage.intro",
        "Decide which devices on your network may reach which addresses. Rules are checked in order, top first, and nothing changes on your router until you apply them.",
      )}
    </p>
  );

  if (controllerGated) {
    return (
      <ControllerManagedFeatureNotice
        featureId="firewall"
        featureLabel={t("customerItem.firewall", "Firewall")}
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
          icon={ShieldAlert}
          title={t("firewallPage.demoTitle", "Not part of the demo account")}
          description={t(
            "firewallPage.demoBody",
            "Firewall rules are written to a real router, and the demo account has none.",
          )}
        />
      </div>
    );
  }

  const rows = routersQuery.data ?? [];
  const { writable } = partitionRoutersByDeviceWrite(rows);

  return (
    <div className="space-y-5">
      {intro}
      {routersQuery.isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          {t("firewallPage.loadingRouters", "Loading this venue's routers…")}
        </div>
      ) : routersQuery.isError ? (
        <p role="alert" className="text-sm text-destructive">
          {requestErrorOf(routersQuery.error)?.message ??
            t("firewallPage.routersError", "Couldn't load this venue's routers.")}
        </p>
      ) : writable.length === 0 ? (
        <EmptyState
          icon={RouterIcon}
          title={t("firewallPage.noRouterTitle", "No router here can take firewall rules")}
          description={
            rows.length === 0
              ? t("firewallPage.noRouterBody", "This venue has no router yet.")
              : undefined
          }
        >
          <ControllerRoutersNote rows={rows} />
        </EmptyState>
      ) : (
        <>
          <ControllerRoutersNote rows={rows} />
          {writable.map((router) => (
            <RouterFirewallCard
              key={router.id}
              router={router}
              organizationId={activeLocation?.organizationId}
            />
          ))}
        </>
      )}
    </div>
  );
}

const STATUS_STYLE: Record<"pending" | "active" | "failed", string> = {
  active: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:text-emerald-400",
  pending: "bg-zinc-500/10 text-zinc-600 border-zinc-500/20 dark:text-zinc-400",
  failed: "bg-rose-500/10 text-rose-700 border-rose-500/20 dark:text-rose-400",
};

function RouterFirewallCard({
  router,
  organizationId,
}: {
  router: RouterDevice;
  organizationId?: string;
}) {
  const { t } = useTranslation("nav", { i18n });
  const rulesQuery = useFirewallRules({ routerId: router.id, page: 1, pageSize: 100 });
  const band = useFirewallBand(router.id, organizationId);
  const push = usePushFirewallRules();
  const update = useUpdateFirewallRule();
  const del = useDeleteFirewallRule();

  const [editing, setEditing] = useState<FirewallRule | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<FirewallRule | null>(null);
  const [confirmApply, setConfirmApply] = useState(false);
  const [pushError, setPushError] = useState<PushErrorExplained | null>(null);
  const [pushResult, setPushResult] = useState<FirewallPushResult | null>(null);
  const [moving, setMoving] = useState(false);

  // The list endpoint filters by router, so this is already one router's
  // set; it is sorted here into the order the router checks it.
  const rules = useMemo(() => inRouterOrder(rulesQuery.data?.rows ?? []), [rulesQuery.data]);
  const summary = applySummary(rules);
  const notApplied = rules.filter(
    (r) => r.devicePushStatus === "pending" || r.devicePushStatus === "failed",
  ).length;
  const bandState = band.data?.state ?? null;
  // Only a KNOWN missing band disables Apply. Unknown (the status endpoint is
  // absent or unreadable) leaves it on: the push refuses by itself if the
  // band is missing, and that refusal is rendered in full.
  const bandBlocksApply = bandState === "missing" || bandState === "invalid";
  const nextPriority = rules.length ? Math.max(...rules.map((r) => r.priority)) + 10 : 100;

  function runPush() {
    setConfirmApply(false);
    setPushError(null);
    setPushResult(null);
    push.mutate(router.id, {
      onSuccess: (result) => {
        setPushResult(result);
        toast.success(
          t("firewallPage.appliedToast", "Firewall rules applied to {{router}}", {
            router: router.name,
          }),
        );
      },
      onError: (err) => setPushError(firewallPushErrorSentence(requestErrorOf(err))),
    });
  }

  function toggle(rule: FirewallRule, on: boolean) {
    update.mutate(
      { id: rule.id, payload: { isEnabled: on } },
      {
        onError: (err) => toast.error(requestErrorOf(err)?.message ?? "Couldn't change the rule."),
      },
    );
  }

  /** Swap with the neighbour. Two updates, because the backend orders by a
   * number, not by position; equal numbers are separated by one instead. */
  async function move(rule: FirewallRule, dir: -1 | 1) {
    const i = rules.findIndex((r) => r.id === rule.id);
    const other = rules[i + dir];
    if (!other) return;
    setMoving(true);
    try {
      if (other.priority !== rule.priority) {
        await update.mutateAsync({ id: rule.id, payload: { priority: other.priority } });
        await update.mutateAsync({ id: other.id, payload: { priority: rule.priority } });
      } else if (dir === 1) {
        await update.mutateAsync({ id: rule.id, payload: { priority: rule.priority + 1 } });
      } else if (rule.priority > 0) {
        await update.mutateAsync({ id: rule.id, payload: { priority: rule.priority - 1 } });
      } else {
        // Already at 0 and tied: push the neighbour down instead.
        await update.mutateAsync({ id: other.id, payload: { priority: other.priority + 1 } });
      }
    } catch (err) {
      toast.error(requestErrorOf(err)?.message ?? "Couldn't change the order.");
    } finally {
      setMoving(false);
    }
  }

  return (
    <Card className="border-border/60">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <RouterIcon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            {router.name}
          </CardTitle>
          {bandState === "ready" && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
              {t("firewallPage.bandReady", "This router is ready for firewall rules.")}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => setCreating(true)}>
            <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
            {t("firewallPage.addRule", "Add a rule")}
          </Button>
          <Button
            onClick={() => setConfirmApply(true)}
            disabled={push.isPending || rulesQuery.isLoading || bandBlocksApply}
          >
            {push.isPending ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <UploadCloud className="mr-1.5 h-4 w-4" aria-hidden="true" />
            )}
            {t("firewallPage.apply", "Apply to router")}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* No button, deliberately: preparing a router is a Master-console
            action (firewall.manage, GLOBAL scope). A customer-facing button
            would 403. */}
        {bandBlocksApply && (
          <p
            role="status"
            className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-300"
          >
            {t("firewallPage.bandMissing", BAND_MISSING_SENTENCE)}
          </p>
        )}

        {pushError && (
          <div
            role="alert"
            className="space-y-1 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm"
          >
            <p className="font-medium text-destructive">{pushError.sentence}</p>
            {pushError.detail && (
              <p className="text-xs text-muted-foreground">
                {t("firewallPage.routerSaid", "What the router said:")} {pushError.detail}
              </p>
            )}
          </div>
        )}

        {pushResult && !pushError && (
          <p
            role="status"
            className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-800 dark:text-emerald-300"
          >
            {pushResult.added + pushResult.removed === 0
              ? t(
                  "firewallPage.appliedNoChange",
                  "The router already had exactly these rules. Nothing needed to change.",
                )
              : t(
                  "firewallPage.appliedCounts",
                  "Applied. {{added}} rule(s) put on the router, {{removed}} taken off, {{unchanged}} already there.",
                  {
                    added: pushResult.added,
                    removed: pushResult.removed,
                    unchanged: pushResult.unchanged,
                  },
                )}
          </p>
        )}

        {notApplied > 0 && !push.isPending && (
          <p className="text-xs text-muted-foreground">
            {t(
              "firewallPage.notAppliedHint",
              "{{count}} rule(s) are saved but not on the router. They take effect when you apply them.",
              { count: notApplied },
            )}
          </p>
        )}

        {rulesQuery.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            {t("firewallPage.loadingRules", "Loading rules…")}
          </div>
        ) : rulesQuery.isError ? (
          <p role="alert" className="text-sm text-destructive">
            {requestErrorOf(rulesQuery.error)?.message ??
              t("firewallPage.rulesError", "Couldn't load this router's rules.")}
          </p>
        ) : rules.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            {t(
              "firewallPage.noRules",
              "No rules yet. Without any, the router lets your network's traffic through as it does today.",
            )}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[72px]">{t("firewallPage.colOrder", "Order")}</TableHead>
                  <TableHead>{t("firewallPage.colRule", "Rule")}</TableHead>
                  <TableHead>{t("firewallPage.colWhoWhere", "Who → where")}</TableHead>
                  <TableHead>{t("firewallPage.colService", "Service")}</TableHead>
                  <TableHead>{t("firewallPage.colDecision", "Decision")}</TableHead>
                  <TableHead>{t("firewallPage.colOn", "On")}</TableHead>
                  <TableHead>{t("firewallPage.colStatus", "On the router")}</TableHead>
                  <TableHead className="w-[96px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.map((rule, i) => {
                  const editable = isCustomerEditable(rule);
                  const decision = describeAction(rule.action);
                  return (
                    <TableRow key={rule.id}>
                      <TableCell>
                        <div className="flex items-center gap-0.5">
                          <span className="w-5 text-sm tabular-nums text-muted-foreground">
                            {i + 1}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            aria-label={t("firewallPage.moveUp", "Move up")}
                            disabled={i === 0 || moving || !editable.editable}
                            onClick={() => void move(rule, -1)}
                          >
                            <ArrowUp className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            aria-label={t("firewallPage.moveDown", "Move down")}
                            disabled={i === rules.length - 1 || moving || !editable.editable}
                            onClick={() => void move(rule, 1)}
                          >
                            <ArrowDown className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm font-medium">{rule.name}</p>
                        {rule.comment && (
                          <p className="text-xs text-muted-foreground">{rule.comment}</p>
                        )}
                        {!editable.editable && (
                          <p className="mt-1 max-w-xs text-xs text-amber-700 dark:text-amber-400">
                            {editable.reason}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {describeWho(rule.sourceAddress)}{" "}
                        <span className="text-muted-foreground">→</span>{" "}
                        {describeWhere(rule.destinationAddress)}
                      </TableCell>
                      <TableCell className="text-sm">{describeService(rule)}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            "rounded-full",
                            decision === "Allow"
                              ? "border-emerald-500/30 text-emerald-700 dark:text-emerald-400"
                              : "border-rose-500/30 text-rose-700 dark:text-rose-400",
                          )}
                        >
                          {decision === "Allow"
                            ? t("firewallPage.allow", "Allow")
                            : t("firewallPage.block", "Block")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={rule.isEnabled}
                          disabled={!editable.editable || update.isPending}
                          onCheckedChange={(v) => toggle(rule, v)}
                          aria-label={t("firewallPage.toggle", "Rule on or off")}
                        />
                      </TableCell>
                      <TableCell>
                        {rule.devicePushStatus ? (
                          <div className="space-y-1">
                            <Badge
                              variant="outline"
                              className={cn(
                                "rounded-full font-medium",
                                STATUS_STYLE[rule.devicePushStatus],
                              )}
                            >
                              {t(
                                `firewallPage.status.${rule.devicePushStatus}`,
                                PUSH_STATUS_LABEL[rule.devicePushStatus],
                              )}
                            </Badge>
                            {rule.devicePushStatus === "failed" && rule.devicePushError && (
                              <p className="max-w-xs text-xs text-muted-foreground">
                                {rule.devicePushError}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            aria-label={t("firewallPage.edit", "Edit")}
                            disabled={!editable.editable}
                            onClick={() => setEditing(rule)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            aria-label={t("firewallPage.delete", "Delete")}
                            disabled={!editable.editable}
                            onClick={() => setConfirmDelete(rule)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {(creating || editing) && (
        <RuleDialog
          routerId={router.id}
          rule={editing}
          defaultPriority={nextPriority}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}

      <AlertDialog open={confirmApply} onOpenChange={setConfirmApply}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("firewallPage.applyTitle", "Apply these rules to {{router}}?", {
                router: router.name,
              })}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  {summary.on === 0
                    ? t(
                        "firewallPage.applyNone",
                        "No rule is switched on, so the router will be left with none of your rules.",
                      )
                    : t(
                        "firewallPage.applyOn",
                        "The router will get the {{on}} switched-on rule(s) listed here, checked in the order shown ({{blocks}} of them Block).",
                        { on: summary.on, blocks: summary.blocks },
                      )}
                </p>
                {summary.off > 0 && (
                  <p>
                    {t(
                      "firewallPage.applyOff",
                      "{{off}} switched-off rule(s), and any rule you deleted, will be taken off the router.",
                      { off: summary.off },
                    )}
                  </p>
                )}
                <p>
                  {t(
                    "firewallPage.applyEffect",
                    "It takes effect straight away: traffic that matches a Block rule stops, including for guests already connected. Nothing else on the router is changed.",
                  )}
                </p>
                {summary.unpushable > 0 && (
                  <p className="text-amber-700 dark:text-amber-400">
                    {t(
                      "firewallPage.applyUnpushable",
                      "{{count}} switched-on rule(s) protect the router itself and can't be applied from here, so the router will refuse this change until they are switched off.",
                      { count: summary.unpushable },
                    )}
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("firewallPage.cancel", "Cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={runPush}>
              {t("firewallPage.apply", "Apply to router")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("firewallPage.deleteTitle", "Delete “{{name}}”?", {
                name: confirmDelete?.name ?? "",
              })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDelete?.devicePushStatus === "active"
                ? t(
                    "firewallPage.deleteActive",
                    "This rule is on the router now. Deleting it here removes it from this list; it comes off the router the next time you apply.",
                  )
                : t(
                    "firewallPage.deletePending",
                    "This rule is not on the router, so deleting it changes nothing there.",
                  )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("firewallPage.cancel", "Cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                const target = confirmDelete;
                setConfirmDelete(null);
                if (!target) return;
                del.mutate(target.id, {
                  onError: (err) =>
                    toast.error(requestErrorOf(err)?.message ?? "Couldn't delete the rule."),
                });
              }}
            >
              {t("firewallPage.delete", "Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

function emptyDraft(priority: number): FirewallRuleDraft {
  return {
    name: "",
    decision: "block",
    who: "",
    where: "",
    service: "everything",
    customProtocol: "tcp",
    customPort: "",
    priority,
    isEnabled: true,
  };
}

/** Create or edit one rule with plain pickers. Saving never touches the
 * router -- the row comes back "Saved, not applied". */
function RuleDialog({
  routerId,
  rule,
  defaultPriority,
  onClose,
}: {
  routerId: string;
  rule: FirewallRule | null;
  defaultPriority: number;
  onClose: () => void;
}) {
  const { t } = useTranslation("nav", { i18n });
  const create = useCreateFirewallRule();
  const update = useUpdateFirewallRule();
  const [draft, setDraft] = useState<FirewallRuleDraft>(() =>
    rule ? ruleToDraft(rule) : emptyDraft(defaultPriority),
  );
  const [whoMode, setWhoMode] = useState<"any" | "specific">(
    rule?.sourceAddress ? "specific" : "any",
  );
  const [whereMode, setWhereMode] = useState<"any" | "specific">(
    rule?.destinationAddress ? "specific" : "any",
  );
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState(false);

  const effective: FirewallRuleDraft = {
    ...draft,
    who: whoMode === "any" ? "" : draft.who,
    where: whereMode === "any" ? "" : draft.where,
  };
  const errors = validateFirewallDraft(effective);
  const valid = Object.keys(errors).length === 0;
  const fields = draftToFields(effective);
  const set = <K extends keyof FirewallRuleDraft>(k: K, v: FirewallRuleDraft[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  async function save() {
    setShowErrors(true);
    if (!valid) return;
    setSaving(true);
    try {
      if (!rule) {
        await create.mutateAsync({ routerId, ...fields });
      } else {
        // One PUT. `fields` carries an explicit `null` for an address or a
        // port the owner took away, and cloud-guest#306 clears a field on an
        // explicit null (an omitted one is left unchanged). Nothing the form
        // doesn't show -- source port, interface, comment -- is sent, so
        // those are kept as they are.
        await update.mutateAsync({ id: rule.id, payload: fields });
      }
      toast.success(t("firewallPage.savedToast", "Saved. Apply to router when you're ready."));
      onClose();
    } catch (err) {
      toast.error(requestErrorOf(err)?.message ?? "Couldn't save the rule.");
    } finally {
      setSaving(false);
    }
  }

  const err = (k: keyof FirewallRuleDraft) =>
    showErrors && errors[k] ? (
      <p className="text-xs text-destructive" role="alert">
        {errors[k]}
      </p>
    ) : null;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {rule
              ? t("firewallPage.editTitle", "Edit rule")
              : t("firewallPage.addTitle", "Add a rule")}
          </DialogTitle>
          <DialogDescription>
            {t(
              "firewallPage.formHint",
              "Saving doesn't change the router. Apply to router sends your rules to it.",
            )}
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="fw-name">{t("firewallPage.fieldName", "Name")}</Label>
            <Input
              id="fw-name"
              value={draft.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder={t(
                "firewallPage.namePlaceholder",
                "e.g. Keep guests off the office printer",
              )}
            />
            {err("name")}
          </div>

          <div className="space-y-1.5">
            <Label>{t("firewallPage.fieldDecision", "What should happen")}</Label>
            <RadioGroup
              value={draft.decision}
              onValueChange={(v) => set("decision", v === "allow" ? "allow" : "block")}
              className="flex gap-4"
            >
              <label className="flex items-center gap-2 text-sm">
                <RadioGroupItem value="block" /> {t("firewallPage.block", "Block")}
              </label>
              <label className="flex items-center gap-2 text-sm">
                <RadioGroupItem value="allow" /> {t("firewallPage.allow", "Allow")}
              </label>
            </RadioGroup>
          </div>

          <div className="space-y-1.5">
            <Label>{t("firewallPage.fieldWho", "Who")}</Label>
            <RadioGroup
              value={whoMode}
              onValueChange={(v) => setWhoMode(v === "specific" ? "specific" : "any")}
              className="space-y-1"
            >
              <label className="flex items-center gap-2 text-sm">
                <RadioGroupItem value="any" /> {t("firewallPage.whoAny", "Any device")}
              </label>
              <label className="flex items-center gap-2 text-sm">
                <RadioGroupItem value="specific" />{" "}
                {t("firewallPage.whoSpecific", "A specific device or group of devices")}
              </label>
            </RadioGroup>
            {whoMode === "specific" && (
              <Input
                value={draft.who}
                onChange={(e) => set("who", e.target.value)}
                placeholder="192.168.88.50 or 192.168.88.0/24"
                aria-label={t("firewallPage.whoAddress", "Device address or range")}
              />
            )}
            {err("who")}
          </div>

          <div className="space-y-1.5">
            <Label>{t("firewallPage.fieldWhere", "Where to")}</Label>
            <RadioGroup
              value={whereMode}
              onValueChange={(v) => setWhereMode(v === "specific" ? "specific" : "any")}
              className="space-y-1"
            >
              <label className="flex items-center gap-2 text-sm">
                <RadioGroupItem value="any" /> {t("firewallPage.whereAny", "Anywhere")}
              </label>
              <label className="flex items-center gap-2 text-sm">
                <RadioGroupItem value="specific" />{" "}
                {t("firewallPage.whereSpecific", "A specific address or range")}
              </label>
            </RadioGroup>
            {whereMode === "specific" && (
              <Input
                value={draft.where}
                onChange={(e) => set("where", e.target.value)}
                placeholder="203.0.113.9 or 203.0.113.0/24"
                aria-label={t("firewallPage.whereAddress", "Destination address or range")}
              />
            )}
            {err("where")}
          </div>

          <div className="space-y-1.5">
            <Label>{t("firewallPage.fieldService", "Which traffic")}</Label>
            <Select
              value={draft.service}
              onValueChange={(v) => set("service", v as FirewallServiceId)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FIREWALL_SERVICES.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {err("service")}
            {draft.service === "custom" && (
              <div className="flex gap-2">
                <Select
                  value={draft.customProtocol}
                  onValueChange={(v) => set("customProtocol", v === "udp" ? "udp" : "tcp")}
                >
                  <SelectTrigger className="w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tcp">TCP</SelectItem>
                    <SelectItem value="udp">UDP</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  inputMode="numeric"
                  value={draft.customPort}
                  onChange={(e) => set("customPort", e.target.value)}
                  placeholder={t("firewallPage.portPlaceholder", "Port, e.g. 8080")}
                  aria-label={t("firewallPage.port", "Port")}
                />
              </div>
            )}
            {err("customPort")}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="fw-order">{t("firewallPage.fieldOrder", "Order")}</Label>
              <Input
                id="fw-order"
                inputMode="numeric"
                value={String(draft.priority)}
                onChange={(e) => set("priority", Number(e.target.value.replace(/\D/g, "") || 0))}
              />
              <p className="text-[11px] text-muted-foreground">
                {t("firewallPage.orderHint", "Lower numbers are checked first.")}
              </p>
              {err("priority")}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fw-on">{t("firewallPage.fieldOn", "Switched on")}</Label>
              <div className="pt-1.5">
                <Switch
                  id="fw-on"
                  checked={draft.isEnabled}
                  onCheckedChange={(v) => set("isEnabled", v)}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t("firewallPage.cancel", "Cancel")}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden="true" />}
              {t("firewallPage.save", "Save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default FirewallView;
