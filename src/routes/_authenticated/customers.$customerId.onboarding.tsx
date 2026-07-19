import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  KeyRound,
  Layers,
  MapPin,
  Palette,
  Rocket,
  Router as RouterIcon,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/system/PageHeader";
import { useCustomer } from "@/hooks/useCustomer";
import { tenantService } from "@/services/tenant.service";

export const Route = createFileRoute("/_authenticated/customers/$customerId/onboarding")({
  component: OnboardingPage,
});

type State = {
  company: { name: string; gst: string; address: string; country: string; timezone: string; phone: string; website: string; logoUrl: string };
  plan: "trial" | "starter" | "professional" | "enterprise" | "custom";
  modules: Record<string, boolean>;
  locations: { id: string; name: string; type: string; city: string }[];
  routers: { id: string; name: string; model: string; serial: string; locationId: string }[];
  groups: { id: string; name: string; description: string; routerIds: string[] }[];
  policyName: string;
  policyAssignScope: "customer" | "location" | "nas_group";
  policyTarget: string;
  staff: { name: string; email: string; role: string }[];
};

const STEPS = [
  { key: 1, label: "Company", icon: Building2 },
  { key: 2, label: "Subscription", icon: KeyRound },
  { key: 3, label: "Modules", icon: Sparkles },
  { key: 4, label: "Locations", icon: MapPin },
  { key: 5, label: "Routers", icon: RouterIcon },
  { key: 6, label: "NAS Groups", icon: Layers },
  { key: 7, label: "Policies", icon: ShieldCheck },
  { key: 8, label: "Staff", icon: Users },
  { key: 9, label: "Review", icon: CheckCircle2 },
  { key: 10, label: "Activate", icon: Rocket },
] as const;

const PLANS: State["plan"][] = ["trial", "starter", "professional", "enterprise", "custom"];

function OnboardingPage() {
  const { customerId } = Route.useParams();
  const navigate = useNavigate();
  const { data: cust } = useCustomer(customerId);
  const [step, setStep] = useState(1);
  const [state, setState] = useState<State>(() => ({
    company: {
      name: cust?.name ?? "",
      gst: "", address: "", country: "India", timezone: "Asia/Kolkata",
      phone: cust?.owner.mobile ?? "", website: "", logoUrl: "",
    },
    plan: (cust?.subscription.plan as State["plan"]) ?? "professional",
    modules: Object.fromEntries(tenantService.featureCatalog.map((f) => [f.key, true])),
    locations: (cust?.locations ?? []).map((l) => ({ id: l.id, name: l.name, type: l.siteType, city: l.city })),
    routers: [],
    groups: [
      { id: "GRP-HTL", name: "Hotel Group", description: "Hospitality sites", routerIds: [] },
    ],
    policyName: "Hotel Premium",
    policyAssignScope: "location",
    policyTarget: cust?.locations[0]?.id ?? "",
    staff: [],
  }));

  const progress = (step / STEPS.length) * 100;

  const canNext = (): boolean => {
    switch (step) {
      case 1: return state.company.name.trim().length > 1;
      case 4: return state.locations.length > 0;
      default: return true;
    }
  };

  const finalize = () => {
    toast.success(`Onboarded ${state.company.name || "customer"}`);
    navigate({ to: "/customers/$customerId/tenant", params: { customerId } });
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title={`Onboard ${cust?.name ?? customerId}`}
        description="Guided setup — configure the tenant end-to-end in ten steps."
        actions={
          <Button asChild variant="outline">
            <Link to="/customers/$customerId/tenant" params={{ customerId }}>Skip wizard</Link>
          </Button>
        }
      />

      <Card>
        <CardHeader className="space-y-3">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Step {step} of {STEPS.length}</span>
            <span>{Math.round(progress)}% complete</span>
          </div>
          <Progress value={progress} />
          <div className="flex flex-wrap gap-1">
            {STEPS.map((s) => {
              const Icon = s.icon;
              const done = s.key < step;
              const active = s.key === step;
              return (
                <button key={s.key} onClick={() => setStep(s.key)}
                  className={"flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition " +
                    (active ? "bg-primary text-primary-foreground" : done ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted")}>
                  {done ? <Check className="h-3 w-3" /> : <Icon className="h-3 w-3" />}
                  <span>{s.label}</span>
                </button>
              );
            })}
          </div>
        </CardHeader>
        <CardContent className="pt-2">
          {step === 1 && <CompanyStep state={state} setState={setState} />}
          {step === 2 && <SubscriptionStep state={state} setState={setState} />}
          {step === 3 && <ModulesStep state={state} setState={setState} />}
          {step === 4 && <LocationsStep state={state} setState={setState} />}
          {step === 5 && <RoutersStep state={state} setState={setState} />}
          {step === 6 && <GroupsStep state={state} setState={setState} />}
          {step === 7 && <PoliciesStep state={state} setState={setState} />}
          {step === 8 && <StaffStep state={state} setState={setState} />}
          {step === 9 && <ReviewStep state={state} />}
          {step === 10 && <ActivateStep state={state} />}
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" disabled={step === 1} onClick={() => setStep((s) => Math.max(1, s - 1))}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        {step < STEPS.length ? (
          <Button onClick={() => setStep((s) => s + 1)} disabled={!canNext()}>
            Continue <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={finalize}><Rocket className="mr-2 h-4 w-4" /> Activate tenant</Button>
        )}
      </div>
    </div>
  );
}

