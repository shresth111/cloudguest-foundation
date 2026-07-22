import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Link2, Plus, Siren } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { SeverityBadge, IncidentStatusBadge, AlertStatusBadge } from "./MonitoringBadges";
import {
  incidentSchema,
  incidentUpdateSchema,
  type IncidentFormValues,
  type IncidentUpdateFormValues,
} from "@/lib/monitoring-schemas";
import {
  useAlerts,
  useAttachAlertToIncident,
  useCreateIncident,
  useIncidentAlerts,
  useIncidents,
  useOrgLocationLookup,
  useUpdateIncident,
} from "@/hooks/useMonitoring";
import { INCIDENT_STATUS_TRANSITIONS, type Incident, type IncidentStatus } from "@/types/monitoring";
import type { AppError } from "@/services/api";

const CREATE_DEFAULTS: IncidentFormValues = {
  title: "",
  description: "",
  severity: "warning",
  organizationId: "",
  assignedToUserId: "",
};

export function IncidentManagement() {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, refetch } = useIncidents({ page, pageSize: 25 });
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<Incident | null>(null);

  if (isLoading) {
    return (
      <div className="grid gap-3 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-40 rounded-xl" />
        ))}
      </div>
    );
  }
  if (isError || !data) return <ErrorState onRetry={refetch} />;

  const incidents = data.items;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold tracking-tight">Incidents</h3>
          <p className="text-sm text-muted-foreground">
            Manually opened and correlated — the backend does not auto-create incidents from alerts.
          </p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          <span className="ml-2">Open incident</span>
        </Button>
      </div>

      {incidents.length === 0 ? (
        <EmptyState icon={Siren} title="No incidents" description="Nothing open right now." />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {incidents.map((i) => (
            <Card key={i.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setSelected(i)}>
              <CardHeader className="pb-2">
                <CardTitle className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="flex-1">{i.title}</span>
                  <SeverityBadge severity={i.severity} />
                  <IncidentStatusBadge status={i.status} />
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {i.description && <p className="text-sm text-muted-foreground">{i.description}</p>}
                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <div>
                    <span className="font-medium text-foreground">Opened:</span>{" "}
                    {new Date(i.openedAt).toLocaleString()}
                  </div>
                  <div>
                    <span className="font-medium text-foreground">Assigned:</span>{" "}
                    {i.assignedToUserId ? i.assignedToUserId.slice(0, 8) : "Unassigned"}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {data.totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
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

      <CreateIncidentDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={() => refetch()} />
      {selected && (
        <IncidentDetailDialog incident={selected} onClose={() => setSelected(null)} onChanged={() => refetch()} />
      )}
    </div>
  );
}

function CreateIncidentDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated: () => void;
}) {
  const create = useCreateIncident();
  const { organizations } = useOrgLocationLookup();
  const form = useForm<IncidentFormValues>({
    resolver: zodResolver(incidentSchema),
    defaultValues: CREATE_DEFAULTS,
    mode: "onBlur",
  });

  async function submit(values: IncidentFormValues) {
    try {
      await create.mutateAsync({
        title: values.title,
        description: values.description || null,
        severity: values.severity,
        organizationId: values.organizationId || null,
        assignedToUserId: values.assignedToUserId || null,
      });
      toast.success("Incident opened");
      onOpenChange(false);
      form.reset(CREATE_DEFAULTS);
      onCreated();
    } catch (err) {
      toast.error((err as AppError).message || "Failed to open incident");
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) form.reset(CREATE_DEFAULTS);
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Open incident</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(submit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
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
                    <Textarea rows={3} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
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
              name="organizationId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Organization (optional)</FormLabel>
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
            <FormField
              control={form.control}
              name="assignedToUserId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Assigned to (user ID, optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="UUID" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={create.isPending}>
                Open incident
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function IncidentDetailDialog({
  incident,
  onClose,
  onChanged,
}: {
  incident: Incident;
  onClose: () => void;
  onChanged: () => void;
}) {
  const update = useUpdateIncident();
  const attach = useAttachAlertToIncident();
  const { data: attachedAlerts } = useIncidentAlerts(incident.id);
  const { data: alertPage } = useAlerts({ page: 1, pageSize: 50 });
  const [attachAlertId, setAttachAlertId] = useState("");

  const form = useForm<IncidentUpdateFormValues>({
    resolver: zodResolver(incidentUpdateSchema),
    defaultValues: {
      title: incident.title,
      description: incident.description ?? "",
      status: incident.status,
      assignedToUserId: incident.assignedToUserId ?? "",
      resolutionNotes: incident.resolutionNotes ?? "",
    },
  });

  const allowedStatuses: IncidentStatus[] = [
    incident.status,
    ...INCIDENT_STATUS_TRANSITIONS[incident.status],
  ];
  const attachableAlerts = (alertPage?.items ?? []).filter(
    (a) => !(attachedAlerts ?? []).some((x) => x.id === a.id),
  );

  async function submit(values: IncidentUpdateFormValues) {
    try {
      await update.mutateAsync({
        id: incident.id,
        payload: {
          title: values.title,
          description: values.description || null,
          status: values.status,
          assignedToUserId: values.assignedToUserId || null,
          resolutionNotes: values.resolutionNotes || null,
        },
      });
      toast.success("Incident updated");
      onChanged();
      onClose();
    } catch (err) {
      toast.error((err as AppError).message || "Failed to update incident");
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{incident.title}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(submit)} className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
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
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea rows={3} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {allowedStatuses.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
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
              name="assignedToUserId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Assigned to (user ID)</FormLabel>
                  <FormControl>
                    <Input placeholder="UUID" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="resolutionNotes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Resolution notes</FormLabel>
                  <FormControl>
                    <Textarea rows={2} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-2 rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Attached alerts ({attachedAlerts?.length ?? 0})</span>
              </div>
              {(attachedAlerts ?? []).map((a) => (
                <div key={a.id} className="flex items-center justify-between text-xs">
                  <span className="truncate">{a.message}</span>
                  <AlertStatusBadge status={a.status} />
                </div>
              ))}
              <div className="flex gap-2 pt-1">
                <Select value={attachAlertId} onValueChange={setAttachAlertId}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Select an alert to attach" />
                  </SelectTrigger>
                  <SelectContent>
                    {attachableAlerts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.message.slice(0, 60)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={!attachAlertId || attach.isPending}
                  onClick={() =>
                    attach.mutate(
                      { incidentId: incident.id, alertId: attachAlertId },
                      {
                        onSuccess: () => {
                          toast.success("Alert attached");
                          setAttachAlertId("");
                        },
                        onError: (e) => toast.error((e as unknown as AppError).message),
                      },
                    )
                  }
                >
                  <Link2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Close
              </Button>
              <Button type="submit" disabled={update.isPending}>
                Save changes
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
