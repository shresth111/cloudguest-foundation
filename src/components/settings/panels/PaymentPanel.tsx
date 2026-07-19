import { useState } from "react";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SectionCard, FieldGrid, ToggleRow } from "../SectionCard";
import { PasswordInput } from "../PasswordInput";
import type { PaymentSettings } from "@/types/settings";
import { useUpdateSection } from "@/hooks/useSettings";

export function PaymentPanel({ data }: { data: PaymentSettings }) {
  const mut = useUpdateSection<"payment">();
  const [local, setLocal] = useState<PaymentSettings>(data);
  const patch = (p: Partial<PaymentSettings>) => setLocal((s) => ({ ...s, ...p }));
  const save = () => mut.mutate({ section: "payment", value: local }, { onSuccess: () => toast.success("Payment settings saved") });

  return (
    <SectionCard
      title="Payments"
      description="Route billing charges through the selected gateway."
      actions={<Button size="sm" onClick={save} disabled={mut.isPending}><Save className="mr-2 h-4 w-4" /> Save</Button>}
    >
      <FieldGrid>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">Provider</Label>
          <Select value={local.provider} onValueChange={(v) => patch({ provider: v as PaymentSettings["provider"] })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="stripe">Stripe</SelectItem>
              <SelectItem value="razorpay">Razorpay</SelectItem>
              <SelectItem value="paypal">PayPal</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Field label="Currency"><Input maxLength={3} value={local.currency} onChange={(e) => patch({ currency: e.target.value.toUpperCase() })} /></Field>
        <Field label="Publishable key"><PasswordInput value={local.publishableKey} onChange={(v) => patch({ publishableKey: v })} /></Field>
        <Field label="Secret key"><PasswordInput value={local.secretKey} onChange={(v) => patch({ secretKey: v })} /></Field>
        <Field label="Webhook secret"><PasswordInput value={local.webhookSecret} onChange={(v) => patch({ webhookSecret: v })} /></Field>
        <Field label="Tax percentage">
          <Input type="number" step="0.1" min={0} max={100} value={local.taxPercent}
            onChange={(e) => patch({ taxPercent: Number(e.target.value) })} />
        </Field>
      </FieldGrid>
      <ToggleRow label="Auto invoice" description="Generate PDF invoices automatically after each charge.">
        <Switch checked={local.autoInvoice} onCheckedChange={(v) => patch({ autoInvoice: v })} />
      </ToggleRow>
    </SectionCard>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs font-medium text-muted-foreground">{label}</Label>{children}</div>;
}
