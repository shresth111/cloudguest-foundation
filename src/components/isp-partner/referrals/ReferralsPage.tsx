/**
 * `/partner/referrals` (REFERRAL-1): record "A referred B", see each
 * referral move from waiting -> earned -> credited (a credit note on A's next
 * bill), and the per-ISP rules. 404s (and says so) while
 * `ISP_REFERRALS_ENABLED` is off.
 */
import { useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Gift, Plus } from "lucide-react";
import {
  MButton,
  MDialog,
  MEmptyState,
  MField,
  MSectionHeader,
  MSeg,
  MTable,
  MTag,
  MTd,
  MTh,
  MTr,
  M_INPUT,
} from "@/components/master/MasterKit";
import { Card, ErrorBlock, FormError, LoadingBlock, Pager } from "@/components/isp-partner/kit";
import { usePartner } from "@/components/isp-partner/PartnerContext";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { ispErrorMessage, isNotFound } from "@/lib/isp-partner/errors";
import { formatDateTime } from "@/lib/isp-partner/format";
import { formatRupees, paiseToInput, parseRupeesToPaise } from "@/lib/isp-partner/money";
import {
  REFERRAL_LABEL,
  REFERRAL_STATUSES,
  referralTone,
  sameSubscriber,
  settingsError,
} from "@/lib/isp-partner/referrals";
import {
  referralsService,
  type Referral,
  type ReferralSettings,
  type ReferralStatus,
} from "@/services/isp-partner/referrals";
import { subscribers360Service } from "@/services/isp-partner/subscribers360";

const KEY = ["isp", "referrals"] as const;

export function ReferralsPage() {
  const { can } = usePartner();
  const [status, setStatus] = useState<ReferralStatus | "all">("all");
  const [page, setPage] = useState(1);
  const [adding, setAdding] = useState(false);
  const [cancel, setCancel] = useState<Referral | null>(null);
  const q = useQuery({
    queryKey: [...KEY, "list", status, page],
    queryFn: () => referralsService.list({ status: status === "all" ? undefined : status, page }),
    placeholderData: keepPreviousData,
    retry: false,
  });
  const st = useQuery({
    queryKey: [...KEY, "settings"],
    queryFn: () => referralsService.settings(),
    retry: false,
  });
  if (q.isLoading) return <LoadingBlock />;
  if (q.error && isNotFound(q.error)) {
    return (
      <MEmptyState
        icon={Gift}
        title="Referrals are not switched on"
        description="Referral credits are not switched on for your network. Ask Wyfy Guest support to turn them on."
      />
    );
  }
  const items = q.data?.items ?? [];
  return (
    <div className="space-y-4">
      <MSectionHeader
        eyebrow="Subscribers"
        title="Referrals"
        description="When a referred subscriber pays their first bill, the subscriber who referred them gets a credit on their next bill."
        actions={
          can("isp_referrals.create") && st.data?.enabled ? (
            <MButton onClick={() => setAdding(true)}>
              <Plus /> Record referral
            </MButton>
          ) : undefined
        }
      />
      {st.data && <SettingsCard s={st.data} canEdit={can("isp_referrals.manage")} />}
      <MSeg<ReferralStatus | "all">
        value={status}
        onChange={(v) => {
          setStatus(v);
          setPage(1);
        }}
        options={[
          { value: "all", label: "All" },
          ...REFERRAL_STATUSES.map((s) => ({ value: s, label: REFERRAL_LABEL[s] })),
        ]}
      />
      {q.data && (
        <p className="text-xs text-muted-foreground">
          {q.data.summary.applied} credited · {formatRupees(q.data.summary.credited_paise)} in
          credit notes · {q.data.summary.pending} waiting for a first payment
        </p>
      )}
      {q.error ? (
        <ErrorBlock error={q.error} onRetry={() => q.refetch()} what="referrals" />
      ) : items.length === 0 ? (
        <MEmptyState
          icon={Gift}
          title="No referrals here"
          description="Record one when a new subscriber says who sent them."
        />
      ) : (
        <MTable
          head={
            <>
              <MTh>Referred by</MTh>
              <MTh>New subscriber</MTh>
              <MTh>Status</MTh>
              <MTh className="text-right">Credit (₹)</MTh>
              <MTh>Recorded</MTh>
              <MTh />
            </>
          }
        >
          {items.map((r) => (
            <MTr key={r.id}>
              <MTd>
                <div>{r.referrer.label}</div>
                <div className="text-xs text-muted-foreground">{r.referrer.identifier}</div>
              </MTd>
              <MTd>
                <div>{r.referred.label}</div>
                <div className="text-xs text-muted-foreground">{r.referred.identifier}</div>
              </MTd>
              <MTd>
                <MTag label={REFERRAL_LABEL[r.status]} tone={referralTone(r.status)} />
                {r.reason && <div className="text-xs text-muted-foreground">{r.reason}</div>}
                {r.credit_note_number && (
                  <div className="text-xs text-muted-foreground">
                    {r.credit_note_number} on {r.applied_invoice_number}
                  </div>
                )}
              </MTd>
              <MTd className="text-right tabular-nums">
                {r.applied_paise !== null
                  ? formatRupees(r.applied_paise)
                  : r.reward_paise !== null
                    ? formatRupees(r.reward_paise)
                    : "–"}
              </MTd>
              <MTd className="text-xs">
                <span
                  title={r.history.map((h) => `${h.at} ${h.status} ${h.detail ?? ""}`).join("\n")}
                >
                  {formatDateTime(r.created_at)}
                </span>
              </MTd>
              <MTd className="text-right">
                {(r.status === "pending" || r.status === "earned") &&
                  can("isp_referrals.create") && (
                    <MButton variant="ghost" onClick={() => setCancel(r)}>
                      Cancel
                    </MButton>
                  )}
              </MTd>
            </MTr>
          ))}
        </MTable>
      )}
      {q.data && (
        <Pager
          page={page}
          pages={Math.max(1, Math.ceil(q.data.total / 50))}
          total={q.data.total}
          onPage={setPage}
        />
      )}
      {adding && <AddDialog onClose={() => setAdding(false)} />}
      {cancel && <CancelDialog r={cancel} onClose={() => setCancel(null)} />}
    </div>
  );
}

