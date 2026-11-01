/**
 * Finance tools → Zones → Revenue share (FRANCHISE-2, ADDENDUM_06). Sits
 * under JAZE-4's zone ledger (top-up / reduce / credit limit stay there):
 * PAID/UNPAID per zone, the share plan (percent split or wholesale per
 * renewal) that drives renewal auto-debit, the revenue drill-down,
 * recurring monthly charges and settlements (PDF). Zones never get logins.
 * Renders nothing while ISP_FRANCHISE_ENABLED is off (404).
 */
import { useState } from "react";
import { toast } from "sonner";
import { Download, Play, Plus } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  MButton,
  MDialog,
  MSeg,
  MTable,
  MTag,
  MTd,
  MTh,
  MTr,
  M_INPUT,
} from "@/components/master/MasterKit";
import {
  Card,
  ErrorBlock,
  FormError,
  LoadingBlock,
  Spinner,
  TextField,
} from "@/components/isp-partner/kit";
import { usePartner } from "@/components/isp-partner/PartnerContext";
import { retryUnless4xx } from "@/hooks/isp-partner/useIsp";
import { ispErrorMessage, ispErrorStatus } from "@/lib/isp-partner/errors";
import { saveBlob } from "@/lib/isp-partner/download";
import { isoDay } from "@/lib/isp-partner/format";
import { formatRupees, paiseToInput, parseRupeesToPaise } from "@/lib/isp-partner/money";
import { chargeDayError, previewIspShare, rangeError } from "@/lib/isp-partner/franchise";
import {
  franchiseService,
  type Settlement,
  type ZoneWallet,
} from "@/services/isp-partner/franchise";
import { billingService } from "@/services/isp-partner/billing";

const fk = (...k: unknown[]) => ["isp", "franchise", ...k] as const;

function monthRange(): [string, string] {
  const d = new Date();
  return [isoDay(new Date(d.getFullYear(), d.getMonth(), 1)), isoDay(d)];
}

