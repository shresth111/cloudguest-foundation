/**
 * DEMO ONLY -- an in-memory stand-in for the Marketing API, used when (and
 * only when) the session is the demo workspace (demo.wyfyguest.com, see
 * src/lib/demo-host.ts). Same method names, arguments and response shapes
 * as `marketingService` (services/marketing.service.ts), so every screen
 * runs its real code path against it.
 *
 * WHY IT EXISTS: the demo workspace has no backend session, and the
 * Marketing screens used to show "not available in the demo" -- a sales
 * walkthrough with the add-on's most visual feature blanked out. This
 * follows the codebase's existing demo discipline (DEMO_ALERTS in
 * OperationsFeatures.tsx, the demo fixtures in customer.service.ts):
 * fixtures exist, but only behind isDemo().
 *
 * THE FENCE: nothing in production imports this module. Its one importer
 * is the lazy `loadDemoMarketingApi()` in hooks/useMarketing.ts, reached
 * only through `useMarketingApi()` when `useIsDemo()` is true -- so it is a
 * separate chunk a real account never downloads, and it makes no network
 * request of any kind. scripts/test-marketing-ui.mjs enforces both.
 *
 * State lives in this module (per browser tab) and resets on reload. Every
 * write announces itself as a demo ("Demo: nothing was actually sent").
 */
import { toast } from "sonner";
import type { AppError } from "@/services/api";
import type { SupportTicket } from "@/types/support-ticket";
import {
  worstCaseSms,
  measureSms,
  scanVariables,
  smsBodyIssues,
  emailBodyIssues,
} from "@/lib/marketing-template";
import type {
  AudienceFilter,
  AudiencePreview,
  CampaignCreatePayload,
  CampaignListQuery,
  CampaignPatchPayload,
  CampaignRecipient,
  ContactListQuery,
  DeliveryListQuery,
  DeliveryLogEntry,
  MarketingCampaign,
  MarketingChannel,
  MarketingContact,
  MarketingStatus,
  MarketingTemplate,
  OptOutResult,
  Page,
  PortalConsentResult,
  PortalConsentUpdate,
  RecipientListQuery,
  RecipientStatus,
  TemplateListQuery,
  TemplatePatchPayload,
  TemplatePreview,
  TemplatePreviewRequest,
  TemplateWritePayload,
  TestSendResult,
  ProviderPutPayload,
  ProviderVerifyPayload,
  CampaignEstimate,
  LedgerQuery,
} from "@/types/marketing";
import { SYSTEM_TEMPLATE_SEED } from "./system-templates";
import {
  DEMO_PRICES,
  demoAvailable,
  demoChargeTest,
  demoCredits,
  demoLedger,
  demoReserve,
  demoSettle,
} from "./demo-credits";
import {
  demoCampaignProvider,
  demoChannelProviderStatus,
  demoDeleteProvider,
  demoGetProvider,
  demoListProviders,
  demoOwnRow,
  demoPutProvider,
  demoVerifyProvider,
} from "./demo-providers";

export const DEMO_SENT_NOTE = "Demo: nothing was actually sent.";
export const DEMO_SAVED_NOTE = "Demo: saved for this browser tab only; nothing was actually sent.";

// ── Small utilities ────────────────────────────────────────────────────

const LOADED_AT = Date.now();
const DEMO_LINK_BUDGET = 52;
const ORG_NAME = "Acme Corp";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const iso = (ms: number) => new Date(ms).toISOString();
const MIN = 60_000;
const DAY = 86_400_000;

function fail(
  status: number,
  code: string,
  message: string,
  data: Record<string, unknown> = {},
): never {
  const err: AppError = { status, code, message, data: { error_code: code, ...data } };
  throw err;
}

