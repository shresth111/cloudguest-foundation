import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  loginSettingsSchema,
  seoSchema,
  type LoginSettingsValues,
  type SeoValues,
} from "@/lib/portal-schemas";
import { useUpdatePortal } from "@/hooks/usePortals";
import type { Portal, PortalLanguage } from "@/types/portal";
import { LANGUAGES } from "@/types/portal";

export function PortalLoginSettingsPanel({ portal }: { portal: Portal }) {
  const update = useUpdatePortal(portal.id);
  const { register, handleSubmit, watch, setValue, formState } = useForm<LoginSettingsValues>({
    resolver: zodResolver(loginSettingsSchema),
    defaultValues: portal.login,
  });
  const v = watch();
  const submit = handleSubmit((values) => update.mutate({ login: { ...values, redirectUrl: values.redirectUrl ?? "", successPage: values.successPage ?? "", failurePage: values.failurePage ?? "" } }));

  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Login settings</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
          <NumberRow label="Session timeout (min)" reg={register("sessionTimeoutMinutes", { valueAsNumber: true })} error={formState.errors.sessionTimeoutMinutes?.message} />
          <NumberRow label="Idle timeout (min)" reg={register("idleTimeoutMinutes", { valueAsNumber: true })} error={formState.errors.idleTimeoutMinutes?.message} />
          <NumberRow label="Device limit" reg={register("deviceLimit", { valueAsNumber: true })} error={formState.errors.deviceLimit?.message} />
          <TextRow label="Redirect URL" reg={register("redirectUrl")} placeholder="https://…" />
          <TextRow label="Success page URL" reg={register("successPage")} placeholder="https://…" />
          <TextRow label="Failure page URL" reg={register("failurePage")} placeholder="https://…" />
          <ToggleRow label="Auto login" value={v.autoLogin} onChange={(x) => setValue("autoLogin", x)} />
          <ToggleRow label="Remember device" value={v.rememberDevice} onChange={(x) => setValue("rememberDevice", x)} />
          <div className="md:col-span-2 flex justify-end">
            <Button type="submit" size="sm"><Save className="mr-2 h-4 w-4" />Save settings</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export function PortalSeoPanel({ portal }: { portal: Portal }) {
  const update = useUpdatePortal(portal.id);
  const { register, handleSubmit, formState } = useForm<SeoValues>({
    resolver: zodResolver(seoSchema),
    defaultValues: portal.seo,
  });
  const submit = handleSubmit((v) => update.mutate({ seo: { ...v, faviconUrl: v.faviconUrl ?? "", socialImageUrl: v.socialImageUrl ?? "" } }));
  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">SEO & metadata</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={submit} className="grid gap-3 md:grid-cols-2">
          <TextRow label="Page title" reg={register("pageTitle")} placeholder="Sign in to WiFi" error={formState.errors.pageTitle?.message} />
          <TextRow label="Meta description" reg={register("metaDescription")} placeholder="Description shown in search results" />
          <TextRow label="Favicon URL" reg={register("faviconUrl")} placeholder="https://…/favicon.ico" />
          <TextRow label="Social preview image" reg={register("socialImageUrl")} placeholder="https://…/og.jpg" />
          <div className="md:col-span-2 flex justify-end">
            <Button type="submit" size="sm"><Save className="mr-2 h-4 w-4" />Save SEO</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export function PortalLanguagesPanel({ portal }: { portal: Portal }) {
  const update = useUpdatePortal(portal.id);
  const toggle = (lang: PortalLanguage) => {
    const has = portal.languages.includes(lang);
    const next = has ? portal.languages.filter((l) => l !== lang) : [...portal.languages, lang];
    update.mutate({ languages: next.length ? next : ["en"] });
  };
  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Multi-language</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-2 md:grid-cols-2">
          {(Object.keys(LANGUAGES) as PortalLanguage[]).map((l) => {
            const on = portal.languages.includes(l);
            return (
              <button
                key={l}
                onClick={() => toggle(l)}
                className={`flex items-center justify-between rounded-md border p-3 text-left ${on ? "border-primary bg-primary/5" : ""}`}
              >
                <div>
                  <div className="text-sm font-medium">{LANGUAGES[l]}</div>
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{l}</div>
                </div>
                {on && <Badge variant="secondary">Enabled</Badge>}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs">Default language</Label>
          <select
            className="rounded-md border bg-background px-2 py-1 text-sm"
            value={portal.defaultLanguage}
            onChange={(e) => update.mutate({ defaultLanguage: e.target.value as PortalLanguage })}
          >
            {portal.languages.map((l) => (
              <option key={l} value={l}>{LANGUAGES[l]}</option>
            ))}
          </select>
        </div>
      </CardContent>
    </Card>
  );
}

function NumberRow({ label, reg, error }: { label: string; reg: ReturnType<typeof useForm>["register"] extends never ? never : ReturnType<ReturnType<typeof useForm>["register"]>; error?: string }) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Input type="number" {...reg} />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
function TextRow({ label, reg, placeholder, error }: { label: string; reg: ReturnType<ReturnType<typeof useForm>["register"]>; placeholder?: string; error?: string }) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Input placeholder={placeholder} {...reg} />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between rounded-md border p-3">
      <div className="text-sm font-medium">{label}</div>
      <Switch checked={value} onCheckedChange={onChange} />
    </div>
  );
}
