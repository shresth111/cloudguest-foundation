import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { toast } from "sonner";
import { Search, Plus, MapPin, CreditCard, Ban, CheckCircle, Mail, Phone, Eye } from "lucide-react";
import { MasterShell, useOperatorCaps } from "@/components/master/MasterShell";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { organizationService } from "@/services/organization.service";
import { locationService } from "@/services/location.service";
import { billingService } from "@/services/billing.service";
import { rbacService } from "@/services/rbac.service";
import { impersonationService } from "@/services/impersonation.service";
import { useAuth } from "@/context/AuthContext";
import { PlatformLocationWizard } from "@/components/locations/PlatformLocationWizard";
import { businessTypeIcon } from "@/lib/business-type-icons";
import type { AppError } from "@/services/api";
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
  const auth = useAuth();
  const caps = useOperatorCaps();
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
  // "View as this customer" (impersonation) confirm dialog -- kept
  // separate from `selected`/the drawer's own open state so closing the
  // drawer underneath it (e.g. after a successful start) doesn't need to
  // race this dialog's own close.
  const [impersonateOpen, setImpersonateOpen] = useState(false);
  const [impersonateReason, setImpersonateReason] = useState("");
  const [impersonateBusy, setImpersonateBusy] = useState(false);

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

  // There is no dedicated "primary contact user id" field on `Organization`
  // (or on `Location` -- only `ProvisionLocationResult`, a one-time
  // provisioning response, ever carries `ownerUserId`) for the impersonate
  // endpoint's own `POST /users/{user_id}/impersonate` shape to key off of.
  // What every org DOES already have is `contactEmail`, and the account
  // PlatformLocationWizard provisions as a new customer's owner is created
  // with that same address -- so the org's own user roster (GET /users,
  // scoped by X-Organization-Id, same call master.operators.tsx's sibling
  // page makes for the platform roster) is searched for a member whose
  // email matches it. This is a heuristic standing in for a real
  // "primary contact user id" the backend doesn't expose today, not a
  // guess invented for this feature alone.
  async function resolveImpersonationTarget(org: Enriched) {
    const { items } = await rbacService.listUsers(
      { page: 1, pageSize: 5, search: org.contactEmail },
      org.id,
    );
    return items.find((u) => u.email.toLowerCase() === org.contactEmail.toLowerCase()) ?? null;
  }

  async function handleConfirmImpersonate() {
    if (!selected) return;
    setImpersonateBusy(true);
    try {
      const targetUser = await resolveImpersonationTarget(selected);
      if (!targetUser) {
        toast.error(`Could not find ${selected.name}'s primary contact account.`);
        return;
      }
      const session = await impersonationService.impersonate(
        targetUser.id,
        impersonateReason.trim() || null,
      );
      await auth.beginImpersonation({
        accessToken: session.accessToken,
        expiresAt: session.expiresAt,
        targetUser: session.targetUser,
        organization: { id: selected.id, name: selected.name, slug: selected.slug },
      });
      setImpersonateOpen(false);
      setImpersonateReason("");
      setSelected(null);
      navigate({ to: "/", replace: true });
    } catch (err) {
      toast.error((err as AppError).message || "Could not start a session as this customer.");
    } finally {
      setImpersonateBusy(false);
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
                {/* Gated on the same `impersonate` capability key every
                    other capability-gated master-console action uses (see
                    MasterShell's CAP_PERMISSIONS / useOperatorCaps) -- today
                    that's `users.manage`, per that map's own doc comment.
                    A 403 from POST /users/{id}/impersonate is still the
                    real backstop; this only decides whether the button is
                    worth showing. */}
                {caps.has("impersonate") && (
                  <MButton variant="outline" onClick={() => setImpersonateOpen(true)}>
                    <Eye /> View as this customer
                  </MButton>
                )}
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

        {/* "View as this customer" confirmation -- separate from the
            drawer's own open state (see `impersonateOpen`'s declaration)
            so it can outlive the drawer closing underneath it once a
            session actually starts. */}
        <AlertDialog
          open={impersonateOpen}
          onOpenChange={(o) => {
            if (!o) {
              setImpersonateOpen(false);
              setImpersonateReason("");
            }
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>View dashboard as {selected?.name}?</AlertDialogTitle>
              <AlertDialogDescription>
                This starts a 30-minute logged session signed in as this customer's own account.
                Everything it does is recorded against your staff account, and a banner naming both
                identities stays on screen for as long as it's active. It ends automatically at 30
                minutes, or any time you choose to end it early.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="px-1 pb-1">
              <label
                htmlFor="impersonate-reason"
                className="mb-1.5 block text-xs font-medium text-muted-foreground"
              >
                Reason (optional)
              </label>
              <Textarea
                id="impersonate-reason"
                value={impersonateReason}
                onChange={(e) => setImpersonateReason(e.target.value)}
                placeholder="e.g. Investigating a support ticket about…"
                rows={2}
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={impersonateBusy}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                disabled={impersonateBusy}
                onClick={(e) => {
                  e.preventDefault();
                  handleConfirmImpersonate();
                }}
              >
                {impersonateBusy ? "Starting…" : "Continue"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </MPageShell>
    </MasterShell>
  );
}