/** Deterministic pseudo-random in [0,1) from an integer seed. */
function rand(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

let idCounter = 1000;
const newId = (prefix: string) => `${prefix}-demo-${(idCounter += 1)}`;

function page<T>(all: T[], p = 1, size = 25): Page<T> {
  const total = all.length;
  const pages = Math.max(1, Math.ceil(total / size));
  const cur = Math.min(Math.max(1, p), pages);
  return {
    items: all.slice((cur - 1) * size, cur * size),
    page: cur,
    page_size: size,
    total_items: total,
    total_pages: pages,
    has_next: cur < pages,
    has_previous: cur > 1,
  };
}

function note(message: string) {
  toast.message(message);
}

// ── Venues and guests ──────────────────────────────────────────────────

/** The demo workspace's venues (customer.service.ts demo seeds) and how
 * many WiFi guests each has seen. 2,412 in total. */
const VENUES: { id: string; name: string; guests: number }[] = [
  { id: "loc-1", name: "Mumbai HQ", guests: 820 },
  { id: "loc-2", name: "Delhi Office", guests: 540 },
  { id: "loc-3", name: "Bangalore DC", guests: 430 },
  { id: "loc-4", name: "Chennai Office", guests: 300 },
  { id: "loc-5", name: "Hyderabad DC", guests: 190 },
  { id: "loc-6", name: "Kolkata Office", guests: 132 },
];
const venueName = (id: string | null | undefined) => VENUES.find((v) => v.id === id)?.name ?? null;

/** Share of matched guests opted in, per channel (~38% overall). */
const OPT_IN: Record<MarketingChannel, number> = { whatsapp: 0.41, sms: 0.38, email: 0.35 };
const OPTED_OUT = 0.031;
const SUPPRESSED = 0.004;
const NO_ADDRESS: Record<MarketingChannel, number> = { whatsapp: 0.018, sms: 0.018, email: 0.22 };
const INVALID = 0.004;
const BLOCKED = 0.002;

const FIRST = [
  "Aarav",
  "Ananya",
  "Rohan",
  "Priya",
  "Vikram",
  "Sneha",
  "Arjun",
  "Kavya",
  "Rahul",
  "Meera",
  "Aditya",
  "Ishita",
  "Karan",
  "Pooja",
  "Nikhil",
  "Divya",
  "Siddharth",
  "Riya",
  "Varun",
  "Neha",
  "Farhan",
  "Zoya",
  "Harpreet",
  "Lakshmi",
  "Tanvir",
];
const LAST = [
  "Sharma",
  "Iyer",
  "Mehta",
  "Reddy",
  "Nair",
  "Kapoor",
  "Das",
  "Singh",
  "Menon",
  "Joshi",
  "Patel",
  "Banerjee",
  "Kulkarni",
  "Chatterjee",
  "Rao",
  "Gupta",
  "Pillai",
  "Verma",
  "Khan",
  "Bose",
  "Shah",
  "Qureshi",
  "Gill",
  "Krishnan",
  "Ahmed",
];
const MAIL = ["gmail.com", "yahoo.co.in", "outlook.com", "rediffmail.com", "hotmail.com"];

interface Guest {
  id: string;
  name: string | null;
  phone: string;
  email: string | null;
  venue: string;
  visits: number;
  lastSeen: number;
}

function guestAt(i: number): Guest {
  const f = FIRST[i % FIRST.length];
  const l = LAST[(i * 7 + 3) % LAST.length];
  const named = rand(i + 11) > 0.22;
  const last4 = String(1000 + Math.floor(rand(i + 5) * 8999));
  const venueRoll = rand(i + 99) * 2412;
  let acc = 0;
  let venue = VENUES[0].id;
  for (const v of VENUES) {
    acc += v.guests;
    if (venueRoll < acc) {
      venue = v.id;
      break;
    }
  }
  return {
    id: `guest-demo-${i}`,
    name: named ? `${f} ${l}` : null,
    phone: `+91******${last4}`,
    email: rand(i + 31) > 0.3 ? `${f[0].toLowerCase()}***@${MAIL[i % MAIL.length]}` : null,
    venue,
    visits: 1 + Math.floor(rand(i + 7) ** 2 * 14),
    lastSeen: LOADED_AT - Math.floor(rand(i + 17) * 120 * DAY),
  };
}

const optedOutGuests = new Map<string, Set<MarketingChannel>>();

function guestConsent(i: number, channel: MarketingChannel) {
  const g = guestAt(i);
  if (optedOutGuests.get(g.id)?.has(channel)) return "opted_out" as const;
  const roll = rand(i * 3 + channel.length);
  if (roll < OPT_IN[channel]) return "opted_in" as const;
  if (roll < OPT_IN[channel] + OPTED_OUT) return "opted_out" as const;
  return "none" as const;
}

// ── Consent / portal state ─────────────────────────────────────────────

const DEFAULT_TEXT = (venue: string) =>
  `Send me offers and updates from ${venue} by SMS, WhatsApp and email. I can unsubscribe any time.`;
const portalConsent = new Map<string, { enabled: boolean; text: string | null; version: number }>(
  VENUES.map((v) => [v.id, { enabled: true, text: null, version: 1 }]),
);
const orgPortal = { enabled: true, text: null as string | null, version: 1 };

function consentCounts(venueIds: string[] | null): Record<MarketingChannel, number> {
  const base = VENUES.filter((v) => !venueIds || venueIds.includes(v.id)).reduce(
    (n, v) => n + v.guests,
    0,
  );
  const extraOut = (c: MarketingChannel) =>
    [...optedOutGuests.values()].filter((s) => s.has(c)).length;
  return {
    sms: Math.max(0, Math.round(base * OPT_IN.sms) - extraOut("sms")),
    whatsapp: Math.max(0, Math.round(base * OPT_IN.whatsapp) - extraOut("whatsapp")),
    email: Math.max(0, Math.round(base * OPT_IN.email) - extraOut("email")),
  };
}

// ── Audience (a deterministic function of the filter) ─────────────────

function daysBetween(from?: string | null, to?: string | null): number | null {
  if (!from && !to) return null;
  const a = from ? Date.parse(from) : LOADED_AT - 365 * DAY;
  const b = to ? Date.parse(to) : LOADED_AT;
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.max(1, Math.round((b - a) / DAY) + 1);
}

function audience(filter: AudienceFilter): AudiencePreview {
  const ids = filter.location_ids && filter.location_ids.length ? filter.location_ids : null;
  let fraction = 1;
  const span = daysBetween(filter.visited_from, filter.visited_to);
  if (span !== null) fraction *= Math.min(1, 0.12 + span / 200);
  if (filter.min_visits && filter.min_visits > 1)
    fraction *= 1 / (1 + 0.45 * (filter.min_visits - 1));
  if (filter.max_visits) fraction *= Math.min(1, 1 - 0.55 / (filter.max_visits + 0.6));
  if (filter.not_seen_for_days) fraction *= 0.8 * Math.exp(-filter.not_seen_for_days / 160);
  if (filter.require_name) fraction *= 0.78;
  const base = VENUES.filter((v) => !ids || ids.includes(v.id)).reduce((n, v) => n + v.guests, 0);
  const matched = Math.round(base * Math.max(0, fraction));
  const c = filter.channel;
  const opted_out = Math.round(matched * OPTED_OUT);
  const suppressed = Math.round(matched * SUPPRESSED);
  const no_address = Math.round(matched * NO_ADDRESS[c]);
  const invalid_address = Math.round(matched * INVALID);
  const blocked = Math.round(matched * BLOCKED);
  const optedIn = Math.round(matched * OPT_IN[c]);
  const reachable = Math.max(
    0,
    optedIn - suppressed - invalid_address - blocked - Math.round(optedIn * NO_ADDRESS[c]),
  );
  const no_consent = Math.max(
    0,
    matched - reachable - opted_out - suppressed - no_address - invalid_address - blocked,
  );
  const sample = [];
  for (let i = 0; sample.length < Math.min(10, reachable) && i < 400; i++) {
    const g = guestAt(i);
    if (ids && !ids.includes(g.venue)) continue;
    if (guestConsent(i, c) !== "opted_in") continue;
    if (filter.require_name && !g.name) continue;
    if (c === "email" && !g.email) continue;
    sample.push({
      guest_id: g.id,
      display_name: g.name,
      masked_address: c === "email" ? g.email : g.phone,
      last_seen_at: iso(g.lastSeen),
      total_visit_count: g.visits,
    });
  }
  sample.sort((a, b) => Date.parse(b.last_seen_at ?? "") - Date.parse(a.last_seen_at ?? ""));
  return {
    channel: c,
    matched_guests: matched,
    reachable: Math.min(reachable, 5000),
    excluded: { no_consent, opted_out, suppressed, no_address, invalid_address, blocked },
    capped: reachable > 5000,
    sample,
  };
}

// ── Templates ──────────────────────────────────────────────────────────

const VARS_OK = { ok: true, reason: null } as const;

function buildTemplate(t: {
  id: string;
  is_system: boolean;
  system_key: string | null;
  name: string;
  category: string;
  description: string | null;
  sms: { body: string; dlt_template_id: string | null } | null;
  whatsapp: { body: string; variable_order: string[] } | null;
  email: { subject: string; preheader: string | null; body_html: string } | null;
  version: number;
  created_at: string;
  updated_at: string;
}): MarketingTemplate {
  const bodies = [
    t.sms?.body,
    t.whatsapp?.body,
    t.email?.subject,
    t.email?.preheader,
    t.email?.body_html,
  ]
    .filter(Boolean)
    .join("\n");
  const smsMeasure = t.sms ? measureSms(t.sms.body) : null;
  return {
    id: t.id,
    is_system: t.is_system,
    system_key: t.system_key,
    name: t.name,
    category: t.category,
    description: t.description,
    sms: t.sms
      ? {
          body: t.sms.body,
          dlt_template_id: t.sms.dlt_template_id,
          length: smsMeasure!.units,
          encoding: smsMeasure!.encoding,
          segments: smsMeasure!.segments,
        }
      : null,
    whatsapp: t.whatsapp
      ? {
          body: t.whatsapp.body,
          content_sid: t.is_system
            ? `HX${t.id.replace(/\W/g, "").slice(-30).padStart(32, "0")}`
            : null,
          variable_order: t.whatsapp.variable_order,
          approval_status: t.is_system ? "approved" : "not_submitted",
        }
      : null,
    email: t.email,
    variables: scanVariables(bodies).used,
    sendable: {
      sms: !t.sms
        ? { ok: false, reason: "channel_missing_in_template" }
        : t.sms.dlt_template_id
          ? VARS_OK
          : { ok: false, reason: "dlt_template_id_missing" },
      whatsapp: !t.whatsapp
        ? { ok: false, reason: "channel_missing_in_template" }
        : t.is_system
          ? VARS_OK
          : { ok: false, reason: "whatsapp_not_approved" },
      email: t.email ? VARS_OK : { ok: false, reason: "channel_missing_in_template" },
    },
    version: t.version,
    created_at: t.created_at,
    updated_at: t.updated_at,
  };
}

const SEEDED_AT = iso(LOADED_AT - 40 * DAY);
let templates: MarketingTemplate[] = [
  ...SYSTEM_TEMPLATE_SEED.map((s, i) =>
    buildTemplate({
      id: `tpl-sys-${s.system_key}`,
      is_system: true,
      system_key: s.system_key,
      name: s.name,
      category: s.category,
      description: s.description,
      // Demo DLT ids: 19 digits, the shape DLT issues.
      sms: { body: s.sms_body, dlt_template_id: `11071690000000${String(10001 + i)}` },
      whatsapp: { body: s.whatsapp_body, variable_order: s.whatsapp_variable_order },
      email: {
        subject: s.email_subject,
        preheader: s.email_preheader,
        body_html: s.email_body_html,
      },
      version: 1,
      created_at: SEEDED_AT,
      updated_at: SEEDED_AT,
    }),
  ),
  buildTemplate({
    id: "tpl-custom-monsoon",
    is_system: false,
    system_key: null,
    name: "Monsoon chai special",
    category: "offer",
    description: "Rainy-day offer for regulars, copied from Weekend offer.",
    sms: {
      body: "Rainy day, {{guest_name}}? Hot chai and pakoras at {{location_name}}: show {{offer_code}} till {{offer_expiry}}. Opt out: {{unsubscribe_link}}",
      dlt_template_id: "1107169000000020001",
    },
    whatsapp: null,
    email: {
      subject: "Monsoon special at {{location_name}}",
      preheader: "Chai, pakoras and {{offer_code}}",
      body_html:
        '<p>Hi {{guest_name}},</p><p>It\'s pouring, and the chai is on at {{location_name}}. Show <strong>{{offer_code}}</strong> for our monsoon special, valid till {{offer_expiry}}.</p><p>Team {{venue_name}}</p><p><small><a href="{{unsubscribe_link}}">Unsubscribe</a></small></p>',
    },
    version: 3,
    created_at: iso(LOADED_AT - 12 * DAY),
    updated_at: iso(LOADED_AT - 2 * DAY),
  }),
  buildTemplate({
    id: "tpl-custom-menu",
    is_system: false,
    system_key: null,
    name: "New menu launch",
    category: "announcement",
    description: "Waiting for its DLT registration before it can go out by SMS.",
    sms: {
      body: "{{guest_name}}, our new menu is here at {{venue_name}}! Try it with {{offer_code}}. Opt out: {{unsubscribe_link}}",
      dlt_template_id: null,
    },
    whatsapp: null,
    email: null,
    version: 1,
    created_at: iso(LOADED_AT - 5 * DAY),
    updated_at: iso(LOADED_AT - 5 * DAY),
  }),
];

const SAMPLE_VALUES: Record<string, string> = {
  guest_name: "Riya",
  venue_name: ORG_NAME,
  offer_code: "",
  offer_expiry: "",
  event_name: "",
  event_date: "",
  booking_link: "",
  review_link: "https://g.page/r/acme-demo-review",
  unsubscribe_link: "https://app.wyfyguest.com/u/SAMPLE",
};

function render(
  text: string,
  vars: Record<string, string>,
  locationName: string,
  missing: Set<string>,
) {
  return text.replace(/\{\{([^{}]*)\}\}/g, (_m, name: string) => {
    if (name === "location_name") return locationName;
    const v = vars[name] ?? SAMPLE_VALUES[name] ?? "";
    if (!v) missing.add(name);
    return v;
  });
}

function templateById(id: string): MarketingTemplate {
  const t = templates.find((x) => x.id === id);
  if (!t) fail(404, "template_not_found", "That template no longer exists.");
  return t;
}

function validateTemplateBody(body: Partial<TemplateWritePayload>) {
  if (body.whatsapp)
    fail(422, "whatsapp_custom_not_supported", "Custom WhatsApp templates aren't available yet.");
  if (body.sms) {
    const issues = smsBodyIssues(body.sms.body);
    for (const code of ["unknown_variable", "unsubscribe_link_missing", "sms_too_long"]) {
      if (issues.includes(code)) fail(422, code, code);
    }
  }
  if (body.email) {
    const issues = emailBodyIssues(body.email.subject, body.email.body_html);
    for (const code of ["unknown_variable", "unsubscribe_link_missing"]) {
      if (issues.includes(code)) fail(422, code, code);
    }
  }
}

// ── Campaigns ──────────────────────────────────────────────────────────

interface DemoCampaign {
  c: MarketingCampaign;
  /** For a live "sending" campaign: when it started and how long it runs. */
  runMs?: number;
  schedules: Map<string, MarketingCampaign>;
  /** §13: the snapshot this campaign is charged at (Wyfy provider only). */
  charge?: { price: number; units: number; settled: boolean };
}

/** Units one recipient can cost at most (§13.4): SMS = worst-case segments
 * with the demo link budget, others 1. */
function unitsPerRecipient(c: MarketingCampaign): number {
  if (c.channel !== "sms") return 1;
  const t = templates.find((x) => x.id === c.template.id);
  return t?.sms ? Math.max(1, worstCaseSms(t.sms.body, DEMO_LINK_BUDGET).segments) : 1;
}

function creditsFor(dc: DemoCampaign, stats: MarketingCampaign["stats"]): MarketingCampaign["credits"] {
  const ch = dc.charge;
  if (!ch || dc.c.provider?.source === "own") return null;
  const reserved = dc.c.credits?.reserved_minor ?? 0;
  const debited = ch.settled
    ? (dc.c.credits?.debited_minor ?? 0)
    : Math.min(reserved, stats.submitted * ch.units * ch.price);
  return {
    price_snapshot: {
      channel: dc.c.channel,
      unit: DEMO_PRICES[dc.c.channel].unit,
      unit_price_minor: ch.price,
    },
    reserved_minor: reserved,
    debited_minor: debited,
    released_minor: ch.settled ? (dc.c.credits?.released_minor ?? 0) : 0,
  };
}

/** Finish or cancel: debit what went out, release the rest (§13.4 step 6). */
function settle(dc: DemoCampaign, submitted: number) {
  const ch = dc.charge;
  if (!ch || ch.settled || !dc.c.credits) return;
  const reserved = dc.c.credits.reserved_minor;
  const debited = Math.min(reserved, submitted * ch.units * ch.price);
  demoSettle({ id: dc.c.id, name: dc.c.name }, reserved, debited, ch.price, submitted * ch.units);
  ch.settled = true;
  dc.c = {
    ...dc.c,
    credits: { ...dc.c.credits, debited_minor: debited, released_minor: reserved - debited },
  };
}

const STATS0 = {
  recipients: 0,
  pending: 0,
  submitted: 0,
  delivered: 0,
  failed: 0,
  skipped: 0,
  delivered_is_tracked: false,
  excluded_at_dispatch: null,
};

function tplRef(key: string) {
  const t = templates.find((x) => x.system_key === key || x.id === key)!;
  return { id: t.id, name: t.name, is_system: t.is_system };
}

function makeCampaign(
  p: Partial<MarketingCampaign> & Pick<MarketingCampaign, "name" | "channel" | "status">,
): MarketingCampaign {
  return {
    id: newId("cmp"),
    location_id: null,
    template: tplRef("weekend_offer"),
    variables: {},
    audience_filter: { channel: p.channel },
    scheduled_at: null,
    started_at: null,
    completed_at: null,
    cancelled_at: null,
    cancel_reason: null,
    paused_until: null,
    stats: { ...STATS0 },
    created_by: { id: "u-demo", name: "Demo Admin" },
    version: 1,
    created_at: iso(LOADED_AT - 3 * DAY),
    updated_at: iso(LOADED_AT - 3 * DAY),
    last_error: null,
    provider:
      p.status === "draft" ? null : { source: "wyfy", type: null, display_name: "Wyfy default" },
    ...p,
  };
}

function exclusionsFor(recipients: number, channel: MarketingChannel) {
  const matched = Math.round(recipients / OPT_IN[channel]);
  return {
    no_consent: matched - recipients - Math.round(matched * 0.05),
    opted_out: Math.round(matched * OPTED_OUT),
    suppressed: Math.round(matched * SUPPRESSED),
    no_address: Math.round(matched * 0.008),
    invalid_address: Math.round(matched * INVALID),
    blocked: Math.round(matched * BLOCKED),
  };
}

function nextSaturday11IST(): string {
  const d = new Date(LOADED_AT);
  const day = d.getUTCDay();
  const add = (6 - day + 7) % 7 || 7;
  const t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + add, 5, 30);
  return iso(t);
}

