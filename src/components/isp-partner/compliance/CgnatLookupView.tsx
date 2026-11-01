/**
 * J5: trace a public IP (+ port) at an instant to the subscriber, and J12:
 * the session dump. Results are masked on screen; the CSV (export role)
 * carries the full identity and is audited.
 */
import { useState } from "react";
import {
  MButton,
  MEmptyState,
  MTable,
  MTag,
  MTd,
  MTh,
  MTr,
  M_INPUT,
} from "@/components/master/MasterKit";
import {
  Card,
  CustomerSelect,
  ErrorBlock,
  FormError,
  LoadingBlock,
} from "@/components/isp-partner/kit";
import { usePartner } from "@/components/isp-partner/PartnerContext";
import { useIspCustomerOptions } from "@/hooks/isp-partner/useIsp";
import { useCgnatLookup } from "@/hooks/isp-partner/useCompliance";
import { saveBlob } from "@/lib/isp-partner/download";
import { ispErrorMessage } from "@/lib/isp-partner/errors";
import { formatDateTime, isoDay } from "@/lib/isp-partner/format";
import {
  complianceService,
  type CgnatQuery,
  type CgnatVerdict,
} from "@/services/isp-partner/compliance";
import { M_FILTER } from "@/components/isp-partner/ui/classes";

const VERDICT: Record<CgnatVerdict, { label: string; tone: string; help: string }> = {
  unique_match: {
    label: "One subscriber",
    tone: "active",
    help: "Every matching connection belongs to the same subscriber or device.",
  },
  multiple_candidates: {
    label: "Several candidates",
    tone: "pending",
    help: "More than one subscriber used this address in the window. Add the port, destination or narrow the tolerance before attributing.",
  },
  no_match: {
    label: "No match",
    tone: "offline",
    help: "NAT records exist for this window, but none used this address and port.",
  },
  no_nat_data_for_window: {
    label: "No NAT data for this window",
    tone: "failed",
    help: "No translation records were received from your routers for this time. This is an evidence gap: report it as such, do not attribute.",
  },
};

