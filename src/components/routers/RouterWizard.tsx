import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import type { FieldPath, FieldValues, UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  RotateCcw,
  Search,
  ShieldCheck,
  Undo2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
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
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  AUTH_MODE_CHOICES,
  TLS_MODE_CHOICES,
  VENDOR_CHOICES,
  routerWizardSchema,
  type RouterWizardValues,
} from "@/lib/router-schemas";
import { useCreateRouter, useOnboardController } from "@/hooks/useRouters";
import type { OnboardControllerResult } from "@/types/router";
import type { ControllerAuthMode } from "@/types/network-integration";
import { OmadaSiteMapping } from "@/components/network-integrations/OmadaSiteMapping";
import { routerService } from "@/services/router.service";
import { RouterModelCombobox } from "@/components/routers/RouterModelCombobox";
import type { AppError } from "@/services/api";
import {
  useCancelProvisionJob,
  useCreateProvisionJob,
  useDiscoverDevice,
  useProvisionJob,
  useProvisionTimeline,
  useRetryProvisionJob,
  useRollbackProvisionJob,
  useStartProvisionJob,
  useValidateDevice,
} from "@/hooks/useProvisioning";
import type { DeviceDiscoveryResult } from "@/types/provisioning";

const MIKROTIK_STEPS = [
  { key: "basic", title: "Basic information", description: "Router profile" },
  { key: "credentials", title: "Credentials", description: "API access (optional)" },
  { key: "services", title: "Services", description: "Config preferences" },
  { key: "provision", title: "Provision", description: "Discover & configure (optional)" },
] as const;

/**
 * The Omada path is three steps, not four -- contract §11.6.
 *
 * "Services" is dropped because those six toggles land in `Router.settings`
 * and describe what to configure ON a MikroTik: FreeRADIUS, a WireGuard
 * management tunnel, a RouterOS captive portal. None of them is a thing this
 * platform does to an Omada controller, and offering them would promise
 * configuration that never happens.
 *
 * "Provision" is dropped for the same reason the backend excludes these rows
 * from the ZTP dashboard and refuses them a provisioning token: zero-touch
 * provisioning begins with an enrollment request and ends with a platform
 * agent checking in, and a controller does neither. What replaces it is a
 * confirmation of what was actually created, and the one link that finishes
 * the job.
 */
const OMADA_STEPS = [
  { key: "basic", title: "Controller", description: "Identity & venue" },
  { key: "omada", title: "Connection", description: "Address & credentials" },
  { key: "done", title: "Connected", description: "Map the site to finish" },
] as const;

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

const DEFAULTS: RouterWizardValues = {
  // Defaults to MikroTik: every device this platform has ever registered is
  // one, so the wizard opens on the path an operator almost always wants and
  // the Omada branch is an explicit choice rather than something to dismiss.
  vendor: "mikrotik",
  // Present but empty for a MikroTik registration -- `routerWizardSchema`'s
  // superRefine only validates these when `vendor === "tplink_omada"`, so one
  // form object serves both vendors without swapping resolvers mid-flow (see
  // that schema's own comment). `authMode` opens on "openapi" because legacy
  // operator credentials cannot read sites, SSIDs, devices or clients at all
  // -- they drive the captive portal and nothing else.
  omada: {
    baseUrl: "",
    authMode: "openapi",
    clientId: "",
    clientSecret: "",
    username: "",
    password: "",
    controllerId: "",
    tlsMode: "strict",
    tlsPinnedSha256: "",
    siteId: "",
    siteName: "",
    ssidId: "",
    ssidName: "",
  },
  basic: {
    name: "",
    locationId: "",
    model: "",
    serialNumber: "",
    macAddress: "",
    managementIpAddress: "",
    publicIpAddress: "",
  },
  credentials: { apiUsername: "", apiSecret: "" },
  services: {
    freeradius: true,
    wireguard: true,
    captivePortal: true,
    guestWifi: true,
    monitoring: true,
    analytics: false,
  },
};