const campaigns: DemoCampaign[] = [
  {
    c: makeCampaign({
      name: "Diwali greetings 2026",
      channel: "whatsapp",
      status: "scheduled",
      template: tplRef("festival_diwali"),
      variables: { offer_code: "DIWALI26", offer_expiry: "10 Nov" },
      scheduled_at: "2026-11-06T04:30:00.000Z",
      created_at: iso(LOADED_AT - 1 * DAY),
      updated_at: iso(LOADED_AT - 1 * DAY),
    }),
    schedules: new Map(),
  },
  {
    c: makeCampaign({
      name: "Happy hour this Friday",
      channel: "whatsapp",
      status: "sending",
      template: tplRef("happy_hour"),
      location_id: "loc-1",
      audience_filter: { channel: "whatsapp", location_ids: ["loc-1"], min_visits: 2 },
      variables: { offer_code: "HH4TO7", offer_expiry: "today 7 pm" },
      started_at: iso(LOADED_AT - 4 * MIN),
      created_at: iso(LOADED_AT - 2 * DAY),
      updated_at: iso(LOADED_AT - 4 * MIN),
      stats: { ...STATS0, recipients: 214, excluded_at_dispatch: exclusionsFor(214, "whatsapp") },
    }),
    runMs: 7 * MIN,
    schedules: new Map(),
  },
  {
    c: makeCampaign({
      name: "Weekend brunch offer",
      channel: "sms",
      status: "sent",
      template: tplRef("weekend_offer"),
      variables: { offer_code: "BRUNCH20", offer_expiry: "21 Sep" },
      audience_filter: { channel: "sms", visited_from: "2026-08-01", visited_to: "2026-09-18" },
      scheduled_at: "2026-09-20T05:30:00.000Z",
      started_at: "2026-09-20T05:30:04.000Z",
      completed_at: "2026-09-20T05:41:37.000Z",
      created_at: "2026-09-18T09:12:00.000Z",
      updated_at: "2026-09-20T05:41:37.000Z",
      stats: {
        ...STATS0,
        recipients: 812,
        submitted: 791,
        failed: 13,
        skipped: 8,
        excluded_at_dispatch: exclusionsFor(812, "sms"),
      },
    }),
    schedules: new Map(),
  },
  {
    c: makeCampaign({
      name: "We miss you (win-back)",
      channel: "email",
      status: "draft",
      template: tplRef("win_back"),
      variables: { offer_code: "COMEBACK15", offer_expiry: "31 Oct" },
      audience_filter: { channel: "email", not_seen_for_days: 45 },
      created_at: iso(LOADED_AT - 6 * 60 * MIN),
      updated_at: iso(LOADED_AT - 6 * 60 * MIN),
    }),
    schedules: new Map(),
  },
  {
    c: makeCampaign({
      name: "Live jazz night invite",
      channel: "email",
      status: "failed",
      template: tplRef("event_invite"),
      location_id: "loc-3",
      audience_filter: { channel: "email", location_ids: ["loc-3"] },
      variables: {
        event_name: "Live jazz night",
        event_date: "Sat 13 Sep, 8 pm",
        booking_link: "https://acme.example/jazz",
      },
      started_at: "2026-09-10T12:30:02.000Z",
      completed_at: "2026-09-10T12:31:10.000Z",
      created_at: "2026-09-09T10:00:00.000Z",
      updated_at: "2026-09-10T12:31:10.000Z",
      last_error:
        "own_provider_failed: Amazon SES rejected the sender (554 Email address is not verified). Fixed and re-verified on 17 Sep.",
      provider: {
        source: "own",
        type: "ses",
        display_name: "Your Amazon SES (offers@acmecafe.in)",
      },
      stats: {
        ...STATS0,
        recipients: 126,
        failed: 126,
        excluded_at_dispatch: exclusionsFor(126, "email"),
      },
    }),
    schedules: new Map(),
  },
  {
    c: makeCampaign({
      name: "Loyalty reward (August)",
      channel: "sms",
      status: "cancelled",
      template: tplRef("loyalty_reward"),
      audience_filter: { channel: "sms", min_visits: 5 },
      variables: { offer_code: "LOYAL10", offer_expiry: "31 Aug" },
      started_at: "2026-08-22T06:00:03.000Z",
      cancelled_at: "2026-08-22T06:02:40.000Z",
      cancel_reason: "user",
      created_at: "2026-08-21T11:20:00.000Z",
      updated_at: "2026-08-22T06:02:40.000Z",
      stats: {
        ...STATS0,
        recipients: 305,
        submitted: 118,
        failed: 2,
        skipped: 185,
        excluded_at_dispatch: exclusionsFor(305, "sms"),
      },
    }),
    schedules: new Map(),
  },
];

