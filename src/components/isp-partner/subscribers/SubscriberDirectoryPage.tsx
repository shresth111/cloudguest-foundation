/**
 * Subscribers directory (ADDENDUM_05 J11): every subscriber across the ISP's
 * customers, filterable by state (with counts), package (active / total),
 * customer and zone; typeahead on name, mobile, login id or circuit id.
 * A row opens the Subscriber 360 page.
 */
import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Plus, Search, Users } from "lucide-react";
import {
  MButton,
  MEmptyState,
  MSectionHeader,
  MTable,
  MTag,
  MTd,
  MTh,
  MTr,
  M_INPUT,
} from "@/components/master/MasterKit";
import { CustomerSelect, ErrorBlock, Pager } from "@/components/isp-partner/kit";
import { usePartner } from "@/components/isp-partner/PartnerContext";
import { OnboardDrawer } from "@/components/isp-partner/subscribers/OnboardDrawer";
import { useZones } from "@/hooks/isp-partner/useInvoices";
import { useIspCustomerOptions } from "@/hooks/isp-partner/useIsp";
import {
  useSubscriberDirectory,
  useSubscriberTypeahead,
} from "@/hooks/isp-partner/useSubscriber360";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { formatDate } from "@/lib/isp-partner/format";
import { formatRupees } from "@/lib/isp-partner/money";
import { relativeValidity } from "@/lib/isp-partner/plans";
import { STATE_LABEL, stateLabel, stateTone } from "@/lib/isp-partner/subscribers360";
import { DISPLAY_STATES, type DisplayState } from "@/services/isp-partner/subscribers360-types";

