import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { fallback, zodValidator } from "@tanstack/zod-adapter";
import {
  ArrowUpDown,
  Building2,
  ChevronLeft,
  ChevronRight,
  Eye,
  FilterX,
  MapPin,
  MoreHorizontal,
  Pencil,
  PlusCircle,
  Power,
  PowerOff,
  Search,
  Trash2,
  UserPlus,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { PageSkeleton } from "@/components/common/LoadingSkeleton";
import {
  useCustomers,
  useDeleteCustomer,
  useSetCustomerStatus,
  useUpdateCustomer,
} from "@/hooks/useCustomer";
import type { ExistingCustomer } from "@/services/customer.service";

const LOC_BUCKETS = ["any", "1", "2-5", "6-10", "10+"] as const;
type LocBucket = (typeof LOC_BUCKETS)[number];

const SORT_KEYS = ["name", "owner", "locations", "plan", "status", "expiry"] as const;
type SortKey = (typeof SORT_KEYS)[number];

const PAGE_SIZES = [10, 25, 50] as const;

const customersSearchSchema = z.object({
  q: fallback(z.string(), "").default(""),
  owner: fallback(z.string(), "any").default("any"),
  plan: fallback(z.string(), "any").default("any"),
  status: fallback(z.string(), "any").default("any"),
  loc: fallback(z.string(), "any").default("any"),
  sort: fallback(z.enum(SORT_KEYS), "name").default("name"),
  dir: fallback(z.enum(["asc", "desc"]), "asc").default("asc"),
  page: fallback(z.coerce.number().int().min(1), 1).default(1),
  size: fallback(z.coerce.number().int(), 10).default(10),
});

type CustomersSearch = z.infer<typeof customersSearchSchema>;

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

export const Route = createFileRoute("/_authenticated/customers/")({
  validateSearch: zodValidator(customersSearchSchema),
  component: CustomersListPage,
});

function CustomersListPage() {
  const { data, isLoading } = useCustomers();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  const updateMut = useUpdateCustomer();
  const statusMut = useSetCustomerStatus();
  const deleteMut = useDeleteCustomer();

  const [editing, setEditing] = useState<ExistingCustomer | null>(null);
  const [confirm, setConfirm] = useState<
    | { kind: "suspend" | "activate" | "delete"; customer: ExistingCustomer }
    | null
  >(null);

  const { q, owner, plan, status, sort, dir } = search;
  const locBucket: LocBucket = (LOC_BUCKETS as readonly string[]).includes(search.loc)
    ? (search.loc as LocBucket)
    : "any";
  const page = Math.max(1, search.page);
  const size = (PAGE_SIZES as readonly number[]).includes(search.size) ? search.size : 10;

  const setParam = (patch: Partial<CustomersSearch>) => {
    navigate({
      search: (prev) => {
        const next = { ...prev, ...patch } as CustomersSearch;
        if (
          patch.q !== undefined ||
          patch.owner !== undefined ||
          patch.plan !== undefined ||
          patch.status !== undefined ||
          patch.loc !== undefined
        ) {
          next.page = 1;
        }
        const cleaned: Record<string, string | number> = {};
        for (const [k, v] of Object.entries(next)) {
          if (v === undefined || v === null) continue;
          const isDefault =
            (k === "q" && v === "") ||
            ((k === "owner" || k === "plan" || k === "status" || k === "loc") && v === "any") ||
            (k === "sort" && v === "name") ||
            (k === "dir" && v === "asc") ||
            (k === "page" && v === 1) ||
            (k === "size" && v === 10);
          if (!isDefault) cleaned[k] = v as string | number;
        }
        return cleaned as unknown as typeof prev;
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
        !c.owner.name.toLowerCase().includes(needle) &&
        !c.id.toLowerCase().includes(needle)
      )
        return false;
      if (owner !== "any" && c.owner.email !== owner) return false;
      if (plan !== "any" && c.subscription.plan !== plan) return false;
      if (status !== "any" && c.status !== status) return false;
      if (!inBucket(c.locations.length, locBucket)) return false;
      return true;
    });
  }, [data, q, owner, plan, status, locBucket]);

  const sorted = useMemo(() => {
    const list = [...filtered];
    const mult = dir === "asc" ? 1 : -1;
    list.sort((a, b) => {
      switch (sort) {
        case "name":
          return a.name.localeCompare(b.name) * mult;
        case "owner":
          return a.owner.name.localeCompare(b.owner.name) * mult;
        case "locations":
          return (a.locations.length - b.locations.length) * mult;
        case "plan":
          return a.subscription.plan.localeCompare(b.subscription.plan) * mult;
        case "status":
          return a.status.localeCompare(b.status) * mult;
        case "expiry":
          return (
            (new Date(a.subscription.expiryDate).getTime() -
              new Date(b.subscription.expiryDate).getTime()) *
            mult
          );
      }
    });
    return list;
  }, [filtered, sort, dir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / size));
  const currentPage = Math.min(page, totalPages);
  const paged = sorted.slice((currentPage - 1) * size, currentPage * size);

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

  const resetFilters = () => navigate({ search: {} as never, replace: true });

  const toggleSort = (key: SortKey) => {
    if (sort === key) setParam({ dir: dir === "asc" ? "desc" : "asc" });
    else setParam({ sort: key, dir: "asc" });
  };

  const handleAction = async () => {
    if (!confirm) return;
    const { kind, customer } = confirm;
    try {
      if (kind === "delete") {
        await deleteMut.mutateAsync(customer.id);
        toast.success(`Customer ${customer.name} deleted`);
      } else {
        const nextStatus = kind === "suspend" ? "suspended" : "active";
        await statusMut.mutateAsync({ id: customer.id, status: nextStatus });
        toast.success(`${customer.name} ${kind === "suspend" ? "suspended" : "activated"}`);
      }
    } catch {
      toast.error("Action failed");
    } finally {
      setConfirm(null);
    }
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
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-base">
              All customers
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                {sorted.length} result{sorted.length === 1 ? "" : "s"}
                {activeFilters > 0 && ` · ${activeFilters} filter${activeFilters > 1 ? "s" : ""}`}
              </span>
            </CardTitle>
            <div className="relative w-72 max-w-full">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setParam({ q: e.target.value })}
                placeholder="Search name, ID, owner, email"
                className="pl-8"
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={owner} onValueChange={(v) => setParam({ owner: v })}>
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
            <Select value={plan} onValueChange={(v) => setParam({ plan: v })}>
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
            <Select value={status} onValueChange={(v) => setParam({ status: v })}>
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
            <Select value={locBucket} onValueChange={(v) => setParam({ loc: v })}>
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
                <SortableHead label="Customer" active={sort === "name"} dir={dir} onClick={() => toggleSort("name")} />
                <SortableHead label="Owner" active={sort === "owner"} dir={dir} onClick={() => toggleSort("owner")} />
                <SortableHead
                  label="Locations"
                  active={sort === "locations"}
                  dir={dir}
                  onClick={() => toggleSort("locations")}
                />
                <SortableHead label="Plan" active={sort === "plan"} dir={dir} onClick={() => toggleSort("plan")} />
                <SortableHead label="Status" active={sort === "status"} dir={dir} onClick={() => toggleSort("status")} />
                <SortableHead label="Expiry" active={sort === "expiry"} dir={dir} onClick={() => toggleSort("expiry")} />
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                        <Building2 className="h-4 w-4" />
                      </div>
                      <div>
                        <Link
                          to="/customers/$customerId"
                          params={{ customerId: c.id }}
                          className="font-medium hover:underline"
                        >
                          {c.name}
                        </Link>
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
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(c.subscription.expiryDate).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <RowActions
                      customer={c}
                      onEdit={() => setEditing(c)}
                      onSuspend={() => setConfirm({ kind: "suspend", customer: c })}
                      onActivate={() => setConfirm({ kind: "activate", customer: c })}
                      onDelete={() => setConfirm({ kind: "delete", customer: c })}
                    />
                  </TableCell>
                </TableRow>
              ))}
              {paged.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                    No customers match your filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Rows per page</span>
            <Select value={String(size)} onValueChange={(v) => setParam({ size: Number(v), page: 1 })}>
              <SelectTrigger className="h-8 w-[80px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZES.map((s) => (
                  <SelectItem key={s} value={String(s)}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-muted-foreground">
              Page {currentPage} of {totalPages}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                disabled={currentPage <= 1}
                onClick={() => setParam({ page: currentPage - 1 })}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                disabled={currentPage >= totalPages}
                onClick={() => setParam({ page: currentPage + 1 })}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </Card>

      <EditCustomerDialog
        customer={editing}
        onClose={() => setEditing(null)}
        onSave={async (patch) => {
          if (!editing) return;
          try {
            await updateMut.mutateAsync([editing.id, patch]);
            toast.success("Customer updated");
            setEditing(null);
          } catch {
            toast.error("Update failed");
          }
        }}
        saving={updateMut.isPending}
      />

      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={
          confirm?.kind === "delete"
            ? `Delete ${confirm.customer.name}?`
            : confirm?.kind === "suspend"
              ? `Suspend ${confirm.customer.name}?`
              : `Activate ${confirm?.customer.name ?? ""}?`
        }
        description={
          confirm?.kind === "delete"
            ? "This will permanently remove the customer record from the mock catalog."
            : confirm?.kind === "suspend"
              ? "The tenant will lose access to their captive portal and dashboards until reactivated."
              : "The tenant will regain access with their current subscription."
        }
        confirmLabel={
          confirm?.kind === "delete" ? "Delete" : confirm?.kind === "suspend" ? "Suspend" : "Activate"
        }
        destructive={confirm?.kind === "delete" || confirm?.kind === "suspend"}
        onConfirm={handleAction}
      />
    </div>
  );
}

