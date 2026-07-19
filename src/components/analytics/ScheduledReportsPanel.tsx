import { useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import {
  useCreateScheduledReport,
  useDeleteScheduledReport,
  useScheduledReports,
  useToggleScheduledReport,
} from "@/hooks/useAnalytics";
import type { ReportFormat, ReportType } from "@/types/analytics";

const schema = z.object({
  name: z.string().min(2, "Report name is required"),
  type: z.enum(["guest", "router", "network", "organization", "location", "revenue", "audit", "billing", "monitoring"]),
  frequency: z.enum(["daily", "weekly", "monthly"]),
  format: z.enum(["pdf", "excel", "csv"]),
  recipients: z.string().min(3, "Add at least one email"),
});

type FormValues = z.infer<typeof schema>;

export function ScheduledReportsPanel() {
  const { data, isLoading, isError, refetch } = useScheduledReports();
  const toggle = useToggleScheduledReport();
  const remove = useDeleteScheduledReport();
  const create = useCreateScheduledReport();
  const [open, setOpen] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", type: "guest", frequency: "weekly", format: "pdf", recipients: "" },
  });

  async function onCreate(v: FormValues) {
    try {
      await create.mutateAsync({
        name: v.name,
        type: v.type as ReportType,
        frequency: v.frequency,
        format: v.format as ReportFormat,
        enabled: true,
        recipients: v.recipients.split(",").map((s) => s.trim()).filter(Boolean),
      });
      toast.success("Scheduled report created");
      setOpen(false);
      form.reset();
    } catch {
      toast.error("Failed to create scheduled report");
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div>
          <CardTitle className="text-sm font-semibold">Scheduled reports</CardTitle>
          <p className="text-xs text-muted-foreground">Automate delivery to stakeholders on a schedule.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="mr-2 h-4 w-4" /> New schedule</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Schedule a report</DialogTitle>
            </DialogHeader>
            <form className="space-y-3" onSubmit={form.handleSubmit(onCreate)}>
              <div className="space-y-1.5">
                <Label>Report name</Label>
                <Input placeholder="Weekly guest summary" {...form.register("name")} />
                {form.formState.errors.name && <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Type</Label>
                  <Select value={form.watch("type")} onValueChange={(v) => form.setValue("type", v as FormValues["type"])}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(["guest", "router", "network", "organization", "location", "revenue", "audit", "billing", "monitoring"] as const).map((t) => (
                        <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Frequency</Label>
                  <Select value={form.watch("frequency")} onValueChange={(v) => form.setValue("frequency", v as FormValues["frequency"])}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Recipients</Label>
                <Input placeholder="ops@cloudguest.io, cfo@cloudguest.io" {...form.register("recipients")} />
                {form.formState.errors.recipients && <p className="text-xs text-destructive">{form.formState.errors.recipients.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Export format</Label>
                <Select value={form.watch("format")} onValueChange={(v) => form.setValue("format", v as ReportFormat)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pdf">PDF</SelectItem>
                    <SelectItem value="excel">Excel</SelectItem>
                    <SelectItem value="csv">CSV</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={create.isPending}>
                  {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
        ) : isError ? (
          <ErrorState onRetry={refetch} />
        ) : !data || data.length === 0 ? (
          <EmptyState title="No scheduled reports" description="Create a schedule to email reports automatically." />
        ) : (
          <div className="space-y-2">
            {data.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold">{r.name}</span>
                    <Badge variant="secondary" className="capitalize">{r.type}</Badge>
                    <Badge variant="outline" className="capitalize">{r.frequency}</Badge>
                    <Badge variant="outline" className="uppercase">{r.format}</Badge>
                  </div>
                  <div className="mt-1 truncate text-xs text-muted-foreground">
                    To {r.recipients.join(", ")} · Next run {new Date(r.nextRunAt).toLocaleString()}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Switch
                      checked={r.enabled}
                      onCheckedChange={(v) => toggle.mutate({ id: r.id, enabled: v })}
                    />
                    {r.enabled ? "Enabled" : "Paused"}
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => { remove.mutate(r.id); toast.success("Schedule removed"); }}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
