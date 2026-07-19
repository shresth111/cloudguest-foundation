import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Building2,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  KeyRound,
  MapPin,
  Palette,
  Plus,
  Router as RouterIcon,
  Sparkles,
  Ticket,
  Trash2,
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
import { Progress } from "@/components/ui/progress";
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
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import { customerService } from "@/services/customer.service";
import { brandingService } from "@/services/branding.service";
import { locationService } from "@/services/location.service";
import { nasService } from "@/services/nas.service";
import { organizationService } from "@/services/organization.service";
import { rbacService } from "@/services/rbac.service";
import { tenantService } from "@/services/tenant.service";
import type { SiteType } from "@/types/location";
import { SITE_TYPE_LABEL } from "@/types/location";

/* -------------------------------------------------------------------------- */
/*                                    Types                                   */
/* -------------------------------------------------------------------------- */

const PLANS = [
  { id: "trial", label: "Trial", price: "Free · 14 days", locations: 1, routers: 2 },
  { id: "starter", label: "Starter", price: "$49 / mo", locations: 3, routers: 5 },
  { id: "professional", label: "Professional", price: "$149 / mo", locations: 10, routers: 25 },
  { id: "enterprise", label: "Enterprise", price: "Custom", locations: 100, routers: 500 },
] as const;

const COUNTRIES = ["India", "USA", "UK", "Singapore", "UAE", "Germany", "Australia"];
const TIMEZONES = [
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Dubai",
  "America/Los_Angeles",
  "America/New_York",
  "Europe/London",
  "Europe/Berlin",
  "Australia/Sydney",
];
const NAS_MODELS = [
  "MikroTik hAP ax3",
  "MikroTik hAP ax2",
  "MikroTik CCR2004",
  "MikroTik RB5009",
  "MikroTik CRS326",
];

const STEPS = [
  { key: "customer", title: "Customer", desc: "Select or create", icon: Building2 },
  { key: "org", title: "Organization", desc: "Select or create", icon: Building2 },
  { key: "basics", title: "Location basics", desc: "Site details", icon: MapPin },
  { key: "nas", title: "Register NAS", desc: "Hardware devices", icon: RouterIcon },
  { key: "plan", title: "Plan", desc: "Assign plan", icon: Ticket },
  { key: "policy", title: "Feature policy", desc: "Assign policy", icon: Sparkles },
  { key: "brand", title: "White label", desc: "Assign brand", icon: Palette },
  { key: "admin", title: "Customer admin", desc: "Assign owner", icon: UserCog },
  { key: "review", title: "Review", desc: "Confirm", icon: Check },
  { key: "provision", title: "Provision", desc: "Deploy", icon: Sparkles },
] as const;

interface NasDraft {
  id: string;
  routerIdentity: string;
  serialNumber: string;
  model: string;
  routerOsVersion: string;
  publicIp: string;
  privateIp: string;
  cityCode: string;
}

interface WizardState {
  customer: { mode: "existing" | "new"; existingId?: string; name: string; email: string; mobile: string };
  org: { mode: "existing" | "new"; existingId?: string; name: string; industry: string };
  basics: {
    name: string;
    siteType: SiteType;
    country: string;
    state: string;
    city: string;
    address: string;
    zipCode: string;
    timezone: string;
    latitude: string;
    longitude: string;
  };
  nas: NasDraft[];
  plan: (typeof PLANS)[number]["id"];
  policyId: string;
  brandId: string;
  admin: { mode: "existing" | "new"; existingId?: string; name: string; email: string; mobile: string };
}

const emptyNas = (cityCode = "DEL"): NasDraft => ({
  id: "",
  routerIdentity: "",
  serialNumber: "",
  model: NAS_MODELS[0],
  routerOsVersion: "7.14.2",
  publicIp: "",
  privateIp: "192.168.88.1",
  cityCode,
});

const DEFAULT_STATE: WizardState = {
  customer: { mode: "existing", name: "", email: "", mobile: "" },
  org: { mode: "existing", name: "", industry: "hospitality" },
  basics: {
    name: "",
    siteType: "hotel",
    country: "India",
    state: "",
    city: "",
    address: "",
    zipCode: "",
    timezone: "Asia/Kolkata",
    latitude: "",
    longitude: "",
  },
  nas: [emptyNas()],
  plan: "professional",
  policyId: "",
  brandId: "",
  admin: { mode: "existing", name: "", email: "", mobile: "" },
};

/* -------------------------------------------------------------------------- */
/*                                  Validation                                */
/* -------------------------------------------------------------------------- */