function SettingsCard({ s, canEdit }: { s: ReferralSettings; canEdit: boolean }) {
  const qc = useQueryClient();
  const [enabled, setEnabled] = useState(s.enabled);
  const [reward, setReward] = useState(paiseToInput(s.reward_paise));
  const [perYear, setPerYear] = useState(String(s.max_rewards_per_year));
  const [windowDays, setWindowDays] = useState(String(s.window_days));
  const [minFirst, setMinFirst] = useState(paiseToInput(s.min_first_invoice_paise));
  const v = {
    enabled,
    reward_paise: parseRupeesToPaise(reward || "0"),
    max_rewards_per_year: Number(perYear),
    window_days: Number(windowDays),
  };
  const err = settingsError(v);
  const save = useMutation({
    mutationFn: () =>
      referralsService.saveSettings({
        ...v,
        reward_paise: v.reward_paise as number,
        min_first_invoice_paise: parseRupeesToPaise(minFirst || "0") ?? 0,
      }),
    onSuccess: () => {
      toast.success("Referral rules saved");
      qc.invalidateQueries({ queryKey: KEY });
    },
  });
  return (
    <Card title="Rules">
      <p className="mb-3 text-xs text-muted-foreground">{s.rules}</p>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            disabled={!canEdit}
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          Referral credits on
        </label>
        <MField label="Credit per referral (₹)">
          <input
            className={M_INPUT}
            disabled={!canEdit}
            inputMode="decimal"
            value={reward}
            onChange={(e) => setReward(e.target.value)}
          />
        </MField>
        <MField label="Most rewards a year, per subscriber">
          <input
            className={M_INPUT}
            disabled={!canEdit}
            inputMode="numeric"
            value={perYear}
            onChange={(e) => setPerYear(e.target.value)}
          />
        </MField>
        <MField label="Record within (days of joining)">
          <input
            className={M_INPUT}
            disabled={!canEdit}
            inputMode="numeric"
            value={windowDays}
            onChange={(e) => setWindowDays(e.target.value)}
          />
        </MField>
        <MField label="Smallest first bill (₹)">
          <input
            className={M_INPUT}
            disabled={!canEdit}
            inputMode="decimal"
            value={minFirst}
            onChange={(e) => setMinFirst(e.target.value)}
          />
        </MField>
      </div>
      {canEdit && (
        <div className="mt-3 flex items-center gap-2">
          <MButton disabled={!!err || save.isPending} onClick={() => save.mutate()}>
            Save rules
          </MButton>
          <FormError message={err ?? (save.error ? ispErrorMessage(save.error) : null)} />
        </div>
      )}
    </Card>
  );
}

