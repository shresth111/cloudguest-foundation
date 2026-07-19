import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { portalWizardSchema, type PortalWizardValues } from "@/lib/portal-schemas";
import { useCreatePortal } from "@/hooks/usePortals";
import { portalService } from "@/services/portal.service";
import type { PortalLoginMethod } from "@/types/portal";

const STEPS = [
  { key: "basics", title: "Basic information", hint: "Where the portal lives" },
  { key: "branding", title: "Branding", hint: "Look and feel" },
  { key: "methods", title: "Login methods", hint: "How guests sign in" },
  { key: "consent", title: "Terms & privacy", hint: "Compliance" },
] as const;

const DEFAULTS: PortalWizardValues = {
  basics: { name: "", organizationId: "", locationId: "", description: "" },
  branding: {
    logoUrl: "",
    backgroundUrl: "",
    primaryColor: "#0EA5E9",
    secondaryColor: "#0F172A",
    fontFamily: "Inter",
    borderRadius: 14,
  },
  methods: {
    mobile_otp: true,
    email_otp: false,
    voucher: false,
    pms: false,
    social: false,
    click_through: true,
  },
  consent: {
    termsRequired: true,
    privacyRequired: true,
    marketingConsent: false,
    gdprConsent: true,
    termsUrl: "",
    privacyUrl: "",
  },
};

