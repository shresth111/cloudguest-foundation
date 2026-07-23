import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Search, Plus, Trash2, Loader2 } from "lucide-react";
import { MasterShell } from "@/components/master/MasterShell";
import { MSectionHeader, MTag, MButton, MTable, MTh, MTd, MTr, MDialog, MField, M_INPUT } from "@/components/master/MasterKit";
import { locationService } from "@/services/location.service";
import { organizationService } from "@/services/organization.service";
import { PROPERTY_TYPE_LABEL, type Location, type PropertyType } from "@/types/location";

export const Route = createFileRoute("/master/locations")({
  component: LocationsScreen,
});

const PROPERTY_TYPES = Object.keys(PROPERTY_TYPE_LABEL) as PropertyType[];

function LocationsScreen() {
  const [q, setQ] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
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
    try {
      const [locs, orgList] = await Promise.all([
        locationService.listAll(),
        organizationService.list({ page: 1, pageSize: 200 }),
      ]);
      setLocations(locs);
      setOrgs(orgList.rows.map((o) => ({ id: o.id, name: o.name })));
    } catch {
      toast.error("Could not load locations from the server.");
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
          `${l.locationCode ?? ""} ${l.organizationName} ${l.city}`.toLowerCase().includes(q.toLowerCase()),
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
    if (!form.organizationId || !form.name || !form.city || !form.stateProvince || !form.postalCode || !form.addressLine1) {
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
        timezone: "Asia/Kolkata",
      });
      toast.success(`Location "${form.name}" created`);
      setAddOpen(false);
      setForm({ organizationId: "", name: "", propertyType: "hotel", city: "", stateProvince: "", postalCode: "", country: "IN", addressLine1: "" });
      refetch();
    } catch {
      toast.error("Could not create the location.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(l: Location) {
    if (!window.confirm(`Delete location "${l.name}"? This cannot be undone.`)) return;
    setDeletingId(l.id);
    try {
      await locationService.remove([l.id]);
      toast.success(`Location "${l.name}" deleted`);
      setLocations((prev) => prev.filter((x) => x.id !== l.id));
    } catch {
      toast.error("Could not delete the location.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <MasterShell title="All Locations">
      <MSectionHeader
        eyebrow="Directory"
        title="All Locations"
        actions={<MButton variant="primary" onClick={() => setAddOpen(true)}><Plus /> Create Location</MButton>}
      />

      <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search code, client, city…" className="w-full max-w-sm bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-card p-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading locations…
        </div>
      ) : (
        <MTable head={<><MTh>Site Code</MTh><MTh>Client</MTh><MTh>Type</MTh><MTh className="hidden sm:table-cell">City</MTh><MTh>Status</MTh><MTh /></>}>
          {rows.length === 0 ? (
            <MTr><MTd className="text-center text-muted-foreground" /><MTd /><MTd /><MTd className="hidden sm:table-cell" /><MTd /><MTd /></MTr>
          ) : (
            rows.map((l) => (
              <MTr key={l.id}>
                <MTd className="font-mono text-sm font-bold text-primary">{l.locationCode ?? "—"}</MTd>
                <MTd className="font-semibold">{l.organizationName}</MTd>
                <MTd className="text-sm">{l.propertyType ? PROPERTY_TYPE_LABEL[l.propertyType] : "—"}</MTd>
                <MTd className="hidden text-sm sm:table-cell">{l.city}</MTd>
                <MTd><MTag label={l.status} /></MTd>
                <MTd>
                  <button
                    aria-label={`Delete ${l.name}`}
                    disabled={deletingId === l.id}
                    onClick={() => handleDelete(l)}
                    className="inline-flex items-center justify-center rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                  >
                    {deletingId === l.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  </button>
                </MTd>
              </MTr>
            ))
          )}
        </MTable>
      )}
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
            <MButton variant="outline" onClick={() => setAddOpen(false)}>Cancel</MButton>
            <MButton variant="primary" onClick={handleCreate} disabled={saving}>
              {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating…</> : "Create"}
            </MButton>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <MField label="Tenant">
            <select className={M_INPUT} value={form.organizationId} onChange={(e) => setForm((f) => ({ ...f, organizationId: e.target.value }))}>
              <option value="">Select tenant…</option>
              {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </MField>
          <MField label="Type">
            <select className={M_INPUT} value={form.propertyType} onChange={(e) => setForm((f) => ({ ...f, propertyType: e.target.value as PropertyType }))}>
              {PROPERTY_TYPES.map((t) => <option key={t} value={t}>{PROPERTY_TYPE_LABEL[t]}</option>)}
            </select>
          </MField>
          <MField label="Location name"><input className={M_INPUT} placeholder="Marathahalli Branch" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></MField>
          <MField label="City"><input className={M_INPUT} placeholder="Bengaluru" value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} /></MField>
          <MField label="State"><input className={M_INPUT} placeholder="Karnataka" value={form.stateProvince} onChange={(e) => setForm((f) => ({ ...f, stateProvince: e.target.value }))} /></MField>
          <MField label="Postal code"><input className={M_INPUT} placeholder="560037" value={form.postalCode} onChange={(e) => setForm((f) => ({ ...f, postalCode: e.target.value }))} /></MField>
          <div className="sm:col-span-2"><MField label="Address"><input className={M_INPUT} placeholder="Street, area" value={form.addressLine1} onChange={(e) => setForm((f) => ({ ...f, addressLine1: e.target.value }))} /></MField></div>
        </div>
      </MDialog>
    </MasterShell>
  );
}
