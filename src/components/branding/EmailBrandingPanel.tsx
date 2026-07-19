import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { emailBrandingSchema, type EmailBrandingFormValues } from "@/lib/branding-schemas";
import { useSaveBrand, useSaveEmailTemplate } from "@/hooks/useBranding";
import type { Brand, EmailTemplate } from "@/types/branding";

export function EmailBrandingPanel({ brand }: { brand: Brand }) {
  const save = useSaveBrand();
  const form = useForm<EmailBrandingFormValues>({
    resolver: zodResolver(emailBrandingSchema),
    defaultValues: { header: brand.email.header, footer: brand.email.footer, companyLogo: brand.email.companyLogo, companyAddress: brand.email.companyAddress },
  });

  useEffect(() => form.reset({ header: brand.email.header, footer: brand.email.footer, companyLogo: brand.email.companyLogo, companyAddress: brand.email.companyAddress }), [brand.id, brand.email, form]);

  const onSubmit = (v: EmailBrandingFormValues) => {
    save.mutate({ ...brand, email: { ...brand.email, ...v } }, { onSuccess: () => toast.success("Email branding saved") });
  };

  const updateSocial = (key: "twitter" | "linkedin" | "facebook" | "instagram", value: string) => {
    save.mutate({ ...brand, email: { ...brand.email, socials: { ...brand.email.socials, [key]: value } } });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Email branding</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 md:grid-cols-2">
            <div><Label className="text-xs">Header</Label><Input className="mt-1" {...form.register("header")} /></div>
            <div><Label className="text-xs">Company logo URL</Label><Input className="mt-1" {...form.register("companyLogo")} /></div>
            <div className="md:col-span-2"><Label className="text-xs">Footer</Label><Textarea rows={2} className="mt-1" {...form.register("footer")} /></div>
            <div className="md:col-span-2"><Label className="text-xs">Company address</Label><Input className="mt-1" {...form.register("companyAddress")} /></div>
            <div className="md:col-span-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {(["twitter", "linkedin", "facebook", "instagram"] as const).map((k) => (
                <div key={k}>
                  <Label className="text-xs capitalize">{k}</Label>
                  <Input
                    className="mt-1"
                    defaultValue={brand.email.socials[k] ?? ""}
                    onBlur={(e) => e.target.value !== (brand.email.socials[k] ?? "") && updateSocial(k, e.target.value)}
                  />
                </div>
              ))}
            </div>
            <div className="md:col-span-2"><Button type="submit" disabled={save.isPending}>{save.isPending ? "Saving…" : "Save email branding"}</Button></div>
          </form>
        </CardContent>
      </Card>

      <EmailTemplatesEditor brand={brand} />
    </div>
  );
}

function EmailTemplatesEditor({ brand }: { brand: Brand }) {
  const [active, setActive] = useState(brand.emailTemplates[0]?.id);
  useEffect(() => setActive(brand.emailTemplates[0]?.id), [brand.id, brand.emailTemplates]);
  const current = brand.emailTemplates.find((t) => t.id === active) ?? brand.emailTemplates[0];
  return (
    <Card>
      <CardHeader className="pb-3"><CardTitle className="text-base">Email templates</CardTitle></CardHeader>
      <CardContent>
        <Tabs value={active} onValueChange={setActive}>
          <TabsList className="flex-wrap justify-start bg-muted/40">
            {brand.emailTemplates.map((t) => <TabsTrigger key={t.id} value={t.id}>{t.name}</TabsTrigger>)}
          </TabsList>
          {current && (
            <TabsContent value={current.id} className="mt-4">
              <TemplateEditor brandId={brand.id} tpl={current} />
            </TabsContent>
          )}
        </Tabs>
      </CardContent>
    </Card>
  );
}

function TemplateEditor({ brandId, tpl }: { brandId: string; tpl: EmailTemplate }) {
  const save = useSaveEmailTemplate();
  const [subject, setSubject] = useState(tpl.subject);
  const [body, setBody] = useState(tpl.body);
  useEffect(() => { setSubject(tpl.subject); setBody(tpl.body); }, [tpl.id, tpl.subject, tpl.body]);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-3">
        <div><Label className="text-xs">Subject</Label><Input className="mt-1" value={subject} onChange={(e) => setSubject(e.target.value)} /></div>
        <div><Label className="text-xs">Body</Label><Textarea className="mt-1 font-mono text-xs" rows={12} value={body} onChange={(e) => setBody(e.target.value)} /></div>
        <Button
          onClick={() => save.mutate({ brandId, tpl: { ...tpl, subject, body } }, { onSuccess: () => toast.success("Template saved") })}
          disabled={save.isPending}
        >
          {save.isPending ? "Saving…" : "Save template"}
        </Button>
      </div>
      <div className="rounded-lg border bg-background p-4 text-sm">
        <div className="mb-2 text-xs text-muted-foreground">Preview</div>
        <div className="font-semibold">{subject}</div>
        <div className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{body}</div>
      </div>
    </div>
  );
}
