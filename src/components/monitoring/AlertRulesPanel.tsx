import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus, ShieldAlert, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
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
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { EmptyState } from "@/components/common/EmptyState";
import { LoadingSkeleton } from "@/components/common/LoadingSkeleton";
import { SeverityBadge } from "./MonitoringBadges";
import {
  alertRuleSchema,
  conditionConfigFromAlertRuleForm,
  type AlertRuleFormValues,
} from "@/lib/monitoring-schemas";
import {
  useAlertRules,
  useCreateAlertRule,
  useDeleteAlertRule,
  useNotificationChannels,
  useOrgLocationLookup,
  useUpdateAlertRule,
} from "@/hooks/useMonitoring";
import {
  ALERT_TARGET_ROUTER,
  ALERT_TRIGGER_TYPE_LABEL,
  HEALTH_COMPONENT_LABEL,
  THRESHOLD_METRIC_LABEL,
  THRESHOLD_OPERATOR_LABEL,
  type AlertRule,
  type HealthComponent,
} from "@/types/monitoring";
import type { AppError } from "@/services/api";

const DEFAULTS: AlertRuleFormValues = {
  name: "",
  description: "",
  organizationId: "",
  triggerType: "health_status_change",
  targetComponent: "",
  severity: "warning",
  isActive: true,
  notificationChannelIds: [],
  expectedStatus: "unhealthy",
  eventType: "",
};

const HEALTH_COMPONENT_OPTIONS: HealthComponent[] = [
  "database",
  "redis",
  "api",
  "auth",
  "storage",
  "celery",
  "websocket",
  "freeradius",
  "wireguard",
];