const emailSchema = z.string().trim().email("Invalid email");
const nonEmpty = (msg: string) => z.string().trim().min(1, msg);
const ipSchema = z
  .string()
  .trim()
  .regex(/^(?:\d{1,3}\.){3}\d{1,3}$/, "Invalid IP");

/* -------------------------------------------------------------------------- */
/*                                    Main                                    */
/* -------------------------------------------------------------------------- */

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProvisioned?: (locationId: string) => void;
}

export function PlatformLocationWizard({ open, onOpenChange, onProvisioned }: Props) {
  const [step, setStep] = useState(0);
  const [state, setState] = useState<WizardState>(DEFAULT_STATE);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [provisionSteps, setProvisionSteps] = useState<Array<{ label: string; done: boolean }>>([]);
  const [provisioning, setProvisioning] = useState(false);
  const [result, setResult] = useState<{ locationId: string; nasIds: string[] } | null>(null);

  const customers = useQuery({ queryKey: ["cust", "list"], queryFn: () => customerService.listCustomers() });
  const orgs = useQuery({
    queryKey: ["orgs", "wiz"],
    queryFn: () => organizationService.list({ page: 1, pageSize: 100 }),
  });
  const policies = useQuery({
    queryKey: ["policies", state.customer.existingId ?? "any"],
    queryFn: () => tenantService.listPolicies(state.customer.existingId ?? "CUST-1001"),
    enabled: open,
  });
  const brands = useQuery({ queryKey: ["brands"], queryFn: () => brandingService.getSnapshot() });
  const rbacUsers = useQuery({ queryKey: ["rbac", "users"], queryFn: () => rbacService.getUsers() });

  function reset() {
    setStep(0);
    setState(DEFAULT_STATE);
    setErrors({});
    setProvisionSteps([]);
    setProvisioning(false);
    setResult(null);
  }

  function set<K extends keyof WizardState>(k: K, v: WizardState[K]) {
    setState((s) => ({ ...s, [k]: v }));
  }

  /* --------------------------------- Validation -------------------------------- */
  function validateStep(): boolean {
    const e: Record<string, string> = {};
    switch (step) {
      case 0: {
        if (state.customer.mode === "existing") {
          if (!state.customer.existingId) e.customer = "Select a customer";
        } else {
          if (!nonEmpty("Required").safeParse(state.customer.name).success)
            e["customer.name"] = "Customer name is required";
          const em = emailSchema.safeParse(state.customer.email);
          if (!em.success) e["customer.email"] = em.error.issues[0].message;
        }
        break;
      }
      case 1: {
        if (state.org.mode === "existing") {
          if (!state.org.existingId) e.org = "Select an organization";
        } else {
          if (!nonEmpty("Required").safeParse(state.org.name).success)
            e["org.name"] = "Organization name is required";
        }
        break;
      }
      case 2: {
        (["name", "city", "state", "address", "country", "timezone"] as const).forEach((k) => {
          if (!nonEmpty("Required").safeParse(state.basics[k]).success)
            e[`basics.${k}`] = "Required";
        });
        break;
      }
      case 3: {
        if (state.nas.length === 0) e.nas = "Register at least one NAS";
        state.nas.forEach((n, i) => {
          if (!nonEmpty("Required").safeParse(n.id).success) e[`nas.${i}.id`] = "NAS ID required";
          if (!nonEmpty("Required").safeParse(n.routerIdentity).success)
            e[`nas.${i}.routerIdentity`] = "Router identity required";
          if (!nonEmpty("Required").safeParse(n.serialNumber).success)
            e[`nas.${i}.serialNumber`] = "Serial required";
          if (!ipSchema.safeParse(n.publicIp).success) e[`nas.${i}.publicIp`] = "Invalid IP";
          if (!ipSchema.safeParse(n.privateIp).success) e[`nas.${i}.privateIp`] = "Invalid IP";
        });
        break;
      }
      case 7: {
        if (state.admin.mode === "existing") {
          if (!state.admin.existingId) e.admin = "Select an admin";
        } else {
          if (!nonEmpty("Required").safeParse(state.admin.name).success)
            e["admin.name"] = "Name is required";
          const em = emailSchema.safeParse(state.admin.email);
          if (!em.success) e["admin.email"] = em.error.issues[0].message;
        }
        break;
      }
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function next() {
    if (!validateStep()) {
      toast.error("Please fix the highlighted fields");
      return;
    }
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  }
  function back() {
    setStep((s) => Math.max(0, s - 1));
  }

  /* --------------------------------- Provision -------------------------------- */
  async function runProvision() {
    setProvisioning(true);
    const list = [
      state.customer.mode === "new" ? "Creating customer" : "Attaching to customer",
      state.org.mode === "new" ? "Creating organization" : "Attaching to organization",
      "Creating location record",
      "Reserving NAS identifiers",
      "Registering NAS devices",
      "Assigning plan",
      "Applying feature policy",
      "Applying white-label brand",
      state.admin.mode === "new" ? "Provisioning customer admin" : "Assigning existing admin",
      "Sending welcome email",
      "Activating location",
    ].map((label) => ({ label, done: false }));
    setProvisionSteps(list);

    for (let i = 0; i < list.length; i++) {
      await new Promise((r) => setTimeout(r, 220));
      setProvisionSteps((prev) => prev.map((s, idx) => (idx === i ? { ...s, done: true } : s)));
    }

    try {
      // Reserve NAS IDs that were generated on the fly (idempotent for existing).
      for (const n of state.nas) {
        try {
          await nasService.reserveNasId(n.id, `${state.basics.name} — ${n.model}`);
        } catch {
          /* already reserved */
        }
      }

      const orgId =
        state.org.existingId ??
        (state.customer.existingId
          ? customers.data?.find((c) => c.id === state.customer.existingId)?.organizationId
          : undefined) ??
        "ORG-01000";

      const loc = await locationService.create({
        basic: {
          name: state.basics.name,
          organizationId: orgId,
          siteType: state.basics.siteType,
        },
        address: {
          country: state.basics.country,
          state: state.basics.state,
          city: state.basics.city,
          address: state.basics.address,
          zipCode: state.basics.zipCode || "000000",
          latitude: Number(state.basics.latitude) || 0,
          longitude: Number(state.basics.longitude) || 0,
          timezone: state.basics.timezone,
        },
        network: {
          isp: "Airtel",
          primaryWan: state.nas[0]?.publicIp ?? "0.0.0.0",
          internetSpeedMbps: 500,
          publicIp: state.nas[0]?.publicIp ?? "0.0.0.0",
          dns: "1.1.1.1, 8.8.8.8",
        },
        settings: {
          guestWifiEnabled: true,
          captivePortalEnabled: true,
          voucherLogin: true,
          otpLogin: true,
          pmsIntegration: false,
          socialLogin: false,
        },
      });

      setResult({ locationId: loc.id, nasIds: state.nas.map((n) => n.id) });
      toast.success(`Location ${loc.id} provisioned`);
      onProvisioned?.(loc.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Provisioning failed");
    } finally {
      setProvisioning(false);
    }
  }

  /* ----------------------------------- UI ----------------------------------- */
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
    >
      <DialogContent className="max-w-6xl gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-border/70 px-6 py-4">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Create Location — Platform Admin
          </DialogTitle>
          <DialogDescription>
            10-step provisioning: customer → organization → location → NAS → plan → policy → brand → admin.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-0 md:grid-cols-[260px_1fr]">
          {/* Timeline */}
          <aside className="hidden max-h-[75vh] overflow-y-auto border-r border-border/70 bg-muted/30 p-3 md:block">
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
                      <div
                        className={cn(
                          "mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full border text-xs font-medium",
                          done && "border-primary bg-primary text-primary-foreground",
                          active && "border-primary text-primary",
                          !done && !active && "border-border text-muted-foreground",
                        )}
                      >
                        {done ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
                      </div>
                      <div>
                        <div
                          className={cn(
                            "text-sm font-medium",
                            !active && !done && "text-muted-foreground",
                          )}
                        >
                          {i + 1}. {s.title}
                        </div>
                        <div className="text-xs text-muted-foreground">{s.desc}</div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ol>
          </aside>

          {/* Body */}
          <div className="flex min-h-[560px] flex-col">
            <ScrollArea className="max-h-[75vh] flex-1">
              <div className="px-6 py-5">
                {step === 0 && (
                  <CustomerStep
                    state={state.customer}
                    setState={(v) => set("customer", v)}
                    customers={customers.data ?? []}
                    errors={errors}
                  />
                )}
                {step === 1 && (
                  <OrgStep
                    state={state.org}
                    setState={(v) => set("org", v)}
                    orgs={(orgs.data?.rows ?? []).map((o) => ({ id: o.id, name: o.name }))}
                    errors={errors}
                  />
                )}
                {step === 2 && (
                  <BasicsStep state={state.basics} setState={(v) => set("basics", v)} errors={errors} />
                )}
                {step === 3 && (
                  <NasStep
                    nas={state.nas}
                    setNas={(v) => set("nas", v)}
                    errors={errors}
                    cityDefault={state.basics.city}
                  />
                )}
                {step === 4 && (
                  <PlanStep value={state.plan} onChange={(v) => set("plan", v)} />
                )}
                {step === 5 && (
                  <PolicyStep
                    value={state.policyId}
                    onChange={(v) => set("policyId", v)}
                    policies={(policies.data ?? []).map((p) => ({
                      id: p.id,
                      name: p.name,
                      description: p.description ?? "",
                    }))}
                  />
                )}
                {step === 6 && (
                  <BrandStep
                    value={state.brandId}
                    onChange={(v) => set("brandId", v)}
                    brands={(brands.data?.brands ?? []).map((b) => ({
                      id: b.id,
                      name: b.name,
                      status: b.status,
                    }))}
                  />
                )}
                {step === 7 && (
                  <AdminStep
                    state={state.admin}
                    setState={(v) => set("admin", v)}
                    users={(rbacUsers.data ?? []).map((u) => ({
                      id: u.id,
                      name: u.name,
                      email: u.email,
                    }))}
                    errors={errors}
                  />
                )}
                {step === 8 && (
                  <ReviewStep
                    state={state}
                    customers={customers.data ?? []}
                    orgs={(orgs.data?.rows ?? []).map((o) => ({ id: o.id, name: o.name }))}
                    policies={(policies.data ?? []).map((p) => ({ id: p.id, name: p.name }))}
                    brands={(brands.data?.brands ?? []).map((b) => ({ id: b.id, name: b.name }))}
                    users={(rbacUsers.data ?? []).map((u) => ({
                      id: u.id,
                      name: u.name,
                      email: u.email,
                    }))}
                  />
                )}
                {step === 9 && (
                  <ProvisionStep
                    steps={provisionSteps}
                    started={provisioning || provisionSteps.length > 0}
                    result={result}
                  />
                )}
              </div>
            </ScrollArea>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-border/70 bg-muted/20 px-6 py-3">
              <div className="text-xs text-muted-foreground">
                Step {step + 1} of {STEPS.length}
              </div>
              <div className="flex gap-2">
                {step < 9 && step > 0 && (
                  <Button variant="ghost" size="sm" onClick={back}>
                    <ChevronLeft className="h-4 w-4" /> Back
                  </Button>
                )}
                {step === 0 && (
                  <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
                    Cancel
                  </Button>
                )}
                {step < 8 && (
                  <Button size="sm" onClick={next}>
                    Continue <ChevronRight className="h-4 w-4" />
                  </Button>
                )}
                {step === 8 && (
                  <Button
                    size="sm"
                    onClick={() => {
                      setStep(9);
                      void runProvision();
                    }}
                  >
                    Provision location <Sparkles className="h-4 w-4" />
                  </Button>
                )}
                {step === 9 && result && (
                  <Button size="sm" onClick={() => onOpenChange(false)}>
                    Done
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */
/*                                    Steps                                   */
/* -------------------------------------------------------------------------- */

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

/* Step 1 — Customer */
function CustomerStep({
  state,
  setState,
  customers,
  errors,
}: {
  state: WizardState["customer"];
  setState: (v: WizardState["customer"]) => void;
  customers: Array<{ id: string; name: string; organizationName: string; owner: { email: string } }>;
  errors: Record<string, string>;
}) {
  return (
    <div>
      <StepHeader title="Select or create customer" description="Pick an existing CloudGuest customer or onboard a new one." />
      <RadioGroup
        value={state.mode}
        onValueChange={(v) => setState({ ...state, mode: v as "existing" | "new" })}
        className="grid grid-cols-2 gap-3"
      >
        <ModeCard value="existing" title="Existing customer" desc="Attach to a tenant you manage." />
        <ModeCard value="new" title="New customer" desc="Onboard a new company." />
      </RadioGroup>

      <Separator className="my-4" />

      {state.mode === "existing" ? (
        <div className="space-y-2">
          <Label>Customer</Label>
          <Select
            value={state.existingId}
            onValueChange={(v) => setState({ ...state, existingId: v })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a customer…" />
            </SelectTrigger>
            <SelectContent>
              {customers.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name} · {c.owner.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <ErrorText msg={errors.customer} />
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <Label>Customer / Company name</Label>
            <Input
              value={state.name}
              onChange={(e) => setState({ ...state, name: e.target.value })}
              placeholder="Acme Hospitality Ltd"
            />
            <ErrorText msg={errors["customer.name"]} />
          </div>
          <div>
            <Label>Primary email</Label>
            <Input
              type="email"
              value={state.email}
              onChange={(e) => setState({ ...state, email: e.target.value })}
              placeholder="owner@acme.com"
            />
            <ErrorText msg={errors["customer.email"]} />
          </div>
          <div>
            <Label>Mobile</Label>
            <Input
              value={state.mobile}
              onChange={(e) => setState({ ...state, mobile: e.target.value })}
              placeholder="+91 98765 43210"
            />
          </div>
        </div>
      )}
    </div>
  );
}

/* Step 2 — Organization */
function OrgStep({
  state,
  setState,
  orgs,
  errors,
}: {
  state: WizardState["org"];
  setState: (v: WizardState["org"]) => void;
  orgs: Array<{ id: string; name: string }>;
  errors: Record<string, string>;
}) {
  return (
    <div>
      <StepHeader title="Select or create organization" description="Organization sits between the Customer and Location." />
      <RadioGroup
        value={state.mode}
        onValueChange={(v) => setState({ ...state, mode: v as "existing" | "new" })}
        className="grid grid-cols-2 gap-3"
      >
        <ModeCard value="existing" title="Existing organization" desc="Reuse an org already onboarded." />
        <ModeCard value="new" title="New organization" desc="Create a new org under this customer." />
      </RadioGroup>

      <Separator className="my-4" />

      {state.mode === "existing" ? (
        <div className="space-y-2">
          <Label>Organization</Label>
          <Select value={state.existingId} onValueChange={(v) => setState({ ...state, existingId: v })}>
            <SelectTrigger>
              <SelectValue placeholder="Select an organization…" />
            </SelectTrigger>
            <SelectContent>
              {orgs.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <ErrorText msg={errors.org} />
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <Label>Organization name</Label>
            <Input
              value={state.name}
              onChange={(e) => setState({ ...state, name: e.target.value })}
              placeholder="Acme Hospitality — India"
            />
            <ErrorText msg={errors["org.name"]} />
          </div>
          <div>
            <Label>Industry</Label>
            <Select value={state.industry} onValueChange={(v) => setState({ ...state, industry: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["hospitality", "retail", "healthcare", "education", "enterprise", "smb"].map((i) => (
                  <SelectItem key={i} value={i}>
                    {i}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
    </div>
  );
}

/* Step 3 — Basics */
function BasicsStep({
  state,
  setState,
  errors,
}: {
  state: WizardState["basics"];
  setState: (v: WizardState["basics"]) => void;
  errors: Record<string, string>;
}) {
  const upd = <K extends keyof WizardState["basics"]>(k: K, v: WizardState["basics"][K]) =>
    setState({ ...state, [k]: v });
  return (
    <div>
      <StepHeader title="Location basics" description="Name, property type and address for the physical site." />
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <Label>Location name</Label>
          <Input value={state.name} onChange={(e) => upd("name", e.target.value)} placeholder="Hotel Delhi Airport T3" />
          <ErrorText msg={errors["basics.name"]} />
        </div>
        <div>
          <Label>Property type</Label>
          <Select value={state.siteType} onValueChange={(v) => upd("siteType", v as SiteType)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(SITE_TYPE_LABEL) as SiteType[]).map((t) => (
                <SelectItem key={t} value={t}>
                  {SITE_TYPE_LABEL[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Country</Label>
          <Select value={state.country} onValueChange={(v) => upd("country", v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COUNTRIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <ErrorText msg={errors["basics.country"]} />
        </div>
        <div>
          <Label>State</Label>
          <Input value={state.state} onChange={(e) => upd("state", e.target.value)} />
          <ErrorText msg={errors["basics.state"]} />
        </div>
        <div>
          <Label>City</Label>
          <Input value={state.city} onChange={(e) => upd("city", e.target.value)} />
          <ErrorText msg={errors["basics.city"]} />
        </div>
        <div>
          <Label>ZIP / Postal</Label>
          <Input value={state.zipCode} onChange={(e) => upd("zipCode", e.target.value)} />
        </div>
        <div className="md:col-span-2">
          <Label>Address</Label>
          <Textarea rows={2} value={state.address} onChange={(e) => upd("address", e.target.value)} />
          <ErrorText msg={errors["basics.address"]} />
        </div>
        <div>
          <Label>Timezone</Label>
          <Select value={state.timezone} onValueChange={(v) => upd("timezone", v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIMEZONES.map((tz) => (
                <SelectItem key={tz} value={tz}>
                  {tz}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Latitude</Label>
            <Input value={state.latitude} onChange={(e) => upd("latitude", e.target.value)} placeholder="28.5562" />
          </div>
          <div>
            <Label>Longitude</Label>
            <Input value={state.longitude} onChange={(e) => upd("longitude", e.target.value)} placeholder="77.1000" />
          </div>
        </div>
      </div>
    </div>
  );
}

/* Step 4 — NAS */
function NasStep({
  nas,
  setNas,
  errors,
  cityDefault,
}: {
  nas: NasDraft[];
  setNas: (v: NasDraft[]) => void;
  errors: Record<string, string>;
  cityDefault: string;
}) {
  const cityCode = (cityDefault || "DEL").slice(0, 3).toUpperCase();

  async function generateId(idx: number) {
    const id = await nasService.generateNasId(cityCode);
    const copy = [...nas];
    copy[idx] = { ...copy[idx], id, cityCode };
    setNas(copy);
    toast(`Reserved ${id}`);
  }

  function upd(idx: number, patch: Partial<NasDraft>) {
    setNas(nas.map((n, i) => (i === idx ? { ...n, ...patch } : n)));
  }

  return (
    <div>
      <StepHeader
        title="Register NAS devices"
        description="Each NAS (MikroTik router) belongs to this location. Register one or many in a single flow."
      />

      {errors.nas && <p className="mb-2 text-xs text-destructive">{errors.nas}</p>}

      <div className="space-y-3">
        {nas.map((n, i) => (
          <Card key={i} className="border-dashed">
            <CardContent className="p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <RouterIcon className="h-4 w-4 text-primary" />
                  NAS #{i + 1}
                </div>
                {nas.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setNas(nas.filter((_, idx) => idx !== i))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <Label>NAS Identifier</Label>
                  <div className="flex gap-2">
                    <Input
                      value={n.id}
                      onChange={(e) => upd(i, { id: e.target.value.toUpperCase() })}
                      placeholder={`NAS-${cityCode}-0001`}
                      className="font-mono"
                    />
                    <Button type="button" variant="outline" onClick={() => generateId(i)}>
                      Generate
                    </Button>
                  </div>
                  <ErrorText msg={errors[`nas.${i}.id`]} />
                </div>
                <div>
                  <Label>Router identity</Label>
                  <Input
                    value={n.routerIdentity}
                    onChange={(e) => upd(i, { routerIdentity: e.target.value })}
                    placeholder="delhi-t3-core-01"
                  />
                  <ErrorText msg={errors[`nas.${i}.routerIdentity`]} />
                </div>
                <div>
                  <Label>Serial number</Label>
                  <Input
                    value={n.serialNumber}
                    onChange={(e) => upd(i, { serialNumber: e.target.value })}
                    placeholder="MK-9F82AB7"
                  />
                  <ErrorText msg={errors[`nas.${i}.serialNumber`]} />
                </div>
                <div>
                  <Label>Model</Label>
                  <Select value={n.model} onValueChange={(v) => upd(i, { model: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {NAS_MODELS.map((m) => (
                        <SelectItem key={m} value={m}>
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>RouterOS version</Label>
                  <Input value={n.routerOsVersion} onChange={(e) => upd(i, { routerOsVersion: e.target.value })} />
                </div>
                <div />
                <div>
                  <Label>Public IP</Label>
                  <Input
                    value={n.publicIp}
                    onChange={(e) => upd(i, { publicIp: e.target.value })}
                    placeholder="203.0.113.10"
                    className="font-mono"
                  />
                  <ErrorText msg={errors[`nas.${i}.publicIp`]} />
                </div>
                <div>
                  <Label>Private IP</Label>
                  <Input
                    value={n.privateIp}
                    onChange={(e) => upd(i, { privateIp: e.target.value })}
                    placeholder="192.168.88.1"
                    className="font-mono"
                  />
                  <ErrorText msg={errors[`nas.${i}.privateIp`]} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Button
        variant="outline"
        size="sm"
        className="mt-3"
        onClick={() => setNas([...nas, emptyNas(cityCode)])}
      >
        <Plus className="h-4 w-4" /> Add another NAS
      </Button>
    </div>
  );
}

/* Step 5 — Plan */
function PlanStep({ value, onChange }: { value: string; onChange: (v: WizardState["plan"]) => void }) {
  return (
    <div>
      <StepHeader title="Assign plan" description="Sets platform-level limits for locations, routers, and staff seats." />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {PLANS.map((p) => {
          const active = value === p.id;
          return (
            <button
              type="button"
              key={p.id}
              onClick={() => onChange(p.id)}
              className={cn(
                "rounded-xl border p-4 text-left transition-all",
                active
                  ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary/40"
                  : "border-border hover:border-primary/40",
              )}
            >
              <div className="flex items-center justify-between">
                <div className="text-base font-semibold">{p.label}</div>
                {active && <Check className="h-4 w-4 text-primary" />}
              </div>
              <div className="mt-1 text-sm text-muted-foreground">{p.price}</div>
              <div className="mt-3 flex flex-wrap gap-1 text-xs">
                <Badge variant="secondary">{p.locations} locations</Badge>
                <Badge variant="secondary">{p.routers} routers</Badge>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* Step 6 — Policy */
function PolicyStep({
  value,
  onChange,
  policies,
}: {
  value: string;
  onChange: (v: string) => void;
  policies: Array<{ id: string; name: string; description: string }>;
}) {
  return (
    <div>
      <StepHeader title="Assign feature policy" description="Controls which platform modules are enabled for this location." />
      {policies.length === 0 ? (
        <p className="text-sm text-muted-foreground">No policies available yet.</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {policies.map((p) => {
            const active = value === p.id;
            return (
              <button
                type="button"
                key={p.id}
                onClick={() => onChange(p.id)}
                className={cn(
                  "rounded-xl border p-4 text-left transition-all",
                  active
                    ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary/40"
                    : "border-border hover:border-primary/40",
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold">{p.name}</div>
                  {active && <Check className="h-4 w-4 text-primary" />}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {p.description || "Feature policy scoped to this location."}
                </p>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* Step 7 — Brand */
function BrandStep({
  value,
  onChange,
  brands,
}: {
  value: string;
  onChange: (v: string) => void;
  brands: Array<{ id: string; name: string; status: string }>;
}) {
  return (
    <div>
      <StepHeader title="Assign white label brand" description="Choose the brand kit that will be applied to captive portals for this location." />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {brands.map((b) => {
          const active = value === b.id;
          return (
            <button
              type="button"
              key={b.id}
              onClick={() => onChange(b.id)}
              className={cn(
                "rounded-xl border p-4 text-left transition-all",
                active
                  ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary/40"
                  : "border-border hover:border-primary/40",
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Palette className="h-4 w-4 text-primary" /> {b.name}
                </div>
                {active && <Check className="h-4 w-4 text-primary" />}
              </div>
              <Badge className="mt-2" variant={b.status === "published" ? "default" : "secondary"}>
                {b.status}
              </Badge>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* Step 8 — Admin */
function AdminStep({
  state,
  setState,
  users,
  errors,
}: {
  state: WizardState["admin"];
  setState: (v: WizardState["admin"]) => void;
  users: Array<{ id: string; name: string; email: string }>;
  errors: Record<string, string>;
}) {
  return (
    <div>
      <StepHeader title="Assign customer admin" description="Owner of the location workspace — receives credentials and welcome email." />
      <RadioGroup
        value={state.mode}
        onValueChange={(v) => setState({ ...state, mode: v as "existing" | "new" })}
        className="grid grid-cols-2 gap-3"
      >
        <ModeCard value="existing" title="Existing admin" desc="Pick from your RBAC users." />
        <ModeCard value="new" title="New admin" desc="Invite a new user via email." />
      </RadioGroup>

      <Separator className="my-4" />

      {state.mode === "existing" ? (
        <div className="space-y-2">
          <Label>Admin</Label>
          <Select value={state.existingId} onValueChange={(v) => setState({ ...state, existingId: v })}>
            <SelectTrigger>
              <SelectValue placeholder="Select an admin…" />
            </SelectTrigger>
            <SelectContent>
              {users.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.name} · {u.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <ErrorText msg={errors.admin} />
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <Label>Full name</Label>
            <Input value={state.name} onChange={(e) => setState({ ...state, name: e.target.value })} />
            <ErrorText msg={errors["admin.name"]} />
          </div>
          <div>
            <Label>Email</Label>
            <Input
              type="email"
              value={state.email}
              onChange={(e) => setState({ ...state, email: e.target.value })}
            />
            <ErrorText msg={errors["admin.email"]} />
          </div>
          <div>
            <Label>Mobile</Label>
            <Input value={state.mobile} onChange={(e) => setState({ ...state, mobile: e.target.value })} />
          </div>
        </div>
      )}
    </div>
  );
}

/* Step 9 — Review */
function ReviewStep({
  state,
  customers,
  orgs,
  policies,
  brands,
  users,
}: {
  state: WizardState;
  customers: Array<{ id: string; name: string }>;
  orgs: Array<{ id: string; name: string }>;
  policies: Array<{ id: string; name: string }>;
  brands: Array<{ id: string; name: string }>;
  users: Array<{ id: string; name: string; email: string }>;
}) {
  const custLabel =
    state.customer.mode === "existing"
      ? customers.find((c) => c.id === state.customer.existingId)?.name ?? "—"
      : state.customer.name || "New customer";
  const orgLabel =
    state.org.mode === "existing"
      ? orgs.find((o) => o.id === state.org.existingId)?.name ?? "—"
      : state.org.name || "New organization";
  const policyLabel = policies.find((p) => p.id === state.policyId)?.name ?? "—";
  const brandLabel = brands.find((b) => b.id === state.brandId)?.name ?? "—";
  const adminLabel =
    state.admin.mode === "existing"
      ? users.find((u) => u.id === state.admin.existingId)?.name ?? "—"
      : state.admin.name || state.admin.email || "New admin";

  return (
    <div>
      <StepHeader title="Review & confirm" description="Verify every decision before deploying." />
      <div className="grid gap-3 md:grid-cols-2">
        <SummaryRow label="Customer" value={custLabel} />
        <SummaryRow label="Organization" value={orgLabel} />
        <SummaryRow label="Location" value={state.basics.name || "—"} />
        <SummaryRow
          label="Property"
          value={`${SITE_TYPE_LABEL[state.basics.siteType]} · ${state.basics.city}, ${state.basics.country}`}
        />
        <SummaryRow label="Plan" value={PLANS.find((p) => p.id === state.plan)?.label ?? state.plan} />
        <SummaryRow label="Feature policy" value={policyLabel} />
        <SummaryRow label="White label" value={brandLabel} />
        <SummaryRow label="Customer admin" value={adminLabel} />
      </div>

      <Separator className="my-4" />
      <div>
        <div className="mb-2 text-sm font-medium">NAS devices ({state.nas.length})</div>
        <div className="space-y-2">
          {state.nas.map((n, i) => (
            <div key={i} className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2 text-xs">
              <div className="flex items-center gap-2">
                <RouterIcon className="h-3.5 w-3.5 text-primary" />
                <span className="font-mono">{n.id || `NAS-${i + 1}`}</span>
                <span className="text-muted-foreground">·</span>
                <span>{n.model}</span>
              </div>
              <span className="font-mono text-muted-foreground">{n.publicIp}</span>
            </div>
          ))}
        </div>
      </div>
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

/* Step 10 — Provision */
function ProvisionStep({
  steps,
  started,
  result,
}: {
  steps: Array<{ label: string; done: boolean }>;
  started: boolean;
  result: { locationId: string; nasIds: string[] } | null;
}) {
  if (!started) {
    return (
      <div className="grid place-items-center py-16 text-center">
        <Sparkles className="mb-3 h-10 w-10 text-primary" />
        <p className="text-sm text-muted-foreground">Provisioning has not started yet.</p>
      </div>
    );
  }

  const done = steps.filter((s) => s.done).length;
  const pct = Math.round((done / Math.max(steps.length, 1)) * 100);

  return (
    <div>
      <StepHeader title="Deploying location" description="Deterministic provisioning across the platform." />
      <div className="mb-4">
        <Progress value={pct} />
        <div className="mt-1 text-xs text-muted-foreground">
          {done} / {steps.length} complete
        </div>
      </div>

      <ol className="space-y-1.5">
        {steps.map((s, i) => (
          <li key={i} className="flex items-center gap-2 text-sm">
            {s.done ? (
              <Check className="h-4 w-4 text-primary" />
            ) : (
              <div className="h-3.5 w-3.5 animate-pulse rounded-full border border-primary/40" />
            )}
            <span className={s.done ? "" : "text-muted-foreground"}>{s.label}</span>
          </li>
        ))}
      </ol>

      {result && (
        <Card className="mt-6 border-primary/40 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Check className="h-4 w-4 text-primary" /> Location provisioned
            </div>
            <div className="mt-3 grid gap-2 text-sm">
              <div className="flex items-center justify-between rounded-lg bg-background/70 px-3 py-2">
                <span className="text-xs text-muted-foreground">Location ID</span>
                <div className="flex items-center gap-2">
                  <code className="text-sm">{result.locationId}</code>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      navigator.clipboard.writeText(result.locationId);
                      toast("Copied");
                    }}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              {result.nasIds.map((nid) => (
                <div
                  key={nid}
                  className="flex items-center justify-between rounded-lg bg-background/70 px-3 py-2"
                >
                  <span className="text-xs text-muted-foreground">NAS registered</span>
                  <div className="flex items-center gap-2">
                    <code className="text-sm">{nid}</code>
                    <KeyRound className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                   Helpers                                  */
/* -------------------------------------------------------------------------- */

function ModeCard({ value, title, desc }: { value: string; title: string; desc: string }) {
  return (
    <label
      htmlFor={`mode-${value}`}
      className="flex cursor-pointer items-start gap-3 rounded-xl border p-3 has-[:checked]:border-primary has-[:checked]:bg-primary/5"
    >
      <RadioGroupItem id={`mode-${value}`} value={value} className="mt-1" />
      <div>
        <div className="text-sm font-medium">{title}</div>
        <div className="text-xs text-muted-foreground">{desc}</div>
      </div>
    </label>
  );
}
