import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Gauge, History, Plus, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/common/EmptyState";
import { LoadingSkeleton } from "@/components/common/LoadingSkeleton";
import { slaTargetSchema, type SlaTargetFormValues } from "@/lib/monitoring-schemas";
import {
  useCreateSlaTarget,
  useGenerateSlaReport,
  useOrgLocationLookup,
  useSlaReports,
  useSlaTargets,
} from "@/hooks/useMonitoring";
import { HEALTH_COMPONENT_LABEL, type HealthComponent } from "@/types/monitoring";
import type { AppError } from "@/services/api";

const DEFAULTS: SlaTargetFormValues = {
  organizationId: "",
  component: "",
  targetPercentage: 99.9,
  measurementWindowDays: 30,
};

const HEALTH_COMPONENT_OPTIONS: HealthComponent[] = [
  "database",
  "redis",
  "api",
  "auth",
  "storage",
  "celery",
  "websocket",
  "freeradius",
  "wireguard",
];

export function SlaPanel() {
  const { data, isLoading, refetch } = useSlaTargets();
  const [createOpen, setCreateOpen] = useState(false);
  const [historyFor, setHistoryFor] = useState<string | null>(null);
  const generate = useGenerateSlaReport();

  const rows = data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold tracking-tight">SLA targets</h3>
          <p className="text-sm text-muted-foreground">
            Achieved percentage is a real ratio computed from health-check history — not fabricated.
          </p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          <span className="ml-2">Add target</span>
        </Button>
      </div>

      {isLoading ? (
        <LoadingSkeleton rows={3} />
      ) : rows.length === 0 ? (
        <EmptyState icon={Gauge} title="No SLA targets" description="Add a target to start generating SLA reports." />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {rows.map(({ target, latestReport }) => (
            <Card key={target.id}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-sm font-medium">
                  <span>
                    {target.component
                      ? (HEALTH_COMPONENT_LABEL[target.component as HealthComponent] ?? target.component)
                      : "Platform-wide"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Target {target.targetPercentage}% / {target.measurementWindowDays}d
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {latestReport ? (
                  <>
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-semibold">
                        {latestReport.achievedPercentage.toFixed(2)}%
                      </span>
                      <span className="text-xs text-muted-foreground">achieved</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {latestReport.healthyChecks}/{latestReport.totalChecks} checks healthy · generated{" "}
                      {new Date(latestReport.generatedAt).toLocaleString()}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">No report yet.</p>
                )}
                <div className="flex gap-2 pt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={generate.isPending}
                    onClick={() =>
                      generate.mutate(
                        { targetId: target.id },
                        {
                          onSuccess: () => {
                            toast.success("SLA report generated");
                            refetch();
                          },
                          onError: (e) => toast.error((e as unknown as AppError).message),
                        },
                      )
                    }
                  >
                    <RefreshCcw className="mr-1.5 h-3.5 w-3.5" /> Generate report
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setHistoryFor(target.id)}>
                    <History className="mr-1.5 h-3.5 w-3.5" /> History
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CreateSlaTargetDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={() => refetch()} />
      {historyFor && <SlaReportHistoryDialog targetId={historyFor} onClose={() => setHistoryFor(null)} />}
    </div>
  );
}

function CreateSlaTargetDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated: () => void;
}) {
  const create = useCreateSlaTarget();
  const { organizations } = useOrgLocationLookup();
  const form = useForm<SlaTargetFormValues>({
    resolver: zodResolver(slaTargetSchema),
    defaultValues: DEFAULTS,
    mode: "onBlur",
  });

  async function submit(values: SlaTargetFormValues) {
    try {
      await create.mutateAsync({
        organizationId: values.organizationId || null,
        component: values.component || null,
        targetPercentage: values.targetPercentage,
        measurementWindowDays: values.measurementWindowDays,
      });
      toast.success("SLA target created");
      onOpenChange(false);
      form.reset(DEFAULTS);
      onCreated();
    } catch (err) {
      toast.error((err as AppError).message || "Failed to create target");
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) form.reset(DEFAULTS);
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add SLA target</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(submit)} className="space-y-4">
            <FormField
              control={form.control}
              name="component"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Component (optional — platform-wide if blank)</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Platform-wide" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {HEALTH_COMPONENT_OPTIONS.map((c) => (
                        <SelectItem key={c} value={c}>
                          {HEALTH_COMPONENT_LABEL[c]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="organizationId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Organization (optional)</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Platform-wide" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {organizations.map((o) => (
                        <SelectItem key={o.id} value={o.id}>
                          {o.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="targetPercentage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Target %</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="measurementWindowDays"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Window (days)</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={create.isPending}>
                Create target
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function SlaReportHistoryDialog({ targetId, onClose }: { targetId: string; onClose: () => void }) {
  const { data, isLoading } = useSlaReports({ targetId, page: 1, pageSize: 25 });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>SLA report history</DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <LoadingSkeleton rows={4} />
        ) : (
          <div className="max-h-96 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead>Achieved</TableHead>
                  <TableHead>Checks</TableHead>
                  <TableHead>Generated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.items ?? []).map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap text-xs">
                      {new Date(r.periodStart).toLocaleDateString()} –{" "}
                      {new Date(r.periodEnd).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-sm font-medium">{r.achievedPercentage.toFixed(2)}%</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {r.healthyChecks}/{r.totalChecks}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(r.generatedAt).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
                {(data?.items ?? []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                      No reports generated yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
