import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Search, Plus, MapPin, UserCog, CreditCard, Ban, Mail, Phone } from "lucide-react";
import { MasterShell } from "@/components/master/MasterShell";
import {
  MSectionHeader, MSeg, MTag, MButton, MTable, MTh, MTd, MTr, MDrawer, MDialog, MField, M_INPUT,
} from "@/components/master/MasterKit";
import { CUSTOMERS, MODULES, type Customer } from "@/lib/masterData";

export const Route = createFileRoute("/master/customers")({
  component: CustomersScreen,
});

type Filter = "all" | "active" | "trial" | "suspended";

function CustomersScreen() {
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Customer | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [mods, setMods] = useState<string[]>(["Dashboard", "Users", "Analytics"]);

  const rows = useMemo(
    () =>
      CUSTOMERS.filter((c) => (filter === "all" ? true : c.status === filter)).filter(
        (c) => !q || c.name.toLowerCase().includes(q.toLowerCase()) || c.email.toLowerCase().includes(q.toLowerCase()),
      ),
    [filter, q],
  );

  const toggleMod = (m: string) => setMods((x) => (x.includes(m) ? x.filter((y) => y !== m) : [...x, m]));

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

      <MTable head={<><MTh>Customer</MTh><MTh className="hidden md:table-cell">Contact</MTh><MTh>Plan</MTh><MTh className="hidden sm:table-cell">Loc.</MTh><MTh>Online</MTh><MTh>MRR</MTh><MTh>Status</MTh></>}>
        {rows.map((c) => (
          <MTr key={c.id} onClick={() => setSelected(c)}>
            <MTd>
              <p className="font-semibold">{c.name}</p>
              <p className="text-xs text-muted-foreground">{c.type} · {c.region}</p>
            </MTd>
            <MTd className="hidden md:table-cell">
              <p className="text-xs text-muted-foreground">{c.email}</p>
              <p className="text-xs text-muted-foreground">{c.phone}</p>
            </MTd>
            <MTd className="text-sm">{c.plan}</MTd>
            <MTd className="hidden tabular-nums sm:table-cell">{c.locations}</MTd>
            <MTd className="tabular-nums">{c.online}</MTd>
            <MTd className="font-semibold tabular-nums">${c.mrr}</MTd>
            <MTd><MTag label={c.status} /></MTd>
          </MTr>
        ))}
        {rows.length === 0 && (
          <MTr><MTd className="py-10 text-center text-muted-foreground"><span className="block">No customers match your filter.</span></MTd></MTr>
        )}
      </MTable>

      {/* Detail drawer */}
      <MDrawer
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.name ?? ""}
        subtitle={selected ? `${selected.type} · ${selected.region} · since ${selected.since}` : ""}
        footer={
          selected && (
            <div className="grid grid-cols-2 gap-2">
              <MButton variant="outline" onClick={() => toast.success(`New location for ${selected.name}`)}><MapPin /> New Location</MButton>
              <MButton variant="outline" onClick={() => toast.success(`Impersonating ${selected.name}`)}><UserCog /> Impersonate</MButton>
              <MButton variant="outline" onClick={() => toast.success("Opening plan editor")}><CreditCard /> Edit Plan</MButton>
              <MButton variant="primary" onClick={() => { toast.success(`${selected.name} suspended`); setSelected(null); }}><Ban /> Suspend</MButton>
            </div>
          )
        }
      >
        {selected && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-border p-3"><p className="text-xs font-medium text-muted-foreground">Plan</p><p className="mt-1 text-lg font-semibold">{selected.plan}</p></div>
              <div className="rounded-lg border border-border p-3"><p className="text-xs font-medium text-muted-foreground">Status</p><div className="mt-1.5"><MTag label={selected.status} /></div></div>
              <div className="rounded-lg border border-border p-3"><p className="text-xs font-medium text-muted-foreground">Locations</p><p className="mt-1 text-lg font-semibold tabular-nums">{selected.locations}</p></div>
              <div className="rounded-lg border border-border p-3"><p className="text-xs font-medium text-muted-foreground">MRR</p><p className="mt-1 text-lg font-semibold tabular-nums">${selected.mrr}</p></div>
            </div>
            <div className="space-y-2">
              <p className="flex items-center gap-2 text-sm"><Mail className="h-4 w-4 text-primary" /> {selected.email}</p>
              <p className="flex items-center gap-2 text-sm"><Phone className="h-4 w-4 text-primary" /> {selected.phone}</p>
            </div>
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">Provisioned Modules</p>
              <div className="flex flex-wrap gap-1.5">
                {selected.modules.map((m) => <MTag key={m} label={m} tone="normal" />)}
              </div>
            </div>
          </div>
        )}
      </MDrawer>

      {/* Add customer dialog */}
      <MDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add Customer"
        wide
        footer={
          <>
            <MButton variant="outline" onClick={() => setAddOpen(false)}>Cancel</MButton>
            <MButton variant="primary" onClick={() => { toast.success("Customer created"); setAddOpen(false); }}>Create</MButton>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <MField label="Customer name"><input className={M_INPUT} placeholder="Acme Hospitality" /></MField>
          <MField label="Type">
            <select className={M_INPUT} defaultValue="Hotel">
              {["Hotel", "Cafe", "Mall", "Hospital", "Co-working", "Retail"].map((t) => <option key={t}>{t}</option>)}
            </select>
          </MField>
          <MField label="Contact email"><input className={M_INPUT} placeholder="ops@acme.com" /></MField>
          <MField label="Contact phone"><input className={M_INPUT} placeholder="+91 •••••" /></MField>
          <MField label="Region">
            <select className={M_INPUT} defaultValue="South">{["South", "West", "North", "East"].map((r) => <option key={r}>{r}</option>)}</select>
          </MField>
          <MField label="Plan">
            <select className={M_INPUT} defaultValue="Growth">{["Starter", "Growth", "Enterprise"].map((p) => <option key={p}>{p}</option>)}</select>
          </MField>
        </div>
        <div className="mt-4">
          <p className="mb-2 text-xs font-medium text-muted-foreground">Enabled Modules</p>
          <div className="flex flex-wrap gap-1.5">
            {MODULES.map((m) => (
              <button
                key={m}
                onClick={() => toggleMod(m)}
                className={
                  "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors " +
                  (mods.includes(m) ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:border-primary")
                }
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      </MDialog>
    </MasterShell>
  );
}