export function RouterWizard({ open, onOpenChange }: Props) {
  const [step, setStep] = useState(0);
  const [createdRouter, setCreatedRouter] = useState<{ id: string; name: string } | null>(null);
  const [onboarded, setOnboarded] = useState<OnboardControllerResult | null>(null);
  const create = useCreateRouter();
  const onboard = useOnboardController();
  const { data: locations = [] } = useQuery({
    queryKey: ["routers", "location-options"],
    queryFn: () => routerService.locations(),
    enabled: open,
  });
  const form = useForm<RouterWizardValues>({
    resolver: zodResolver(routerWizardSchema),
    defaultValues: DEFAULTS,
    mode: "onBlur",
  });

  const vendor = form.watch("vendor");
  const isOmada = vendor === "tplink_omada";
  const STEPS = isOmada ? OMADA_STEPS : MIKROTIK_STEPS;
  // The last step that is a FORM (submit lives here); the one after it is the
  // post-create panel, which is why both flows stop one short of `length`.
  const LAST_FORM_STEP = STEPS.length - 2;
  const pending = create.isPending || onboard.isPending;

  async function next() {
    // "provision"/"done" are not form fields and are never trigger()-ed, and
    // the button that calls this is hidden past LAST_FORM_STEP.
    const key = STEPS[step].key as "basic" | "credentials" | "services" | "omada";
    // The vendor radio lives on the "basic" step but is a top-level field, so
    // it is not covered by trigger("basic"). It cannot be invalid (it is a
    // two-option enum with a default), but validating the pair keeps this
    // honest if a third vendor ever arrives with its own constraints.
    const valid = await form.trigger(key === "basic" ? ["vendor", "basic"] : [key]);
    if (valid) setStep((s) => Math.min(LAST_FORM_STEP, s + 1));
  }

  async function submit(values: RouterWizardValues) {
    if (values.vendor === "tplink_omada") {
      await submitOmada(values);
      return;
    }
    try {
      const r = await create.mutateAsync({
        locationId: values.basic.locationId,
        name: values.basic.name,
        // Non-null by validation on this branch: `routerWizardSchema`'s
        // refinement requires both for a MikroTik (they are optional on the
        // field only so the Omada branch can omit them).
        serialNumber: values.basic.serialNumber ?? "",
        macAddress: values.basic.macAddress ?? "",
        model: values.basic.model,
        vendor: values.vendor,
        managementIpAddress: values.basic.managementIpAddress || undefined,
        publicIpAddress: values.basic.publicIpAddress || undefined,
        apiUsername: values.credentials.apiUsername || undefined,
        apiSecret: values.credentials.apiSecret || undefined,
        settings: values.services,
      });
      toast.success(`${r.name} registered`);
      setCreatedRouter({ id: r.id, name: r.name });
      setStep(MIKROTIK_STEPS.length - 1);
    } catch (err) {
      toast.error((err as AppError).message || "Failed to add router");
    }
  }

  /**
   * Contract §11.6: one call writes the fleet device row and the network
   * integration together, so a venue can never end up with one without the
   * other.
   *
   * The organization is resolved from the chosen LOCATION rather than being
   * asked for separately -- a platform operator picking a venue has already
   * said which tenant they mean, and asking twice invites the two answers to
   * disagree. The backend re-checks the pair regardless and refuses a location
   * that belongs to someone else.
   */
  async function submitOmada(values: RouterWizardValues) {
    const location = locations.find((l) => l.id === values.basic.locationId);
    if (!location) {
      toast.error("Select a location for this controller");
      return;
    }
    try {
      const result = await onboard.mutateAsync({
        organizationId: location.organizationId,
        locationId: values.basic.locationId,
        name: values.basic.name,
        controllerModel: values.basic.model,
        baseUrl: values.omada.baseUrl?.trim() ?? "",
        authMode: values.omada.authMode,
        clientId: values.omada.clientId || undefined,
        clientSecret: values.omada.clientSecret || undefined,
        username: values.omada.username || undefined,
        password: values.omada.password || undefined,
        serialNumber: values.basic.serialNumber || undefined,
        macAddress: values.basic.macAddress || undefined,
        controllerId: values.omada.controllerId || undefined,
        tlsMode: values.omada.tlsMode,
        tlsPinnedSha256: values.omada.tlsPinnedSha256 || undefined,
      });
      toast.success(`${values.basic.name} onboarded`);
      setOnboarded(result);
      // The secrets were only ever an in-flight draft. Clearing them here
      // means they are gone from component state the moment they are no
      // longer needed, rather than living until the dialog happens to close.
      form.setValue("omada.clientSecret", "");
      form.setValue("omada.password", "");
      setStep(OMADA_STEPS.length - 1);
    } catch (err) {
      toast.error((err as AppError).message || "Failed to onboard controller");
    }
  }

  function finish() {
    onOpenChange(false);
    setOnboarded(null);
    form.reset(DEFAULTS);
    setStep(0);
    setCreatedRouter(null);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) {
          form.reset(DEFAULTS);
          setStep(0);
          setCreatedRouter(null);
          setOnboarded(null);
        }
      }}
    >
      <DialogContent className="max-w-3xl gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-border/70 px-6 py-4">
          <DialogTitle>Add device</DialogTitle>
          <DialogDescription>
            Register a router or a Wi-Fi controller at a location you manage.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-0 md:grid-cols-[220px_1fr]">
          <aside className="hidden border-r border-border/70 bg-muted/30 p-4 md:block">
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

          <Form {...form}>
            <form onSubmit={form.handleSubmit(submit)} className="flex min-h-[420px] flex-col">
              <div className="flex-1 overflow-y-auto px-6 py-5">
                {step === 0 && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="vendor"
                      render={({ field }) => (
                        <FormItem className="sm:col-span-2">
                          <FormLabel>Device type</FormLabel>
                          <FormControl>
                            <div className="grid gap-2 sm:grid-cols-2">
                              {VENDOR_CHOICES.map((choice) => (
                                <button
                                  key={choice.id}
                                  type="button"
                                  onClick={() => field.onChange(choice.id)}
                                  aria-pressed={field.value === choice.id}
                                  className={cn(
                                    "rounded-lg border px-3 py-2.5 text-left transition-colors",
                                    field.value === choice.id
                                      ? "border-primary bg-primary/5"
                                      : "border-border hover:bg-muted/50",
                                  )}
                                >
                                  <div className="text-sm font-medium">{choice.label}</div>
                                  <div className="mt-0.5 text-xs text-muted-foreground">
                                    {choice.description}
                                  </div>
                                </button>
                              ))}
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <TextField
                      name="basic.name"
                      label={isOmada ? "Controller name" : "Router name"}
                      placeholder={isOmada ? "Lobby Controller" : "Lobby Router"}
                      form={form}
                    />
                    <SelectFieldOpts
                      name="basic.locationId"
                      label="Location"
                      options={locations}
                      form={form}
                    />
                    <FormField
                      control={form.control}
                      name="basic.model"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{isOmada ? "Controller model" : "Router model"}</FormLabel>
                          <FormControl>
                            <RouterModelCombobox
                              value={field.value}
                              onValueChange={field.onChange}
                              placeholder="Select model"
                              vendor={vendor}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <TextField
                      name="basic.serialNumber"
                      label={isOmada ? "Serial number (hardware only)" : "Serial number"}
                      placeholder={isOmada ? "Leave blank for software" : "SN01234567"}
                      form={form}
                    />
                    <TextField
                      name="basic.macAddress"
                      label={isOmada ? "MAC address (hardware only)" : "MAC address"}
                      placeholder={isOmada ? "Leave blank for software" : "AA:BB:CC:DD:EE:01"}
                      form={form}
                    />
                    {isOmada ? (
                      <p className="sm:col-span-2 text-xs text-muted-foreground">
                        An OC200 or OC300 has both printed on it — enter them so the fleet record
                        matches the hardware. A software controller has neither: leave both blank
                        and an identifier is generated for it. Nothing is invented in between, so
                        enter both or neither.
                      </p>
                    ) : (
                      <>
                        <TextField
                          name="basic.managementIpAddress"
                          label="Management IP (optional)"
                          placeholder="192.168.88.1"
                          form={form}
                        />
                        <TextField
                          name="basic.publicIpAddress"
                          label="Public IP (optional)"
                          placeholder="203.0.113.10"
                          form={form}
                        />
                      </>
                    )}
                  </div>
                )}
                {step === 1 && isOmada && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <TextField
                      name="omada.baseUrl"
                      label="Controller address"
                      placeholder="https://controller.example.com:8043"
                      form={form}
                    />
                    <FormField
                      control={form.control}
                      name="omada.authMode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Authentication</FormLabel>
                          <FormControl>
                            <div className="grid gap-2">
                              {AUTH_MODE_CHOICES.map((choice) => (
                                <button
                                  key={choice.id}
                                  type="button"
                                  onClick={() => field.onChange(choice.id)}
                                  aria-pressed={field.value === choice.id}
                                  className={cn(
                                    "rounded-lg border px-3 py-2 text-left transition-colors",
                                    field.value === choice.id
                                      ? "border-primary bg-primary/5"
                                      : "border-border hover:bg-muted/50",
                                  )}
                                >
                                  <div className="text-sm font-medium">{choice.label}</div>
                                  <div className="mt-0.5 text-xs text-muted-foreground">
                                    {choice.description}
                                  </div>
                                </button>
                              ))}
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    {form.watch("omada.authMode") === "openapi" && (
                      <>
                        <TextField name="omada.clientId" label="Client ID" form={form} />
                        <TextField
                          name="omada.clientSecret"
                          label="Client secret"
                          type="password"
                          form={form}
                        />
                      </>
                    )}
                    {/* In both modes. See `routerWizardSchema` for why an
                        Open API controller still needs it. */}
                    <TextField name="omada.username" label="Hotspot operator name" form={form} />
                    <TextField
                      name="omada.password"
                      label="Hotspot operator password"
                      type="password"
                      form={form}
                    />
                    <TextField
                      name="omada.controllerId"
                      label="Omada ID (TP-Link cloud controllers only)"
                      placeholder="Leave blank for a controller reached directly"
                      form={form}
                    />
                    <FormField
                      control={form.control}
                      name="omada.tlsMode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Certificate check</FormLabel>
                          <FormControl>
                            <div className="grid gap-2">
                              {TLS_MODE_CHOICES.map((choice) => (
                                <button
                                  key={choice.id}
                                  type="button"
                                  onClick={() => field.onChange(choice.id)}
                                  aria-pressed={field.value === choice.id}
                                  className={cn(
                                    "rounded-lg border px-3 py-2 text-left transition-colors",
                                    field.value === choice.id
                                      ? "border-primary bg-primary/5"
                                      : "border-border hover:bg-muted/50",
                                  )}
                                >
                                  <div className="text-sm font-medium">{choice.label}</div>
                                  <div className="mt-0.5 text-xs text-muted-foreground">
                                    {choice.description}
                                  </div>
                                </button>
                              ))}
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    {form.watch("omada.tlsMode") === "pinned" && (
                      <TextField
                        name="omada.tlsPinnedSha256"
                        label="Certificate fingerprint (SHA-256)"
                        placeholder="AB:CD:EF:… — 64 hexadecimal characters"
                        form={form}
                      />
                    )}
                    <p className="sm:col-span-2 text-xs text-muted-foreground">
                      Sent to the controller from this platform's servers, never from your browser,
                      and stored encrypted. No endpoint returns them again.
                    </p>
                    {/* Unlike the MikroTik path below, skipping credentials is
                     * not offered at all: an integration without them cannot
                     * authorise a single guest, so a row created that way
                     * would be a registration that does nothing. The schema
                     * requires them. */}
                  </div>
                )}
                {step === 1 && !isOmada && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <TextField
                      name="credentials.apiUsername"
                      label="API username (optional)"
                      form={form}
                    />
                    <TextField
                      name="credentials.apiSecret"
                      label="API secret (optional)"
                      type="password"
                      form={form}
                    />
                    <p className="sm:col-span-2 text-xs text-muted-foreground">
                      Stored encrypted server-side. Never shown again after this form — the API
                      never returns it back.
                    </p>
                    {/* Skipping this step is a real, common path (e.g. the
                     * physical device isn't reachable yet at registration
                     * time) -- but a router with no credentials can never
                     * actually connect: no speed test, no health checks, no
                     * queue/device management, nothing. Confirmed live: a
                     * router left this way for days gives zero signal
                     * anywhere that it's stuck -- this warning plus
                     * RouterTable's own "Needs credentials" badge (see that
                     * file) are the two places this is now surfaced instead
                     * of silently disappearing after registration. */}
                    {!form.watch("credentials.apiUsername") &&
                      !form.watch("credentials.apiSecret") && (
                        <p className="sm:col-span-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-700 dark:text-amber-400">
                          Skipping this leaves the router unable to connect at all -- no speed test,
                          no health monitoring, no device management -- until credentials are added
                          later from the router's own detail page.
                        </p>
                      )}
                  </div>
                )}
                {step === 2 && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <ToggleField
                      name="services.freeradius"
                      label="FreeRADIUS"
                      description="AAA & accounting"
                      form={form}
                    />
                    <ToggleField
                      name="services.wireguard"
                      label="WireGuard"
                      description="Management tunnel"
                      form={form}
                    />
                    <ToggleField
                      name="services.captivePortal"
                      label="Captive portal"
                      description="Guest splash page"
                      form={form}
                    />
                    <ToggleField
                      name="services.guestWifi"
                      label="Guest WiFi"
                      description="Public guest network"
                      form={form}
                    />
                    <ToggleField
                      name="services.monitoring"
                      label="Monitoring"
                      description="Live metrics collection"
                      form={form}
                    />
                    <ToggleField
                      name="services.analytics"
                      label="Analytics"
                      description="Session & usage analytics"
                      form={form}
                    />
                  </div>
                )}
                {step === 3 && !isOmada && createdRouter && (
                  <ProvisionStep router={createdRouter} />
                )}
                {step === 2 && isOmada && onboarded && (
                  <OnboardedStep
                    result={onboarded}
                    // Read off the form rather than the result: the onboard
                    // response does not echo the auth mode back, and this is
                    // the value that was just sent.
                    authMode={form.getValues("omada.authMode")}
                    onDone={finish}
                  />
                )}
              </div>

              <div className="flex items-center justify-between gap-3 border-t border-border/70 bg-muted/20 px-6 py-3">
                <div className="text-xs text-muted-foreground">
                  Step {step + 1} of {STEPS.length}
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setStep((s) => Math.max(0, s - 1))}
                    // Past the last form step the rows are already written, so
                    // going "back" would offer to submit them a second time.
                    disabled={step === 0 || step > LAST_FORM_STEP}
                  >
                    <ChevronLeft className="h-4 w-4" /> Back
                  </Button>
                  {step < LAST_FORM_STEP ? (
                    <Button type="button" onClick={next}>
                      Next <ChevronRight className="h-4 w-4" />
                    </Button>
                  ) : step === LAST_FORM_STEP ? (
                    <Button type="submit" disabled={pending}>
                      {pending && <Loader2 className="h-4 w-4 animate-spin" />}
                      <span className={pending ? "ml-2" : ""}>
                        {isOmada ? "Connect controller" : "Add router"}
                      </span>
                    </Button>
                  ) : (
                    <Button type="button" onClick={finish}>
                      Done
                    </Button>
                  )}
                </div>
              </div>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Provisioning Engine integration (backend/app/domains/provisioning_engine)
 * -- an optional post-flight layer that runs after the router record above
 * is already created. `previewConfiguration` needs a provision_template_id
 * this wizard has no picker for (template management lives in the
 * router_provisioning domain, a separate config-templates admin surface
 * out of scope here), so this step only covers discover -> validate ->
 * create+start a job -> track it, which is the real value for "did the
 * device I just registered actually come up correctly."
 */
