import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Apple, Building2, Chrome, Code2, CreditCard, Facebook, Mail, MessageSquare, Network,
  Router, ShieldCheck, Slack, Users, Webhook, type LucideIcon,
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
import { useIntegrations } from "@/hooks/useSystem";

export const Route = createFileRoute("/_authenticated/integrations/")({
  component: IntegrationsPage,
});

const ICONS: Record<string, LucideIcon> = {
  Router, ShieldCheck, Network, Mail, MessageSquare, Chrome, Facebook, Apple, Building2,
  CreditCard, Slack, Users, Webhook, Code2,
};
const TABS: { key: string; label: string }[] = [
  { key: "all", label: "All" },
  { key: "network", label: "Network" },
  { key: "auth", label: "Authentication" },
  { key: "payments", label: "Payments" },
  { key: "messaging", label: "Messaging" },
  { key: "pms", label: "PMS" },
  { key: "developer", label: "Developer" },
];

function IntegrationsPage() {
  const q = useIntegrations();
  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => (q.data ?? []).filter((i) => {
    if (tab !== "all" && i.category !== tab) return false;
    if (search && !i.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [q.data, tab, search]);

  if (q.isLoading) return <PageSkeleton />;
  if (q.isError) return <ErrorState onRetry={() => q.refetch()} />;

  return (
    <div className="space-y-6">
      <PageHeader title="Integrations" description="Connect CloudGuest with the tools your team already uses." />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={tab} onValueChange={setTab} className="min-w-0 overflow-x-auto">
          <TabsList>
            {TABS.map((t) => <TabsTrigger key={t.key} value={t.key}>{t.label}</TabsTrigger>)}
          </TabsList>
        </Tabs>
        <Input placeholder="Search integrations…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((i) => {
          const Icon = ICONS[i.icon] ?? Code2;
          return (
            <Card key={i.id} className="h-full">
              <CardHeader className="flex flex-row items-start justify-between space-y-0">
                <div className="flex items-start gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-muted text-foreground">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <CardTitle className="truncate text-base">{i.name}</CardTitle>
                    <p className="mt-0.5 text-xs capitalize text-muted-foreground">{i.category}</p>
                  </div>
                </div>
                {i.status === "connected" && <Badge className="bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/20">Connected</Badge>}
                {i.status === "available" && <Badge variant="outline">Available</Badge>}
                {i.status === "error" && <Badge variant="destructive">Error</Badge>}
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{i.description}</p>
              </CardContent>
              <CardFooter className="justify-end gap-2">
                {i.status === "connected" ? (
                  <>
                    <Button variant="ghost" size="sm" onClick={() => toast.success(`${i.name} settings opened`)}>Configure</Button>
                    <Button variant="outline" size="sm" onClick={() => toast.success(`${i.name} disconnected`)}>Disconnect</Button>
                  </>
                ) : (
                  <Button size="sm" onClick={() => toast.success(`${i.name} connected`)}>Connect</Button>
                )}
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
