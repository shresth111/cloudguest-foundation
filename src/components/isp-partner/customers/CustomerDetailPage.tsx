/**
 * `/partner/customers/$ispCustomerId` (PRD §4.3): everything the ISP does
 * for one customer, in tabs. There is no "open the customer's dashboard":
 * the customer has none (founder rule).
 */
import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { MapPin, Pencil, Plus } from "lucide-react";
import {
  MButton,
  MEmptyState,
  MSectionHeader,
  MStat,
  MTable,
  MTag,
  MTd,
  MTh,
  MTr,
} from "@/components/master/MasterKit";
import { Card, ErrorBlock, LoadingBlock } from "@/components/isp-partner/kit";
import { CustomerFormDrawer } from "@/components/isp-partner/customers/CustomerFormDrawer";
import { SuspendCustomerDialog } from "@/components/isp-partner/customers/SuspendCustomerDialog";
import { LocationFormDrawer } from "@/components/isp-partner/locations/LocationFormDrawer";
import { RoutersTable } from "@/components/isp-partner/routers/RoutersTable";
import { PortalEditor } from "@/components/isp-partner/portal/PortalEditor";
import { GuestsSessionsTab } from "@/components/isp-partner/guests/GuestsSessionsTab";
import { LogsView } from "@/components/isp-partner/log-views/LogsView";
import { DEFAULT_LOG_FILTERS, type LogFilters } from "@/components/isp-partner/log-views/logFilters";
import { CustomerTr069Tab } from "@/components/isp-partner/tr069/CustomerTr069Tab";
import { ReportsView } from "@/components/isp-partner/reports/ReportsView";
import { usePartner } from "@/components/isp-partner/PartnerContext";
import { useIspCustomer, useIspCustomerLocations } from "@/hooks/isp-partner/useIsp";
import { formatDate } from "@/lib/isp-partner/format";
import { cn } from "@/lib/utils";
import type { IspCustomer } from "@/services/isp-partner/types";

export type CustomerTab =
  | "overview"
  | "locations"
  | "routers"
  | "portal"
  | "guests"
  | "logs"
  | "tr069"
  | "reports";

const CUSTOMER_TABS: readonly CustomerTab[] = [
  "overview",
  "locations",
  "routers",
  "portal",
  "guests",
  "logs",
  "tr069",
  "reports",
];

const TAB_LABEL: Record<CustomerTab, string> = {
  overview: "Overview",
  locations: "Locations",
  routers: "Routers",
  portal: "Captive portal",
  guests: "Guests & sessions",
  logs: "Logs",
  tr069: "TR-069 devices",
  reports: "Reports",
};

function Field({ k, v }: { k: string; v: string | null | undefined }) {
  return (
    <>
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="min-w-0 break-words">{v || "–"}</dd>
    </>
  );
}

function OverviewTab({ c }: { c: IspCustomer }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MStat label="Locations" value={c.counts.locations} />
        <MStat
          label="Routers online"
          value={`${c.counts.routers_online} / ${c.counts.routers_total}`}
        />
        <MStat label="TR-069 CPEs" value={c.counts.cpes} />
        <MStat label="TR-069" value={c.tr069_enabled ? "On" : "Off"} />
      </div>
      <Card title="Details">
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
          <Field k="Legal name" v={c.legal_name} />
          <Field k="GSTIN" v={c.gstin} />
          <Field k="Your account no." v={c.external_ref} />
          <Field k="Contact" v={[c.contact_name, c.contact_phone].filter(Boolean).join(" · ")} />
          <Field k="Contact email" v={c.contact_email} />
          <Field
            k="Address"
            v={[c.address_line1, c.city, c.state_province, c.postal_code]
              .filter(Boolean)
              .join(", ")}
          />
          <Field k="Timezone" v={c.timezone} />
          <Field k="Slug" v={c.slug} />
          <Field k="Added" v={formatDate(c.created_at)} />
          <Field k="Notes" v={c.notes} />
        </dl>
      </Card>
    </div>
  );
}

function LocationsTab({ customerId }: { customerId: string }) {
  const { can } = usePartner();
  const navigate = useNavigate();
  const q = useIspCustomerLocations(customerId);
  const [adding, setAdding] = useState(false);
  return (
    <Card
      title="Locations"
      actions={
        can("isp_partner.create") && (
          <MButton onClick={() => setAdding(true)}>
            <Plus /> Add location
          </MButton>
        )
      }
    >
      {q.error && !q.data ? (
        <ErrorBlock error={q.error} onRetry={() => q.refetch()} what="locations" />
      ) : q.data && q.data.items.length === 0 ? (
        <MEmptyState
          icon={MapPin}
          title="No locations yet"
          description="Add the venue where this customer's guest WiFi runs."
        />
      ) : (
        <MTable
          loading={q.isLoading}
          head={
            <>
              <MTh>Location</MTh>
              <MTh>City</MTh>
              <MTh>Status</MTh>
              <MTh className="text-right">Routers online</MTh>
              <MTh>TR-069</MTh>
            </>
          }
        >
          {q.data?.items.map((l) => (
            <MTr
              key={l.id}
              onClick={() =>
                navigate({
                  to: "/partner/locations/$ispLocationId",
                  params: { ispLocationId: l.id },
                })
              }
            >
              <MTd>
                <Link
                  to="/partner/locations/$ispLocationId"
                  params={{ ispLocationId: l.id }}
                  className="font-medium hover:text-primary"
                >
                  {l.name}
                </Link>
              </MTd>
              <MTd className="text-xs">{l.city ?? "–"}</MTd>
              <MTd>
                <MTag label={l.status} />
              </MTd>
              <MTd className="text-right tabular-nums">
                {l.routers.online} / {l.routers.total}
              </MTd>
              <MTd className="text-xs">{l.tr069_enabled ? "On" : "Off"}</MTd>
            </MTr>
          ))}
        </MTable>
      )}
      <LocationFormDrawer
        open={adding}
        onClose={() => setAdding(false)}
        customerId={customerId}
        location={null}
        onSaved={(l) =>
          navigate({ to: "/partner/locations/$ispLocationId", params: { ispLocationId: l.id } })
        }
      />
    </Card>
  );
}