/**
 * What replaces "Provision" on the Omada path.
 *
 * There is no zero-touch provisioning to run here, and saying so plainly is
 * the point -- the backend refuses these rows a provisioning token and leaves
 * them out of the ZTP dashboard for the same reason.
 *
 * What it does instead is state exactly what was created and then FINISH THE
 * JOB, which it previously sent the operator to another dashboard to do.
 *
 * The old version's reasoning was an ordering argument and only half right:
 * listing sites needs stored credentials, stored credentials need the
 * integration row, and the row does not exist until onboarding returns --
 * all true, and all satisfied by the time this renders, because `result`
 * carries the id. So it said "Open Integrations, pick this controller's
 * site", and OMADA_OPERATOR_RUNBOOK recorded the consequence: *"The admin
 * onboarding wizard sends you to a screen with no site picker."* The
 * mapping now happens here, on the screen that just created the thing.
 *
 * The success line is also no longer the overclaim it was. It said guests
 * "can be issued a session" while the amber box below it said the
 * integration "authorises nobody" -- two boxes on one screen contradicting
 * each other. What is true at this moment is that the records exist; what
 * makes guests work is the site, which is the control directly beneath.
 */
function OnboardedStep({
  result,
  authMode,
  onDone,
}: {
  result: OnboardControllerResult;
  /** What the operator just configured, so the mapping panel knows whether
   * a picker can populate. See `OmadaSiteMapping`. */
  authMode: ControllerAuthMode;
  onDone: () => void;
}) {
  // Set by the mapping panel on a successful save. Until then the amber
  // "not yet authorising" notice stands, because until then it is true.
  const [mappedSite, setMappedSite] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
        <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
        <div className="text-sm">
          <p className="font-medium text-emerald-700 dark:text-emerald-300">
            {result.integrationName} is registered
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            A fleet record and a controller integration were created together and linked to this
            venue.
          </p>
        </div>
      </div>

      <dl className="grid gap-x-6 gap-y-2 rounded-lg border border-border/70 px-4 py-3 text-sm sm:grid-cols-2">
        <div className="flex justify-between gap-3 sm:block">
          <dt className="text-xs text-muted-foreground">Fleet serial</dt>
          <dd className="font-mono text-xs">{result.routerSerialNumber}</dd>
        </div>
        <div className="flex justify-between gap-3 sm:block">
          <dt className="text-xs text-muted-foreground">Identifier</dt>
          <dd className="text-xs">
            {result.syntheticIdentity ? "Generated (software controller)" : "From the hardware"}
          </dd>
        </div>
      </dl>

      {/* The step the operator used to be sent elsewhere for. */}
      <div className="rounded-lg border border-border/70 px-4 py-3">
        <OmadaSiteMapping
          integrationId={result.integrationId}
          authMode={authMode}
          onSaved={({ siteName }) => setMappedSite(siteName)}
        />
      </div>

      {mappedSite ? (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-700 dark:text-emerald-300">
          <p className="font-medium">Site {mappedSite} mapped.</p>
          <p className="mt-1">
            Finish on the controller itself: point its External Portal Server at this platform. The
            values to paste are on this integration in the Master console.
          </p>
          <Link
            to="/master/integrations"
            search={{ q: result.integrationName }}
            onClick={onDone}
            className="mt-2 inline-flex items-center gap-1 font-medium underline underline-offset-2"
          >
            Open {result.integrationName} <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
      ) : (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-700 dark:text-amber-400">
          <p className="font-medium">Not authorising guests yet.</p>
          <p className="mt-1">
            Set the site above. Without one the controller stores its credentials and refuses every
            guest, after they have finished signing in.
          </p>
          <Link
            to="/master/integrations"
            search={{ q: result.integrationName }}
            onClick={onDone}
            className="mt-2 inline-flex items-center gap-1 font-medium underline underline-offset-2"
          >
            Do it later in Integrations <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
      )}
    </div>
  );
}

