import { useState } from "react";
import { toast } from "sonner";
import { CalendarClock, Mail, Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/common/EmptyState";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import {
  useCreateScheduledBillingReport,
  useDeleteScheduledBillingReport,
  useScheduledBillingReports,
  useToggleScheduledBillingReport,
} from "@/hooks/useBilling";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { scheduledReportSchema, type ScheduledReportFormValues } from "@/lib/billing-schemas";
import type { BillingReportFormat, ReportFrequency, ScheduledBillingReport } from "@/types/billing";

const dateFmt = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

export function ScheduledBillingReportsPanel() {
  const list = useScheduledBillingReports();
  const toggle = useToggleScheduledBillingReport();
  const del = useDeleteScheduledBillingReport();
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<ScheduledBillingReport | null>(null);

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base">Scheduled reports</CardTitle>
            <p className="text-xs text-muted-foreground">Automate delivery of billing reports to stakeholders.</p>
          </div>
          <Button size="sm" onClick={() => setCreating(true)}><Plus className="mr-1.5 h-4 w-4" /> Schedule report</Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {list.isLoading ? (
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)
          ) : !list.data || list.data.length === 0 ? (
            <EmptyState title="No scheduled reports" description="Set up recurring email delivery of billing reports." action={{ label: "Schedule report", onClick: () => setCreating(true) }} />
          ) : (
            list.data.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><CalendarClock className="h-4 w-4" /></div>
                    <div>
                      <div className="text-sm font-medium">{r.name}</div>
                      <div className="text-xs text-muted-foreground capitalize">{r.frequency} · {r.format.toUpperCase()} · Next: {dateFmt.format(new Date(r.nextRunAt))}</div>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {r.recipients.map((e) => (
                      <Badge key={e} variant="outline" className="gap-1 font-normal"><Mail className="h-3 w-3" /> {e}</Badge>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2 rounded-lg border px-3 py-1.5">
                    <span className="text-xs text-muted-foreground">Enabled</span>
                    <Switch
                      checked={r.enabled}
                      onCheckedChange={(v) => toggle.mutate({ id: r.id, enabled: v }, { onSuccess: () => toast.success(v ? "Enabled" : "Disabled") })}
                    />
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setDeleting(r)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {creating && <ScheduleEditor open onOpenChange={setCreating} />}

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete "${deleting?.name}"?`}
        confirmLabel="Delete"
        destructive
        onConfirm={() => {
          if (!deleting) return;
          del.mutate(deleting.id, { onSuccess: () => toast.success("Scheduled report deleted") });
          setDeleting(null);
        }}
      />
    </>
  );
}

function ScheduleEditor({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const create = useCreateScheduledBillingReport();
  const form = useForm<ScheduledReportFormValues>({
    resolver: zodResolver(scheduledReportSchema),
    defaultValues: { name: "", frequency: "weekly", recipients: "", format: "pdf", enabled: true },
  });

  const onSubmit = (values: ScheduledReportFormValues) => {
    const recipients = values.recipients.split(/[,;\s]+/).filter(Boolean);
    create.mutate(
      { name: values.name, frequency: values.frequency, recipients, format: values.format, enabled: values.enabled },
      {
        onSuccess: () => {
          toast.success("Scheduled report created");
          onOpenChange(false);
          form.reset();
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Schedule billing report</DialogTitle></DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label>Report name</Label>
            <Input className="mt-1" placeholder="Weekly revenue digest" {...form.register("name")} />
            {form.formState.errors.name && <p className="mt-1 text-xs text-destructive">{form.formState.errors.name.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Frequency</Label>
              <Select value={form.watch("frequency")} onValueChange={(v) => form.setValue("frequency", v as ReportFrequency)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Format</Label>
              <Select value={form.watch("format")} onValueChange={(v) => form.setValue("format", v as BillingReportFormat)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pdf">PDF</SelectItem>
                  <SelectItem value="excel">Excel</SelectItem>
                  <SelectItem value="csv">CSV</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Recipients</Label>
            <Input className="mt-1" placeholder="finance@company.com, ops@company.com" {...form.register("recipients")} />
            {form.formState.errors.recipients && <p className="mt-1 text-xs text-destructive">{form.formState.errors.recipients.message}</p>}
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <Label>Enabled</Label>
            <Switch checked={form.watch("enabled")} onCheckedChange={(v) => form.setValue("enabled", v)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={create.isPending}>{create.isPending ? "Saving…" : "Schedule"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
