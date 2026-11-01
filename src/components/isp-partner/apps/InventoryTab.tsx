/** Apps -> Inventory: the item catalogue (with per-state counts), units
 * (serials) with filters, add / move a unit (only the moves the backend
 * allows), a unit's history, CSV import (serial, sku, mac, note; 512 KB,
 * 2000 rows) with a per-line error report, and CSV export. */
import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Boxes, FileUp, Plus } from "lucide-react";
import {
  MButton,
  MDialog,
  MEmptyState,
  MSeg,
  MTable,
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
  Pager,
  Spinner,
  TextField,
} from "@/components/isp-partner/kit";
import { usePartner } from "@/components/isp-partner/PartnerContext";
import {
  CsvButton,
  Select,
  StatusTag,
  appsKeys,
  useAppsMutation,
} from "@/components/isp-partner/apps/appsKit";
import { useIspCustomerOptions } from "@/hooks/isp-partner/useIsp";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { saveBlob } from "@/lib/isp-partner/download";
import { ispErrorMessage } from "@/lib/isp-partner/errors";
import { formatDateTime } from "@/lib/isp-partner/format";
import {
  UNIT_CSV_TEMPLATE,
  UNIT_STATE_LABEL,
  appsCan,
  checkoutRoute,
  humanize,
  importProblem,
  unitNext,
} from "@/lib/isp-partner/apps";
import {
  CheckoutsCard,
  LocationsCard,
  VendorsCard,
} from "@/components/isp-partner/apps/InventoryAdmin";
import { tr069Service } from "@/services/isp-partner/tr069";
import { appsService } from "@/services/isp-partner/apps";
import {
  ITEM_CATEGORIES,
  UNIT_STATES,
  type ImportResult,
  type InventoryItem,
  type InventoryUnit,
  type UnitQuery,
} from "@/services/isp-partner/apps-types";

type View = "units" | "items" | "checkouts" | "vendors" | "locations";

export function InventoryTab() {
  const { can } = usePartner();
  const c = appsCan(can);
  const [view, setView] = useState<View>("units");
  const items = useQuery({
    queryKey: appsKeys.list("items"),
    queryFn: () => appsService.items(),
    retry: false,
  });
  return (
    <div className="space-y-3">
      <MSeg<View>
        value={view}
        onChange={setView}
        options={[
          { value: "units", label: "Units" },
          { value: "items", label: "Items" },
          { value: "checkouts", label: "Checkout requests" },
          { value: "vendors", label: "Vendors" },
          { value: "locations", label: "Stock locations" },
        ]}
      />
      {view === "units" && <Units items={items.data ?? []} />}
      {view === "items" && <Items items={items.data} error={items.error} />}
      {view === "checkouts" && <CheckoutsCard canDecide={c.manage} />}
      {view === "vendors" && <VendorsCard canManage={c.manage} />}
      {view === "locations" && <LocationsCard canManage={c.manage} />}
    </div>
  );
}

