import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { MessageSquare } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { smsBrandingSchema, type SmsBrandingFormValues } from "@/lib/branding-schemas";
import { useSaveBrand, useSaveSmsTemplate } from "@/hooks/useBranding";
import type { Brand, SmsTemplate } from "@/types/branding";

export function SmsBrandingPanel({ brand }: { brand: Brand }) {
  const save = useSaveBrand();
  const form = useForm<SmsBrandingFormValues>({
    resolver: zodResolver(smsBrandingSchema),
    defaultValues: brand.sms,
  });

  useEffect(() => form.reset(brand.sms), [brand.id, brand.sms, form]);

  const onSubmit = (v: SmsBrandingFormValues) =>
    save.mutate({ ...brand, sms: v }, { onSuccess: () => toast.success("SMS branding saved") });

  const [active, setActive] = useState(brand.smsTemplates[0]?.id);
  useEffect(() => setActive(brand.smsTemplates[0]?.id), [brand.id, brand.smsTemplates]);
  const current = brand.smsTemplates.find((t) => t.id === active) ?? brand.smsTemplates[0];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">SMS branding</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 md:grid-cols-2">
            <div>
              <Label className="text-xs">Sender name (3-11 chars)</Label>
              <Input className="mt-1 uppercase" maxLength={11} {...form.register("senderName")} />
              {form.formState.errors.senderName && <p className="mt-1 text-xs text-destructive">{form.formState.errors.senderName.message}</p>}
            </div>
            <div>
              <Label className="text-xs">SMS footer</Label>
              <Input className="mt-1" {...form.register("footer")} />
            </div>
            <div className="md:col-span-2"><Button type="submit" disabled={save.isPending}>{save.isPending ? "Saving…" : "Save SMS branding"}</Button></div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">SMS templates</CardTitle></CardHeader>
        <CardContent>
          <Tabs value={active} onValueChange={setActive}>
            <TabsList className="flex-wrap justify-start bg-muted/40">
              {brand.smsTemplates.map((t) => <TabsTrigger key={t.id} value={t.id}>{t.name}</TabsTrigger>)}
            </TabsList>
            {current && (
              <TabsContent value={current.id} className="mt-4">
                <SmsEditor brandId={brand.id} tpl={current} />
              </TabsContent>
            )}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

function SmsEditor({ brandId, tpl }: { brandId: string; tpl: SmsTemplate }) {
  const save = useSaveSmsTemplate();
  const [body, setBody] = useState(tpl.body);
  useEffect(() => setBody(tpl.body), [tpl.id, tpl.body]);
  const chars = body.length;
  const segments = Math.ceil(chars / 160) || 1;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-3">
        <Label className="text-xs">Message body</Label>
        <Textarea rows={6} className="font-mono text-xs" value={body} onChange={(e) => setBody(e.target.value)} />
        <div className="text-xs text-muted-foreground">{chars} chars · {segments} segment{segments > 1 ? "s" : ""}</div>
        <Button
          onClick={() => save.mutate({ brandId, tpl: { ...tpl, body } }, { onSuccess: () => toast.success("SMS template saved") })}
          disabled={save.isPending}
        >
          {save.isPending ? "Saving…" : "Save template"}
        </Button>
      </div>
      <div className="rounded-2xl border bg-muted/20 p-4">
        <div className="mx-auto max-w-xs rounded-2xl bg-background p-4 shadow">
          <div className="flex items-center gap-2 border-b pb-2">
            <MessageSquare className="h-4 w-4 text-primary" />
            <span className="text-xs font-semibold">SMS preview</span>
          </div>
          <p className="mt-3 whitespace-pre-wrap text-sm">{body}</p>
        </div>
      </div>
    </div>
  );
}
