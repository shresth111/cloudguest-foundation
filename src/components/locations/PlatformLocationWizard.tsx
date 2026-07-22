import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Building2,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  MapPin,
  Router as RouterIcon,
  Sparkles,
  UserCog,
} from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

import { api } from "@/services/api";
import { locationService } from "@/services/location.service";
import { useProvisionLocation } from "@/hooks/useLocations";
import { PROPERTY_TYPE_LABEL, type PropertyType, type ProvisionLocationPayload, type ProvisionLocationResult } from "@/types/location";
import type { AppError } from "@/services/api";

const COUNTRIES = ["US", "GB", "IN", "SG", "AE", "DE", "AU", "CA"];
const TIMEZONES = ["UTC", "Asia/Kolkata", "Asia/Singapore", "Asia/Dubai", "America/Los_Angeles", "America/New_York", "Europe/London", "Europe/Berlin"];

const STEPS = [
  { key: "org", title: "Organization", desc: "Select or create", icon: Building2 },
  { key: "location", title: "Location", desc: "Site details", icon: MapPin },
  { key: "owner", title: "Owner", desc: "Location owner account", icon: UserCog },
  { key: "router", title: "Router", desc: "First device", icon: RouterIcon },
  { key: "plan", title: "Plan", desc: "Assign a subscription plan", icon: Sparkles },
  { key: "review", title: "Review", desc: "Confirm & provision", icon: Check },
] as const;

interface WizardState {
  org: { mode: "existing" | "new"; existingId?: string; name: string; slug: string; contactEmail: string };
  location: {
    name: string;
    slug: string;
    propertyType: PropertyType | "";
    addressLine1: string;
    city: string;
    stateProvince: string;
    postalCode: string;
    country: string;
    timezone: string;
  };
  owner: { firstName: string; lastName: string; email: string };
  router: { name: string; serialNumber: string; macAddress: string; model: string };
  planId: string;
}

const DEFAULT_STATE: WizardState = {
  org: { mode: "existing", name: "", slug: "", contactEmail: "" },
  location: { name: "", slug: "", propertyType: "", addressLine1: "", city: "", stateProvince: "", postalCode: "", country: "", timezone: "UTC" },
  owner: { firstName: "", lastName: "", email: "" },
  router: { name: "", serialNumber: "", macAddress: "", model: "" },
  planId: "",
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProvisioned?: (locationId: string) => void;
}

interface BackendPlan {
  id: string;
  name: string;
  plan_type: string;
  base_price: string;
  currency: string;
}

