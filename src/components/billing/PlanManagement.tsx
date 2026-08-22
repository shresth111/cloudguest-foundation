import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Check, Crown, Pencil, Sparkles, Trash2, Zap } from "lucide-react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDeletePlan, useSavePlan } from "@/hooks/useBilling";
import type { Plan, PlanTier, SupportLevel } from "@/types/billing";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { planSchema, type PlanFormValues } from "@/lib/billing-schemas";
import { humanizeApiError } from "@/lib/errorMessages";
import type { AppError } from "@/services/api";

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

/** The one place a field's validation message gets rendered. Every input
 * in PlanEditor now has one. Before, only `name` did -- so a resolver
 * rejection on any of the other twelve fields aborted the submit with no
 * mutation, no toast, and nothing at all on screen. The dialog just sat
 * there looking like the Save button was dead. See PlanEditor's onInvalid. */
function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-destructive">{message}</p>;
}

/** api.ts's response interceptor rejects every failed request with an
 * `AppError`, but react-query types a mutation's error as plain `Error` and
 * a fault thrown before the request leaves (a serialisation bug, say) really
 * would be one. Narrow rather than assert, so an unexpected shape degrades
 * to "something went wrong" instead of reading `.status` off undefined and
 * throwing inside the error handler itself. */
function asAppError(err: unknown): AppError {
  const e = err as Partial<AppError> | null;
  if (e && typeof e === "object" && "status" in e && "code" in e) return e as AppError;
  return {
    status: null,
    code: "unknown_error",
    message: err instanceof Error ? err.message : "Something went wrong",
  };
}

/**
 * Why a write failed, in words the operator can act on (and quote when
 * reporting it). Deliberately does not print the backend's raw message
 * except for a 422's per-field detail -- `lib/errorMessages.ts` documents
 * why that text is not safe to surface verbatim. The HTTP status is always
 * included: it is the one thing that makes a failure routable.
 */
function writeFailureMessage(err: AppError, what: string): string {
  switch (err.status) {
    case 400:
    case 422:
      return `The server rejected these values (HTTP ${err.status}). Check the highlighted fields and try again.`;
    case 401:
      return "Your session is no longer valid (HTTP 401). Sign in again, then retry.";
    case 403:
      return `You do not have permission to ${what} (HTTP 403). Plan changes need a platform-level role.`;
    case 404:
      return "This plan no longer exists (HTTP 404). It may have been deleted in another session — close this dialog and reload.";
    case 409:
      return "Another change to this plan landed first (HTTP 409). Close this dialog, reload, then reapply your edit.";
    case null:
      return "Unable to reach the server. Nothing was saved — check your connection and try again.";
    default:
      return `Could not ${what} (HTTP ${err.status}). ${humanizeApiError(err, "Please try again.")}`;
  }
}

/** A number field for one of the four included-limit fields, with an
 * "Unlimited" toggle alongside it -- typing a number was previously the
 * only option, with no way to express "no cap" short of typing something
 * absurdly large. Toggling on stores -1 (this app's Unlimited sentinel,
 * see limitLabel()/featureLimit() above); toggling off restores the last
 * typed number (remembered locally, not lost when flipping back and
 * forth) or a sane default. */
