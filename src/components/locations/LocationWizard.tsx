import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Eye,
  EyeOff,
  Loader2,
  Mail,
  Printer,
  RefreshCw,
  Rocket,
  Sparkles,
  UserCheck,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  DEFAULT_LIMITS,
  FEATURE_GROUPS,
  PLAN_PRESETS,
  PROPERTY_TYPES,
  defaultFeatures,
  limitsStepSchema,
  lookupStepSchema,
  ownerStepSchema,
  propertyStepSchema,
  routerStepSchema,
  subscriptionStepSchema,
  type LimitsStep,
} from "@/lib/provisioning-schemas";
import { useCheckOwner, useProvisionCustomer } from "@/hooks/useCustomer";
import {
  customerService,
  generateLocationCode,
  generatePassword,
  generateUsername,
  type ExistingCustomer,
  type ProvisioningPayload,
  type ProvisioningResult,
} from "@/services/customer.service";

const COUNTRIES = ["USA", "UK", "India", "Singapore", "UAE", "Germany", "Australia"];
const TIMEZONES = [
  "America/Los_Angeles",
  "America/New_York",
  "Europe/London",
  "Europe/Berlin",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Dubai",
  "Australia/Sydney",
];

const STEPS = [
  { key: "lookup", title: "Customer lookup", description: "Find or create" },
  { key: "property", title: "Property", description: "Site details" },
  { key: "owner", title: "Owner", description: "Login identity" },
  { key: "router", title: "Router", description: "Hardware & IPs" },
  { key: "subscription", title: "Subscription", description: "Plan & billing" },
  { key: "features", title: "Features", description: "Access flags" },
  { key: "limits", title: "Limits", description: "Quotas" },
  { key: "review", title: "Review", description: "Confirm" },
  { key: "provision", title: "Provision", description: "Deploy" },
] as const;

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

interface WizardState {
  lookup: { email: string; mobile: string };
  property: {
    type: (typeof PROPERTY_TYPES)[number];
    name: string;
    code: string;
    country: string;
    state: string;
    city: string;
    address: string;
    timezone: string;
    latitude: number | string;
    longitude: number | string;
    logoUrl: string;
  };
  owner: {
    name: string;
    email: string;
    mobile: string;
    username: string;
    tempPassword: string;
    forcePasswordReset: boolean;
    role: "Organization Admin";
  };
  router: {
    serialNumber: string;
    model: string;
    routerOsVersion: string;
    publicIp: string;
    privateIp: string;
    wireGuardEnabled: boolean;
  };
  subscription: {
    plan: "trial" | "starter" | "professional" | "enterprise" | "custom";
    billingCycle: "monthly" | "quarterly" | "yearly";
    expiryDate: string;
    keepExisting: boolean;
  };
  features: Record<string, boolean>;
  limits: LimitsStep;
}

const DEFAULT_STATE: WizardState = {
  lookup: { email: "", mobile: "" },
  property: {
    type: "hotel",
    name: "",
    code: "",
    country: "",
    state: "",
    city: "",
    address: "",
    timezone: "",
    latitude: 0,
    longitude: 0,
    logoUrl: "",
  },
  owner: {
    name: "",
    email: "",
    mobile: "",
    username: "",
    tempPassword: "",
    forcePasswordReset: true,
    role: "Organization Admin",
  },
  router: {
    serialNumber: "",
    model: "MikroTik hAP ax3",
    routerOsVersion: "7.14.2",
    publicIp: "",
    privateIp: "192.168.88.1",
    wireGuardEnabled: true,
  },
  subscription: {
    plan: "professional",
    billingCycle: "yearly",
    expiryDate: new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10),
    keepExisting: false,
  },
  features: defaultFeatures(),
  limits: DEFAULT_LIMITS,
};

