import { useState } from "react";
import { toast } from "sonner";
import { RotateCcw, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { SectionCard, FieldGrid, ToggleRow } from "../SectionCard";
import type { SystemSettings } from "@/types/settings";
import { useInvalidateSettings, useUpdateSection } from "@/hooks/useSettings";
import { settingsService } from "@/services/settings.service";

export function SystemPanel({ data }: { data: SystemSettings }) {
  const mut = useUpdateSection<"system">();
  const inv = useInvalidateSettings();
  const [local, setLocal] = useState<SystemSettings>(data);
  const patch = (p: Partial<SystemSettings>) => setLocal((s) => ({ ...s, ...p }));
  const save = () => mut.mutate({ section: "system", value: local }, { onSuccess: () => toast.success("System updated") });

  const clearCache = async () => { await settingsService.clearCache(); inv(); toast.success("Cache cleared"); };
  const restart = async () => { await settingsService.restartServices(); toast.success("Services restarted"); };

  return (
    <SectionCard
      title="System"
      description="Runtime toggles and maintenance controls."
      actions={<Button size="sm" onClick={save} disabled={mut.isPending}><Save className="mr-2 h-4 w-4" /> Save</Button>}
    >
      <div className="grid gap-3 md:grid-cols-2">
        <ToggleRow label="Maintenance mode" description="Serve a maintenance page to all tenants.">
          <Switch checked={local.maintenanceMode} onCheckedChange={(v) => patch({ maintenanceMode: v })} />
        </ToggleRow>
        <ToggleRow label="Debug mode" description="Expose stack traces to admins (never in production).">
          <Switch checked={local.debugMode} onCheckedChange={(v) => patch({ debugMode: v })} />
        </ToggleRow>
        <ToggleRow label="Auto refresh" description="Refresh live dashboards every 30 seconds.">
          <Switch checked={local.autoRefresh} onCheckedChange={(v) => patch({ autoRefresh: v })} />
        </ToggleRow>
      </div>

      <FieldGrid>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">Log retention (days)</Label>
          <Input type="number" value={local.logRetentionDays} onChange={(e) => patch({ logRetentionDays: Number(e.target.value) })} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">NTP server</Label>
          <Input value={local.ntpServer} onChange={(e) => patch({ ntpServer: e.target.value })} />
        </div>
      </FieldGrid>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/60 bg-card/40 p-3">
        <div>
          <div className="text-sm font-medium">Maintenance actions</div>
          <div className="text-xs text-muted-foreground">
            {local.lastCacheClearAt ? `Cache last cleared ${new Date(local.lastCacheClearAt).toLocaleString()}` : "No cache clears recorded."}
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={clearCache}><Trash2 className="mr-2 h-4 w-4" /> Clear cache</Button>
          <Button size="sm" variant="outline" onClick={restart}><RotateCcw className="mr-2 h-4 w-4" /> Restart services</Button>
        </div>
      </div>
    </SectionCard>
  );
}
