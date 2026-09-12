import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { toast } from "sonner";
import { Search, Plus, Trash2, Loader2, ExternalLink } from "lucide-react";
import { MasterShell } from "@/components/master/MasterShell";
import {
  MPageShell,
  MSectionHeader,
  MTag,
  MButton,
  MTable,
  MTh,
  MTd,
  MTr,
  MDialog,
  MField,
  M_INPUT,
} from "@/components/master/MasterKit";
import { locationService } from "@/services/location.service";
import { defaultTimezoneForCountry } from "@/lib/countries";
import { organizationService } from "@/services/organization.service";
import { requestErrorMessage } from "@/services/api";
import { isDemo } from "@/services/customer.service";
import { PROPERTY_TYPE_LABEL, type Location, type PropertyType } from "@/types/location";
import { businessTypeIcon } from "@/lib/business-type-icons";

// The Master Console's demo sign-in (see master-login.tsx, "admin@example.com
// / test") issues a local-only `demo-access-token` that the real backend
// never recognizes -- every real API call made with it 401s. This page (like
// the rest of the Master Console) has no other data source, so demo sessions
// need this small local fallback instead of unconditionally hitting the real
// API and surfacing a scary "could not load" toast for what is actually
// expected, by-design behavior of a fake session.
const DEMO_ORGS: { id: string; name: string }[] = [
  { id: "org-001", name: "Acme Corp" },
  { id: "org-002", name: "Blue Cedar Cafes" },
];