export function CgnatLookupView() {
  const { can } = usePartner();
  const customers = useIspCustomerOptions();
  const [form, setForm] = useState<CgnatQuery>({
    public_ip: "",
    public_port: "",
    at: "",
    tz: "Asia/Kolkata",
    tolerance_seconds: "60",
    protocol: "",
    dst_ip: "",
    dst_port: "",
    isp_customer_id: "",
  });
  const [query, setQuery] = useState<CgnatQuery | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const q = useCgnatLookup(query);
  const set = (k: keyof CgnatQuery, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="space-y-4">
      <Card title="Trace a public IP">
        <p className="mb-3 text-xs text-muted-foreground">
          Enter the public IP, port and time from the request. The time is read in the zone you
          pick. The tolerance widens the search either side of that time.
        </p>
        <form
          className="grid gap-3 sm:grid-cols-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!form.public_ip.trim() || !form.at) {
              setErr("Public IP and time are required.");
              return;
            }
            setErr(null);
            setQuery({ ...form, public_ip: form.public_ip.trim() });
          }}
        >
          <label className="text-xs text-muted-foreground">
            Public IP
            <input
              className={M_INPUT}
              value={form.public_ip}
              onChange={(e) => set("public_ip", e.target.value)}
              placeholder="203.0.113.80"
            />
          </label>
          <label className="text-xs text-muted-foreground">
            Public port
            <input
              className={M_INPUT}
              inputMode="numeric"
              value={form.public_port}
              onChange={(e) => set("public_port", e.target.value)}
            />
          </label>
          <label className="text-xs text-muted-foreground">
            Time
            <input
              type="datetime-local"
              step={1}
              className={M_INPUT}
              value={form.at}
              onChange={(e) => set("at", e.target.value)}
            />
          </label>
          <label className="text-xs text-muted-foreground">
            Time zone
            <select className={M_INPUT} value={form.tz} onChange={(e) => set("tz", e.target.value)}>
              <option value="Asia/Kolkata">IST (Asia/Kolkata)</option>
              <option value="UTC">UTC</option>
            </select>
          </label>
          <label className="text-xs text-muted-foreground">
            Tolerance (seconds)
            <input
              className={M_INPUT}
              inputMode="numeric"
              value={form.tolerance_seconds}
              onChange={(e) => set("tolerance_seconds", e.target.value)}
            />
          </label>
          <label className="text-xs text-muted-foreground">
            Protocol
            <select
              className={M_INPUT}
              value={form.protocol}
              onChange={(e) => set("protocol", e.target.value)}
            >
              <option value="">Any</option>
              <option value="tcp">TCP</option>
              <option value="udp">UDP</option>
              <option value="icmp">ICMP</option>
            </select>
          </label>
          <label className="text-xs text-muted-foreground">
            Destination IP (optional)
            <input
              className={M_INPUT}
              value={form.dst_ip}
              onChange={(e) => set("dst_ip", e.target.value)}
            />
          </label>
          <label className="text-xs text-muted-foreground">
            Destination port (optional)
            <input
              className={M_INPUT}
              inputMode="numeric"
              value={form.dst_port}
              onChange={(e) => set("dst_port", e.target.value)}
            />
          </label>
          <div className="text-xs text-muted-foreground sm:col-span-2">
            Customer
            <CustomerSelect
              value={form.isp_customer_id ?? ""}
              onChange={(v) => set("isp_customer_id", v)}
              customers={customers.data}
            />
          </div>
          <div className="flex items-end gap-2 sm:col-span-2">
            <MButton type="submit">Search</MButton>
            {can("isp_ipdr.export") && query && q.data && (
              <MButton
                type="button"
                variant="outline"
                onClick={async () => {
                  try {
                    const f = await complianceService.cgnatExport(query);
                    saveBlob(f.blob, f.filename);
                  } catch (e) {
                    setErr(ispErrorMessage(e));
                  }
                }}
              >
                Export CSV (full details)
              </MButton>
            )}
          </div>
        </form>
        <FormError message={err} />
      </Card>

      {query && q.isLoading && <LoadingBlock label="Searching NAT records…" />}
      {q.error && <ErrorBlock error={q.error} what="the lookup" />}
      {q.data && (
        <Card
          title="Result"
          actions={
            <MTag label={VERDICT[q.data.verdict].label} tone={VERDICT[q.data.verdict].tone} />
          }
        >
          <p className="text-sm">{VERDICT[q.data.verdict].help}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Searched {q.data.query.public_ip}:{q.data.query.public_port ?? "any port"} from{" "}
            {formatDateTime(q.data.query.window_start)} to {formatDateTime(q.data.query.window_end)}{" "}
            across {q.data.customers_searched} customer(s).
          </p>
          {q.data.public_ip_is_router_wan.length > 0 && (
            <p className="mt-1 text-xs text-muted-foreground">
              This address is the WAN address of:{" "}
              {q.data.public_ip_is_router_wan.map((r) => r.router_name).join(", ")}.
            </p>
          )}
          {q.data.matches.length === 0 ? (
            <div className="mt-3">
              <MEmptyState title="Nothing to show" description="No connection matched." />
            </div>
          ) : (
            <div className="mt-3">
              <MTable
                head={
                  <MTr>
                    <MTh>Connection</MTh>
                    <MTh>Inside address</MTh>
                    <MTh>Destination</MTh>
                    <MTh>Translation</MTh>
                    <MTh>Subscriber</MTh>
                  </MTr>
                }
              >
                {q.data.matches.map((m, i) => (
                  <MTr key={i}>
                    <MTd>
                      {formatDateTime(m.record.ts)}
                      <div className="text-xs text-muted-foreground">
                        to {formatDateTime(m.record.ts_end ?? m.record.ts)} · time from{" "}
                        {m.record.ts_source === "flow" ? "router" : "collector window"}
                      </div>
                    </MTd>
                    <MTd>
                      {m.record.src_ip}:{m.record.src_port ?? "?"}
                      <div className="text-xs text-muted-foreground">{m.record.mac ?? ""}</div>
                    </MTd>
                    <MTd>
                      {m.record.dst_ip}:{m.record.dst_port ?? "?"}
                    </MTd>
                    <MTd>
                      {m.record.nat_ip}:{m.record.nat_port ?? "?"}
                      <div className="text-xs text-muted-foreground">{m.record.nat_source}</div>
                    </MTd>
                    <MTd>
                      {m.subscriber ? (
                        <>
                          <div className="font-medium">
                            {m.subscriber.name ?? m.subscriber.username} · CID{" "}
                            {m.subscriber.circuit_id}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {m.subscriber.phone ?? ""}{" "}
                            {m.customer_name ? `· ${m.customer_name}` : ""}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {m.subscriber.caf_number
                              ? `CAF ${m.subscriber.caf_number}`
                              : "No CAF on file"}
                          </div>
                        </>
                      ) : m.record.user_known ? (
                        <>
                          <div className="font-medium">{m.record.user_id}</div>
                          <div className="text-xs text-muted-foreground">
                            Guest login, not a subscriber · {m.customer_name}
                          </div>
                        </>
                      ) : (
                        <span className="text-muted-foreground">
                          {m.record.user_id === "device" ? "Venue device" : "Unknown user"}
                        </span>
                      )}
                    </MTd>
                  </MTr>
                ))}
              </MTable>
            </div>
          )}
          <ul className="mt-3 list-disc space-y-0.5 pl-5 text-[11px] text-muted-foreground">
            <li>{q.data.time_basis}</li>
            {q.data.evidence_notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </Card>
      )}
      {can("isp_ipdr.export") && <SessionDumpCard customers={customers.data} />}
    </div>
  );
}

function SessionDumpCard({
  customers,
}: {
  customers: Parameters<typeof CustomerSelect>[0]["customers"];
}) {
  const today = isoDay(new Date());
  const [from, setFrom] = useState(isoDay(new Date(Date.now() - 86_400_000)));
  const [to, setTo] = useState(today);
  const [cust, setCust] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <Card title="Session dump">
      <p className="mb-3 text-xs text-muted-foreground">
        Every Wi-Fi session in the range with the subscriber, device, address and router: the
        columns an IPDR request asks for. Up to 31 days per file. Columns the platform does not
        capture (IPv6 prefix, AP MAC/name, NAS port) are left empty and named in the file header.
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <input
          type="date"
          aria-label="From"
          className={`${M_FILTER}`}
          value={from}
          onChange={(e) => setFrom(e.target.value)}
        />
        <input
          type="date"
          aria-label="To"
          className={`${M_FILTER}`}
          value={to}
          onChange={(e) => setTo(e.target.value)}
        />
        <div className="w-56">
          <CustomerSelect value={cust} onChange={setCust} customers={customers} />
        </div>
        <MButton
          disabled={busy || from > to}
          onClick={async () => {
            setBusy(true);
            setErr(null);
            try {
              const f = await complianceService.sessionDump({
                since: `${from}T00:00:00+05:30`,
                until: new Date(
                  new Date(`${to}T00:00:00+05:30`).getTime() + 86_400_000,
                ).toISOString(),
                isp_customer_id: cust || undefined,
              });
              saveBlob(f.blob, f.filename);
            } catch (e) {
              setErr(ispErrorMessage(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Preparing…" : "Download CSV"}
        </MButton>
      </div>
      <FormError message={err} />
    </Card>
  );
}