function Units({ items }: { items: InventoryItem[] }) {
  const { can } = usePartner();
  const c = appsCan(can);
  const [itemId, setItemId] = useState("");
  const [state, setState] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState<InventoryUnit | null>(null);
  const [importing, setImporting] = useState(false);
  const debounced = useDebouncedValue(search.trim(), 300);
  const q: UnitQuery = {
    item_id: itemId || undefined,
    state: (state || undefined) as UnitQuery["state"],
    search: debounced || undefined,
    page,
    page_size: 50,
  };
  const list = useQuery({
    queryKey: appsKeys.list("units", q),
    queryFn: () => appsService.units(q),
    retry: false,
  });
  const reset =
    <T,>(fn: (v: T) => void) =>
    (v: T) => {
      fn(v);
      setPage(1);
    };
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Select
          className="w-auto"
          ariaLabel="Item"
          value={itemId}
          onChange={reset(setItemId)}
          options={[
            ["", "Any item"],
            ...items.map((i) => [i.id, `${i.name} (${i.sku})`] as [string, string]),
          ]}
        />
        <Select
          className="w-auto"
          ariaLabel="State"
          value={state}
          onChange={reset(setState)}
          options={[
            ["", "Any state"],
            ...UNIT_STATES.map((s) => [s, UNIT_STATE_LABEL[s]] as [string, string]),
          ]}
        />
        <input
          className={`${M_INPUT} w-52`}
          placeholder="Serial or MAC"
          value={search}
          onChange={(e) => reset(setSearch)(e.target.value)}
          aria-label="Search units"
        />
        <div className="ml-auto flex gap-2">
          {c.export && <CsvButton run={() => appsService.unitsCsv(q)} />}
          {c.create && (
            <>
              <MButton variant="outline" onClick={() => setImporting(true)}>
                <FileUp /> Import CSV
              </MButton>
              <MButton
                disabled={items.length === 0}
                title={items.length === 0 ? "Add an item first" : undefined}
                onClick={() => setAdding(true)}
              >
                <Plus /> Add unit
              </MButton>
            </>
          )}
        </div>
      </div>
      {list.error && !list.data ? (
        <ErrorBlock error={list.error} onRetry={() => list.refetch()} what="units" />
      ) : list.data && list.data.items.length === 0 ? (
        <MEmptyState
          icon={Boxes}
          title="No units here"
          description="Add units one by one or import a CSV."
        />
      ) : (
        <>
          <MTable
            loading={list.isLoading}
            head={
              <>
                <MTh>Serial</MTh>
                <MTh>Item</MTh>
                <MTh>State</MTh>
                <MTh>With</MTh>
                <MTh />
              </>
            }
          >
            {(list.data?.items ?? []).map((u) => (
              <MTr key={u.id}>
                <MTd className="font-mono text-xs">
                  {u.serial}
                  {u.mac && <p className="text-muted-foreground">{u.mac}</p>}
                </MTd>
                <MTd className="text-xs">
                  {u.item_name} <span className="text-muted-foreground">({u.sku})</span>
                </MTd>
                <MTd>
                  <StatusTag map={UNIT_STATE_LABEL} value={u.state} />
                </MTd>
                <MTd className="text-xs">{u.customer_name ?? "–"}</MTd>
                <MTd className="text-right">
                  <MButton variant="ghost" onClick={() => setOpen(u)}>
                    {c.update && unitNext(u.state).length > 0 ? "Move" : "History"}
                  </MButton>
                </MTd>
              </MTr>
            ))}
          </MTable>
          {list.data && list.data.pages > 1 && (
            <Pager
              page={list.data.page}
              pages={list.data.pages}
              total={list.data.total}
              onPage={setPage}
            />
          )}
        </>
      )}
      {adding && <AddUnitDialog items={items} onClose={() => setAdding(false)} />}
      {open && (
        <UnitDialog
          unit={open}
          canMove={c.update}
          canApprove={c.manage}
          onClose={() => setOpen(null)}
        />
      )}
      {importing && <ImportDialog onClose={() => setImporting(false)} />}
    </div>
  );
}

