/**
 * Master's per-ISP parity settings (ADDENDUM_04 F1-F3, coordinator defaults).
 * Mounted in the ISP partner detail drawer; new component only.
 *
 *  - Add-ons this ISP may switch on for its customers, a customer cap, and an
 *    optional agreed price per customer per month. The price is a RECORD: the
 *    ISP pays Wyfy in cash and nothing bills from it.
 *  - The ISP's ONE messaging credit wallet: balance, what its customers hold,
 *    and a top-up (cash received offline; no invoice is generated).
 *  - F2: unmasked guest identifiers + Traffic Lens connection records for this
 *    ISP's owner/admin. Off by default; every unmasked view is recorded in the
 *    ISP's staff activity.
 *
 * Every route is GLOBAL-pinned on organizations.* (backend isp_addons.py /
 * parity_settings.py).
 */
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { MButton, MField, M_INPUT } from "@/components/master/MasterKit";
import { api, crossOrganizationHeaders, requestErrorOf } from "@/services/api";

interface Allowance {
  key: string;
  allowed: boolean;
  max_customers: number | null;
  price_per_customer_paise: number | null;
  source: string;
}
interface Wallet {
  minor_per_credit: number;
  pool: { available_minor: number; reserved_minor: number; is_low: boolean };
  held_total_minor: number;
}

const ADDON_LABEL: Record<string, string> = {
  guest_marketing: "Guest Messaging (marketing)",
  guest_marketing_byo: "Guest Messaging: own provider",
  traffic_flow: "Traffic Lens",
  traffic_flow_records: "Traffic Lens: connection records",
};

const base = (id: string) => `/platform/isp-partners/${id}`;
const opts = () => ({ headers: crossOrganizationHeaders() });

function errorText(e: unknown): string {
  const err = requestErrorOf(e) as { message?: string } | null;
  return err?.message || "Request failed";
}

function rupees(paise: number | null): string {
  return paise === null || paise === undefined ? "" : String(paise / 100);
}

