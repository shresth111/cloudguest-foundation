import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { fallback, zodValidator } from "@tanstack/zod-adapter";
import { Building2, FilterX, MapPin, Search, UserPlus } from "lucide-react";
import { useMemo } from "react";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageSkeleton } from "@/components/common/LoadingSkeleton";
import { useCustomers } from "@/hooks/useCustomer";

const LOC_BUCKETS = ["any", "1", "2-5", "6-10", "10+"] as const;
type LocBucket = (typeof LOC_BUCKETS)[number];

const customersSearchSchema = z.object({
  q: fallback(z.string(), "").default(""),
  owner: fallback(z.string(), "any").default("any"),
  plan: fallback(z.string(), "any").default("any"),
  status: fallback(z.string(), "any").default("any"),
  loc: fallback(z.string(), "any").default("any"),
});

export const Route = createFileRoute("/_authenticated/customers/")({
  validateSearch: zodValidator(customersSearchSchema),
  search: {
    middlewares: [
      // Keep URLs clean by stripping defaults
      ({ next, search }) => {
        const result = next(search);
        return result;
      },
    ],
  },
  component: CustomersListPage,
});

function CustomersListPage() {
  const { data, isLoading } = useCustomers();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  const q = search.q;
  const owner = search.owner;
  const plan = search.plan;
  const status = search.status;
  const locBucket: LocBucket = (LOC_BUCKETS as readonly string[]).includes(search.loc)
    ? (search.loc as LocBucket)
    : "any";

  const setParam = (
    patch: Partial<{ q: string; owner: string; plan: string; status: string; loc: string }>,
  ) => {
    navigate({
      search: (prev) => {
        const nextSearch = { ...prev, ...patch };
        // Strip defaults from the URL for shareable, clean links
        const cleaned: Record<string, string> = {};
        for (const [k, v] of Object.entries(nextSearch)) {
          const isDefault = k === "q" ? v === "" : v === "any";
          if (!isDefault && typeof v === "string") cleaned[k] = v;
        }
        return cleaned as typeof prev;
      },
      replace: true,
    });
  };


  const owners = useMemo(() => {
    const set = new Map<string, string>();
    (data ?? []).forEach((c) => set.set(c.owner.email, c.owner.name));
    return Array.from(set.entries()).map(([email, name]) => ({ email, name }));
  }, [data]);

  const plans = useMemo(
    () => Array.from(new Set((data ?? []).map((c) => c.subscription.plan))),
    [data],
  );
  const statuses = useMemo(
    () => Array.from(new Set((data ?? []).map((c) => c.status))),
    [data],
  );

  const filtered = useMemo(() => {
    const src = data ?? [];
    const needle = q.trim().toLowerCase();
    return src.filter((c) => {
      if (
        needle &&
        !c.name.toLowerCase().includes(needle) &&
        !c.owner.email.toLowerCase().includes(needle) &&
        !c.owner.name.toLowerCase().includes(needle)
      )
        return false;
      if (owner !== "any" && c.owner.email !== owner) return false;
      if (plan !== "any" && c.subscription.plan !== plan) return false;
      if (status !== "any" && c.status !== status) return false;
      if (!inBucket(c.locations.length, locBucket)) return false;
      return true;
    });
  }, [data, q, owner, plan, status, locBucket]);

  const totals = useMemo(() => {
    const src = data ?? [];
    return {
      customers: src.length,
      locations: src.reduce((n, c) => n + c.locations.length, 0),
      active: src.filter((c) => c.status === "active").length,
      trial: src.filter((c) => c.status === "trial").length,
    };
  }, [data]);

  const activeFilters =
    (owner !== "any" ? 1 : 0) +
    (plan !== "any" ? 1 : 0) +
    (status !== "any" ? 1 : 0) +
    (locBucket !== "any" ? 1 : 0);

  const resetFilters = () => {
    navigate({ search: {} as never, replace: true });
  };



  if (isLoading) return <PageSkeleton />;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Customers</h1>
          <p className="text-sm text-muted-foreground">
            End-to-end view of every tenant, their organization, locations and services.
          </p>
        </div>
        <Button asChild>
          <Link to="/locations">
            <UserPlus className="mr-2 h-4 w-4" /> Provision new
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Total customers" value={totals.customers} />
        <StatCard label="Total locations" value={totals.locations} icon={<MapPin className="h-4 w-4" />} />
        <StatCard label="Active" value={totals.active} tone="success" />
        <StatCard label="On trial" value={totals.trial} tone="warning" />
      </div>

      <Card>
        <CardHeader className="space-y-3">
          <div className="flex flex-row items-center justify-between gap-3">
            <CardTitle className="text-base">
              All customers
              {activeFilters > 0 && (
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  {filtered.length} of {data?.length ?? 0} · {activeFilters} filter
                  {activeFilters > 1 ? "s" : ""}
                </span>
              )}
            </CardTitle>
            <div className="relative w-72 max-w-full">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search name, owner, email"
                className="pl-8"
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={owner} onValueChange={setOwner}>
              <SelectTrigger className="h-9 w-[200px]">
                <SelectValue placeholder="Owner" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">All owners</SelectItem>
                {owners.map((o) => (
                  <SelectItem key={o.email} value={o.email}>
                    {o.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={plan} onValueChange={setPlan}>
              <SelectTrigger className="h-9 w-[160px]">
                <SelectValue placeholder="Plan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">All plans</SelectItem>
                {plans.map((p) => (
                  <SelectItem key={p} value={p} className="capitalize">
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="h-9 w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">All statuses</SelectItem>
                {statuses.map((s) => (
                  <SelectItem key={s} value={s} className="capitalize">
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={locBucket} onValueChange={(v) => setLocBucket(v as LocBucket)}>
              <SelectTrigger className="h-9 w-[180px]">
                <SelectValue placeholder="Locations" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any # of locations</SelectItem>
                <SelectItem value="1">1 location</SelectItem>
                <SelectItem value="2-5">2 – 5 locations</SelectItem>
                <SelectItem value="6-10">6 – 10 locations</SelectItem>
                <SelectItem value="10+">10+ locations</SelectItem>
              </SelectContent>
            </Select>
            {activeFilters > 0 && (
              <Button variant="ghost" size="sm" onClick={resetFilters}>
                <FilterX className="mr-1.5 h-4 w-4" /> Clear
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Locations</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                        <Building2 className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="font-medium">{c.name}</div>
                        <div className="text-xs text-muted-foreground">{c.id}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{c.owner.name}</div>
                    <div className="text-xs text-muted-foreground">{c.owner.email}</div>
                  </TableCell>
                  <TableCell>{c.locations.length}</TableCell>
                  <TableCell className="capitalize">{c.subscription.plan}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        c.status === "active"
                          ? "default"
                          : c.status === "trial"
                            ? "secondary"
                            : "destructive"
                      }
                      className="capitalize"
                    >
                      {c.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" asChild>
                      <Link to="/customers/$customerId" params={{ customerId: c.id }}>
                        Open
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                    No customers match your filters.
                  </TableCell>

                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: number;
  icon?: React.ReactNode;
  tone?: "success" | "warning";
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{label}</span>
          {icon}
        </div>
        <div
          className={
            "mt-1 text-2xl font-semibold " +
            (tone === "success"
              ? "text-emerald-600 dark:text-emerald-400"
              : tone === "warning"
                ? "text-amber-600 dark:text-amber-400"
                : "")
          }
        >
          {value}
        </div>
      </CardContent>
    </Card>
  );
}