const DEMO_LOCATIONS: Location[] = [
  {
    id: "loc-demo-001",
    name: "Downtown Branch",
    slug: "downtown-branch",
    organizationId: "org-001",
    organizationName: "Acme Corp",
    status: "active",
    propertyType: "hotel",
    locationCode: "LOC-DEMO-001",
    addressLine1: "123 Main St",
    addressLine2: null,
    city: "Austin",
    stateProvince: "TX",
    postalCode: "78701",
    country: "US",
    timezone: "America/Chicago",
    latitude: null,
    longitude: null,
    contactName: null,
    contactPhone: null,
    contactEmail: null,
    settings: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "loc-demo-002",
    name: "Airport Kiosk",
    slug: "airport-kiosk",
    organizationId: "org-002",
    organizationName: "Blue Cedar Cafes",
    status: "active",
    propertyType: "cafe",
    locationCode: "LOC-DEMO-002",
    addressLine1: "1 Airport Way",
    addressLine2: null,
    city: "Austin",
    stateProvince: "TX",
    postalCode: "78719",
    country: "US",
    timezone: "UTC",
    latitude: null,
    longitude: null,
    contactName: null,
    contactPhone: null,
    contactEmail: null,
    settings: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export const Route = createFileRoute("/master/locations")({
  // This page has no per-row detail drawer at all (unlike Customers/Router
  // Fleet) -- its own free-text `q` box is already the whole "detail" story
  // (see `rows` below), so MasterSearch (the header's real platform search)
  // just hands its own query straight into the same filter box a result
  // came from, instead of inventing a drawer this page has never had.
  validateSearch: z.object({ q: z.string().optional() }),
  component: LocationsScreen,
});

const PROPERTY_TYPES = Object.keys(PROPERTY_TYPE_LABEL) as PropertyType[];

function LocationsScreen() {
  const { q: initialQ } = Route.useSearch();
  const [q, setQ] = useState(initialQ ?? "");
  const [addOpen, setAddOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Location | null>(null);
  /** What the operator has typed into the confirmation field. Compared
   * case-insensitively and trimmed -- the point is to make them read the name
   * and find it on the row, not to test their typing. */
  const [deleteTyped, setDeleteTyped] = useState("");
  /** Trimmed and case-insensitive: the point is to make the operator read the
   * name and match it against the row, not to test their typing. */
  const deleteConfirmed =
    !!confirmDelete && deleteTyped.trim().toLowerCase() === confirmDelete.name.trim().toLowerCase();
  const [locations, setLocations] = useState<Location[]>([]);
  const [orgs, setOrgs] = useState<{ id: string; name: string }[]>([]);

  const [form, setForm] = useState({
    organizationId: "",
    name: "",
    propertyType: "hotel" as PropertyType,
    city: "",
    stateProvince: "",
    postalCode: "",
    country: "IN",
    addressLine1: "",
  });

  async function refetch() {
    setLoading(true);
    // Demo sessions (master-login.tsx's "admin@example.com / test" shortcut)
    // hold a token the real backend never accepts -- every call below would
    // 401. Serve the local demo dataset instead of a doomed network round
    // trip (same pattern the customer portal already uses, see
    // src/services/customer.service.ts's `isDemo()`/`DEMO_LOCATIONS`).
    if (isDemo()) {
      setLocations(DEMO_LOCATIONS);
      setOrgs(DEMO_ORGS);
      setLoading(false);
      return;
    }
    try {
      const [locs, orgList] = await Promise.all([
        locationService.listAll(),
        organizationService.list({ page: 1, pageSize: 100 }),
      ]);
      setLocations(locs);
      setOrgs(orgList.rows.map((o) => ({ id: o.id, name: o.name })));
    } catch (err) {
      const message = requestErrorMessage(err, "Could not load locations from the server.");
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refetch();
  }, []);

  const rows = useMemo(
    () =>
      locations.filter(
        (l) =>
          !q ||
          `${l.locationCode ?? ""} ${l.organizationName} ${l.city}`
            .toLowerCase()
            .includes(q.toLowerCase()),
      ),
    [locations, q],
  );

  function slugify(name: string) {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  }

  async function handleCreate() {
    if (
      !form.organizationId ||
      !form.name ||
      !form.city ||
      !form.stateProvince ||
      !form.postalCode ||
      !form.addressLine1
    ) {
      toast.error("Please fill in tenant, name, address, city, state and postal code.");
      return;
    }
    setSaving(true);
    try {
      await locationService.create({
        organizationId: form.organizationId,
        name: form.name,
        slug: slugify(form.name),
        propertyType: form.propertyType,
        addressLine1: form.addressLine1,
        city: form.city,
        stateProvince: form.stateProvince,
        postalCode: form.postalCode,
        country: form.country,
        // Derived from the country rather than hardcoded. This read
        // `"Asia/Kolkata"` unconditionally, so a venue created here with
        // country `US` or `GB` was stamped with IST -- and timezone is the
        // frame every timestamp that venue produces is read in (session start
        // and end, report boundaries, business hours, voucher windows,
        // campaign sends). Nothing downstream errors on a wrong one; the
        // numbers just come out plausible and wrong. Falls back to IST only
        // when the country is one `countries.ts` does not know, which
        // preserves today's behaviour for exactly that case rather than
        // silently moving existing venues to UTC.
        timezone: defaultTimezoneForCountry(form.country) ?? "Asia/Kolkata",
      });
      toast.success(`Location "${form.name}" created`);
      setAddOpen(false);
      setForm({
        organizationId: "",
        name: "",
        propertyType: "hotel",
        city: "",
        stateProvince: "",
        postalCode: "",
        country: "IN",
        addressLine1: "",
      });
      refetch();
    } catch {
      toast.error("Could not create the location.");
    } finally {
      setSaving(false);
    }
  }

  /**
   * THERE WAS ALREADY A GUARD, AND IT WAS THE WRONG KIND.
   *
   * This read `window.confirm("Delete location ...? This cannot be undone.")`
   * -- which is why a QA pass reported the delete as unguarded and was not
   * wrong to: a native dialog is auto-dismissed by Playwright unless the run
   * handles `dialog` explicitly, and a browser that has been told to "prevent
   * this page from creating additional dialogs" suppresses it outright. A
   * guard that a driver silently dismisses and a browser can switch off is not
   * a guard on the one irreversible action on this page.
   *
   * It also could not say what it needed to say. A location is not a row: it
   * is a venue with guest sessions, vouchers, portal configuration, routers
   * and possibly a network integration hanging off it, and `window.confirm`
   * takes one line of unstyled text. Replaced -- not added on top of -- with a
   * real dialog that names the venue, names what goes with it, and asks the
   * operator to type the name.
   *
   * Typing the name is deliberate. This list shows several venues per tenant
   * in the same city ("sector 37 d" and "huda city center" are two live rows),
   * the delete buttons are identical and adjacent, and until this change the
   * table did not render the name at all. The failure mode is not "meant to
   * cancel and confirmed"; it is "deleted the right-looking wrong row". Typing
   * the name is the only confirmation that catches that one.
   */
  async function handleDelete(l: Location) {
    setDeletingId(l.id);
    try {
      await locationService.remove([l.id], l.organizationId);
      toast.success(`Location "${l.name}" deleted`);
      setLocations((prev) => prev.filter((x) => x.id !== l.id));
      setConfirmDelete(null);
      setDeleteTyped("");
    } catch {
      toast.error("Could not delete the location.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <MasterShell title="All Locations">
      <MPageShell>
        <MSectionHeader
          eyebrow="Directory"
          title="All Locations"
          actions={
            <MButton variant="primary" onClick={() => setAddOpen(true)}>
              <Plus /> Create Location
            </MButton>
          }
        />

        <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search code, client, city…"
            className="w-full max-w-sm bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>

        <MTable
          loading={loading}
          head={
            <>
              <MTh>Site Code</MTh>
              {/* The venue's own NAME, which this table did not show at all.
                  A row was identifiable only by its site code or by the
                  accessible name on its delete button -- which is genuinely
                  how a QA pass had to find a location it had just created.
                  Client + City does not disambiguate either: two live rows are
                  "sector 37 d" and "huda city center", different tenants, same
                  city. The name is what an operator was told on the phone. */}
              <MTh>Name</MTh>
              <MTh>Client</MTh>
              <MTh>Type</MTh>
              <MTh className="hidden sm:table-cell">City</MTh>
              <MTh>Status</MTh>
              <MTh />
            </>
          }
        >
          {!loading &&
            (rows.length === 0 ? (
              <MTr>
                <MTd className="text-center text-muted-foreground" />
                <MTd />
                <MTd />
                <MTd />
                <MTd className="hidden sm:table-cell" />
                <MTd />
                <MTd />
              </MTr>
            ) : (
              rows.map((l) => {
                const TypeIcon = businessTypeIcon(l.propertyType);
                return (
                  <MTr key={l.id}>
                    <MTd className="font-mono text-sm font-bold text-primary">
                      {l.locationCode ?? "—"}
                    </MTd>
                    <MTd className="font-semibold">{l.name}</MTd>
                    <MTd className="text-sm text-muted-foreground">{l.organizationName}</MTd>
                    <MTd className="text-sm">
                      <span className="inline-flex items-center gap-1.5">
                        <TypeIcon className="h-3.5 w-3.5 text-muted-foreground" />
                        {l.propertyType ? PROPERTY_TYPE_LABEL[l.propertyType] : "—"}
                      </span>
                    </MTd>
                    <MTd className="hidden text-sm sm:table-cell">{l.city}</MTd>
                    <MTd>
                      <MTag label={l.status} />
                    </MTd>
                    <MTd>
                      <div className="flex items-center justify-end gap-1">
                        {!isDemo() && (
                          <Link
                            to="/preview/portal/$locationId"
                            params={{ locationId: l.id }}
                            search={{ organizationId: l.organizationId }}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`Preview ${l.name}'s guest portal`}
                            title="Preview guest portal"
                            className="inline-flex items-center justify-center rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Link>
                        )}
                        <button
                          aria-label={`Delete ${l.name}`}
                          disabled={deletingId === l.id}
                          onClick={() => {
                            setDeleteTyped("");
                            setConfirmDelete(l);
                          }}
                          className="inline-flex items-center justify-center rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                        >
                          {deletingId === l.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </MTd>
                  </MTr>
                );
              })
            ))}
        </MTable>
        {!loading && rows.length === 0 && (
          <p className="text-center text-sm text-muted-foreground">No locations yet.</p>
        )}

        <MDialog
          open={addOpen}
          onClose={() => setAddOpen(false)}
          title="Create Location"
          wide
          footer={
            <>
              <MButton variant="outline" onClick={() => setAddOpen(false)}>
                Cancel
              </MButton>
              <MButton variant="primary" onClick={handleCreate} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Creating…
                  </>
                ) : (
                  "Create"
                )}
              </MButton>
            </>
          }
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <MField label="Tenant">
              <select
                className={M_INPUT}
                value={form.organizationId}
                onChange={(e) => setForm((f) => ({ ...f, organizationId: e.target.value }))}
              >
                <option value="">Select tenant…</option>
                {orgs.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </MField>
            <MField label="Type">
              <select
                className={M_INPUT}
                value={form.propertyType}
                onChange={(e) =>
                  setForm((f) => ({ ...f, propertyType: e.target.value as PropertyType }))
                }
              >
                {PROPERTY_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {PROPERTY_TYPE_LABEL[t]}
                  </option>
                ))}
              </select>
            </MField>
            <MField label="Location name">
              <input
                className={M_INPUT}
                placeholder="Marathahalli Branch"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </MField>
            <MField label="City">
              <input
                className={M_INPUT}
                placeholder="Bengaluru"
                value={form.city}
                onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
              />
            </MField>
            <MField label="State">
              <input
                className={M_INPUT}
                placeholder="Karnataka"
                value={form.stateProvince}
                onChange={(e) => setForm((f) => ({ ...f, stateProvince: e.target.value }))}
              />
            </MField>
            <MField label="Postal code">
              <input
                className={M_INPUT}
                placeholder="560037"
                value={form.postalCode}
                onChange={(e) => setForm((f) => ({ ...f, postalCode: e.target.value }))}
              />
            </MField>
            <div className="sm:col-span-2">
              <MField label="Address">
                <input
                  className={M_INPUT}
                  placeholder="Street, area"
                  value={form.addressLine1}
                  onChange={(e) => setForm((f) => ({ ...f, addressLine1: e.target.value }))}
                />
              </MField>
            </div>
          </div>
        </MDialog>

        {/* The delete confirmation. Names the venue, names what goes with it,
            and requires the name to be typed -- see `handleDelete`. */}
        <MDialog
          open={!!confirmDelete}
          onClose={() => {
            setConfirmDelete(null);
            setDeleteTyped("");
          }}
          title="Delete this location?"
        >
          {confirmDelete && (
            <div className="space-y-4 p-5">
              <p className="text-sm">
                <span className="font-semibold">{confirmDelete.name}</span>
                {confirmDelete.locationCode ? (
                  <span className="ml-1.5 font-mono text-xs text-muted-foreground">
                    {confirmDelete.locationCode}
                  </span>
                ) : null}
                <span className="block text-sm text-muted-foreground">
                  {confirmDelete.city ? `${confirmDelete.city} · ` : ""}
                  {confirmDelete.organizationName}
                </span>
              </p>

              {/* Categories, not counts. A count would have to be fetched per
                  entity and this dialog has not fetched anything -- naming
                  "3 routers" without having looked would be the kind of
                  confident, unverified number this console keeps being fixed
                  for. What IS certain is which kinds of record hang off a
                  location, and that is what the operator needs to weigh. */}
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3">
                <p className="text-sm font-medium text-destructive">
                  This cannot be undone, and it is not only this row.
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  A venue carries its guest sessions and their history, its vouchers, its sign-in
                  portal configuration, any routers or controllers registered to it and any network
                  integration connected to it. Guests at this venue stop being able to sign in.
                </p>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="confirm-delete-name"
                  className="block text-xs font-medium text-muted-foreground"
                >
                  Type <span className="font-semibold text-foreground">{confirmDelete.name}</span>{" "}
                  to confirm
                </label>
                <input
                  id="confirm-delete-name"
                  className={M_INPUT}
                  autoComplete="off"
                  value={deleteTyped}
                  onChange={(e) => setDeleteTyped(e.target.value)}
                />
              </div>

              <div className="flex flex-wrap justify-end gap-2">
                <MButton
                  variant="outline"
                  onClick={() => {
                    setConfirmDelete(null);
                    setDeleteTyped("");
                  }}
                >
                  Cancel
                </MButton>
                <MButton
                  variant="primary"
                  className="bg-destructive text-destructive-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={!deleteConfirmed || deletingId === confirmDelete.id}
                  aria-disabled={!deleteConfirmed || deletingId === confirmDelete.id}
                  title={deleteConfirmed ? undefined : "Type the location's name to confirm."}
                  onClick={() => handleDelete(confirmDelete)}
                >
                  {deletingId === confirmDelete.id && <Loader2 className="animate-spin" />}
                  Delete this location
                </MButton>
              </div>
            </div>
          )}
        </MDialog>
      </MPageShell>
    </MasterShell>
  );
}