function Pick({
  label,
  value,
  onPick,
}: {
  label: string;
  value: { id: string; text: string } | null;
  onPick: (v: { id: string; text: string } | null) => void;
}) {
  const [q, setQ] = useState("");
  const d = useDebouncedValue(q.trim(), 300);
  const hits = useQuery({
    queryKey: ["isp", "referrals", "pick", d],
    queryFn: () => subscribers360Service.typeahead(d),
    enabled: d.length >= 2 && !value,
    retry: false,
  });
  return (
    <MField label={label}>
      {value ? (
        <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
          {value.text}
          <MButton variant="ghost" onClick={() => onPick(null)}>
            Change
          </MButton>
        </div>
      ) : (
        <>
          <input
            className={M_INPUT}
            placeholder="Name, username, phone or circuit id"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <ul className="mt-1 max-h-40 overflow-y-auto text-sm">
            {(hits.data ?? []).map((h) => (
              <li key={h.id}>
                <button
                  type="button"
                  className="w-full rounded px-2 py-1 text-left hover:bg-accent"
                  onClick={() =>
                    onPick({ id: h.id, text: `${h.name ?? h.identifier} · ${h.identifier}` })
                  }
                >
                  {h.name ?? h.identifier}{" "}
                  <span className="text-xs text-muted-foreground">
                    {h.identifier} · {h.customer_name}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </MField>
  );
}

function AddDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [a, setA] = useState<{ id: string; text: string } | null>(null);
  const [b, setB] = useState<{ id: string; text: string } | null>(null);
  const [note, setNote] = useState("");
  const same = sameSubscriber(a?.id ?? null, b?.id ?? null);
  const m = useMutation({
    mutationFn: () =>
      referralsService.create({
        referrer_subscriber_id: (a as { id: string }).id,
        referred_subscriber_id: (b as { id: string }).id,
        note: note.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success("Referral recorded");
      qc.invalidateQueries({ queryKey: KEY });
      onClose();
    },
  });
  return (
    <MDialog
      open
      onClose={onClose}
      title="Record a referral"
      footer={
        <>
          <MButton variant="outline" onClick={onClose}>
            Close
          </MButton>
          <MButton disabled={!a || !b || same || m.isPending} onClick={() => m.mutate()}>
            Record
          </MButton>
        </>
      }
    >
      <div className="space-y-3">
        <Pick label="Who referred (existing subscriber)" value={a} onPick={setA} />
        <Pick label="New subscriber" value={b} onPick={setB} />
        <MField label="Note (optional)">
          <input
            className={M_INPUT}
            maxLength={500}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </MField>
        <FormError
          message={
            same ? "Pick two different subscribers." : m.error ? ispErrorMessage(m.error) : null
          }
        />
      </div>
    </MDialog>
  );
}

function CancelDialog({ r, onClose }: { r: Referral; onClose: () => void }) {
  const qc = useQueryClient();
  const [reason, setReason] = useState("");
  const m = useMutation({
    mutationFn: () => referralsService.cancel(r.id, reason.trim()),
    onSuccess: () => {
      toast.success("Referral cancelled");
      qc.invalidateQueries({ queryKey: KEY });
      onClose();
    },
  });
  return (
    <MDialog
      open
      onClose={onClose}
      title="Cancel this referral"
      footer={
        <>
          <MButton variant="outline" onClick={onClose}>
            Keep it
          </MButton>
          <MButton disabled={reason.trim().length < 3 || m.isPending} onClick={() => m.mutate()}>
            Cancel referral
          </MButton>
        </>
      }
    >
      <p className="mb-3 text-sm">
        {r.referrer.label} referred {r.referred.label}. No credit will be given.
      </p>
      <MField label="Why">
        <input
          className={M_INPUT}
          maxLength={255}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </MField>
      <div className="mt-2">
        <FormError message={m.error ? ispErrorMessage(m.error) : null} />
      </div>
    </MDialog>
  );
}
