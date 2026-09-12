import { useEffect, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  Building2,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Loader2,
  MapPin,
  RotateCcw,
  Router as RouterIcon,
  Sparkles,
  SlidersHorizontal,
  UserCog,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { OMADA_SITE_ID_EXAMPLE, omadaSiteIdError } from "@/lib/omada-site-id";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { COUNTRY_OPTIONS, TIMEZONE_OPTIONS, defaultTimezoneForCountry } from "@/lib/countries";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RouterModelCombobox } from "@/components/routers/RouterModelCombobox";
import { OmadaPortalSetupSteps } from "@/components/network-integrations/OmadaPortalSetupSteps";
import { OmadaSiteMapping } from "@/components/network-integrations/OmadaSiteMapping";
import { describePortalReadinessGap } from "@/lib/network-integration-readiness";
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
import { Stepper } from "@/components/ui-ext/Stepper";
import { cn } from "@/lib/utils";

import { api, requestErrorMessage } from "@/services/api";
import { isDemo } from "@/services/customer.service";
import { locationService } from "@/services/location.service";
import { useProvisionLocation } from "@/hooks/useLocations";
import { useOnboardController } from "@/hooks/useRouters";
import {
  PROPERTY_TYPE_LABEL,
  type PropertyType,
  type ProvisionLocationPayload,
  type ProvisionLocationResult,
} from "@/types/location";
import type { OnboardControllerPayload, OnboardControllerResult } from "@/types/router";
import { businessTypeIcon } from "@/lib/business-type-icons";
import {
  AUTH_MODE_CHOICES,
  TLS_MODE_CHOICES,
  VENDOR_CHOICES,
  omadaControllerIssues,
  type RouterVendorId,
} from "@/lib/router-schemas";

// Same demo-session gap as location.service.ts's fetch helpers (see their
// comment) -- GET /plans 401s under the Master Console's demo sign-in, which
// left this wizard's "Plan" step with nothing to pick and the whole wizard
// stuck (a plan is required to reach Review).
const DEMO_PLANS: BackendPlan[] = [
  {
    id: "plan-demo-starter",
    name: "Starter",
    plan_type: "standard",
    base_price: "999.00",
    currency: "INR",
  },
  {
    id: "plan-demo-growth",
    name: "Growth",
    plan_type: "standard",
    base_price: "2999.00",
    currency: "INR",
  },
  {
    id: "plan-demo-enterprise",
    name: "Enterprise",
    plan_type: "custom",
    base_price: "9999.00",
    currency: "INR",
  },
];

const STEPS = [
  { key: "org", title: "Organization", desc: "Select or create", icon: Building2 },
  { key: "location", title: "Location", desc: "Site details", icon: MapPin },
  { key: "owner", title: "Owner", desc: "Location owner account", icon: UserCog },
  { key: "router", title: "Device", desc: "Router or Omada controller", icon: RouterIcon },
  { key: "plan", title: "Plan", desc: "Assign a subscription plan", icon: Sparkles },
  {
    key: "features",
    title: "Features",
    desc: "Customize beyond the plan defaults",
    icon: SlidersHorizontal,
  },
  { key: "review", title: "Review", desc: "Confirm & provision", icon: Check },
] as const;

interface FeatureOverrideState {
  isEnabled?: boolean;
  limitValue?: number;
}

interface WizardState {
  org: {
    mode: "existing" | "new";
    existingId?: string;
    name: string;
    slug: string;
    contactEmail: string;
  };
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
  /** Which kind of device the venue runs. A venue is one or the other --
   * see `ROUTER_VENDORS` -- so only the chosen branch's fields are
   * validated or sent. */
  device: RouterVendorId;
  router: {
    name: string;
    serialNumber: string;
    macAddress: string;
    model: string;
    managementIpAddress: string;
  };
  controller: ControllerDraft;
  planId: string;
  featureOverrides: Record<string, FeatureOverrideState>;
}

/**
 * A TP-Link Omada controller, as typed. Plain component state and nothing
 * else: `password`/`clientSecret` are an in-flight draft that is never
 * written to storage, never shown back (Review and the result screen leave
 * them out), cleared once the controller is connected, and dropped with the
 * rest of the state when the dialog closes. They are deliberately KEPT after
 * a failed connect, so "Retry connecting controller" does not make the
 * operator type them again.
 */
interface ControllerDraft {
  name: string;
  model: string;
  baseUrl: string;
  authMode: "legacy" | "openapi";
  clientId: string;
  clientSecret: string;
  username: string;
  password: string;
  controllerId: string;
  site: string;
  ssid: string;
  // No "insecure" here, unlike the device wizard: this is the path a new
  // customer's first controller takes, and "accept any certificate" is not a
  // choice to make in passing. The device wizard still offers it.
  tlsMode: "strict" | "pinned";
  tlsPinnedSha256: string;
  serialNumber: string;
  macAddress: string;
}

const DEFAULT_CONTROLLER: ControllerDraft = {
  name: "",
  model: "",
  baseUrl: "",
  // Hotspot operator, not Open API -- the opposite of the device wizard's
  // default, on purpose. The controller lets a guest online only through
  // the operator login, in either mode (cloud-guest OMADA_OPERATOR_RUNBOOK
  // §2 item 1), so it is the one credential this venue cannot do without;
  // Open API only adds inventory screens on top of it.
  authMode: "legacy",
  clientId: "",
  clientSecret: "",
  username: "",
  password: "",
  controllerId: "",
  site: "",
  ssid: "",
  tlsMode: "strict",
  tlsPinnedSha256: "",
  serialNumber: "",
  macAddress: "",
};

/** How the controller half of an Omada provision went. Separate from
 * `result`, because the customer can exist while this is still failing --
 * the two are different requests, not one transaction. */
type ControllerOutcome =
  | { status: "connecting" }
  | { status: "connected"; result: OnboardControllerResult }
  | { status: "failed"; message: string };

const DEFAULT_STATE: WizardState = {
  org: { mode: "existing", name: "", slug: "", contactEmail: "" },
  location: {
    name: "",
    slug: "",
    propertyType: "",
    addressLine1: "",
    city: "",
    stateProvince: "",
    postalCode: "",
    country: "",
    timezone: "UTC",
  },
  owner: { firstName: "", lastName: "", email: "" },
  // MikroTik first, as in the device wizard: the path almost every venue
  // takes, with Omada an explicit choice.
  device: "mikrotik",
  router: { name: "", serialNumber: "", macAddress: "", model: "", managementIpAddress: "" },
  controller: DEFAULT_CONTROLLER,
  planId: "",
  featureOverrides: {},
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProvisioned?: (locationId: string) => void;
  /** Pre-selects "Existing organization" mode with this org already chosen
   * -- used when the wizard is opened from a specific customer's own detail
   * view (see master.customers.tsx's "New Location" action) so adding
   * another location to a customer you're already looking at doesn't make
   * you re-find them in the org picker. The customer is unique; a customer
   * can still have any number of locations, this just skips re-selecting
   * the customer you already had open. */
  initialOrganizationId?: string;
}

