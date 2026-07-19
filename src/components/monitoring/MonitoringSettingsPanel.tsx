import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/common/ErrorState";
import {
  useMonitoringSettings,
  useUpdateMonitoringSettings,
} from "@/hooks/useMonitoring";

const schema = z.object({
  cpuThreshold: z.coerce.number().min(1).max(100),
  memoryThreshold: z.coerce.number().min(1).max(100),
  packetLossThreshold: z.coerce.number().min(0).max(50),
  temperatureThreshold: z.coerce.number().min(20).max(120),
  autoRefreshSeconds: z.coerce.number().min(5).max(600),
  emailNotifications: z.boolean(),
  smsNotifications: z.boolean(),
  slackNotifications: z.boolean(),
  webhookUrl: z.string().url().optional().or(z.literal("")),
});
type FormValues = z.infer<typeof schema>;

export function MonitoringSettingsPanel() {
  const { data, isLoading, isError, refetch } = useMonitoringSettings();
  const update = useUpdateMonitoringSettings();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      cpuThreshold: 85,
      memoryThreshold: 90,
      packetLossThreshold: 3,
      temperatureThreshold: 70,
      autoRefreshSeconds: 30,
      emailNotifications: true,
      smsNotifications: false,
      slackNotifications: true,
      webhookUrl: "",
    },
  });

  useEffect(() => {
    if (data) form.reset({ ...data, webhookUrl: data.webhookUrl ?? "" });
  }, [data, form]);

  if (isLoading) return <Skeleton className="h-80 rounded-xl" />;
  if (isError || !data) return <ErrorState onRetry={refetch} />;

  const submit = form.handleSubmit((values) => {
    update.mutate(values, { onSuccess: () => toast.success("Monitoring settings saved") });
  });

  const w = form.watch();

  return (
    <form onSubmit={submit} className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle className="text-sm">Alert thresholds</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <Field label="CPU (%)" error={form.formState.errors.cpuThreshold?.message}>
            <Input type="number" {...form.register("cpuThreshold", { valueAsNumber: true })} />
          </Field>
          <Field label="Memory (%)" error={form.formState.errors.memoryThreshold?.message}>
            <Input type="number" {...form.register("memoryThreshold", { valueAsNumber: true })} />
          </Field>
          <Field label="Packet loss (%)" error={form.formState.errors.packetLossThreshold?.message}>
            <Input type="number" step="0.1" {...form.register("packetLossThreshold", { valueAsNumber: true })} />
          </Field>
          <Field label="Temperature (°C)" error={form.formState.errors.temperatureThreshold?.message}>
            <Input type="number" {...form.register("temperatureThreshold", { valueAsNumber: true })} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Notification preferences</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <ToggleRow label="Email notifications" checked={w.emailNotifications} onChange={(v) => form.setValue("emailNotifications", v)} />
          <ToggleRow label="SMS notifications" checked={w.smsNotifications} onChange={(v) => form.setValue("smsNotifications", v)} />
          <ToggleRow label="Slack notifications" checked={w.slackNotifications} onChange={(v) => form.setValue("slackNotifications", v)} />
          <Field label="Webhook URL" error={form.formState.errors.webhookUrl?.message}>
            <Input placeholder="https://hooks.example.com/…" {...form.register("webhookUrl")} />
          </Field>
          <Field label="Auto-refresh (seconds)" error={form.formState.errors.autoRefreshSeconds?.message}>
            <Input type="number" {...form.register("autoRefreshSeconds", { valueAsNumber: true })} />
          </Field>
        </CardContent>
      </Card>

      <div className="lg:col-span-2 flex justify-end">
        <Button type="submit" disabled={update.isPending}>
          <Save className="mr-2 h-4 w-4" /> Save settings
        </Button>
      </div>
    </form>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between rounded-md border p-2 text-sm">
      <span>{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
