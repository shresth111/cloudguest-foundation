import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  Building2, Check, ChevronLeft, ChevronRight, Image, Palette, Rocket, Users, Wifi,
  LayoutTemplate,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/system/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/_authenticated/onboarding/")({
  component: OnboardingPage,
});

const STEPS = [
  { key: "company", label: "Company", icon: Building2 },
  { key: "logo", label: "Logo", icon: Image },
  { key: "brand", label: "Brand", icon: Palette },
  { key: "portal", label: "Captive portal", icon: LayoutTemplate },
  { key: "wifi", label: "Guest WiFi", icon: Wifi },
  { key: "team", label: "Invite team", icon: Users },
  { key: "complete", label: "Finish", icon: Rocket },
];

function OnboardingPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [state, setState] = useState({
    company: "Acme Hospitality",
    domain: "acme.cloudguest.io",
    primary: "#0F766E",
    accent: "#22D3EE",
    portalName: "Welcome to Acme",
    ssid: "Acme-Guest",
    team: "",
  });

  const set = <K extends keyof typeof state>(k: K, v: (typeof state)[K]) => setState((s) => ({ ...s, [k]: v }));
  const pct = Math.round(((step + 1) / STEPS.length) * 100);
  const CurrentIcon = STEPS[step].icon;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Welcome to CloudGuest"
        description="Configure your workspace in a few guided steps."
        actions={
          <Button variant="outline" size="sm" onClick={() => toast.success("Draft saved")}>Save draft</Button>
        }
      />

      <div className="space-y-3">
        <Progress value={pct} />
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {STEPS.map((s, i) => (
            <Badge key={s.key} variant={i === step ? "default" : i < step ? "secondary" : "outline"} className="gap-1">
              {i < step ? <Check className="h-3 w-3" /> : <s.icon className="h-3 w-3" />}
              {s.label}
            </Badge>
          ))}
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <motion.div key={step} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <div className="mb-6 flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
                <CurrentIcon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-lg font-semibold">{STEPS[step].label}</p>
                <p className="text-sm text-muted-foreground">Step {step + 1} of {STEPS.length}</p>
              </div>
            </div>

            {step === 0 && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>Company name</Label>
                  <Input value={state.company} onChange={(e) => set("company", e.target.value)} />
                </div>
                <div>
                  <Label>Workspace domain</Label>
                  <Input value={state.domain} onChange={(e) => set("domain", e.target.value)} />
                </div>
              </div>
            )}
            {step === 1 && (
              <div className="rounded-xl border border-dashed border-border p-10 text-center">
                <Image className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="mt-2 font-medium">Upload company logo</p>
                <p className="mt-1 text-sm text-muted-foreground">PNG or SVG, transparent background recommended</p>
                <Button className="mt-4" onClick={() => toast.success("Logo uploaded")}>Choose file</Button>
              </div>
            )}
            {step === 2 && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>Primary color</Label>
                  <div className="mt-1 flex gap-2">
                    <input type="color" value={state.primary} onChange={(e) => set("primary", e.target.value)} className="h-10 w-14 cursor-pointer rounded border border-border bg-transparent" />
                    <Input value={state.primary} onChange={(e) => set("primary", e.target.value)} />
                  </div>
                </div>
                <div>
                  <Label>Accent color</Label>
                  <div className="mt-1 flex gap-2">
                    <input type="color" value={state.accent} onChange={(e) => set("accent", e.target.value)} className="h-10 w-14 cursor-pointer rounded border border-border bg-transparent" />
                    <Input value={state.accent} onChange={(e) => set("accent", e.target.value)} />
                  </div>
                </div>
              </div>
            )}
            {step === 3 && (
              <div>
                <Label>Portal welcome text</Label>
                <Input value={state.portalName} onChange={(e) => set("portalName", e.target.value)} />
                <div className="mt-4 rounded-xl border border-border p-6 text-center" style={{ background: `linear-gradient(135deg, ${state.primary}22, ${state.accent}22)` }}>
                  <p className="text-lg font-semibold" style={{ color: state.primary }}>{state.portalName}</p>
                  <p className="mt-1 text-sm text-muted-foreground">Live preview updates as you type</p>
                </div>
              </div>
            )}
            {step === 4 && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>Guest SSID</Label>
                  <Input value={state.ssid} onChange={(e) => set("ssid", e.target.value)} />
                </div>
                <div>
                  <Label>Default login</Label>
                  <Input defaultValue="OTP + Voucher" readOnly />
                </div>
              </div>
            )}
            {step === 5 && (
              <div>
                <Label>Invite teammates by email</Label>
                <Input placeholder="alice@acme.io, bob@acme.io" value={state.team} onChange={(e) => set("team", e.target.value)} />
                <p className="mt-1 text-xs text-muted-foreground">You can invite more people later from Users & Roles.</p>
              </div>
            )}
            {step === 6 && (
              <div className="rounded-xl border border-border bg-gradient-to-br from-primary/10 via-background to-background p-8 text-center">
                <Rocket className="mx-auto h-10 w-10 text-primary" />
                <p className="mt-3 text-lg font-semibold">You're ready to launch</p>
                <p className="mt-1 text-sm text-muted-foreground">All defaults are saved. Start onboarding guests now.</p>
              </div>
            )}
          </motion.div>

          <div className="mt-8 flex items-center justify-between">
            <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
              <ChevronLeft className="mr-1 h-4 w-4" /> Back
            </Button>
            {step === STEPS.length - 1 ? (
              <Button onClick={() => { toast.success("Setup complete!"); navigate({ to: "/dashboard" }); }}>
                Go to dashboard <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}>
                Next <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
