import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Download, HardDriveDownload, Save, Upload, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SectionCard, FieldGrid } from "../SectionCard";
import type { BackupSettings } from "@/types/settings";
import { useInvalidateSettings, useUpdateSection } from "@/hooks/useSettings";
import { settingsService } from "@/services/settings.service";

export function BackupPanel({ data }: { data: BackupSettings }) {
  const mut = useUpdateSection<"backup">();
  const inv = useInvalidateSettings();
  const [local, setLocal] = useState<BackupSettings>(data);
  const [running, setRunning] = useState(false);
  const save = () => mut.mutate({ section: "backup", value: local }, { onSuccess: () => toast.success("Backup schedule saved") });

  const backupNow = async () => {
    setRunning(true);
    await settingsService.backupNow();
    setRunning(false);
    inv();
    toast.success("Backup completed");
  };
  const download = (id: string) => toast.success(`Downloading ${id}`);
  const restore = async (id: string) => { await settingsService.restoreBackup(id); toast.success("Restore initiated"); };

  return (
    <div className="space-y-4">
      <SectionCard
        title="Backup schedule"
        description="Configure automatic snapshots of platform data."
        actions={
          <>
            <Button size="sm" variant="outline" onClick={backupNow} disabled={running}>
              <HardDriveDownload className="mr-2 h-4 w-4" /> {running ? "Running…" : "Backup now"}
            </Button>
            <Button size="sm" onClick={save} disabled={mut.isPending}><Save className="mr-2 h-4 w-4" /> Save</Button>
          </>
        }
      >
        <FieldGrid>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Frequency</Label>
            <Select value={local.schedule} onValueChange={(v) => setLocal((s) => ({ ...s, schedule: v as BackupSettings["schedule"] }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="hourly">Hourly</SelectItem>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Info label="Last backup" value={data.lastBackupAt ? new Date(data.lastBackupAt).toLocaleString() : "—"} />
          <Info label="Next backup" value={data.nextBackupAt ? new Date(data.nextBackupAt).toLocaleString() : "—"} />
        </FieldGrid>
      </SectionCard>

      <SectionCard title="History" description="Recent backup runs.">
        <div className="space-y-2">
          {data.history.length === 0 && <p className="text-sm text-muted-foreground">No backups yet.</p>}
          {data.history.map((h) => (
            <div key={h.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-border/60 bg-card/40 p-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 text-sm font-medium">
                  {new Date(h.createdAt).toLocaleString()}
                  <Badge variant="outline" className="text-[10px] uppercase">{h.type}</Badge>
                  {h.status === "success"
                    ? <span className="inline-flex items-center gap-1 text-xs text-emerald-500"><CheckCircle2 className="h-3 w-3" /> Success</span>
                    : <span className="inline-flex items-center gap-1 text-xs text-destructive"><XCircle className="h-3 w-3" /> Failed</span>}
                </div>
                <div className="text-xs text-muted-foreground">{h.sizeMb} MB • {h.id}</div>
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => download(h.id)}><Download className="mr-2 h-4 w-4" /> Download</Button>
                <Button size="sm" variant="ghost" onClick={() => restore(h.id)}><Upload className="mr-2 h-4 w-4" /> Restore</Button>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-card/40 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-medium">{value}</div>
    </div>
  );
}
