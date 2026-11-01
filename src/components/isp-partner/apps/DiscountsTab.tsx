/** Apps -> Discounts: invoice discount codes (percent or flat, caps,
 * minimum bill, uses, dates), a preview against an amount, and each code's
 * redemptions. Managers only write; the code, kind and value are fixed once
 * created (the PATCH model has no such fields). */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { BadgePercent, Plus } from "lucide-react";
import {
  MButton,
  MDialog,
  MEmptyState,
  MSeg,
  MTable,
  MTd,
  MTh,
  MTr,
} from "@/components/master/MasterKit";
import {
  Card,
  ErrorBlock,
  FormError,
  Pager,
  Spinner,
  TextField,
} from "@/components/isp-partner/kit";
import { usePartner } from "@/components/isp-partner/PartnerContext";
import { appsKeys, useAppsMutation } from "@/components/isp-partner/apps/appsKit";
import { ispErrorMessage } from "@/lib/isp-partner/errors";
import { formatDate, formatDateTime, isoDay } from "@/lib/isp-partner/format";
import { formatRupees, paiseToInput, parseRupeesToPaise } from "@/lib/isp-partner/money";
import { appsCan, discountBody, emptyDiscount, type DiscountDraft } from "@/lib/isp-partner/apps";
import { appsService } from "@/services/isp-partner/apps";
import type { Discount, DiscountBody, DiscountPreview } from "@/services/isp-partner/apps-types";

