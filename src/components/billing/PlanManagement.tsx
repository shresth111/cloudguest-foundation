import { useState } from "react";
import { toast } from "sonner";
import { Check, Crown, Pencil, Sparkles, Trash2, Zap } from "lucide-react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDeletePlan, useSavePlan } from "@/hooks/useBilling";
import type { Plan, PlanTier, SupportLevel } from "@/types/billing";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { planSchema, type PlanFormValues } from "@/lib/billing-schemas";

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat(currency === "INR" ? "en-IN" : undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

const TIER_ICON: Record<PlanTier, typeof Sparkles> = {
  starter: Sparkles,
  professional: Zap,
  enterprise: Crown,
  custom: Crown,
};

export function PlanManagement({ plans }: { plans: Plan[] }) {
  const [editing, setEditing] = useState<Plan | "new" | null>(null);
  const [deleting, setDeleting] = useState<Plan | null>(null);
  const del = useDeletePlan();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Plan catalog</h2>
          <p className="text-sm text-muted-foreground">Configure prices, quotas and features across every tier.</p>
        </div>
        <Button onClick={() => setEditing("new")}>New plan</Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        {plans.map((p, i) => {
          const Icon = TIER_ICON[p.tier];
          return (
            <motion.div key={p.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card className="relative h-full">
                {p.popular && (
                  <Badge className="absolute -top-2 right-4 bg-primary text-primary-foreground">Popular</Badge>
                )}
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="h-4 w-4" />
                    </div>
                    <CardTitle className="text-base">{p.name}</CardTitle>
                  </div>
                  <div className="mt-3">
                    <div className="text-3xl font-semibold tracking-tight">
                      {p.tier === "custom" ? "Contact us" : formatMoney(p.monthlyPrice, p.currency)}
                    </div>
                    {p.tier !== "custom" && (
                      <p className="text-xs text-muted-foreground">
                        or {formatMoney(p.annualPrice, p.currency)} / year
                      </p>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <Feature label={`${p.includedLocations} locations`} />
                  <Feature label={`${p.includedRouters} routers`} />
                  <Feature label={`${p.includedGuests.toLocaleString()} guests / mo`} />
                  <Feature label={`${p.storageLimitGb} GB storage`} />
                  <Feature label="API access" ok={p.apiAccess} />
                  <Feature label="White label" ok={p.whiteLabel} />
                  <Feature label="PMS integration" ok={p.pmsIntegration} />
                  <Feature label="AI features" ok={p.aiFeatures} />
                  <Feature label={`Support: ${supportLabel(p.supportLevel)}`} />
                  <div className="flex gap-2 pt-2">
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => setEditing(p)}>
                      <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setDeleting(p)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {editing && (
        <PlanEditor
          open
          onOpenChange={(o) => !o && setEditing(null)}
          plan={editing === "new" ? undefined : editing}
        />
      )}

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete plan "${deleting?.name}"?`}
        description="This plan will no longer be selectable when creating new subscriptions."
        confirmLabel="Delete plan"
        destructive
        onConfirm={() => {
          if (!deleting) return;
          del.mutate(deleting.id, { onSuccess: () => toast.success("Plan deleted") });
          setDeleting(null);
        }}
      />
    </div>
  );
}

function Feature({ label, ok = true }: { label: string; ok?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <Check className={"h-3.5 w-3.5 " + (ok ? "text-emerald-500" : "text-muted-foreground/40")} />
      <span className={ok ? "" : "text-muted-foreground line-through"}>{label}</span>
    </div>
  );
}

function supportLabel(l: SupportLevel) {
  return { email: "Email", priority: "Priority", "24x7": "24×7", dedicated: "Dedicated" }[l];
}

function PlanEditor({ open, onOpenChange, plan }: { open: boolean; onOpenChange: (v: boolean) => void; plan?: Plan }) {
  const save = useSavePlan();
  const form = useForm<PlanFormValues>({
    resolver: zodResolver(planSchema),
    defaultValues: plan
      ? {
          name: plan.name,
          tier: plan.tier,
          currency: plan.currency === "INR" || plan.currency === "USD" ? plan.currency : "INR",
          monthlyPrice: plan.monthlyPrice,
          annualPrice: plan.annualPrice,
          includedLocations: plan.includedLocations,
          includedRouters: plan.includedRouters,
          includedGuests: plan.includedGuests,
          storageLimitGb: plan.storageLimitGb,
          apiAccess: plan.apiAccess,
          whiteLabel: plan.whiteLabel,
          pmsIntegration: plan.pmsIntegration,
          aiFeatures: plan.aiFeatures,
          supportLevel: plan.supportLevel,
        }
      : {
          name: "",
          tier: "starter",
          currency: "INR",
          monthlyPrice: 0,
          annualPrice: 0,
          includedLocations: 1,
          includedRouters: 1,
          includedGuests: 100,
          storageLimitGb: 10,
          apiAccess: false,
          whiteLabel: false,
          pmsIntegration: false,
          aiFeatures: false,
          supportLevel: "email",
        },
  });

  const onSubmit = (values: PlanFormValues) => {
    save.mutate({ ...values, id: plan?.id }, {
      onSuccess: () => {
        toast.success(plan ? "Plan updated" : "Plan created");
        onOpenChange(false);
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{plan ? "Edit plan" : "New plan"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Label>Plan name</Label>
            <Input className="mt-1" {...form.register("name")} />
            {form.formState.errors.name && <p className="mt-1 text-xs text-destructive">{form.formState.errors.name.message}</p>}
          </div>
          <div>
            <Label>Tier</Label>
            <Select value={form.watch("tier")} onValueChange={(v) => form.setValue("tier", v as PlanTier)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="starter">Starter</SelectItem>
                <SelectItem value="professional">Professional</SelectItem>
                <SelectItem value="enterprise">Enterprise</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Support level</Label>
            <Select value={form.watch("supportLevel")} onValueChange={(v) => form.setValue("supportLevel", v as SupportLevel)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="priority">Priority</SelectItem>
                <SelectItem value="24x7">24×7</SelectItem>
                <SelectItem value="dedicated">Dedicated</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Currency</Label>
            <Select value={form.watch("currency")} onValueChange={(v) => form.setValue("currency", v as "INR" | "USD")}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="INR">INR (₹) — GST applies</SelectItem>
                <SelectItem value="USD">USD ($)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div />
          <div><Label>Monthly price</Label><Input type="number" className="mt-1" {...form.register("monthlyPrice", { valueAsNumber: true })} /></div>
          <div><Label>Annual price</Label><Input type="number" className="mt-1" {...form.register("annualPrice", { valueAsNumber: true })} /></div>
          <div><Label>Locations</Label><Input type="number" className="mt-1" {...form.register("includedLocations", { valueAsNumber: true })} /></div>
          <div><Label>Routers</Label><Input type="number" className="mt-1" {...form.register("includedRouters", { valueAsNumber: true })} /></div>
          <div><Label>Guests</Label><Input type="number" className="mt-1" {...form.register("includedGuests", { valueAsNumber: true })} /></div>
          <div><Label>Storage (GB)</Label><Input type="number" className="mt-1" {...form.register("storageLimitGb", { valueAsNumber: true })} /></div>

          {(["apiAccess", "whiteLabel", "pmsIntegration", "aiFeatures"] as const).map((k) => (
            <div key={k} className="col-span-2 flex items-center justify-between rounded-lg border p-3">
              <Label className="text-sm capitalize">{k.replace(/([A-Z])/g, " $1")}</Label>
              <Switch checked={form.watch(k)} onCheckedChange={(v) => form.setValue(k, v)} />
            </div>
          ))}

          <DialogFooter className="col-span-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={save.isPending}>{save.isPending ? "Saving…" : "Save plan"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
