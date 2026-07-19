import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  Activity, BarChart3, Bell, Building2, Code2, LayoutTemplate, Network, Palette, QrCode,
  Receipt, ShieldCheck, Sparkles, Star, Store, Ticket, Users, Wifi, FileBarChart,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/system/PageHeader";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageSkeleton } from "@/components/common/LoadingSkeleton";
import { ErrorState } from "@/components/common/ErrorState";
import { useMarketplace, useToggleFeature } from "@/hooks/useSystem";

export const Route = createFileRoute("/_authenticated/marketplace/")({
  component: MarketplacePage,
});

const ICONS: Record<string, LucideIcon> = {
  Wifi, LayoutTemplate, ShieldCheck, Network, BarChart3, Activity, Sparkles, Ticket,
  QrCode, Users, Palette, Building2, Code2, Bell, FileBarChart, Receipt,
};

const CATEGORIES = ["All", "Networking", "Auth", "Analytics", "Automation", "Branding", "Integrations", "Developer", "Commerce"];

function MarketplacePage() {
  const q = useMarketplace();
  const toggle = useToggleFeature();
  const [cat, setCat] = useState("All");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    return (q.data ?? []).filter((f) => {
      if (cat !== "All" && f.category !== cat) return false;
      if (search && !`${f.name} ${f.description}`.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [q.data, cat, search]);

  if (q.isLoading) return <PageSkeleton />;
  if (q.isError) return <ErrorState onRetry={() => q.refetch()} />;

  const installed = q.data?.filter((f) => f.status === "installed").length ?? 0;
  const available = q.data?.filter((f) => f.status === "available").length ?? 0;
  const upgrade = q.data?.filter((f) => f.status === "upgrade").length ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Feature marketplace"
        description="Enable capabilities across your workspace, from portals to AI copilots."
        actions={<Button variant="outline"><Store className="mr-2 h-4 w-4" />Browse plans</Button>}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <MiniStat label="Installed" value={installed} tone="text-emerald-500" />
        <MiniStat label="Available" value={available} tone="text-sky-500" />
        <MiniStat label="Upgrade required" value={upgrade} tone="text-amber-500" />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={cat} onValueChange={setCat} className="min-w-0 overflow-x-auto">
          <TabsList>
            {CATEGORIES.map((c) => (
              <TabsTrigger key={c} value={c}>{c}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <Input
          placeholder="Search features…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((f, i) => {
          const Icon = ICONS[f.icon] ?? Sparkles;
          return (
            <motion.div
              key={f.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.02 }}
            >
              <Card className="h-full">
                <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
                  <div className="flex items-start gap-3">
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <CardTitle className="truncate text-base">{f.name}</CardTitle>
                      <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{f.category}</span>
                        <span>•</span>
                        <Star className="h-3 w-3 text-amber-500" />
                        <span>{f.rating.toFixed(1)}</span>
                      </div>
                    </div>
                  </div>
                  <StatusBadge status={f.status} />
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{f.description}</p>
                  <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                    <Badge variant="outline" className="capitalize">{f.plan}</Badge>
                    <span>{f.users.toLocaleString()} users</span>
                  </div>
                </CardContent>
                <CardFooter className="flex items-center justify-between gap-2">
                  <Button variant="ghost" size="sm">Learn more</Button>
                  {f.status === "installed" ? (
                    <Button variant="outline" size="sm" onClick={() => toggle.mutate({ id: f.id, enable: false }, { onSuccess: () => toast.success(`${f.name} disabled`) })}>Disable</Button>
                  ) : f.status === "available" ? (
                    <Button size="sm" onClick={() => toggle.mutate({ id: f.id, enable: true }, { onSuccess: () => toast.success(`${f.name} enabled`) })}>Enable</Button>
                  ) : (
                    <Button size="sm" variant="secondary" onClick={() => toast.info("Contact sales to upgrade")}>Upgrade</Button>
                  )}
                </CardFooter>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className={`mt-1 text-2xl font-semibold ${tone}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: "installed" | "available" | "upgrade" }) {
  if (status === "installed") return <Badge className="bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/20">Installed</Badge>;
  if (status === "upgrade") return <Badge className="bg-amber-500/15 text-amber-600 hover:bg-amber-500/20">Upgrade</Badge>;
  return <Badge variant="outline">Available</Badge>;
}
