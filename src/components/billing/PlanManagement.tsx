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

// -1 is this app's "Unlimited" sentinel for the four included-limit
// fields (see billing.service.ts's featureLimit()/toBackendLimit()).
function limitLabel(value: number, thousands = false): string {
  if (value === -1) return "Unlimited";
  return thousands ? value.toLocaleString() : String(value);
}

/** A number field for one of the four included-limit fields, with an
 * "Unlimited" toggle alongside it -- typing a number was previously the
 * only option, with no way to express "no cap" short of typing something
 * absurdly large. Toggling on stores -1 (this app's Unlimited sentinel,
 * see limitLabel()/featureLimit() above); toggling off restores the last
 * typed number (remembered locally, not lost when flipping back and
 * forth) or a sane default. */
function LimitField({ label, value, onChange, defaultValue = 1 }: { label: string; value: number; onChange: (v: number) => void; defaultValue?: number }) {
  const [lastNumber, setLastNumber] = useState(value === -1 ? defaultValue : value);
  const unlimited = value === -1;
  return (
    <div>
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Switch
            checked={unlimited}
            onCheckedChange={(checked) => onChange(checked ? -1 : lastNumber)}
            className="scale-75"
          />
          Unlimited
        </label>
      </div>
      <Input
        type="number"
        min={1}
        className="mt-1"
        disabled={unlimited}
        value={unlimited ? "" : value}
        placeholder={unlimited ? "Unlimited" : undefined}
        onChange={(e) => {
          const next = Number(e.target.value) || 0;
          setLastNumber(next);
          onChange(next);
        }}
      />
    </div>
  );
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
                  <Feature label={`${limitLabel(p.includedLocations)} locations`} />
                  <Feature label={`${limitLabel(p.includedRouters)} routers`} />
                  <Feature label={`${limitLabel(p.includedGuests, true)} guests / mo`} />
                  <Feature label={`${limitLabel(p.storageLimitGb)} GB storage`} />
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
  return { basic: "Basic (Email)", priority: "Priority", dedicated: "Dedicated (24×7)" }[l];
}

function PlanEditor({ open, onOpenChange, plan }: { open: boolean; onOpenChange: (v: boolean) => void; plan?: Plan }) {
  const save = useSavePlan();
  const form = useForm<PlanFormValues>({
    resolver: zodResolver(planSchema),
    defaultValues: plan
      ? {
          name: plan.name,
          tier: plan.tier,
          currency: "INR",
          monthlyPrice: plan.monthlyPrice,
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
          includedLocations: 1,
          includedRouters: 1,
          includedGuests: 100,
          storageLimitGb: 10,
          apiAccess: false,
          whiteLabel: false,
          pmsIntegration: false,
          aiFeatures: false,
          supportLevel: "basic",
        },
  });

  const onSubmit = (values: PlanFormValues) => {
    // The real backend Plan model (PlanCreateRequest/PlanUpdateRequest --
    // backend/app/domains/billing/schemas.py) has one base_price and one
    // billing_cycle per plan, never a separate monthly *and* annual price.
    // annualPrice is display-only here -- always 12x the monthly price
    // (see toPlan()'s read-side computation, which this mirrors), never a
    // real, independently-priced annual tier.
    save.mutate({ ...values, annualPrice: values.monthlyPrice * 12, id: plan?.id }, {
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
            {/* The real backend has no way to change a plan's tier after
                creation (PlanUpdateRequest carries no plan_type field) --
                this used to stay editable and silently do nothing on
                save for an existing plan. Locked to what the plan was
                created with; only choosable for a brand-new plan. */}
            <Select
              value={form.watch("tier")}
              onValueChange={(v) => form.setValue("tier", v as PlanTier)}
              disabled={!!plan}
            >
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="starter">Starter</SelectItem>
                <SelectItem value="professional">Professional</SelectItem>
                <SelectItem value="enterprise">Enterprise</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
            {plan && <p className="mt-1 text-xs text-muted-foreground">Tier can't be changed after a plan is created.</p>}
          </div>
          <div>
            <Label>Support level</Label>
            <Select value={form.watch("supportLevel")} onValueChange={(v) => form.setValue("supportLevel", v as SupportLevel)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="basic">Basic (Email)</SelectItem>
                <SelectItem value="priority">Priority</SelectItem>
                <SelectItem value="dedicated">Dedicated (24×7)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Currency</Label>
            <p className="mt-1 flex h-9 items-center text-sm text-muted-foreground">₹ INR — GST applies</p>
          </div>
          <div />
          <div>
            <Label>Monthly price</Label>
            <Input type="number" className="mt-1" {...form.register("monthlyPrice", { valueAsNumber: true })} />
          </div>
          <div>
            <Label>Annual price</Label>
            {/* Not editable -- see onSubmit's comment. Always 12x the
                monthly price, same as the read-only plan cards show. */}
            <p className="mt-1 flex h-9 items-center text-sm text-muted-foreground">
              {formatMoney((form.watch("monthlyPrice") || 0) * 12, form.watch("currency"))} / year
            </p>
          </div>
          <LimitField label="Locations" value={form.watch("includedLocations")} onChange={(v) => form.setValue("includedLocations", v)} />
          <LimitField label="Routers" value={form.watch("includedRouters")} onChange={(v) => form.setValue("includedRouters", v)} />
          <LimitField label="Guests" value={form.watch("includedGuests")} onChange={(v) => form.setValue("includedGuests", v)} defaultValue={100} />
          <LimitField label="Storage (GB)" value={form.watch("storageLimitGb")} onChange={(v) => form.setValue("storageLimitGb", v)} defaultValue={10} />

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
