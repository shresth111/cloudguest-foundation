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
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { orgWizardSchema, type OrgWizardValues } from "@/lib/organization-schemas";
import { useCreateOrganization } from "@/hooks/useOrganizations";

const STEPS = [
  { key: "basic", title: "Basic information", description: "Company profile & identifiers" },
  { key: "contact", title: "Primary contact", description: "Who we reach out to" },
  { key: "address", title: "Address", description: "Head-office location" },
  { key: "subscription", title: "Subscription", description: "Plan & billing" },
  { key: "admin", title: "Administrator", description: "First admin account" },
] as const;

const INDUSTRIES = ["Hospitality", "Retail", "Education", "Healthcare", "F&B", "Coworking", "Transport"];
const COMPANY_SIZES = ["1-10", "11-50", "51-200", "201-500", "500+"];
const COUNTRIES = ["USA", "UK", "India", "Singapore", "UAE", "Germany", "Australia"];
const TIMEZONES = ["America/Los_Angeles", "America/New_York", "Europe/London", "Europe/Berlin", "Asia/Kolkata", "Asia/Singapore", "Asia/Dubai"];

interface Props { open: boolean; onOpenChange: (o: boolean) => void }

const DEFAULTS: OrgWizardValues = {
  basic: { name: "", businessName: "", industry: "", companySize: "", gstNumber: "", website: "" },
  contact: { contactName: "", contactEmail: "", contactPhone: "", contactDesignation: "" },
  address: { country: "", state: "", city: "", address: "", zipCode: "", timezone: "" },
  subscription: { plan: "growth", billingCycle: "monthly", trial: true, expiryDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10) },
  admin: { adminName: "", adminEmail: "", adminPhone: "", tempPassword: "" },
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
        address: values.address,
        subscription: values.subscription,
        admin: values.admin,
      });
      toast.success(`${org.name} created`);
      onOpenChange(false);
      form.reset(DEFAULTS);
      setStep(0);
    } catch {
      toast.error("Failed to create organization");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) { form.reset(DEFAULTS); setStep(0); } }}>
      <DialogContent className="max-w-3xl gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-border/70 px-6 py-4">
          <DialogTitle>Create organization</DialogTitle>
          <DialogDescription>Set up a new tenant on CloudGuest in five quick steps.</DialogDescription>
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
            <form onSubmit={form.handleSubmit(submit)} className="flex min-h-[440px] flex-col">
              <div className="flex-1 overflow-y-auto px-6 py-5">
                {step === 0 && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <TextField name="basic.name" label="Organization name" placeholder="Nimbus Hospitality" form={form} />
                    <TextField name="basic.businessName" label="Legal business name" placeholder="Nimbus Pvt Ltd" form={form} />
                    <SelectField name="basic.industry" label="Industry" options={INDUSTRIES} form={form} />
                    <SelectField name="basic.companySize" label="Company size" options={COMPANY_SIZES} form={form} />
                    <TextField name="basic.gstNumber" label="GST / Tax ID (optional)" placeholder="29ABCDE1234F1Z5" form={form} />
                    <TextField name="basic.website" label="Website (optional)" placeholder="https://example.com" form={form} />
                  </div>
                )}
                {step === 1 && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <TextField name="contact.contactName" label="Full name" placeholder="Ava Chen" form={form} />
                    <TextField name="contact.contactEmail" label="Work email" placeholder="ava@example.com" form={form} />
                    <TextField name="contact.contactPhone" label="Mobile" placeholder="+1 415 555 0100" form={form} />
                    <TextField name="contact.contactDesignation" label="Designation" placeholder="IT Director" form={form} />
                  </div>
                )}
                {step === 2 && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <SelectField name="address.country" label="Country" options={COUNTRIES} form={form} />
                    <TextField name="address.state" label="State / Region" form={form} />
                    <TextField name="address.city" label="City" form={form} />
                    <TextField name="address.zipCode" label="ZIP / Postal code" form={form} />
                    <div className="sm:col-span-2"><TextField name="address.address" label="Street address" form={form} /></div>
                    <SelectField name="address.timezone" label="Timezone" options={TIMEZONES} form={form} />
                  </div>
                )}
                {step === 3 && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <SelectField name="subscription.plan" label="Plan" options={["starter", "growth", "business", "enterprise"]} form={form} capitalize />
                    <SelectField name="subscription.billingCycle" label="Billing cycle" options={["monthly", "quarterly", "annual"]} form={form} capitalize />
                    <FormField control={form.control} name="subscription.trial" render={({ field }) => (
                      <FormItem className="flex flex-col rounded-lg border border-border/70 p-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <FormLabel className="text-sm">Start trial</FormLabel>
                            <FormDescription className="text-xs">30-day complimentary access</FormDescription>
                          </div>
                          <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                        </div>
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="subscription.expiryDate" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Expiry date</FormLabel>
                        <FormControl><Input type="date" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                )}
                {step === 4 && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <TextField name="admin.adminName" label="Admin name" placeholder="Jane Doe" form={form} />
                    <TextField name="admin.adminEmail" label="Admin email" placeholder="admin@example.com" form={form} />
                    <TextField name="admin.adminPhone" label="Admin phone" placeholder="+1 415 555 0101" form={form} />
                    <TextField name="admin.tempPassword" label="Temporary password" placeholder="Min 8 chars, 1 upper, 1 number" type="password" form={form} />
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
function SelectField({ name, label, options, form, capitalize }: { name: any; label: string; options: string[]; form: any; capitalize?: boolean }) {
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