function PortalTab({ customerId }: { customerId: string }) {
  const q = useIspCustomerLocations(customerId);
  const [picked, setPicked] = useState("");
  if (q.isLoading) return <LoadingBlock />;
  if (q.error || !q.data)
    return <ErrorBlock error={q.error} onRetry={() => q.refetch()} what="locations" />;
  const items = q.data.items;
  if (items.length === 0)
    return (
      <MEmptyState
        icon={MapPin}
        title="No locations yet"
        description="Each location has its own captive portal."
      />
    );
  const locationId = picked || items[0].id;
  return (
    <div className="space-y-3">
      {items.length > 1 && (
        <select
          className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
          value={locationId}
          onChange={(e) => setPicked(e.target.value)}
          aria-label="Location"
        >
          {items.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      )}
      <PortalEditor key={locationId} locationId={locationId} />
    </div>
  );
}

function CustomerLogsTab({ customerId }: { customerId: string }) {
  const [filters, setFilters] = useState<LogFilters>({
    ...DEFAULT_LOG_FILTERS,
    customer: customerId,
  });
  return <LogsView filters={filters} onChange={setFilters} fixedCustomerId={customerId} />;
}

export function CustomerDetailPage({
  customerId,
  tab,
  onTab,
}: {
  customerId: string;
  tab: CustomerTab;
  onTab: (t: CustomerTab) => void;
}) {
  const { can } = usePartner();
  const q = useIspCustomer(customerId);
  const [editing, setEditing] = useState(false);
  const [suspending, setSuspending] = useState(false);

  if (q.isLoading) return <LoadingBlock />;
  if (q.error || !q.data)
    return <ErrorBlock error={q.error} onRetry={() => q.refetch()} what="this customer" />;
  const c = q.data;

  const visible = CUSTOMER_TABS.filter((t) => {
    if (t === "logs") return can("isp_logs.read") || can("isp_ipdr.read");
    if (t === "tr069") return can("tr069.read");
    return true;
  });
  const active = visible.includes(tab) ? tab : "overview";

  return (
    <>
      <p className="text-xs">
        <Link to="/partner/customers" className="text-primary hover:underline">
          ← Customers
        </Link>
      </p>
      <MSectionHeader
        eyebrow={c.external_ref ? `Account ${c.external_ref}` : "Customer"}
        title={c.name}
        description={c.contact_email}
        actions={
          <>
            <MTag label={c.status} />
            {can("isp_partner.update") && (
              <MButton variant="outline" onClick={() => setEditing(true)}>
                <Pencil /> Edit
              </MButton>
            )}
            {can("isp_partner.manage") && (
              <MButton variant="outline" onClick={() => setSuspending(true)}>
                {c.status === "suspended" ? "Reactivate" : "Suspend"}
              </MButton>
            )}
          </>
        }
      />
      <div className="-mx-1 overflow-x-auto">
        <div className="flex min-w-max gap-1 border-b border-border px-1" role="tablist">
          {visible.map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={active === t}
              onClick={() => onTab(t)}
              className={cn(
                "-mb-px border-b-2 px-3 py-2 text-xs font-medium",
                active === t
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {TAB_LABEL[t]}
            </button>
          ))}
        </div>
      </div>

      {active === "overview" && <OverviewTab c={c} />}
      {active === "locations" && <LocationsTab customerId={customerId} />}
      {active === "routers" && (
        <RoutersTable
          customerId={customerId}
          emptyHint="Add routers from one of this customer's locations."
        />
      )}
      {active === "portal" && <PortalTab customerId={customerId} />}
      {active === "guests" && <GuestsSessionsTab customerId={customerId} />}
      {active === "logs" && <CustomerLogsTab customerId={customerId} />}
      {active === "tr069" && (
        <CustomerTr069Tab customerId={customerId} suspended={c.status === "suspended"} />
      )}
      {active === "reports" && <ReportsView fixedCustomerId={customerId} />}

      <CustomerFormDrawer open={editing} onClose={() => setEditing(false)} customer={c} />
      <SuspendCustomerDialog customer={c} open={suspending} onClose={() => setSuspending(false)} />
    </>
  );
}
