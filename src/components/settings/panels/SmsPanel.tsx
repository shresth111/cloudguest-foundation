import { useState } from "react";
import { toast } from "sonner";
import { Save, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SectionCard, FieldGrid } from "../SectionCard";
import { PasswordInput } from "../PasswordInput";
import { StatusBadge } from "./EmailPanel";
import type { SmsSettings } from "@/types/settings";
import { useInvalidateSettings, useUpdateSection } from "@/hooks/useSettings";
import { settingsService } from "@/services/settings.service";

const PROVIDERS: { v: SmsSettings["provider"]; l: string }[] = [
  { v: "msg91", l: "MSG91" }, { v: "twilio", l: "Twilio" }, { v: "aws_sns", l: "AWS SNS" },
];

export function SmsPanel({ data }: { data: SmsSettings }) {
  const mut = useUpdateSection<"sms">();
  const [local, setLocal] = useState<SmsSettings>(data);
  const [testing, setTesting] = useState(false);
  const inv = useInvalidateSettings();
  const patch = (p: Partial<SmsSettings>) => setLocal((s) => ({ ...s, ...p }));
  const save = () => mut.mutate({ section: "sms", value: local }, { onSuccess: () => toast.success("SMS settings saved") });
  const test = async () => {
    setTesting(true);
    const r = await settingsService.testSms();
    setTesting(false);
    inv();
    r.ok ? toast.success(r.message) : toast.error(r.message);
  };

  return (
    <SectionCard
      title="SMS provider"
      description="Configure the outbound SMS gateway for OTPs and alerts."
      actions={
        <>
          <StatusBadge status={local.connectionStatus} />
          <Button size="sm" variant="outline" onClick={test} disabled={testing}><Send className="mr-2 h-4 w-4" /> Test</Button>
          <Button size="sm" onClick={save} disabled={mut.isPending}><Save className="mr-2 h-4 w-4" /> Save</Button>
        </>
      }
    >
      <FieldGrid>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">Provider</Label>
          <Select value={local.provider} onValueChange={(v) => patch({ provider: v as SmsSettings["provider"] })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{PROVIDERS.map((p) => <SelectItem key={p.v} value={p.v}>{p.l}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <Field label="Sender ID"><Input value={local.senderId} onChange={(e) => patch({ senderId: e.target.value })} /></Field>
        <Field label="Template ID"><Input value={local.templateId} onChange={(e) => patch({ templateId: e.target.value })} /></Field>
        <Field label="API key"><PasswordInput value={local.apiKey} onChange={(v) => patch({ apiKey: v })} /></Field>
      </FieldGrid>
      {local.lastTestedAt && <p className="text-xs text-muted-foreground">Last tested {new Date(local.lastTestedAt).toLocaleString()}</p>}
    </SectionCard>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs font-medium text-muted-foreground">{label}</Label>{children}</div>;
}