function ProvisionStep({ router }: { router: { id: string; name: string } }) {
  const [discovery, setDiscovery] = useState<DeviceDiscoveryResult | null>(null);
  const [validated, setValidated] = useState<"idle" | "pass" | "fail">("idle");
  const [jobId, setJobId] = useState<string | null>(null);

  const discover = useDiscoverDevice();
  const validate = useValidateDevice();
  const createJob = useCreateProvisionJob();
  const startJob = useStartProvisionJob();
  const retryJob = useRetryProvisionJob();
  const rollbackJob = useRollbackProvisionJob();
  const cancelJob = useCancelProvisionJob();
  const job = useProvisionJob(jobId, { pollWhileActive: true });
  const timeline = useProvisionTimeline(jobId);

  async function runDiscover() {
    try {
      setDiscovery(await discover.mutateAsync(router.id));
    } catch (err) {
      toast.error((err as AppError).message || "Discovery failed");
    }
  }

  async function runValidate() {
    try {
      await validate.mutateAsync({ routerId: router.id });
      setValidated("pass");
      toast.success("Device validation passed");
    } catch (err) {
      setValidated("fail");
      toast.error((err as AppError).message || "Device validation failed");
    }
  }

  async function runStart() {
    try {
      const created = await createJob.mutateAsync({ routerId: router.id });
      await startJob.mutateAsync(created.id);
      setJobId(created.id);
      toast.success("Provision job started");
    } catch (err) {
      toast.error((err as AppError).message || "Failed to start provision job");
    }
  }

  const status = job.data?.status;
  const isTerminal = status === "completed" || status === "failed" || status === "cancelled";

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        <span className="font-medium text-foreground">{router.name}</span> was registered. This step
        is optional — discover and validate the live device, then run a provisioning job to push its
        baseline config, or skip and finish now.
      </p>

      {!jobId && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Card className="rounded-xl border-border/70">
            <CardContent className="space-y-2 p-4">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={runDiscover}
                disabled={discover.isPending}
              >
                {discover.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Search className="h-3.5 w-3.5" />
                )}
                <span className="ml-2">Discover device</span>
              </Button>
              {discovery && (
                <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <dt>Vendor</dt>
                  <dd className="text-foreground">{discovery.vendor}</dd>
                  <dt>Model</dt>
                  <dd className="text-foreground">{discovery.model ?? "—"}</dd>
                  <dt>Firmware</dt>
                  <dd className="text-foreground">{discovery.firmwareVersion ?? "—"}</dd>
                  <dt>Uptime</dt>
                  <dd className="text-foreground">
                    {discovery.uptimeSeconds != null
                      ? `${Math.round(discovery.uptimeSeconds / 3600)}h`
                      : "—"}
                  </dd>
                </dl>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-xl border-border/70">
            <CardContent className="space-y-2 p-4">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={runValidate}
                disabled={validate.isPending}
              >
                {validate.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ShieldCheck className="h-3.5 w-3.5" />
                )}
                <span className="ml-2">Validate device</span>
              </Button>
              {validated === "pass" && (
                <div className="flex items-center gap-1.5 text-xs text-emerald-600">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Validation passed
                </div>
              )}
              {validated === "fail" && (
                <div className="flex items-center gap-1.5 text-xs text-destructive">
                  <XCircle className="h-3.5 w-3.5" /> Validation failed
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {!jobId ? (
        <Button
          type="button"
          size="sm"
          onClick={runStart}
          disabled={createJob.isPending || startJob.isPending}
        >
          {(createJob.isPending || startJob.isPending) && (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          )}
          <span className={createJob.isPending || startJob.isPending ? "ml-2" : ""}>
            Run provisioning job
          </span>
        </Button>
      ) : (
        <Card className="rounded-xl border-border/70">
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Job status</span>
                <Badge variant={status === "failed" ? "destructive" : "secondary"}>
                  {status ?? "…"}
                </Badge>
              </div>
              <div className="flex gap-2">
                {status === "failed" && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => retryJob.mutateAsync(jobId)}
                    disabled={retryJob.isPending}
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> Retry
                  </Button>
                )}
                {job.data?.appliedConfigVersionId && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => rollbackJob.mutateAsync(jobId)}
                    disabled={rollbackJob.isPending}
                  >
                    <Undo2 className="h-3.5 w-3.5" /> Rollback
                  </Button>
                )}
                {!isTerminal && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => cancelJob.mutateAsync({ jobId })}
                    disabled={cancelJob.isPending}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </div>
            {job.data?.errorMessage && (
              <div className="flex items-start gap-1.5 text-xs text-destructive">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {job.data.errorMessage}
              </div>
            )}
            {timeline.data && timeline.data.length > 0 && (
              <ol className="space-y-1.5 border-l border-border/60 pl-3 text-xs">
                {timeline.data.map((e, i) => (
                  <li key={i}>
                    <span className="font-medium text-foreground">{e.label}</span>{" "}
                    <span className="text-muted-foreground">
                      {new Date(e.occurredAt).toLocaleTimeString()}
                    </span>
                    {e.detail && <div className="text-muted-foreground">{e.detail}</div>}
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function TextField<T extends FieldValues>({
  name,
  label,
  placeholder,
  type,
  form,
}: {
  name: FieldPath<T>;
  label: string;
  placeholder?: string;
  type?: string;
  form: UseFormReturn<T>;
}) {
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input type={type ?? "text"} placeholder={placeholder} {...field} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function SelectFieldOpts<T extends FieldValues>({
  name,
  label,
  options,
  form,
}: {
  name: FieldPath<T>;
  label: string;
  options: { id: string; name: string }[];
  form: UseFormReturn<T>;
}) {
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <Select value={field.value} onValueChange={field.onChange}>
            <FormControl>
              <SelectTrigger>
                <SelectValue placeholder={`Select ${label.toLowerCase()}`} />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {options.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function ToggleField<T extends FieldValues>({
  name,
  label,
  description,
  form,
}: {
  name: FieldPath<T>;
  label: string;
  description: string;
  form: UseFormReturn<T>;
}) {
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem className="flex flex-col rounded-lg border border-border/70 p-3">
          <div className="flex items-center justify-between">
            <div>
              <FormLabel className="text-sm">{label}</FormLabel>
              <FormDescription className="text-xs">{description}</FormDescription>
            </div>
            <FormControl>
              <Switch checked={field.value} onCheckedChange={field.onChange} />
            </FormControl>
          </div>
        </FormItem>
      )}
    />
  );
}