export function DiscountsTab() {
  const { can } = usePartner();
  const c = appsCan(can);
  const [onlyActive, setOnlyActive] = useState(true);
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Discount | "new" | null>(null);
  const [usage, setUsage] = useState<Discount | null>(null);
  const list = useQuery({
    queryKey: appsKeys.list("discounts", { onlyActive, page }),
    queryFn: () => appsService.discounts({ active: onlyActive || undefined, page }),
    retry: false,
  });
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <MSeg<"active" | "all">
          value={onlyActive ? "active" : "all"}
          onChange={(v) => {
            setOnlyActive(v === "active");
            setPage(1);
          }}
          options={[
            { value: "active", label: "Active" },
            { value: "all", label: "All" },
          ]}
        />
        {c.manage && (
          <MButton className="ml-auto" onClick={() => setEditing("new")}>
            <Plus /> New code
          </MButton>
        )}
      </div>
      {/* GAP-SWEEP: nothing in billing calls the JAZE-5 discount hook yet, so a
          code never changes an invoice. Say so instead of implying it does. */}
      <p className="text-xs text-muted-foreground">
        Codes can be created, previewed and tracked here. Renewals, recharges and new subscribers do
        not apply them to invoices yet.
      </p>
      {list.error && !list.data ? (
        <ErrorBlock error={list.error} onRetry={() => list.refetch()} what="discount codes" />
      ) : list.data && list.data.items.length === 0 ? (
        <MEmptyState
          icon={BadgePercent}
          title="No discount codes"
          description="A code will reduce an invoice's taxable amount once billing applies codes."
        />
      ) : (
        <>
          <MTable
            loading={list.isLoading}
            head={
              <>
                <MTh>Code</MTh>
                <MTh>Discount</MTh>
                <MTh>Valid</MTh>
                <MTh className="text-right">Used</MTh>
                <MTh />
              </>
            }
          >
            {(list.data?.items ?? []).map((d) => (
              <MTr key={d.id}>
                <MTd>
                  <span className="font-mono text-sm">{d.code}</span>
                  {!d.active && <span className="ml-2 text-[11px] text-muted-foreground">off</span>}
                  {d.description && (
                    <p className="text-[11px] text-muted-foreground">{d.description}</p>
                  )}
                </MTd>
                <MTd className="text-xs">{d.label}</MTd>
                <MTd className="text-xs">
                  {d.valid_from ? formatDate(d.valid_from) : "Any time"} –{" "}
                  {d.valid_until ? formatDate(d.valid_until) : "no end"}
                </MTd>
                <MTd className="text-right text-xs tabular-nums">
                  {d.used_count}
                  {d.max_uses ? ` / ${d.max_uses}` : ""}
                </MTd>
                <MTd className="text-right">
                  <MButton variant="ghost" onClick={() => setUsage(d)}>
                    Redemptions
                  </MButton>
                  {c.manage && (
                    <MButton variant="ghost" onClick={() => setEditing(d)}>
                      Edit
                    </MButton>
                  )}
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
      <PreviewCard />
      {editing && (
        <DiscountDialog d={editing === "new" ? null : editing} onClose={() => setEditing(null)} />
      )}
      {usage && <RedemptionsDialog d={usage} onClose={() => setUsage(null)} />}
    </div>
  );
}

function draftOf(d: Discount | null): DiscountDraft {
  if (!d) return emptyDiscount();
  // local calendar day: slicing the UTC ISO string would shift IST dates back a day
  const day = (v: string | null) => (v ? isoDay(new Date(v)) : "");
  return {
    code: d.code,
    kind: d.kind,
    value: d.kind === "flat" ? paiseToInput(d.value) : String(d.value),
    description: d.description ?? "",
    max_discount: d.max_discount_paise ? paiseToInput(d.max_discount_paise) : "",
    min_amount: d.min_amount_paise ? paiseToInput(d.min_amount_paise) : "",
    max_uses: d.max_uses ? String(d.max_uses) : "",
    valid_from: day(d.valid_from),
    valid_until: day(d.valid_until),
    active: d.active,
  };
}

function DiscountDialog({ d, onClose }: { d: Discount | null; onClose: () => void }) {
  const [f, setF] = useState<DiscountDraft>(() => draftOf(d));
  const [err, setErr] = useState<string | null>(null);
  const set = (k: keyof DiscountDraft) => (v: string | boolean) => setF((x) => ({ ...x, [k]: v }));
  const save = useAppsMutation((body: DiscountBody) =>
    d ? appsService.patchDiscount(d.id, body) : appsService.createDiscount(body),
  );
  return (
    <MDialog
      open
      onClose={onClose}
      title={d ? `Edit ${d.code}` : "New discount code"}
      footer={
        <>
          <MButton variant="outline" onClick={onClose}>
            Cancel
          </MButton>
          <MButton
            disabled={save.isPending}
            onClick={async () => {
              setErr(null);
              const r = discountBody(f, !d);
              if ("error" in r) return setErr(r.error);
              try {
                await save.mutateAsync(r.body);
                toast.success("Saved.");
                onClose();
              } catch (e) {
                setErr(ispErrorMessage(e));
              }
            }}
          >
            {save.isPending && <Spinner />} Save
          </MButton>
        </>
      }
    >
      <div className="grid gap-3 text-sm sm:grid-cols-2">
        <TextField
          label="Code"
          value={f.code}
          onChange={(v) => set("code")(v.toUpperCase())}
          disabled={!!d}
        />
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">Kind</span>
          <MSeg<"percent" | "flat">
            value={f.kind}
            onChange={(v) => !d && set("kind")(v)}
            options={[
              { value: "percent", label: "Percent off" },
              { value: "flat", label: "Amount off" },
            ]}
          />
        </label>
        <TextField
          label={f.kind === "percent" ? "Percent" : "Amount (₹)"}
          value={f.value}
          onChange={set("value")}
          disabled={!!d}
        />
        <TextField
          label="Description (optional)"
          value={f.description}
          onChange={set("description")}
        />
        {f.kind === "percent" && (
          <TextField
            label="Maximum discount (₹, optional)"
            value={f.max_discount}
            onChange={set("max_discount")}
          />
        )}
        <TextField
          label="Minimum bill (₹, optional)"
          value={f.min_amount}
          onChange={set("min_amount")}
        />
        <TextField label="Uses allowed (optional)" value={f.max_uses} onChange={set("max_uses")} />
        <TextField label="From" type="date" value={f.valid_from} onChange={set("valid_from")} />
        <TextField label="Until" type="date" value={f.valid_until} onChange={set("valid_until")} />
        <label className="flex items-center gap-2 pt-6 text-xs">
          <input
            type="checkbox"
            checked={f.active}
            onChange={(e) => set("active")(e.target.checked)}
          />
          Active
        </label>
      </div>
      <FormError message={err} />
    </MDialog>
  );
}

function PreviewCard() {
  const [code, setCode] = useState("");
  const [amount, setAmount] = useState("");
  const [out, setOut] = useState<DiscountPreview | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <Card title="Try a code">
      <div className="flex flex-wrap items-end gap-2">
        <div className="w-40">
          <TextField label="Code" value={code} onChange={(v) => setCode(v.toUpperCase())} />
        </div>
        <div className="w-40">
          <TextField label="Bill amount (₹)" value={amount} onChange={setAmount} />
        </div>
        <MButton
          variant="outline"
          disabled={busy}
          onClick={async () => {
            setErr(null);
            setOut(null);
            const gross = parseRupeesToPaise(amount);
            if (!code.trim()) return setErr("Type a code.");
            if (gross === null || gross <= 0) return setErr("Type the bill amount in rupees.");
            setBusy(true);
            try {
              setOut(await appsService.previewDiscount({ code: code.trim(), gross_paise: gross }));
            } catch (e) {
              setErr(ispErrorMessage(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy && <Spinner />} Check
        </MButton>
      </div>
      {out && (
        <p className="mt-2 text-sm">
          {out.label}: {formatRupees(out.gross_paise)} − {formatRupees(out.discount_paise)} ={" "}
          <b>{formatRupees(out.taxable_paise)}</b> before GST.
        </p>
      )}
      <FormError message={err} />
    </Card>
  );
}

function RedemptionsDialog({ d, onClose }: { d: Discount; onClose: () => void }) {
  const q = useQuery({
    queryKey: appsKeys.one("redemptions", d.id),
    queryFn: () => appsService.redemptions(d.id),
    retry: false,
  });
  return (
    <MDialog
      open
      onClose={onClose}
      title={`${d.code} redemptions`}
      footer={
        <MButton variant="outline" onClick={onClose}>
          Close
        </MButton>
      }
    >
      {q.error ? (
        <ErrorBlock error={q.error} what="redemptions" />
      ) : !q.data ? (
        <Spinner />
      ) : q.data.length === 0 ? (
        <p className="text-sm text-muted-foreground">Not used yet.</p>
      ) : (
        <MTable
          head={
            <>
              <MTh>When</MTh>
              <MTh className="text-right">Discount</MTh>
            </>
          }
        >
          {q.data.map((r) => (
            <MTr key={r.invoice_id}>
              <MTd className="text-xs">{formatDateTime(r.at)}</MTd>
              <MTd className="text-right text-xs tabular-nums">{formatRupees(r.amount_paise)}</MTd>
            </MTr>
          ))}
        </MTable>
      )}
    </MDialog>
  );
}
