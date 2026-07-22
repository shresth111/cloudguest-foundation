import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
import type { AppError } from "@/services/api";

const STEPS = [
  { key: "basic", title: "Basic information", description: "Router profile" },
  { key: "credentials", title: "Credentials", description: "API access (optional)" },
  { key: "services", title: "Services", description: "Config preferences" },
] as const;

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

const DEFAULTS: RouterWizardValues = {
  basic: { name: "", locationId: "", model: "", serialNumber: "", macAddress: "", managementIpAddress: "", publicIpAddress: "" },
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
  const create = useCreateRouter();
  const { data: locations = [] } = useQuery({
    queryKey: ["routers", "location-options"],
    queryFn: () => routerService.locations(),
    enabled: open,
  });
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
      const r = await create.mutateAsync({
        locationId: values.basic.locationId,
        name: values.basic.name,
        serialNumber: values.basic.serialNumber,
        macAddress: values.basic.macAddress,
        model: values.basic.model,
        managementIpAddress: values.basic.managementIpAddress || undefined,
        publicIpAddress: values.basic.publicIpAddress || undefined,
        apiUsername: values.credentials.apiUsername || undefined,
        apiSecret: values.credentials.apiSecret || undefined,
        settings: values.services,
      });
      toast.success(`${r.name} registered`);
      onOpenChange(false);
      form.reset(DEFAULTS);
      setStep(0);
    } catch (err) {
      toast.error((err as AppError).message || "Failed to add router");
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
          <DialogDescription>Register a new router at a location you manage.</DialogDescription>
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
            <form onSubmit={form.handleSubmit(submit)} className="flex min-h-[420px] flex-col">
              <div className="flex-1 overflow-y-auto px-6 py-5">
                {step === 0 && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <TextField name="basic.name" label="Router name" placeholder="Lobby Router" form={form} />
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
                    <TextField name="basic.macAddress" label="MAC address" placeholder="AA:BB:CC:DD:EE:01" form={form} />
                    <TextField name="basic.managementIpAddress" label="Management IP (optional)" placeholder="192.168.88.1" form={form} />
                    <TextField name="basic.publicIpAddress" label="Public IP (optional)" placeholder="203.0.113.10" form={form} />
                  </div>
                )}
                {step === 1 && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <TextField name="credentials.apiUsername" label="API username (optional)" form={form} />
                    <TextField name="credentials.apiSecret" label="API secret (optional)" type="password" form={form} />
                    <p className="sm:col-span-2 text-xs text-muted-foreground">
                      Stored encrypted server-side. Never shown again after this form — the API never returns it back.
                    </p>
                  </div>
                )}
                {step === 2 && (
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
