import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { toast } from "sonner";
import { Search, Plus, MapPin, CreditCard, Ban, CheckCircle, Mail, Phone } from "lucide-react";
import { MasterShell } from "@/components/master/MasterShell";
import {
  MPageShell,
  MSectionHeader,
  MSeg,
  MTag,
  MButton,
  MTable,
  MTh,
  MTd,
  MTr,
  MDrawer,
} from "@/components/master/MasterKit";
import { organizationService } from "@/services/organization.service";
import { locationService } from "@/services/location.service";
import { billingService } from "@/services/billing.service";
import { PlatformLocationWizard } from "@/components/locations/PlatformLocationWizard";
import { businessTypeIcon } from "@/lib/business-type-icons";
import type { PropertyType } from "@/types/location";
import type { Organization, OrgStatus } from "@/types/organization";

export const Route = createFileRoute("/master/customers")({
  // `open` carries an organization id in from MasterSearch (the header's
  // real platform search) -- this page has no URL-addressable customer
  // detail route of its own (detail is a local-state drawer, see `selected`
  // below), so a search result jumps here and this auto-opens that row's
  // drawer once the real data has loaded, instead of landing on the
  // Customers list with no indication *which* customer was searched for.
  validateSearch: z.object({ open: z.string().optional() }),
  component: CustomersScreen,
});

type Filter = "all" | OrgStatus;

interface Enriched extends Organization {
  locationCount: number;
  planName: string | null;
  // `Organization` itself carries no business-type field (only
  // `Location.propertyType` does -- see business-type-icons.ts's doc
  // comment) -- represent the org by its first/primary location's type, if
  // it has any locations at all.
  businessType: PropertyType | null;
}