function ShareDialog({ z, onClose }: { z: ZoneWallet; onClose: () => void }) {
  const qc = useQueryClient();
  const [mode, setMode] = useState<"percent" | "wholesale">(z.share_plan?.mode ?? "percent");
  const [rate, setRate] = useState(paiseToInput(z.share_plan?.wholesale_paise ?? 0));
  const [auto, setAuto] = useState(z.share_plan?.auto_debit ?? true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const wholesale = parseRupeesToPaise(rate || "0");
  return (
    <MDialog
      open
      onClose={onClose}
      title={`Revenue share · ${z.name}`}
      footer={
        <>
          <MButton variant="outline" onClick={onClose}>
            Cancel
          </MButton>
          <MButton
            disabled={busy}
            onClick={async () => {
              if (mode === "wholesale" && !wholesale)
                return setError("A rupee rate per renewal, like 300.");
              setBusy(true);
              setError(null);
              try {
                await franchiseService.saveShare(z.zone_id, {
                  mode,
                  wholesale_paise: mode === "wholesale" ? (wholesale ?? 0) : 0,
                  auto_debit: auto,
                });
                await qc.invalidateQueries({ queryKey: fk() });
                toast.success("Revenue share saved.");
                onClose();
              } catch (e) {
                setError(ispErrorMessage(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy && <Spinner />} Save
          </MButton>
        </>
      }
    >
      <div className="space-y-3 text-sm">
        <MSeg<"percent" | "wholesale">
          value={mode}
          onChange={setMode}
          options={[
            { value: "percent", label: "Percent split" },
            { value: "wholesale", label: "Wholesale rate" },
          ]}
        />
        {mode === "percent" ? (
          <p className="text-xs text-muted-foreground">
            The zone keeps {z.revenue_share_bp / 100}% of each renewal (set on the zone above); the
            ISP's {100 - z.revenue_share_bp / 100}% is taken from the zone wallet. On a ₹500
            renewal: {formatRupees(previewIspShare("percent", 50000, z.revenue_share_bp, 0))}.
          </p>
        ) : (
          <TextField
            label="ISP rate per renewal (₹)"
            value={rate}
            onChange={setRate}
            hint="Taken from the zone wallet for every renewal invoice."
          />
        )}
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} /> Take
          it from the wallet automatically on renewal
        </label>
        <FormError message={error} />
      </div>
    </MDialog>
  );
}

function RevenueDialog({ z, onClose }: { z: ZoneWallet; onClose: () => void }) {
  const [[from, to], setRange] = useState(monthRange());
  const err = rangeError(from, to);
  const q = useQuery({
    queryKey: fk("revenue", z.zone_id, from, to),
    queryFn: () => franchiseService.revenue(z.zone_id, from, to),
    retry: retryUnless4xx,
    enabled: !err,
  });
  const t = q.data?.totals ?? {};
  return (
    <MDialog open wide onClose={onClose} title={`Revenue · ${z.name}`}>
      <div className="space-y-3 text-sm">
        <div className="flex gap-2">
          <input
            type="date"
            className={`${M_INPUT} w-auto py-1`}
            aria-label="From"
            value={from}
            onChange={(e) => setRange([e.target.value, to])}
          />
          <input
            type="date"
            className={`${M_INPUT} w-auto py-1`}
            aria-label="To"
            value={to}
            onChange={(e) => setRange([from, e.target.value])}
          />
        </div>
        {err ? (
          <p className="text-xs text-destructive">{err}</p>
        ) : q.isLoading ? (
          <LoadingBlock />
        ) : q.error || !q.data ? (
          <ErrorBlock error={q.error} onRetry={() => q.refetch()} what="zone revenue" />
        ) : (
          <>
            <p className="text-xs">
              Invoiced {formatRupees(t.invoiced_paise)} · collected{" "}
              {formatRupees(t.collected_paise)} · zone share {formatRupees(t.zone_share_paise)} ·
              ISP share {formatRupees(t.isp_share_paise)} · taken from wallet{" "}
              {formatRupees(t.auto_net_paise)}
            </p>
            <MTable
              head={
                <>
                  <MTh>Invoice</MTh>
                  <MTh>Subscriber</MTh>
                  <MTh className="text-right">Total</MTh>
                  <MTh className="text-right">Zone</MTh>
                  <MTh className="text-right">ISP</MTh>
                  <MTh className="text-right">From wallet</MTh>
                </>
              }
            >
              {q.data.items.map((r) => (
                <MTr key={r.invoice_id}>
                  <MTd className="font-mono text-xs">
                    {r.number}
                    <span className="block text-muted-foreground">{r.issue_date}</span>
                  </MTd>
                  <MTd className="text-xs">{r.subscriber ?? "–"}</MTd>
                  <MTd className="text-right text-xs tabular-nums">
                    {formatRupees(r.total_paise)}
                  </MTd>
                  <MTd className="text-right text-xs tabular-nums">
                    {formatRupees(r.zone_share_paise)}
                  </MTd>
                  <MTd className="text-right text-xs tabular-nums">
                    {formatRupees(r.isp_share_paise)}
                  </MTd>
                  <MTd className="text-right text-xs tabular-nums">
                    {formatRupees(r.auto_debit_paise - r.auto_reversed_paise)}
                  </MTd>
                </MTr>
              ))}
            </MTable>
          </>
        )}
      </div>
    </MDialog>
  );
}

/** FINISH: the settlement's GST tax invoice (number, GST split, PDF), or the
 * action that issues it for a settlement from before invoicing existed. */
function SettlementInvoiceCell({
  s,
  manage,
  busy,
  onIssue,
}: {
  s: Settlement;
  manage: boolean;
  busy: boolean;
  onIssue: () => void;
}) {
  const inv = s.invoice;
  if (!inv) {
    if (s.billed_paise <= 0) return <span className="text-muted-foreground">Nothing billed</span>;
    return manage ? (
      <MButton variant="outline" disabled={busy} onClick={onIssue}>
        Issue tax invoice
      </MButton>
    ) : (
      <span className="text-muted-foreground">Not invoiced</span>
    );
  }
  const tax =
    inv.igst_paise > 0
      ? `IGST ${formatRupees(inv.igst_paise)}`
      : `CGST ${formatRupees(inv.cgst_paise)} + SGST ${formatRupees(inv.sgst_paise)}`;
  return (
    <div className="flex items-center gap-1">
      <div>
        <p className="font-mono">{inv.number}</p>
        <p className="text-[11px] text-muted-foreground">
          {tax}
          {inv.buyer_gstin ? ` · ${inv.buyer_gstin}` : " · no GSTIN (B2C)"}
        </p>
      </div>
      <MButton
        variant="ghost"
        aria-label={`Download tax invoice ${inv.number}`}
        onClick={async () => {
          try {
            const f = await billingService.invoicePdf({ id: inv.id, number: inv.number });
            saveBlob(f.blob, f.filename);
          } catch (e) {
            toast.error(ispErrorMessage(e));
          }
        }}
      >
        <Download />
      </MButton>
    </div>
  );
}

function ChargesSettlementsDialog({ z, onClose }: { z: ZoneWallet; onClose: () => void }) {
  const qc = useQueryClient();
  const { can } = usePartner();
  const manage = can("isp_zones.manage");
  const charges = useQuery({
    queryKey: fk("charges", z.zone_id),
    queryFn: () => franchiseService.charges(z.zone_id),
    retry: retryUnless4xx,
  });
  const sets = useQuery({
    queryKey: fk("settlements", z.zone_id),
    queryFn: () => franchiseService.settlements(z.zone_id),
    retry: retryUnless4xx,
  });
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [day, setDay] = useState("1");
  const [[from, to], setRange] = useState(monthRange());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const refresh = () => qc.invalidateQueries({ queryKey: fk() });
  const act = async (fn: () => Promise<unknown>, msg: string) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await refresh();
      toast.success(msg);
    } catch (e) {
      setError(ispErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <MDialog open wide onClose={onClose} title={`Charges and settlements · ${z.name}`}>
      <div className="space-y-4 text-sm">
        <div>
          <p className="mb-1 text-xs font-semibold">Monthly charges</p>
          {charges.isLoading ? (
            <Spinner />
          ) : (charges.data ?? []).length === 0 ? (
            <p className="text-xs text-muted-foreground">None.</p>
          ) : (
            <ul className="space-y-1 text-xs">
              {charges.data?.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{c.name}</span>
                  <span>
                    {formatRupees(c.amount_paise)} on day {c.day_of_month}
                  </span>
                  <span className="text-muted-foreground">last {c.last_period ?? "never"}</span>
                  <MTag label={c.active ? "On" : "Off"} tone={c.active ? "online" : undefined} />
                  {manage && (
                    <MButton
                      variant="ghost"
                      disabled={busy}
                      onClick={() =>
                        act(
                          () => franchiseService.patchCharge(c.id, { active: !c.active }),
                          "Charge saved.",
                        )
                      }
                    >
                      {c.active ? "Pause" : "Resume"}
                    </MButton>
                  )}
                </li>
              ))}
            </ul>
          )}
          {manage && (
            <div className="mt-2 flex flex-wrap items-end gap-2">
              <div className="w-40">
                <TextField label="Name" value={name} onChange={setName} />
              </div>
              <div className="w-28">
                <TextField label="Amount (₹)" value={amount} onChange={setAmount} />
              </div>
              <div className="w-20">
                <TextField label="Day" value={day} onChange={setDay} />
              </div>
              <MButton
                disabled={busy}
                onClick={() => {
                  const p = parseRupeesToPaise(amount);
                  const de = chargeDayError(Number(day));
                  if (!name.trim() || !p) return setError("Name and a rupee amount are needed.");
                  if (de) return setError(de);
                  return act(
                    () =>
                      franchiseService.addCharge(z.zone_id, {
                        name: name.trim(),
                        amount_paise: p,
                        day_of_month: Number(day),
                        starts_on: isoDay(new Date()),
                        active: true,
                      }),
                    "Charge added.",
                  ).then(() => (setName(""), setAmount("")));
                }}
              >
                <Plus /> Add
              </MButton>
            </div>
          )}
        </div>
        <div>
          <p className="mb-1 text-xs font-semibold">Settlements</p>
          {manage && (
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <input
                type="date"
                className={`${M_INPUT} w-auto py-1`}
                aria-label="From"
                value={from}
                onChange={(e) => setRange([e.target.value, to])}
              />
              <input
                type="date"
                className={`${M_INPUT} w-auto py-1`}
                aria-label="To"
                value={to}
                onChange={(e) => setRange([from, e.target.value])}
              />
              <MButton
                disabled={busy || !!rangeError(from, to)}
                onClick={() =>
                  act(
                    () => franchiseService.createSettlement(z.zone_id, from, to),
                    "Settlement issued.",
                  )
                }
              >
                Issue settlement
              </MButton>
            </div>
          )}
          {(sets.data ?? []).length === 0 ? (
            <p className="text-xs text-muted-foreground">None yet.</p>
          ) : (
            <MTable
              head={
                <>
                  <MTh>Number</MTh>
                  <MTh>Period</MTh>
                  <MTh className="text-right">ISP share billed</MTh>
                  <MTh className="text-right">Closing balance</MTh>
                  <MTh>Tax invoice</MTh>
                  <MTh className="text-right">PDF</MTh>
                </>
              }
            >
              {sets.data?.map((s) => (
                <MTr key={s.id}>
                  <MTd className="font-mono text-xs">{s.number}</MTd>
                  <MTd className="text-xs">
                    {s.period_from} – {s.period_to}
                  </MTd>
                  <MTd className="text-right text-xs tabular-nums">
                    {formatRupees(s.billed_paise)}
                  </MTd>
                  <MTd className="text-right text-xs tabular-nums">
                    {formatRupees(s.closing_paise)}
                  </MTd>
                  <MTd className="text-xs">
                    <SettlementInvoiceCell
                      s={s}
                      manage={manage}
                      busy={busy}
                      onIssue={() =>
                        act(() => franchiseService.invoiceSettlement(s.id), "Tax invoice issued.")
                      }
                    />
                  </MTd>
                  <MTd className="text-right">
                    <MButton
                      variant="ghost"
                      aria-label={`Download ${s.number}`}
                      onClick={async () => {
                        try {
                          const f = await franchiseService.settlementPdf(s.id, s.number);
                          saveBlob(f.blob, f.filename);
                        } catch (e) {
                          toast.error(ispErrorMessage(e));
                        }
                      }}
                    >
                      <Download />
                    </MButton>
                  </MTd>
                </MTr>
              ))}
            </MTable>
          )}
        </div>
        <FormError message={error} />
      </div>
    </MDialog>
  );
}

export function FranchisePanel() {
  const { can } = usePartner();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: fk("wallets"),
    queryFn: () => franchiseService.wallets(),
    retry: retryUnless4xx,
  });
  const [share, setShare] = useState<ZoneWallet | null>(null);
  const [rev, setRev] = useState<ZoneWallet | null>(null);
  const [more, setMore] = useState<ZoneWallet | null>(null);
  const [busy, setBusy] = useState(false);
  if (ispErrorStatus(q.error) === 404) return null;
  if (q.isLoading) return <LoadingBlock />;
  if (q.error || !q.data)
    return <ErrorBlock error={q.error} onRetry={() => q.refetch()} what="zone wallets" />;
  const d = q.data;
  return (
    <Card
      title="Revenue share and wallets"
      actions={
        can("isp_zones.manage") && (
          <MButton
            variant="outline"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const r = await franchiseService.runCharges();
                await qc.invalidateQueries({ queryKey: fk() });
                toast.success(`${r.charges} charge(s) applied, ${r.alerts} alert(s) sent.`);
              } catch (e) {
                toast.error(ispErrorMessage(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? <Spinner /> : <Play />} Run due charges
          </MButton>
        )
      }
    >
      <p className="mb-2 text-xs text-muted-foreground">
        {d.rules} Auto-debit is {d.auto_debit_enabled ? "on" : "off"}; enforcing the credit limit is{" "}
        {d.enforce_credit ? "on" : "off"}. Zones have no login; you run their wallet here.
      </p>
      <MTable
        head={
          <>
            <MTh>Zone</MTh>
            <MTh className="text-right">Balance</MTh>
            <MTh>Status</MTh>
            <MTh>Share</MTh>
            <MTh className="text-right">From wallet (net)</MTh>
            <MTh className="text-right">Actions</MTh>
          </>
        }
      >
        {d.items.map((z) => (
          <MTr key={z.zone_id}>
            <MTd className="text-xs font-medium">{z.name}</MTd>
            <MTd className="text-right text-xs tabular-nums">
              {formatRupees(z.balance_paise)}
              <span className="block text-[10px] text-muted-foreground">
                min {formatRupees(z.min_balance_paise)} · credit{" "}
                {formatRupees(z.credit_limit_paise)}
              </span>
            </MTd>
            <MTd>
              <MTag
                label={z.standing === "paid" ? "PAID" : "UNPAID"}
                tone={z.standing === "paid" ? "paid" : "overdue"}
              />
              {z.below_minimum && (
                <span className="block text-[10px] text-rose-600">Below minimum</span>
              )}
            </MTd>
            <MTd className="text-xs">
              {z.share_plan
                ? z.share_plan.mode === "wholesale"
                  ? `${formatRupees(z.share_plan.wholesale_paise)} per renewal`
                  : `Zone keeps ${z.revenue_share_bp / 100}%`
                : "Not set (no auto-debit)"}
            </MTd>
            <MTd className="text-right text-xs tabular-nums">
              {formatRupees(z.auto_debited_paise - z.auto_reversed_paise)}
            </MTd>
            <MTd className="text-right">
              <div className="flex justify-end gap-0.5">
                {can("isp_zones.manage") && (
                  <MButton variant="ghost" onClick={() => setShare(z)}>
                    Share
                  </MButton>
                )}
                <MButton variant="ghost" onClick={() => setRev(z)}>
                  Revenue
                </MButton>
                <MButton variant="ghost" onClick={() => setMore(z)}>
                  Charges
                </MButton>
              </div>
            </MTd>
          </MTr>
        ))}
      </MTable>
      {share && <ShareDialog z={share} onClose={() => setShare(null)} />}
      {rev && <RevenueDialog z={rev} onClose={() => setRev(null)} />}
      {more && <ChargesSettlementsDialog z={more} onClose={() => setMore(null)} />}
    </Card>
  );
}
