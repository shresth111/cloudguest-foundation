import { useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { CouponStatusBadge } from "./BillingBadges";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { couponSchema, type CouponFormValues } from "@/lib/billing-schemas";
import { useDeleteCoupon, useSaveCoupon } from "@/hooks/useBilling";
import type { Coupon, CouponStatus, DiscountType } from "@/types/billing";

const dateFmt = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

interface Props {
  data?: Coupon[];
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
}

export function CouponManagement({ data, isLoading, isError, onRetry }: Props) {
  const [editing, setEditing] = useState<Coupon | "new" | null>(null);
  const [deleting, setDeleting] = useState<Coupon | null>(null);
  const del = useDeleteCoupon();

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base">Coupons</CardTitle>
            <p className="text-xs text-muted-foreground">Discount codes for onboarding and retention.</p>
          </div>
          <Button size="sm" onClick={() => setEditing("new")}><Plus className="mr-1.5 h-4 w-4" /> New coupon</Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : isError ? (
            <ErrorState onRetry={onRetry} />
          ) : !data || data.length === 0 ? (
            <EmptyState title="No coupons" description="Create your first coupon to give discounts." action={{ label: "New coupon", onClick: () => setEditing("new") }} />
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Discount</TableHead>
                    <TableHead>Expiry</TableHead>
                    <TableHead>Usage</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-24" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-mono">{c.code}</TableCell>
                      <TableCell>{c.discountType === "percentage" ? `${c.discountValue}%` : `₹${c.discountValue}`}</TableCell>
                      <TableCell>{dateFmt.format(new Date(c.expiryDate))}</TableCell>
                      <TableCell className="min-w-[160px]">
                        <div className="flex items-center gap-2">
                          <Progress value={(c.used / c.maxUsage) * 100} className="h-1.5 w-24" />
                          <span className="text-xs text-muted-foreground">{c.used} / {c.maxUsage}</span>
                        </div>
                      </TableCell>
                      <TableCell><CouponStatusBadge status={c.status} /></TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditing(c)}><Pencil className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDeleting(c)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {editing && (
        <CouponEditor open onOpenChange={(o) => !o && setEditing(null)} coupon={editing === "new" ? undefined : editing} />
      )}

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete coupon "${deleting?.code}"?`}
        confirmLabel="Delete"
        destructive
        onConfirm={() => {
          if (!deleting) return;
          del.mutate(deleting.id, { onSuccess: () => toast.success("Coupon deleted") });
          setDeleting(null);
        }}
      />
    </>
  );
}

function CouponEditor({ open, onOpenChange, coupon }: { open: boolean; onOpenChange: (v: boolean) => void; coupon?: Coupon }) {
  const save = useSaveCoupon();
  const form = useForm<CouponFormValues>({
    resolver: zodResolver(couponSchema),
    defaultValues: coupon
      ? { code: coupon.code, discountType: coupon.discountType, discountValue: coupon.discountValue, expiryDate: coupon.expiryDate.slice(0, 10), maxUsage: coupon.maxUsage, status: coupon.status }
      : { code: "", discountType: "percentage", discountValue: 10, expiryDate: new Date().toISOString().slice(0, 10), maxUsage: 100, status: "active" },
  });

  const onSubmit = (values: CouponFormValues) => {
    save.mutate({ ...values, expiryDate: new Date(values.expiryDate).toISOString(), id: coupon?.id }, {
      onSuccess: () => {
        toast.success(coupon ? "Coupon updated" : "Coupon created");
        onOpenChange(false);
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{coupon ? "Edit coupon" : "New coupon"}</DialogTitle></DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Label>Coupon code</Label>
            <Input className="mt-1 uppercase" {...form.register("code")} />
            {form.formState.errors.code && <p className="mt-1 text-xs text-destructive">{form.formState.errors.code.message}</p>}
          </div>
          <div>
            <Label>Discount type</Label>
            <Select value={form.watch("discountType")} onValueChange={(v) => form.setValue("discountType", v as DiscountType)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="percentage">Percentage</SelectItem>
                <SelectItem value="fixed">Fixed amount</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Discount value</Label>
            <Input type="number" className="mt-1" {...form.register("discountValue", { valueAsNumber: true })} />
            {form.formState.errors.discountValue && <p className="mt-1 text-xs text-destructive">{form.formState.errors.discountValue.message}</p>}
          </div>
          <div>
            <Label>Expiry date</Label>
            <Input type="date" className="mt-1" {...form.register("expiryDate")} />
          </div>
          <div>
            <Label>Max usage</Label>
            <Input type="number" className="mt-1" {...form.register("maxUsage", { valueAsNumber: true })} />
          </div>
          <div className="col-span-2">
            <Label>Status</Label>
            <Select value={form.watch("status")} onValueChange={(v) => form.setValue("status", v as CouponStatus)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
                <SelectItem value="disabled">Disabled</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter className="col-span-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={save.isPending}>{save.isPending ? "Saving…" : "Save coupon"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
