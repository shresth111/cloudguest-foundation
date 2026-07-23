import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Search, Plus } from "lucide-react";
import { MasterShell } from "@/components/master/MasterShell";
import { MSectionHeader, MTag, MButton, MTable, MTh, MTd, MTr, MDialog, MField, M_INPUT } from "@/components/master/MasterKit";
import { CUSTOMERS, LOCATIONS, seriesCode, type Customer } from "@/lib/masterData";

export const Route = createFileRoute("/master/locations")({
  component: LocationsScreen,
});

function LocationsScreen() {
  const [q, setQ] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [type, setType] = useState<Customer["type"]>("Hotel");

  const rows = useMemo(
    () => LOCATIONS.filter((l) => !q || `${l.code} ${l.client} ${l.region}`.toLowerCase().includes(q.toLowerCase())),
    [q],
  );
  const nextCode = seriesCode(type, LOCATIONS.filter((l) => l.type === type).length + 1);

  return (
    <MasterShell title="All Locations">
      <MSectionHeader
        eyebrow="Directory"
        title="All Locations"
        actions={<MButton variant="primary" onClick={() => setAddOpen(true)}><Plus /> Create Location</MButton>}
      />

      <div className="flex items-center gap-2 border-2 border-border bg-card px-3 py-1.5">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search code, client, region…" className="w-full max-w-sm bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
      </div>

      <MTable head={<><MTh>Site Code</MTh><MTh>Client</MTh><MTh>Type</MTh><MTh className="hidden sm:table-cell">Region</MTh><MTh>Online</MTh><MTh>Status</MTh></>}>
        {rows.map((l) => (
          <MTr key={l.id}>
            <MTd className="font-mono text-sm font-bold text-primary">{l.code}</MTd>
            <MTd className="font-semibold">{l.client}</MTd>
            <MTd className="text-sm">{l.type}</MTd>
            <MTd className="hidden text-sm sm:table-cell">{l.region}</MTd>
            <MTd className="tabular-nums">{l.online}</MTd>
            <MTd><MTag label={l.status} /></MTd>
          </MTr>
        ))}
      </MTable>

      <MDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Create Location"
        wide
        footer={<><MButton variant="outline" onClick={() => setAddOpen(false)}>Cancel</MButton><MButton variant="primary" onClick={() => { toast.success(`Location ${nextCode} created`); setAddOpen(false); }}>Create</MButton></>}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <MField label="Tenant"><select className={M_INPUT}>{CUSTOMERS.map((c) => <option key={c.id}>{c.name}</option>)}</select></MField>
          <MField label="Type">
            <select className={M_INPUT} value={type} onChange={(e) => setType(e.target.value as Customer["type"])}>
              {["Hotel", "Cafe", "Mall", "Hospital", "Co-working", "Retail"].map((t) => <option key={t}>{t}</option>)}
            </select>
          </MField>
          <MField label="Location name"><input className={M_INPUT} placeholder="Marathahalli Branch" /></MField>
          <MField label="Region"><select className={M_INPUT}>{["South", "West", "North", "East"].map((r) => <option key={r}>{r}</option>)}</select></MField>
          <div className="sm:col-span-2"><MField label="Address"><input className={M_INPUT} placeholder="Street, city" /></MField></div>
          <MField label="Auto site code"><input className={`${M_INPUT} font-mono font-bold text-primary`} value={nextCode} readOnly /></MField>
        </div>
      </MDialog>
    </MasterShell>
  );
}