function LimitField({
  label,
  value,
  onChange,
  defaultValue = 1,
  error,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  defaultValue?: number;
  error?: string;
}) {
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
      <FieldError message={error} />
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
          <p className="text-sm text-muted-foreground">
            Configure prices, quotas and features across every tier.
          </p>
        </div>
        <Button onClick={() => setEditing("new")}>New plan</Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        {plans.map((p, i) => {
          const Icon = TIER_ICON[p.tier];
          return (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card className="relative h-full">
                {p.popular && (
                  <Badge className="absolute -top-2 right-4 bg-primary text-primary-foreground">
                    Popular
                  </Badge>
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
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => setEditing(p)}
                    >
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
          const name = deleting.name;
          del.mutate(deleting.id, {
            onSuccess: () => toast.success("Plan deleted"),
            // Same swallowed-rejection bug the editor had: with only an
            // onSuccess, a failed delete closed the confirm dialog and said
            // nothing at all, so the plan looked deleted right up until the
            // card was still there. useDeletePlan invalidates ["billing"]
            // on success only, so the card correctly stays -- say why.
            onError: (err) =>
              toast.error(writeFailureMessage(asAppError(err), "delete this plan"), {
                description: `"${name}" was not deleted.`,
              }),
          });
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

function PlanEditor({
  open,
  onOpenChange,
  plan,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  plan?: Plan;
}) {
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

  // Why the last attempt failed, shown inside the dialog. Previously
  // `save.mutate` was handed an `onSuccess` and nothing else, so a rejected
  // save resolved into nothing whatsoever -- no toast, no text -- and the
  // dialog stayed open waiting on a success that was never coming. Cleared
  // at the start of every attempt so a stale failure cannot outlive it.
  const [saveError, setSaveError] = useState<string | null>(null);
  const errors = form.formState.errors;

  const onSubmit = (values: PlanFormValues) => {
    setSaveError(null);
    // The real backend Plan model (PlanCreateRequest/PlanUpdateRequest --
    // backend/app/domains/billing/schemas.py) has one base_price and one
    // billing_cycle per plan, never a separate monthly *and* annual price.
    // annualPrice is display-only here -- always 12x the monthly price
    // (see toPlan()'s read-side computation, which this mirrors), never a
    // real, independently-priced annual tier.
    save.mutate(
      { ...values, annualPrice: values.monthlyPrice * 12, id: plan?.id },
      {
        // useSavePlan invalidates the whole ["billing"] key on success, so
        // the card behind this dialog re-reads from the server instead of
        // from anything held locally here. A save that did not persist can
        // therefore never leave a changed-looking card behind.
        onSuccess: () => {
          toast.success(plan ? "Plan updated" : "Plan created");
          onOpenChange(false);
        },
        onError: (err) => {
          const appError = asAppError(err);
          // A 422 names the offending fields -- put each message back on
          // the input it belongs to, so it sits where the fix is.
          const fieldErrors = appError.fieldErrors;
          if (fieldErrors) {
            for (const [field, message] of Object.entries(fieldErrors)) {
              if (field in planSchema.shape) {
                form.setError(field as keyof PlanFormValues, { type: "server", message });
              }
            }
          }
          setSaveError(writeFailureMessage(appError, plan ? "save this plan" : "create this plan"));
        },
      },
    );
  };

  // A resolver rejection never reaches onSubmit at all, so the banner has
  // to be raised from here or an invalid submit is once again a silent
  // no-op -- which is exactly how this dialog looked broken.
  const onInvalid = () =>
    setSaveError("Some fields need fixing before this plan can be saved. See the messages below.");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{plan ? "Edit plan" : "New plan"}</DialogTitle>
        </DialogHeader>
        {/* `noValidate` is load-bearing, not tidying.
            LimitField renders `<input type="number" min={1}>`. A plan whose
            backend feature row carries limit_value 0 -- or a storage quota
            under ~512 MB, which toPlan rounds down to 0 GB -- loads that
            input with value 0, which fails the browser's OWN constraint
            validation. The browser then refuses to fire the submit event at
            all: no React handler, no zod resolver, no request, no message.
            Pressing "Save plan" did nothing whatsoever, and the dialog sat
            there looking dead. Measured in a real Chromium: 0 submit events.
            Validation is RHF + planSchema's job exclusively -- it is the
            only one of the two that can render a message the user can see. */}
        <form
          noValidate
          onSubmit={form.handleSubmit(onSubmit, onInvalid)}
          className="grid grid-cols-2 gap-4"
        >
          {saveError && (
            <div
              role="alert"
              className="col-span-2 flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{saveError}</span>
            </div>
          )}
          <div className="col-span-2">
            <Label>Plan name</Label>
            <Input className="mt-1" {...form.register("name")} />
            <FieldError message={errors.name?.message} />
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
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="starter">Starter</SelectItem>
                <SelectItem value="professional">Professional</SelectItem>
                <SelectItem value="enterprise">Enterprise</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
            {plan && (
              <p className="mt-1 text-xs text-muted-foreground">
                Tier can't be changed after a plan is created.
              </p>
            )}
            <FieldError message={errors.tier?.message} />
          </div>
          <div>
            <Label>Support level</Label>
            <Select
              value={form.watch("supportLevel")}
              onValueChange={(v) => form.setValue("supportLevel", v as SupportLevel)}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="basic">Basic (Email)</SelectItem>
                <SelectItem value="priority">Priority</SelectItem>
                <SelectItem value="dedicated">Dedicated (24×7)</SelectItem>
              </SelectContent>
            </Select>
            <FieldError message={errors.supportLevel?.message} />
          </div>
          <div>
            <Label>Currency</Label>
            <p className="mt-1 flex h-9 items-center text-sm text-muted-foreground">
              ₹ INR — GST applies
            </p>
            <FieldError message={errors.currency?.message} />
          </div>
          <div />
          <div>
            <Label>Monthly price</Label>
            <Input
              type="number"
              className="mt-1"
              {...form.register("monthlyPrice", { valueAsNumber: true })}
            />
            {/* Clearing this input makes valueAsNumber hand the resolver a
                NaN, which fails `min(0)`. That rejection used to be
                completely invisible: blank the price, press Save, and
                nothing at all happened. */}
            <FieldError
              message={
                errors.monthlyPrice &&
                (Number.isNaN(form.getValues("monthlyPrice"))
                  ? "Enter a monthly price (0 for a free plan)."
                  : errors.monthlyPrice.message)
              }
            />
          </div>
          <div>
            <Label>Annual price</Label>
            {/* Not editable -- see onSubmit's comment. Always 12x the
                monthly price, same as the read-only plan cards show. */}
            <p className="mt-1 flex h-9 items-center text-sm text-muted-foreground">
              {formatMoney((form.watch("monthlyPrice") || 0) * 12, form.watch("currency"))} / year
            </p>
          </div>
          {/* These four are the ones that actually bit. A plan whose backend
              feature row carries limit_value 0 -- or a storage quota under
              ~512 MB, which toPlan rounds down to 0 GB -- loads here as 0,
              which planSchema rejects outright. So the dialog opened
              already-invalid and Save did nothing, with nothing on screen
              to say why. The value still has to be corrected, but now the
              form says which one and what it wants. */}
          <LimitField
            label="Locations"
            value={form.watch("includedLocations")}
            onChange={(v) => form.setValue("includedLocations", v)}
            error={errors.includedLocations?.message}
          />
          <LimitField
            label="Routers"
            value={form.watch("includedRouters")}
            onChange={(v) => form.setValue("includedRouters", v)}
            error={errors.includedRouters?.message}
          />
          <LimitField
            label="Guests"
            value={form.watch("includedGuests")}
            onChange={(v) => form.setValue("includedGuests", v)}
            defaultValue={100}
            error={errors.includedGuests?.message}
          />
          <LimitField
            label="Storage (GB)"
            value={form.watch("storageLimitGb")}
            onChange={(v) => form.setValue("storageLimitGb", v)}
            defaultValue={10}
            error={errors.storageLimitGb?.message}
          />

          {(["apiAccess", "whiteLabel", "pmsIntegration", "aiFeatures"] as const).map((k) => (
            <div
              key={k}
              className="col-span-2 flex items-center justify-between rounded-lg border p-3"
            >
              <Label className="text-sm capitalize">{k.replace(/([A-Z])/g, " $1")}</Label>
              <Switch checked={form.watch(k)} onCheckedChange={(v) => form.setValue(k, v)} />
            </div>
          ))}

          <DialogFooter className="col-span-2">
            {/* Never disabled while saving. A dialog the user cannot leave
                is worse than the bug this file is fixing, and an in-flight
                PUT is not a reason to trap them: react-query's onSuccess
                still lands and still invalidates ["billing"], so leaving
                early cannot lose a write that did go through. */}
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? "Saving…" : "Save plan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