function AddUnitDialog({ items, onClose }: { items: InventoryItem[]; onClose: () => void }) {
  const [f, setF] = useState({ item_id: items[0]?.id ?? "", serial: "", mac: "", note: "" });
  const [err, setErr] = useState<string | null>(null);
  const add = useAppsMutation(() =>
    appsService.addUnit({
      item_id: f.item_id,
      serial: f.serial.trim(),
      mac: f.mac.trim() || null,
      note: f.note.trim() || null,
    }),
  );
  return (
    <MDialog
      open
      onClose={onClose}
      title="Add a unit"
      footer={
        <>
          <MButton variant="outline" onClick={onClose}>
            Cancel
          </MButton>
          <MButton
            disabled={add.isPending}
            onClick={async () => {
              setErr(null);
              if (!f.serial.trim()) return setErr("Type the serial.");
              try {
                await add.mutateAsync(undefined);
                toast.success("Unit added to stock.");
                onClose();
              } catch (e) {
                setErr(ispErrorMessage(e));
              }
            }}
          >
            {add.isPending && <Spinner />} Add
          </MButton>
        </>
      }
    >
      <div className="grid gap-3 text-sm sm:grid-cols-2">
        <Select
          ariaLabel="Item"
          value={f.item_id}
          onChange={(v) => setF({ ...f, item_id: v })}
          options={items.map((i) => [i.id, `${i.name} (${i.sku})`] as [string, string])}
        />
        <TextField
          label="Serial"
          required
          value={f.serial}
          onChange={(v) => setF({ ...f, serial: v })}
        />
        <TextField label="MAC (optional)" value={f.mac} onChange={(v) => setF({ ...f, mac: v })} />
        <TextField
          label="Note (optional)"
          value={f.note}
          onChange={(v) => setF({ ...f, note: v })}
        />
      </div>
      <FormError message={err} />
    </MDialog>
  );
}

function UnitDialog({
  unit,
  canMove,
  canApprove,
  onClose,
}: {
  unit: InventoryUnit;
  canMove: boolean;
  canApprove: boolean;
  onClose: () => void;
}) {
  const customers = useIspCustomerOptions();
  const detail = useQuery({
    queryKey: appsKeys.one("unit", unit.id),
    queryFn: () => appsService.unit(unit.id),
    retry: false,
  });
  const next = unitNext(unit.state);
  const [target, setTarget] = useState(next[0] ?? "");
  const [customer, setCustomer] = useState(unit.isp_customer_id ?? "");
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);
  // APPS-2: checking out to a customer needs approval unless you approve
  const viaRequest = target === "assigned" && checkoutRoute(canApprove) === "request";
  const move = useAppsMutation(
    (): Promise<unknown> =>
      viaRequest
        ? appsService.requestCheckout(unit.id, {
            isp_customer_id: customer,
            note: note.trim() || null,
          })
        : appsService.moveUnit(unit.id, {
            state: target,
            isp_customer_id: target === "assigned" ? customer || null : null,
            note: note.trim() || null,
          }),
  );
  return (
    <MDialog
      open
      onClose={onClose}
      title={`${unit.serial} · ${unit.item_name}`}
      footer={
        <MButton variant="outline" onClick={onClose}>
          Close
        </MButton>
      }
    >
      <div className="space-y-3 text-sm">
        {unit.pending_checkout_id && (
          <p className="text-xs text-amber-700 dark:text-amber-400">
            A checkout request is waiting for approval.
          </p>
        )}
        {canMove && next.length > 0 && !unit.pending_checkout_id && (
          <div className="space-y-2 rounded-lg border border-border p-3">
            <Select
              ariaLabel="Move to"
              value={target}
              onChange={setTarget}
              options={next.map((s) => [s, UNIT_STATE_LABEL[s] ?? humanize(s)] as [string, string])}
            />
            {target === "assigned" && (
              <CustomerSelect
                value={customer}
                onChange={setCustomer}
                customers={customers.data}
                allLabel={null}
              />
            )}
            <TextField label="Note (optional)" value={note} onChange={setNote} />
            <MButton
              disabled={move.isPending || !target}
              onClick={async () => {
                setErr(null);
                if (target === "assigned" && !customer)
                  return setErr("Pick the customer it goes to.");
                try {
                  await move.mutateAsync(undefined);
                  toast.success(
                    viaRequest ? "Checkout requested; a manager approves it." : "Moved.",
                  );
                  onClose();
                } catch (e) {
                  setErr(ispErrorMessage(e));
                }
              }}
            >
              {move.isPending && <Spinner />} {viaRequest ? "Request checkout" : "Move"}
            </MButton>
            <FormError message={err} />
          </div>
        )}
        {canMove && <UnitLinks unit={unit} />}
        <h4 className="text-xs font-semibold">History</h4>
        {detail.error ? (
          <ErrorBlock error={detail.error} what="the history" />
        ) : !detail.data ? (
          <Spinner />
        ) : (
          <ol className="space-y-1 text-xs">
            {detail.data.history.map((h, i) => (
              <li key={i}>
                <span className="text-muted-foreground">{formatDateTime(h.at)}</span> ·{" "}
                {h.from_state ? `${UNIT_STATE_LABEL[h.from_state] ?? h.from_state} → ` : ""}
                {UNIT_STATE_LABEL[h.to_state] ?? h.to_state}
                {h.note ? ` · ${h.note}` : ""}
              </li>
            ))}
          </ol>
        )}
      </div>
    </MDialog>
  );
}