// §13: the seeded campaigns' credits, consistent with the demo ledger.
(function seedCredits() {
  const byName = (n: string) => campaigns.find((x) => x.c.name === n)!;
  const settled = (n: string, reserved: number, debited: number) => {
    const dc = byName(n);
    dc.charge = { price: DEMO_PRICES[dc.c.channel].unit_price_minor, units: 1, settled: true };
    dc.c = {
      ...dc.c,
      credits: {
        price_snapshot: {
          channel: dc.c.channel,
          unit: DEMO_PRICES[dc.c.channel].unit,
          unit_price_minor: DEMO_PRICES[dc.c.channel].unit_price_minor,
        },
        reserved_minor: reserved,
        debited_minor: debited,
        released_minor: reserved - debited,
      },
    };
  };
  settled("Weekend brunch offer", 48_720, 23_730);
  settled("Loyalty reward (August)", 18_300, 3_540);
  // Live reservations: the sending happy-hour campaign and the scheduled
  // Diwali one hold credits now, as a real wallet would.
  for (const n of ["Happy hour this Friday", "Diwali greetings 2026"]) {
    const dc = byName(n);
    const price = DEMO_PRICES[dc.c.channel].unit_price_minor;
    const reach = dc.c.stats.recipients || audience(dc.c.audience_filter).reachable;
    const reserved = reach * price;
    demoReserve({ id: dc.c.id, name: dc.c.name }, reserved);
    dc.charge = { price, units: 1, settled: false };
    dc.c = {
      ...dc.c,
      credits: {
        price_snapshot: { channel: dc.c.channel, unit: DEMO_PRICES[dc.c.channel].unit, unit_price_minor: price },
        reserved_minor: reserved,
        debited_minor: 0,
        released_minor: 0,
      },
    };
  }
})();