function CustomersScreen() {
  const navigate = useNavigate();
  const { open: openOrgId } = Route.useSearch();
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Enriched | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  // Set when the wizard is opened from an existing customer's own "New
  // Location" action so it opens pre-scoped to that customer instead of
  // asking to re-pick it (see PlatformLocationWizard's initialOrganizationId
  // doc comment) -- undefined for the plain "Add Customer" entry point.
  const [wizardOrgId, setWizardOrgId] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rows, setRows] = useState<Enriched[]>([]);

  async function refetch() {
    setLoading(true);
    try {
      const [{ rows: orgs }, locations, snapshot] = await Promise.all([
        organizationService.list({ page: 1, pageSize: 100 }),
        locationService.listAll(),
        billingService.getSnapshot().catch(() => null),
      ]);
      const locCounts = new Map<string, number>();
      const businessTypeByOrg = new Map<string, PropertyType | null>();
      for (const l of locations) {
        locCounts.set(l.organizationId, (locCounts.get(l.organizationId) ?? 0) + 1);
        if (!businessTypeByOrg.has(l.organizationId))
          businessTypeByOrg.set(l.organizationId, l.propertyType);
      }
      const planByOrg = new Map<string, string>();
      snapshot?.subscriptions.forEach((s) => planByOrg.set(s.organizationId, s.planName));

      setRows(
        orgs.map((o) => ({
          ...o,
          locationCount: locCounts.get(o.id) ?? 0,
          planName: planByOrg.get(o.id) ?? null,
          businessType: businessTypeByOrg.get(o.id) ?? null,
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

  // Auto-open the drawer for a search result once the real customer list
  // has loaded, then drop `open` from the URL so it doesn't re-trigger on
  // an unrelated refetch (e.g. after a status toggle).
  useEffect(() => {
    if (!openOrgId || rows.length === 0) return;
    const match = rows.find((r) => r.id === openOrgId);
    if (match) setSelected(match);
    navigate({ to: "/master/customers", search: {}, replace: true });
  }, [openOrgId, rows]);

  const filtered = useMemo(
    () =>
      rows
        .filter((c) => (filter === "all" ? true : c.status === filter))
        .filter(
          (c) =>
            !q ||
            c.name.toLowerCase().includes(q.toLowerCase()) ||
            c.contactEmail.toLowerCase().includes(q.toLowerCase()),
        ),
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
      <MPageShell>
        <MSectionHeader
          eyebrow="Tenants"
          title="Customers"
          actions={
            <MButton
              variant="primary"
              onClick={() => {
                setWizardOrgId(undefined);
                setAddOpen(true);
              }}
            >
              <Plus /> Add Customer
            </MButton>
          }
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
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name or email…"
              className="w-56 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
        </div>

        <MTable
          loading={loading}
          head={
            <>
              <MTh>Customer</MTh>
              <MTh className="hidden md:table-cell">Contact</MTh>
              <MTh>Plan</MTh>
              <MTh className="hidden sm:table-cell">Loc.</MTh>
              <MTh>Status</MTh>
            </>
          }
        >
          {!loading &&
            filtered.map((c) => {
              const TypeIcon = businessTypeIcon(c.businessType);
              return (
                <MTr key={c.id} onClick={() => setSelected(c)}>
                  <MTd>
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <TypeIcon className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="font-semibold">{c.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {c.orgType === "msp" ? "MSP" : "Standard"} · since{" "}
                          {new Date(c.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </MTd>
                  <MTd className="hidden md:table-cell">
                    <p className="text-xs text-muted-foreground">{c.contactEmail}</p>
                    <p className="text-xs text-muted-foreground">{c.contactPhone ?? "—"}</p>
                  </MTd>
                  <MTd className="text-sm">{c.planName ?? "—"}</MTd>
                  <MTd className="hidden tabular-nums sm:table-cell">{c.locationCount}</MTd>
                  <MTd>
                    <MTag label={c.status} />
                  </MTd>
                </MTr>
              );
            })}
          {!loading && filtered.length === 0 && (
            <MTr>
              <MTd className="py-10 text-center text-muted-foreground">
                <span className="block">No customers match your filter.</span>
              </MTd>
            </MTr>
          )}
        </MTable>

        {/* Detail drawer */}
        <MDrawer
          open={!!selected}
          onClose={() => setSelected(null)}
          title={selected?.name ?? ""}
          subtitle={
            selected
              ? `${selected.orgType === "msp" ? "MSP" : "Standard"} · since ${new Date(selected.createdAt).toLocaleDateString()}`
              : ""
          }
          footer={
            selected && (
              <div className="grid grid-cols-2 gap-2">
                <MButton
                  variant="outline"
                  onClick={() => {
                    setWizardOrgId(selected.id);
                    setAddOpen(true);
                  }}
                >
                  <MapPin /> New Location
                </MButton>
                <MButton variant="outline" onClick={() => navigate({ to: "/master/billing" })}>
                  <CreditCard /> Edit Plan
                </MButton>
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
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs font-medium text-muted-foreground">Plan</p>
                  <p className="mt-1 text-lg font-semibold">{selected.planName ?? "—"}</p>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs font-medium text-muted-foreground">Status</p>
                  <div className="mt-1.5">
                    <MTag label={selected.status} />
                  </div>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs font-medium text-muted-foreground">Locations</p>
                  <p className="mt-1 text-lg font-semibold tabular-nums">
                    {selected.locationCount}
                  </p>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs font-medium text-muted-foreground">Timezone</p>
                  <p className="mt-1 text-lg font-semibold">{selected.timezone}</p>
                </div>
              </div>
              <div className="space-y-2">
                <p className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-primary" /> {selected.contactEmail}
                </p>
                <p className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-primary" />{" "}
                  {selected.contactPhone ?? "Not provided"}
                </p>
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
        <PlatformLocationWizard
          open={addOpen}
          onOpenChange={(o) => {
            setAddOpen(o);
            if (!o) setWizardOrgId(undefined);
          }}
          onProvisioned={() => refetch()}
          initialOrganizationId={wizardOrgId}
        />
      </MPageShell>
    </MasterShell>
  );
}
