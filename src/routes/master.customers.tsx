import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Search, Plus, MapPin, UserCog, CreditCard, Ban, CheckCircle, Mail, Phone, Loader2 } from "lucide-react";
import { MasterShell } from "@/components/master/MasterShell";
import {
  MSectionHeader, MSeg, MTag, MButton, MTable, MTh, MTd, MTr, MDrawer,
} from "@/components/master/MasterKit";
import { organizationService } from "@/services/organization.service";
import { locationService } from "@/services/location.service";
import { billingService } from "@/services/billing.service";
import { PlatformLocationWizard } from "@/components/locations/PlatformLocationWizard";
import type { Organization, OrgStatus } from "@/types/organization";

export const Route = createFileRoute("/master/customers")({
  component: CustomersScreen,
});

type Filter = "all" | OrgStatus;

interface Enriched extends Organization {
  locationCount: number;
  planName: string | null;
}

function CustomersScreen() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Enriched | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rows, setRows] = useState<Enriched[]>([]);

  async function refetch() {
    setLoading(true);
    try {
      const [{ rows: orgs }, locations, snapshot] = await Promise.all([
        organizationService.list({ page: 1, pageSize: 200 }),
        locationService.listAll(),
        billingService.getSnapshot().catch(() => null),
      ]);
      const locCounts = new Map<string, number>();
      for (const l of locations) locCounts.set(l.organizationId, (locCounts.get(l.organizationId) ?? 0) + 1);
      const planByOrg = new Map<string, string>();
      snapshot?.subscriptions.forEach((s) => planByOrg.set(s.organizationId, s.planName));

      setRows(
        orgs.map((o) => ({
          ...o,
          locationCount: locCounts.get(o.id) ?? 0,
          planName: planByOrg.get(o.id) ?? null,
        })),
      );
    } catch {
      toast.error("Could not load customers from the server.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refetch();
  }, []);

  const filtered = useMemo(
    () =>
      rows
        .filter((c) => (filter === "all" ? true : c.status === filter))
        .filter((c) => !q || c.name.toLowerCase().includes(q.toLowerCase()) || c.contactEmail.toLowerCase().includes(q.toLowerCase())),
    [rows, filter, q],
  );

  async function handleToggleStatus(c: Enriched) {
    const next: OrgStatus = c.status === "suspended" ? "active" : "suspended";
    setBusyId(c.id);
    try {
      await organizationService.updateStatus([c.id], next);
      toast.success(`${c.name} ${next === "suspended" ? "suspended" : "reactivated"}`);
      setSelected(null);
      refetch();
    } catch {
      toast.error("Could not update customer status.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <MasterShell title="Customers">
      <MSectionHeader
        eyebrow="Tenants"
        title="Customers"
        actions={<MButton variant="primary" onClick={() => setAddOpen(true)}><Plus /> Add Customer</MButton>}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <MSeg
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "All" },
            { value: "active", label: "Active" },
            { value: "trial", label: "Trial" },
            { value: "suspended", label: "Suspended" },
          ]}
        />
        <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or email…" className="w-56 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-card p-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading customers…
        </div>
      ) : (
        <MTable head={<><MTh>Customer</MTh><MTh className="hidden md:table-cell">Contact</MTh><MTh>Plan</MTh><MTh className="hidden sm:table-cell">Loc.</MTh><MTh>Status</MTh></>}>
          {filtered.map((c) => (
            <MTr key={c.id} onClick={() => setSelected(c)}>
              <MTd>
                <p className="font-semibold">{c.name}</p>
                <p className="text-xs text-muted-foreground">{c.orgType === "msp" ? "MSP" : "Standard"} · since {new Date(c.createdAt).toLocaleDateString()}</p>
              </MTd>
              <MTd className="hidden md:table-cell">
                <p className="text-xs text-muted-foreground">{c.contactEmail}</p>
                <p className="text-xs text-muted-foreground">{c.contactPhone ?? "—"}</p>
              </MTd>
              <MTd className="text-sm">{c.planName ?? "—"}</MTd>
              <MTd className="hidden tabular-nums sm:table-cell">{c.locationCount}</MTd>
              <MTd><MTag label={c.status} /></MTd>
            </MTr>
          ))}
          {filtered.length === 0 && (
            <MTr><MTd className="py-10 text-center text-muted-foreground"><span className="block">No customers match your filter.</span></MTd></MTr>
          )}
        </MTable>
      )}

      {/* Detail drawer */}
      <MDrawer
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.name ?? ""}
        subtitle={selected ? `${selected.orgType === "msp" ? "MSP" : "Standard"} · since ${new Date(selected.createdAt).toLocaleDateString()}` : ""}
        footer={
          selected && (
            <div className="grid grid-cols-2 gap-2">
              <MButton variant="outline" onClick={() => navigate({ to: "/master/locations" })}><MapPin /> New Location</MButton>
              <MButton variant="outline" onClick={() => toast.info("Impersonation isn't available yet.")}><UserCog /> Impersonate</MButton>
              <MButton variant="outline" onClick={() => navigate({ to: "/master/billing" })}><CreditCard /> Edit Plan</MButton>
              <MButton
                variant="primary"
                disabled={busyId === selected.id}
                onClick={() => handleToggleStatus(selected)}
              >
                {selected.status === "suspended" ? <CheckCircle /> : <Ban />}
                {selected.status === "suspended" ? "Reactivate" : "Suspend"}
              </MButton>
            </div>
          )
        }
      >
        {selected && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-border p-3"><p className="text-xs font-medium text-muted-foreground">Plan</p><p className="mt-1 text-lg font-semibold">{selected.planName ?? "—"}</p></div>
              <div className="rounded-lg border border-border p-3"><p className="text-xs font-medium text-muted-foreground">Status</p><div className="mt-1.5"><MTag label={selected.status} /></div></div>
              <div className="rounded-lg border border-border p-3"><p className="text-xs font-medium text-muted-foreground">Locations</p><p className="mt-1 text-lg font-semibold tabular-nums">{selected.locationCount}</p></div>
              <div className="rounded-lg border border-border p-3"><p className="text-xs font-medium text-muted-foreground">Timezone</p><p className="mt-1 text-lg font-semibold">{selected.timezone}</p></div>
            </div>
            <div className="space-y-2">
              <p className="flex items-center gap-2 text-sm"><Mail className="h-4 w-4 text-primary" /> {selected.contactEmail}</p>
              <p className="flex items-center gap-2 text-sm"><Phone className="h-4 w-4 text-primary" /> {selected.contactPhone ?? "Not provided"}</p>
            </div>
            {selected.legalName && (
              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground">Legal name</p>
                <p className="text-sm">{selected.legalName}</p>
              </div>
            )}
          </div>
        )}
      </MDrawer>

      {/* Smart provisioning: creates the organization (or reuses one), its first
          location, first router, plan assignment, and a real owner account with
          a server-generated login + temporary password -- all in one transaction
          via POST /locations/provision. This is the actual "new customer" flow;
          it already existed wired into the regular authenticated Locations page
          (see components/locations/PlatformLocationWizard.tsx) but was never
          reachable from the Master (super-admin) dashboard. */}
      <PlatformLocationWizard open={addOpen} onOpenChange={setAddOpen} onProvisioned={() => refetch()} />
    </MasterShell>
  );
}
