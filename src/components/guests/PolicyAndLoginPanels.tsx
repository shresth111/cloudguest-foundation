import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/common/ErrorState";
import { policySchema, type PolicyFormValues } from "@/lib/guest-schemas";
import {
  useLoginMethods,
  usePolicies,
  useToggleLoginMethod,
  useUpdatePolicy,
} from "@/hooks/useGuests";
import { LOGIN_METHOD_LABEL, type GuestType } from "@/types/guest";
import { useState } from "react";

const POLICY_FIELDS: Array<{ key: keyof PolicyFormValues; label: string; unit: string }> = [
  { key: "internetTimeLimitMin", label: "Internet Time Limit", unit: "minutes" },
  { key: "dailyLimitMb", label: "Daily Data Limit", unit: "MB" },
  { key: "speedLimitKbps", label: "Speed Limit", unit: "Kbps" },
  { key: "downloadLimitMb", label: "Download Limit", unit: "MB" },
  { key: "uploadLimitMb", label: "Upload Limit", unit: "MB" },
  { key: "deviceLimit", label: "Device Limit", unit: "devices" },
  { key: "sessionTimeoutMin", label: "Session Timeout", unit: "minutes" },
  { key: "idleTimeoutMin", label: "Idle Timeout", unit: "minutes" },
];

export function AccessPoliciesPanel() {
  const { data, isLoading, isError, refetch } = usePolicies();
  const update = useUpdatePolicy();
  const [selectedType, setSelectedType] = useState<GuestType | undefined>(undefined);

  const active = data?.find((p) => p.guestType === selectedType) ?? data?.[0];

  const form = useForm<PolicyFormValues>({
    resolver: zodResolver(policySchema),
    defaultValues: {
      internetTimeLimitMin: 60,
      dailyLimitMb: 1000,
      speedLimitKbps: 2048,
      downloadLimitMb: 1000,
      uploadLimitMb: 500,
      deviceLimit: 2,
      sessionTimeoutMin: 120,
      idleTimeoutMin: 15,
    },
  });

  useEffect(() => {
    if (active) {
      form.reset({
        internetTimeLimitMin: active.internetTimeLimitMin,
        dailyLimitMb: active.dailyLimitMb,
        speedLimitKbps: active.speedLimitKbps,
        downloadLimitMb: active.downloadLimitMb,
        uploadLimitMb: active.uploadLimitMb,
        deviceLimit: active.deviceLimit,
        sessionTimeoutMin: active.sessionTimeoutMin,
        idleTimeoutMin: active.idleTimeoutMin,
      });
    }
  }, [active, form]);

  if (isError) return <ErrorState onRetry={() => refetch()} />;
  if (isLoading || !data || !active) {
    return <Skeleton className="h-96 w-full rounded-2xl" />;
  }

  const onSubmit = form.handleSubmit(async (values) => {
    await update.mutateAsync({ id: active.id, patch: values });
    toast.success("Policy updated");
  });

  return (
    <Card className="rounded-2xl border-border/70 shadow-sm">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="text-base font-semibold">Access policies</CardTitle>
          <p className="text-sm text-muted-foreground">Configure limits applied per guest type.</p>
        </div>
        <Select value={active.guestType} onValueChange={(v) => setSelectedType(v as GuestType)}>
          <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {data.map((p) => (
              <SelectItem key={p.id} value={p.guestType}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {POLICY_FIELDS.map((f) => {
            const err = form.formState.errors[f.key]?.message;
            return (
              <div key={f.key} className="space-y-1.5">
                <Label className="text-xs">{f.label}</Label>
                <div className="relative">
                  <Input type="number" {...form.register(f.key)} className="pr-16" />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                    {f.unit}
                  </span>
                </div>
                {err && <p className="text-xs text-destructive">{String(err)}</p>}
              </div>
            );
          })}
          <div className="col-span-full flex justify-end">
            <Button type="submit" disabled={update.isPending}>
              <Save className="h-4 w-4" /><span className="ml-2">Save policy</span>
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export function LoginMethodsPanel() {
  const { data, isLoading, isError, refetch } = useLoginMethods();
  const toggle = useToggleLoginMethod();

  if (isError) return <ErrorState onRetry={() => refetch()} />;
  if (isLoading || !data) return <Skeleton className="h-72 w-full rounded-2xl" />;

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {data.map((cfg) => (
        <Card key={cfg.method} className="rounded-2xl border-border/70 p-4 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h4 className="text-sm font-semibold">{LOGIN_METHOD_LABEL[cfg.method]}</h4>
              <p className="mt-1 text-xs text-muted-foreground">{cfg.description}</p>
            </div>
            <Switch
              checked={cfg.enabled}
              onCheckedChange={(checked) =>
                toggle.mutate(
                  { method: cfg.method, enabled: checked },
                  {
                    onSuccess: () =>
                      toast.success(`${LOGIN_METHOD_LABEL[cfg.method]} ${checked ? "enabled" : "disabled"}`),
                  },
                )
              }
            />
          </div>
        </Card>
      ))}
    </div>
  );
}
