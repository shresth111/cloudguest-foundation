/** `/partner/customers` (PRD §4.3): search, status filter, create. */
import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Building2, Plus, Search } from "lucide-react";
import {
  MButton,
  MEmptyState,
  MSectionHeader,
  MSeg,
  MTable,
  MTag,
  MTd,
  MTh,
  MTr,
  M_INPUT,
} from "@/components/master/MasterKit";
import { ErrorBlock, Pager } from "@/components/isp-partner/kit";
import { CustomerFormDrawer } from "@/components/isp-partner/customers/CustomerFormDrawer";
import { usePartner } from "@/components/isp-partner/PartnerContext";
import { useIspCustomers } from "@/hooks/isp-partner/useIsp";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

type StatusFilter = "all" | "active" | "suspended";

export function CustomersPage() {
  const { can } = usePartner();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const debounced = useDebouncedValue(search.trim(), 300);
  const q = useIspCustomers({
    page,
    page_size: 25,
    search: debounced || undefined,
    status: status === "all" ? undefined : status,
  });
  const data = q.data;
  const filtered = !!debounced || status !== "all";

  return (
    <>
      <MSectionHeader
        eyebrow="Customers"
        title="Customers"
        description="The businesses you provide WiFi to. Everything for a customer is managed from here; customers have no login of their own."
        actions={
          can("isp_partner.create") && (
            <MButton onClick={() => setCreating(true)}>
              <Plus /> Add customer
            </MButton>
          )
        }
      />
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            className={`${M_INPUT} pl-8`}
            placeholder="Search name, slug or account no."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <MSeg<StatusFilter>
          value={status}
          onChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
          options={[
            { value: "all", label: "All" },
            { value: "active", label: "Active" },
            { value: "suspended", label: "Suspended" },
          ]}
        />
      </div>

      {q.error && !data ? (
        <ErrorBlock error={q.error} onRetry={() => q.refetch()} what="customers" />
      ) : data && data.items.length === 0 ? (
        <MEmptyState
          icon={Building2}
          title={filtered ? "No customer matches" : "No customers yet"}
          description={
            filtered
              ? "Try another search or status."
              : "Add a customer, then its locations and routers."
          }
        />
      ) : (
        <>
          <MTable
            loading={q.isLoading}
            head={
              <>
                <MTh>Customer</MTh>
                <MTh>Account no.</MTh>
                <MTh>Status</MTh>
                <MTh className="text-right">Locations</MTh>
                <MTh className="text-right">Routers online</MTh>
                <MTh className="text-right">CPEs</MTh>
                <MTh>TR-069</MTh>
              </>
            }
          >
            {data?.items.map((c) => (
              <MTr
                key={c.id}
                onClick={() =>
                  navigate({
                    to: "/partner/customers/$ispCustomerId",
                    params: { ispCustomerId: c.id },
                  })
                }
              >
                <MTd>
                  <Link
                    to="/partner/customers/$ispCustomerId"
                    params={{ ispCustomerId: c.id }}
                    className="font-medium text-foreground hover:text-primary"
                  >
                    {c.name}
                  </Link>
                  <p className="text-xs text-muted-foreground">{c.city ?? c.contact_email}</p>
                </MTd>
                <MTd className="text-xs">{c.external_ref ?? "–"}</MTd>
                <MTd>
                  <MTag label={c.status} />
                </MTd>
                <MTd className="text-right tabular-nums">{c.counts.locations}</MTd>
                <MTd className="text-right tabular-nums">
                  {c.counts.routers_online} / {c.counts.routers_total}
                </MTd>
                <MTd className="text-right tabular-nums">{c.counts.cpes}</MTd>
                <MTd>
                  <MTag
                    label={c.tr069_enabled ? "On" : "Off"}
                    tone={c.tr069_enabled ? "active" : "normal"}
                  />
                </MTd>
              </MTr>
            ))}
          </MTable>
          {data && (
            <Pager page={data.page} pages={data.pages} total={data.total} onPage={setPage} />
          )}
        </>
      )}

      <CustomerFormDrawer
        open={creating}
        onClose={() => setCreating(false)}
        customer={null}
        onSaved={(c) =>
          navigate({ to: "/partner/customers/$ispCustomerId", params: { ispCustomerId: c.id } })
        }
      />
    </>
  );
}
