import type { ReactNode } from "react";
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
  makeSeoSchema,
  type LoginSettingsValues,
  type SeoValues,
} from "@/lib/portal-schemas";
import { SplashCharCounter } from "@/components/portals/SplashCharCounter";
import {
  SPLASH_HEADLINE_MAX,
  SPLASH_WELCOME_MAX,
  splashOverLimitBlocked,
} from "@/lib/splash-limits";
import { useUpdatePortal } from "@/hooks/usePortals";
import type { Portal, PortalLanguage } from "@/types/portal";
import { LANGUAGES } from "@/types/portal";

export function PortalLoginSettingsPanel({ portal }: { portal: Portal }) {
  const update = useUpdatePortal(portal.id, portal.organizationId);
  const { register, handleSubmit, watch, setValue, formState } = useForm<LoginSettingsValues>({
    resolver: zodResolver(loginSettingsSchema),
    defaultValues: portal.login,
  });
  const v = watch();
  const submit = handleSubmit((values) =>
    update.mutate({
      login: {
        ...values,
        redirectUrl: values.redirectUrl ?? "",
        // This panel is the OTHER portals builder (/portals/$portalId), not
        // the customer dashboard's Portal -> Design where the post-login page
        // is authored -- it has no editor for `postLoginHtml` and must not
        // silently blank it. `update` sends whatever is in this object, so
        // the loaded value is passed straight back through unchanged.
        postLoginHtml: portal.login.postLoginHtml,
        successPage: values.successPage ?? "",
        failurePage: values.failurePage ?? "",
      },
    }),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Login settings</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
          <NumberRow
            label="Session timeout (min)"
            reg={register("sessionTimeoutMinutes", { valueAsNumber: true })}
            error={formState.errors.sessionTimeoutMinutes?.message}
          />
          <NumberRow
            label="Idle timeout (min)"
            reg={register("idleTimeoutMinutes", { valueAsNumber: true })}
            error={formState.errors.idleTimeoutMinutes?.message}
          />
          <NumberRow
            label="Device limit"
            reg={register("deviceLimit", { valueAsNumber: true })}
            error={formState.errors.deviceLimit?.message}
          />
          <TextRow label="Redirect URL" reg={register("redirectUrl")} placeholder="https://…" />
          <TextRow label="Success page URL" reg={register("successPage")} placeholder="https://…" />
          <TextRow label="Failure page URL" reg={register("failurePage")} placeholder="https://…" />
          <ToggleRow
            label="Auto login"
            value={v.autoLogin}
            onChange={(x) => setValue("autoLogin", x)}
          />
          <ToggleRow
            label="Remember device"
            value={v.rememberDevice}
            onChange={(x) => setValue("rememberDevice", x)}
          />
          <div className="md:col-span-2 flex justify-end">
            <Button type="submit" size="sm">
              <Save className="mr-2 h-4 w-4" />
              Save settings
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export function PortalSeoPanel({ portal }: { portal: Portal }) {
  const update = useUpdatePortal(portal.id, portal.organizationId);
  // "Page title" / "Meta description" here are `splash_headline` /
  // `splash_welcome_message` on the wire (portal.service.ts maps them), so
  // they carry the backend's 26/78 code-point limits -- see
  // src/lib/splash-limits.ts. The schema is built against this portal's
  // loaded values so an unchanged grandfathered over-limit value still
  // validates (the backend only rejects the field when it is being changed);
  // `blocked` below applies the same rule live for the counter/button state.
  const { register, handleSubmit, watch, formState } = useForm<SeoValues>({
    resolver: zodResolver(makeSeoSchema(portal.seo)),
    defaultValues: portal.seo,
  });
  const titleValue = watch("pageTitle") ?? "";
  const descValue = watch("metaDescription") ?? "";
  const titleBlocked = splashOverLimitBlocked(
    titleValue,
    SPLASH_HEADLINE_MAX,
    portal.seo.pageTitle,
  );
  const descBlocked = splashOverLimitBlocked(
    descValue,
    SPLASH_WELCOME_MAX,
    portal.seo.metaDescription,
  );
  const blocked = titleBlocked || descBlocked;
  const submit = handleSubmit((v) =>
    update.mutate({
      seo: { ...v, faviconUrl: v.faviconUrl ?? "", socialImageUrl: v.socialImageUrl ?? "" },
    }),
  );
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">SEO & metadata</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="grid gap-3 md:grid-cols-2">
          <TextRow
            label="Page title"
            reg={register("pageTitle")}
            placeholder="Sign in to WiFi"
            error={formState.errors.pageTitle?.message}
            counter={<SplashCharCounter value={titleValue} max={SPLASH_HEADLINE_MAX} />}
          />
          <TextRow
            label="Meta description"
            reg={register("metaDescription")}
            placeholder="Description shown in search results"
            error={formState.errors.metaDescription?.message}
            counter={<SplashCharCounter value={descValue} max={SPLASH_WELCOME_MAX} />}
          />
          <TextRow
            label="Favicon URL"
            reg={register("faviconUrl")}
            placeholder="https://…/favicon.ico"
          />
          <TextRow
            label="Social preview image"
            reg={register("socialImageUrl")}
            placeholder="https://…/og.jpg"
          />
          <div className="md:col-span-2 flex flex-col items-end gap-1.5">
            <Button type="submit" size="sm" disabled={blocked}>
              <Save className="mr-2 h-4 w-4" />
              Save SEO
            </Button>
            {blocked && (
              <p className="text-xs text-destructive" role="alert">
                {titleBlocked && descBlocked
                  ? "Page title and meta description are over their length limits — shorten them to save."
                  : titleBlocked
                    ? `Page title is over the ${SPLASH_HEADLINE_MAX}-character limit — shorten it to save.`
                    : `Meta description is over the ${SPLASH_WELCOME_MAX}-character limit — shorten it to save.`}
              </p>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export function PortalLanguagesPanel({ portal }: { portal: Portal }) {
  const update = useUpdatePortal(portal.id, portal.organizationId);

  /* Toggling a language off used to patch `languages` ALONE, which let an
   * admin strand the default: de-select "English" on a portal whose
   * `defaultLanguage` is still `"en"` and you get
   * `{ languages: ["hi"], defaultLanguage: "en" }`. The guest portal then
   * booted into a language the switcher below never lists -- so the guest
   * could not switch out of it either, because the only control that sets
   * the language offers the supported set and nothing else. Nothing in the
   * old code prevented it and nothing surfaced it afterwards; the default
   * `<select>` just rendered blank, which reads as a rendering glitch rather
   * than as invalid state.
   *
   * Both fields now move in ONE mutation, so there is no intermediate save
   * where the pair is inconsistent (two chained `update.mutate` calls would
   * leave exactly that window, and would leave the portal broken for good if
   * the second request failed). The guest runtime repairs this case too --
   * see `resolveLanguageSelection` -- but repairing it there and preventing
   * it here are different jobs: an admin should never be looking at a saved
   * config the guest runtime has to quietly correct. */
  const toggle = (lang: PortalLanguage) => {
    const has = portal.languages.includes(lang);
    const next = has ? portal.languages.filter((l) => l !== lang) : [...portal.languages, lang];
    // Never leave a portal with no language at all -- the pre-existing rule,
    // kept: an empty selection means "English", not "nothing".
    const languages = next.length ? next : (["en"] as PortalLanguage[]);
    update.mutate({
      languages,
      ...(languages.includes(portal.defaultLanguage) ? {} : { defaultLanguage: languages[0] }),
    });
  };

  /* Existing configs can already be in the stranded state described above,
   * so the default picker renders the stored value even when it is missing
   * from `languages` -- otherwise the `<select>` shows an empty box and the
   * admin has no way to tell what the portal is actually defaulting to.
   * Choosing any real option repairs it. */
  const defaultOptions = portal.languages.includes(portal.defaultLanguage)
    ? portal.languages
    : [portal.defaultLanguage, ...portal.languages];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Multi-language</CardTitle>
      </CardHeader>
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
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    {l}
                  </div>
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
            {defaultOptions.map((l) => (
              <option key={l} value={l}>
                {LANGUAGES[l]}
                {portal.languages.includes(l) ? "" : " (not enabled)"}
              </option>
            ))}
          </select>
        </div>
      </CardContent>
    </Card>
  );
}

function NumberRow({
  label,
  reg,
  error,
}: {
  label: string;
  reg: ReturnType<typeof useForm>["register"] extends never
    ? never
    : ReturnType<ReturnType<typeof useForm>["register"]>;
  error?: string;
}) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Input type="number" {...reg} />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
function TextRow({
  label,
  reg,
  placeholder,
  error,
  counter,
}: {
  label: string;
  reg: ReturnType<ReturnType<typeof useForm>["register"]>;
  placeholder?: string;
  error?: string;
  /** Optional right-aligned adornment on the label row -- used for the
   * splash-field live character counters (SplashCharCounter). */
  counter?: ReactNode;
}) {
  return (
    <div className="space-y-1">
      {counter ? (
        <div className="flex items-center justify-between">
          <Label>{label}</Label>
          {counter}
        </div>
      ) : (
        <Label>{label}</Label>
      )}
      <Input placeholder={placeholder} {...reg} />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
function ToggleRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-md border p-3">
      <div className="text-sm font-medium">{label}</div>
      <Switch checked={value} onCheckedChange={onChange} />
    </div>
  );
}
