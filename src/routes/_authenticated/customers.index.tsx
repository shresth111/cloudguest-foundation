import { createFileRoute, Link } from "@tanstack/react-router";
import { Building2, FilterX, MapPin, Search, UserPlus } from "lucide-react";
import { useMemo, useState } from "react";
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

export const Route = createFileRoute("/_authenticated/customers/")({
  component: CustomersListPage,
});

type LocBucket = "any" | "1" | "2-5" | "6-10" | "10+";

function inBucket(count: number, bucket: LocBucket) {
  switch (bucket) {
    case "1":
      return count === 1;
    case "2-5":
      return count >= 2 && count <= 5;
    case "6-10":
      return count >= 6 && count <= 10;
    case "10+":
      return count > 10;
    default:
      return true;
  }
}

function CustomersListPage() {
  const { data, isLoading } = useCustomers();
  const [q, setQ] = useState("");
  const [owner, setOwner] = useState<string>("any");
  const [plan, setPlan] = useState<string>("any");
  const [status, setStatus] = useState<string>("any");
  const [locBucket, setLocBucket] = useState<LocBucket>("any");

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
    setOwner("any");
    setPlan("any");
    setStatus("any");
    setLocBucket("any");
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
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
          <CardTitle className="text-base">All customers</CardTitle>
          <div className="relative w-72 max-w-full">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, owner, email"
              className="pl-8"
            />
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
                    No customers match your search.
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