export function PortalWizard({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const [step, setStep] = useState(0);
  const create = useCreatePortal();
  const navigate = useNavigate();

  const form = useForm<PortalWizardValues>({
    resolver: zodResolver(portalWizardSchema),
    defaultValues: DEFAULTS,
    mode: "onBlur",
  });
  const { watch, setValue, register, formState, handleSubmit, reset } = form;
  const values = watch();
  const orgs = useMemo(() => portalService.organizations(), []);
  const locations = useMemo(
    () => portalService.locations(values.basics.organizationId || undefined),
    [values.basics.organizationId],
  );

  const next = async () => {
    const fields: Record<number, Array<keyof PortalWizardValues>> = {
      0: ["basics"],
      1: ["branding"],
      2: ["methods"],
      3: ["consent"],
    };
    const ok = await form.trigger(fields[step]);
    if (ok) setStep((s) => Math.min(STEPS.length - 1, s + 1));
  };

  const submit = handleSubmit(async (v) => {
    const enabledMethods = (Object.entries(v.methods) as Array<[PortalLoginMethod, boolean]>)
      .filter(([, on]) => on)
      .map(([k]) => k);
    const created = await create.mutateAsync({
      name: v.basics.name,
      description: v.basics.description,
      organizationId: v.basics.organizationId,
      locationId: v.basics.locationId,
      loginMethods: enabledMethods.length ? enabledMethods : ["mobile_otp"],
      primaryLoginMethod: enabledMethods[0] ?? "mobile_otp",
      branding: {
        primaryColor: v.branding.primaryColor,
        secondaryColor: v.branding.secondaryColor,
        fontFamily: v.branding.fontFamily,
        borderRadius: v.branding.borderRadius,
        logoUrl: v.branding.logoUrl || undefined,
        backgroundUrl: v.branding.backgroundUrl || undefined,
        backgroundType: v.branding.backgroundUrl ? "image" : "gradient",
        gradientFrom: v.branding.secondaryColor,
        gradientTo: v.branding.primaryColor,
        shadow: "md",
        buttonStyle: "solid",
        cardStyle: "elevated",
        animations: true,
      },
      consent: v.consent,
    });
    reset(DEFAULTS);
    setStep(0);
    onOpenChange(false);
    navigate({ to: "/portals/$portalId", params: { portalId: created.id } });
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setStep(0); reset(DEFAULTS); } onOpenChange(o); }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Create captive portal</DialogTitle>
          <DialogDescription>Configure the essentials — everything is editable in the builder afterward.</DialogDescription>
        </DialogHeader>

        <ol className="mb-2 flex items-center gap-2 text-xs">
          {STEPS.map((s, i) => (
            <li key={s.key} className="flex flex-1 items-center gap-2">
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full border text-[11px] font-semibold ${
                  i < step
                    ? "border-primary bg-primary text-primary-foreground"
                    : i === step
                    ? "border-primary text-primary"
                    : "border-border text-muted-foreground"
                }`}
              >
                {i < step ? <Check className="h-3 w-3" /> : i + 1}
              </span>
              <div className="hidden sm:block">
                <div className={`font-medium ${i === step ? "text-foreground" : "text-muted-foreground"}`}>{s.title}</div>
              </div>
              {i < STEPS.length - 1 && <div className="mx-1 h-px flex-1 bg-border" />}
            </li>
          ))}
        </ol>

        <div className="min-h-[280px] space-y-4">
          {step === 0 && (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2 space-y-2">
                <Label htmlFor="name">Portal name</Label>
                <Input id="name" placeholder="Marina Bay Guest Portal" {...register("basics.name")} />
                {formState.errors.basics?.name && (
                  <p className="text-xs text-destructive">{formState.errors.basics.name.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Organization</Label>
                <Select
                  value={values.basics.organizationId}
                  onValueChange={(v) => {
                    setValue("basics.organizationId", v, { shouldValidate: true });
                    setValue("basics.locationId", "");
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="Select organization" /></SelectTrigger>
                  <SelectContent>
                    {orgs.map((o) => (
                      <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formState.errors.basics?.organizationId && (
                  <p className="text-xs text-destructive">{formState.errors.basics.organizationId.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Location</Label>
                <Select
                  value={values.basics.locationId}
                  onValueChange={(v) => setValue("basics.locationId", v, { shouldValidate: true })}
                >
                  <SelectTrigger><SelectValue placeholder="Select location" /></SelectTrigger>
                  <SelectContent>
                    {locations.map((l) => (
                      <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formState.errors.basics?.locationId && (
                  <p className="text-xs text-destructive">{formState.errors.basics.locationId.message}</p>
                )}
              </div>
              <div className="md:col-span-2 space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" rows={3} placeholder="Short description shown in admin views" {...register("basics.description")} />
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Logo URL</Label>
                <Input placeholder="https://…/logo.svg" {...register("branding.logoUrl")} />
              </div>
              <div className="space-y-2">
                <Label>Background image URL</Label>
                <Input placeholder="https://…/hero.jpg" {...register("branding.backgroundUrl")} />
              </div>
              <div className="space-y-2">
                <Label>Primary color</Label>
                <div className="flex items-center gap-2">
                  <Input type="color" className="h-10 w-14 cursor-pointer p-1" value={values.branding.primaryColor} onChange={(e) => setValue("branding.primaryColor", e.target.value)} />
                  <Input value={values.branding.primaryColor} onChange={(e) => setValue("branding.primaryColor", e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Secondary color</Label>
                <div className="flex items-center gap-2">
                  <Input type="color" className="h-10 w-14 cursor-pointer p-1" value={values.branding.secondaryColor} onChange={(e) => setValue("branding.secondaryColor", e.target.value)} />
                  <Input value={values.branding.secondaryColor} onChange={(e) => setValue("branding.secondaryColor", e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Font family</Label>
                <Select value={values.branding.fontFamily} onValueChange={(v) => setValue("branding.fontFamily", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Inter", "SF Pro Text", "Playfair Display", "Roboto", "Poppins", "IBM Plex Sans"].map((f) => (
                      <SelectItem key={f} value={f}>{f}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Border radius: {values.branding.borderRadius}px</Label>
                <input
                  type="range"
                  min={0}
                  max={32}
                  value={values.branding.borderRadius}
                  onChange={(e) => setValue("branding.borderRadius", Number(e.target.value))}
                  className="w-full accent-[var(--primary)]"
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="grid gap-2 md:grid-cols-2">
              {(Object.keys(values.methods) as PortalLoginMethod[]).map((k) => (
                <label key={k} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <div className="text-sm font-medium capitalize">{k.replace(/_/g, " ")}</div>
                    <div className="text-xs text-muted-foreground">Enable this login method on the portal</div>
                  </div>
                  <Switch checked={values.methods[k]} onCheckedChange={(v) => setValue(`methods.${k}` as const, v)} />
                </label>
              ))}
            </div>
          )}

          {step === 3 && (
            <div className="grid gap-3">
              {[
                ["termsRequired", "Terms & conditions checkbox"],
                ["privacyRequired", "Privacy policy checkbox"],
                ["marketingConsent", "Marketing consent (opt-in)"],
                ["gdprConsent", "GDPR consent notice"],
              ].map(([key, label]) => (
                <label key={key} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="text-sm font-medium">{label}</div>
                  <Switch
                    checked={values.consent[key as keyof typeof values.consent] as boolean}
                    onCheckedChange={(v) => setValue(`consent.${key}` as never, v as never)}
                  />
                </label>
              ))}
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Terms URL</Label>
                  <Input placeholder="https://…/terms" {...register("consent.termsUrl")} />
                </div>
                <div className="space-y-2">
                  <Label>Privacy URL</Label>
                  <Input placeholder="https://…/privacy" {...register("consent.privacyUrl")} />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between">
          <Button variant="ghost" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </Button>
          {step < STEPS.length - 1 ? (
            <Button onClick={next}>
              Next <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={submit} disabled={create.isPending}>
              {create.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
              Create portal
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
