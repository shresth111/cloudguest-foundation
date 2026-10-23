import { useCallback, useEffect, useMemo, useState } from "react";
import { Network, Plus, Search, CheckCircle2, PauseCircle, Building2 } from "lucide-react";
import { toast } from "sonner";
import { MasterShell } from "@/components/master/MasterShell";
import {
  MButton,
  MPageShell,
  MSectionHeader,
  MSeg,
  MStat,
  MTable,
  MTag,
  MTd,
  MTh,
  MTr,
  M_INPUT,
} from "@/components/master/MasterKit";
import { CreateIspPartnerDrawer } from "@/components/master/isp-partners/CreateIspPartnerDrawer";
import { IspPartnerDetailDrawer } from "@/components/master/isp-partners/IspPartnerDetailDrawer";
import { useAuth } from "@/context/AuthContext";
import { requestErrorOf } from "@/services/api";
import {
  ispPartnerPlatformService,
  type IspPartner,
  type IspPartnerStatus,
} from "@/services/isp-partner/platform";

type Filter = "all" | IspPartnerStatus;

/**
 * Master: ISP partners (TASKS FS-2, PRD §4.1). Its own page with its own
 * "Create ISP partner" button; the Customers page and the Add Customer /
 * Smart Provisioning wizard are untouched. Every number comes from
 * `/platform/isp-partners` (no fixtures).
 */
export function IspPartnersPage() {
  const { can } = useAuth();
  // Backend pins every route to GLOBAL scope; these only hide buttons.
  const canCreate = can("organizations.create");
  const canUpdate = can("organizations.update");
  const canManage = can("organizations.manage");

  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<IspPartner[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setQuery(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const page = await ispPartnerPlatformService.list({
        page: 1,
        pageSize: 100,
        status: filter === "all" ? undefined : filter,
        search: query,
      });
      setItems(page.items);
      setTotal(page.total);
    } catch (err) {
      const msg = requestErrorOf(err)?.message ?? "Could not load ISP partners.";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [filter, query]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const stats = useMemo(
    () => ({
      active: items.filter((p) => p.status === "active").length,
      suspended: items.filter((p) => p.status === "suspended").length,
      customers: items.reduce((n, p) => n + p.counts.customers, 0),
    }),
    [items],
  );

  function upsert(p: IspPartner) {
    setItems((prev) => {
      const i = prev.findIndex((x) => x.id === p.id);
      if (i === -1) return [p, ...prev];
      const next = prev.slice();
      next[i] = { ...prev[i], ...p };
      return next;
    });
  }

  return (
    <MasterShell title="ISP Partners">
      <MPageShell>
        <MSectionHeader
          eyebrow="Growth"
          title="ISP Partners"
          description="ISPs that run their own customers on Wyfy Guest from the network dashboard."
          actions={
            canCreate && (
              <MButton onClick={() => setCreateOpen(true)}>
                <Plus /> Create ISP partner
              </MButton>
            )
          }
        />

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <MStat label="ISP partners" value={String(total)} icon={Network} />
          <MStat label="Active (shown)" value={String(stats.active)} icon={CheckCircle2} />
          <MStat
            label="Suspended (shown)"
            value={String(stats.suspended)}
            icon={PauseCircle}
            accent={stats.suspended > 0}
          />
          <MStat label="Their customers (shown)" value={String(stats.customers)} icon={Building2} />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <MSeg<Filter>
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: "All" },
              { value: "active", label: "Active" },
              { value: "suspended", label: "Suspended" },
            ]}
          />
          <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              className={`${M_INPUT} pl-9`}
              placeholder="Search name or slug"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {error && !loading && <p className="text-sm text-destructive">{error}</p>}

        <MTable
          loading={loading}
          head={
            <>
              <MTh>ISP</MTh>
              <MTh>Status</MTh>
              <MTh>Customers</MTh>
              <MTh>Routers online</MTh>
              <MTh>CPEs online</MTh>
              <MTh>Users</MTh>
              <MTh>Customer plan</MTh>
              <MTh>Created</MTh>
            </>
          }
        >
          {items.length === 0 ? (
            <tr>
              <td colSpan={8} className="px-4 py-10 text-center text-sm text-muted-foreground">
                {query || filter !== "all"
                  ? "No ISP partner matches."
                  : "No ISP partners yet. Create the first one."}
              </td>
            </tr>
          ) : (
            items.map((p) => (
              <MTr key={p.id} onClick={() => setSelectedId(p.id)}>
                <MTd>
                  <div className="font-medium">{p.name}</div>
                  <div className="text-xs text-muted-foreground">{p.slug}</div>
                </MTd>
                <MTd>
                  <MTag
                    label={p.status === "active" ? "Active" : "Suspended"}
                    tone={p.status === "active" ? "active" : "suspended"}
                  />
                </MTd>
                <MTd>
                  {p.counts.customers}
                  {p.maxCustomers != null && (
                    <span className="text-xs text-muted-foreground"> / {p.maxCustomers}</span>
                  )}
                </MTd>
                <MTd>
                  {p.counts.routersOnline} / {p.counts.routersTotal}
                </MTd>
                <MTd>
                  {p.counts.cpesOnline} / {p.counts.cpesTotal}
                </MTd>
                <MTd>{p.counts.users}</MTd>
                <MTd>{p.defaultCustomerPlan?.name ?? "-"}</MTd>
                <MTd className="text-xs text-muted-foreground">
                  {new Date(p.createdAt).toLocaleDateString()}
                </MTd>
              </MTr>
            ))
          )}
        </MTable>
      </MPageShell>

      <CreateIspPartnerDrawer
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(p) => {
          upsert(p);
          setTotal((t) => t + 1);
        }}
      />
      <IspPartnerDetailDrawer
        partnerId={selectedId}
        canUpdate={canUpdate}
        canManage={canManage}
        onClose={() => setSelectedId(null)}
        onChanged={upsert}
      />
    </MasterShell>
  );
}
