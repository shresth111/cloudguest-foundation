import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useRbacPasswordPolicy } from "@/hooks/useRbac";
import { rbacService } from "@/services/rbac.service";
import { passwordPolicySchema, type PasswordPolicyValues } from "@/lib/rbac-schemas";
import { Skeleton } from "@/components/ui/skeleton";

export function PasswordPolicyPanel() {
  const { data, isLoading, refetch } = useRbacPasswordPolicy();
  const form = useForm<PasswordPolicyValues>({
    resolver: zodResolver(passwordPolicySchema),
    defaultValues: { minLength: 12, requireUppercase: true, requireNumber: true, requireSymbol: true, expiryDays: 90, historyCount: 5, lockoutAttempts: 5, lockoutMinutes: 30 },
  });

  useEffect(() => { if (data) form.reset(data); }, [data, form]);

  const onSubmit = async (v: PasswordPolicyValues) => {
    try { await rbacService.savePasswordPolicy(v); toast.success("Password policy updated"); refetch(); }
    catch { toast.error("Could not save policy"); }
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div>
          <h3 className="font-semibold">Password policy</h3>
          <p className="text-xs text-muted-foreground">Rules applied to every user across the platform.</p>
        </div>
        {isLoading ? <Skeleton className="h-64" /> : (
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-2">
            <NumField label="Minimum length" min={6} max={64} value={form.watch("minLength")} onChange={(v) => form.setValue("minLength", v)} />
            <NumField label="Password expiry (days)" min={0} max={720} value={form.watch("expiryDays")} onChange={(v) => form.setValue("expiryDays", v)} />
            <NumField label="Password history" min={0} max={24} value={form.watch("historyCount")} onChange={(v) => form.setValue("historyCount", v)} />
            <NumField label="Lockout attempts" min={1} max={20} value={form.watch("lockoutAttempts")} onChange={(v) => form.setValue("lockoutAttempts", v)} />
            <NumField label="Lockout duration (min)" min={1} max={1440} value={form.watch("lockoutMinutes")} onChange={(v) => form.setValue("lockoutMinutes", v)} />
            <div className="space-y-2 rounded-lg border p-3 sm:col-span-1">
              <p className="text-sm font-medium">Complexity</p>
              <SwitchRow label="Require uppercase" checked={form.watch("requireUppercase")} onChange={(v) => form.setValue("requireUppercase", v)} />
              <SwitchRow label="Require number" checked={form.watch("requireNumber")} onChange={(v) => form.setValue("requireNumber", v)} />
              <SwitchRow label="Require symbol" checked={form.watch("requireSymbol")} onChange={(v) => form.setValue("requireSymbol", v)} />
            </div>
            <div className="sm:col-span-2 flex justify-end">
              <Button type="submit">Save policy</Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

function NumField({ label, min, max, value, onChange }: { label: string; min: number; max: number; value: number; onChange: (v: number) => void }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input type="number" min={min} max={max} value={value} onChange={(e) => onChange(parseInt(e.target.value || "0", 10))} />
    </div>
  );
}
function SwitchRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span>{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
