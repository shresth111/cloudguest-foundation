import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  Search,
  Plus,
  Trash2,
  Loader2,
  Power,
  PowerOff,
  RotateCw,
  Copy,
  Server,
  Gauge,
  Ban,
  ShieldCheck,
} from "lucide-react";
import { MasterShell } from "@/components/master/MasterShell";
import {
  MSectionHeader,
  MStat,
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
import { nasService } from "@/services/nas.service";
import { routerService } from "@/services/router.service";
import { NAS_STATUS_LABEL, type NasClient, type NasClientSecretReveal } from "@/types/nas";
import type { RouterDevice } from "@/types/router";
import type { AppError } from "@/services/api";

export const Route = createFileRoute("/master/nas")({
  component: NasScreen,
});

function canActivate(status: NasClient["status"]) {
  return status === "pending" || status === "disabled" || status === "suspended";
}
function canDisable(status: NasClient["status"]) {
  return status === "pending" || status === "active";
}

function NasScreen() {
  const [q, setQ] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [nasClients, setNasClients] = useState<NasClient[]>([]);
  const [routers, setRouters] = useState<RouterDevice[]>([]);
  const [reveal, setReveal] = useState<NasClientSecretReveal | null>(null);

  const [form, setForm] = useState({
    routerId: "",
    nasIdentifier: "",
    sharedSecret: "",
    name: "",
    description: "",
    ipAddress: "",
  });

  async function refetch() {
    setLoading(true);
    try {
      const [nas, routerList] = await Promise.all([
        nasService.listAll(),
        routerService.list({ page: 1, pageSize: 200 }),
      ]);
      setNasClients(nas);
      setRouters(routerList.rows);
    } catch {
      toast.error("Could not load NAS clients from the server.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refetch();
  }, []);

  const registeredRouterIds = useMemo(() => new Set(nasClients.map((n) => n.routerId)), [nasClients]);
  const availableRouters = useMemo(
    () => routers.filter((r) => !registeredRouterIds.has(r.id)),
    [routers, registeredRouterIds],
  );

  const rows = useMemo(
    () =>
      nasClients.filter(
        (n) =>
          !q ||
          `${n.nasCode ?? ""} ${n.nasIdentifier} ${n.organizationName} ${n.locationName} ${n.vendor}`
            .toLowerCase()
            .includes(q.toLowerCase()),
      ),
    [nasClients, q],
  );

  const stats = useMemo(() => {
    const active = nasClients.filter((n) => n.status === "active").length;
    const disabled = nasClients.filter((n) => n.status === "disabled" || n.status === "suspended").length;
    const pending = nasClients.filter((n) => n.status === "pending").length;
    return { total: nasClients.length, active, disabled, pending };
  }, [nasClients]);

  function errMsg(err: unknown, fallback: string) {
    return (err as AppError)?.message || fallback;
  }

  async function handleCreate() {
    const router = routers.find((r) => r.id === form.routerId);
    if (!router || !form.nasIdentifier) {
      toast.error("Please select a router and enter a NAS identifier.");
      return;
    }
    setSaving(true);
    try {
      const result = await nasService.create(router.locationId, {
        routerId: form.routerId,
        nasIdentifier: form.nasIdentifier,
        sharedSecret: form.sharedSecret || undefined,
        name: form.name || undefined,
        description: form.description || undefined,
        ipAddress: form.ipAddress || undefined,
      });
      toast.success(`NAS "${result.nasCode ?? result.nasIdentifier}" registered`);
      setForm({ routerId: "", nasIdentifier: "", sharedSecret: "", name: "", description: "", ipAddress: "" });
      setAddOpen(false);
      setReveal(result);
      refetch();
    } catch (err) {
      toast.error(errMsg(err, "Could not register the NAS client."));
    } finally {
      setSaving(false);
    }
  }

  async function handleActivate(n: NasClient) {
    setBusyId(n.id);
    try {
      await nasService.activate(n.id);
      toast.success(`${n.nasCode ?? n.nasIdentifier} activated`);
      refetch();
    } catch (err) {
      toast.error(errMsg(err, "Could not activate this NAS client."));
    } finally {
      setBusyId(null);
    }
  }

  async function handleDisable(n: NasClient) {
    if (!window.confirm(`Disable "${n.nasCode ?? n.nasIdentifier}"? Guests will stop authenticating through it.`))
      return;
    setBusyId(n.id);
    try {
      await nasService.disable(n.id);
      toast.success(`${n.nasCode ?? n.nasIdentifier} disabled`);
      refetch();
    } catch (err) {
      toast.error(errMsg(err, "Could not disable this NAS client."));
    } finally {
      setBusyId(null);
    }
  }

  async function handleRegenerate(n: NasClient) {
    if (
      !window.confirm(
        `Regenerate the shared secret for "${n.nasCode ?? n.nasIdentifier}"? The router's RADIUS config must be updated immediately -- the old secret stops working right away.`,
      )
    )
      return;
    setBusyId(n.id);
    try {
      const result = await nasService.regenerateSecret(n.id);
      toast.success("Secret regenerated");
      setReveal(result);
    } catch (err) {
      toast.error(errMsg(err, "Could not regenerate the shared secret."));
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(n: NasClient) {
    if (!window.confirm(`Delete NAS "${n.nasCode ?? n.nasIdentifier}"? This cannot be undone.`)) return;
    setBusyId(n.id);
    try {
      await nasService.remove(n.id);
      toast.success(`NAS "${n.nasCode ?? n.nasIdentifier}" deleted`);
      setNasClients((prev) => prev.filter((x) => x.id !== n.id));
    } catch (err) {
      toast.error(errMsg(err, "Could not delete this NAS client."));
    } finally {
      setBusyId(null);
    }
  }

  function copy(text: string, what: string) {
    navigator.clipboard?.writeText(text).then(() => toast.success(`${what} copied`), () => toast.error("Copy failed"));
  }

  return (
    <MasterShell title="NAS / RADIUS">
      <MSectionHeader
        eyebrow="Infrastructure"
        title="NAS / RADIUS"
        actions={<MButton variant="primary" onClick={() => setAddOpen(true)}><Plus /> Register NAS</MButton>}
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MStat label="NAS clients" value={String(stats.total)} icon={Server} />
        <MStat label="Active" value={String(stats.active)} icon={Gauge} />
        <MStat label="Disabled / suspended" value={String(stats.disabled)} icon={Ban} />
        <MStat label="Pending" value={String(stats.pending)} icon={ShieldCheck} />
      </div>

      <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search NAS code, identifier, client, location…"
          className="w-full max-w-sm bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-card p-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading NAS clients…
        </div>
      ) : (
        <MTable
          head={
            <>
              <MTh>NAS</MTh>
              <MTh>Client</MTh>
              <MTh className="hidden md:table-cell">Identifier</MTh>
              <MTh className="hidden lg:table-cell">Vendor / IP</MTh>
              <MTh>Secret</MTh>
              <MTh>Status</MTh>
              <MTh />
            </>
          }
        >
          {rows.length === 0 ? (
            <MTr>
              <MTd className="text-center text-muted-foreground" />
              <MTd />
              <MTd className="hidden md:table-cell" />
              <MTd className="hidden lg:table-cell" />
              <MTd />
              <MTd />
              <MTd />
            </MTr>
          ) : (
            rows.map((n) => (
              <MTr key={n.id}>
                <MTd className="font-mono text-sm font-bold text-primary">{n.nasCode ?? "—"}</MTd>
                <MTd>
                  <div className="font-semibold">{n.organizationName || "—"}</div>
                  <div className="text-xs text-muted-foreground">{n.locationName || "—"}</div>
                </MTd>
                <MTd className="hidden font-mono text-xs md:table-cell">{n.nasIdentifier}</MTd>
                <MTd className="hidden text-sm lg:table-cell">
                  <div>{n.vendor}</div>
                  <div className="font-mono text-xs text-muted-foreground">{n.ipAddress ?? "—"}</div>
                </MTd>
                <MTd>
                  <button
                    disabled={busyId === n.id}
                    onClick={() => handleRegenerate(n)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2 py-1 text-xs text-muted-foreground hover:border-primary hover:text-primary disabled:opacity-50"
                    title="Shared secrets are never re-shown -- regenerate to issue a new one"
                  >
                    {busyId === n.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCw className="h-3.5 w-3.5" />}
                    •••••••• Regenerate
                  </button>
                </MTd>
                <MTd><MTag label={NAS_STATUS_LABEL[n.status]} tone={n.status} /></MTd>
                <MTd>
                  <div className="flex items-center justify-end gap-1">
                    {canActivate(n.status) && (
                      <button
                        aria-label={`Activate ${n.nasCode ?? n.nasIdentifier}`}
                        disabled={busyId === n.id}
                        onClick={() => handleActivate(n)}
                        className="inline-flex items-center justify-center rounded-lg p-1.5 text-muted-foreground hover:bg-emerald-500/10 hover:text-emerald-600 disabled:opacity-50"
                        title="Activate"
                      >
                        <Power className="h-4 w-4" />
                      </button>
                    )}
                    {canDisable(n.status) && (
                      <button
                        aria-label={`Disable ${n.nasCode ?? n.nasIdentifier}`}
                        disabled={busyId === n.id}
                        onClick={() => handleDisable(n)}
                        className="inline-flex items-center justify-center rounded-lg p-1.5 text-muted-foreground hover:bg-amber-500/10 hover:text-amber-600 disabled:opacity-50"
                        title="Disable"
                      >
                        <PowerOff className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      aria-label={`Delete ${n.nasCode ?? n.nasIdentifier}`}
                      disabled={busyId === n.id}
                      onClick={() => handleDelete(n)}
                      className="inline-flex items-center justify-center rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </MTd>
              </MTr>
            ))
          )}
        </MTable>
      )}
      {!loading && rows.length === 0 && (
        <p className="text-center text-sm text-muted-foreground">No NAS clients registered yet.</p>
      )}

      {/* Register NAS */}
      <MDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Register NAS"
        wide
        footer={
          <>
            <MButton variant="outline" onClick={() => setAddOpen(false)}>Cancel</MButton>
            <MButton variant="primary" onClick={handleCreate} disabled={saving}>
              {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Registering…</> : "Register"}
            </MButton>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <MField label="Router">
              <select className={M_INPUT} value={form.routerId} onChange={(e) => setForm((f) => ({ ...f, routerId: e.target.value }))}>
                <option value="">{availableRouters.length === 0 ? "No routers without a NAS" : "Select router…"}</option>
                {availableRouters.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} — {r.organizationName} / {r.locationName}
                  </option>
                ))}
              </select>
            </MField>
          </div>
          <MField label="NAS identifier"><input className={M_INPUT} placeholder="cg-lobby-01" value={form.nasIdentifier} onChange={(e) => setForm((f) => ({ ...f, nasIdentifier: e.target.value }))} /></MField>
          <MField label="Shared secret (optional — auto-generated)"><input type="password" className={M_INPUT} value={form.sharedSecret} onChange={(e) => setForm((f) => ({ ...f, sharedSecret: e.target.value }))} /></MField>
          <MField label="Name (optional)"><input className={M_INPUT} placeholder="Lobby NAS" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></MField>
          <MField label="IP address (optional)"><input className={M_INPUT} placeholder="Defaults to router IP" value={form.ipAddress} onChange={(e) => setForm((f) => ({ ...f, ipAddress: e.target.value }))} /></MField>
          <div className="sm:col-span-2"><MField label="Description (optional)"><input className={M_INPUT} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} /></MField></div>
        </div>
      </MDialog>

      {/* One-time secret reveal -- the backend never returns a shared secret again after this moment */}
      <MDialog open={!!reveal} onClose={() => setReveal(null)} title="Shared secret — shown once">
        {reveal && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Configure the router's RADIUS client with this secret now. It will not be shown again — only regenerated.
            </p>
            <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              NAS code
              <div className="font-mono text-sm text-foreground">{reveal.nasCode ?? "—"}</div>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
              <code className="break-all text-sm">{reveal.sharedSecret}</code>
              <button onClick={() => copy(reveal.sharedSecret, "Shared secret")} className="shrink-0 text-muted-foreground hover:text-primary">
                <Copy className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </MDialog>
    </MasterShell>
  );
}
