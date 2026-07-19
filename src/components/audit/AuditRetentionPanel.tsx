import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { LoadingSkeleton } from "@/components/common/LoadingSkeleton";
import { ErrorState } from "@/components/common/ErrorState";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { useAuditRetention, useUpdateRetention } from "@/hooks/useAudit";
import { retentionSchema, type RetentionFormValues } from "@/lib/audit-schemas";

export function AuditRetentionPanel() {
  const q = useAuditRetention();
  const mut = useUpdateRetention();
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (q.isLoading) return <LoadingSkeleton rows={4} />;
  if (q.isError || !q.data) return <ErrorState onRetry={() => q.refetch()} />;

  const data = q.data;
  return (
    <RetentionForm
      key={JSON.stringify(data)}
      data={data}
      isPending={mut.isPending}
      onSave={(v) => mut.mutate(v, { onSuccess: () => toast.success("Retention settings updated") })}
      onPurge={() => setConfirmOpen(true)}
      confirmOpen={confirmOpen}
      onConfirmOpenChange={setConfirmOpen}
    />
  );
}

function RetentionForm({
  data, onSave, onPurge, isPending, confirmOpen, onConfirmOpenChange,
}: {
  data: RetentionFormValues;
  onSave: (v: RetentionFormValues) => void;
  onPurge: () => void;
  isPending: boolean;
  confirmOpen: boolean;
  onConfirmOpenChange: (o: boolean) => void;
}) {
  const form = useForm<RetentionFormValues>({ resolver: zodResolver(retentionSchema), defaultValues: data });
  const used = form.watch("storageUsedMb");
  const quota = form.watch("storageQuotaMb");
  const pct = Math.min(100, Math.round((used / Math.max(1, quota)) * 100));

  return (
    <div className="space-y-4">
      <Card className="border-border/60">
        <CardHeader><CardTitle className="text-base">Retention & storage</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <Label>Log retention period (days)</Label>
              <Input type="number" {...form.register("retentionDays")} />
              {form.formState.errors.retentionDays && <p className="text-xs text-destructive">{form.formState.errors.retentionDays.message}</p>}
            </div>
            <div className="space-y-1">
              <Label>Archive after (days)</Label>
              <Input type="number" {...form.register("archiveAfterDays")} />
              {form.formState.errors.archiveAfterDays && <p className="text-xs text-destructive">{form.formState.errors.archiveAfterDays.message}</p>}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="flex items-center justify-between rounded-lg border border-border/60 bg-card/40 p-3">
              <div>
                <div className="text-sm font-medium">Auto cleanup</div>
                <div className="text-xs text-muted-foreground">Automatically prune logs past retention period.</div>
              </div>
              <Switch checked={form.watch("autoCleanup")} onCheckedChange={(v) => form.setValue("autoCleanup", v)} />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border/60 bg-card/40 p-3">
              <div>
                <div className="text-sm font-medium">Archive logs</div>
                <div className="text-xs text-muted-foreground">Move old events to cold storage instead of deleting.</div>
              </div>
              <Switch checked={form.watch("archiveEnabled")} onCheckedChange={(v) => form.setValue("archiveEnabled", v)} />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Storage usage</span>
              <span className="font-medium">{used.toLocaleString()} MB / {quota.toLocaleString()} MB · {pct}%</span>
            </div>
            <Progress value={pct} />
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={onPurge}><Trash2 className="mr-2 h-4 w-4" /> Purge archived logs</Button>
            <Button onClick={form.handleSubmit(onSave)} disabled={isPending}><Save className="mr-2 h-4 w-4" /> Save</Button>
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={onConfirmOpenChange}
        title="Purge archived logs?"
        description="This action cannot be undone. Archived audit entries will be permanently removed."
        destructive
        confirmLabel="Purge"
        onConfirm={() => { onConfirmOpenChange(false); toast.success("Archived logs purged"); }}
      />
    </div>
  );
}
