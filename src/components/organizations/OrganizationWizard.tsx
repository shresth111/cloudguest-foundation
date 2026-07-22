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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { orgWizardSchema, type OrgWizardValues } from "@/lib/organization-schemas";
import { useCreateOrganization } from "@/hooks/useOrganizations";
import type { AppError } from "@/services/api";

const STEPS = [
  { key: "basic", title: "Basic information", description: "Name & identifiers" },
  { key: "contact", title: "Contact", description: "Who we reach out to" },
  { key: "settings", title: "Settings", description: "Locale & subscription" },
] as const;

const ORG_TYPES = ["standard", "msp"] as const;
const TIMEZONES = ["UTC", "America/Los_Angeles", "America/New_York", "Europe/London", "Europe/Berlin", "Asia/Kolkata", "Asia/Singapore", "Asia/Dubai"];
const LOCALES = ["en", "en-GB", "hi", "de", "fr", "es"];

interface Props { open: boolean; onOpenChange: (o: boolean) => void }

const DEFAULTS: OrgWizardValues = {
  basic: { name: "", slug: "", legalName: "", orgType: "standard" },
  contact: { contactEmail: "", contactPhone: "" },
  settings: { timezone: "UTC", defaultLocale: "en", subscriptionTier: "" },
};

export function OrganizationWizard({ open, onOpenChange }: Props) {
  const [step, setStep] = useState(0);
  const create = useCreateOrganization();

  const form = useForm<OrgWizardValues>({
    resolver: zodResolver(orgWizardSchema),
    defaultValues: DEFAULTS,
    mode: "onBlur",
  });

  async function next() {
    const key = STEPS[step].key;
    const valid = await form.trigger(key);
    if (valid) setStep((s) => Math.min(STEPS.length - 1, s + 1));
  }

  async function submit(values: OrgWizardValues) {
    try {
      const org = await create.mutateAsync({
        basic: values.basic,
        contact: values.contact,
        settings: values.settings,
      });
      toast.success(`${org.name} created`);
      onOpenChange(false);
      form.reset(DEFAULTS);
      setStep(0);
    } catch (err) {
      toast.error((err as AppError).message || "Failed to create organization");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) { form.reset(DEFAULTS); setStep(0); } }}>
      <DialogContent className="max-w-3xl gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-border/70 px-6 py-4">
          <DialogTitle>Create organization</DialogTitle>
          <DialogDescription>Set up a new tenant on CloudGuest.</DialogDescription>
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
                      <div className={cn(
                        "mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border text-xs font-medium",
                        done && "border-primary bg-primary text-primary-foreground",
                        active && "border-primary text-primary",
                        !done && !active && "border-border text-muted-foreground",
                      )}>
                        {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
                      </div>
                      <div>
                        <div className={cn("text-sm font-medium", !active && !done && "text-muted-foreground")}>{s.title}</div>
                        <div className="text-xs text-muted-foreground">{s.description}</div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ol>
          </aside>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(submit)} className="flex min-h-[380px] flex-col">
              <div className="flex-1 overflow-y-auto px-6 py-5">
                {step === 0 && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <TextField name="basic.name" label="Organization name" placeholder="Nimbus Hospitality" form={form} />
                    <TextField name="basic.slug" label="Slug" placeholder="nimbus-hospitality" form={form} />
                    <TextField name="basic.legalName" label="Legal name (optional)" placeholder="Nimbus Pvt Ltd" form={form} />
                    <SelectField name="basic.orgType" label="Organization type" options={ORG_TYPES} form={form} capitalize />
                  </div>
                )}
                {step === 1 && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <TextField name="contact.contactEmail" label="Contact email" placeholder="ops@example.com" form={form} />
                    <TextField name="contact.contactPhone" label="Contact phone (optional)" placeholder="+1 415 555 0100" form={form} />
                  </div>
                )}
                {step === 2 && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <SelectField name="settings.timezone" label="Timezone" options={TIMEZONES} form={form} />
                    <SelectField name="settings.defaultLocale" label="Default locale" options={LOCALES} form={form} />
                    <TextField name="settings.subscriptionTier" label="Subscription tier (optional)" placeholder="starter" form={form} />
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between gap-3 border-t border-border/70 bg-muted/20 px-6 py-3">
                <div className="text-xs text-muted-foreground">Step {step + 1} of {STEPS.length}</div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
                    <ChevronLeft className="h-4 w-4" /> Back
                  </Button>
                  {step < STEPS.length - 1 ? (
                    <Button type="button" onClick={next}>Next <ChevronRight className="h-4 w-4" /></Button>
                  ) : (
                    <Button type="submit" disabled={create.isPending}>
                      {create.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                      <span className={create.isPending ? "ml-2" : ""}>Create organization</span>
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
    <FormField control={form.control} name={name} render={({ field }) => (
      <FormItem>
        <FormLabel>{label}</FormLabel>
        <FormControl><Input type={type ?? "text"} placeholder={placeholder} {...field} /></FormControl>
        <FormMessage />
      </FormItem>
    )} />
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function SelectField({ name, label, options, form, capitalize }: { name: any; label: string; options: readonly string[]; form: any; capitalize?: boolean }) {
  return (
    <FormField control={form.control} name={name} render={({ field }) => (
      <FormItem>
        <FormLabel>{label}</FormLabel>
        <Select value={field.value} onValueChange={field.onChange}>
          <FormControl><SelectTrigger><SelectValue placeholder={`Select ${label.toLowerCase()}`} /></SelectTrigger></FormControl>
          <SelectContent>
            {options.map((o) => <SelectItem key={o} value={o} className={capitalize ? "capitalize" : ""}>{o}</SelectItem>)}
          </SelectContent>
        </Select>
        <FormMessage />
      </FormItem>
    )} />
  );
}
