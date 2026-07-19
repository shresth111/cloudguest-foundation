import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Wifi, Ticket, LayoutTemplate, KeyRound, QrCode, MessageCircle, Users, ShieldCheck, Radio, Activity, BarChart3, Bell, Plug, Palette, Sparkles } from "lucide-react";
import { PageShell, SectionHeader } from "@/components/ui-ext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ComponentType } from "react";

export const Route = createFileRoute("/_authenticated/feature-catalog/")({
  component: FeatureCatalogPage,
});

interface Feature {
  key: string;
  label: string;
  category: "Access" | "Auth" | "Network" | "Ops" | "Growth";
  icon: ComponentType<{ className?: string }>;
  description: string;
  enabled: boolean;
}

const INITIAL: Feature[] = [
  { key: "guest-wifi", label: "Guest WiFi", category: "Access", icon: Wifi, description: "Core guest access module.", enabled: true },
  { key: "captive-portal", label: "Captive Portal", category: "Access", icon: LayoutTemplate, description: "Splash & landing runtime.", enabled: true },
  { key: "voucher", label: "Voucher", category: "Access", icon: Ticket, description: "Voucher plans and bulk generation.", enabled: true },
  { key: "qr-login", label: "QR Login", category: "Auth", icon: QrCode, description: "Scan-to-connect authentication.", enabled: true },
  { key: "otp-login", label: "OTP Login", category: "Auth", icon: KeyRound, description: "SMS / Email one-time passwords.", enabled: true },
  { key: "social-login", label: "Social Login", category: "Auth", icon: MessageCircle, description: "Google, Facebook, Apple, LinkedIn.", enabled: false },
  { key: "freeradius", label: "FreeRADIUS", category: "Network", icon: Radio, description: "RADIUS AAA integration.", enabled: true },
  { key: "wireguard", label: "WireGuard", category: "Network", icon: ShieldCheck, description: "Site-to-cloud tunnels.", enabled: true },
  { key: "monitoring", label: "Monitoring", category: "Ops", icon: Activity, description: "Real-time router telemetry.", enabled: true },
  { key: "reports", label: "Reports", category: "Ops", icon: BarChart3, description: "Scheduled export delivery.", enabled: true },
  { key: "analytics", label: "Analytics", category: "Ops", icon: BarChart3, description: "Guest & network insights.", enabled: true },
  { key: "notifications", label: "Notifications", category: "Ops", icon: Bell, description: "Email, SMS, webhook fan-out.", enabled: true },
  { key: "api", label: "Public API", category: "Growth", icon: Plug, description: "Tenant-scoped REST API.", enabled: true },
  { key: "white-label", label: "White Label", category: "Growth", icon: Palette, description: "Custom branding & domains.", enabled: true },
  { key: "ai-assistant", label: "AI Assistant", category: "Growth", icon: Sparkles, description: "In-product AI copilot.", enabled: false },
];

const CATEGORY_ORDER: Feature["category"][] = ["Access", "Auth", "Network", "Ops", "Growth"];

function FeatureCatalogPage() {
  const [features, setFeatures] = useState<Feature[]>(INITIAL);

  const toggle = (key: string) => {
    setFeatures((prev) => prev.map((f) => (f.key === key ? { ...f, enabled: !f.enabled } : f)));
    const f = features.find((x) => x.key === key);
    if (f) toast(`${f.label} ${!f.enabled ? "enabled" : "disabled"} platform-wide`);
  };

  return (
    <PageShell mesh>
      <SectionHeader
        eyebrow="Platform"
        title="Feature Catalog"
        description="Enable, disable, and assign every CloudGuest platform module. Assignments cascade to Customer, Location, NAS Group, or individual NAS."
      />

      {CATEGORY_ORDER.map((cat) => {
        const rows = features.filter((f) => f.category === cat);
        if (rows.length === 0) return null;
        return (
          <section key={cat} className="space-y-3">
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{cat}</h2>
              <span className="text-xs text-muted-foreground">
                {rows.filter((r) => r.enabled).length} of {rows.length} enabled
              </span>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {rows.map((f) => {
                const Icon = f.icon;
                return (
                  <Card key={f.key} className="transition-shadow hover:shadow-md">
                    <CardHeader className="flex flex-row items-start gap-3 space-y-0 pb-2">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1">
                        <CardTitle className="text-sm">{f.label}</CardTitle>
                        <p className="mt-1 text-xs text-muted-foreground">{f.description}</p>
                      </div>
                      <Switch checked={f.enabled} onCheckedChange={() => toggle(f.key)} />
                    </CardHeader>
                    <CardContent className="flex items-center justify-between pt-0">
                      <Badge variant={f.enabled ? "default" : "outline"}>
                        {f.enabled ? "Enabled" : "Disabled"}
                      </Badge>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => toast(`Assignment drawer for ${f.label}`)}
                        className="gap-1"
                      >
                        <Users className="h-3.5 w-3.5" /> Assign
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>
        );
      })}
    </PageShell>
  );
}
