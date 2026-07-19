import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SectionCard, FieldGrid } from "./SectionCard";
import { generalSchema } from "@/lib/settings-schemas";
import type { GeneralSettings } from "@/types/settings";
import { useUpdateSection } from "@/hooks/useSettings";

const LANGS = [
  { v: "en", l: "English" }, { v: "hi", l: "Hindi" }, { v: "ar", l: "Arabic" },
  { v: "fr", l: "French" }, { v: "es", l: "Spanish" },
];
const TZS = ["UTC", "America/New_York", "America/Los_Angeles", "Europe/London", "Europe/Berlin", "Asia/Kolkata", "Asia/Singapore", "Asia/Dubai"];
const CURR = ["USD", "EUR", "GBP", "INR", "AED", "SGD", "AUD"];
const DATE_FMT = ["DD MMM YYYY", "MM/DD/YYYY", "YYYY-MM-DD", "DD/MM/YYYY"];

export function GeneralPanel({ data }: { data: GeneralSettings }) {
  const mut = useUpdateSection<"general">();
  const form = useForm<GeneralSettings>({ resolver: zodResolver(generalSchema), defaultValues: data });

  const onSubmit = form.handleSubmit((values) =>
    mut.mutate({ section: "general", value: values }, { onSuccess: () => toast.success("General settings saved") }),
  );

  return (
    <SectionCard
      title="General"
      description="Platform identity, locale and formatting defaults."
      actions={<Button size="sm" onClick={onSubmit} disabled={mut.isPending}><Save className="mr-2 h-4 w-4" /> Save</Button>}
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <FieldGrid>
          <Field label="Platform name" error={form.formState.errors.platformName?.message}>
            <Input {...form.register("platformName")} />
          </Field>
          <Field label="Company name" error={form.formState.errors.companyName?.message}>
            <Input {...form.register("companyName")} />
          </Field>
          <Field label="Support email" error={form.formState.errors.supportEmail?.message}>
            <Input type="email" {...form.register("supportEmail")} />
          </Field>
          <Field label="Support phone" error={form.formState.errors.supportPhone?.message}>
            <Input {...form.register("supportPhone")} />
          </Field>
          <Field label="Website" error={form.formState.errors.website?.message}>
            <Input {...form.register("website")} />
          </Field>
          <Field label="Default language">
            <Select value={form.watch("defaultLanguage")} onValueChange={(v) => form.setValue("defaultLanguage", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{LANGS.map((l) => <SelectItem key={l.v} value={l.v}>{l.l}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Timezone">
            <Select value={form.watch("timezone")} onValueChange={(v) => form.setValue("timezone", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{TZS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Currency">
            <Select value={form.watch("currency")} onValueChange={(v) => form.setValue("currency", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{CURR.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Date format">
            <Select value={form.watch("dateFormat")} onValueChange={(v) => form.setValue("dateFormat", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{DATE_FMT.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Time format">
            <Select value={form.watch("timeFormat")} onValueChange={(v) => form.setValue("timeFormat", v as "12h" | "24h")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="12h">12 hour</SelectItem>
                <SelectItem value="24h">24 hour</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </FieldGrid>
      </form>
    </SectionCard>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
