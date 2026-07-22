import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Palette, MessageSquare, Mail, Building2, Globe, Code, Radio, Network, BarChart3, Shield, Key, Bot, Smartphone, Cloud, Database, Search } from "lucide-react";
import { PageHeader } from "@/components/system/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";

interface FeatureFlag {
  id: string;
  name: string;
  description: string;
  icon: typeof Palette;
  enabled: boolean;
  category: string;
}

const FLAGS: FeatureFlag[] = [
  { id: "branding", name: "Branding", description: "Custom white-label branding for portals", icon: Palette, enabled: true, category: "portal" },
  { id: "pms", name: "PMS Integration", description: "Property management system integration", icon: Building2, enabled: false, category: "integrations" },
  { id: "email-otp", name: "Email OTP", description: "One-time password via email authentication", icon: Mail, enabled: true, category: "auth" },
  { id: "sms-otp", name: "SMS OTP", description: "One-time password via SMS authentication", icon: MessageSquare, enabled: true, category: "auth" },
  { id: "whatsapp-otp", name: "WhatsApp OTP", description: "One-time password via WhatsApp", icon: Smartphone, enabled: false, category: "auth" },
  { id: "api", name: "REST API", description: "Programmatic access to platform APIs", icon: Code, enabled: true, category: "integrations" },
  { id: "radius-proxy", name: "RADIUS Proxy", description: "RADIUS authentication proxy service", icon: Radio, enabled: true, category: "network" },
  { id: "vlan", name: "VLAN Management", description: "Virtual LAN configuration and mapping", icon: Network, enabled: true, category: "network" },
  { id: "reports", name: "Reports & Analytics", description: "Advanced reporting and analytics dashboard", icon: BarChart3, enabled: true, category: "analytics" },
  { id: "analytics", name: "Executive Analytics", description: "Executive-level business intelligence", icon: BarChart3, enabled: false, category: "analytics" },
  { id: "sso", name: "SSO (SAML/OIDC)", description: "Single sign-on integration", icon: Shield, enabled: false, category: "auth" },
  { id: "api-keys", name: "API Key Management", description: "API key generation and rotation", icon: Key, enabled: true, category: "integrations" },
  { id: "ai-assistant", name: "AI Assistant", description: "AI-powered network assistant", icon: Bot, enabled: false, category: "ai" },
  { id: "cloud-backup", name: "Cloud Backup", description: "Automated cloud configuration backup", icon: Cloud, enabled: true, category: "system" },
  { id: "data-retention", name: "Data Retention", description: "Configurable data retention policies", icon: Database, enabled: false, category: "system" },
  { id: "social-login", name: "Social Login", description: "Login via Google, Facebook, LinkedIn", icon: Globe, enabled: true, category: "auth" },
];

const CATEGORIES = ["all", "auth", "network", "integrations", "analytics", "portal", "system", "ai"];

export const Route = createFileRoute("/_authenticated/feature-flags/")({
  component: FeatureFlagsPage,
});

function FeatureFlagsPage() {
  const [flags, setFlags] = useState(FLAGS);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");

  const toggleFlag = (id: string) => {
    setFlags((prev) => prev.map((f) => f.id === id ? { ...f, enabled: !f.enabled } : f));
  };

  const filtered = flags.filter((f) => {
    if (category !== "all" && f.category !== category) return false;
    if (search && !f.name.toLowerCase().includes(search.toLowerCase()) && !f.description.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const enabledCount = flags.filter((f) => f.enabled).length;
  const totalCount = flags.length;

  return (
    <div className="space-y-6">
      <PageHeader title="Feature flags" description={`Manage enterprise feature toggles — ${enabledCount}/${totalCount} enabled`} />
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search features…" value={search} onChange={(e) => setSearch(e.target.value)} className="h-9 pl-8" />
        </div>
        <div className="flex flex-wrap gap-1">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                category === c ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((flag) => {
          const Icon = flag.icon;
          return (
            <Card key={flag.id} className={`transition-all ${flag.enabled ? "border-primary/30" : "opacity-70"}`}>
              <CardContent className="flex items-start gap-3 p-4">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                  flag.enabled ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                }`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{flag.name}</p>
                    <Badge variant="outline" className="h-4 px-1 text-[9px] capitalize">{flag.category}</Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{flag.description}</p>
                </div>
                <Switch checked={flag.enabled} onCheckedChange={() => toggleFlag(flag.id)} aria-label={`Toggle ${flag.name}`} />
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
