import i18n from "@/lib/i18n";
import { useTranslation } from "react-i18next";
import { useId, useState } from "react";
import { Plus } from "lucide-react";
import { z } from "zod";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ControllerRoutersNote, RouterPickerItems } from "@/components/network/RouterPickerItems";
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
import {
  DataTable,
  FormField,
  FormSection,
  FormSwitchRow,
  PageHeader,
  Panel,
  StatTile,
  StatusDot,
  TablePager,
  Toolbar,
  ToolbarSearch,
  type DataTableColumn,
} from "@/components/customer/console";
import {
  DIALOG_CONSOLE,
  EnabledBadge,
  NameCell,
  PushStatusBadge,
  RowActions,
  SCREEN_ROOT,
  type PageScope,
} from "@/components/network/network-ui";
import {
  usePortForwardingRules,
  useCreatePortForwardingRule,
  useUpdatePortForwardingRule,
  useDeletePortForwardingRule,
  usePushPortForwardingRule,
} from "@/hooks/usePortForwarding";
import { routerService } from "@/services/router.service";
import { isDemo, resolveOrgId } from "@/services/customer.service";
import { partialCountHint } from "@/components/network/list-kpis";
import type { AppError } from "@/services/api";
import type { PortForwardingDevicePushStatus, PortForwardingRule } from "@/types/port-forwarding";

const PAGE_SIZE = 25;
const PROTOCOLS = ["tcp", "udp", "both"] as const;

const ruleSchema = z.object({
  routerId: z.string().min(1, "common.selectRouter"),
  name: z.string().trim().min(2, "common.required").max(48),
  protocol: z.enum(PROTOCOLS),
  sourceAddress: z.string().trim().optional().or(z.literal("")),
  destinationAddress: z.string().trim().optional().or(z.literal("")),
  destinationPort: z.coerce.number().int().min(1).max(65535),
  internalAddress: z.string().trim().min(1, "common.required"),
  internalPort: z.coerce.number().int().min(1).max(65535),
  description: z.string().trim().max(240).optional().or(z.literal("")),
  isEnabled: z.boolean(),
});
type RuleFormValues = z.infer<typeof ruleSchema>;

/** i18n keys (network namespace), rendered through `t`. */
const DEVICE_PUSH_LABEL: Record<PortForwardingDevicePushStatus, string> = {
  active: "common.push.applied",
  pending: "common.push.pending",
  failed: "common.push.failed",
};

/** Whether this rule actually exists on the router.
 *
 * Worth its own column rather than folding into "Status": `isEnabled` is
 * intent, this is fact, and until the domain had a device push every rule
 * ever created sat permanently unapplied while the UI said "Enabled" --
 * no `/ip firewall nat` DSTNAT entry had ever been created, so the public
 * port the dashboard said was forwarded answered nothing at all.
 *
 * A failed push shows the router's own words rather than a generic
 * message: "already have such item" or a policy denial tells an operator
 * what to do, and summarising device errors is how the silence started.
 */
function DevicePushBadge({ rule }: { rule: PortForwardingRule }) {
  const { t } = useTranslation("network", { i18n });
  return (
    <PushStatusBadge
      status={rule.devicePushStatus}
      label={t(DEVICE_PUSH_LABEL[rule.devicePushStatus])}
      error={rule.devicePushError}
      errorPrefix={t("portForwarding.couldnTApplyThisRule")}
    />
  );
}

