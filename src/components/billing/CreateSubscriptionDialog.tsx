import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import axios from "axios";
import { CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { subscriptionSchema, type SubscriptionFormValues } from "@/lib/billing-schemas";
import { useCreateSubscription, useOrganizationsList } from "@/hooks/useBilling";
import { toAppError } from "@/services/api";
import type { Coupon, Plan } from "@/types/billing";
import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  plans?: Plan[];
  /** Real, currently-active coupons -- passed down from the same billing
   * snapshot the parent page already fetches (master.billing.tsx /
   * billing.index.tsx), so "Apply" validates against real data without a
   * duplicate request. */
  coupons?: Coupon[];
}

/** Only what `POST /subscriptions` actually accepts + what its own
 * "Apply" button needs to hold the validated coupon it found -- see
 * billing.service.ts's createSubscription() and lib/billing-schemas.ts's
 * subscriptionSchema for why every other field this dialog used to show
 * (billing cycle, locations, routers, max guests, trial days, discount,
 * tax, auto-renewal, notes) was removed: the backend derives all of it
 * from the selected Plan (or the coupon) and never reads it from this
 * request, so those fields did nothing but make the dialog bigger. */
type CouponState = { code: string; coupon: Coupon } | { code: string; error: string } | null;

export function CreateSubscriptionDialog({ open, onOpenChange, plans = [], coupons = [] }: Props) {
  const orgs = useOrganizationsList();
  const create = useCreateSubscription();
  const [couponInput, setCouponInput] = useState("");
  const [applied, setApplied] = useState<CouponState>(null);

  const form = useForm<SubscriptionFormValues>({
    resolver: zodResolver(subscriptionSchema),
    defaultValues: { organizationId: "", planId: plans[0]?.id ?? "" },
  });

  function reset() {
    form.reset({ organizationId: "", planId: plans[0]?.id ?? "" });
    setCouponInput("");
    setApplied(null);
  }

  function applyCoupon() {
    const code = couponInput.trim();
    if (!code) return;
    const match = coupons.find((c) => c.code.toUpperCase() === code.toUpperCase());
    if (!match) {
      setApplied({ code, error: "Coupon not found." });
      return;
    }
    if (match.status === "expired" || new Date(match.expiryDate) < new Date()) {
      setApplied({ code, error: "This coupon has expired." });
      return;
    }
    if (match.status === "disabled") {
      setApplied({ code, error: "This coupon is disabled." });
      return;
    }
    if (match.used >= match.maxUsage) {
      setApplied({ code, error: "This coupon has reached its usage limit." });
      return;
    }
    setApplied({ code: match.code, coupon: match });
    form.setValue("couponCode", match.code);
  }

  function clearCoupon() {
    setApplied(null);
    setCouponInput("");
    form.setValue("couponCode", undefined);
  }

  const onSubmit = (values: SubscriptionFormValues) => {
    create.mutate(values, {
      onSuccess: () => {
        toast.success("Subscription created");
        onOpenChange(false);
        reset();
      },
      onError: (err) => {
        const message = axios.isAxiosError(err)
          ? toAppError(err).message
          : "Failed to create subscription";
        toast.error(message);
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create subscription</DialogTitle>
          <DialogDescription>Provision billing for an organization.</DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label>Organization</Label>
            {orgs.isLoading ? (
              <Skeleton className="mt-1 h-9 w-full" />
            ) : (
              <Select value={form.watch("organizationId")} onValueChange={(v) => form.setValue("organizationId", v)}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select organization" /></SelectTrigger>
                <SelectContent>
                  {orgs.data?.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            {!orgs.isLoading && orgs.data?.length === 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                Every organization already has a subscription -- there is nothing left to provision.
              </p>
            )}
            {form.formState.errors.organizationId && (
              <p className="mt-1 text-xs text-destructive">{form.formState.errors.organizationId.message}</p>
            )}
          </div>

          <div>
            <Label>Plan</Label>
            <Select value={form.watch("planId")} onValueChange={(v) => form.setValue("planId", v)}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Select plan" /></SelectTrigger>
              <SelectContent>
                {plans.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
            {form.formState.errors.planId && (
              <p className="mt-1 text-xs text-destructive">{form.formState.errors.planId.message}</p>
            )}
          </div>

          <div>
            <Label>Coupon code (optional)</Label>
            <div className="mt-1 flex gap-2">
              <Input
                value={couponInput}
                onChange={(e) => { setCouponInput(e.target.value); if (applied) setApplied(null); }}
                placeholder="e.g. WELCOME10"
                className="font-mono uppercase"
                disabled={!!(applied && "coupon" in applied)}
              />
              {applied && "coupon" in applied ? (
                <Button type="button" variant="outline" onClick={clearCoupon}>Remove</Button>
              ) : (
                <Button type="button" variant="outline" onClick={applyCoupon} disabled={!couponInput.trim()}>Apply</Button>
              )}
            </div>
            {applied && "coupon" in applied && (
              <p className="mt-1.5 flex items-center gap-1.5 text-xs text-emerald-600">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Applied -- {applied.coupon.discountType === "percentage" ? `${applied.coupon.discountValue}% off` : `${applied.coupon.discountValue} off`}
              </p>
            )}
            {applied && "error" in applied && (
              <p className="mt-1.5 flex items-center gap-1.5 text-xs text-destructive">
                <XCircle className="h-3.5 w-3.5" />
                {applied.error}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={create.isPending}>{create.isPending ? "Creating…" : "Create subscription"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