function ImportDialog({ onClose }: { onClose: () => void }) {
  const file = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const run = useAppsMutation((f: File) => appsService.importUnits(f));
  return (
    <MDialog
      open
      onClose={onClose}
      title="Import units from CSV"
      footer={
        <MButton variant="outline" onClick={onClose}>
          Close
        </MButton>
      }
    >
      <div className="space-y-3 text-sm">
        <p className="text-xs text-muted-foreground">
          Columns <code>serial</code> and <code>sku</code> are required; <code>mac</code> and{" "}
          <code>note</code> are optional. The SKU must match an item. UTF-8, up to 512 KB and 2000
          rows.
        </p>
        <div className="flex gap-2">
          <MButton
            variant="outline"
            onClick={() =>
              saveBlob(new Blob([UNIT_CSV_TEMPLATE], { type: "text/csv" }), "units-template.csv")
            }
          >
            Template
          </MButton>
          <input
            ref={file}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              const bad = importProblem(f);
              if (bad) return setErr(bad);
              setErr(null);
              setResult(null);
              try {
                setResult(await run.mutateAsync(f));
              } catch (x) {
                setErr(ispErrorMessage(x));
              }
            }}
          />
          <MButton disabled={run.isPending} onClick={() => file.current?.click()}>
            {run.isPending ? <Spinner /> : <FileUp />} Choose CSV
          </MButton>
        </div>
        {result && (
          <div className="space-y-1">
            <p>
              <b>{result.created}</b> added, <b>{result.skipped}</b> skipped.
            </p>
            {result.errors.length > 0 && (
              <ul className="max-h-48 space-y-0.5 overflow-y-auto text-xs text-destructive">
                {result.errors.map((x, i) => (
                  <li key={i}>
                    Line {x.line}
                    {x.serial ? ` (${x.serial})` : ""}: {x.error}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        <FormError message={err} />
      </div>
    </MDialog>
  );
}

function Items({ items, error }: { items: InventoryItem[] | undefined; error: unknown }) {
  const { can } = usePartner();
  const c = appsCan(can);
  const [f, setF] = useState({ name: "", sku: "", category: "ont" });
  const [err, setErr] = useState<string | null>(null);
  const create = useAppsMutation(() =>
    appsService.createItem({ name: f.name.trim(), sku: f.sku.trim(), category: f.category }),
  );
  if (error) return <ErrorBlock error={error} what="items" />;
  return (
    <Card title="Items">
      <MTable
        loading={!items}
        head={
          <>
            <MTh>Item</MTh>
            <MTh>Category</MTh>
            {UNIT_STATES.map((s) => (
              <MTh key={s} className="text-right">
                {UNIT_STATE_LABEL[s]}
              </MTh>
            ))}
          </>
        }
      >
        {(items ?? []).map((i) => (
          <MTr key={i.id}>
            <MTd>
              {i.name} <span className="font-mono text-[11px] text-muted-foreground">{i.sku}</span>
            </MTd>
            <MTd className="text-xs">{humanize(i.category)}</MTd>
            {UNIT_STATES.map((s) => (
              <MTd key={s} className="text-right text-xs tabular-nums">
                {i.counts?.[s] ?? 0}
              </MTd>
            ))}
          </MTr>
        ))}
      </MTable>
      {c.manage && (
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <input
            className={`${M_INPUT} w-48`}
            placeholder="Name, e.g. GPON ONT"
            value={f.name}
            onChange={(e) => setF({ ...f, name: e.target.value })}
            aria-label="Item name"
          />
          <input
            className={`${M_INPUT} w-32`}
            placeholder="SKU"
            value={f.sku}
            onChange={(e) => setF({ ...f, sku: e.target.value })}
            aria-label="SKU"
          />
          <Select
            className="w-auto"
            ariaLabel="Category"
            value={f.category}
            onChange={(v) => setF({ ...f, category: v })}
            options={ITEM_CATEGORIES.map((k) => [k, humanize(k)] as [string, string])}
          />
          <MButton
            disabled={create.isPending || !f.name.trim() || !f.sku.trim()}
            onClick={async () => {
              setErr(null);
              try {
                await create.mutateAsync(undefined);
                setF({ name: "", sku: "", category: f.category });
                toast.success("Item added.");
              } catch (e) {
                setErr(ispErrorMessage(e));
              }
            }}
          >
            {create.isPending && <Spinner />} Add item
          </MButton>
        </div>
      )}
      <FormError message={err} />
    </Card>
  );
}

/** APPS-2: where the unit came from, where it sits, which TR-069 device it
 * is. Saved separately from moves. */
function UnitLinks({ unit }: { unit: InventoryUnit }) {
  const vendors = useQuery({
    queryKey: appsKeys.list("vendors"),
    queryFn: () => appsService.vendors(),
    retry: false,
  });
  const locations = useQuery({
    queryKey: appsKeys.list("stock-locations"),
    queryFn: () => appsService.locations(),
    retry: false,
  });
  const devices = useQuery({
    queryKey: ["isp", "apps", "tr069-for-unit", unit.isp_customer_id ?? ""],
    queryFn: () =>
      tr069Service.listDevices({
        isp_customer_id: unit.isp_customer_id ?? undefined,
        page: 1,
        page_size: 100,
      }),
    retry: false,
    staleTime: 60_000,
  });
  const [vendor, setVendor] = useState(unit.vendor_id ?? "");
  const [loc, setLoc] = useState(unit.location_id ?? "");
  const [dev, setDev] = useState(unit.tr069_device_id ?? "");
  const [err, setErr] = useState<string | null>(null);
  const save = useAppsMutation(() =>
    appsService.putUnitMeta(unit.id, {
      vendor_id: vendor || null,
      stock_location_id: loc || null,
      tr069_device_id: dev || null,
    }),
  );
  return (
    <div className="space-y-2 rounded-lg border border-border p-3">
      <h4 className="text-xs font-semibold">Links</h4>
      <div className="grid gap-2 sm:grid-cols-3">
        <Select
          ariaLabel="Vendor"
          value={vendor}
          onChange={setVendor}
          options={[
            ["", "No vendor"],
            ...(vendors.data ?? []).map((v) => [v.id, v.name] as [string, string]),
          ]}
        />
        <Select
          ariaLabel="Stock location"
          value={loc}
          onChange={setLoc}
          options={[
            ["", "No location"],
            ...(locations.data ?? []).map((l) => [l.id, l.name] as [string, string]),
          ]}
        />
        <Select
          ariaLabel="TR-069 device"
          value={dev}
          onChange={setDev}
          options={[
            ["", "No TR-069 device"],
            ...(devices.data?.items ?? []).map(
              (d) => [d.id, d.serial_number || d.label || d.genieacs_device_id] as [string, string],
            ),
          ]}
        />
      </div>
      <MButton
        variant="outline"
        disabled={save.isPending}
        onClick={async () => {
          setErr(null);
          try {
            await save.mutateAsync(undefined);
            toast.success("Saved.");
          } catch (e) {
            setErr(ispErrorMessage(e));
          }
        }}
      >
        {save.isPending && <Spinner />} Save links
      </MButton>
      <FormError message={err} />
    </div>
  );
}