export function IspParityPanel({
  partnerId,
  canUpdate,
}: {
  partnerId: string;
  canUpdate: boolean;
}) {
  const [rows, setRows] = useState<Allowance[] | null>(null);
  const [unmask, setUnmask] = useState<boolean | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [topup, setTopup] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setError(null);
    try {
      const [a, p, w] = await Promise.all([
        api.get<{ items: Allowance[] }>(`${base(partnerId)}/addon-allowances`, opts()),
        api.get<{ pii_unmask_enabled: boolean }>(`${base(partnerId)}/parity-settings`, opts()),
        api.get<Wallet>(`${base(partnerId)}/wallet`, opts()),
      ]);
      setRows(a.data.items);
      setUnmask(p.data.pii_unmask_enabled);
      setWallet(w.data);
    } catch (e) {
      setError(errorText(e));
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partnerId]);

  const saveAllowances = async () => {
    if (!rows) return;
    setBusy("allowance");
    try {
      const { data } = await api.put<{ items: Allowance[] }>(
        `${base(partnerId)}/addon-allowances`,
        {
          items: rows.map((r) => ({
            key: r.key,
            enabled: r.allowed,
            max_customers: r.max_customers,
            price_per_customer_paise: r.price_per_customer_paise,
          })),
        },
        opts(),
      );
      setRows(data.items);
      toast.success("Add-on allowance saved.");
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setBusy(null);
    }
  };

  const saveUnmask = async (next: boolean) => {
    setBusy("unmask");
    try {
      const { data } = await api.put<{ pii_unmask_enabled: boolean }>(
        `${base(partnerId)}/parity-settings`,
        { pii_unmask_enabled: next },
        opts(),
      );
      setUnmask(data.pii_unmask_enabled);
      toast.success(next ? "Unmasking enabled for owner/admin." : "Guest identifiers masked.");
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setBusy(null);
    }
  };

  const doTopup = async () => {
    const credits = Number(topup);
    if (!Number.isFinite(credits) || credits <= 0 || !wallet) return;
    setBusy("topup");
    try {
      const key =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const { data } = await api.post<Wallet>(
        `${base(partnerId)}/wallet/topups`,
        {
          amount_minor: Math.round(credits * wallet.minor_per_credit),
          idempotency_key: key,
          note: "Master top-up",
        },
        opts(),
      );
      setWallet(data);
      setTopup("");
      toast.success(`${credits} credits added.`);
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setBusy(null);
    }
  };

  const set = (i: number, patch: Partial<Allowance>) =>
    setRows((r) => (r ? r.map((x, j) => (j === i ? { ...x, ...patch } : x)) : r));

  if (error)
    return (
      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Add-ons, wallet and privacy</h3>
        <p className="text-sm text-destructive">{error}</p>
        <MButton variant="outline" onClick={() => void load()}>
          Retry
        </MButton>
      </section>
    );
  if (!rows || unmask === null || !wallet)
    return (
      <div className="flex justify-center py-4">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  const per = wallet.minor_per_credit || 100;
  return (
    <section className="space-y-5">
      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Add-ons this ISP may offer</h3>
        <p className="text-xs text-muted-foreground">
          The ISP switches an allowed add-on on per customer. The price is a record of what was
          agreed (the ISP pays in cash); nothing is billed from it.
        </p>
        <div className="space-y-2">
          {rows.map((r, i) => (
            <div
              key={r.key}
              className="grid grid-cols-[1fr_auto] items-center gap-2 text-sm sm:grid-cols-[1fr_auto_8rem_8rem]"
            >
              <span>{ADDON_LABEL[r.key] ?? r.key}</span>
              <label className="flex items-center gap-1.5 text-xs">
                <input
                  type="checkbox"
                  checked={r.allowed}
                  disabled={!canUpdate}
                  onChange={(e) => set(i, { allowed: e.target.checked })}
                />
                Allowed
              </label>
              <input
                className={M_INPUT}
                type="number"
                min={0}
                placeholder="Customer cap"
                disabled={!canUpdate || !r.allowed}
                value={r.max_customers ?? ""}
                onChange={(e) =>
                  set(i, { max_customers: e.target.value === "" ? null : Number(e.target.value) })
                }
                aria-label="Customer cap"
              />
              <input
                className={M_INPUT}
                type="number"
                min={0}
                step="0.01"
                placeholder="₹ / customer / month"
                disabled={!canUpdate || !r.allowed}
                value={rupees(r.price_per_customer_paise)}
                onChange={(e) =>
                  set(i, {
                    price_per_customer_paise:
                      e.target.value === "" ? null : Math.round(Number(e.target.value) * 100),
                  })
                }
                aria-label="Price per customer per month"
              />
            </div>
          ))}
        </div>
        {canUpdate && (
          <MButton disabled={busy === "allowance"} onClick={() => void saveAllowances()}>
            {busy === "allowance" && <Loader2 className="animate-spin" />} Save add-ons
          </MButton>
        )}
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Messaging credit wallet</h3>
        <p className="text-sm">
          {(wallet.pool.available_minor / per).toLocaleString()} credits available
          {wallet.pool.is_low ? " (low)" : ""} · {(wallet.held_total_minor / per).toLocaleString()}{" "}
          held by its customers
        </p>
        <p className="text-xs text-muted-foreground">
          One wallet for all this ISP's customers; every send draws from it and stops at zero.
        </p>
        {canUpdate && (
          <div className="flex items-end gap-2">
            <MField label="Top up (credits)">
              <input
                className={M_INPUT}
                type="number"
                min={1}
                value={topup}
                onChange={(e) => setTopup(e.target.value)}
              />
            </MField>
            <MButton disabled={busy === "topup" || !topup} onClick={() => void doTopup()}>
              {busy === "topup" && <Loader2 className="animate-spin" />} Add credits
            </MButton>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Guest identifiers for this ISP</h3>
        <p className="text-xs text-muted-foreground">
          {unmask
            ? "Unmasked for the ISP's owner and admin (phone, email and Traffic Lens connection records). Every view is recorded in its staff activity."
            : "Masked for all ISP staff. IPDR exports stay the legal route."}
        </p>
        {canUpdate && (
          <MButton
            variant="outline"
            disabled={busy === "unmask"}
            onClick={() => void saveUnmask(!unmask)}
          >
            {busy === "unmask" && <Loader2 className="animate-spin" />}
            {unmask ? "Mask again" : "Unmask for owner/admin"}
          </MButton>
        )}
      </div>
    </section>
  );
}