function SortableHead({
  label,
  active,
  dir,
  onClick,
}: {
  label: string;
  active: boolean;
  dir: "asc" | "desc";
  onClick: () => void;
}) {
  return (
    <TableHead>
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center gap-1 text-xs font-medium uppercase tracking-wide hover:text-foreground"
      >
        {label}
        <ArrowUpDown
          className={
            "h-3.5 w-3.5 transition " +
            (active ? "text-foreground " : "text-muted-foreground/50 ") +
            (active && dir === "desc" ? "rotate-180" : "")
          }
        />
      </button>
    </TableHead>
  );
}

function RowActions({
  customer,
  onEdit,
  onSuspend,
  onActivate,
  onDelete,
}: {
  customer: ExistingCustomer;
  onEdit: () => void;
  onSuspend: () => void;
  onActivate: () => void;
  onDelete: () => void;
}) {
  const navigate = useNavigate();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreHorizontal className="h-4 w-4" />
          <span className="sr-only">Actions</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel>{customer.name}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() =>
            navigate({ to: "/customers/$customerId", params: { customerId: customer.id } })
          }
        >
          <Eye className="mr-2 h-4 w-4" /> View details
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onEdit}>
          <Pencil className="mr-2 h-4 w-4" /> Edit customer
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() =>
            navigate({
              to: "/customers/$customerId",
              params: { customerId: customer.id },
              search: { section: "locations" },
            })
          }
        >
          <PlusCircle className="mr-2 h-4 w-4" /> Provision location
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {customer.status === "suspended" ? (
          <DropdownMenuItem onClick={onActivate}>
            <Power className="mr-2 h-4 w-4" /> Activate
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onClick={onSuspend}>
            <PowerOff className="mr-2 h-4 w-4" /> Suspend
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onClick={onDelete}
        >
          <Trash2 className="mr-2 h-4 w-4" /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function EditCustomerDialog({
  customer,
  onClose,
  onSave,
  saving,
}: {
  customer: ExistingCustomer | null;
  onClose: () => void;
  onSave: (patch: {
    name?: string;
    ownerName?: string;
    ownerEmail?: string;
    ownerMobile?: string;
  }) => void;
  saving: boolean;
}) {
  const [name, setName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerMobile, setOwnerMobile] = useState("");

  const open = !!customer;

  const handleOpenChange = (o: boolean) => {
    if (!o) onClose();
    if (o && customer) {
      setName(customer.name);
      setOwnerName(customer.owner.name);
      setOwnerEmail(customer.owner.email);
      setOwnerMobile(customer.owner.mobile);
    }
  };

  // Populate on open
  useMemo(() => {
    if (customer) {
      setName(customer.name);
      setOwnerName(customer.owner.name);
      setOwnerEmail(customer.owner.email);
      setOwnerMobile(customer.owner.mobile);
    }
  }, [customer]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit customer</DialogTitle>
          <DialogDescription>
            Update tenant profile and primary contact details.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="cust-name">Company name</Label>
            <Input id="cust-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="own-name">Owner name</Label>
            <Input id="own-name" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="own-email">Owner email</Label>
              <Input
                id="own-email"
                type="email"
                value={ownerEmail}
                onChange={(e) => setOwnerEmail(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="own-mobile">Owner mobile</Label>
              <Input
                id="own-mobile"
                value={ownerMobile}
                onChange={(e) => setOwnerMobile(e.target.value)}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={() => onSave({ name, ownerName, ownerEmail, ownerMobile })}
            disabled={saving || !name.trim() || !ownerEmail.trim()}
          >
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
