import { useEffect } from "react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { portalBrandingSchema, type PortalBrandingFormValues } from "@/lib/branding-schemas";
import { useSaveBrand } from "@/hooks/useBranding";
import type { Brand } from "@/types/branding";

export function PortalBrandingPanel({ brand }: { brand: Brand }) {
  const save = useSaveBrand();
  const form = useForm<PortalBrandingFormValues>({
    resolver: zodResolver(portalBrandingSchema),
    defaultValues: brand.portal,
  });

  useEffect(() => form.reset(brand.portal), [brand.id, brand.portal, form]);

  const onSubmit = (v: PortalBrandingFormValues) =>
    save.mutate({ ...brand, portal: v }, { onSuccess: () => toast.success("Portal branding saved") });

  return (
    <Card>
      <CardHeader className="pb-3"><CardTitle className="text-base">Captive portal branding</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 md:grid-cols-2">
          <div><Label className="text-xs">Logo URL</Label><Input className="mt-1" {...form.register("logo")} /></div>
          <div><Label className="text-xs">Background URL</Label><Input className="mt-1" {...form.register("background")} /></div>
          <ColorField label="Primary color" register={form.register("primary")} value={form.watch("primary")} onChange={(v) => form.setValue("primary", v)} />
          <ColorField label="Accent color" register={form.register("accent")} value={form.watch("accent")} onChange={(v) => form.setValue("accent", v)} />
          <div><Label className="text-xs">Font</Label><Input className="mt-1" {...form.register("font")} /></div>
          <div><Label className="text-xs">Welcome message</Label><Input className="mt-1" {...form.register("welcomeMessage")} /></div>
          <div className="md:col-span-2"><Label className="text-xs">Footer</Label><Input className="mt-1" {...form.register("footer")} /></div>
          <div className="md:col-span-2"><Label className="text-xs">Terms</Label><Textarea rows={2} className="mt-1" {...form.register("terms")} /></div>
          <div className="md:col-span-2"><Label className="text-xs">Privacy policy</Label><Textarea rows={2} className="mt-1" {...form.register("privacy")} /></div>
          <div className="md:col-span-2"><Button type="submit" disabled={save.isPending}>{save.isPending ? "Saving…" : "Save portal branding"}</Button></div>
        </form>
      </CardContent>
    </Card>
  );
}

function ColorField({ label, register, value, onChange }: { label: string; register: ReturnType<ReturnType<typeof useForm<PortalBrandingFormValues>>["register"]>; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <div className="mt-1 flex items-center gap-2">
        <label className="h-9 w-10 shrink-0 cursor-pointer overflow-hidden rounded-md border" style={{ background: value }}>
          <input type="color" className="h-full w-full cursor-pointer opacity-0" value={value} onChange={(e) => onChange(e.target.value)} />
        </label>
        <Input className="font-mono text-xs" {...register} />
      </div>
    </div>
  );
}
