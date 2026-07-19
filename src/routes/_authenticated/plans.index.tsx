import { createFileRoute } from "@tanstack/react-router";
import { Check, Sparkles, Crown, Rocket, Building2, Star } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/system/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/plans/")({
  component: PlansPage,
});

type Cycle = "monthly" | "yearly";

interface Plan {
  id: "trial" | "starter" | "professional" | "enterprise" | "custom";
  name: string;
  tagline: string;
  price: { monthly: number; yearly: number };
  icon: typeof Sparkles;
  featured?: boolean;
  limits: {
    locations: number | "unlimited";
    routers: number | "unlimited";
    guests: number | "unlimited";
    staff: number | "unlimited";
    apiKeys: number | "unlimited";
    storageGb: number | "unlimited";
    smsCredits: number;
    emailCredits: number;
  };
  features: string[];
}

const PLANS: Plan[] = [
  {
    id: "trial",
    name: "Trial",
    tagline: "Explore the platform for 14 days",
    price: { monthly: 0, yearly: 0 },
    icon: Star,
    limits: { locations: 1, routers: 2, guests: 100, staff: 3, apiKeys: 1, storageGb: 5, smsCredits: 100, emailCredits: 500 },
    features: ["Guest WiFi", "Captive portal", "Basic analytics", "Email support"],
  },
  {
    id: "starter",
    name: "Starter",
    tagline: "For growing single-site properties",
    price: { monthly: 79, yearly: 790 },
    icon: Rocket,
    limits: { locations: 3, routers: 5, guests: 500, staff: 10, apiKeys: 3, storageGb: 25, smsCredits: 1_000, emailCredits: 5_000 },
    features: ["Everything in Trial", "Voucher login", "QR login", "Priority email support"],
  },
  {
    id: "professional",
    name: "Professional",
    tagline: "For multi-location businesses",
    price: { monthly: 499, yearly: 4990 },
    icon: Sparkles,
    featured: true,
    limits: { locations: 25, routers: 100, guests: 25_000, staff: 100, apiKeys: 25, storageGb: 500, smsCredits: 10_000, emailCredits: 100_000 },
    features: ["Everything in Starter", "FreeRADIUS", "WireGuard tunnels", "Advanced analytics", "24/7 chat support"],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    tagline: "Global, mission-critical deployments",
    price: { monthly: 1999, yearly: 19990 },
    icon: Crown,
    limits: { locations: "unlimited", routers: "unlimited", guests: "unlimited", staff: "unlimited", apiKeys: "unlimited", storageGb: "unlimited", smsCredits: 100_000, emailCredits: 1_000_000 },
    features: ["Everything in Professional", "White label", "PMS integrations", "SLA + dedicated CSM", "SSO / SAML"],
  },
  {
    id: "custom",
    name: "Custom",
    tagline: "Tailored contracts for global brands",
    price: { monthly: 0, yearly: 0 },
    icon: Building2,
    limits: { locations: "unlimited", routers: "unlimited", guests: "unlimited", staff: "unlimited", apiKeys: "unlimited", storageGb: "unlimited", smsCredits: 500_000, emailCredits: 5_000_000 },
    features: ["Custom limits", "Custom pricing", "Custom integrations", "White glove onboarding"],
  },
];

function fmt(v: number | "unlimited") {
  return v === "unlimited" ? "Unlimited" : v.toLocaleString();
}

function PlansPage() {
  const [cycle, setCycle] = useState<Cycle>("monthly");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Subscription plans"
        description="Manage the plans offered to CloudGuest customers, their pricing tiers, feature access and default limits."
        actions={
          <Tabs value={cycle} onValueChange={(v) => setCycle(v as Cycle)}>
            <TabsList>
              <TabsTrigger value="monthly">Monthly</TabsTrigger>
              <TabsTrigger value="yearly">
                Yearly <Badge variant="secondary" className="ml-2">-15%</Badge>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {PLANS.map((plan) => {
          const Icon = plan.icon;
          const price = plan.price[cycle];
          return (
            <Card
              key={plan.id}
              className={cn(
                "relative flex flex-col",
                plan.featured && "border-primary shadow-lg ring-1 ring-primary/40",
              )}
            >
              {plan.featured && (
                <Badge className="absolute -top-2 right-4">Most popular</Badge>
              )}
              <CardHeader>
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-4 w-4" />
                  </div>
                  <CardTitle className="text-lg">{plan.name}</CardTitle>
                </div>
                <p className="text-xs text-muted-foreground">{plan.tagline}</p>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-4">
                <div>
                  <div className="text-3xl font-semibold tracking-tight">
                    {plan.id === "custom" ? "Talk to us" : price === 0 ? "Free" : `$${price.toLocaleString()}`}
                  </div>
                  {plan.id !== "custom" && price > 0 && (
                    <div className="text-xs text-muted-foreground">
                      per {cycle === "monthly" ? "month" : "year"}
                    </div>
                  )}
                </div>
                <ul className="space-y-2 text-sm">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-auto flex flex-col gap-2 pt-2">
                  <Button
                    variant={plan.featured ? "default" : "outline"}
                    onClick={() => toast.success(`${plan.name} plan updated`)}
                  >
                    Edit plan
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toast(`Duplicated ${plan.name}`)}
                  >
                    Duplicate
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Default plan limits</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Plan</TableHead>
                <TableHead>Locations</TableHead>
                <TableHead>Routers</TableHead>
                <TableHead>Guests</TableHead>
                <TableHead>Staff</TableHead>
                <TableHead>API keys</TableHead>
                <TableHead>Storage</TableHead>
                <TableHead>SMS</TableHead>
                <TableHead>Email</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {PLANS.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell>{fmt(p.limits.locations)}</TableCell>
                  <TableCell>{fmt(p.limits.routers)}</TableCell>
                  <TableCell>{fmt(p.limits.guests)}</TableCell>
                  <TableCell>{fmt(p.limits.staff)}</TableCell>
                  <TableCell>{fmt(p.limits.apiKeys)}</TableCell>
                  <TableCell>{p.limits.storageGb === "unlimited" ? "Unlimited" : `${p.limits.storageGb} GB`}</TableCell>
                  <TableCell>{p.limits.smsCredits.toLocaleString()}</TableCell>
                  <TableCell>{p.limits.emailCredits.toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