function Typeahead() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [focus, setFocus] = useState(false);
  const debounced = useDebouncedValue(q.trim(), 200);
  const hits = useSubscriberTypeahead(debounced);
  const show = focus && debounced.length >= 2;
  return (
    <div className="relative w-full max-w-[320px]">
      <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
      <input
        className={`${M_INPUT} pl-8`}
        placeholder="Jump to: name, mobile, login id, circuit"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => setFocus(true)}
        onBlur={() => setTimeout(() => setFocus(false), 150)}
        aria-label="Find a subscriber"
      />
      {show && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-border bg-popover shadow-lg">
          {(hits.data ?? []).length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">
              {hits.isLoading ? "Searching…" : "No match."}
            </p>
          ) : (
            hits.data?.map((h) => (
              <button
                key={h.id}
                type="button"
                className="block w-full px-3 py-2 text-left text-xs hover:bg-accent"
                onMouseDown={() =>
                  navigate({
                    to: "/partner/subscribers/$subscriberId",
                    params: { subscriberId: h.id },
                  })
                }
              >
                <span className="font-medium">{h.name ?? h.identifier}</span>{" "}
                <span className="text-muted-foreground">
                  · #{h.circuit_id} · {h.phone ?? h.identifier} · {h.customer_name ?? ""}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export function SubscriberDirectoryPage() {
  const { can } = usePartner();
  const customers = useIspCustomerOptions();
  const zones = useZones(can("isp_zones.read"));
  const [state, setState] = useState<DisplayState | "">("");
  const [customerId, setCustomerId] = useState("");
  const [packageId, setPackageId] = useState("");
  const [zoneId, setZoneId] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [adding, setAdding] = useState(false);
  const debounced = useDebouncedValue(search.trim(), 300);
  const q = useSubscriberDirectory({
    state: state || undefined,
    isp_customer_id: customerId || undefined,
    package_id: packageId || undefined,
    zone_id: zoneId || undefined,
    search: debounced || undefined,
    page,
    page_size: 25,
  });
  const data = q.data;
  const counts = data?.state_counts;
  const total = counts ? Object.values(counts).reduce((a, b) => a + b, 0) : undefined;

  return (
    <div className="space-y-4">
      <MSectionHeader
        title="Subscribers"
        description="Everyone on your network, across all your customers."
        actions={
          can("isp_subscribers.update") ? (
            <>
              <MButton variant="outline" onClick={() => setAdding(true)}>
                Quick add
              </MButton>
              {/* ONBOARD-1: the full one-page form. */}
              <Link to="/partner/subscribers/new">
                <MButton>
                  <Plus /> Add subscriber
                </MButton>
              </Link>
            </>
          ) : undefined
        }
      />
      <Typeahead />
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by state">
        <button
          type="button"
          onClick={() => {
            setState("");
            setPage(1);
          }}
          className={`rounded-full border px-3 py-1 text-xs ${state === "" ? "border-primary bg-primary/10 text-primary" : "border-border"}`}
        >
          All {total !== undefined && <span className="tabular-nums">({total})</span>}
        </button>
        {DISPLAY_STATES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => {
              setState(s);
              setPage(1);
            }}
            className={`rounded-full border px-3 py-1 text-xs ${state === s ? "border-primary bg-primary/10 text-primary" : "border-border"}`}
          >
            {STATE_LABEL[s]}{" "}
            {counts && <span className="tabular-nums text-muted-foreground">({counts[s]})</span>}
          </button>
        ))}
      </div>
      {data && data.package_counts.length > 0 && (
        <div className="flex flex-wrap gap-2 text-xs">
          {data.package_counts.map((p) => (
            <button
              key={p.package_id}
              type="button"
              onClick={() => {
                setPackageId(packageId === p.package_id ? "" : p.package_id);
                setPage(1);
              }}
              className={`rounded-lg border px-2.5 py-1.5 text-left ${packageId === p.package_id ? "border-primary bg-primary/5" : "border-border"}`}
            >
              <span className="font-medium">{p.name}</span>
              <span className="ml-2 tabular-nums text-muted-foreground">
                {p.active} active / {p.total}
              </span>
            </button>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-full max-w-[220px]">
          <CustomerSelect
            value={customerId}
            onChange={(v) => {
              setCustomerId(v);
              setPage(1);
            }}
            customers={customers.data}
          />
        </div>
        {can("isp_zones.read") && (
          <select
            className={`${M_INPUT} w-auto`}
            value={zoneId}
            onChange={(e) => {
              setZoneId(e.target.value);
              setPage(1);
            }}
            aria-label="Zone"
          >
            <option value="">All zones</option>
            {(zones.data ?? []).map((z) => (
              <option key={z.id} value={z.id}>
                {z.name}
              </option>
            ))}
          </select>
        )}
        <input
          className={`${M_INPUT} w-full max-w-[220px]`}
          placeholder="Filter the list"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
      </div>
      {q.error && !data ? (
        <ErrorBlock error={q.error} onRetry={() => q.refetch()} what="subscribers" />
      ) : data && data.items.length === 0 ? (
        <MEmptyState
          icon={Users}
          title="No subscribers here"
          description="Change the filters, or add a subscriber."
        />
      ) : (
        <>
          <MTable
            loading={q.isLoading}
            head={
              <>
                <MTh className="text-right">Circuit</MTh>
                <MTh>Subscriber</MTh>
                <MTh>Mobile</MTh>
                <MTh>Customer</MTh>
                <MTh>Package</MTh>
                <MTh>Valid until</MTh>
                <MTh>State</MTh>
              </>
            }
          >
            {data?.items.map((s) => (
              <MTr key={s.id}>
                <MTd className="text-right text-xs tabular-nums">{s.circuit_id ?? "–"}</MTd>
                <MTd>
                  <Link
                    to="/partner/subscribers/$subscriberId"
                    params={{ subscriberId: s.id }}
                    className="font-medium hover:underline"
                  >
                    {[s.first_name, s.last_name].filter(Boolean).join(" ") ||
                      s.display_name ||
                      s.identifier}
                  </Link>
                  <p className="font-mono text-[11px] text-muted-foreground">{s.identifier}</p>
                </MTd>
                <MTd className="text-xs">{s.phone ?? "–"}</MTd>
                <MTd className="text-xs">
                  {s.customer_name ?? "–"}
                  {s.zone && <p className="text-muted-foreground">{s.zone.name}</p>}
                </MTd>
                <MTd className="text-xs">
                  {s.package?.name ?? "–"}
                  {s.override_price_paise !== null && (
                    <p className="text-muted-foreground">
                      Override {formatRupees(s.override_price_paise)}
                    </p>
                  )}
                </MTd>
                <MTd className="text-xs">
                  {formatDate(s.valid_until)}
                  <p className="text-muted-foreground">{relativeValidity(s.valid_until)}</p>
                </MTd>
                <MTd>
                  <MTag label={stateLabel(s.display_state)} tone={stateTone(s.display_state)} />
                </MTd>
              </MTr>
            ))}
          </MTable>
          {data && (
            <Pager page={data.page} pages={data.pages} total={data.total} onPage={setPage} />
          )}
        </>
      )}
      <OnboardDrawer open={adding} onClose={() => setAdding(false)} />
    </div>
  );
}
