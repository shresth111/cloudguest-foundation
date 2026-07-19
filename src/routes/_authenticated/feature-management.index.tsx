import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search, ToggleRight } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/system/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageSkeleton } from "@/components/common/LoadingSkeleton";
import { ErrorState } from "@/components/common/ErrorState";
import { useMarketplace } from "@/hooks/useSystem";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/feature-management/")({
  component: FeatureManagementPage,
});

function FeatureManagementPage() {
  const { data, isLoading, isError, refetch } = useMarketplace();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});

  const categories = useMemo(() => {
    const set = new Set<string>(["all"]);
    (data ?? []).forEach((f) => set.add(f.category));
    return Array.from(set);
  }, [data]);

  const filtered = useMemo(() => {
    return (data ?? []).filter((f) => {
      if (category !== "all" && f.category !== category) return false;
      if (query && !`${f.name} ${f.description}`.toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    });
  }, [data, category, query]);

  const toggle = (id: string, next: boolean) => {
    setOverrides((prev) => ({ ...prev, [id]: next }));
    toast.success(`${next ? "Enabled" : "Disabled"} feature globally`);
  };

  const isEnabled = (id: string, status: string) =>
    overrides[id] ?? (status === "installed" || status === "upgrade");

  if (isLoading) return <PageSkeleton />;
  if (isError || !data) return <ErrorState onRetry={() => refetch()} />;

  const totalEnabled = filtered.filter((f) => isEnabled(f.id, f.status)).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Feature management"
        description="Enable, disable and gate platform features per plan. Changes propagate to all customers on the affected tier."
      />

      <div className="grid gap-3 md:grid-cols-4">
        <StatCard label="Total features" value={data.length} />
        <StatCard label="Enabled" value={totalEnabled} tone="success" />
        <StatCard label="Categories" value={categories.length - 1} />
        <StatCard label="Requires upgrade" value={data.filter((f) => f.status === "upgrade").length} tone="warning" />
      </div>

      <Card>
        <CardHeader className="gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-base">All features</CardTitle>
            <div className="relative w-72 max-w-full">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search features"
                className="pl-8"
              />
            </div>
          </div>
          <Tabs value={category} onValueChange={setCategory}>
            <TabsList className="flex-wrap">
              {categories.map((c) => (
                <TabsTrigger key={c} value={c} className="capitalize">
                  {c === "all" ? "All" : c}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((f) => {
              const enabled = isEnabled(f.id, f.status);
              return (
                <div
                  key={f.id}
                  className={cn(
                    "flex items-start justify-between gap-3 rounded-lg border p-4 transition-colors",
                    enabled ? "bg-card" : "bg-muted/40",
                  )}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <ToggleRight className="h-4 w-4 text-primary" />
                      <div className="truncate font-medium">{f.name}</div>
                      <Badge variant="outline" className="capitalize">{f.plan}</Badge>
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{f.description}</p>
                    <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{f.category}</span>
                      <span>·</span>
                      <span>{f.users.toLocaleString()} users</span>
                      <span>·</span>
                      <span>★ {f.rating}</span>
                    </div>
                  </div>
                  <Switch
                    checked={enabled}
                    onCheckedChange={(v) => toggle(f.id, v)}
                    aria-label={`Toggle ${f.name}`}
                  />
                </div>
              );
            })}
          </div>
          {filtered.length === 0 && (
            <div className="py-10 text-center text-sm text-muted-foreground">No features match your filters.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number | string; tone?: "success" | "warning" }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div
          className={cn(
            "mt-1 text-2xl font-semibold tracking-tight",
            tone === "success" && "text-emerald-600 dark:text-emerald-400",
            tone === "warning" && "text-amber-600 dark:text-amber-400",
          )}
        >
          {value}
        </div>
      </CardContent>
    </Card>
  );
}
