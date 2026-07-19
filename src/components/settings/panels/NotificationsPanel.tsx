import { useState } from "react";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { SectionCard, ToggleRow, FieldGrid } from "../SectionCard";
import type { NotificationSettings } from "@/types/settings";
import { useUpdateSection } from "@/hooks/useSettings";

const CHANNELS: { key: keyof NotificationSettings; label: string; description: string }[] = [
  { key: "email", label: "Email notifications", description: "Digest and alert emails to platform admins." },
  { key: "sms", label: "SMS notifications", description: "Critical alerts pushed via SMS." },
  { key: "push", label: "Push notifications", description: "Mobile app push delivery." },
  { key: "browser", label: "Browser notifications", description: "In-browser toasts for signed-in admins." },
  { key: "slack", label: "Slack alerts", description: "Post alerts to a Slack channel." },
  { key: "webhooks", label: "Webhook events", description: "Emit JSON events to a webhook URL." },
];

export function NotificationsPanel({ data }: { data: NotificationSettings }) {
  const mut = useUpdateSection<"notifications">();
  const [local, setLocal] = useState<NotificationSettings>(data);
  const patch = (p: Partial<NotificationSettings>) => setLocal((s) => ({ ...s, ...p }));
  const save = () => mut.mutate({ section: "notifications", value: local }, { onSuccess: () => toast.success("Notifications updated") });

  return (
    <SectionCard
      title="Notifications"
      description="Choose channels and endpoints for platform alerts."
      actions={<Button size="sm" onClick={save} disabled={mut.isPending}><Save className="mr-2 h-4 w-4" /> Save</Button>}
    >
      <div className="grid gap-3 md:grid-cols-2">
        {CHANNELS.map((c) => (
          <ToggleRow key={c.key} label={c.label} description={c.description}>
            <Switch
              checked={local[c.key] as boolean}
              onCheckedChange={(v) => patch({ [c.key]: v } as Partial<NotificationSettings>)}
            />
          </ToggleRow>
        ))}
      </div>
      <FieldGrid>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">Slack webhook URL</Label>
          <Input value={local.slackWebhookUrl} onChange={(e) => patch({ slackWebhookUrl: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">Webhook endpoint</Label>
          <Input value={local.webhookEndpoint} onChange={(e) => patch({ webhookEndpoint: e.target.value })} />
        </div>
      </FieldGrid>
    </SectionCard>
  );
}
