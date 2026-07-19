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
import { routerWizardSchema, type RouterWizardValues } from "@/lib/router-schemas";
import { useCreateRouter } from "@/hooks/useRouters";
import { routerService } from "@/services/router.service";

const STEPS = [
  { key: "basic", title: "Basic information", description: "Router profile" },
  { key: "network", title: "Network", description: "IP, DNS & gateway" },
  { key: "auth", title: "Authentication", description: "NAS, API & RADIUS" },
  { key: "services", title: "Services", description: "Enable modules" },
] as const;

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

const DEFAULTS: RouterWizardValues = {
  basic: { name: "", organizationId: "", locationId: "", model: "", serialNumber: "", mikrotikIdentity: "" },
  network: { wanIp: "", lanIp: "", dns: "1.1.1.1, 8.8.8.8", gateway: "", timezone: "" },
  auth: { nasId: "", sharedSecret: "", apiPort: 8728, apiUsername: "cloudguest", apiPassword: "" },
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
  const create = useCreateRouter();
  const orgs = routerService.organizations();
  const locations = routerService.locations();
  const models = routerService.models();

  const form = useForm<RouterWizardValues>({
    resolver: zodResolver(routerWizardSchema),
    defaultValues: DEFAULTS,
    mode: "onBlur",
  });

  async function next() {
    const key = STEPS[step].key;
    const valid = await form.trigger(key);
    if (valid) setStep((s) => Math.min(STEPS.length - 1, s + 1));
  }

  async function submit(values: RouterWizardValues) {
    try {
      const r = await create.mutateAsync(values);
      toast.success(`${r.name} provisioning started`);
      onOpenChange(false);
      form.reset(DEFAULTS);
      setStep(0);
    } catch {
      toast.error("Failed to add router");
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
          <DialogTitle>Add router</DialogTitle>
          <DialogDescription>Provision a new MikroTik router in four steps.</DialogDescription>
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
            <form onSubmit={form.handleSubmit(submit)} className="flex min-h-[460px] flex-col">
              <div className="flex-1 overflow-y-auto px-6 py-5">
                {step === 0 && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <TextField name="basic.name" label="Router name" placeholder="SF-RTR-001" form={form} />
                    <TextField name="basic.mikrotikIdentity" label="MikroTik identity" placeholder="mt-nimbus-1" form={form} />
                    <SelectFieldOpts name="basic.organizationId" label="Organization" options={orgs} form={form} />
                    <SelectFieldOpts name="basic.locationId" label="Location" options={locations} form={form} />
                    <FormField
                      control={form.control}
                      name="basic.model"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Router model</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select model" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {models.map((m) => (
                                <SelectItem key={m} value={m}>
                                  {m}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <TextField name="basic.serialNumber" label="Serial number" placeholder="SN01234567" form={form} />
                  </div>
                )}
                {step === 1 && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <TextField name="network.wanIp" label="WAN IP" placeholder="203.0.113.10" form={form} />
                    <TextField name="network.lanIp" label="LAN IP" placeholder="192.168.10.1" form={form} />
                    <TextField name="network.gateway" label="Gateway" placeholder="203.0.113.1" form={form} />
                    <TextField name="network.dns" label="DNS servers" placeholder="1.1.1.1, 8.8.8.8" form={form} />
                    <div className="sm:col-span-2">
                      <SelectFieldStrings name="network.timezone" label="Timezone" options={TIMEZONES} form={form} />
                    </div>
                  </div>
                )}
                {step === 2 && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <TextField name="auth.nasId" label="NAS ID" placeholder="nas-nimbus-1001" form={form} />
                    <TextField name="auth.sharedSecret" label="Shared secret" type="password" form={form} />
                    <TextField name="auth.apiPort" label="Router API port" type="number" form={form} />
                    <TextField name="auth.apiUsername" label="API username" form={form} />
                    <div className="sm:col-span-2">
                      <TextField name="auth.apiPassword" label="API password" type="password" form={form} />
                    </div>
                  </div>
                )}
                {step === 3 && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <ToggleField name="services.freeradius" label="FreeRADIUS" description="AAA & accounting" form={form} />
                    <ToggleField name="services.wireguard" label="WireGuard" description="Management tunnel" form={form} />
                    <ToggleField name="services.captivePortal" label="Captive portal" description="Guest splash page" form={form} />
                    <ToggleField name="services.guestWifi" label="Guest WiFi" description="Public guest network" form={form} />
                    <ToggleField name="services.monitoring" label="Monitoring" description="Live metrics collection" form={form} />
                    <ToggleField name="services.analytics" label="Analytics" description="Session & usage analytics" form={form} />
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between gap-3 border-t border-border/70 bg-muted/20 px-6 py-3">
                <div className="text-xs text-muted-foreground">
                  Step {step + 1} of {STEPS.length}
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
                    <ChevronLeft className="h-4 w-4" /> Back
                  </Button>
                  {step < STEPS.length - 1 ? (
                    <Button type="button" onClick={next}>
                      Next <ChevronRight className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button type="submit" disabled={create.isPending}>
                      {create.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                      <span className={create.isPending ? "ml-2" : ""}>Add router</span>
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
function SelectFieldOpts({ name, label, options, form }: { name: any; label: string; options: { id: string; name: string }[]; form: any }) {
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function SelectFieldStrings({ name, label, options, form }: { name: any; label: string; options: string[]; form: any }) {
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
