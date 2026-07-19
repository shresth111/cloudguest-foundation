import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Save, Send, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SectionCard, FieldGrid } from "../SectionCard";
import type { EmailSettings } from "@/types/settings";
import { useInvalidateSettings, useUpdateSection } from "@/hooks/useSettings";
import { settingsService } from "@/services/settings.service";
import { PasswordInput } from "../PasswordInput";

const PROVIDERS: { v: EmailSettings["provider"]; l: string }[] = [
  { v: "aws_ses", l: "AWS SES" }, { v: "smtp", l: "SMTP" },
  { v: "sendgrid", l: "SendGrid" }, { v: "mailgun", l: "Mailgun" },
];

export function EmailPanel({ data }: { data: EmailSettings }) {
  const mut = useUpdateSection<"email">();
  const [local, setLocal] = useState<EmailSettings>(data);
  const [testing, setTesting] = useState(false);
  const inv = useInvalidateSettings();
  const patch = (p: Partial<EmailSettings>) => setLocal((s) => ({ ...s, ...p }));
  const save = () => mut.mutate({ section: "email", value: local }, { onSuccess: () => toast.success("Email settings saved") });

  const test = async () => {
    setTesting(true);
    const r = await settingsService.testEmail();
    setTesting(false);
    inv();
    r.ok ? toast.success(r.message) : toast.error(r.message);
  };

  return (
    <SectionCard
      title="Email provider"
      description="Configure the outbound email gateway used across the platform."
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
          <Select value={local.provider} onValueChange={(v) => patch({ provider: v as EmailSettings["provider"] })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{PROVIDERS.map((p) => <SelectItem key={p.v} value={p.v}>{p.l}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <Field label="From address"><Input value={local.fromAddress} onChange={(e) => patch({ fromAddress: e.target.value })} /></Field>
        <Field label="SMTP host"><Input value={local.host} onChange={(e) => patch({ host: e.target.value })} /></Field>
        <Field label="Port"><Input type="number" value={local.port} onChange={(e) => patch({ port: Number(e.target.value) })} /></Field>
        <Field label="Username"><Input value={local.username} onChange={(e) => patch({ username: e.target.value })} /></Field>
        <Field label="Password">
          <PasswordInput value={local.password} onChange={(v) => patch({ password: v })} />
        </Field>
      </FieldGrid>
      {local.lastTestedAt && (
        <p className="text-xs text-muted-foreground">Last tested {new Date(local.lastTestedAt).toLocaleString()}</p>
      )}
    </SectionCard>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs font-medium text-muted-foreground">{label}</Label>{children}</div>;
}

export function StatusBadge({ status }: { status: "connected" | "disconnected" | "unknown" | "error" }) {
  if (status === "connected")
    return <Badge className="bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/20 dark:text-emerald-400"><CheckCircle2 className="mr-1 h-3 w-3" /> Connected</Badge>;
  if (status === "error" || status === "disconnected")
    return <Badge variant="destructive"><XCircle className="mr-1 h-3 w-3" /> {status === "error" ? "Error" : "Disconnected"}</Badge>;
  return <Badge variant="outline">Unknown</Badge>;
}