interface BackendPlan {
  id: string;
  name: string;
  plan_type: string;
  base_price: string;
  currency: string;
}

interface BackendFeature {
  key: string;
  name: string;
  description: string | null;
  category: string;
  // "tier" (today, exactly "support_level") is deliberately not offered
  // an override control in this wizard -- see FeaturesStep's own comment.
  type: "boolean" | "limit" | "tier";
  default_enabled: boolean;
}

export function PlatformLocationWizard({
  open,
  onOpenChange,
  onProvisioned,
  initialOrganizationId,
}: Props) {
  const [step, setStep] = useState(0);
  const [state, setState] = useState<WizardState>(DEFAULT_STATE);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [result, setResult] = useState<ProvisionLocationResult | null>(null);
  // A PERSISTENT failure, not just the toast. The backend's provisioning
  // failures carry the one fact the operator has to act on -- whether the
  // customer they just tried to create now exists -- and a sonner toast
  // that disappears after a few seconds is not where that belongs. See
  // `RouterTunnelProvisioningFailedError` on the backend: a hub-bridge
  // failure rolls the whole customer back, and an operator who missed the
  // toast would otherwise be left staring at an unchanged Review step with
  // no idea whether to retry or go hunting for a half-built account.
  const [failure, setFailure] = useState<string | null>(null);
  const [controllerOutcome, setControllerOutcome] = useState<ControllerOutcome | null>(null);
  const provision = useProvisionLocation();
  const onboard = useOnboardController();
  const busy = provision.isPending || onboard.isPending;

  // Re-seed on every open (not just mount) -- the dialog instance is reused
  // across separate "New Location" clicks for different customers, so a
  // stale `existingId` from the previous customer must not leak into the
  // next one.
  useEffect(() => {
    if (!open) return;
    setState(
      initialOrganizationId
        ? {
            ...DEFAULT_STATE,
            org: { ...DEFAULT_STATE.org, mode: "existing", existingId: initialOrganizationId },
          }
        : DEFAULT_STATE,
    );
  }, [open, initialOrganizationId]);

  const orgs = useQuery({
    queryKey: ["locations", "org-options"],
    queryFn: () => locationService.organizations(),
    enabled: open,
  });
  const plans = useQuery({
    queryKey: ["billing", "plans", "active"],
    queryFn: async () => {
      if (isDemo()) return DEMO_PLANS;
      const { data } = await api.get<{ items: BackendPlan[] }>("/plans", {
        params: { is_active: true },
      });
      return data.items;
    },
    enabled: open,
  });
  const features = useQuery({
    queryKey: ["features", "catalog"],
    queryFn: async () => {
      const { data } = await api.get<{ features: BackendFeature[] }>("/features");
      return data.features;
    },
    enabled: open,
  });

  function reset() {
    setStep(0);
    setState(DEFAULT_STATE);
    setErrors({});
    setResult(null);
    setFailure(null);
    setControllerOutcome(null);
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
        if (!z.string().email().safeParse(state.org.contactEmail).success)
          e["org.contactEmail"] = "Invalid email";
      }
    } else if (step === 1) {
      (
        ["name", "slug", "addressLine1", "city", "stateProvince", "postalCode", "country"] as const
      ).forEach((k) => {
        if (!state.location[k].trim()) e[`location.${k}`] = "Required";
      });
    } else if (step === 2) {
      if (!state.owner.firstName.trim()) e["owner.firstName"] = "Required";
      if (!state.owner.lastName.trim()) e["owner.lastName"] = "Required";
      if (!z.string().email().safeParse(state.owner.email).success)
        e["owner.email"] = "Invalid email";
    } else if (step === 3) {
      if (state.device === "tplink_omada") {
        Object.assign(e, controllerErrors(state.controller));
      } else {
        (["name", "serialNumber", "macAddress", "model"] as const).forEach((k) => {
          if (!state.router[k].trim()) e[`router.${k}`] = "Required";
        });
      }
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
      // No router for an Omada venue: there is none, and the controller is
      // not something this endpoint can enroll. It is connected next, by
      // `connectController`, once the location it belongs to exists.
      router:
        state.device === "mikrotik"
          ? {
              ...state.router,
              managementIpAddress: state.router.managementIpAddress || undefined,
            }
          : undefined,
      planId: state.planId,
      featureOverrides: Object.entries(state.featureOverrides)
        .filter(([, v]) => v.isEnabled !== undefined || v.limitValue !== undefined)
        .map(([featureKey, v]) => ({
          featureKey,
          isEnabled: v.isEnabled,
          limitValue: v.limitValue,
        })),
    };
    setFailure(null);
    let r: ProvisionLocationResult;
    try {
      r = await provision.mutateAsync(payload);
    } catch (err) {
      const message = requestErrorMessage(err, "Provisioning failed");
      toast.error(message);
      setFailure(message);
      return;
    }
    setResult(r);
    toast.success(`${r.locationName} provisioned`);
    onProvisioned?.(r.locationId);
    if (state.device === "tplink_omada") await connectController(r);
  }

  /**
   * The second request of an Omada provision, and the only one a retry
   * repeats.
   *
   * Two requests, not one transaction: `POST /locations/provision` has no
   * controller fields, and onboarding needs the location id it returns. So
   * by the time this runs the customer, location and owner already exist,
   * and a failure here must never be reported as "provisioning failed" --
   * an operator who believed that would provision the customer a second
   * time. `r` is the provision result already on screen, which is why a
   * retry can never re-provision: nothing on this path calls `provision`.
   */
  async function connectController(r: ProvisionLocationResult) {
    setControllerOutcome({ status: "connecting" });
    try {
      const onboarded = await onboard.mutateAsync(onboardPayload(state.controller, r));
      setControllerOutcome({ status: "connected", result: onboarded });
      toast.success(`${onboarded.integrationName} connected`);
      // The secrets have served their purpose; drop them now rather than
      // when the dialog happens to close. Same as the device wizard.
      setState((s) => ({ ...s, controller: { ...s.controller, password: "", clientSecret: "" } }));
    } catch (err) {
      // `requestErrorMessage`, not `(err as AppError).message`: the backend's
      // own sentence is the one that says what the controller answered, and
      // anything that is not a request failure gets a plain fallback rather
      // than an empty banner.
      const message = requestErrorMessage(err, "The controller could not be connected.");
      toast.error("Controller not connected");
      setControllerOutcome({ status: "failed", message });
    }
  }

  function retryController() {
    if (!result) return;
    // The operator may have edited the details on the failure panel.
    const e = controllerErrors(state.controller);
    setErrors(e);
    if (Object.keys(e).length > 0) {
      toast.error("Please fix the highlighted fields");
      return;
    }
    void connectController(result);
  }

  const orgOptions = orgs.data ?? [];
  const planOptions = plans.data ?? [];

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
            Creates an organization (or reuses one), a location, its owner account, and its first
            router in one transaction. A TP-Link Omada controller is connected straight after, as a
            separate step.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-0 md:grid-cols-[240px_1fr]">
          <aside className="hidden max-h-[70vh] overflow-y-auto border-r border-border/70 bg-muted/30 p-3 md:block">
            <Stepper
              steps={STEPS.map((s) => ({
                key: s.key,
                title: s.title,
                description: s.desc,
                icon: s.icon,
              }))}
              currentStep={step}
              // Locked once provisioned: going back would only offer to edit
              // answers that are already saved, and on the Omada path it
              // would put the controller form somewhere a retry does not read
              // it from.
              onStepClick={result ? undefined : setStep}
            />
          </aside>

          <div className="flex min-h-[520px] flex-col">
            <ScrollArea className="max-h-[70vh] flex-1">
              <div className="px-6 py-5">
                {step === 0 && (
                  <OrgStep
                    state={state.org}
                    setState={(v) => set("org", v)}
                    orgs={orgOptions}
                    errors={errors}
                  />
                )}
                {step === 1 && (
                  <LocationStep
                    state={state.location}
                    setState={(v) => set("location", v)}
                    errors={errors}
                  />
                )}
                {step === 2 && (
                  <OwnerStep
                    state={state.owner}
                    setState={(v) => set("owner", v)}
                    errors={errors}
                  />
                )}
                {step === 3 && (
                  <RouterStep
                    device={state.device}
                    setDevice={(v) => {
                      set("device", v);
                      setErrors({});
                    }}
                    state={state.router}
                    setState={(v) => set("router", v)}
                    controller={state.controller}
                    setController={(v) => set("controller", v)}
                    errors={errors}
                  />
                )}
                {step === 4 && (
                  <PlanStep
                    value={state.planId}
                    onChange={(v) => set("planId", v)}
                    plans={planOptions}
                    loading={plans.isLoading}
                    error={errors.planId}
                  />
                )}
                {step === 5 && (
                  <FeaturesStep
                    value={state.featureOverrides}
                    onChange={(v) => set("featureOverrides", v)}
                    features={features.data ?? []}
                    loading={features.isLoading}
                  />
                )}
                {step === 6 && (
                  <ReviewStep
                    state={state}
                    orgs={orgOptions}
                    plans={planOptions}
                    result={result}
                    provisioning={provision.isPending}
                    failure={failure}
                    controllerFailed={controllerOutcome?.status === "failed"}
                  />
                )}
                {step === 6 && result && controllerOutcome && (
                  <ControllerOutcomePanel
                    outcome={controllerOutcome}
                    locationName={result.locationName}
                    controller={state.controller}
                    setController={(v) => set("controller", v)}
                    errors={errors}
                    onRetry={retryController}
                    retrying={onboard.isPending}
                    onNavigate={() => onOpenChange(false)}
                  />
                )}
              </div>
            </ScrollArea>

            <div className="flex items-center justify-between border-t border-border/70 bg-muted/20 px-6 py-3">
              <div className="text-xs text-muted-foreground">
                Step {Math.min(step + 1, STEPS.length)} of {STEPS.length}
              </div>
              <div className="flex gap-2">
                {step > 0 && !result && (
                  <Button variant="ghost" size="sm" onClick={back} disabled={busy}>
                    <ChevronLeft className="h-4 w-4" /> Back
                  </Button>
                )}
                {step < STEPS.length - 1 && (
                  <Button size="sm" onClick={next}>
                    Continue <ChevronRight className="h-4 w-4" />
                  </Button>
                )}
                {step === STEPS.length - 1 && !result && (
                  <Button size="sm" onClick={runProvision} disabled={busy}>
                    Provision location <Sparkles className="h-4 w-4" />
                  </Button>
                )}
                {result && (
                  // Not while the controller is still connecting: closing
                  // would not stop the request, only hide how it ended.
                  <Button size="sm" onClick={() => onOpenChange(false)} disabled={busy}>
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

/**
 * The controller draft's errors, keyed `controller.<field>`.
 *
 * The address, credential, certificate and hardware-identity rules are the
 * device wizard's own (`omadaControllerIssues`), so the two ways of
 * onboarding a controller cannot disagree about what is complete. This
 * wizard adds two of its own: a name (the device wizard's lives in its
 * separate "basic" schema) and a site, which the device wizard maps later
 * but this one sends up front -- without it the backend reports
 * `site_not_selected` and the controller authorises nobody.
 */
function controllerErrors(c: ControllerDraft): Record<string, string> {
  const e: Record<string, string> = {};
  if (c.name.trim().length < 2) e["controller.name"] = "Controller name is required";
  // The site is an ID, not a name -- see src/lib/omada-site-id.ts for the
  // two measurements that settle it and for the field copy that produced
  // the opposite. Refused here rather than stored: the backend refuses it
  // too, and a value that gets past both turns away every guest at the
  // venue with a 403 that names nothing.
  const siteError = omadaSiteIdError(c.site);
  if (siteError) e["controller.site"] = siteError;
  for (const issue of omadaControllerIssues({
    serialNumber: c.serialNumber,
    macAddress: c.macAddress,
    omada: {
      baseUrl: c.baseUrl,
      authMode: c.authMode,
      clientId: c.clientId,
      clientSecret: c.clientSecret,
      username: c.username,
      password: c.password,
      controllerId: c.controllerId,
      tlsMode: c.tlsMode,
      tlsPinnedSha256: c.tlsPinnedSha256,
    },
  })) {
    // `basic.serialNumber` / `omada.baseUrl` -> `controller.serialNumber` /
    // `controller.baseUrl`: the draft uses the same field names.
    const key = `controller.${issue.path[1]}`;
    e[key] ??= issue.message;
  }
  return e;
}

/** The onboard request for a controller at the location just provisioned. */
function onboardPayload(c: ControllerDraft, r: ProvisionLocationResult): OnboardControllerPayload {
  const serialNumber = c.serialNumber.trim();
  const macAddress = c.macAddress.trim();
  const site = c.site.trim();
  return {
    // From the provision result, never from the org picker: a "new
    // organization" has no id until provisioning returns one.
    organizationId: r.organizationId,
    locationId: r.locationId,
    name: c.name.trim(),
    // The backend requires a model (it lands in the NOT NULL `routers.model`)
    // but an operator may not know it. A controller with no serial/MAC is a
    // software controller, and "Omada Software Controller" is that
    // deployment's own entry in the model list; a hardware one with no model
    // given gets a label that claims no particular SKU.
    controllerModel:
      c.model.trim() ||
      (serialNumber && macAddress ? "Omada hardware controller" : "Omada Software Controller"),
    baseUrl: c.baseUrl.trim(),
    authMode: c.authMode,
    clientId: c.authMode === "openapi" ? c.clientId.trim() || undefined : undefined,
    clientSecret: c.authMode === "openapi" ? c.clientSecret || undefined : undefined,
    username: c.username.trim() || undefined,
    password: c.password || undefined,
    controllerId: c.controllerId.trim() || undefined,
    tlsMode: c.tlsMode,
    tlsPinnedSha256: c.tlsMode === "pinned" ? c.tlsPinnedSha256.trim() : undefined,
    serialNumber: serialNumber || undefined,
    macAddress: macAddress || undefined,
    // The typed value is the site ID -- validated as one by
    // `controllerErrors` above, and it is what Omada puts on its own
    // redirect's `site=` and what the authorize call sends back.
    //
    // It is deliberately NOT also sent as `external_site_name`. That field
    // is the human label an operator reads back on every later screen, and
    // a hotspot operator login cannot list sites (CR-002), so at this point
    // nobody knows it. Copying the id in was what made the two fields
    // indistinguishable and hid the id-versus-name error; leaving it unset
    // renders as an honest "—" until the Open API picker or an edit fills
    // it in.
    externalSiteId: site,
    guestSsidName: c.ssid.trim() || undefined,
  };
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

/** A small, real, editable slug suggestion derived from a name -- e.g.
 * "Acme Hospitality" -> "acme-hospitality". Used to auto-fill the Slug
 * field as the user types the name it's derived from, instead of leaving
 * it empty behind a greyed example placeholder that reads as an
 * already-filled-in value at a glance (easy to miss that it's required).
 * The user can still freely edit the result afterwards. */
function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

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
      <StepHeader
        title="Select or create organization"
        description="Provision under an existing organization, or create a new one."
      />
      <RadioGroup
        value={state.mode}
        onValueChange={(v) => setState({ ...state, mode: v as "existing" | "new" })}
        className="grid grid-cols-2 gap-3"
      >
        <ModeCard
          value="existing"
          title="Existing organization"
          desc="Add this location to an org you manage."
        />
        <ModeCard value="new" title="New organization" desc="Onboard a brand-new customer." />
      </RadioGroup>
      <Separator className="my-4" />
      {state.mode === "existing" ? (
        <div className="space-y-2">
          <Label>Organization</Label>
          <Select
            value={state.existingId}
            onValueChange={(v) => setState({ ...state, existingId: v })}
          >
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
              onChange={(e) => {
                const name = e.target.value;
                // Auto-fills/keeps the slug in sync with the name as long as
                // the user hasn't diverged from the auto-suggestion by
                // hand-editing it -- see slugify's own doc comment.
                const slugIsAuto = !state.slug || state.slug === slugify(state.name);
                setState({ ...state, name, slug: slugIsAuto ? slugify(name) : state.slug });
              }}
              placeholder="Acme Hospitality"
            />
            <ErrorText msg={errors["org.name"]} />
          </div>
          <div>
            <Label>Slug</Label>
            <Input
              value={state.slug}
              onChange={(e) => setState({ ...state, slug: e.target.value })}
              placeholder="e.g. acme-hospitality"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Auto-suggested from the name above -- edit freely.
            </p>
            <ErrorText msg={errors["org.slug"]} />
          </div>
          <div className="md:col-span-2">
            <Label>Contact email</Label>
            <Input
              type="email"
              value={state.contactEmail}
              onChange={(e) => setState({ ...state, contactEmail: e.target.value })}
              placeholder="ops@acme.example.com"
            />
            <ErrorText msg={errors["org.contactEmail"]} />
          </div>
        </div>
      )}
    </div>
  );
}

function LocationStep({
  state,
  setState,
  errors,
}: {
  state: WizardState["location"];
  setState: (v: WizardState["location"]) => void;
  errors: Record<string, string>;
}) {
  const upd = <K extends keyof WizardState["location"]>(k: K, v: WizardState["location"][K]) =>
    setState({ ...state, [k]: v });

  /**
   * Timezone follows Country until the operator says otherwise.
   *
   * Picking "India" used to leave Timezone on UTC, and nothing downstream
   * complains about that -- session times, report boundaries, business hours,
   * voucher windows and campaign sends are all read through this field, so a
   * venue provisioned five and a half hours out produces numbers that are
   * plausible and wrong for as long as nobody checks. Two questions, where the
   * operator only reliably knows the answer to one.
   *
   * `timezoneTouched` is why this is a default rather than a derivation:
   * several of these countries span multiple zones, so the moment an operator
   * chooses one deliberately -- a venue in Perth, not Sydney -- Country stops
   * overriding it. Without that flag the next Country keystroke would silently
   * undo their choice, which is a worse bug than the one being fixed, because
   * it only bites the person who knew better.
   */
  const [timezoneTouched, setTimezoneTouched] = useState(false);
  const onCountryChange = (code: string) => {
    const tz = defaultTimezoneForCountry(code);
    // An unknown country leaves the timezone alone rather than resetting it to
    // UTC -- see `defaultTimezoneForCountry`'s own note on why it returns null.
    setState({ ...state, country: code, ...(tz && !timezoneTouched ? { timezone: tz } : {}) });
  };

  return (
    <div>
      <StepHeader
        title="Location details"
        description="Name, property type and address for the physical site."
      />
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <Label>Location name</Label>
          <Input
            value={state.name}
            onChange={(e) => {
              const name = e.target.value;
              // Same auto-suggest-until-hand-edited behavior as the
              // Organization step's own Slug field -- see slugify's doc
              // comment.
              const slugIsAuto = !state.slug || state.slug === slugify(state.name);
              setState({ ...state, name, slug: slugIsAuto ? slugify(name) : state.slug });
            }}
            placeholder="Downtown Branch"
          />
          <ErrorText msg={errors["location.name"]} />
        </div>
        <div>
          <Label>Slug</Label>
          <Input
            value={state.slug}
            onChange={(e) => upd("slug", e.target.value)}
            placeholder="e.g. downtown-branch"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Auto-suggested from the name above -- edit freely.
          </p>
          <ErrorText msg={errors["location.slug"]} />
        </div>
        <div>
          <Label>Property type (optional)</Label>
          <Select
            value={state.propertyType}
            onValueChange={(v) => upd("propertyType", v as PropertyType)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select property type" />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(PROPERTY_TYPE_LABEL) as PropertyType[]).map((t) => {
                const TypeIcon = businessTypeIcon(t);
                return (
                  <SelectItem key={t} value={t}>
                    <span className="flex items-center gap-2">
                      <TypeIcon className="h-4 w-4 text-muted-foreground" />{" "}
                      {PROPERTY_TYPE_LABEL[t]}
                    </span>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Country</Label>
          <Select value={state.country} onValueChange={onCountryChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select a country" />
            </SelectTrigger>
            <SelectContent>
              {/* Names, not bare ISO codes. `IN` and `ID` sit four rows apart
                  in an alphabet of two-letter codes, and a picker that needs
                  you to already know the answer is not a picker. */}
              {COUNTRY_OPTIONS.map((c) => (
                <SelectItem key={c.code} value={c.code}>
                  {c.name} ({c.code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <ErrorText msg={errors["location.country"]} />
        </div>
        <div>
          <Label>State / Region</Label>
          <Input
            value={state.stateProvince}
            onChange={(e) => upd("stateProvince", e.target.value)}
          />
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
          <Select
            value={state.timezone}
            onValueChange={(v) => {
              setTimezoneTouched(true);
              upd("timezone", v);
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIMEZONE_OPTIONS.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {timezoneTouched
              ? "Set manually — changing the country will not override it."
              : "Follows the country until you change it. Every session time, report boundary and business-hours rule for this venue is read in this zone."}
          </p>
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
  state,
  setState,
  errors,
}: {
  state: WizardState["owner"];
  setState: (v: WizardState["owner"]) => void;
  errors: Record<string, string>;
}) {
  return (
    <div>
      <StepHeader
        title="Location owner"
        description="A new user account is created and granted the Organization Owner role. A temporary password is generated server-side and shown once, at the end."
      />
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <Label>First name</Label>
          <Input
            value={state.firstName}
            onChange={(e) => setState({ ...state, firstName: e.target.value })}
          />
          <ErrorText msg={errors["owner.firstName"]} />
        </div>
        <div>
          <Label>Last name</Label>
          <Input
            value={state.lastName}
            onChange={(e) => setState({ ...state, lastName: e.target.value })}
          />
          <ErrorText msg={errors["owner.lastName"]} />
        </div>
        <div className="md:col-span-2">
          <Label>Email</Label>
          <Input
            type="email"
            value={state.email}
            onChange={(e) => setState({ ...state, email: e.target.value })}
          />
          <ErrorText msg={errors["owner.email"]} />
        </div>
      </div>
    </div>
  );
}

function RouterStep({
  device,
  setDevice,
  state,
  setState,
  controller,
  setController,
  errors,
}: {
  device: RouterVendorId;
  setDevice: (v: RouterVendorId) => void;
  state: WizardState["router"];
  setState: (v: WizardState["router"]) => void;
  controller: ControllerDraft;
  setController: (v: ControllerDraft) => void;
  errors: Record<string, string>;
}) {
  return (
    <div>
      <StepHeader
        title="First device"
        description="The venue's network: a MikroTik router enrolled now, or a TP-Link Omada controller connected right after the customer is created."
      />
      <div className="mb-4">
        <Label>Device type</Label>
        {/* Same two cards, labels and descriptions as the device wizard. */}
        <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
          {VENDOR_CHOICES.map((choice) => (
            <button
              key={choice.id}
              type="button"
              onClick={() => setDevice(choice.id)}
              aria-pressed={device === choice.id}
              className={cn(
                "rounded-lg border px-3 py-2.5 text-left transition-colors",
                device === choice.id
                  ? "border-primary bg-primary/5"
                  : "border-border hover:bg-muted/50",
              )}
            >
              <div className="text-sm font-medium">{choice.label}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">{choice.description}</div>
            </button>
          ))}
        </div>
      </div>
      {device === "tplink_omada" ? (
        <ControllerFields state={controller} setState={setController} errors={errors} />
      ) : (
        <MikrotikFields state={state} setState={setState} errors={errors} />
      )}
    </div>
  );
}

function MikrotikFields({
  state,
  setState,
  errors,
}: {
  state: WizardState["router"];
  setState: (v: WizardState["router"]) => void;
  errors: Record<string, string>;
}) {
  return (
    <div>
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <Label>Router name</Label>
          <Input
            value={state.name}
            onChange={(e) => setState({ ...state, name: e.target.value })}
            placeholder="Lobby Router"
          />
          <ErrorText msg={errors["router.name"]} />
        </div>
        <div>
          <Label>Model</Label>
          <RouterModelCombobox
            value={state.model}
            onValueChange={(v) => setState({ ...state, model: v })}
            placeholder="Select or type a model"
          />
          <ErrorText msg={errors["router.model"]} />
        </div>
        <div>
          <Label>Serial number</Label>
          <Input
            value={state.serialNumber}
            onChange={(e) => setState({ ...state, serialNumber: e.target.value })}
            className="font-mono"
          />
          <ErrorText msg={errors["router.serialNumber"]} />
        </div>
        <div>
          <Label>MAC address</Label>
          <Input
            value={state.macAddress}
            onChange={(e) => setState({ ...state, macAddress: e.target.value })}
            placeholder="AA:BB:CC:DD:EE:01"
            className="font-mono"
          />
          <ErrorText msg={errors["router.macAddress"]} />
        </div>
        <div className="md:col-span-2">
          <Label>Management IP (optional)</Label>
          <Input
            value={state.managementIpAddress}
            onChange={(e) => setState({ ...state, managementIpAddress: e.target.value })}
            placeholder="20.219.19.32"
            className="font-mono"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            The router's real, reachable IP -- lets the platform actually connect to it (e.g. a
            MikroTik CHR/hardware device). Leave blank for a records-only entry.
          </p>
        </div>
      </div>
    </div>
  );
}

/** One labelled text input on the controller form. Labels are bound with
 * `htmlFor` so the fields are reachable by name, not only by position. */
function ControllerInput({
  id,
  label,
  value,
  onChange,
  error,
  help,
  placeholder,
  type,
  mono,
  className,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  help?: ReactNode;
  placeholder?: string;
  type?: "text" | "password";
  mono?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type ?? "text"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={mono ? "font-mono" : undefined}
        // Keeps the browser's password manager from offering to save a
        // customer's controller credential under the platform's own origin.
        autoComplete={type === "password" ? "new-password" : "off"}
        aria-invalid={error ? true : undefined}
      />
      {help && <p className="mt-1 text-xs text-muted-foreground">{help}</p>}
      <ErrorText msg={error} />
    </div>
  );
}

function ChoiceCards<T extends string>({
  label,
  choices,
  value,
  onChange,
  help,
}: {
  label: string;
  choices: Array<{ id: T; label: string; description: string; badge?: string }>;
  value: T;
  onChange: (v: T) => void;
  help?: string;
}) {
  return (
    <div className="md:col-span-2">
      <Label>{label}</Label>
      <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
        {choices.map((choice) => (
          <button
            key={choice.id}
            type="button"
            onClick={() => onChange(choice.id)}
            aria-pressed={value === choice.id}
            className={cn(
              "rounded-lg border px-3 py-2 text-left transition-colors",
              value === choice.id
                ? "border-primary bg-primary/5"
                : "border-border hover:bg-muted/50",
            )}
          >
            <div className="flex items-center gap-2 text-sm font-medium">
              {choice.label}
              {choice.badge && (
                <Badge variant="secondary" className="text-[10px]">
                  {choice.badge}
                </Badge>
              )}
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground">{choice.description}</div>
          </button>
        ))}
      </div>
      {help && <p className="mt-1 text-xs text-muted-foreground">{help}</p>}
    </div>
  );
}

// Hotspot operator first and marked Recommended -- see DEFAULT_CONTROLLER.
// The copy itself is the device wizard's (`AUTH_MODE_CHOICES`).
const CONTROLLER_AUTH_CHOICES = [
  ...AUTH_MODE_CHOICES.filter((c) => c.id === "legacy").map((c) => ({
    ...c,
    badge: "Recommended",
  })),
  ...AUTH_MODE_CHOICES.filter((c) => c.id !== "legacy"),
];
const CONTROLLER_TLS_CHOICES = TLS_MODE_CHOICES.filter(
  (c): c is (typeof TLS_MODE_CHOICES)[number] & { id: "strict" | "pinned" } => c.id !== "insecure",
);

/**
 * The TP-Link Omada controller, as far as onboarding needs it. Rendered on
 * the Device step and again on the failure panel, so a typo the controller
 * refused can be corrected before a retry without leaving the result
 * screen.
 */
function ControllerFields({
  state,
  setState,
  errors,
}: {
  state: ControllerDraft;
  setState: (v: ControllerDraft) => void;
  errors: Record<string, string>;
}) {
  const upd = <K extends keyof ControllerDraft>(k: K, v: ControllerDraft[K]) =>
    setState({ ...state, [k]: v });
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <ControllerInput
        id="controller-name"
        label="Controller name"
        value={state.name}
        onChange={(v) => upd("name", v)}
        placeholder="Lobby Controller"
        error={errors["controller.name"]}
      />
      <div>
        <Label htmlFor="controller-model">Controller model (optional)</Label>
        <RouterModelCombobox
          id="controller-model"
          value={state.model}
          onValueChange={(v) => upd("model", v)}
          placeholder="Select or type a model"
          vendor="tplink_omada"
        />
      </div>
      <ControllerInput
        id="controller-address"
        className="md:col-span-2"
        label="Controller address"
        value={state.baseUrl}
        onChange={(v) => upd("baseUrl", v)}
        placeholder="https://controller.example.com:8043"
        mono
        error={errors["controller.baseUrl"]}
        help="Scheme, host and port only. This platform's servers connect to it, not your browser, so it must be reachable from the internet — usually port 8043 for a software controller, 443 for an OC200/OC300."
      />
      <ChoiceCards
        label="Authentication"
        choices={CONTROLLER_AUTH_CHOICES}
        value={state.authMode}
        onChange={(v) => upd("authMode", v)}
        help="Guests are let online only through the hotspot operator account, whichever you choose — so it is always required. Open API adds the device and client lists on top."
      />
      {state.authMode === "openapi" && (
        <>
          <ControllerInput
            id="controller-client-id"
            label="Client ID"
            value={state.clientId}
            onChange={(v) => upd("clientId", v)}
            error={errors["controller.clientId"]}
          />
          <ControllerInput
            id="controller-client-secret"
            label="Client secret"
            type="password"
            value={state.clientSecret}
            onChange={(v) => upd("clientSecret", v)}
            error={errors["controller.clientSecret"]}
          />
        </>
      )}
      {/* In both modes: the controller lets a guest online only through
          this login, whatever reads its inventory. */}
      <ControllerInput
        id="controller-operator-name"
        label="Hotspot operator name"
        value={state.username}
        onChange={(v) => upd("username", v)}
        error={errors["controller.username"]}
        help="The operator account from the controller's Hotspot Manager — not the controller admin login."
      />
      <ControllerInput
        id="controller-operator-password"
        label="Hotspot operator password"
        type="password"
        value={state.password}
        onChange={(v) => upd("password", v)}
        error={errors["controller.password"]}
      />
      <ControllerInput
        id="controller-site"
        label="Omada site id"
        value={state.site}
        onChange={(v) => upd("site", v)}
        placeholder={OMADA_SITE_ID_EXAMPLE}
        error={errors["controller.site"]}
        help={
          <>
            The <code>site=</code> value in the guest&apos;s sign-in URL — 24 letters and digits,
            not the site&apos;s name. Open the guest WiFi on a phone and read it out of the address
            bar when the sign-in page appears. <code>Default</code> is a name and will not work, on
            a single-site controller either.
          </>
        }
      />
      <ControllerInput
        id="controller-ssid"
        label="Guest SSID (optional)"
        value={state.ssid}
        onChange={(v) => upd("ssid", v)}
        placeholder="Hotel-Guest"
        help="The guest WiFi network's name, exactly as it is broadcast."
      />
      <ControllerInput
        id="controller-omada-id"
        className="md:col-span-2"
        label="Omada ID (TP-Link cloud controllers only)"
        value={state.controllerId}
        onChange={(v) => upd("controllerId", v)}
        placeholder="Leave blank for a controller reached directly"
        mono
      />
      <ChoiceCards
        label="Certificate"
        choices={CONTROLLER_TLS_CHOICES}
        value={state.tlsMode}
        onChange={(v) => upd("tlsMode", v)}
      />
      {state.tlsMode === "pinned" && (
        <ControllerInput
          id="controller-tls-pin"
          className="md:col-span-2"
          label="Certificate fingerprint (SHA-256)"
          value={state.tlsPinnedSha256}
          onChange={(v) => upd("tlsPinnedSha256", v)}
          placeholder="AB:CD:EF:… — 64 hexadecimal characters"
          mono
          error={errors["controller.tlsPinnedSha256"]}
          help="Self-hosted controllers present a self-signed certificate, which the standard check refuses — pin its fingerprint instead."
        />
      )}
      <ControllerInput
        id="controller-serial"
        label="Serial number (hardware only)"
        value={state.serialNumber}
        onChange={(v) => upd("serialNumber", v)}
        placeholder="Leave blank for software"
        mono
        error={errors["controller.serialNumber"]}
      />
      <ControllerInput
        id="controller-mac"
        label="MAC address (hardware only)"
        value={state.macAddress}
        onChange={(v) => upd("macAddress", v)}
        placeholder="Leave blank for software"
        mono
        error={errors["controller.macAddress"]}
      />
      <p className="text-xs text-muted-foreground md:col-span-2">
        An OC200 or OC300 has both printed on it — enter them so the fleet record matches the
        hardware. A software controller has neither: leave both blank and an identifier is generated
        for it. Enter both or neither.
      </p>
      <p className="text-xs text-muted-foreground md:col-span-2">
        Credentials are sent to the controller from this platform's servers, never from your
        browser, and stored encrypted. No endpoint returns them again.
      </p>
    </div>
  );
}

/**
 * The controller half of an Omada provision, under the customer's own
 * result card.
 *
 * The failure state is the one that matters. The customer, location and
 * owner exist by now whatever happens here, so it says so first, shows the
 * backend's own reason, and offers a retry that repeats only the onboard
 * call -- never the provision, which would create the customer twice.
 */
function ControllerOutcomePanel({
  outcome,
  locationName,
  controller,
  setController,
  errors,
  onRetry,
  retrying,
  onNavigate,
}: {
  outcome: ControllerOutcome;
  locationName: string;
  controller: ControllerDraft;
  setController: (v: ControllerDraft) => void;
  errors: Record<string, string>;
  onRetry: () => void;
  retrying: boolean;
  onNavigate: () => void;
}) {
  const [editing, setEditing] = useState(false);

  if (outcome.status === "connecting") {
    return (
      <div
        role="status"
        className="mt-4 flex items-start gap-3 rounded-lg border border-border/70 bg-muted/20 p-3 text-sm"
      >
        <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
        <div>
          <p className="font-medium">Connecting {controller.name}…</p>
          <p className="text-xs text-muted-foreground">
            The platform checks the controller address before it saves anything, so this can take up
            to a minute.
          </p>
        </div>
      </div>
    );
  }

  if (outcome.status === "failed") {
    return (
      <div className="mt-4 space-y-3">
        <div
          role="alert"
          className="flex gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-3"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <div className="space-y-2">
            <p className="text-sm font-medium text-destructive">
              The customer and location were created, but the controller was NOT connected.
            </p>
            {/* Verbatim: it is what the controller (or the platform's checks
                on its address) actually answered. */}
            <p className="text-sm text-muted-foreground">{outcome.message}</p>
            <p className="text-xs text-muted-foreground">
              Nothing needs to be provisioned again. Correct the details if needed and retry — only
              the controller connection is attempted. If you close this dialog instead, connect it
              later from Router Fleet → Add device, choosing {locationName}.
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button size="sm" onClick={onRetry} disabled={retrying}>
                {retrying ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RotateCcw className="h-4 w-4" />
                )}
                Retry connecting controller
              </Button>
              <Button size="sm" variant="outline" onClick={() => setEditing((v) => !v)}>
                {editing ? "Hide controller details" : "Edit controller details"}
              </Button>
            </div>
          </div>
        </div>
        {editing && (
          <div className="rounded-lg border border-border/70 p-3">
            <ControllerFields state={controller} setState={setController} errors={errors} />
          </div>
        )}
      </div>
    );
  }

  const r = outcome.result;
  const scheme = r.portalUrlScheme;
  const hostAndQuery = r.portalUrlHostAndQuery;
  const gaps = r.portalReadinessGaps;
  const integrationLink = (
    <Link
      to="/master/integrations"
      search={{ q: r.integrationName }}
      onClick={onNavigate}
      className="inline-flex items-center gap-1 font-medium underline underline-offset-2"
    >
      Open {r.integrationName} in Network Integrations <ChevronRight className="h-3 w-3" />
    </Link>
  );

  return (
    <div className="mt-4 space-y-3">
      <div className="flex items-start gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
        <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
        <div className="text-sm">
          <p className="font-medium text-emerald-700 dark:text-emerald-300">Controller connected</p>
          <p className="text-xs text-muted-foreground">
            {r.integrationName} is registered as this venue's device, with the site and guest
            network typed on the Device step.
          </p>
        </div>
      </div>

      {/*
        Confirm-or-correct, and for an Open API controller it is where the
        human-readable site NAME first becomes knowable.

        The Device step asks for the site id before anything exists to list,
        so it sends `external_site_id` alone -- an id is all a hotspot
        operator login can ever establish (CR-002). Now that the integration
        exists, an Open API controller can be listed, so this is the first
        moment the site can be picked from the real list and its name
        recorded alongside the id. With operator-only credentials the panel
        stays a text box and simply confirms the id that was typed.
      */}
      <div className="rounded-lg border border-border/70 p-3">
        <OmadaSiteMapping
          integrationId={r.integrationId}
          authMode={controller.authMode}
          initialSiteId={controller.site.trim()}
          initialSsidName={controller.ssid.trim()}
        />
      </div>

      {scheme && hostAndQuery ? (
        // The values from the onboard response -- the backend's
        // `build_external_portal_url`, never re-derived here. The same shared
        // steps the integration drawer and the Router Fleet setup screen
        // render, which is where an operator who closed this dialog finds
        // them again.
        <div className="space-y-2 rounded-lg border border-border/70 p-3">
          <p className="text-sm font-medium">Finish on the controller</p>
          <OmadaPortalSetupSteps
            scheme={scheme}
            hostAndQuery={hostAndQuery}
            guestSsidName={controller.ssid}
          />
        </div>
      ) : (
        // The backend withholds the pair exactly when no guest could sign in
        // through it, so there is nothing honest to paste yet.
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
          No guest portal link yet — the platform reports this controller cannot serve guests
          {gaps.length > 0 ? ` (${gaps.map(describePortalReadinessGap).join("; ")})` : ""}. The
          integration shows what is missing.
        </p>
      )}
      {scheme && hostAndQuery && gaps.length > 0 && (
        <p className="text-xs text-amber-700 dark:text-amber-400">
          The platform still reports: {gaps.map(describePortalReadinessGap).join("; ")}.
        </p>
      )}
      <p className="text-xs">{integrationLink}</p>
    </div>
  );
}

function PlanStep({
  value,
  onChange,
  plans,
  loading,
  error,
}: {
  value: string;
  onChange: (v: string) => void;
  plans: BackendPlan[];
  loading: boolean;
  error?: string;
}) {
  return (
    <div>
      <StepHeader
        title="Assign plan"
        description="Sets the subscription plan and its feature limits for this organization."
      />
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
                  active
                    ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary/40"
                    : "border-border hover:border-primary/40",
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="text-base font-semibold">{p.name}</div>
                  {active && <Check className="h-4 w-4 text-primary" />}
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {p.currency} {p.base_price}
                </div>
                <Badge variant="secondary" className="mt-2 capitalize">
                  {p.plan_type}
                </Badge>
              </button>
            );
          })}
        </div>
      )}
      <ErrorText msg={error} />
    </div>
  );
}

function FeaturesStep({
  value,
  onChange,
  features,
  loading,
}: {
  value: Record<string, FeatureOverrideState>;
  onChange: (v: Record<string, FeatureOverrideState>) => void;
  features: BackendFeature[];
  loading: boolean;
}) {
  function toggle(key: string, defaultEnabled: boolean) {
    const current = value[key];
    const next = { ...value };
    if (current?.isEnabled === undefined) {
      next[key] = { ...current, isEnabled: !defaultEnabled };
    } else {
      delete next[key];
    }
    onChange(next);
  }

  function setLimit(key: string, raw: string) {
    const next = { ...value };
    if (raw === "") {
      delete next[key];
    } else {
      next[key] = { ...next[key], limitValue: Number(raw) };
    }
    onChange(next);
  }

  // Tier-typed features (today, only "support_level") are never offered
  // as a per-customer override here -- this step's toggle/number controls
  // are only shaped for BOOLEAN/LIMIT features, and a TIER-typed feature
  // has no legal "on/off" override (the backend rejects a TIER-typed
  // override with no real tier_value). Simplest correct behavior: leave
  // it out of this list entirely, so it just inherits the selected
  // Plan's own tier_value, same as every other feature no admin touches.
  const overridableFeatures = features.filter((f) => f.type !== "tier");
  const categories = Array.from(new Set(overridableFeatures.map((f) => f.category)));

  return (
    <div>
      <StepHeader
        title="Customize features (optional)"
        description="Overrides applied on top of the selected plan's defaults, for this customer only. Leave everything alone to just use the plan as-is."
      />
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading feature catalog…</p>
      ) : (
        <div className="space-y-5">
          {categories.map((cat) => (
            <div key={cat}>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {cat}
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                {overridableFeatures
                  .filter((f) => f.category === cat)
                  .map((f) => {
                    const override = value[f.key];
                    if (f.type === "limit") {
                      return (
                        <div
                          key={f.key}
                          className="flex items-center justify-between gap-2 rounded-lg border p-2.5"
                        >
                          <Label className="text-xs">{f.description || f.name}</Label>
                          <Input
                            type="number"
                            className="h-7 w-24 text-xs"
                            placeholder="Plan default"
                            value={override?.limitValue ?? ""}
                            onChange={(e) => setLimit(f.key, e.target.value)}
                          />
                        </div>
                      );
                    }
                    const effective = override?.isEnabled ?? f.default_enabled;
                    const isOverridden = override?.isEnabled !== undefined;
                    return (
                      <button
                        type="button"
                        key={f.key}
                        onClick={() => toggle(f.key, f.default_enabled)}
                        className={cn(
                          "flex items-center justify-between gap-2 rounded-lg border p-2.5 text-left transition-colors",
                          isOverridden ? "border-primary bg-primary/5" : "border-border",
                        )}
                      >
                        <span className="text-xs">{f.description || f.name}</span>
                        <Badge
                          variant={effective ? "default" : "secondary"}
                          className="shrink-0 text-[10px]"
                        >
                          {effective ? "On" : "Off"}
                          {isOverridden && " (custom)"}
                        </Badge>
                      </button>
                    );
                  })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ReviewStep({
  state,
  orgs,
  plans,
  result,
  provisioning,
  failure,
  controllerFailed,
}: {
  state: WizardState;
  orgs: Array<{ id: string; name: string }>;
  plans: BackendPlan[];
  result: ProvisionLocationResult | null;
  provisioning: boolean;
  failure: string | null;
  controllerFailed: boolean;
}) {
  const orgLabel =
    state.org.mode === "existing"
      ? (orgs.find((o) => o.id === state.org.existingId)?.name ?? "—")
      : state.org.name || "New organization";
  const planLabel = plans.find((p) => p.id === state.planId)?.name ?? "—";

  if (result) {
    return (
      <div>
        <StepHeader
          title={
            controllerFailed
              ? "Customer created — controller not connected"
              : "Location provisioned"
          }
          description="This temporary password is shown once — copy it now."
        />
        <Card className="border-primary/40 bg-primary/5">
          <CardContent className="space-y-3 p-4">
            <SummaryRow label="Organization" value={result.organizationName} />
            <SummaryRow
              label="Location"
              value={`${result.locationName} (${result.locationCode})`}
            />
            {/* Null for an Omada venue, whose controller is reported in its
                own panel below rather than as a router it is not. */}
            {result.routerName && <SummaryRow label="Router" value={result.routerName} />}
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
      <StepHeader
        title="Review & confirm"
        description="Verify every decision before provisioning."
      />
      <div className="grid gap-3 md:grid-cols-2">
        <SummaryRow label="Organization" value={orgLabel} />
        <SummaryRow label="Location" value={state.location.name || "—"} />
        <SummaryRow
          label="Property"
          value={`${state.location.propertyType ? PROPERTY_TYPE_LABEL[state.location.propertyType] : "—"} · ${state.location.city}, ${state.location.country}`}
          icon={businessTypeIcon(state.location.propertyType)}
        />
        <SummaryRow
          label="Owner"
          value={`${state.owner.firstName} ${state.owner.lastName} · ${state.owner.email}`}
        />
        {state.device === "tplink_omada" ? (
          // Everything the operator chose about the controller, and nothing
          // secret: the operator password and client secret never appear.
          <>
            <SummaryRow
              label="Omada controller"
              value={`${state.controller.name}${state.controller.model ? ` (${state.controller.model})` : ""}`}
            />
            <SummaryRow label="Controller address" value={state.controller.baseUrl || "—"} />
            <SummaryRow
              label="Authentication"
              value={
                AUTH_MODE_CHOICES.find((c) => c.id === state.controller.authMode)?.label ??
                state.controller.authMode
              }
            />
            <SummaryRow
              label="Omada site · Guest SSID"
              value={`${state.controller.site || "—"} · ${state.controller.ssid || "—"}`}
            />
            <SummaryRow
              label="Certificate"
              value={
                TLS_MODE_CHOICES.find((c) => c.id === state.controller.tlsMode)?.label ??
                state.controller.tlsMode
              }
            />
          </>
        ) : (
          <SummaryRow
            label="Router"
            value={`${state.router.name} (${state.router.model})${state.router.managementIpAddress ? ` · ${state.router.managementIpAddress}` : ""}`}
          />
        )}
        <SummaryRow label="Plan" value={planLabel} />
        <SummaryRow
          label="Custom features"
          value={
            Object.keys(state.featureOverrides).length
              ? `${Object.keys(state.featureOverrides).length} overridden`
              : "None (plan defaults)"
          }
        />
      </div>
      {state.device === "tplink_omada" && !provisioning && !failure && (
        <p className="mt-4 text-xs text-muted-foreground">
          Two steps: the customer, location and owner are created first, then the controller is
          connected. If the controller cannot be reached, the customer still exists and you can
          retry just the controller from the next screen.
        </p>
      )}
      {provisioning && <p className="mt-4 text-sm text-muted-foreground">Provisioning…</p>}
      {failure && !provisioning && (
        <div
          role="alert"
          className="mt-4 flex gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-3"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-destructive">Provisioning failed</p>
            {/* The backend message verbatim -- it is the only thing that says
                whether anything was saved, and paraphrasing it here would
                mean maintaining that answer in two places. */}
            <p className="text-sm text-muted-foreground">{failure}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryRow({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon?: LucideIcon;
}) {
  return (
    <div className="rounded-lg border bg-muted/20 px-3 py-2">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="flex items-center gap-1.5 text-sm font-medium">
        {Icon && <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
        {value}
      </div>
    </div>
  );
}
