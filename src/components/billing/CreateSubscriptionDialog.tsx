import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { subscriptionSchema, type SubscriptionFormValues } from "@/lib/billing-schemas";
import { useCreateSubscription, useOrganizationsList } from "@/hooks/useBilling";
import type { Plan } from "@/types/billing";
import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  plans?: Plan[];
}

export function CreateSubscriptionDialog({ open, onOpenChange, plans = [] }: Props) {
  const orgs = useOrganizationsList();
  const create = useCreateSubscription();
  const [cycle, setCycle] = useState<"monthly" | "annual">("monthly");

  const form = useForm<SubscriptionFormValues>({
    resolver: zodResolver(subscriptionSchema),
    defaultValues: {
      organizationId: "",
      planId: plans[0]?.id ?? "",
      billingCycle: "monthly",
      locations: 1,
      routers: 1,
      maxGuests: 100,
      trialDays: 0,
      discount: 0,
      tax: 18,
      autoRenewal: true,
      notes: "",
    },
  });

  const onSubmit = (values: SubscriptionFormValues) => {
    create.mutate(values, {
      onSuccess: () => {
        toast.success("Subscription created");
        onOpenChange(false);
        form.reset();
      },
      onError: () => toast.error("Failed to create subscription"),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create subscription</DialogTitle>
          <DialogDescription>Provision billing for an organization.</DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
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
          </div>

          <div>
            <Label>Billing cycle</Label>
            <Select value={cycle} onValueChange={(v) => { setCycle(v as "monthly" | "annual"); form.setValue("billingCycle", v as "monthly" | "annual"); }}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="annual">Annual</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Locations</Label>
            <Input type="number" min={1} className="mt-1" {...form.register("locations", { valueAsNumber: true })} />
          </div>
          <div>
            <Label>Routers</Label>
            <Input type="number" min={1} className="mt-1" {...form.register("routers", { valueAsNumber: true })} />
          </div>
          <div>
            <Label>Max guests</Label>
            <Input type="number" min={1} className="mt-1" {...form.register("maxGuests", { valueAsNumber: true })} />
          </div>
          <div>
            <Label>Trial days</Label>
            <Input type="number" min={0} max={90} className="mt-1" {...form.register("trialDays", { valueAsNumber: true })} />
          </div>
          <div>
            <Label>Discount (%)</Label>
            <Input type="number" min={0} max={100} className="mt-1" {...form.register("discount", { valueAsNumber: true })} />
          </div>
          <div>
            <Label>Tax (%)</Label>
            <Input type="number" min={0} max={100} className="mt-1" {...form.register("tax", { valueAsNumber: true })} />
          </div>

          <div className="md:col-span-2 flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label className="text-sm">Auto renewal</Label>
              <p className="text-xs text-muted-foreground">Automatically renew at the end of the billing cycle.</p>
            </div>
            <Switch checked={form.watch("autoRenewal")} onCheckedChange={(v) => form.setValue("autoRenewal", v)} />
          </div>

          <div className="md:col-span-2">
            <Label>Notes</Label>
            <Textarea rows={3} className="mt-1" placeholder="Optional notes" {...form.register("notes")} />
          </div>

          <DialogFooter className="md:col-span-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={create.isPending}>{create.isPending ? "Creating…" : "Create subscription"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