export function AlertRulesPanel() {
  const [page, setPage] = useState(1);
  const { data, isLoading, refetch } = useAlertRules({ page, pageSize: 25 });
  const deleteRule = useDeleteAlertRule();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AlertRule | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<AlertRule | null>(null);
  const { orgName } = useOrgLocationLookup();

  const rows = data?.items ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold tracking-tight">Alert rules</h3>
          <p className="text-sm text-muted-foreground">
            Watches health status, per-router thresholds, or platform events. Evaluated on demand
            via "Evaluate alert rules now" on the Overview tab.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <Plus className="h-4 w-4" />
          <span className="ml-2">Add rule</span>
        </Button>
      </div>

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="p-4">
            <LoadingSkeleton rows={4} />
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={ShieldAlert}
            title="No alert rules"
            description="Add a rule to start generating alerts from real health/threshold/event conditions."
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Trigger</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Organization</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="font-medium">{r.name}</div>
                      {r.description && (
                        <div className="truncate text-xs text-muted-foreground">{r.description}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">{ALERT_TRIGGER_TYPE_LABEL[r.triggerType]}</TableCell>
                    <TableCell>
                      <SeverityBadge severity={r.severity} />
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {orgName(r.organizationId) ?? (r.organizationId ? r.organizationId.slice(0, 8) : "All")}
                    </TableCell>
                    <TableCell className="text-xs">{r.isActive ? "Active" : "Inactive"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEditing(r);
                            setFormOpen(true);
                          }}
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setConfirmDelete(r)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {data && data.totalPages > 1 && (
              <div className="flex items-center justify-between border-t p-3 text-xs text-muted-foreground">
                <span>
                  Page {data.page} of {data.totalPages}
                </span>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" disabled={!data.hasPrevious} onClick={() => setPage((p) => p - 1)}>
                    Previous
                  </Button>
                  <Button size="sm" variant="outline" disabled={!data.hasNext} onClick={() => setPage((p) => p + 1)}>
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </Card>

      <AlertRuleFormDialog
        open={formOpen}
        editing={editing}
        onOpenChange={setFormOpen}
        onSaved={() => refetch()}
      />

      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
        title="Delete alert rule?"
        description="This permanently removes the rule. Alerts it already triggered are unaffected."
        destructive
        onConfirm={async () => {
          if (!confirmDelete) return;
          try {
            await deleteRule.mutateAsync(confirmDelete.id);
            toast.success("Alert rule deleted");
          } catch (err) {
            toast.error((err as AppError).message || "Failed to delete");
          }
          setConfirmDelete(null);
        }}
      />
    </div>
  );
}

function AlertRuleFormDialog({
  open,
  editing,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  editing: AlertRule | null;
  onOpenChange: (o: boolean) => void;
  onSaved: () => void;
}) {
  const create = useCreateAlertRule();
  const update = useUpdateAlertRule();
  const { organizations } = useOrgLocationLookup();
  const { data: channelPage } = useNotificationChannels({ page: 1, pageSize: 100 });
  const channels = channelPage?.items ?? [];

  const conditionConfig = editing?.conditionConfig ?? {};
  const defaults: AlertRuleFormValues = editing
    ? {
        name: editing.name,
        description: editing.description ?? "",
        organizationId: editing.organizationId ?? "",
        triggerType: editing.triggerType,
        targetComponent: editing.targetComponent ?? "",
        severity: editing.severity,
        isActive: editing.isActive,
        notificationChannelIds: editing.notificationChannelIds,
        expectedStatus: (conditionConfig.expected_status as AlertRuleFormValues["expectedStatus"]) ?? "unhealthy",
        metric: conditionConfig.metric as AlertRuleFormValues["metric"],
        operator: conditionConfig.operator as AlertRuleFormValues["operator"],
        value: conditionConfig.value as number | undefined,
        eventType: (conditionConfig.event_type as string) ?? "",
      }
    : DEFAULTS;

  const form = useForm<AlertRuleFormValues>({
    resolver: zodResolver(alertRuleSchema),
    defaultValues: defaults,
    values: defaults,
    mode: "onBlur",
  });

  const triggerType = form.watch("triggerType");

  async function submit(values: AlertRuleFormValues) {
    const conditionConfig = conditionConfigFromAlertRuleForm(values);
    try {
      if (editing) {
        await update.mutateAsync({
          id: editing.id,
          payload: {
            name: values.name,
            description: values.description || null,
            triggerType: values.triggerType,
            targetComponent: values.targetComponent || null,
            conditionConfig,
            severity: values.severity,
            isActive: values.isActive,
            notificationChannelIds: values.notificationChannelIds,
          },
        });
        toast.success("Alert rule updated");
      } else {
        await create.mutateAsync({
          name: values.name,
          description: values.description || null,
          organizationId: values.organizationId || null,
          triggerType: values.triggerType,
          targetComponent: values.targetComponent || null,
          conditionConfig,
          severity: values.severity,
          isActive: values.isActive,
          notificationChannelIds: values.notificationChannelIds,
        });
        toast.success("Alert rule created");
      }
      onOpenChange(false);
      onSaved();
    } catch (err) {
      toast.error((err as AppError).message || "Failed to save rule");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit alert rule" : "Add alert rule"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(submit)} className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (optional)</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {!editing && (
              <FormField
                control={form.control}
                name="organizationId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Organization (optional — platform-wide if blank)</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Platform-wide" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {organizations.map((o) => (
                          <SelectItem key={o.id} value={o.id}>
                            {o.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            <FormField
              control={form.control}
              name="triggerType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Trigger type</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange} disabled={!!editing}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="health_status_change">Health status change</SelectItem>
                      <SelectItem value="threshold">Threshold</SelectItem>
                      <SelectItem value="event_occurred">Event occurred</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {triggerType === "health_status_change" && (
              <>
                <FormField
                  control={form.control}
                  name="targetComponent"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Watches</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select component" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={ALERT_TARGET_ROUTER}>Router health (any router in scope)</SelectItem>
                          {HEALTH_COMPONENT_OPTIONS.map((c) => (
                            <SelectItem key={c} value={c}>
                              {HEALTH_COMPONENT_LABEL[c]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="expectedStatus"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Alert when status equals</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="degraded">Degraded</SelectItem>
                          <SelectItem value="unhealthy">Unhealthy</SelectItem>
                          <SelectItem value="unknown">Unknown</SelectItem>
                          <SelectItem value="healthy">Healthy</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}

            {triggerType === "threshold" && (
              <div className="grid grid-cols-3 gap-3">
                <FormField
                  control={form.control}
                  name="metric"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Metric</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Metric" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {(Object.keys(THRESHOLD_METRIC_LABEL) as Array<keyof typeof THRESHOLD_METRIC_LABEL>).map(
                            (m) => (
                              <SelectItem key={m} value={m}>
                                {THRESHOLD_METRIC_LABEL[m]}
                              </SelectItem>
                            ),
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="operator"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Operator</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Op" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {(Object.keys(THRESHOLD_OPERATOR_LABEL) as Array<keyof typeof THRESHOLD_OPERATOR_LABEL>).map(
                            (op) => (
                              <SelectItem key={op} value={op}>
                                {THRESHOLD_OPERATOR_LABEL[op]}
                              </SelectItem>
                            ),
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="value"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Value</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} value={field.value ?? ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            {triggerType === "event_occurred" && (
              <FormField
                control={form.control}
                name="eventType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Event type</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. router.provisioning_failed" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="severity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Severity</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="critical">Critical</SelectItem>
                      <SelectItem value="warning">Warning</SelectItem>
                      <SelectItem value="info">Info</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <FormLabel className="!mt-0">Active</FormLabel>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            {channels.length > 0 && (
              <FormField
                control={form.control}
                name="notificationChannelIds"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notify via</FormLabel>
                    <div className="space-y-2 rounded-lg border p-3">
                      {channels.map((c) => {
                        const checked = field.value.includes(c.id);
                        return (
                          <label key={c.id} className="flex items-center gap-2 text-sm">
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(v) =>
                                field.onChange(
                                  v ? [...field.value, c.id] : field.value.filter((id) => id !== c.id),
                                )
                              }
                            />
                            {c.name}
                            <span className="text-xs text-muted-foreground">({c.channelType})</span>
                          </label>
                        );
                      })}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <DialogFooter>
              <Button type="submit" disabled={create.isPending || update.isPending}>
                {editing ? "Save changes" : "Create rule"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
