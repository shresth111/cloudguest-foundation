import { useState } from "react";
import {
  BadgeCheck,
  Clock,
  Download,
  FileDown,
  Plus,
  ShieldOff,
  Ticket,
} from "lucide-react";
import { z } from "zod";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard, SectionHeader } from "@/components/ui-ext";
import {
  useApproveVoucherBatch,
  useCreateVoucherBatch,
  useRevokeVoucherBatch,
  useVoucherBatches,
  useVoucherKpis,
  useVoucherPlans,
} from "@/hooks/useVoucher";
import { organizationService } from "@/services/organization.service";
import { locationService } from "@/services/location.service";
import { voucherService } from "@/services/voucher.service";
import type { AppError } from "@/services/api";
import type { VoucherBatch, VoucherBatchStatus } from "@/types/voucher";

const STATUS_TONE: Record<VoucherBatchStatus, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "outline",
  pending_approval: "secondary",
  approved: "default",
  active: "default",
  expired: "outline",
  revoked: "destructive",
};

const batchSchema = z.object({
  organizationId: z.string().min(1, "Select an organization"),
  locationId: z.string().optional(),
  planId: z.string().optional(),
  name: z.string().trim().min(2, "Required").max(200),
  quantity: z.coerce.number().int().min(0).max(1000),
  codeLength: z.coerce.number().int().min(4).max(20),
  codePrefix: z.string().trim().max(20).optional().or(z.literal("")),
  validityMinutes: z.coerce.number().int().min(1),
  maxUsesPerVoucher: z.coerce.number().int().min(1),
  dataLimitMb: z.coerce.number().int().min(0).optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});
type BatchFormValues = z.infer<typeof batchSchema>;