export function PlatformLocationWizard({ open, onOpenChange, onProvisioned }: Props) {
  const [step, setStep] = useState(0);
  const [state, setState] = useState<WizardState>(DEFAULT_STATE);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [result, setResult] = useState<ProvisionLocationResult | null>(null);
  const provision = useProvisionLocation();

  const orgs = useQuery({
    queryKey: ["locations", "org-options"],
    queryFn: () => locationService.organizations(),
    enabled: open,
  });
  const plans = useQuery({
    queryKey: ["billing", "plans", "active"],
    queryFn: async () => {
      const { data } = await api.get<{ items: BackendPlan[] }>("/plans", { params: { is_active: true } });
      return data.items;
    },
    enabled: open,
  });

  function reset() {
    setStep(0);
    setState(DEFAULT_STATE);
    setErrors({});
    setResult(null);
  }

  function set<K extends keyof WizardState>(k: K, v: WizardState[K]) {
    setState((s) => ({ ...s, [k]: v }));
  }

  function validateStep(): boolean {
    const e: Record<string, string> = {};
    if (step === 0) {
      if (state.org.mode === "existing") {
        if (!state.org.existingId) e.org = "Select an organization";
      } else {
        if (!state.org.name.trim()) e["org.name"] = "Required";
        if (!state.org.slug.trim()) e["org.slug"] = "Required";
        if (!z.string().email().safeParse(state.org.contactEmail).success) e["org.contactEmail"] = "Invalid email";
      }
    } else if (step === 1) {
      (["name", "slug", "addressLine1", "city", "stateProvince", "postalCode", "country"] as const).forEach((k) => {
        if (!state.location[k].trim()) e[`location.${k}`] = "Required";
      });
    } else if (step === 2) {
      if (!state.owner.firstName.trim()) e["owner.firstName"] = "Required";
      if (!state.owner.lastName.trim()) e["owner.lastName"] = "Required";
      if (!z.string().email().safeParse(state.owner.email).success) e["owner.email"] = "Invalid email";
    } else if (step === 3) {
      (["name", "serialNumber", "macAddress", "model"] as const).forEach((k) => {
        if (!state.router[k].trim()) e[`router.${k}`] = "Required";
      });
    } else if (step === 4) {
      if (!state.planId) e.planId = "Select a plan";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function next() {
    if (!validateStep()) {
      toast.error("Please fix the highlighted fields");
      return;
    }
    setStep((s) => Math.min(STEPS.length, s + 1));
  }
  function back() {
    setStep((s) => Math.max(0, s - 1));
  }

  async function runProvision() {
    const payload: ProvisionLocationPayload = {
      existingOrganizationId: state.org.mode === "existing" ? state.org.existingId : undefined,
      newOrganization:
        state.org.mode === "new"
          ? { name: state.org.name, slug: state.org.slug, contactEmail: state.org.contactEmail }
          : undefined,
      location: {
        name: state.location.name,
        slug: state.location.slug,
        propertyType: state.location.propertyType || undefined,
        addressLine1: state.location.addressLine1,
        city: state.location.city,
        stateProvince: state.location.stateProvince,
        postalCode: state.location.postalCode,
        country: state.location.country,
        timezone: state.location.timezone,
      },
      owner: state.owner,
      router: state.router,
      planId: state.planId,
    };
    try {
      const r = await provision.mutateAsync(payload);
      setResult(r);
      toast.success(`${r.locationName} provisioned`);
      onProvisioned?.(r.locationId);
    } catch (err) {
      toast.error((err as unknown as AppError).message || "Provisioning failed");
    }
  }

  const orgOptions = orgs.data ?? [];
  const planOptions = plans.data ?? [];

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="max-w-5xl gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-border/70 px-6 py-4">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Smart location provisioning
          </DialogTitle>
          <DialogDescription>
            Creates an organization (or reuses one), a location, its owner account, and its first router in one transaction.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-0 md:grid-cols-[240px_1fr]">
          <aside className="hidden max-h-[70vh] overflow-y-auto border-r border-border/70 bg-muted/30 p-3 md:block">
            <ol className="space-y-1">
              {STEPS.map((s, i) => {
                const done = i < step;
                const active = i === step;
                const Icon = s.icon;
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
                      <div className={cn(
                        "mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full border text-xs font-medium",
                        done && "border-primary bg-primary text-primary-foreground",
                        active && "border-primary text-primary",
                        !done && !active && "border-border text-muted-foreground",
                      )}>
                        {done ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
                      </div>
                      <div>
                        <div className={cn("text-sm font-medium", !active && !done && "text-muted-foreground")}>{i + 1}. {s.title}</div>
                        <div className="text-xs text-muted-foreground">{s.desc}</div>
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
                  <OrgStep state={state.org} setState={(v) => set("org", v)} orgs={orgOptions} errors={errors} />
                )}
                {step === 1 && (
                  <LocationStep state={state.location} setState={(v) => set("location", v)} errors={errors} />
                )}
                {step === 2 && (
                  <OwnerStep state={state.owner} setState={(v) => set("owner", v)} errors={errors} />
                )}
                {step === 3 && (
                  <RouterStep state={state.router} setState={(v) => set("router", v)} errors={errors} />
                )}
                {step === 4 && (
                  <PlanStep value={state.planId} onChange={(v) => set("planId", v)} plans={planOptions} loading={plans.isLoading} error={errors.planId} />
                )}
                {step === 5 && (
                  <ReviewStep state={state} orgs={orgOptions} plans={planOptions} result={result} provisioning={provision.isPending} />
                )}
              </div>
            </ScrollArea>

            <div className="flex items-center justify-between border-t border-border/70 bg-muted/20 px-6 py-3">
              <div className="text-xs text-muted-foreground">Step {Math.min(step + 1, STEPS.length)} of {STEPS.length}</div>
              <div className="flex gap-2">
                {step > 0 && !result && (
                  <Button variant="ghost" size="sm" onClick={back} disabled={provision.isPending}>
                    <ChevronLeft className="h-4 w-4" /> Back
                  </Button>
                )}
                {step < STEPS.length - 1 && (
                  <Button size="sm" onClick={next}>
                    Continue <ChevronRight className="h-4 w-4" />
                  </Button>
                )}
                {step === STEPS.length - 1 && !result && (
                  <Button size="sm" onClick={runProvision} disabled={provision.isPending}>
                    Provision location <Sparkles className="h-4 w-4" />
                  </Button>
                )}
                {result && (
                  <Button size="sm" onClick={() => onOpenChange(false)}>Done</Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function StepHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function ErrorText({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="mt-1 text-xs text-destructive">{msg}</p>;
}

function ModeCard({ value, title, desc }: { value: string; title: string; desc: string }) {
  return (
    <label htmlFor={`mode-${value}`} className="flex cursor-pointer items-start gap-3 rounded-xl border p-3 has-[:checked]:border-primary has-[:checked]:bg-primary/5">
      <RadioGroupItem id={`mode-${value}`} value={value} className="mt-1" />
      <div>
        <div className="text-sm font-medium">{title}</div>
        <div className="text-xs text-muted-foreground">{desc}</div>
      </div>
    </label>
  );
}

function OrgStep({
  state, setState, orgs, errors,
}: {
  state: WizardState["org"];
  setState: (v: WizardState["org"]) => void;
  orgs: Array<{ id: string; name: string }>;
  errors: Record<string, string>;
}) {
  return (
    <div>
      <StepHeader title="Select or create organization" description="Provision under an existing organization, or create a new one." />
      <RadioGroup value={state.mode} onValueChange={(v) => setState({ ...state, mode: v as "existing" | "new" })} className="grid grid-cols-2 gap-3">
        <ModeCard value="existing" title="Existing organization" desc="Add this location to an org you manage." />
        <ModeCard value="new" title="New organization" desc="Onboard a brand-new customer." />
      </RadioGroup>
      <Separator className="my-4" />
      {state.mode === "existing" ? (
        <div className="space-y-2">
          <Label>Organization</Label>
          <Select value={state.existingId} onValueChange={(v) => setState({ ...state, existingId: v })}>
            <SelectTrigger><SelectValue placeholder="Select an organization…" /></SelectTrigger>
            <SelectContent>
              {orgs.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <ErrorText msg={errors.org} />
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <Label>Organization name</Label>
            <Input value={state.name} onChange={(e) => setState({ ...state, name: e.target.value })} placeholder="Acme Hospitality" />
            <ErrorText msg={errors["org.name"]} />
          </div>
          <div>
            <Label>Slug</Label>
            <Input value={state.slug} onChange={(e) => setState({ ...state, slug: e.target.value })} placeholder="acme-hospitality" />
            <ErrorText msg={errors["org.slug"]} />
          </div>
          <div className="md:col-span-2">
            <Label>Contact email</Label>
            <Input type="email" value={state.contactEmail} onChange={(e) => setState({ ...state, contactEmail: e.target.value })} placeholder="ops@acme.example.com" />
            <ErrorText msg={errors["org.contactEmail"]} />
          </div>
        </div>
      )}
    </div>
  );
}

function LocationStep({
  state, setState, errors,
}: {
  state: WizardState["location"];
  setState: (v: WizardState["location"]) => void;
  errors: Record<string, string>;
}) {
  const upd = <K extends keyof WizardState["location"]>(k: K, v: WizardState["location"][K]) => setState({ ...state, [k]: v });
  return (
    <div>
      <StepHeader title="Location details" description="Name, property type and address for the physical site." />
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <Label>Location name</Label>
          <Input value={state.name} onChange={(e) => upd("name", e.target.value)} placeholder="Downtown Branch" />
          <ErrorText msg={errors["location.name"]} />
        </div>
        <div>
          <Label>Slug</Label>
          <Input value={state.slug} onChange={(e) => upd("slug", e.target.value)} placeholder="downtown-branch" />
          <ErrorText msg={errors["location.slug"]} />
        </div>
        <div>
          <Label>Property type (optional)</Label>
          <Select value={state.propertyType} onValueChange={(v) => upd("propertyType", v as PropertyType)}>
            <SelectTrigger><SelectValue placeholder="Select property type" /></SelectTrigger>
            <SelectContent>
              {(Object.keys(PROPERTY_TYPE_LABEL) as PropertyType[]).map((t) => (
                <SelectItem key={t} value={t}>{PROPERTY_TYPE_LABEL[t]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Country</Label>
          <Select value={state.country} onValueChange={(v) => upd("country", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{COUNTRIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
          <ErrorText msg={errors["location.country"]} />
        </div>
        <div>
          <Label>State / Region</Label>
          <Input value={state.stateProvince} onChange={(e) => upd("stateProvince", e.target.value)} />
          <ErrorText msg={errors["location.stateProvince"]} />
        </div>
        <div>
          <Label>City</Label>
          <Input value={state.city} onChange={(e) => upd("city", e.target.value)} />
          <ErrorText msg={errors["location.city"]} />
        </div>
        <div>
          <Label>Postal code</Label>
          <Input value={state.postalCode} onChange={(e) => upd("postalCode", e.target.value)} />
          <ErrorText msg={errors["location.postalCode"]} />
        </div>
        <div>
          <Label>Timezone</Label>
          <Select value={state.timezone} onValueChange={(v) => upd("timezone", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{TIMEZONES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="md:col-span-2">
          <Label>Address</Label>
          <Input value={state.addressLine1} onChange={(e) => upd("addressLine1", e.target.value)} />
          <ErrorText msg={errors["location.addressLine1"]} />
        </div>
      </div>
    </div>
  );
}

function OwnerStep({
  state, setState, errors,
}: {
  state: WizardState["owner"];
  setState: (v: WizardState["owner"]) => void;
  errors: Record<string, string>;
}) {
  return (
    <div>
      <StepHeader title="Location owner" description="A new user account is created and granted the Organization Owner role. A temporary password is generated server-side and shown once, at the end." />
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <Label>First name</Label>
          <Input value={state.firstName} onChange={(e) => setState({ ...state, firstName: e.target.value })} />
          <ErrorText msg={errors["owner.firstName"]} />
        </div>
        <div>
          <Label>Last name</Label>
          <Input value={state.lastName} onChange={(e) => setState({ ...state, lastName: e.target.value })} />
          <ErrorText msg={errors["owner.lastName"]} />
        </div>
        <div className="md:col-span-2">
          <Label>Email</Label>
          <Input type="email" value={state.email} onChange={(e) => setState({ ...state, email: e.target.value })} />
          <ErrorText msg={errors["owner.email"]} />
        </div>
      </div>
    </div>
  );
}

function RouterStep({
  state, setState, errors,
}: {
  state: WizardState["router"];
  setState: (v: WizardState["router"]) => void;
  errors: Record<string, string>;
}) {
  return (
    <div>
      <StepHeader title="First router" description="Every location needs at least one router enrolled at provisioning time." />
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <Label>Router name</Label>
          <Input value={state.name} onChange={(e) => setState({ ...state, name: e.target.value })} placeholder="Lobby Router" />
          <ErrorText msg={errors["router.name"]} />
        </div>
        <div>
          <Label>Model</Label>
          <Input value={state.model} onChange={(e) => setState({ ...state, model: e.target.value })} placeholder="RB5009UG+S+" />
          <ErrorText msg={errors["router.model"]} />
        </div>
        <div>
          <Label>Serial number</Label>
          <Input value={state.serialNumber} onChange={(e) => setState({ ...state, serialNumber: e.target.value })} className="font-mono" />
          <ErrorText msg={errors["router.serialNumber"]} />
        </div>
        <div>
          <Label>MAC address</Label>
          <Input value={state.macAddress} onChange={(e) => setState({ ...state, macAddress: e.target.value })} placeholder="AA:BB:CC:DD:EE:01" className="font-mono" />
          <ErrorText msg={errors["router.macAddress"]} />
        </div>
      </div>
    </div>
  );
}

function PlanStep({
  value, onChange, plans, loading, error,
}: {
  value: string;
  onChange: (v: string) => void;
  plans: BackendPlan[];
  loading: boolean;
  error?: string;
}) {
  return (
    <div>
      <StepHeader title="Assign plan" description="Sets the subscription plan and its feature limits for this organization." />
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading plans…</p>
      ) : plans.length === 0 ? (
        <p className="text-sm text-muted-foreground">No active plans found.</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {plans.map((p) => {
            const active = value === p.id;
            return (
              <button
                type="button"
                key={p.id}
                onClick={() => onChange(p.id)}
                className={cn(
                  "rounded-xl border p-4 text-left transition-all",
                  active ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary/40" : "border-border hover:border-primary/40",
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="text-base font-semibold">{p.name}</div>
                  {active && <Check className="h-4 w-4 text-primary" />}
                </div>
                <div className="mt-1 text-sm text-muted-foreground">{p.currency} {p.base_price}</div>
                <Badge variant="secondary" className="mt-2 capitalize">{p.plan_type}</Badge>
              </button>
            );
          })}
        </div>
      )}
      <ErrorText msg={error} />
    </div>
  );
}

function ReviewStep({
  state, orgs, plans, result, provisioning,
}: {
  state: WizardState;
  orgs: Array<{ id: string; name: string }>;
  plans: BackendPlan[];
  result: ProvisionLocationResult | null;
  provisioning: boolean;
}) {
  const orgLabel = state.org.mode === "existing" ? orgs.find((o) => o.id === state.org.existingId)?.name ?? "—" : state.org.name || "New organization";
  const planLabel = plans.find((p) => p.id === state.planId)?.name ?? "—";

  if (result) {
    return (
      <div>
        <StepHeader title="Location provisioned" description="This temporary password is shown once — copy it now." />
        <Card className="border-primary/40 bg-primary/5">
          <CardContent className="space-y-3 p-4">
            <SummaryRow label="Organization" value={result.organizationName} />
            <SummaryRow label="Location" value={`${result.locationName} (${result.locationCode})`} />
            <SummaryRow label="Router" value={result.routerName} />
            <SummaryRow label="Plan" value={result.planName} />
            <SummaryRow label="Owner" value={`${result.ownerName} · ${result.ownerEmail}`} />
            <div className="flex items-center justify-between rounded-lg bg-background/70 px-3 py-2">
              <span className="text-xs text-muted-foreground">Username</span>
              <code className="text-sm">{result.ownerUsername}</code>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-background/70 px-3 py-2">
              <span className="text-xs text-muted-foreground">Temporary password</span>
              <div className="flex items-center gap-2">
                <code className="text-sm">{result.ownerTemporaryPassword}</code>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    navigator.clipboard.writeText(result.ownerTemporaryPassword);
                    toast.success("Copied");
                  }}
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <StepHeader title="Review & confirm" description="Verify every decision before provisioning." />
      <div className="grid gap-3 md:grid-cols-2">
        <SummaryRow label="Organization" value={orgLabel} />
        <SummaryRow label="Location" value={state.location.name || "—"} />
        <SummaryRow label="Property" value={`${state.location.propertyType ? PROPERTY_TYPE_LABEL[state.location.propertyType] : "—"} · ${state.location.city}, ${state.location.country}`} />
        <SummaryRow label="Owner" value={`${state.owner.firstName} ${state.owner.lastName} · ${state.owner.email}`} />
        <SummaryRow label="Router" value={`${state.router.name} (${state.router.model})`} />
        <SummaryRow label="Plan" value={planLabel} />
      </div>
      {provisioning && <p className="mt-4 text-sm text-muted-foreground">Provisioning…</p>}
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/20 px-3 py-2">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm font-medium">{value}</div>
    </div>
  );
}
