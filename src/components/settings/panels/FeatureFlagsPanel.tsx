import { useState } from "react";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { SectionCard, ToggleRow } from "../SectionCard";
import type { FeatureFlags } from "@/types/settings";
import { useUpdateSection } from "@/hooks/useSettings";

const FLAGS: { key: keyof FeatureFlags; label: string; description: string }[] = [
  { key: "whiteLabel", label: "White label", description: "Enable custom branding for tenants." },
  { key: "aiAssistant", label: "AI assistant", description: "Show the AI copilot across the app." },
  { key: "analytics", label: "Analytics", description: "Advanced dashboards and custom reports." },
  { key: "billing", label: "Billing", description: "Subscriptions, invoices and usage." },
  { key: "pms", label: "PMS", description: "Hotel property management sync." },
  { key: "qrLogin", label: "QR login", description: "Scan-to-connect access flow." },
  { key: "voucherLogin", label: "Voucher login", description: "Prepaid voucher authentication." },
  { key: "socialLogin", label: "Social login", description: "OAuth sign-in with social providers." },
  { key: "monitoring", label: "Monitoring", description: "Live health and alerting module." },
  { key: "auditLogs", label: "Audit logs", description: "Immutable admin activity trail." },
];

export function FeatureFlagsPanel({ data }: { data: FeatureFlags }) {
  const mut = useUpdateSection<"featureFlags">();
  const [local, setLocal] = useState<FeatureFlags>(data);
  const patch = (p: Partial<FeatureFlags>) => setLocal((s) => ({ ...s, ...p }));
  const save = () => mut.mutate({ section: "featureFlags", value: local }, { onSuccess: () => toast.success("Feature flags saved") });

  return (
    <SectionCard
      title="Feature flags"
      description="Enable or disable major modules across the platform."
      actions={<Button size="sm" onClick={save} disabled={mut.isPending}><Save className="mr-2 h-4 w-4" /> Save</Button>}
    >
      <div className="grid gap-3 md:grid-cols-2">
        {FLAGS.map((f) => (
          <ToggleRow key={f.key} label={f.label} description={f.description}>
            <Switch checked={local[f.key]} onCheckedChange={(v) => patch({ [f.key]: v } as Partial<FeatureFlags>)} />
          </ToggleRow>
        ))}
      </div>
    </SectionCard>
  );
}
