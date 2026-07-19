import { useState } from "react";
import { toast } from "sonner";
import { Plus, Save, Shield, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SectionCard, ToggleRow } from "../SectionCard";
import type { SecuritySettings } from "@/types/settings";
import { useUpdateSection } from "@/hooks/useSettings";

export function SecurityPanel({ data }: { data: SecuritySettings }) {
  const mut = useUpdateSection<"security">();
  const [local, setLocal] = useState<SecuritySettings>(data);
  const [wl, setWl] = useState("");
  const [bl, setBl] = useState("");

  const patch = (p: Partial<SecuritySettings>) => setLocal((s) => ({ ...s, ...p }));
  const save = () => mut.mutate({ section: "security", value: local }, { onSuccess: () => toast.success("Security updated") });

  return (
    <div className="space-y-4">
      <SectionCard
        title="Security posture"
        description="Baseline controls that harden the platform."
        actions={<Button size="sm" onClick={save} disabled={mut.isPending}><Save className="mr-2 h-4 w-4" /> Save</Button>}
      >
        <div className="grid gap-3 md:grid-cols-2">
          <ToggleRow label="Force HTTPS" description="Redirect all traffic to TLS."><Switch checked={local.forceHttps} onCheckedChange={(v) => patch({ forceHttps: v })} /></ToggleRow>
          <ToggleRow label="Two-factor auth" description="Require 2FA for admin sign-in."><Switch checked={local.twoFactor} onCheckedChange={(v) => patch({ twoFactor: v })} /></ToggleRow>
          <ToggleRow label="Device trust" description="Remember trusted devices for 30 days."><Switch checked={local.deviceTrust} onCheckedChange={(v) => patch({ deviceTrust: v })} /></ToggleRow>
          <ToggleRow label="CAPTCHA" description="Show CAPTCHA on repeated failures."><Switch checked={local.captcha} onCheckedChange={(v) => patch({ captcha: v })} /></ToggleRow>
          <ToggleRow label="Audit logging" description="Record admin & tenant actions."><Switch checked={local.auditLogging} onCheckedChange={(v) => patch({ auditLogging: v })} /></ToggleRow>
          <div className="rounded-lg border border-border/60 bg-card/40 p-3">
            <Label className="text-xs font-medium text-muted-foreground">Password complexity</Label>
            <Select value={local.passwordComplexity} onValueChange={(v) => patch({ passwordComplexity: v as SecuritySettings["passwordComplexity"] })}>
              <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low — 8 chars</SelectItem>
                <SelectItem value="medium">Medium — 10 chars, mixed case</SelectItem>
                <SelectItem value="high">High — 12 chars, symbols, digits</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </SectionCard>

      <div className="grid gap-4 md:grid-cols-2">
        <IpListCard
          title="IP whitelist"
          description="Requests from these IPs bypass CAPTCHA and rate limits."
          items={local.ipWhitelist}
          input={wl}
          setInput={setWl}
          onAdd={() => { if (!wl.trim()) return; patch({ ipWhitelist: [...local.ipWhitelist, wl.trim()] }); setWl(""); }}
          onRemove={(ip) => patch({ ipWhitelist: local.ipWhitelist.filter((x) => x !== ip) })}
          tone="success"
        />
        <IpListCard
          title="IP blacklist"
          description="Deny all traffic from these addresses."
          items={local.ipBlacklist}
          input={bl}
          setInput={setBl}
          onAdd={() => { if (!bl.trim()) return; patch({ ipBlacklist: [...local.ipBlacklist, bl.trim()] }); setBl(""); }}
          onRemove={(ip) => patch({ ipBlacklist: local.ipBlacklist.filter((x) => x !== ip) })}
          tone="destructive"
        />
      </div>
    </div>
  );
}

function IpListCard({
  title, description, items, input, setInput, onAdd, onRemove, tone,
}: {
  title: string; description: string; items: string[]; input: string;
  setInput: (v: string) => void; onAdd: () => void; onRemove: (ip: string) => void;
  tone: "success" | "destructive";
}) {
  return (
    <SectionCard title={title} description={description}>
      <div className="flex gap-2">
        <Input placeholder="e.g. 203.0.113.42 or 10.0.0.0/24" value={input} onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onAdd(); } }} />
        <Button size="sm" variant="outline" onClick={onAdd}><Plus className="h-4 w-4" /></Button>
      </div>
      <div className="flex flex-wrap gap-2">
        {items.length === 0 ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Shield className="h-3.5 w-3.5" /> No entries yet.</div>
        ) : items.map((ip) => (
          <Badge key={ip} variant={tone === "success" ? "secondary" : "destructive"} className="gap-1">
            {ip}
            <button className="ml-1 opacity-70 hover:opacity-100" onClick={() => onRemove(ip)} aria-label={`Remove ${ip}`}>
              <Trash2 className="h-3 w-3" />
            </button>
          </Badge>
        ))}
      </div>
    </SectionCard>
  );
}