/** A "sending" campaign advances with the clock, then finishes. */
function live(dc: DemoCampaign): MarketingCampaign {
  const c = dc.c;
  if (c.status !== "sending" || !dc.runMs || !c.started_at) return c;
  const elapsed = Date.now() - Date.parse(c.started_at);
  const progress = Math.min(1, elapsed / dc.runMs);
  const n = c.stats.recipients;
  const failed = Math.round(n * 0.012 * progress);
  const skipped = Math.round(n * 0.006 * progress);
  const submitted = Math.round(n * progress) - failed - skipped;
  const stats = {
    ...c.stats,
    submitted,
    failed,
    skipped,
    pending: n - submitted - failed - skipped,
  };
  if (progress >= 1) {
    dc.c = {
      ...c,
      status: submitted > 0 ? "sent" : "failed",
      completed_at: iso(Date.parse(c.started_at) + dc.runMs),
      stats: { ...stats, pending: 0 },
      updated_at: iso(Date.now()),
    };
    settle(dc, submitted);
    return dc.c;
  }
  return { ...c, stats, credits: creditsFor(dc, stats) };
}

function findCampaign(id: string): DemoCampaign {
  const dc = campaigns.find((x) => x.c.id === id);
  if (!dc) fail(404, "not_found", "That campaign no longer exists.");
  return dc;
}

/** Recipient rows for a started campaign, generated from its stats. */
function recipientsOf(c: MarketingCampaign): (CampaignRecipient & { at: number })[] {
  const s = c.stats;
  const n = s.recipients;
  if (!n || !c.started_at) return [];
  const start = Date.parse(c.started_at);
  const seed = [...c.id].reduce((a, ch) => a + ch.charCodeAt(0), 0);
  const rows: (CampaignRecipient & { at: number })[] = [];
  const venues = c.audience_filter.location_ids ?? (c.location_id ? [c.location_id] : null);
  for (let i = 0, gi = seed; rows.length < n && gi < seed + n * 8; gi++) {
    const g = guestAt(gi);
    if (venues && !venues.includes(g.venue)) continue;
    if (c.channel === "email" && !g.email) continue;
    const k = rows.length;
    let status: RecipientStatus;
    if (k < s.submitted) status = "submitted";
    else if (k < s.submitted + s.failed) status = "failed";
    else if (k < s.submitted + s.failed + s.skipped) status = "skipped";
    else status = "pending";
    const at = start + Math.floor((k / n) * 9 * MIN);
    rows.push({
      id: `${c.id}-r${k}`,
      guest_id: g.id,
      display_name: g.name,
      masked_address: c.channel === "email" ? g.email : g.phone,
      status,
      skip_reason:
        status === "skipped" ? (c.status === "cancelled" ? "cancelled" : "opted_out") : null,
      provider_source: c.provider?.source ?? "wyfy",
      error_code:
        status === "failed"
          ? c.provider?.source === "own"
            ? "own_provider_failed"
            : c.channel === "email"
              ? "sender_rejected"
              : "invalid_number"
          : null,
      error_message:
        status === "failed"
          ? c.channel === "email"
            ? "554 Message rejected: Email address is not verified"
            : "Number not reachable on this route"
          : null,
      attempt_count: status === "pending" ? 0 : status === "failed" ? 3 : 1,
      submitted_at: status === "submitted" ? iso(at) : null,
      delivered_at: null,
      failed_at: status === "failed" ? iso(at) : null,
      location_id: g.venue,
      location_name: venueName(g.venue),
      at,
    });
    i += 1;
  }
  return rows;
}

const IST_OFFSET = 330 * MIN;
function inQuietHours(ms: number): string | null {
  const local = new Date(ms + IST_OFFSET);
  const h = local.getUTCHours();
  if (h >= 21 || h < 9) {
    const next = new Date(local);
    if (h >= 21) next.setUTCDate(next.getUTCDate() + 1);
    next.setUTCHours(9, 0, 0, 0);
    return iso(next.getTime() - IST_OFFSET);
  }
  return null;
}

const demoTickets: SupportTicket[] = [];

// ── The API ────────────────────────────────────────────────────────────

const CHANNELS: MarketingStatus["channels"] = [
  {
    channel: "sms",
    configured: true,
    provider: "ping4sms",
    mode: "live",
    reason: null,
    requires_dlt_template_id: true,
    custom_templates_supported: true,
  },
  {
    channel: "whatsapp",
    configured: true,
    provider: "twilio",
    mode: "live",
    reason: null,
    custom_templates_supported: false,
  },
  {
    channel: "email",
    configured: true,
    provider: "ses",
    mode: "live",
    reason: null,
    custom_templates_supported: true,
  },
];