export function LocationWizard({ open, onOpenChange }: Props) {
  const [step, setStep] = useState(0);
  const [state, setState] = useState<WizardState>(DEFAULT_STATE);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [emailChecked, setEmailChecked] = useState(false);
  const [existing, setExisting] = useState<ExistingCustomer | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [provisionSteps, setProvisionSteps] = useState<
    Array<{ label: string; done: boolean }>
  >([]);
  const [provisioning, setProvisioning] = useState(false);
  const [result, setResult] = useState<ProvisioningResult | null>(null);
  const provisionMutation = useProvisionCustomer();

  const check = useCheckOwner(state.lookup.email, emailChecked);

  useEffect(() => {
    if (check.data && emailChecked) {
      if (check.data.exists && check.data.customer) {
        setExisting(check.data.customer);
        // Prefill owner fields (read-only for existing)
        setState((s) => ({
          ...s,
          owner: {
            ...s.owner,
            name: check.data!.customer!.owner.name,
            email: check.data!.customer!.owner.email,
            mobile: check.data!.customer!.owner.mobile,
            username: check.data!.customer!.owner.email.split("@")[0],
            tempPassword: "",
            forcePasswordReset: false,
          },
          subscription: {
            ...s.subscription,
            plan: check.data!.customer!.subscription.plan,
            billingCycle: check.data!.customer!.subscription.billingCycle,
            expiryDate: check.data!.customer!.subscription.expiryDate.slice(0, 10),
            keepExisting: true,
          },
        }));
      } else {
        setExisting(null);
      }
    }
  }, [check.data, emailChecked]);

  function reset() {
    setStep(0);
    setState(DEFAULT_STATE);
    setErrors({});
    setEmailChecked(false);
    setExisting(null);
    setProvisionSteps([]);
    setProvisioning(false);
    setResult(null);
  }

  function updateProperty<K extends keyof WizardState["property"]>(
    k: K,
    v: WizardState["property"][K],
  ) {
    setState((s) => ({ ...s, property: { ...s.property, [k]: v } }));
  }
  function updateOwner<K extends keyof WizardState["owner"]>(k: K, v: WizardState["owner"][K]) {
    setState((s) => ({ ...s, owner: { ...s.owner, [k]: v } }));
  }
  function updateRouter<K extends keyof WizardState["router"]>(k: K, v: WizardState["router"][K]) {
    setState((s) => ({ ...s, router: { ...s.router, [k]: v } }));
  }
  function updateSub<K extends keyof WizardState["subscription"]>(
    k: K,
    v: WizardState["subscription"][K],
  ) {
    setState((s) => ({ ...s, subscription: { ...s.subscription, [k]: v } }));
  }
  function toggleFeature(k: string) {
    setState((s) => ({ ...s, features: { ...s.features, [k]: !s.features[k] } }));
  }
  function updateLimit<K extends keyof LimitsStep>(k: K, v: number) {
    setState((s) => ({ ...s, limits: { ...s.limits, [k]: v } }));
  }

  function validateStep(): boolean {
    setErrors({});
    let res:
      | { success: true }
      | { success: false; error: { issues: Array<{ path: (string | number)[]; message: string }> } };
    switch (step) {
      case 0:
        res = lookupStepSchema.safeParse(state.lookup) as typeof res;
        if (res.success && !emailChecked) {
          toast.error("Verify the owner email first (tab out of the field)");
          return false;
        }
        break;
      case 1:
        res = propertyStepSchema.safeParse({
          ...state.property,
          latitude: Number(state.property.latitude),
          longitude: Number(state.property.longitude),
        }) as typeof res;
        break;
      case 2:
        if (existing) return true; // read-only
        res = ownerStepSchema.safeParse(state.owner) as typeof res;
        break;
      case 3:
        res = routerStepSchema.safeParse(state.router) as typeof res;
        break;
      case 4:
        res = subscriptionStepSchema.safeParse(state.subscription) as typeof res;
        break;
      case 6:
        res = limitsStepSchema.safeParse(state.limits) as typeof res;
        break;
      default:
        return true;
    }
    if (!res.success) {
      const map: Record<string, string> = {};
      res.error.issues.forEach((i) => {
        map[i.path.join(".")] = i.message;
      });
      setErrors(map);
      return false;
    }
    return true;
  }

  async function next() {
    if (!validateStep()) return;
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  }

  async function runProvision() {
    setProvisioning(true);
    const stepsList = [
      "Checking customer",
      existing ? "Attaching to customer" : "Creating customer",
      existing ? "Reusing organization" : "Creating organization",
      "Creating location",
      existing ? "Verifying owner" : "Creating owner",
      "Generating username",
      "Generating password",
      "Registering router",
      state.router.wireGuardEnabled ? "Generating WireGuard" : "Skipping WireGuard",
      "Applying subscription",
      "Applying feature flags",
      "Applying limits",
      "Configuring Guest WiFi",
      "Configuring Captive Portal",
      "Sending welcome email",
      "Activating customer",
    ].map((l) => ({ label: l, done: false }));
    setProvisionSteps(stepsList);

    for (let i = 0; i < stepsList.length; i++) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 220));
      setProvisionSteps((prev) =>
        prev.map((s, idx) => (idx === i ? { ...s, done: true } : s)),
      );
    }

    try {
      const payload: ProvisioningPayload = {
        lookup: state.lookup,
        property: {
          ...state.property,
          latitude: Number(state.property.latitude) || 0,
          longitude: Number(state.property.longitude) || 0,
          logoUrl: state.property.logoUrl || undefined,
        },
        owner: state.owner,
        router: state.router,
        subscription: state.subscription,
        features: state.features,
        limits: state.limits,
        isExistingCustomer: !!existing,
        existingCustomerId: existing?.organizationId,
      };
      const r = await provisionMutation.mutateAsync(payload);
      setResult(r);
      toast.success(existing ? "Location added" : "Customer provisioned");
    } catch (e) {
      toast.error("Provisioning failed");
    } finally {
      setProvisioning(false);
    }
  }

  const canGoNext = useMemo(() => {
    if (step === 0) return emailChecked && !!state.lookup.email && !check.isFetching;
    return true;
  }, [step, emailChecked, state.lookup.email, check.isFetching]);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
    >
      <DialogContent className="max-w-5xl gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-border/70 px-6 py-4">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Smart location provisioning
          </DialogTitle>
          <DialogDescription>
            Provision a new property. The workflow adapts automatically for new or existing customers.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-0 md:grid-cols-[240px_1fr]">
          <aside className="hidden max-h-[70vh] overflow-y-auto border-r border-border/70 bg-muted/30 p-3 md:block">
            <ol className="space-y-1">
              {STEPS.map((s, i) => {
                const done = i < step;
                const active = i === step;
                return (
                  <li key={s.key}>
                    <button
                      type="button"
                      onClick={() => i < step && setStep(i)}
                      className={cn(
                        "flex w-full items-start gap-3 rounded-lg px-2 py-2 text-left transition-colors",
                        active && "bg-background shadow-sm",
                        !active && "hover:bg-background/60",
                      )}
                    >
                      <div
                        className={cn(
                          "mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border text-xs font-medium",
                          done && "border-primary bg-primary text-primary-foreground",
                          active && "border-primary text-primary",
                          !done && !active && "border-border text-muted-foreground",
                        )}
                      >
                        {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
                      </div>
                      <div>
                        <div
                          className={cn(
                            "text-sm font-medium",
                            !active && !done && "text-muted-foreground",
                          )}
                        >
                          {s.title}
                        </div>
                        <div className="text-xs text-muted-foreground">{s.description}</div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ol>
          </aside>

          <div className="flex min-h-[520px] flex-col">
            <ScrollArea className="max-h-[70vh] flex-1">
              <div className="px-6 py-5">
                {step === 0 && (
                  <LookupStep
                    email={state.lookup.email}
                    mobile={state.lookup.mobile}
                    setEmail={(v) => {
                      setState((s) => ({ ...s, lookup: { ...s.lookup, email: v } }));
                      setEmailChecked(false);
                      setExisting(null);
                    }}
                    setMobile={(v) =>
                      setState((s) => ({ ...s, lookup: { ...s.lookup, mobile: v } }))
                    }
                    onBlurEmail={() => {
                      const r = lookupStepSchema.shape.email.safeParse(state.lookup.email);
                      if (r.success) setEmailChecked(true);
                    }}
                    isChecking={check.isFetching}
                    existing={existing}
                    checked={emailChecked}
                    error={errors["email"]}
                  />
                )}
                {step === 1 && (
                  <PropertyStep
                    value={state.property}
                    update={updateProperty}
                    errors={errors}
                    onAutoCode={() =>
                      updateProperty(
                        "code",
                        generateLocationCode(state.property.type, state.property.city),
                      )
                    }
                  />
                )}
                {step === 2 && (
                  <OwnerStep
                    existing={existing}
                    value={state.owner}
                    update={updateOwner}
                    errors={errors}
                    showPassword={showPassword}
                    setShowPassword={setShowPassword}
                    onGenerateUsername={() =>
                      updateOwner(
                        "username",
                        generateUsername(state.owner.name, state.owner.email || state.lookup.email),
                      )
                    }
                    onGeneratePassword={() => updateOwner("tempPassword", generatePassword(12))}
                    prefillFromLookup={() =>
                      setState((s) => ({
                        ...s,
                        owner: {
                          ...s.owner,
                          email: s.owner.email || s.lookup.email,
                          mobile: s.owner.mobile || s.lookup.mobile,
                        },
                      }))
                    }
                  />
                )}
                {step === 3 && (
                  <RouterStep value={state.router} update={updateRouter} errors={errors} />
                )}
                {step === 4 && (
                  <SubscriptionStep
                    value={state.subscription}
                    update={updateSub}
                    existing={existing}
                    errors={errors}
                    onPlanPreset={(plan) => {
                      updateSub("plan", plan);
                      const preset = PLAN_PRESETS[plan];
                      setState((s) => ({ ...s, limits: { ...s.limits, ...preset } }));
                    }}
                  />
                )}
                {step === 5 && (
                  <FeaturesStep features={state.features} toggle={toggleFeature} />
                )}
                {step === 6 && (
                  <LimitsStepView limits={state.limits} update={updateLimit} errors={errors} />
                )}
                {step === 7 && (
                  <ReviewStep state={state} existing={existing} />
                )}
                {step === 8 && (
                  <ProvisionStep
                    steps={provisionSteps}
                    running={provisioning}
                    result={result}
                    existing={existing}
                    onStart={runProvision}
                    onClose={() => onOpenChange(false)}
                    onCreateAnother={reset}
                  />
                )}
              </div>
            </ScrollArea>

            {step < 8 && (
              <div className="flex items-center justify-between gap-3 border-t border-border/70 bg-muted/20 px-6 py-3">
                <div className="text-xs text-muted-foreground">
                  Step {step + 1} of {STEPS.length}
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setStep((s) => Math.max(0, s - 1))}
                    disabled={step === 0}
                  >
                    <ChevronLeft className="h-4 w-4" /> Back
                  </Button>
                  <Button type="button" onClick={next} disabled={!canGoNext}>
                    {step === 7 ? "Start provisioning" : "Next"}
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Step components ---------- */

function LookupStep({
  email,
  mobile,
  setEmail,
  setMobile,
  onBlurEmail,
  isChecking,
  existing,
  checked,
  error,
}: {
  email: string;
  mobile: string;
  setEmail: (v: string) => void;
  setMobile: (v: string) => void;
  onBlurEmail: () => void;
  isChecking: boolean;
  existing: ExistingCustomer | null;
  checked: boolean;
  error?: string;
}) {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label>Owner email</Label>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={onBlurEmail}
            placeholder="owner@company.com"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Tip: try <code className="rounded bg-muted px-1">owner@existing.com</code> to preview the existing-customer flow.
          </p>
          {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
        </div>
        <div>
          <Label>Owner mobile (optional)</Label>
          <Input
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
            placeholder="+1 415 555 0100"
          />
        </div>
      </div>

      {isChecking && (
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <div className="text-sm">Checking owner…</div>
          </div>
          <div className="mt-3 space-y-2">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-1/3" />
          </div>
        </Card>
      )}

      {!isChecking && checked && !existing && (
        <Card className="border-emerald-500/30 bg-emerald-500/5 p-4">
          <div className="flex items-center gap-2">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-emerald-500/20 text-emerald-600">🟢</span>
            <div className="font-medium">New customer</div>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            This provisioning will create:
          </p>
          <ul className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
            {[
              "Customer",
              "Organization",
              "Primary location",
              "Owner login",
              "Username",
              "Password",
              "Welcome email",
            ].map((l) => (
              <li key={l} className="flex items-center gap-2">
                <Check className="h-3.5 w-3.5 text-emerald-600" /> {l}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {!isChecking && checked && existing && (
        <Card className="border-primary/30 bg-primary/5 p-4">
          <div className="flex items-center gap-2">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-primary/20 text-primary">🔵</span>
            <div className="font-medium">Existing customer found</div>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <InfoRow label="Customer" value={existing.name} />
            <InfoRow label="Organization" value={existing.organizationName} />
            <InfoRow
              label="Subscription"
              value={`${existing.subscription.plan} · ${existing.subscription.billingCycle}`}
            />
            <InfoRow label="Status" value={existing.status} />
            <InfoRow label="Current locations" value={String(existing.locations.length)} />
            <InfoRow label="Owner" value={existing.owner.name} />
            <InfoRow label="Email" value={existing.owner.email} />
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            This new property will be attached to the existing customer.
          </p>
        </Card>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col rounded-md border border-border/60 bg-background px-3 py-2">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

function PropertyStep({
  value,
  update,
  errors,
  onAutoCode,
}: {
  value: WizardState["property"];
  update: <K extends keyof WizardState["property"]>(k: K, v: WizardState["property"][K]) => void;
  errors: Record<string, string>;
  onAutoCode: () => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div>
        <Label>Property type</Label>
        <Select value={value.type} onValueChange={(v) => update("type", v as typeof value.type)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PROPERTY_TYPES.map((t) => (
              <SelectItem key={t} value={t} className="capitalize">
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Field label="Location name" error={errors["name"]}>
        <Input value={value.name} onChange={(e) => update("name", e.target.value)} />
      </Field>
      <Field label="Location code" error={errors["code"]}>
        <div className="flex gap-2">
          <Input value={value.code} onChange={(e) => update("code", e.target.value)} />
          <Button type="button" variant="outline" size="icon" onClick={onAutoCode} title="Auto-generate">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </Field>
      <Field label="Country" error={errors["country"]}>
        <Select value={value.country} onValueChange={(v) => update("country", v)}>
          <SelectTrigger>
            <SelectValue placeholder="Select country" />
          </SelectTrigger>
          <SelectContent>
            {COUNTRIES.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="State" error={errors["state"]}>
        <Input value={value.state} onChange={(e) => update("state", e.target.value)} />
      </Field>
      <Field label="City" error={errors["city"]}>
        <Input value={value.city} onChange={(e) => update("city", e.target.value)} />
      </Field>
      <Field label="Timezone" error={errors["timezone"]}>
        <Select value={value.timezone} onValueChange={(v) => update("timezone", v)}>
          <SelectTrigger>
            <SelectValue placeholder="Select timezone" />
          </SelectTrigger>
          <SelectContent>
            {TIMEZONES.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <div className="sm:col-span-2">
        <Field label="Address" error={errors["address"]}>
          <Textarea
            rows={2}
            value={value.address}
            onChange={(e) => update("address", e.target.value)}
          />
        </Field>
      </div>
      <Field label="Latitude" error={errors["latitude"]}>
        <Input
          type="number"
          value={value.latitude}
          onChange={(e) => update("latitude", e.target.value as unknown as number)}
        />
      </Field>
      <Field label="Longitude" error={errors["longitude"]}>
        <Input
          type="number"
          value={value.longitude}
          onChange={(e) => update("longitude", e.target.value as unknown as number)}
        />
      </Field>
      <div className="sm:col-span-2">
        <Field label="Property logo URL (optional)" error={errors["logoUrl"]}>
          <Input
            placeholder="https://…/logo.png"
            value={value.logoUrl}
            onChange={(e) => update("logoUrl", e.target.value)}
          />
        </Field>
      </div>
    </div>
  );
}

function OwnerStep({
  existing,
  value,
  update,
  errors,
  showPassword,
  setShowPassword,
  onGenerateUsername,
  onGeneratePassword,
  prefillFromLookup,
}: {
  existing: ExistingCustomer | null;
  value: WizardState["owner"];
  update: <K extends keyof WizardState["owner"]>(k: K, v: WizardState["owner"][K]) => void;
  errors: Record<string, string>;
  showPassword: boolean;
  setShowPassword: (v: boolean) => void;
  onGenerateUsername: () => void;
  onGeneratePassword: () => void;
  prefillFromLookup: () => void;
}) {
  const didPrefill = useRef(false);
  useEffect(() => {
    if (!existing && !didPrefill.current) {
      prefillFromLookup();
      onGenerateUsername();
      onGeneratePassword();
      didPrefill.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (existing) {
    return (
      <Card className="p-5">
        <div className="mb-4 flex items-center gap-2">
          <UserCheck className="h-4 w-4 text-primary" />
          <div className="font-medium">Existing owner (read-only)</div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <InfoRow label="Owner name" value={existing.owner.name} />
          <InfoRow label="Email" value={existing.owner.email} />
          <InfoRow label="Mobile" value={existing.owner.mobile} />
          <InfoRow label="Role" value={existing.owner.role} />
          <InfoRow
            label="Assigned locations"
            value={String(existing.owner.assignedLocations)}
          />
        </div>
        <div className="mt-4 flex justify-end">
          <Button variant="outline" size="sm" type="button">
            View owner
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Owner name" error={errors["name"]}>
        <Input value={value.name} onChange={(e) => update("name", e.target.value)} />
      </Field>
      <Field label="Email" error={errors["email"]}>
        <Input value={value.email} onChange={(e) => update("email", e.target.value)} />
      </Field>
      <Field label="Mobile" error={errors["mobile"]}>
        <Input value={value.mobile} onChange={(e) => update("mobile", e.target.value)} />
      </Field>
      <Field label="Role">
        <Input value={value.role} disabled />
      </Field>
      <Field label="Username (auto)" error={errors["username"]}>
        <div className="flex gap-2">
          <Input value={value.username} onChange={(e) => update("username", e.target.value)} />
          <Button type="button" variant="outline" size="icon" onClick={onGenerateUsername}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </Field>
      <Field label="Temporary password (auto)" error={errors["tempPassword"]}>
        <div className="flex gap-2">
          <Input
            type={showPassword ? "text" : "password"}
            value={value.tempPassword}
            onChange={(e) => update("tempPassword", e.target.value)}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
          <Button type="button" variant="outline" size="icon" onClick={onGeneratePassword}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </Field>
      <div className="sm:col-span-2 flex items-center justify-between rounded-lg border border-border/60 p-3">
        <div>
          <div className="text-sm font-medium">Force password reset on first login</div>
          <div className="text-xs text-muted-foreground">
            Owner will be required to set a new password after logging in.
          </div>
        </div>
        <Switch
          checked={value.forcePasswordReset}
          onCheckedChange={(v) => update("forcePasswordReset", v)}
        />
      </div>

      <Card className="sm:col-span-2 border-primary/20 bg-primary/5 p-4">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">Credential preview</div>
        <div className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
          <div className="flex justify-between rounded bg-background px-3 py-2">
            <span className="text-muted-foreground">Username</span>
            <code className="font-mono">{value.username || "—"}</code>
          </div>
          <div className="flex justify-between rounded bg-background px-3 py-2">
            <span className="text-muted-foreground">Password</span>
            <code className="font-mono">
              {value.tempPassword ? (showPassword ? value.tempPassword : "•".repeat(value.tempPassword.length)) : "—"}
            </code>
          </div>
        </div>
      </Card>
    </div>
  );
}

function RouterStep({
  value,
  update,
  errors,
}: {
  value: WizardState["router"];
  update: <K extends keyof WizardState["router"]>(k: K, v: WizardState["router"][K]) => void;
  errors: Record<string, string>;
}) {
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Serial number" error={errors["serialNumber"]}>
          <Input
            value={value.serialNumber}
            onChange={(e) => update("serialNumber", e.target.value)}
          />
        </Field>
        <Field label="Model" error={errors["model"]}>
          <Input value={value.model} onChange={(e) => update("model", e.target.value)} />
        </Field>
        <Field label="RouterOS version" error={errors["routerOsVersion"]}>
          <Input
            value={value.routerOsVersion}
            onChange={(e) => update("routerOsVersion", e.target.value)}
          />
        </Field>
        <Field label="Public IP" error={errors["publicIp"]}>
          <Input
            value={value.publicIp}
            onChange={(e) => update("publicIp", e.target.value)}
            placeholder="203.0.113.42"
          />
        </Field>
        <Field label="Private IP" error={errors["privateIp"]}>
          <Input
            value={value.privateIp}
            onChange={(e) => update("privateIp", e.target.value)}
          />
        </Field>
        <div className="flex items-center justify-between rounded-lg border border-border/60 p-3">
          <div>
            <div className="text-sm font-medium">WireGuard tunnel</div>
            <div className="text-xs text-muted-foreground">Generate keys automatically.</div>
          </div>
          <Switch
            checked={value.wireGuardEnabled}
            onCheckedChange={(v) => update("wireGuardEnabled", v)}
          />
        </div>
      </div>
      <Card className="border-primary/20 bg-gradient-to-b from-primary/5 to-transparent p-4">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">Router preview</div>
        <div className="mt-3 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Model</span>
            <span className="font-medium">{value.model || "—"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Serial</span>
            <span className="font-mono">{value.serialNumber || "—"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">RouterOS</span>
            <span>{value.routerOsVersion || "—"}</span>
          </div>
          <Separator />
          <div className="flex justify-between">
            <span className="text-muted-foreground">Public IP</span>
            <span className="font-mono">{value.publicIp || "—"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Private IP</span>
            <span className="font-mono">{value.privateIp || "—"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">WireGuard</span>
            <Badge variant={value.wireGuardEnabled ? "default" : "secondary"}>
              {value.wireGuardEnabled ? "Enabled" : "Disabled"}
            </Badge>
          </div>
        </div>
      </Card>
    </div>
  );
}

function SubscriptionStep({
  value,
  update,
  existing,
  errors,
  onPlanPreset,
}: {
  value: WizardState["subscription"];
  update: <K extends keyof WizardState["subscription"]>(
    k: K,
    v: WizardState["subscription"][K],
  ) => void;
  existing: ExistingCustomer | null;
  errors: Record<string, string>;
  onPlanPreset: (plan: WizardState["subscription"]["plan"]) => void;
}) {
  const plans: WizardState["subscription"]["plan"][] = [
    "trial",
    "starter",
    "professional",
    "enterprise",
    "custom",
  ];
  return (
    <div className="space-y-5">
      {existing && (
        <Card className="border-primary/20 bg-primary/5 p-4">
          <div className="mb-3 flex items-center gap-2">
            <UserCheck className="h-4 w-4 text-primary" />
            <div className="font-medium">Current subscription</div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <InfoRow label="Plan" value={existing.subscription.plan} />
            <InfoRow label="Cycle" value={existing.subscription.billingCycle} />
            <InfoRow
              label="Current locations"
              value={String(existing.locations.length)}
            />
          </div>
          <div className="mt-3 flex items-center justify-between rounded-lg border border-border/60 bg-background p-3">
            <div>
              <div className="text-sm font-medium">Keep existing plan</div>
              <div className="text-xs text-muted-foreground">
                Attach this location to the customer's current subscription.
              </div>
            </div>
            <Switch
              checked={value.keepExisting}
              onCheckedChange={(v) => update("keepExisting", v)}
            />
          </div>
        </Card>
      )}

      <div>
        <Label>Plan</Label>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {plans.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onPlanPreset(p)}
              disabled={existing?.subscription && value.keepExisting}
              className={cn(
                "rounded-lg border p-3 text-left transition",
                value.plan === p
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-border hover:border-primary/50",
                existing && value.keepExisting && "opacity-50",
              )}
            >
              <div className="text-sm font-semibold capitalize">{p}</div>
              <div className="text-xs text-muted-foreground">
                {p === "trial" ? "14 days" : p === "custom" ? "Bespoke" : "Included limits"}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Billing cycle">
          <Select
            value={value.billingCycle}
            onValueChange={(v) => update("billingCycle", v as typeof value.billingCycle)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="quarterly">Quarterly</SelectItem>
              <SelectItem value="yearly">Yearly</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Expiry date" error={errors["expiryDate"]}>
          <Input
            type="date"
            value={value.expiryDate}
            onChange={(e) => update("expiryDate", e.target.value)}
          />
        </Field>
      </div>
    </div>
  );
}

function FeaturesStep({
  features,
  toggle,
}: {
  features: Record<string, boolean>;
  toggle: (k: string) => void;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {Object.entries(FEATURE_GROUPS).map(([group, items]) => (
        <Card key={group} className="p-4">
          <div className="mb-3 text-sm font-semibold">{group}</div>
          <div className="space-y-2">
            {items.map((f) => (
              <label
                key={f.key}
                className="flex cursor-pointer items-center justify-between rounded-md border border-border/50 px-3 py-2 text-sm hover:bg-muted/40"
              >
                <span>{f.label}</span>
                <Checkbox checked={!!features[f.key]} onCheckedChange={() => toggle(f.key)} />
              </label>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}

function LimitsStepView({
  limits,
  update,
  errors,
}: {
  limits: LimitsStep;
  update: <K extends keyof LimitsStep>(k: K, v: number) => void;
  errors: Record<string, string>;
}) {
  const entries: Array<[keyof LimitsStep, string]> = [
    ["locations", "Maximum locations"],
    ["routers", "Maximum routers"],
    ["guests", "Maximum guests"],
    ["concurrentSessions", "Concurrent sessions"],
    ["staffUsers", "Staff users"],
    ["apiKeys", "API keys"],
    ["storageGb", "Storage (GB)"],
    ["smsCredits", "SMS credits"],
    ["emailCredits", "Email credits"],
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {entries.map(([key, label]) => (
        <Card key={key} className="p-4">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">
            {label}
          </Label>
          <Input
            type="number"
            className="mt-2"
            value={limits[key]}
            onChange={(e) => update(key, Number(e.target.value))}
          />
          {errors[key as string] && (
            <p className="mt-1 text-xs text-destructive">{errors[key as string]}</p>
          )}
        </Card>
      ))}
    </div>
  );
}

function ReviewStep({
  state,
  existing,
}: {
  state: WizardState;
  existing: ExistingCustomer | null;
}) {
  const enabledFeatures = Object.entries(state.features)
    .filter(([, v]) => v)
    .map(([k]) => k);
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <SummaryCard title="Customer">
          <InfoRow
            label="Type"
            value={existing ? "Existing" : "New"}
          />
          <InfoRow
            label="Name"
            value={existing?.name || state.owner.name || state.lookup.email}
          />
        </SummaryCard>
        <SummaryCard title="Organization">
          <InfoRow
            label="Organization"
            value={existing?.organizationName || state.owner.name + " Org"}
          />
        </SummaryCard>
        <SummaryCard title="Property">
          <InfoRow label="Type" value={state.property.type} />
          <InfoRow label="Name" value={state.property.name} />
          <InfoRow label="Code" value={state.property.code} />
        </SummaryCard>
        <SummaryCard title="Location">
          <InfoRow
            label="Where"
            value={`${state.property.city}, ${state.property.state}, ${state.property.country}`}
          />
          <InfoRow label="Timezone" value={state.property.timezone} />
        </SummaryCard>
        <SummaryCard title="Owner">
          <InfoRow label="Name" value={state.owner.name} />
          <InfoRow label="Email" value={state.owner.email} />
          {!existing && <InfoRow label="Username" value={state.owner.username} />}
        </SummaryCard>
        <SummaryCard title="Router">
          <InfoRow label="Model" value={state.router.model} />
          <InfoRow label="Serial" value={state.router.serialNumber} />
          <InfoRow label="Public IP" value={state.router.publicIp} />
        </SummaryCard>
        <SummaryCard title="Subscription">
          <InfoRow label="Plan" value={state.subscription.plan} />
          <InfoRow label="Cycle" value={state.subscription.billingCycle} />
          <InfoRow label="Expiry" value={state.subscription.expiryDate} />
        </SummaryCard>
        <SummaryCard title="Limits">
          <InfoRow label="Locations" value={String(state.limits.locations)} />
          <InfoRow label="Routers" value={String(state.limits.routers)} />
          <InfoRow label="Guests" value={String(state.limits.guests)} />
        </SummaryCard>
      </div>

      <Card className="p-4">
        <div className="mb-2 text-sm font-semibold">Enabled features</div>
        <div className="flex flex-wrap gap-1.5">
          {enabledFeatures.map((f) => (
            <Badge key={f} variant="secondary" className="text-xs">
              {f}
            </Badge>
          ))}
        </div>
      </Card>

      {existing && (
        <Card className="p-4">
          <div className="mb-3 text-sm font-semibold">
            Properties under {existing.name}
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {existing.locations.map((l) => (
              <div
                key={l.id}
                className="flex items-center gap-2 rounded-md border border-border/60 px-3 py-2 text-sm"
              >
                🏨 {l.name}
              </div>
            ))}
            <div className="flex items-center gap-2 rounded-md border border-primary/40 bg-primary/5 px-3 py-2 text-sm">
              🏨 {state.property.name || "New property"}
              <Badge className="ml-auto">New</Badge>
            </div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            This property will be added to the customer's existing dashboard.
          </p>
        </Card>
      )}
    </div>
  );
}

function SummaryCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="p-4">
      <div className="mb-2 text-sm font-semibold">{title}</div>
      <div className="space-y-2">{children}</div>
    </Card>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="mt-1">{children}</div>
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}

function ProvisionStep({
  steps,
  running,
  result,
  existing,
  onStart,
  onClose,
  onCreateAnother,
}: {
  steps: Array<{ label: string; done: boolean }>;
  running: boolean;
  result: ProvisioningResult | null;
  existing: ExistingCustomer | null;
  onStart: () => void;
  onClose: () => void;
  onCreateAnother: () => void;
}) {
  const started = steps.length > 0;
  const doneCount = steps.filter((s) => s.done).length;
  const pct = started ? Math.round((doneCount / steps.length) * 100) : 0;

  useEffect(() => {
    if (!started && !result) onStart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (result) {
    return <SuccessScreen result={result} isExisting={!!existing} onClose={onClose} onCreateAnother={onCreateAnother} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Rocket className="h-5 w-5 text-primary" />
        <div>
          <div className="font-medium">Provisioning your customer…</div>
          <div className="text-xs text-muted-foreground">
            This usually takes a few seconds. Please don't close this window.
          </div>
        </div>
      </div>
      <Progress value={pct} />
      <Card className="p-4">
        <ul className="space-y-2 text-sm">
          {steps.map((s, i) => (
            <li key={i} className="flex items-center gap-3">
              {s.done ? (
                <Check className="h-4 w-4 text-emerald-500" />
              ) : running && steps.findIndex((x) => !x.done) === i ? (
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
              ) : (
                <div className="h-4 w-4 rounded-full border border-border" />
              )}
              <span className={cn(!s.done && "text-muted-foreground")}>{s.label}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function SuccessScreen({
  result,
  isExisting,
  onClose,
  onCreateAnother,
}: {
  result: ProvisioningResult;
  isExisting: boolean;
  onClose: () => void;
  onCreateAnother: () => void;
}) {
  function copyCreds() {
    const text = `Username: ${result.ownerUsername}\nPassword: ${result.ownerTempPassword}\nLogin: ${result.loginUrl}`;
    navigator.clipboard.writeText(text);
    toast.success("Credentials copied");
  }
  function downloadText() {
    const blob = new Blob(
      [
        `CloudGuest — Provisioning summary\n\nCustomer: ${result.customerId}\nOrganization: ${result.organizationId}\nLocation: ${result.locationId}\nUsername: ${result.ownerUsername}\nTemporary password: ${result.ownerTempPassword}\nLogin URL: ${result.loginUrl}\n`,
      ],
      { type: "text/plain" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cloudguest-${result.customerId}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
        <div className="grid h-10 w-10 place-items-center rounded-full bg-emerald-500 text-white">
          <Check className="h-5 w-5" />
        </div>
        <div>
          <div className="font-semibold">
            {isExisting ? "Location added successfully" : "Customer created successfully"}
          </div>
          <div className="text-sm text-muted-foreground">
            {isExisting
              ? "The new property is now part of the customer's dashboard."
              : "The welcome email has been queued and the login is ready."}
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <SummaryCard title={isExisting ? "Existing customer" : "Customer"}>
          <InfoRow label="Customer ID" value={result.customerId} />
          <InfoRow label="Organization" value={result.organizationId} />
        </SummaryCard>
        <SummaryCard title="Location">
          <InfoRow label="Location ID" value={result.locationId} />
        </SummaryCard>
        {!isExisting && (
          <SummaryCard title="Owner credentials">
            <InfoRow label="Username" value={result.ownerUsername} />
            <InfoRow label="Temp password" value={result.ownerTempPassword} />
            <InfoRow label="Login URL" value={result.loginUrl} />
          </SummaryCard>
        )}
        {isExisting && (
          <SummaryCard title="Notification">
            <InfoRow label="Welcome email" value="Sent" />
            <InfoRow label="Owner notified" value="Yes" />
          </SummaryCard>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {!isExisting && (
          <>
            <Button variant="outline" onClick={copyCreds}>
              <Copy className="h-4 w-4" /> Copy credentials
            </Button>
            <Button variant="outline" onClick={downloadText}>
              <Download className="h-4 w-4" /> Download
            </Button>
            <Button variant="outline" onClick={() => window.print()}>
              <Printer className="h-4 w-4" /> Print
            </Button>
            <Button variant="outline" onClick={() => toast.success("Welcome email re-sent")}>
              <Mail className="h-4 w-4" /> Send welcome again
            </Button>
          </>
        )}
        <div className="ml-auto flex gap-2">
          <Button variant="outline" onClick={onCreateAnother}>
            Create another
          </Button>
          <Button onClick={onClose}>Open dashboard</Button>
        </div>
      </div>
    </div>
  );
}
