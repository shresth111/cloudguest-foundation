/**
 * Batch B4 pages for the customer workspace (ADDENDUM_04): Security Score,
 * Block Websites, Firewall, Fix a Problem and Devices.
 *
 * Partner panels over the `/isp/venue/*` twins (`services/isp-partner/
 * venue-security.ts`). They mount inside the shell's `VenueScope`, so every
 * call carries this customer and this location. Nothing here is sample data:
 * an empty list is an empty list, and a success toast follows only a 2xx.
 *
 * The Wyfy firewall band is never shown or offered here (Master-only). When a
 * router has no band, flood limit and guest isolation say so (`band_state`),
 * because those features need it.
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Monitor, Plus, ShieldAlert, Trash2, Upload } from "lucide-react";
import {
  M_INPUT,
  MButton,
  MEmptyState,
  MStat,
  MTable,
  MTag,
  MTd,
  MTh,
  MTr,
} from "@/components/master/MasterKit";
import { Card, ErrorBlock, FormError, LoadingBlock, Spinner } from "@/components/isp-partner/kit";
import { usePartner } from "@/components/isp-partner/PartnerContext";
import { WithRouter } from "@/components/isp-partner/customer-shell/parts";
import { RouterSelect } from "@/components/isp-partner/workspace/RouterSelect";
import { Devices as RoutersAndCpes } from "@/components/isp-partner/customer-shell/builtins";
import type { PartnerSlotProps } from "@/components/isp-partner/customer-shell/slots";
import { ispErrorMessage } from "@/lib/isp-partner/errors";
import { formatDate } from "@/lib/isp-partner/format";
import {
  venueSecurityService as svc,
  type ContentFilterRuleCreate,
  type FirewallRuleCreate,
} from "@/services/isp-partner/venue-security";

const k = (...parts: (string | null | undefined)[]) => ["isp-venue-b4", ...parts];

function useInvalidate() {
  const qc = useQueryClient();
  return (...parts: string[]) => qc.invalidateQueries({ queryKey: k(...parts) });
}

// -- Security Score ------------------------------------------------------------

export function SecurityScorePage({ locationId }: PartnerSlotProps) {
  const q = useQuery({ queryKey: k("overview", locationId), queryFn: svc.overview });
  const caps = useQuery({
    queryKey: k("capabilities"),
    queryFn: svc.capabilities,
    staleTime: 30 * 60_000,
  });
  if (q.isLoading) return <LoadingBlock />;
  if (q.error || !q.data)
    return <ErrorBlock error={q.error} onRetry={() => q.refetch()} what="the security score" />;
  const { score, counters, fleet } = q.data;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MStat
          label="Security score"
          value={
            score.available && score.score !== null ? `${score.score} / ${score.max_score}` : "–"
          }
        />
        <MStat label="Band" value={score.band ?? "–"} />
        <MStat
          label="Routers reporting"
          value={`${fleet.routers_reporting} / ${fleet.routers_total}`}
        />
        <MStat label="Routers unhealthy" value={fleet.routers_unhealthy} />
      </div>
      {!score.available && (
        <p className="text-sm text-muted-foreground">
          {score.unavailable_reason ?? "No score yet for this venue."}
        </p>
      )}
      {score.factors.length > 0 && (
        <Card title="What moves the score">
          <MTable
            head={
              <>
                <MTh>Check</MTh>
                <MTh>Detail</MTh>
                <MTh className="text-right">Penalty</MTh>
              </>
            }
          >
            {score.factors.map((f) => (
              <MTr key={f.key}>
                <MTd className="font-medium">{f.label}</MTd>
                <MTd className="text-xs">{f.available ? f.detail : "Not measured here"}</MTd>
                <MTd className="text-right tabular-nums">
                  {f.available ? `${f.penalty} / ${f.max_penalty}` : "–"}
                </MTd>
              </MTr>
            ))}
          </MTable>
        </Card>
      )}
      <Card title="Activity">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {counters.map((c) => (
            <MStat
              key={c.key}
              label={c.label}
              value={c.available && c.count !== null ? c.count : "Not available"}
            />
          ))}
        </div>
      </Card>
      {caps.data && (
        <Card title="What this platform enforces">
          <ul className="space-y-1.5 text-sm">
            {caps.data.map((c) => (
              <li key={c.key} className="flex flex-wrap items-center gap-2">
                <MTag label={c.availability} />
                <span className="font-medium">{c.label}</span>
                {c.detail && <span className="text-xs text-muted-foreground">{c.detail}</span>}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

// -- Block Websites --------------------------------------------------------------

function ContentRules({ routerId }: { routerId: string }) {
  const { can } = usePartner();
  const invalidate = useInvalidate();
  const q = useQuery({
    queryKey: k("content", routerId),
    queryFn: () => svc.listContentRules(routerId),
  });
  const [form, setForm] = useState<{ value: string; type: "domain" | "ip_cidr" }>({
    value: "",
    type: "domain",
  });
  const [error, setError] = useState<string | null>(null);
  const create = useMutation({
    mutationFn: (body: ContentFilterRuleCreate) => svc.createContentRule(body),
    onSuccess: () => {
      toast.success("Rule saved. Push it to apply on the router.");
      setForm({ value: "", type: form.type });
      invalidate("content", routerId);
    },
    onError: (e) => setError(ispErrorMessage(e)),
  });
  const act = useMutation({
    mutationFn: async ({ id, op }: { id: string; op: "push" | "delete" }) =>
      op === "push" ? svc.pushContentRule(id) : svc.deleteContentRule(id),
    onSuccess: (_d, v) => {
      toast.success(v.op === "push" ? "Pushed to the router." : "Rule removed.");
      invalidate("content", routerId);
    },
    onError: (e) => toast.error(ispErrorMessage(e)),
  });

  return (
    <Card title="Blocked websites and addresses">
      {can("isp_security.create") && (
        <form
          className="mb-3 flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            const value = form.value.trim();
            if (!value) return;
            create.mutate({
              router_id: routerId,
              name: value,
              value,
              value_type: form.type,
              is_enabled: true,
            });
          }}
        >
          <select
            className={`${M_INPUT} w-auto`}
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value as "domain" | "ip_cidr" })}
            aria-label="Type"
          >
            <option value="domain">Website (domain)</option>
            <option value="ip_cidr">IP address or range</option>
          </select>
          <input
            className={`${M_INPUT} w-64`}
            placeholder={form.type === "domain" ? "example.com" : "203.0.113.0/24"}
            value={form.value}
            onChange={(e) => setForm({ ...form, value: e.target.value })}
            aria-label="Value"
          />
          <MButton type="submit" disabled={create.isPending}>
            {create.isPending ? <Spinner /> : <Plus />} Block
          </MButton>
        </form>
      )}
      <FormError message={error} />
      {q.error && !q.data ? (
        <ErrorBlock error={q.error} onRetry={() => q.refetch()} what="blocked websites" />
      ) : q.data && q.data.items.length === 0 ? (
        <MEmptyState icon={ShieldAlert} title="Nothing blocked on this router" />
      ) : (
        <MTable
          loading={q.isLoading}
          head={
            <>
              <MTh>Blocked</MTh>
              <MTh>Type</MTh>
              <MTh>On router</MTh>
              <MTh className="text-right">Actions</MTh>
            </>
          }
        >
          {q.data?.items.map((r) => (
            <MTr key={r.id}>
              <MTd className="font-medium">{r.value}</MTd>
              <MTd className="text-xs">{r.value_type === "domain" ? "Website" : "Address"}</MTd>
              <MTd>
                <MTag label={r.device_push_status} />
                {r.device_push_error && (
                  <p className="text-[11px] text-destructive">{r.device_push_error}</p>
                )}
              </MTd>
              <MTd className="text-right">
                {can("isp_security.execute") && (
                  <MButton
                    variant="ghost"
                    onClick={() => act.mutate({ id: r.id, op: "push" })}
                    aria-label="Push"
                  >
                    <Upload />
                  </MButton>
                )}
                {can("isp_security.delete") && (
                  <MButton
                    variant="ghost"
                    onClick={() => act.mutate({ id: r.id, op: "delete" })}
                    aria-label="Remove"
                  >
                    <Trash2 />
                  </MButton>
                )}
              </MTd>
            </MTr>
          ))}
        </MTable>
      )}
    </Card>
  );
}

function DnsCategories({ routerId, locationId }: { routerId: string; locationId: string }) {
  const { can } = usePartner();
  const invalidate = useInvalidate();
  const cats = useQuery({
    queryKey: k("dns-cats"),
    queryFn: svc.dnsCategories,
    staleTime: 3600_000,
  });
  const policy = useQuery({
    queryKey: k("dns-policy", locationId),
    queryFn: svc.locationDnsPolicy,
  });
  const status = useQuery({
    queryKey: k("dns-router", routerId),
    queryFn: () => svc.routerDnsStatus(routerId),
  });
  const [picked, setPicked] = useState<Set<number> | null>(null);
  const save = useMutation({
    mutationFn: (ids: number[]) => svc.setLocationDnsPolicy(ids),
    onSuccess: () => {
      toast.success("Categories saved for this venue.");
      setPicked(null);
      invalidate("dns-policy", locationId);
      invalidate("dns-router", routerId);
    },
    onError: (e) => toast.error(ispErrorMessage(e)),
  });
  const toggle = useMutation({
    mutationFn: (enabled: boolean) => svc.setRouterDns(routerId, enabled),
    onSuccess: () => invalidate("dns-router", routerId),
    onError: (e) => toast.error(ispErrorMessage(e)),
  });

  if (cats.isLoading || policy.isLoading) return <LoadingBlock />;
  if (cats.error || policy.error)
    return (
      <ErrorBlock
        error={cats.error ?? policy.error}
        onRetry={() => {
          cats.refetch();
          policy.refetch();
        }}
        what="website categories"
      />
    );
  const current = new Set(policy.data?.effective_category_ids ?? []);
  const sel = picked ?? current;
  const canEdit = can("isp_security.update");
  return (
    <Card
      title="Website categories"
      actions={
        status.data &&
        can("isp_security.execute") && (
          <MButton
            variant="outline"
            disabled={toggle.isPending}
            onClick={() => toggle.mutate(!status.data.enabled)}
          >
            {status.data.enabled ? "Turn off on this router" : "Turn on on this router"}
          </MButton>
        )
      }
    >
      {status.data && (
        <p className="mb-3 text-xs text-muted-foreground">
          Category filtering on this router: <MTag label={status.data.state} />{" "}
          {status.data.device_push_error}
        </p>
      )}
      <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
        {(cats.data ?? []).map((c) => (
          <label key={c.id} className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              disabled={!canEdit}
              checked={sel.has(c.id)}
              onChange={(e) => {
                const next = new Set(sel);
                if (e.target.checked) next.add(c.id);
                else next.delete(c.id);
                setPicked(next);
              }}
            />
            <span>
              {c.name}
              {c.is_security && (
                <span className="ml-1 text-[10px] text-muted-foreground">security</span>
              )}
            </span>
          </label>
        ))}
      </div>
      {canEdit && picked && (
        <div className="mt-3 flex gap-2">
          <MButton disabled={save.isPending} onClick={() => save.mutate([...picked])}>
            {save.isPending && <Spinner />} Save categories
          </MButton>
          <MButton variant="outline" onClick={() => setPicked(null)}>
            Cancel
          </MButton>
        </div>
      )}
    </Card>
  );
}

export function BlockWebsitesPage({ locationId }: PartnerSlotProps) {
  return (
    <WithRouter locationId={locationId as string} title="Block Websites">
      {(routerId) => (
        <div className="space-y-4">
          <ContentRules routerId={routerId} />
          <DnsCategories routerId={routerId} locationId={locationId as string} />
        </div>
      )}
    </WithRouter>
  );
}

// -- Firewall ----------------------------------------------------------------------

const EMPTY_RULE: Omit<FirewallRuleCreate, "router_id"> = {
  name: "",
  chain: "forward",
  action: "drop",
  protocol: "tcp",
  source_address: "",
  destination_address: "",
  destination_port: null,
  priority: 100,
  is_enabled: true,
};

function FirewallRules({ routerId }: { routerId: string }) {
  const { can } = usePartner();
  const invalidate = useInvalidate();
  const q = useQuery({
    queryKey: k("fw", routerId),
    queryFn: () => svc.listFirewallRules(routerId),
  });
  const [adding, setAdding] = useState(false);
  const [rule, setRule] = useState(EMPTY_RULE);
  const [error, setError] = useState<string | null>(null);
  const create = useMutation({
    mutationFn: () =>
      svc.createFirewallRule({
        ...rule,
        router_id: routerId,
        source_address: rule.source_address || null,
        destination_address: rule.destination_address || null,
      }),
    onSuccess: () => {
      toast.success("Rule saved. Push to apply it on the router.");
      setAdding(false);
      setRule(EMPTY_RULE);
      invalidate("fw", routerId);
    },
    onError: (e) => setError(ispErrorMessage(e)),
  });
  const remove = useMutation({
    mutationFn: (id: string) => svc.deleteFirewallRule(id),
    onSuccess: () => invalidate("fw", routerId),
    onError: (e) => toast.error(ispErrorMessage(e)),
  });
  const push = useMutation({
    mutationFn: () => svc.pushFirewall(routerId),
    onSuccess: (r) => {
      toast.success(`Pushed: ${r.added} added, ${r.removed} removed, ${r.unchanged} unchanged.`);
      invalidate("fw", routerId);
    },
    onError: (e) => toast.error(ispErrorMessage(e)),
  });
  const set = (patch: Partial<typeof rule>) => setRule({ ...rule, ...patch });

  return (
    <Card
      title="Firewall rules"
      actions={
        <>
          {can("isp_security.create") && (
            <MButton variant="outline" onClick={() => setAdding((a) => !a)}>
              <Plus /> Add rule
            </MButton>
          )}
          {can("isp_security.execute") && (
            <MButton disabled={push.isPending} onClick={() => push.mutate()}>
              {push.isPending ? <Spinner /> : <Upload />} Push to router
            </MButton>
          )}
        </>
      }
    >
      {adding && (
        <form
          className="mb-4 grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-4"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            create.mutate();
          }}
        >
          <input
            className={M_INPUT}
            placeholder="Name"
            required
            value={rule.name}
            onChange={(e) => set({ name: e.target.value })}
            aria-label="Name"
          />
          <select
            className={M_INPUT}
            value={rule.chain}
            onChange={(e) => set({ chain: e.target.value as FirewallRuleCreate["chain"] })}
            aria-label="Chain"
          >
            <option value="forward">Guest traffic (forward)</option>
            <option value="input">To the router (input)</option>
            <option value="output">From the router (output)</option>
          </select>
          <select
            className={M_INPUT}
            value={rule.action}
            onChange={(e) => set({ action: e.target.value as FirewallRuleCreate["action"] })}
            aria-label="Action"
          >
            <option value="drop">Drop</option>
            <option value="reject">Reject</option>
            <option value="accept">Allow</option>
          </select>
          <select
            className={M_INPUT}
            value={rule.protocol}
            onChange={(e) => set({ protocol: e.target.value as FirewallRuleCreate["protocol"] })}
            aria-label="Protocol"
          >
            <option value="tcp">TCP</option>
            <option value="udp">UDP</option>
            <option value="icmp">ICMP</option>
            <option value="all">Any</option>
          </select>
          <input
            className={M_INPUT}
            placeholder="Source address (optional)"
            value={rule.source_address ?? ""}
            onChange={(e) => set({ source_address: e.target.value })}
            aria-label="Source address"
          />
          <input
            className={M_INPUT}
            placeholder="Destination address (optional)"
            value={rule.destination_address ?? ""}
            onChange={(e) => set({ destination_address: e.target.value })}
            aria-label="Destination address"
          />
          <input
            className={M_INPUT}
            type="number"
            placeholder="Destination port"
            value={rule.destination_port ?? ""}
            onChange={(e) =>
              set({ destination_port: e.target.value ? Number(e.target.value) : null })
            }
            aria-label="Destination port"
          />
          <input
            className={M_INPUT}
            type="number"
            placeholder="Priority"
            value={rule.priority}
            onChange={(e) => set({ priority: Number(e.target.value) || 0 })}
            aria-label="Priority"
          />
          <div className="sm:col-span-4">
            <FormError message={error} />
            <MButton type="submit" disabled={create.isPending}>
              {create.isPending && <Spinner />} Save rule
            </MButton>
          </div>
        </form>
      )}
      {q.error && !q.data ? (
        <ErrorBlock error={q.error} onRetry={() => q.refetch()} what="firewall rules" />
      ) : q.data && q.data.items.length === 0 ? (
        <MEmptyState icon={ShieldAlert} title="No firewall rules on this router" />
      ) : (
        <MTable
          loading={q.isLoading}
          head={
            <>
              <MTh>Rule</MTh>
              <MTh>Match</MTh>
              <MTh>Action</MTh>
              <MTh>On router</MTh>
              <MTh />
            </>
          }
        >
          {q.data?.items.map((r) => (
            <MTr key={r.id}>
              <MTd className="font-medium">
                {r.name}
                <p className="text-[11px] text-muted-foreground">
                  {r.chain} · priority {r.priority}
                </p>
              </MTd>
              <MTd className="text-xs">
                {r.protocol} {r.source_address ?? "any"} → {r.destination_address ?? "any"}
                {r.destination_port ? `:${r.destination_port}` : ""}
              </MTd>
              <MTd>
                <MTag label={r.action} />
              </MTd>
              <MTd>
                <MTag label={r.device_push_status} />
              </MTd>
              <MTd className="text-right">
                {can("isp_security.delete") && (
                  <MButton variant="ghost" onClick={() => remove.mutate(r.id)} aria-label="Delete">
                    <Trash2 />
                  </MButton>
                )}
              </MTd>
            </MTr>
          ))}
        </MTable>
      )}
    </Card>
  );
}

function BandNote({ state }: { state: "ready" | "missing" | "invalid" }) {
  if (state === "ready") return null;
  return (
    <p className="text-xs text-muted-foreground">
      This router is not prepared for this yet. Wyfy support sets it up; ask through Support
      Tickets.
    </p>
  );
}

function RouterProtections({ routerId }: { routerId: string }) {
  const { can } = usePartner();
  const invalidate = useInvalidate();
  const flood = useQuery({
    queryKey: k("flood", routerId),
    queryFn: () => svc.floodLimit(routerId),
  });
  const iso = useQuery({
    queryKey: k("iso", routerId),
    queryFn: () => svc.guestIsolation(routerId),
  });
  const setFlood = useMutation({
    mutationFn: (preset: string) => svc.setFloodLimit(routerId, preset),
    onSuccess: () => {
      toast.success("Flood limit applied on the router.");
      invalidate("flood", routerId);
    },
    onError: (e) => toast.error(ispErrorMessage(e)),
  });
  const setIso = useMutation({
    mutationFn: (enabled: boolean) => svc.setGuestIsolation(routerId, enabled),
    onSuccess: () => invalidate("iso", routerId),
    onError: (e) => toast.error(ispErrorMessage(e)),
  });
  const exec = can("isp_security.execute");
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="Connection flood limit">
        {flood.isLoading ? (
          <LoadingBlock />
        ) : flood.error || !flood.data ? (
          <ErrorBlock error={flood.error} onRetry={() => flood.refetch()} what="the flood limit" />
        ) : (
          <div className="space-y-2">
            <select
              className={`${M_INPUT} w-auto`}
              disabled={!exec || setFlood.isPending || flood.data.band_state !== "ready"}
              value={flood.data.preset ?? ""}
              onChange={(e) => setFlood.mutate(e.target.value)}
              aria-label="Flood limit preset"
            >
              {flood.data.preset === null && <option value="">Custom</option>}
              {["off", "relaxed", "normal", "strict"].map((p) => (
                <option key={p} value={p}>
                  {p}
                  {flood.data.presets[p] ? ` (${flood.data.presets[p]} new connections/s)` : ""}
                </option>
              ))}
            </select>
            {!flood.data.consistent && (
              <p className="text-xs text-destructive">
                The router does not match the saved setting.
              </p>
            )}
            <BandNote state={flood.data.band_state} />
          </div>
        )}
      </Card>
      <Card title="Guest isolation">
        {iso.isLoading ? (
          <LoadingBlock />
        ) : iso.error || !iso.data ? (
          <ErrorBlock error={iso.error} onRetry={() => iso.refetch()} what="guest isolation" />
        ) : (
          <div className="space-y-2 text-sm">
            <p>{iso.data.summary}</p>
            {iso.data.refusal && <p className="text-xs text-destructive">{iso.data.refusal}</p>}
            {exec && iso.data.band_state === "ready" && (
              <MButton
                variant="outline"
                disabled={setIso.isPending}
                onClick={() => setIso.mutate(!iso.data.enabled)}
              >
                {setIso.isPending && <Spinner />}
                {iso.data.enabled ? "Turn isolation off" : "Turn isolation on"}
              </MButton>
            )}
            <BandNote state={iso.data.band_state} />
          </div>
        )}
      </Card>
    </div>
  );
}

export function FirewallPage({ locationId }: PartnerSlotProps) {
  return (
    <WithRouter locationId={locationId as string} title="Firewall">
      {(routerId) => (
        <div className="space-y-4">
          <FirewallRules routerId={routerId} />
          <RouterProtections routerId={routerId} />
        </div>
      )}
    </WithRouter>
  );
}

// -- Fix a Problem -------------------------------------------------------------

function Diagnostics({ routerId }: { routerId: string }) {
  const invalidate = useInvalidate();
  const [kind, setKind] = useState<"ping" | "traceroute">("ping");
  const [target, setTarget] = useState("8.8.8.8");
  const runs = useQuery({ queryKey: k("runs", routerId), queryFn: () => svc.listRuns(routerId) });
  const run = useMutation({
    mutationFn: () => svc.runDiagnostic(routerId, kind, target.trim()),
    onSuccess: () => invalidate("runs", routerId),
    onError: (e) => toast.error(ispErrorMessage(e)),
  });
  const last = run.data;
  return (
    <div className="space-y-4">
      <Card title="Test from the router">
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (target.trim()) run.mutate();
          }}
        >
          <select
            className={`${M_INPUT} w-auto`}
            value={kind}
            onChange={(e) => setKind(e.target.value as "ping" | "traceroute")}
            aria-label="Test"
          >
            <option value="ping">Ping</option>
            <option value="traceroute">Traceroute</option>
          </select>
          <input
            className={`${M_INPUT} w-56`}
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            aria-label="Target"
            placeholder="Address or hostname"
          />
          <MButton type="submit" disabled={run.isPending}>
            {run.isPending && <Spinner />} Run
          </MButton>
        </form>
        {last && (
          <div className="mt-3 space-y-1 text-sm">
            <p>
              <MTag label={last.status} /> {last.diagnostic_type} {last.target}
            </p>
            {last.error_message && <p className="text-xs text-destructive">{last.error_message}</p>}
            <pre className="max-h-64 overflow-auto rounded-lg bg-muted p-3 text-[11px]">
              {JSON.stringify(last.result, null, 2)}
            </pre>
          </div>
        )}
      </Card>
      <Card title="Recent runs">
        {runs.error && !runs.data ? (
          <ErrorBlock error={runs.error} onRetry={() => runs.refetch()} what="recent runs" />
        ) : runs.data && runs.data.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No tests run on this router yet.</p>
        ) : (
          <MTable
            loading={runs.isLoading}
            head={
              <>
                <MTh>When</MTh>
                <MTh>Test</MTh>
                <MTh>Status</MTh>
              </>
            }
          >
            {runs.data?.items.map((r) => (
              <MTr key={r.id}>
                <MTd className="text-xs">{formatDate(r.created_at)}</MTd>
                <MTd>
                  {r.diagnostic_type} {r.target}
                </MTd>
                <MTd>
                  <MTag label={r.status} />
                </MTd>
              </MTr>
            ))}
          </MTable>
        )}
      </Card>
    </div>
  );
}

export function FixAProblemPage({ locationId }: PartnerSlotProps) {
  return (
    <WithRouter locationId={locationId as string} title="Fix a Problem">
      {(routerId) => <Diagnostics routerId={routerId} />}
    </WithRouter>
  );
}

// -- Devices ---------------------------------------------------------------------

function Clients({ locationId }: { locationId: string }) {
  const { can } = usePartner();
  const invalidate = useInvalidate();
  const [routerId, setRouterId] = useState<string | null>(null);
  const q = useQuery({
    queryKey: k("clients", locationId, routerId),
    queryFn: () => svc.listClients(routerId),
  });
  const sync = useMutation({
    mutationFn: () => svc.syncClients(routerId as string),
    onSuccess: () => invalidate("clients", locationId),
    onError: (e) => toast.error(ispErrorMessage(e)),
  });
  const disconnect = useMutation({
    mutationFn: (id: string) => svc.disconnectClient(id),
    onSuccess: () => invalidate("clients", locationId),
    onError: (e) => toast.error(ispErrorMessage(e)),
  });
  const update = can("isp_monitor.update");
  return (
    <Card
      title="Connected devices"
      actions={
        <>
          <RouterSelect locationId={locationId} value={routerId} onChange={setRouterId} />
          {update && routerId && (
            <MButton variant="outline" disabled={sync.isPending} onClick={() => sync.mutate()}>
              {sync.isPending && <Spinner />} Refresh from router
            </MButton>
          )}
        </>
      }
    >
      {q.error && !q.data ? (
        <ErrorBlock error={q.error} onRetry={() => q.refetch()} what="connected devices" />
      ) : q.data && q.data.items.length === 0 ? (
        <MEmptyState icon={Monitor} title="No devices seen at this venue" />
      ) : (
        <MTable
          loading={q.isLoading}
          head={
            <>
              <MTh>Device</MTh>
              <MTh>Address</MTh>
              <MTh>Status</MTh>
              <MTh>Last seen</MTh>
              <MTh />
            </>
          }
        >
          {q.data?.items.map((d) => (
            <MTr key={d.id}>
              <MTd className="font-medium">
                {d.hostname || d.vendor || "Unknown device"}
                <p className="text-[11px] text-muted-foreground">{d.mac_address}</p>
              </MTd>
              <MTd className="text-xs">{d.ip_address ?? "–"}</MTd>
              <MTd>
                <MTag label={d.is_active ? "online" : "offline"} />
              </MTd>
              <MTd className="text-xs">{d.last_seen_at ? formatDate(d.last_seen_at) : "–"}</MTd>
              <MTd className="text-right">
                {update && d.is_active && (
                  <MButton variant="ghost" onClick={() => disconnect.mutate(d.id)}>
                    Disconnect
                  </MButton>
                )}
              </MTd>
            </MTr>
          ))}
        </MTable>
      )}
    </Card>
  );
}

function Hardware({ locationId }: { locationId: string }) {
  const { can } = usePartner();
  const invalidate = useInvalidate();
  const q = useQuery({ queryKey: k("hardware", locationId), queryFn: svc.listHardware });
  const [form, setForm] = useState({ name: "", mac_address: "", device_type: "access_point" });
  const [error, setError] = useState<string | null>(null);
  const add = useMutation({
    mutationFn: () => svc.registerHardware(locationId, form),
    onSuccess: () => {
      toast.success("Device added for monitoring.");
      setForm({ name: "", mac_address: "", device_type: form.device_type });
      invalidate("hardware", locationId);
    },
    onError: (e) => setError(ispErrorMessage(e)),
  });
  const remove = useMutation({
    mutationFn: (id: string) => svc.deleteHardware(id),
    onSuccess: () => invalidate("hardware", locationId),
    onError: (e) => toast.error(ispErrorMessage(e)),
  });
  const update = can("isp_monitor.update");
  return (
    <Card title="Access points and switches">
      {update && (
        <form
          className="mb-3 flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            add.mutate();
          }}
        >
          <input
            className={`${M_INPUT} w-48`}
            placeholder="Name"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            aria-label="Name"
          />
          <input
            className={`${M_INPUT} w-44`}
            placeholder="MAC address"
            required
            value={form.mac_address}
            onChange={(e) => setForm({ ...form, mac_address: e.target.value })}
            aria-label="MAC address"
          />
          <select
            className={`${M_INPUT} w-auto`}
            value={form.device_type}
            onChange={(e) => setForm({ ...form, device_type: e.target.value })}
            aria-label="Type"
          >
            <option value="access_point">Access point</option>
            <option value="switch">Switch</option>
            <option value="other">Other</option>
          </select>
          <MButton type="submit" disabled={add.isPending}>
            {add.isPending ? <Spinner /> : <Plus />} Add
          </MButton>
        </form>
      )}
      <FormError message={error} />
      {q.error && !q.data ? (
        <ErrorBlock error={q.error} onRetry={() => q.refetch()} what="monitored hardware" />
      ) : q.data && q.data.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No access points or switches added yet.</p>
      ) : (
        <MTable
          loading={q.isLoading}
          head={
            <>
              <MTh>Device</MTh>
              <MTh>Status</MTh>
              <MTh>Why</MTh>
              <MTh />
            </>
          }
        >
          {q.data?.items.map((h) => (
            <MTr key={h.id}>
              <MTd className="font-medium">
                {h.name}
                <p className="text-[11px] text-muted-foreground">
                  {h.device_type} · {h.mac_address}
                </p>
              </MTd>
              <MTd>
                <MTag label={h.status} />
              </MTd>
              <MTd className="text-xs">{h.status_reason}</MTd>
              <MTd className="text-right">
                {update && (
                  <MButton variant="ghost" onClick={() => remove.mutate(h.id)} aria-label="Remove">
                    <Trash2 />
                  </MButton>
                )}
              </MTd>
            </MTr>
          ))}
        </MTable>
      )}
    </Card>
  );
}

export function DevicesPage(props: PartnerSlotProps) {
  const { can } = usePartner();
  const locationId = props.locationId as string;
  return (
    <div className="space-y-4">
      <RoutersAndCpes {...props} />
      {can("isp_monitor.read") && <Hardware locationId={locationId} />}
      {can("isp_monitor.read") && <Clients locationId={locationId} />}
    </div>
  );
}