export function PortForwardingManagement({
  locationId,
  scope,
}: {
  locationId?: string;
  /** Title + venue from the customer shell, which then draws no header of its own. */
  scope?: PageScope;
} = {}) {
  const { t } = useTranslation("network", { i18n });
  const [page, setPage] = useState(1);
  const [routerFilter, setRouterFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<PortForwardingRule | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<PortForwardingRule | null>(null);

  // No org id is resolved or threaded here, and this query has no `enabled`
  // gate. `list_port_forwarding_rules` still scopes on X-Organization-Id, but
  // `attachOrganizationScope` (services/api.ts) attaches it to every request
  // an organization-scoped session makes, and attaches nothing for a
  // GLOBAL-scope one -- so the unscoped /network view still spans every org.
  //
  // This used to gate on a `scopedOrgId` query and put that id in the React
  // Query key, which cost every read on this page a second request: `demoFlag`
  // starts true (useIsDemo is post-mount by design, for hydration), so the
  // gate was already open on the first render and the query fired with
  // `organizationId: undefined`; the flag then flipped, the id resolved, the
  // key changed, and everything refetched. A live capture showed this
  // endpoint hit four times on one page load.
  //
  // The backend's `GET /port-forwarding/rules` only filters by `router_id`,
  // not location -- so a location-scoped view (the customer dashboard's Port
  // Forwarding page) fetches one full (up to max page_size) page and narrows
  // + paginates it client-side below, same tradeoff DhcpManagement makes.
  const { data, isLoading } = usePortForwardingRules({
    page: locationId ? 1 : page,
    pageSize: locationId ? 100 : PAGE_SIZE,
    routerId: routerFilter === "all" ? undefined : routerFilter,
  });
  const del = useDeletePortForwardingRule();
  const push = usePushPortForwardingRule();

  /** Sends one rule to its router, and says what the router said back.
   *
   * A failure arrives as a real non-2xx carrying the device's own error
   * text, so it is worth showing verbatim -- "already have such item" or a
   * connection timeout tells an operator far more than a generic message
   * would. The backend never returns a 2xx for a failed push, precisely so
   * this `onError` is reachable. */
  function handlePush(rule: PortForwardingRule) {
    push.mutate(
      { id: rule.id },
      {
        onSuccess: () => toast.success(t("dhcp.appliedToTheRouter", { name: rule.name })),
        onError: (err) =>
          toast.error(
            (err as unknown as AppError)?.message ||
              t("dhcp.couldnTApplyToThe", { name: rule.name }),
          ),
      },
    );
  }
  const { data: routers = { rows: [], total: 0 } } = useQuery({
    queryKey: ["port-forwarding", "router-options", locationId],
    queryFn: async () => {
      // Location-scoped: use the location-scoped router endpoint directly
      // (mirrors DhcpManagement/VlanManagement) -- `routerService.list()`'s
      // "all routers" path fans out through the platform-wide
      // `GET /organizations`, which an ordinary org-owner session 403s on.
      if (locationId) {
        // Demo mode: routerService.listForLocation() already ignores this
        // arg (returns DEMO_ROUTERS), so skip resolving a real org id for
        // it -- resolveOrgId() itself has no demo guard and would still
        // fire a real (401ing) request even though its result goes unused.
        const orgId = isDemo() ? "" : await resolveOrgId();
        const rows = await routerService.listVenueRouters(locationId, orgId);
        return { rows, total: rows.length };
      }
      return routerService.listAll();
    },
  });

  const routerName = (id: string) => routers.rows.find((r) => r.id === id)?.name ?? id.slice(0, 8);

  const filteredRows = (data?.rows ?? []).filter((r) => {
    if (locationId && r.locationId !== locationId) return false;
    if (!search.trim()) return true;
    const t = search.trim().toLowerCase();
    return (
      r.name.toLowerCase().includes(t) ||
      String(r.destinationPort).includes(t) ||
      r.internalAddress.includes(t) ||
      routerName(r.routerId).toLowerCase().includes(t)
    );
  });

  const rows = locationId
    ? filteredRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
    : filteredRows;
  const total = locationId ? filteredRows.length : (data?.total ?? 0);
  const totalPages = locationId
    ? Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE))
    : (data?.totalPages ?? 1);
  const hasNext = locationId ? page < totalPages : !!data?.hasNext;
  const hasPrevious = locationId ? page > 1 : !!data?.hasPrevious;
  // Tiles come from the list response above, never a second request -- see
  // components/network/list-kpis.ts. The endpoint has no location filter, so
  // a location-scoped view counts the rows it narrowed itself; either way the
  // hint says so whenever the loaded rows fall short of the server's total.
  const statHint = partialCountHint(data?.rows.length ?? 0, data?.total ?? 0);
  const statTotal = locationId ? total : (data?.total ?? 0);
  const statEnabled = filteredRows.filter((r) => r.isEnabled).length;
  const statDisabled = filteredRows.length - statEnabled;
  // Unscoped, "Total Rules" is the server's own `total_items` and needs no
  // qualifying; location-scoped it is this page's own narrowing of the rows
  // that arrived, so it carries the same hint the other two do.
  const totalHint = locationId ? statHint : undefined;

  const columns: DataTableColumn<PortForwardingRule>[] = [
    {
      id: "name",
      header: t("portForwarding.rule"),
      mobile: "title",
      cell: (r) => <NameCell name={r.name} sub={r.description} />,
    },
    { id: "router", header: t("dhcp.router"), cell: (r) => routerName(r.routerId) },
    {
      id: "protocol",
      header: t("portForwarding.protocol"),
      className: "text-xs uppercase text-[var(--wy-text-muted)]",
      cell: (r) => r.protocol,
    },
    {
      id: "destination",
      header: t("portForwarding.destination"),
      mono: true,
      cell: (r) => `${r.destinationAddress ?? "any"}:${r.destinationPort}`,
    },
    {
      id: "internal",
      header: t("portForwarding.internalTarget"),
      mono: true,
      cell: (r) => `${r.internalAddress}:${r.internalPort}`,
    },
    { id: "status", header: t("dhcp.status"), cell: (r) => <EnabledBadge enabled={r.isEnabled} /> },
    { id: "push", header: t("dhcp.onRouter"), cell: (r) => <DevicePushBadge rule={r} /> },
  ];

  return (
    <div className={SCREEN_ROOT}>
      {/* Under the customer shell this is the page's only header: the shell
       * hands over the tab name and venue (`scope`) and draws none itself. */}
      <PageHeader
        title={scope?.title ?? t("portForwarding.portForwarding")}
        venue={scope?.venue}
        description={t("portForwarding.perRouterNatRulesMapping")}
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus aria-hidden className="mr-1.5 h-4 w-4" /> {t("portForwarding.newRule")}
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile
          label={t("portForwarding.totalRules")}
          value={statTotal}
          hint={totalHint}
          loading={isLoading}
        />
        <StatTile
          label={t("dhcp.enabled")}
          value={statEnabled}
          hint={statHint}
          loading={isLoading}
          leading={<StatusDot status="ok" label={t("dhcp.enabled")} size="sm" />}
        />
        <StatTile
          label={t("dhcp.disabled")}
          value={statDisabled}
          hint={statHint}
          loading={isLoading}
          leading={<StatusDot status="offline" label={t("dhcp.disabled")} size="sm" />}
        />
      </div>

      <Panel flush title={t("portForwarding.allRules")}>
        <Toolbar divided>
          <Select
            value={routerFilter}
            onValueChange={(v) => {
              setRouterFilter(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-full sm:w-48" aria-label={t("dhcp.router")}>
              <SelectValue placeholder={t("dhcp.allRouters")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("dhcp.allRouters")}</SelectItem>
              {/* Contract §11.5: the two kinds of device are listed
                  apart, and only the ones this platform configures are
                  selectable. See RouterPickerItems. */}
              <RouterPickerItems rows={routers.rows} />
            </SelectContent>
          </Select>
          <ToolbarSearch
            value={search}
            onValueChange={setSearch}
            placeholder={t("portForwarding.searchNamePortAddressRouter")}
          />
        </Toolbar>
        <DataTable
          ariaLabel={t("portForwarding.allRules")}
          columns={columns}
          rows={rows}
          rowKey={(r) => r.id}
          loading={isLoading}
          loadingLabel={t("dhcp.loading")}
          empty={t("portForwarding.noPortForwardingRulesMatch")}
          maxHeight="70vh"
          rowActions={(r) => (
            /* Apply is always visible, unlike the revealed edit/delete
               pair: this is the step that actually reaches the hardware,
               and a rule sitting at "Not yet applied" is the thing an
               operator most needs to notice -- it is the difference
               between a forwarded port that answers and one that does not.

               `push.variables?.id === r.id` scopes the pending state to the
               row being pushed: a bare `push.isPending` off this one shared
               mutation object freezes every row's button during any one
               push. */
            <RowActions
              name={r.name}
              apply={{
                label: r.devicePushStatus === "active" ? t("dhcp.reApply") : t("dhcp.apply"),
                pending: push.isPending && push.variables?.id === r.id,
                quiet: r.devicePushStatus === "active",
                onClick: () => handlePush(r),
              }}
              onEdit={() => setEditing(r)}
              onDelete={() => setConfirmDelete(r)}
            />
          )}
          footer={
            totalPages > 1 ? (
              <TablePager
                summary={t("portForwarding.pageOfRules", { page, totalPages, total })}
                previousLabel={t("common.previous")}
                nextLabel={t("common.next")}
                hasPrevious={hasPrevious}
                hasNext={hasNext}
                onPrevious={() => setPage((p) => p - 1)}
                onNext={() => setPage((p) => p + 1)}
              />
            ) : undefined
          }
        />
      </Panel>

      <RuleDialog
        open={creating || !!editing}
        rule={editing}
        routers={routers.rows}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
      />

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent className={DIALOG_CONSOLE}>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("portForwarding.deleteRuleTitle", { name: confirmDelete?.name })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("portForwarding.removeBody", {
                router: confirmDelete ? routerName(confirmDelete.routerId) : "",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("dhcp.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!confirmDelete) return;
                try {
                  await del.mutateAsync({ id: confirmDelete.id });
                  toast.success(t("portForwarding.ruleDeleted", { name: confirmDelete.name }));
                } catch (err) {
                  toast.error((err as AppError).message || t("portForwarding.failedToDeleteRule"));
                }
                setConfirmDelete(null);
              }}
            >
              {t("portForwarding.deleteRule")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function RuleDialog({
  open,
  rule,
  routers,
  onClose,
}: {
  open: boolean;
  rule: PortForwardingRule | null;
  routers: { id: string; name: string }[];
  onClose: () => void;
}) {
  const { t } = useTranslation("network", { i18n });
  const create = useCreatePortForwardingRule();
  const update = useUpdatePortForwardingRule();

  const blank: RuleFormValues = {
    routerId: "",
    name: "",
    protocol: "both",
    sourceAddress: "",
    destinationAddress: "",
    destinationPort: 8080,
    internalAddress: "",
    internalPort: 80,
    description: "",
    isEnabled: true,
  };
  const defaults: RuleFormValues = rule
    ? {
        routerId: rule.routerId,
        name: rule.name,
        protocol: (rule.protocol as (typeof PROTOCOLS)[number]) ?? "both",
        sourceAddress: rule.sourceAddress ?? "",
        destinationAddress: rule.destinationAddress ?? "",
        destinationPort: rule.destinationPort,
        internalAddress: rule.internalAddress,
        internalPort: rule.internalPort,
        description: rule.description ?? "",
        isEnabled: rule.isEnabled,
      }
    : blank;

  const form = useForm<RuleFormValues>({
    resolver: zodResolver(ruleSchema),
    defaultValues: defaults,
    values: defaults,
  });
  const id = useId();

  /** Resets the form on the way out, so the next open starts clean.
   *
   * `useForm`'s `values` prop only resyncs when the object it is handed
   * deep-changes, and this dialog is never unmounted -- two consecutive
   * opens of the same target hand it the identical blank defaults, so no
   * reset fires and React Hook Form repopulates every input from the form
   * state it kept as each field re-registers. The dialog then reopens
   * showing the last attempt's values. Same convention as NasDevicesPanel
   * and SlaPanel. */
  function close() {
    form.reset(blank);
    onClose();
  }

  async function submit(v: RuleFormValues) {
    try {
      if (rule) {
        await update.mutateAsync({
          id: rule.id,
          payload: {
            name: v.name,
            protocol: v.protocol,
            sourceAddress: v.sourceAddress || null,
            destinationAddress: v.destinationAddress || null,
            destinationPort: v.destinationPort,
            internalAddress: v.internalAddress,
            internalPort: v.internalPort,
            description: v.description || null,
            isEnabled: v.isEnabled,
          },
        });
        toast.success(t("portForwarding.ruleUpdated"));
      } else {
        await create.mutateAsync({
          routerId: v.routerId,
          name: v.name,
          protocol: v.protocol,
          sourceAddress: v.sourceAddress || null,
          destinationAddress: v.destinationAddress || null,
          destinationPort: v.destinationPort,
          internalAddress: v.internalAddress,
          internalPort: v.internalPort,
          description: v.description || null,
          isEnabled: v.isEnabled,
        });
        toast.success(t("portForwarding.ruleCreated"));
      }
      close();
    } catch (err) {
      toast.error((err as AppError).message || t("portForwarding.failedToSaveRule"));
    }
  }

  const errors = form.formState.errors;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className={`${DIALOG_CONSOLE} max-w-lg`}>
        <DialogHeader>
          <DialogTitle>
            {rule ? t("portForwarding.editRule") : t("portForwarding.newRule")}
          </DialogTitle>
          <DialogDescription>
            {rule
              ? t("portForwarding.theRouterThisRuleBelongs")
              : t("portForwarding.aPortForwardingRuleBelongs")}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(submit)}>
          <FormSection
            variant="plain"
            footer={
              <>
                <Button type="button" variant="outline" onClick={close}>
                  {t("dhcp.cancel")}
                </Button>
                <Button type="submit" disabled={create.isPending || update.isPending}>
                  {rule ? t("dhcp.saveChanges") : t("portForwarding.createRule")}
                </Button>
              </>
            }
          >
            <FormField
              wide
              label={t("dhcp.router")}
              htmlFor={`${id}-router`}
              error={errors.routerId?.message && t(errors.routerId.message)}
            >
              <Controller
                control={form.control}
                name="routerId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange} disabled={!!rule}>
                    <SelectTrigger id={`${id}-router`}>
                      <SelectValue placeholder={t("dhcp.selectRouter")} />
                    </SelectTrigger>
                    <SelectContent>
                      {/* Contract §11.5. A controller is listed here but not
                          selectable: the backend refuses this write by vendor,
                          and meeting that refusal after the form is filled in
                          is the defect this closes. */}
                      <RouterPickerItems rows={routers} />
                    </SelectContent>
                  </Select>
                )}
              />
              {/* Names what was greyed out and why. Renders nothing at a venue
                  with no controller. */}
              <ControllerRoutersNote rows={routers} />
            </FormField>
            <FormField
              wide
              label={t("dhcp.name")}
              htmlFor={`${id}-name`}
              error={errors.name?.message && t(errors.name.message)}
            >
              <Input
                id={`${id}-name`}
                {...form.register("name")}
                placeholder={t("portForwarding.webServer")}
              />
            </FormField>
            <FormField label={t("portForwarding.protocol")} htmlFor={`${id}-protocol`}>
              <Controller
                control={form.control}
                name="protocol"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id={`${id}-protocol`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PROTOCOLS.map((p) => (
                        <SelectItem key={p} value={p}>
                          {p.toUpperCase()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>
            <FormField
              label={t("portForwarding.destinationPort")}
              htmlFor={`${id}-dport`}
              error={errors.destinationPort?.message && t(errors.destinationPort.message)}
            >
              <Input
                id={`${id}-dport`}
                type="number"
                min={1}
                max={65535}
                {...form.register("destinationPort")}
              />
            </FormField>
            <FormField label={t("portForwarding.sourceAddressOptional")} htmlFor={`${id}-src`}>
              <Input
                id={`${id}-src`}
                {...form.register("sourceAddress")}
                placeholder="0.0.0.0/0"
                className="font-mono"
              />
            </FormField>
            <FormField label={t("portForwarding.destinationAddressOptional")} htmlFor={`${id}-dst`}>
              <Input
                id={`${id}-dst`}
                {...form.register("destinationAddress")}
                placeholder="WAN IP"
                className="font-mono"
              />
            </FormField>
            <FormField
              label={t("portForwarding.internalAddress")}
              htmlFor={`${id}-iaddr`}
              error={errors.internalAddress?.message && t(errors.internalAddress.message)}
            >
              <Input
                id={`${id}-iaddr`}
                {...form.register("internalAddress")}
                placeholder="10.0.0.10"
                className="font-mono"
              />
            </FormField>
            <FormField
              label={t("portForwarding.internalPort")}
              htmlFor={`${id}-iport`}
              error={errors.internalPort?.message && t(errors.internalPort.message)}
            >
              <Input
                id={`${id}-iport`}
                type="number"
                min={1}
                max={65535}
                {...form.register("internalPort")}
              />
            </FormField>
            <FormField wide label={t("portForwarding.descriptionOptional")} htmlFor={`${id}-desc`}>
              <Input
                id={`${id}-desc`}
                {...form.register("description")}
                placeholder={t("portForwarding.internalPurposeOfThisRule")}
              />
            </FormField>
            <FormSwitchRow
              wide
              label={t("dhcp.enabled")}
              control={
                <Controller
                  control={form.control}
                  name="isEnabled"
                  render={({ field }) => (
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  )}
                />
              }
            />
          </FormSection>
        </form>
      </DialogContent>
    </Dialog>
  );
}
