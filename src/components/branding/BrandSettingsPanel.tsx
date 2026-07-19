import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { brandInfoSchema, type BrandInfoFormValues } from "@/lib/branding-schemas";
import { useSaveBrand } from "@/hooks/useBranding";
import type { Brand, BrandLogos, Language } from "@/types/branding";
import { useEffect } from "react";

const LOGO_FIELDS: { key: keyof BrandLogos; label: string }[] = [
  { key: "company", label: "Company logo" },
  { key: "favicon", label: "Favicon" },
  { key: "login", label: "Login logo" },
  { key: "dashboard", label: "Dashboard logo" },
  { key: "mobile", label: "Mobile logo" },
  { key: "footer", label: "Footer logo" },
  { key: "watermark", label: "Watermark logo" },
];

const LANGS: { value: Language; label: string }[] = [
  { value: "en", label: "English" },
  { value: "hi", label: "Hindi" },
  { value: "ar", label: "Arabic" },
  { value: "fr", label: "French" },
  { value: "es", label: "Spanish" },
];

export function BrandSettingsPanel({ brand }: { brand: Brand }) {
  const save = useSaveBrand();
  const form = useForm<BrandInfoFormValues>({
    resolver: zodResolver(brandInfoSchema),
    defaultValues: { name: brand.name, companyName: brand.companyName, language: brand.language },
  });

  useEffect(() => {
    form.reset({ name: brand.name, companyName: brand.companyName, language: brand.language });
  }, [brand.id, brand.name, brand.companyName, brand.language, form]);

  const updateLogo = (key: keyof BrandLogos, value: string) => {
    save.mutate({ ...brand, logos: { ...brand.logos, [key]: value } });
  };

  const onSubmit = (values: BrandInfoFormValues) => {
    save.mutate({ ...brand, ...values }, { onSuccess: () => toast.success("Brand info saved") });
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Brand information</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <Label>Company name</Label>
              <Input className="mt-1" {...form.register("companyName")} />
              {form.formState.errors.companyName && <p className="mt-1 text-xs text-destructive">{form.formState.errors.companyName.message}</p>}
            </div>
            <div>
              <Label>Brand name</Label>
              <Input className="mt-1" {...form.register("name")} />
              {form.formState.errors.name && <p className="mt-1 text-xs text-destructive">{form.formState.errors.name.message}</p>}
            </div>
            <div>
              <Label>Default language</Label>
              <Select value={form.watch("language")} onValueChange={(v) => form.setValue("language", v as Language)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LANGS.map((l) => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" disabled={save.isPending}>{save.isPending ? "Saving…" : "Save changes"}</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Logos</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {LOGO_FIELDS.map((f) => (
            <div key={f.key} className="flex items-center gap-3">
              <img src={brand.logos[f.key]} alt="" className="h-10 w-10 rounded-md border object-cover" />
              <div className="flex-1">
                <Label className="text-xs">{f.label}</Label>
                <Input
                  className="mt-1 h-8 text-xs"
                  defaultValue={brand.logos[f.key]}
                  onBlur={(e) => e.target.value !== brand.logos[f.key] && updateLogo(f.key, e.target.value)}
                  placeholder="https://…"
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