type Sub<T> = { state: State; setState: React.Dispatch<React.SetStateAction<State>> } & T;

function CompanyStep({ state, setState }: Sub<{}>) {
  const c = state.company;
  const set = (patch: Partial<State["company"]>) => setState((p) => ({ ...p, company: { ...p.company, ...patch } }));
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="grid gap-2 md:col-span-2"><Label>Company name</Label><Input value={c.name} onChange={(e) => set({ name: e.target.value })} /></div>
      <div className="grid gap-2"><Label>GST / Tax ID</Label><Input value={c.gst} onChange={(e) => set({ gst: e.target.value })} /></div>
      <div className="grid gap-2"><Label>Phone</Label><Input value={c.phone} onChange={(e) => set({ phone: e.target.value })} /></div>
      <div className="grid gap-2 md:col-span-2"><Label>Address</Label><Textarea rows={2} value={c.address} onChange={(e) => set({ address: e.target.value })} /></div>
      <div className="grid gap-2"><Label>Country</Label><Input value={c.country} onChange={(e) => set({ country: e.target.value })} /></div>
      <div className="grid gap-2"><Label>Timezone</Label>
        <Select value={c.timezone} onValueChange={(v) => set({ timezone: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {["Asia/Kolkata", "Asia/Dubai", "Europe/London", "America/New_York", "UTC"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-2"><Label>Website</Label><Input value={c.website} onChange={(e) => set({ website: e.target.value })} /></div>
      <div className="grid gap-2"><Label>Logo URL</Label><Input value={c.logoUrl} onChange={(e) => set({ logoUrl: e.target.value })} placeholder="https://…" /></div>
    </div>
  );
}

function SubscriptionStep({ state, setState }: Sub<{}>) {
  return (
    <div className="grid gap-3 md:grid-cols-5">
      {PLANS.map((p) => {
        const active = state.plan === p;
        return (
          <button key={p} type="button" onClick={() => setState((s) => ({ ...s, plan: p }))}
            className={"rounded-lg border p-4 text-left transition " + (active ? "border-primary bg-primary/5" : "hover:border-muted-foreground/40")}>
            <div className="flex items-center justify-between">
              <div className="font-semibold capitalize">{p}</div>
              {active && <Badge>Selected</Badge>}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {p === "trial" ? "14 days free" : p === "starter" ? "Small teams" : p === "professional" ? "Multi-site" : p === "enterprise" ? "Chains + white label" : "Bespoke"}
            </p>
          </button>
        );
      })}
    </div>
  );
}

function ModulesStep({ state, setState }: Sub<{}>) {
  return (
    <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
      {tenantService.featureCatalog.map((f) => (
        <label key={f.key} className="flex items-start gap-2 rounded-md border p-3">
          <Checkbox checked={state.modules[f.key]}
            onCheckedChange={(v) => setState((s) => ({ ...s, modules: { ...s.modules, [f.key]: !!v } }))} />
          <div className="min-w-0">
            <div className="text-sm font-medium">{f.name}</div>
            <div className="text-xs text-muted-foreground">{f.description}</div>
          </div>
        </label>
      ))}
    </div>
  );
}

function LocationsStep({ state, setState }: Sub<{}>) {
  const add = () => setState((s) => ({
    ...s, locations: [...s.locations, { id: `LOC-${Date.now()}`, name: "", type: "hotel", city: "" }],
  }));
  const upd = (i: number, patch: Partial<State["locations"][number]>) => setState((s) => ({
    ...s, locations: s.locations.map((l, idx) => idx === i ? { ...l, ...patch } : l),
  }));
  const rm = (i: number) => setState((s) => ({ ...s, locations: s.locations.filter((_, idx) => idx !== i) }));

  return (
    <div className="space-y-3">
      {state.locations.map((l, i) => (
        <div key={l.id} className="grid gap-2 rounded-md border p-3 md:grid-cols-[minmax(0,1fr)_140px_160px_auto]">
          <Input placeholder="Location name" value={l.name} onChange={(e) => upd(i, { name: e.target.value })} />
          <Select value={l.type} onValueChange={(v) => upd(i, { type: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {["hotel", "resort", "cafe", "restaurant", "hospital", "office", "mall", "warehouse", "custom"].map((t) => (
                <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input placeholder="City" value={l.city} onChange={(e) => upd(i, { city: e.target.value })} />
          <Button variant="ghost" size="sm" onClick={() => rm(i)}>Remove</Button>
        </div>
      ))}
      <Button variant="outline" onClick={add}>Add location</Button>
    </div>
  );
}

function RoutersStep({ state, setState }: Sub<{}>) {
  const add = () => setState((s) => ({
    ...s, routers: [...s.routers, { id: `NAS-${Date.now()}`, name: "", model: "MikroTik hAP ax3", serial: "", locationId: s.locations[0]?.id ?? "" }],
  }));
  const upd = (i: number, patch: Partial<State["routers"][number]>) => setState((s) => ({
    ...s, routers: s.routers.map((r, idx) => idx === i ? { ...r, ...patch } : r),
  }));
  const rm = (i: number) => setState((s) => ({ ...s, routers: s.routers.filter((_, idx) => idx !== i) }));

  return (
    <div className="space-y-3">
      {state.routers.map((r, i) => (
        <div key={r.id} className="grid gap-2 rounded-md border p-3 md:grid-cols-[minmax(0,1fr)_1fr_1fr_180px_auto]">
          <Input placeholder="Router name" value={r.name} onChange={(e) => upd(i, { name: e.target.value })} />
          <Input placeholder="Model" value={r.model} onChange={(e) => upd(i, { model: e.target.value })} />
          <Input placeholder="Serial number" value={r.serial} onChange={(e) => upd(i, { serial: e.target.value })} />
          <Select value={r.locationId} onValueChange={(v) => upd(i, { locationId: v })}>
            <SelectTrigger><SelectValue placeholder="Location" /></SelectTrigger>
            <SelectContent>
              {state.locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name || l.id}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="ghost" size="sm" onClick={() => rm(i)}>Remove</Button>
        </div>
      ))}
      <Button variant="outline" onClick={add}>Register router</Button>
    </div>
  );
}

function GroupsStep({ state, setState }: Sub<{}>) {
  const add = () => setState((s) => ({
    ...s, groups: [...s.groups, { id: `GRP-${Date.now()}`, name: "", description: "", routerIds: [] }],
  }));
  const upd = (i: number, patch: Partial<State["groups"][number]>) => setState((s) => ({
    ...s, groups: s.groups.map((g, idx) => idx === i ? { ...g, ...patch } : g),
  }));
  const toggle = (i: number, routerId: string) => setState((s) => ({
    ...s, groups: s.groups.map((g, idx) => idx === i ? {
      ...g, routerIds: g.routerIds.includes(routerId) ? g.routerIds.filter((x) => x !== routerId) : [...g.routerIds, routerId],
    } : g),
  }));

  return (
    <div className="space-y-3">
      {state.groups.map((g, i) => (
        <Card key={g.id}>
          <CardContent className="space-y-3 p-4">
            <div className="grid gap-2 md:grid-cols-2">
              <Input placeholder="Group name" value={g.name} onChange={(e) => upd(i, { name: e.target.value })} />
              <Input placeholder="Description" value={g.description} onChange={(e) => upd(i, { description: e.target.value })} />
            </div>
            <div>
              <div className="mb-1 text-xs font-medium text-muted-foreground">Members</div>
              <div className="flex flex-wrap gap-2">
                {state.routers.length === 0 ? (
                  <span className="text-xs text-muted-foreground">Add routers in the previous step to assign them.</span>
                ) : state.routers.map((r) => {
                  const on = g.routerIds.includes(r.id);
                  return (
                    <button key={r.id} type="button" onClick={() => toggle(i, r.id)}
                      className={"rounded-md border px-2 py-1 text-xs " + (on ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground")}>
                      {r.name || r.id}
                    </button>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
      <Button variant="outline" onClick={add}>Add group</Button>
    </div>
  );
}

function PoliciesStep({ state, setState }: Sub<{}>) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="grid gap-2"><Label>Policy name</Label>
        <Input value={state.policyName} onChange={(e) => setState((s) => ({ ...s, policyName: e.target.value }))} /></div>
      <div className="grid gap-2"><Label>Assign to</Label>
        <Select value={state.policyAssignScope} onValueChange={(v) => setState((s) => ({ ...s, policyAssignScope: v as State["policyAssignScope"] }))}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="customer">Entire customer</SelectItem>
            <SelectItem value="location">Specific location</SelectItem>
            <SelectItem value="nas_group">NAS group</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-2 md:col-span-2">
        <Label>Target</Label>
        <Select value={state.policyTarget} onValueChange={(v) => setState((s) => ({ ...s, policyTarget: v }))}>
          <SelectTrigger><SelectValue placeholder="Choose target" /></SelectTrigger>
          <SelectContent>
            {state.policyAssignScope === "location" && state.locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name || l.id}</SelectItem>)}
            {state.policyAssignScope === "nas_group" && state.groups.map((g) => <SelectItem key={g.id} value={g.id}>{g.name || g.id}</SelectItem>)}
            {state.policyAssignScope === "customer" && <SelectItem value="customer">This customer</SelectItem>}
          </SelectContent>
        </Select>
      </div>
      <Separator className="md:col-span-2" />
      <div className="md:col-span-2 rounded-md border p-3 text-sm text-muted-foreground">
        Enabled by policy: <span className="text-foreground">{Object.entries(state.modules).filter(([, v]) => v).length}</span> of {Object.keys(state.modules).length} modules.
        Full feature and router-operation toggles can be tuned later in <b className="text-foreground">Tenant → Policies</b>.
      </div>
    </div>
  );
}

function StaffStep({ state, setState }: Sub<{}>) {
  const add = () => setState((s) => ({ ...s, staff: [...s.staff, { name: "", email: "", role: "Location Admin" }] }));
  const upd = (i: number, patch: Partial<State["staff"][number]>) => setState((s) => ({
    ...s, staff: s.staff.map((u, idx) => idx === i ? { ...u, ...patch } : u),
  }));
  const rm = (i: number) => setState((s) => ({ ...s, staff: s.staff.filter((_, idx) => idx !== i) }));

  return (
    <div className="space-y-3">
      {state.staff.map((u, i) => (
        <div key={i} className="grid gap-2 rounded-md border p-3 md:grid-cols-[1fr_1fr_180px_auto]">
          <Input placeholder="Full name" value={u.name} onChange={(e) => upd(i, { name: e.target.value })} />
          <Input placeholder="Email" type="email" value={u.email} onChange={(e) => upd(i, { email: e.target.value })} />
          <Select value={u.role} onValueChange={(v) => upd(i, { role: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {["Organization Admin", "Location Admin", "Network Engineer", "Reception", "Manager", "Billing", "Support", "Viewer"].map((r) => (
                <SelectItem key={r} value={r}>{r}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="ghost" size="sm" onClick={() => rm(i)}>Remove</Button>
        </div>
      ))}
      <Button variant="outline" onClick={add}>Invite staff</Button>
    </div>
  );
}

function ReviewStep({ state }: { state: State }) {
  const enabledModules = Object.entries(state.modules).filter(([, v]) => v).length;
  const rows: [string, string][] = [
    ["Company", state.company.name || "—"],
    ["Plan", state.plan],
    ["Modules enabled", `${enabledModules} of ${Object.keys(state.modules).length}`],
    ["Locations", String(state.locations.length)],
    ["Routers", String(state.routers.length)],
    ["NAS groups", String(state.groups.length)],
    ["Policy", `${state.policyName} → ${state.policyAssignScope}`],
    ["Staff invites", String(state.staff.length)],
  ];
  return (
    <div className="grid gap-2 md:grid-cols-2">
      {rows.map(([k, v]) => (
        <div key={k} className="flex items-center justify-between rounded-md border p-3 text-sm">
          <span className="text-muted-foreground">{k}</span>
          <span className="font-medium capitalize">{v}</span>
        </div>
      ))}
    </div>
  );
}

function ActivateStep({ state }: { state: State }) {
  return (
    <div className="flex flex-col items-center gap-3 py-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Rocket className="h-8 w-8" />
      </div>
      <h3 className="text-xl font-semibold">Ready to activate</h3>
      <p className="max-w-md text-sm text-muted-foreground">
        {state.company.name || "This customer"} is fully configured. Click <b>Activate tenant</b> to publish
        every module, policy and NAS binding — you can revisit and tune anything from the tenant sidebar.
      </p>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Palette className="h-3.5 w-3.5" /> Branding <Separator orientation="vertical" className="h-3" />
        <ShieldCheck className="h-3.5 w-3.5" /> Security <Separator orientation="vertical" className="h-3" />
        <KeyRound className="h-3.5 w-3.5" /> API keys
      </div>
    </div>
  );
}
