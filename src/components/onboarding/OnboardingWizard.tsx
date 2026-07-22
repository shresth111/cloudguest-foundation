import { useState } from "react";
import { Building2, Palette, MapPin, Router, Wifi, Globe, CheckCircle2, ArrowRight, ArrowLeft, X, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface Step {
  id: string;
  title: string;
  description: string;
  icon: typeof Building2;
}

const STEPS: Step[] = [
  { id: "organization", title: "Organization", description: "Set up your company profile", icon: Building2 },
  { id: "branding", title: "Branding", description: "Customize your portal appearance", icon: Palette },
  { id: "location", title: "Location", description: "Add your first site location", icon: MapPin },
  { id: "router", title: "Router", description: "Register your first router", icon: Router },
  { id: "ssid", title: "SSID", description: "Configure your guest network", icon: Wifi },
  { id: "portal", title: "Portal", description: "Design the guest login page", icon: Globe },
  { id: "finish", title: "Finish", description: "Review and launch", icon: CheckCircle2 },
];

const STEP_CONTENT: Record<string, { items: { label: string; value: string }[] }> = {
  organization: {
    items: [
      { label: "Company name", value: "Acme Corp" },
      { label: "Industry", value: "Technology" },
      { label: "Country", value: "India" },
      { label: "Timezone", value: "Asia/Kolkata (UTC +5:30)" },
    ],
  },
  branding: {
    items: [
      { label: "Primary color", value: "#4361EE" },
      { label: "Logo", value: "Uploaded: acme-logo.svg" },
      { label: "Portal domain", value: "guest.acme.com" },
      { label: "Language", value: "English (default)" },
    ],
  },
  location: {
    items: [
      { label: "Location name", value: "Mumbai HQ" },
      { label: "Address", value: "Bandra Kurla Complex, Mumbai" },
      { label: "Capacity", value: "500 guests" },
      { label: "ISP", value: "Tata Communications" },
    ],
  },
  router: {
    items: [
      { label: "Router name", value: "GW-01" },
      { label: "Model", value: "CloudGuest CG-2000" },
      { label: "Serial number", value: "CG-2025-A7X2K9" },
      { label: "Firmware", value: "v3.2.1 (latest)" },
    ],
  },
  ssid: {
    items: [
      { label: "Network name (SSID)", value: "Acme-Guest" },
      { label: "Security", value: "WPA2-Enterprise" },
      { label: "VLAN", value: "VLAN 100" },
      { label: "Bandwidth limit", value: "50 Mbps per client" },
    ],
  },
  portal: {
    items: [
      { label: "Portal template", value: "Enterprise Blue" },
      { label: "Auth methods", value: "Email OTP, SMS, Voucher" },
      { label: "Terms acceptance", value: "Required" },
      { label: "Redirect URL", value: "https://acme.com/welcome" },
    ],
  },
  finish: {
    items: [
      { label: "Organization", value: "Acme Corp" },
      { label: "Location", value: "Mumbai HQ" },
      { label: "Router", value: "GW-01" },
      { label: "SSID", value: "Acme-Guest" },
    ],
  },
};

interface OnboardingWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function OnboardingWizard({ open, onOpenChange }: OnboardingWizardProps) {
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const Icon = current.icon;
  const progress = ((step + 1) / STEPS.length) * 100;

  const next = () => {
    if (isLast) onOpenChange(false);
    else setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onOpenChange(false); }}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Onboarding wizard
          </DialogTitle>
        </DialogHeader>

        {/* Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Step {step + 1} of {STEPS.length}</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-1.5" />
        </div>

        {/* Steps indicator */}
        <div className="flex gap-1 overflow-x-auto py-2">
          {STEPS.map((s, i) => (
            <button
              key={s.id}
              onClick={() => setStep(i)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors",
                i === step ? "bg-primary text-primary-foreground" :
                i < step ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
              )}
            >
              {i < step ? <CheckCircle2 className="h-3 w-3" /> : null}
              {s.title}
            </button>
          ))}
        </div>

        {/* Step content */}
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-background to-background">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Icon className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-lg font-semibold">{current.title}</h3>
                <p className="text-sm text-muted-foreground">{current.description}</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {STEP_CONTENT[current.id]?.items.map((item) => (
                    <div key={item.label} className="rounded-lg border bg-card p-3">
                      <p className="text-xs text-muted-foreground">{item.label}</p>
                      <p className="mt-0.5 text-sm font-medium">{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setStep(Math.max(0, step - 1))}
            disabled={step === 0}
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Skip
            </Button>
            <Button size="sm" onClick={next}>
              {isLast ? (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" /> Complete
                </>
              ) : (
                <>
                  Continue <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
