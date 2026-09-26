/**
 * DEMO ONLY -- the marketing credits wallet and ledger for the demo
 * workspace (spec §13). Imported only by ./demo-backend.ts, which is loaded
 * only for a demo session. Integer minor units throughout (100 = 1 credit).
 */
import type {
  ChannelPrice,
  LedgerQuery,
  LedgerRow,
  MarketingChannel,
  MarketingCredits,
  Page,
} from "@/types/marketing";

const DAY = 86_400_000;
const now = Date.now();
const iso = (ms: number) => new Date(ms).toISOString();

export const DEMO_PRICES: Record<MarketingChannel, ChannelPrice> = {
  sms: { unit: "segment", unit_price_minor: 30, source: "platform" },
  whatsapp: { unit: "message", unit_price_minor: 120, source: "platform" },
  email: { unit: "message", unit_price_minor: 5, source: "platform" },
};

const wallet = { available: 0, reserved: 0, threshold: 10_000 };
const ledger: LedgerRow[] = [];
let seq = 0;

interface Entry {
  type: LedgerRow["entry_type"];
  dAvail: number;
  dRes: number;
  at?: number;
  campaign?: { id: string; name: string } | null;
  test?: boolean;
  unitPrice?: number | null;
  units?: number | null;
  reference?: string | null;
  note?: string | null;
  invoice?: LedgerRow["invoice"];
  actor?: LedgerRow["actor"];
}

function write(e: Entry): LedgerRow {
  if (wallet.available + e.dAvail < 0 || wallet.reserved + e.dRes < 0) {
    throw new Error("demo ledger would go negative");
  }
  wallet.available += e.dAvail;
  wallet.reserved += e.dRes;
  const row: LedgerRow = {
    id: `ledger-demo-${(seq += 1)}`,
    entry_type: e.type,
    created_at: iso(e.at ?? Date.now()),
    delta_available_minor: e.dAvail,
    delta_reserved_minor: e.dRes,
    balance_available_after_minor: wallet.available,
    balance_reserved_after_minor: wallet.reserved,
    campaign: e.campaign ?? null,
    is_test_send: !!e.test,
    unit_price_minor: e.unitPrice ?? null,
    units: e.units ?? null,
    reference: e.reference ?? null,
    note: e.note ?? null,
    invoice: e.invoice ?? null,
    actor: e.actor === undefined ? null : e.actor,
  };
  ledger.unshift(row);
  return row;
}

// ── A plausible history ────────────────────────────────────────────────
const WYFY_OPS = { id: "u-wyfy-ops", name: "Wyfy Billing" };
write({
  type: "topup",
  dAvail: 500_000,
  dRes: 0,
  at: now - 40 * DAY,
  reference: "UTR 412233198765",
  note: "Opening top-up: 5,000 credits, paid by bank transfer.",
  invoice: { id: "inv-demo-1", invoice_number: "INV-2026-00031" },
  actor: WYFY_OPS,
});
write({
  type: "debit",
  dAvail: -600,
  dRes: 0,
  at: now - 36 * DAY,
  test: true,
  unitPrice: 30,
  units: 2,
  campaign: { id: "c-demo-loyalty", name: "Loyalty reward (August)" },
});
write({ type: "reserve", dAvail: -18_300, dRes: 18_300, at: now - 35 * DAY, campaign: { id: "c-demo-loyalty", name: "Loyalty reward (August)" } });
write({ type: "debit", dAvail: 0, dRes: -3_540, at: now - 35 * DAY, unitPrice: 30, units: 118, campaign: { id: "c-demo-loyalty", name: "Loyalty reward (August)" } });
write({ type: "release", dAvail: 14_760, dRes: -14_760, at: now - 35 * DAY, campaign: { id: "c-demo-loyalty", name: "Loyalty reward (August)" } });
write({ type: "reserve", dAvail: -48_720, dRes: 48_720, at: now - 6 * DAY - 2 * 3600_000, campaign: { id: "c-demo-brunch", name: "Weekend brunch offer" } });
write({ type: "debit", dAvail: 0, dRes: -23_730, at: now - 6 * DAY, unitPrice: 30, units: 791, campaign: { id: "c-demo-brunch", name: "Weekend brunch offer" } });
write({ type: "release", dAvail: 24_990, dRes: -24_990, at: now - 6 * DAY, campaign: { id: "c-demo-brunch", name: "Weekend brunch offer" } });
write({
  type: "refund",
  dAvail: 390,
  dRes: 0,
  at: now - 5 * DAY,
  note: "13 SMS failed on the carrier side; refunded as a courtesy.",
  campaign: { id: "c-demo-brunch", name: "Weekend brunch offer" },
  actor: WYFY_OPS,
});
// Brings the demo to a round-looking balance a viewer can recognise.
write({ type: "topup", dAvail: 13_000 - 670, dRes: 0, at: now - 3 * DAY, reference: "UPI 6120045523", note: "Top-up requested by ticket.", actor: WYFY_OPS });

export function demoCredits(byoChannels: MarketingChannel[]): MarketingCredits {
  return {
    available_minor: wallet.available,
    reserved_minor: wallet.reserved,
    minor_per_credit: 100,
    low_balance_threshold_minor: wallet.threshold,
    is_low: wallet.available < wallet.threshold,
    prices: DEMO_PRICES,
    byo_channels: byoChannels,
  };
}

export function demoAvailable(): number {
  return wallet.available;
}

export function demoReserve(campaign: { id: string; name: string }, amount: number) {
  if (amount <= 0) return;
  write({ type: "reserve", dAvail: -amount, dRes: amount, campaign });
}

/** At finish or cancel: debit what was accepted, release the rest. */
export function demoSettle(
  campaign: { id: string; name: string },
  reserved: number,
  debited: number,
  unitPrice: number,
  units: number,
) {
  const d = Math.min(reserved, debited);
  if (d > 0) write({ type: "debit", dAvail: 0, dRes: -d, campaign, unitPrice, units });
  const rest = reserved - d;
  if (rest > 0) write({ type: "release", dAvail: rest, dRes: -rest, campaign });
}

export function demoChargeTest(campaign: { id: string; name: string }, unitPrice: number, units: number) {
  const amount = unitPrice * units;
  if (amount <= 0) return 0;
  write({ type: "debit", dAvail: -amount, dRes: 0, test: true, campaign, unitPrice, units });
  return amount;
}

export function demoLedger(q: LedgerQuery): Page<LedgerRow> {
  const rows = ledger
    .filter((r) => !q.entry_type || q.entry_type.length === 0 || q.entry_type.includes(r.entry_type as never))
    .filter((r) => !q.campaign_id || r.campaign?.id === q.campaign_id);
  const size = q.page_size ?? 25;
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const p = Math.min(Math.max(1, q.page ?? 1), pages);
  return {
    items: rows.slice((p - 1) * size, p * size),
    page: p,
    page_size: size,
    total_items: rows.length,
    total_pages: pages,
    has_next: p < pages,
    has_previous: p > 1,
  };
}
