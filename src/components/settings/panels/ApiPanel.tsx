import { useState } from "react";
import { toast } from "sonner";
import { Copy, KeyRound, Plus, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { SectionCard, FieldGrid } from "../SectionCard";
import type { ApiSettings } from "@/types/settings";
import { useInvalidateSettings, useUpdateSection } from "@/hooks/useSettings";
import { settingsService } from "@/services/settings.service";

export function ApiPanel({ data }: { data: ApiSettings }) {
  const mut = useUpdateSection<"api">();
  const inv = useInvalidateSettings();
  const [local, setLocal] = useState<ApiSettings>(data);
  const [name, setName] = useState("");
  const patch = (p: Partial<ApiSettings>) => setLocal((s) => ({ ...s, ...p }));
  const save = () => mut.mutate({ section: "api", value: local }, { onSuccess: () => toast.success("API settings saved") });

  const create = async () => {
    if (!name.trim()) return toast.error("Give the key a name");
    await settingsService.createApiKey(name.trim());
    setName("");
    inv();
    toast.success("New API key generated");
  };
  const revoke = async (id: string) => {
    await settingsService.revokeApiKey(id);
    inv();
    toast.success("API key revoked");
  };
  const copy = (val: string) => {
    void navigator.clipboard.writeText(val);
    toast.success("Copied to clipboard");
  };

  return (
    <div className="space-y-4">
      <SectionCard
        title="API keys"
        description="Rotate and revoke server-to-server credentials."
      >
        <div className="flex gap-2">
          <Input placeholder="Key name (e.g. Analytics ETL)" value={name} onChange={(e) => setName(e.target.value)} />
          <Button size="sm" onClick={create}><Plus className="mr-2 h-4 w-4" /> Generate</Button>
        </div>
        <div className="space-y-2">
          {data.keys.length === 0 && <p className="text-sm text-muted-foreground">No API keys yet.</p>}
          {data.keys.map((k) => (
            <div key={k.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-border/60 bg-card/40 p-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary"><KeyRound className="h-4 w-4" /></div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{k.name}</span>
                  {k.scopes.map((s) => <Badge key={s} variant="secondary" className="text-[10px] uppercase">{s}</Badge>)}
                </div>
                <code className="mt-1 block truncate font-mono text-xs text-muted-foreground">{k.key}</code>
                <div className="mt-0.5 text-[11px] text-muted-foreground">
                  Created {new Date(k.createdAt).toLocaleDateString()}
                  {k.lastUsedAt && ` • Last used ${new Date(k.lastUsedAt).toLocaleDateString()}`}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button size="icon" variant="ghost" onClick={() => copy(k.key)}><Copy className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => revoke(k.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title="Endpoint & limits"
        description="Public webhook endpoint and platform-wide rate limit."
        actions={<Button size="sm" onClick={save} disabled={mut.isPending}><Save className="mr-2 h-4 w-4" /> Save</Button>}
      >
        <FieldGrid>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Webhook URL</Label>
            <Input value={local.webhookUrl} onChange={(e) => patch({ webhookUrl: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Rate limit (req/min)</Label>
            <Input type="number" value={local.rateLimitPerMinute} onChange={(e) => patch({ rateLimitPerMinute: Number(e.target.value) })} />
          </div>
        </FieldGrid>
      </SectionCard>

      <SectionCard title="Usage" description="Live API traffic in the last 24h and month-to-date.">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Stat label="Calls today" value={data.callsToday.toLocaleString()} />
          <Stat label="Calls this month" value={data.callsMonth.toLocaleString()} />
          <Stat label="Errors today" value={data.errorsToday.toLocaleString()} tone={data.errorsToday > 100 ? "warn" : "ok"} />
        </div>
      </SectionCard>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "ok" | "warn" }) {
  return (
    <div className="rounded-lg border border-border/60 bg-card/40 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 text-lg font-semibold ${tone === "warn" ? "text-amber-500" : ""}`}>{value}</div>
    </div>
  );
}
