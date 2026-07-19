import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { locationWizardSchema, type LocationWizardValues } from "@/lib/location-schemas";
import { useCreateLocation } from "@/hooks/useLocations";
import { locationService } from "@/services/location.service";
import type { SiteType } from "@/types/location";
import { SITE_TYPE_LABEL } from "@/types/location";

const STEPS = [
  { key: "basic", title: "Basic information", description: "Location profile" },
  { key: "address", title: "Address", description: "Geographic details" },
  { key: "network", title: "Network", description: "ISP & connectivity" },
  { key: "settings", title: "Settings", description: "Guest WiFi features" },
] as const;

const SITE_TYPES: SiteType[] = ["hotel", "cafe", "restaurant", "hospital", "school", "office", "mall", "airport", "other"];
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

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

const DEFAULTS: LocationWizardValues = {
  basic: { name: "", organizationId: "", siteType: "hotel" },
  address: {
    country: "",
    state: "",
    city: "",
    address: "",
    zipCode: "",
    latitude: 0,
    longitude: 0,
    timezone: "",
  },
  network: {
    isp: "",
    primaryWan: "",
    secondaryWan: "",
    internetSpeedMbps: 100,
    publicIp: "",
    dns: "8.8.8.8, 8.8.4.4",
  },
  settings: {
    guestWifiEnabled: true,
    captivePortalEnabled: true,
    voucherLogin: false,
    otpLogin: true,
    pmsIntegration: false,
    socialLogin: false,
  },
};

export function LocationWizard({ open, onOpenChange }: Props) {
  const [step, setStep] = useState(0);
  const create = useCreateLocation();
  const orgs = locationService.organizations();

  const form = useForm<LocationWizardValues>({
    resolver: zodResolver(locationWizardSchema),
    defaultValues: DEFAULTS,
    mode: "onBlur",
  });

  async function next() {
    const key = STEPS[step].key;
    const valid = await form.trigger(key);
    if (valid) setStep((s) => Math.min(STEPS.length - 1, s + 1));
  }

  async function submit(values: LocationWizardValues) {
    try {
      const loc = await create.mutateAsync({
        basic: values.basic,
        address: values.address,
        network: {
          ...values.network,
          secondaryWan: values.network.secondaryWan || undefined,
        },
        settings: values.settings,
      });
      toast.success(`${loc.name} created`);
      onOpenChange(false);
      form.reset(DEFAULTS);
      setStep(0);
    } catch {
      toast.error("Failed to create location");
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) {
          form.reset(DEFAULTS);
          setStep(0);
        }
      }}
    >
      <DialogContent className="max-w-3xl gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-border/70 px-6 py-4">
          <DialogTitle>Create location</DialogTitle>
          <DialogDescription>Add a new site to CloudGuest in four quick steps.</DialogDescription>
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
                        <div className={cn("text-sm font-medium", !active && !done && "text-muted-foreground")}>
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
            <form onSubmit={form.handleSubmit(submit)} className="flex min-h-[440px] flex-col">
              <div className="flex-1 overflow-y-auto px-6 py-5">
                {step === 0 && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <TextField name="basic.name" label="Location name" placeholder="Downtown Flagship" form={form} />
                    <FormField
                      control={form.control}
                      name="basic.organizationId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Organization</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select organization" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {orgs.map((o) => (
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
                    <FormField
                      control={form.control}
                      name="basic.siteType"
                      render={({ field }) => (
                        <FormItem className="sm:col-span-2">
                          <FormLabel>Site type</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {SITE_TYPES.map((t) => (
                                <SelectItem key={t} value={t}>
                                  {SITE_TYPE_LABEL[t]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}
                {step === 1 && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <SelectField name="address.country" label="Country" options={COUNTRIES} form={form} />
                    <TextField name="address.state" label="State / Region" form={form} />
                    <TextField name="address.city" label="City" form={form} />
                    <TextField name="address.zipCode" label="ZIP / Postal code" form={form} />
                    <div className="sm:col-span-2">
                      <TextField name="address.address" label="Complete address" form={form} />
                    </div>
                    <TextField name="address.latitude" label="Latitude" type="number" form={form} />
                    <TextField name="address.longitude" label="Longitude" type="number" form={form} />
                    <div className="sm:col-span-2">
                      <SelectField name="address.timezone" label="Timezone" options={TIMEZONES} form={form} />
                    </div>
                  </div>
                )}
                {step === 2 && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <TextField name="network.isp" label="ISP name" placeholder="Comcast" form={form} />
                    <TextField name="network.primaryWan" label="Primary WAN" placeholder="Fiber 500Mbps" form={form} />
                    <TextField name="network.secondaryWan" label="Secondary WAN (optional)" placeholder="LTE Failover 50Mbps" form={form} />
                    <TextField name="network.internetSpeedMbps" label="Internet speed (Mbps)" type="number" form={form} />
                    <TextField name="network.publicIp" label="Public IP" placeholder="203.0.113.42" form={form} />
                    <TextField name="network.dns" label="DNS servers" placeholder="8.8.8.8, 1.1.1.1" form={form} />
                  </div>
                )}
                {step === 3 && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <ToggleField name="settings.guestWifiEnabled" label="Guest WiFi" description="Enable public guest network" form={form} />
                    <ToggleField name="settings.captivePortalEnabled" label="Captive portal" description="Show splash page before access" form={form} />
                    <ToggleField name="settings.voucherLogin" label="Voucher login" description="Prepaid codes for access" form={form} />
                    <ToggleField name="settings.otpLogin" label="OTP login" description="Email / SMS one-time codes" form={form} />
                    <ToggleField name="settings.pmsIntegration" label="PMS integration" description="Sync with property management" form={form} />
                    <ToggleField name="settings.socialLogin" label="Social login" description="Google, Facebook, Apple" form={form} />
                  </div>
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
                    disabled={step === 0}
                  >
                    <ChevronLeft className="h-4 w-4" /> Back
                  </Button>
                  {step < STEPS.length - 1 ? (
                    <Button type="button" onClick={next}>
                      Next <ChevronRight className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button type="submit" disabled={create.isPending}>
                      {create.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                      <span className={create.isPending ? "ml-2" : ""}>Create location</span>
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function TextField({ name, label, placeholder, type, form }: { name: any; label: string; placeholder?: string; type?: string; form: any }) {
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function SelectField({ name, label, options, form }: { name: any; label: string; options: string[]; form: any }) {
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
                <SelectItem key={o} value={o}>
                  {o}
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ToggleField({ name, label, description, form }: { name: any; label: string; description: string; form: any }) {
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