async function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function VoucherManagement() {
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState<VoucherBatch | null>(null);

  const { data, isLoading } = useVoucherBatches(page);
  const { data: kpis } = useVoucherKpis();
  const approve = useApproveVoucherBatch();
  const revoke = useRevokeVoucherBatch();

  const { data: orgs = { rows: [] } } = useQuery({
    queryKey: ["voucher", "org-options"],
    queryFn: () => organizationService.list({ page: 1, pageSize: 100 }),
  });
  const orgName = (id: string) => orgs.rows.find((o) => o.id === id)?.name ?? id.slice(0, 8);

  const rows = data?.rows ?? [];

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Vouchers"
        title="Voucher Master"
        description="Central voucher inventory across every organization — generate, approve and revoke batches."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> New batch
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard label="Total batches" value={kpis?.totalBatches ?? 0} icon={Ticket} tone="primary" />
        <StatCard
          label="Pending approval"
          value={kpis?.pendingApproval ?? 0}
          icon={Clock}
          tone="warning"
        />
        <StatCard label="Active batches" value={kpis?.activeBatches ?? 0} icon={BadgeCheck} tone="success" />
        <StatCard label="Total vouchers" value={kpis?.totalVouchers ?? 0} icon={Ticket} tone="primary" />
      </div>

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-base font-semibold">All batches</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Batch</TableHead>
                <TableHead>Organization</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Validity</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[220px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                    Loading…
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                    No voucher batches yet.
                  </TableCell>
                </TableRow>
              )}
              {rows.map((b) => (
                <TableRow key={b.id}>
                  <TableCell>
                    <div className="font-medium">{b.name}</div>
                    {b.codePrefix && (
                      <div className="text-xs text-muted-foreground">Prefix: {b.codePrefix}</div>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{orgName(b.organizationId)}</TableCell>
                  <TableCell className="text-sm">{b.quantity}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {b.validityMinutes} min
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_TONE[b.status]}>{b.status.replace(/_/g, " ")}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1.5">
                      {b.status === "pending_approval" && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={approve.isPending}
                          onClick={async () => {
                            try {
                              await approve.mutateAsync({ id: b.id, organizationId: b.organizationId });
                              toast.success("Batch approved");
                            } catch (err) {
                              toast.error((err as AppError).message || "Failed to approve batch");
                            }
                          }}
                        >
                          Approve
                        </Button>
                      )}
                      {(b.status === "active" || b.status === "approved") && (
                        <Button size="sm" variant="ghost" onClick={() => setConfirmRevoke(b)}>
                          <ShieldOff className="mr-1 h-3.5 w-3.5" /> Revoke
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={async () => {
                          try {
                            const blob = await voucherService.exportCsv(b.id, b.organizationId);
                            await downloadBlob(blob, `${b.name}-vouchers.csv`);
                          } catch (err) {
                            toast.error((err as AppError).message || "Export failed");
                          }
                        }}
                      >
                        <FileDown className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={async () => {
                          try {
                            const blob = await voucherService.downloadPdf(b.id, b.organizationId);
                            await downloadBlob(blob, `${b.name}-vouchers.pdf`);
                          } catch (err) {
                            toast.error((err as AppError).message || "Download failed");
                          }
                        }}
                      >
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {data && data.totalPages > 1 && (
            <div className="flex items-center justify-between border-t p-3 text-xs text-muted-foreground">
              <span>Page {page} of {data.totalPages} · {data.total} batches</span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!data.hasPrevious}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!data.hasNext}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <BatchDialog open={creating} onClose={() => setCreating(false)} orgs={orgs.rows} />

      <AlertDialog open={!!confirmRevoke} onOpenChange={(o) => !o && setConfirmRevoke(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke batch "{confirmRevoke?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Every unredeemed voucher in this batch becomes permanently invalid. This cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!confirmRevoke) return;
                try {
                  await revoke.mutateAsync({
                    id: confirmRevoke.id,
                    organizationId: confirmRevoke.organizationId,
                  });
                  toast.success(`Batch ${confirmRevoke.name} revoked`);
                } catch (err) {
                  toast.error((err as AppError).message || "Failed to revoke batch");
                }
                setConfirmRevoke(null);
              }}
            >
              Revoke batch
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function BatchDialog({
  open,
  onClose,
  orgs,
}: {
  open: boolean;
  onClose: () => void;
  orgs: { id: string; name: string }[];
}) {
  const create = useCreateVoucherBatch();
  const form = useForm<BatchFormValues>({
    resolver: zodResolver(batchSchema),
    defaultValues: {
      organizationId: "",
      locationId: "",
      planId: "",
      name: "",
      quantity: 100,
      codeLength: 8,
      codePrefix: "",
      validityMinutes: 1440,
      maxUsesPerVoucher: 1,
      dataLimitMb: "",
      notes: "",
    },
  });

  const selectedOrgId = form.watch("organizationId");
  const { data: locations = { rows: [] } } = useQuery({
    queryKey: ["voucher", "location-options", selectedOrgId],
    queryFn: () =>
      locationService.list({ organizationId: selectedOrgId, page: 1, pageSize: 100 }),
    enabled: !!selectedOrgId,
  });
  const { data: plans = [] } = useVoucherPlans(selectedOrgId || undefined);

  async function submit(v: BatchFormValues) {
    try {
      await create.mutateAsync({
        organizationId: v.organizationId,
        locationId: v.locationId || null,
        planId: v.planId || null,
        name: v.name,
        quantity: v.quantity,
        codeLength: v.codeLength,
        codePrefix: v.codePrefix || null,
        validityMinutes: v.validityMinutes,
        maxUsesPerVoucher: v.maxUsesPerVoucher,
        dataLimitMb: v.dataLimitMb === "" ? null : Number(v.dataLimitMb),
        notes: v.notes || null,
      });
      toast.success("Voucher batch created");
      form.reset();
      onClose();
    } catch (err) {
      toast.error((err as AppError).message || "Failed to create batch");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New voucher batch</DialogTitle>
          <DialogDescription>
            Generates real, redeemable codes. A caller without approval rights lands the batch in
            "pending approval" instead of going live immediately.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(submit)} className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Organization</Label>
            <Controller
              control={form.control}
              name="organizationId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select organization" />
                  </SelectTrigger>
                  <SelectContent>
                    {orgs.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {form.formState.errors.organizationId && (
              <p className="text-[11px] text-destructive">
                {form.formState.errors.organizationId.message}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Location (optional)</Label>
            <Controller
              control={form.control}
              name="locationId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange} disabled={!selectedOrgId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Any location" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.rows.map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="sm:col-span-2 space-y-1.5">
            <Label className="text-xs font-medium">Batch name</Label>
            <Input {...form.register("name")} placeholder="Lobby Front Desk - July" />
            {form.formState.errors.name && (
              <p className="text-[11px] text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Plan (optional)</Label>
            <Controller
              control={form.control}
              name="planId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange} disabled={!selectedOrgId}>
                  <SelectTrigger>
                    <SelectValue placeholder="No speed entitlement" />
                  </SelectTrigger>
                  <SelectContent>
                    {plans.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Quantity</Label>
            <Input type="number" min={0} max={1000} {...form.register("quantity")} />
            {form.formState.errors.quantity && (
              <p className="text-[11px] text-destructive">{form.formState.errors.quantity.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Code length</Label>
            <Input type="number" min={4} max={20} {...form.register("codeLength")} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Code prefix (optional)</Label>
            <Input {...form.register("codePrefix")} placeholder="JULY-" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Validity (minutes)</Label>
            <Input type="number" min={1} {...form.register("validityMinutes")} />
            {form.formState.errors.validityMinutes && (
              <p className="text-[11px] text-destructive">
                {form.formState.errors.validityMinutes.message}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Max uses per voucher</Label>
            <Input type="number" min={1} {...form.register("maxUsesPerVoucher")} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Data cap (MB, optional)</Label>
            <Input type="number" min={0} {...form.register("dataLimitMb")} />
          </div>
          <div className="sm:col-span-2 space-y-1.5">
            <Label className="text-xs font-medium">Notes (optional)</Label>
            <Input {...form.register("notes")} placeholder="Front-desk printed batch…" />
          </div>
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending}>
              Generate batch
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
