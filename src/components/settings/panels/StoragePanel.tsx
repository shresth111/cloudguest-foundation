import { useState } from "react";
import { toast } from "sonner";
import { Database, Save, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SectionCard, FieldGrid } from "../SectionCard";
import { PasswordInput } from "../PasswordInput";
import { StatusBadge } from "./EmailPanel";
import type { StorageSettings } from "@/types/settings";
import { useInvalidateSettings, useUpdateSection } from "@/hooks/useSettings";
import { settingsService } from "@/services/settings.service";

export function StoragePanel({ data }: { data: StorageSettings }) {
  const mut = useUpdateSection<"storage">();
  const inv = useInvalidateSettings();
  const [local, setLocal] = useState<StorageSettings>(data);
  const [testing, setTesting] = useState(false);
  const patch = (p: Partial<StorageSettings>) => setLocal((s) => ({ ...s, ...p }));
  const save = () => mut.mutate({ section: "storage", value: local }, { onSuccess: () => toast.success("Storage settings saved") });
  const test = async () => {
    setTesting(true);
    const r = await settingsService.testStorage();
    setTesting(false);
    inv();
    r.ok ? toast.success(r.message) : toast.error(r.message);
  };

  const usagePct = Math.min(100, Math.round((local.usageGb / Math.max(1, local.quotaGb)) * 100));

  return (
    <div className="space-y-4">
      <SectionCard
        title="Storage provider"
        description="Where uploads, exports and portal assets are stored."
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
            <Select value={local.provider} onValueChange={(v) => patch({ provider: v as StorageSettings["provider"] })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="aws_s3">AWS S3</SelectItem>
                <SelectItem value="local">Local storage</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Field label="Bucket name"><Input value={local.bucket} onChange={(e) => patch({ bucket: e.target.value })} /></Field>
          <Field label="Region"><Input value={local.region} onChange={(e) => patch({ region: e.target.value })} /></Field>
          <Field label="Access key"><PasswordInput value={local.accessKey} onChange={(v) => patch({ accessKey: v })} /></Field>
          <Field label="Secret key"><PasswordInput value={local.secretKey} onChange={(v) => patch({ secretKey: v })} /></Field>
        </FieldGrid>
      </SectionCard>

      <SectionCard title="Storage usage" description="Live consumption across the bucket.">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><Database className="h-5 w-5" /></div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">{local.usageGb.toFixed(1)} GB used</span>
              <span className="text-muted-foreground">{local.quotaGb} GB quota</span>
            </div>
            <Progress value={usagePct} className="mt-2 h-2" />
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs font-medium text-muted-foreground">{label}</Label>{children}</div>;
}