export const demoMarketingBackend = {
  async getStatus(locationId?: string | null): Promise<MarketingStatus> {
    await sleep(120);
    const p = locationId ? portalConsent.get(locationId) : orgPortal;
    const vName = venueName(locationId) ?? ORG_NAME;
    return {
      channels: CHANNELS.map((c) => {
        const byo = demoChannelProviderStatus(c.channel);
        const own = byo.provider_source === "own" ? demoOwnRow(c.channel) : null;
        return { ...c, ...byo, provider: own ? own.provider_type : c.provider };
      }),
      sms_unsubscribe_link_budget: 52,
      portal_consent: {
        enabled: p?.enabled ?? false,
        text: p?.text ?? DEFAULT_TEXT(vName),
        text_version: `v${p?.version ?? 1}`,
      },
      consent_counts: consentCounts(locationId ? [locationId] : null),
      quiet_hours: {
        start: "21:00",
        end: "09:00",
        timezone: "Asia/Kolkata",
        applies_to: ["sms", "whatsapp"],
      },
      limits: { max_recipients_per_campaign: 5000, test_sends_per_day: 20 },
    };
  },

  async setPortalConsent(body: PortalConsentUpdate): Promise<PortalConsentResult> {
    await sleep(200);
    const p = portalConsent.get(body.location_id);
    if (!p) fail(404, "location_not_found", "That venue wasn't found.");
    const nextText = body.text === undefined ? p.text : body.text;
    if (nextText !== p.text) p.version += 1;
    p.text = nextText ?? null;
    p.enabled = body.enabled;
    note(DEMO_SAVED_NOTE);
    return {
      location_id: body.location_id,
      enabled: p.enabled,
      text: p.text,
      text_version: `v${p.version}`,
    };
  },

  async listContacts(q: ContactListQuery): Promise<Page<MarketingContact>> {
    await sleep(150);
    const want = q.consent_status ?? "opted_in";
    const search = (q.search ?? "").trim().toLowerCase();
    const rows: MarketingContact[] = [];
    for (let i = 0; i < 2412; i++) {
      const g = guestAt(i);
      if (q.location_id && g.venue !== q.location_id) continue;
      const status = guestConsent(i, q.channel);
      if (status !== want) continue;
      const addr = q.channel === "email" ? g.email : g.phone;
      if (
        search &&
        !(g.name ?? "").toLowerCase().includes(search) &&
        !(addr ?? "").includes(search)
      )
        continue;
      rows.push({
        guest_id: g.id,
        display_name: g.name,
        masked_address: addr,
        consent_status: status,
        consent_source:
          status === "none"
            ? null
            : optedOutGuests.get(g.id)?.has(q.channel)
              ? "staff_recorded"
              : status === "opted_out" && rand(i) > 0.5
                ? "unsubscribe_link"
                : "captive_portal",
        consent_changed_at: status === "none" ? null : iso(g.lastSeen - 3 * DAY),
        last_seen_at: iso(g.lastSeen),
        total_visit_count: g.visits,
      });
    }
    rows.sort((a, b) => Date.parse(b.last_seen_at ?? "") - Date.parse(a.last_seen_at ?? ""));
    return page(rows, q.page, q.page_size ?? 25);
  },

  async optOutContact(
    guestId: string,
    body: { channels: MarketingChannel[]; note?: string | null },
  ): Promise<OptOutResult> {
    await sleep(200);
    const set = optedOutGuests.get(guestId) ?? new Set<MarketingChannel>();
    body.channels.forEach((c) => set.add(c));
    optedOutGuests.set(guestId, set);
    note(DEMO_SAVED_NOTE);
    return {
      guest_id: guestId,
      channels: Object.fromEntries(body.channels.map((c) => [c, "opted_out"])),
    };
  },

  async previewAudience(filter: AudienceFilter): Promise<AudiencePreview> {
    await sleep(180);
    if (filter.visited_from && filter.visited_to && filter.visited_from > filter.visited_to) {
      fail(422, "validation_error", "“From” is after “to”.");
    }
    return audience(filter);
  },

  async listTemplates(q: TemplateListQuery): Promise<Page<MarketingTemplate>> {
    await sleep(120);
    const rows = templates
      .filter((t) => q.include_system !== false || !t.is_system)
      .filter((t) => !q.channel || t[q.channel] !== null)
      .filter((t) => !q.category || t.category === q.category)
      .sort((a, b) =>
        a.is_system === b.is_system
          ? a.is_system
            ? 0
            : Date.parse(b.updated_at) - Date.parse(a.updated_at)
          : a.is_system
            ? -1
            : 1,
      );
    return page(rows, q.page, q.page_size ?? 50);
  },

  async getTemplate(id: string): Promise<MarketingTemplate> {
    await sleep(80);
    return templateById(id);
  },

  async createTemplate(body: TemplateWritePayload): Promise<MarketingTemplate> {
    await sleep(250);
    validateTemplateBody(body);
    if (
      templates.some((t) => !t.is_system && t.name.toLowerCase() === body.name.trim().toLowerCase())
    ) {
      fail(409, "template_name_taken", "You already have a template with this name.");
    }
    const now = iso(Date.now());
    const t = buildTemplate({
      id: newId("tpl"),
      is_system: false,
      system_key: null,
      name: body.name.trim(),
      category: body.category,
      description: body.description ?? null,
      sms: body.sms
        ? { body: body.sms.body, dlt_template_id: body.sms.dlt_template_id ?? null }
        : null,
      whatsapp: null,
      email: body.email ? { ...body.email, preheader: body.email.preheader ?? null } : null,
      version: 1,
      created_at: now,
      updated_at: now,
    });
    templates = [...templates, t];
    note(DEMO_SAVED_NOTE);
    return t;
  },

  async updateTemplate(id: string, body: TemplatePatchPayload): Promise<MarketingTemplate> {
    await sleep(250);
    const cur = templateById(id);
    if (cur.is_system) fail(403, "system_template_read_only", "Wyfy templates can't be edited.");
    if (body.version !== cur.version)
      fail(409, "version_conflict", "Changed elsewhere.", { current_version: cur.version });
    validateTemplateBody(body);
    const t = buildTemplate({
      id,
      is_system: false,
      system_key: null,
      name: body.name?.trim() ?? cur.name,
      category: body.category ?? cur.category,
      description: body.description === undefined ? cur.description : body.description,
      sms:
        body.sms === undefined
          ? cur.sms && { body: cur.sms.body, dlt_template_id: cur.sms.dlt_template_id }
          : body.sms && { body: body.sms.body, dlt_template_id: body.sms.dlt_template_id ?? null },
      whatsapp: null,
      email:
        body.email === undefined
          ? cur.email
          : body.email && { ...body.email, preheader: body.email.preheader ?? null },
      version: cur.version + 1,
      created_at: cur.created_at,
      updated_at: iso(Date.now()),
    });
    templates = templates.map((x) => (x.id === id ? t : x));
    note(DEMO_SAVED_NOTE);
    return t;
  },

  async deleteTemplate(id: string) {
    await sleep(200);
    const cur = templateById(id);
    if (cur.is_system) fail(403, "system_template_read_only", "Wyfy templates can't be deleted.");
    const inUse = campaigns.some(
      (dc) => dc.c.template.id === id && (dc.c.status === "scheduled" || dc.c.status === "sending"),
    );
    if (inUse) fail(409, "template_in_use", "In use.");
    templates = templates.filter((x) => x.id !== id);
    note(DEMO_SAVED_NOTE);
    return { id, deleted: true };
  },

  async duplicateTemplate(id: string, name: string): Promise<MarketingTemplate> {
    const src = templateById(id);
    return demoMarketingBackend.createTemplate({
      name,
      category: src.category,
      description: src.description,
      sms: src.sms && { body: src.sms.body, dlt_template_id: null },
      whatsapp: null,
      email: src.email,
    });
  },

  async previewTemplate(body: TemplatePreviewRequest): Promise<TemplatePreview> {
    await sleep(120);
    const vars = (body.variables ?? {}) as Record<string, string>;
    const loc = venueName(body.location_id) ?? ORG_NAME;
    const missing = new Set<string>();
    let text = "";
    let subject: string | null = null;
    const tpl = body.template_id ? templateById(body.template_id) : null;
    if (body.channel === "email") {
      const e = tpl?.email ?? body.content?.email;
      if (!e) fail(422, "channel_missing_in_template", "No email text.");
      subject = render(e.subject, vars, loc, missing);
      text = render(e.body_html, vars, loc, missing);
    } else {
      const src = body.channel === "sms" ? (tpl?.sms ?? body.content?.sms) : tpl?.whatsapp;
      if (!src) fail(422, "channel_missing_in_template", "No text for this channel.");
      text = render(src.body, vars, loc, missing);
    }
    const m = body.channel === "sms" ? measureSms(text) : null;
    return {
      channel: body.channel,
      rendered: { body: text, subject },
      sms: m && { length: m.units, encoding: m.encoding, segments: m.segments },
      missing_variables: [...missing],
    };
  },

  async listCampaigns(q: CampaignListQuery): Promise<Page<MarketingCampaign>> {
    await sleep(150);
    const search = (q.search ?? "").trim().toLowerCase();
    const rows = campaigns
      .map(live)
      .filter((c) => !q.status || q.status.length === 0 || q.status.includes(c.status))
      .filter((c) => !q.channel || c.channel === q.channel)
      .filter((c) => !search || c.name.toLowerCase().includes(search))
      .filter(
        (c) =>
          !q.location_id ||
          c.location_id === q.location_id ||
          (c.audience_filter.location_ids ?? []).includes(q.location_id),
      )
      .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
    return page(rows, q.page, q.page_size ?? 25);
  },

  async getCampaign(id: string): Promise<MarketingCampaign> {
    await sleep(100);
    return live(findCampaign(id));
  },

  async createCampaign(body: CampaignCreatePayload): Promise<MarketingCampaign> {
    await sleep(250);
    const t = templateById(body.template_id);
    if (!t[body.channel]) fail(422, "channel_missing_in_template", "No text for this channel.");
    const now = iso(Date.now());
    const c = makeCampaign({
      name: body.name,
      channel: body.channel,
      status: "draft",
      template: { id: t.id, name: t.name, is_system: t.is_system },
      location_id: body.location_id,
      variables: body.variables,
      audience_filter: body.audience_filter,
      created_at: now,
      updated_at: now,
    });
    campaigns.unshift({ c, schedules: new Map() });
    note(DEMO_SAVED_NOTE);
    return c;
  },

  async updateCampaign(id: string, body: CampaignPatchPayload): Promise<MarketingCampaign> {
    await sleep(200);
    const dc = findCampaign(id);
    if (dc.c.status !== "draft") fail(409, "invalid_status_transition", "Not a draft any more.");
    if (body.version !== dc.c.version) fail(409, "version_conflict", "Changed elsewhere.");
    const { version: _v, ...rest } = body;
    void _v;
    const t = rest.template_id ? templateById(rest.template_id) : null;
    dc.c = {
      ...dc.c,
      ...rest,
      template: t ? { id: t.id, name: t.name, is_system: t.is_system } : dc.c.template,
      location_id: rest.location_id === undefined ? dc.c.location_id : rest.location_id,
      version: dc.c.version + 1,
      updated_at: iso(Date.now()),
    } as MarketingCampaign;
    return dc.c;
  },

  async deleteCampaign(id: string) {
    await sleep(200);
    const dc = findCampaign(id);
    if (dc.c.status !== "draft" && dc.c.status !== "cancelled") {
      fail(409, "invalid_status_transition", "Only drafts and cancelled campaigns can be deleted.");
    }
    campaigns.splice(campaigns.indexOf(dc), 1);
    note(DEMO_SAVED_NOTE);
    return { id, deleted: true };
  },

  async testSend(
    id: string,
    body: { to: string[]; sample_guest_name?: string | null },
  ): Promise<TestSendResult> {
    await sleep(600);
    const dc = findCampaign(id);
    if (dc.c.status === "cancelled") fail(409, "invalid_status_transition", "Cancelled.");
    // §13.4 step 7: a test through Wyfy is charged from available; through
    // the venue's own provider it's free.
    const own = demoCampaignProvider(dc.c.channel).source === "own";
    const price = own ? 0 : DEMO_PRICES[dc.c.channel].unit_price_minor;
    const units = unitsPerRecipient(dc.c);
    const perMessage = price * units;
    if (perMessage * body.to.length > demoAvailable()) {
      const needed = perMessage * body.to.length;
      fail(402, "insufficient_credits", "Not enough credits.", {
        needed_minor: needed,
        available_minor: demoAvailable(),
        shortfall_minor: needed - demoAvailable(),
      });
    }
    note(DEMO_SENT_NOTE);
    return {
      results: body.to.map((to) => ({
        charged_minor: demoChargeTest({ id: dc.c.id, name: dc.c.name }, price, units),
        to_masked: to.includes("@")
          ? `${to[0]}***${to.slice(to.indexOf("@"))}`
          : `${to.slice(0, 3)}******${to.slice(-4)}`,
        status: "submitted" as const,
        provider_message_id: `DEMO-${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
        error_code: null,
      })),
    };
  },

  async scheduleCampaign(
    id: string,
    body: {
      scheduled_at: string | null;
      idempotency_key: string;
      acknowledge_wyfy_fallback?: boolean;
    },
  ): Promise<MarketingCampaign> {
    await sleep(400);
    const dc = findCampaign(id);
    const again = dc.schedules.get(body.idempotency_key);
    if (again) return again;
    if (dc.c.status !== "draft") fail(409, "invalid_status_transition", "Not a draft any more.");
    // §12.1 / Q11 option A: an own row that isn't sending needs an explicit
    // acknowledgement before the campaign may go through Wyfy.
    const own = demoOwnRow(dc.c.channel);
    if (own && !own.effective && !body.acknowledge_wyfy_fallback) {
      fail(409, "own_provider_unacknowledged", "Acknowledge the fallback to Wyfy.");
    }
    const provider = demoCampaignProvider(dc.c.channel);
    const at = body.scheduled_at ? Date.parse(body.scheduled_at) : Date.now();
    if (body.scheduled_at && (at < Date.now() + 5 * MIN || at > Date.now() + 60 * DAY)) {
      fail(422, "schedule_out_of_range", "Out of range.");
    }
    if (dc.c.channel !== "email") {
      const next = inQuietHours(at);
      if (next) fail(422, "quiet_hours", "Quiet hours.", { next_allowed_at: next });
    }
    const aud = audience(dc.c.audience_filter);
    if (aud.reachable === 0) fail(409, "audience_empty", "Nobody reachable.", { preview: aud });
    // §13.4 steps 1-2: price snapshot and reservation (Wyfy provider only).
    let credits: MarketingCampaign["credits"] = null;
    if (provider.source !== "own") {
      const price = DEMO_PRICES[dc.c.channel].unit_price_minor;
      const units = unitsPerRecipient(dc.c);
      const needed = aud.reachable * units * price;
      if (needed > demoAvailable()) {
        fail(402, "insufficient_credits", "Not enough credits.", {
          needed_minor: needed,
          available_minor: demoAvailable(),
          shortfall_minor: needed - demoAvailable(),
          unit_price_minor: price,
          units_per_recipient_max: units,
          reachable: aud.reachable,
        });
      }
      demoReserve({ id: dc.c.id, name: dc.c.name }, needed);
      dc.charge = { price, units, settled: false };
      credits = {
        price_snapshot: { channel: dc.c.channel, unit: DEMO_PRICES[dc.c.channel].unit, unit_price_minor: price },
        reserved_minor: needed,
        debited_minor: 0,
        released_minor: 0,
      };
    }
    const now = iso(Date.now());
    if (body.scheduled_at) {
      dc.c = {
        ...dc.c,
        status: "scheduled",
        scheduled_at: body.scheduled_at,
        provider,
        credits,
        updated_at: now,
        version: dc.c.version + 1,
      };
    } else {
      dc.c = {
        ...dc.c,
        status: "sending",
        started_at: now,
        provider,
        credits,
        updated_at: now,
        version: dc.c.version + 1,
        stats: {
          ...STATS0,
          recipients: aud.reachable,
          pending: aud.reachable,
          excluded_at_dispatch: aud.excluded,
        },
      };
      // Long enough to watch the counters move; short enough to finish.
      dc.runMs = Math.min(90_000, 20_000 + aud.reachable * 40);
    }
    dc.schedules.set(body.idempotency_key, dc.c);
    note(DEMO_SENT_NOTE);
    return dc.c;
  },

  async unscheduleCampaign(id: string): Promise<MarketingCampaign> {
    await sleep(200);
    const dc = findCampaign(id);
    if (dc.c.status !== "scheduled") fail(409, "invalid_status_transition", "Not scheduled.");
    settle(dc, 0);
    dc.charge = undefined;
    dc.c = {
      ...dc.c,
      status: "draft",
      scheduled_at: null,
      version: dc.c.version + 1,
      updated_at: iso(Date.now()),
    };
    note(DEMO_SAVED_NOTE);
    return dc.c;
  },

  async cancelCampaign(id: string): Promise<MarketingCampaign> {
    await sleep(250);
    const dc = findCampaign(id);
    const cur = live(dc);
    if (cur.status !== "scheduled" && cur.status !== "sending") {
      fail(409, "invalid_status_transition", "Not scheduled or sending.");
    }
    const now = iso(Date.now());
    const stats =
      cur.status === "sending"
        ? { ...cur.stats, skipped: cur.stats.skipped + cur.stats.pending, pending: 0 }
        : cur.stats;
    dc.c = {
      ...cur,
      status: "cancelled",
      cancelled_at: now,
      cancel_reason: "user",
      stats,
      updated_at: now,
    };
    dc.runMs = undefined;
    settle(dc, stats.submitted);
    note(DEMO_SAVED_NOTE);
    return dc.c;
  },

  async listRecipients(
    campaignId: string,
    q: RecipientListQuery,
  ): Promise<Page<CampaignRecipient>> {
    await sleep(150);
    const c = live(findCampaign(campaignId));
    const rows = recipientsOf(c)
      .filter((r) => !q.status || q.status.length === 0 || q.status.includes(r.status))
      .map(({ at: _at, ...r }) => r);
    return page(rows, q.page, q.page_size ?? 25);
  },

  async listDeliveries(q: DeliveryListQuery): Promise<Page<DeliveryLogEntry>> {
    await sleep(180);
    const from = q.from ? Date.parse(q.from) : null;
    const to = q.to ? Date.parse(q.to) + DAY : null;
    const rows = campaigns
      .map(live)
      .filter((c) => !q.campaign_id || c.id === q.campaign_id)
      .filter((c) => !q.channel || c.channel === q.channel)
      .flatMap((c) =>
        recipientsOf(c).map((r) => ({
          ...r,
          campaign: { id: c.id, name: c.name },
          channel: c.channel,
        })),
      )
      .filter((r) => !q.status || q.status.length === 0 || q.status.includes(r.status))
      .filter((r) => !q.location_id || r.location_id === q.location_id)
      .filter((r) => (from === null || r.at >= from) && (to === null || r.at < to))
      .sort((a, b) => b.at - a.at)
      .map(({ at: _at, ...r }) => r);
    return page(rows, q.page, q.page_size ?? 25);
  },

  // ── §12 bring-your-own providers ─────────────────────────────────────
  async listProviders() {
    await sleep(150);
    return demoListProviders();
  },

  async getProvider(channel: MarketingChannel) {
    await sleep(100);
    return demoGetProvider(channel);
  },

  async putProvider(channel: MarketingChannel, body: ProviderPutPayload) {
    await sleep(300);
    const v = demoPutProvider(channel, body);
    note(DEMO_SAVED_NOTE);
    return v;
  },

  async deleteProvider(channel: MarketingChannel) {
    await sleep(250);
    const affected = campaigns.filter(
      (dc) =>
        dc.c.channel === channel && dc.c.status === "scheduled" && dc.c.provider?.source === "own",
    ).length;
    const r = demoDeleteProvider(channel, affected);
    note(DEMO_SAVED_NOTE);
    return r;
  },

  async verifyProvider(channel: MarketingChannel, body: ProviderVerifyPayload) {
    await sleep(900);
    const r = demoVerifyProvider(channel, body);
    note(DEMO_SENT_NOTE);
    return r;
  },

  // ── Support-ticket requests (upsells, top-ups) ───────────────────────
  async findOpenSupportRequest(subject: string): Promise<SupportTicket | null> {
    await sleep(80);
    return demoTickets.find((t) => t.subject === subject) ?? null;
  },

  async requestSupport(subject: string, description: string): Promise<SupportTicket> {
    await sleep(300);
    const now = iso(Date.now());
    const ticket: SupportTicket = {
      id: `demo${String(4200 + demoTickets.length)}0000`,
      organizationId: "org-001",
      locationId: null,
      createdByUserId: "u-demo",
      createdByName: "Demo Admin",
      createdByEmail: "owner@acmecafe.in",
      assignedToUserId: null,
      assignedToName: null,
      subject,
      description,
      category: "billing",
      priority: "medium",
      status: "open",
      resolutionNotes: null,
      resolvedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    demoTickets.push(ticket);
    note("Demo: no ticket was actually filed.");
    return ticket;
  },

  // ── §13 credits ──────────────────────────────────────────────────────
  async getCredits() {
    await sleep(100);
    const byo = (["sms", "whatsapp", "email"] as MarketingChannel[]).filter(
      (c) => demoChannelProviderStatus(c).provider_source === "own",
    );
    return demoCredits(byo);
  },

  async listCreditLedger(q: LedgerQuery) {
    await sleep(150);
    return demoLedger(q);
  },

  async getCampaignEstimate(id: string): Promise<CampaignEstimate> {
    await sleep(120);
    const dc = findCampaign(id);
    const aud = audience(dc.c.audience_filter);
    const source = demoCampaignProvider(dc.c.channel).source;
    const price = DEMO_PRICES[dc.c.channel];
    const units = unitsPerRecipient(dc.c);
    const est = source === "own" ? 0 : aud.reachable * units * price.unit_price_minor;
    return {
      provider_source: source,
      reachable: aud.reachable,
      unit: price.unit,
      unit_price_minor: price.unit_price_minor,
      units_per_recipient_max: units,
      estimated_max_minor: est,
      available_minor: demoAvailable(),
      sufficient: est <= demoAvailable(),
    };
  },

};

// Every method the real client has, and nothing else.
export type DemoMarketingBackend = typeof demoMarketingBackend;
