/**
 * SUB360-2 Subscriber 360 workbench (`src/lib/isp-partner/workbench.ts`).
 * Pins: ticket text is sanitised and stored as text (no HTML, no invisible
 * or bidi characters), markdown-lite renders to tokens (never HTML), the
 * raise-ticket body matches JAZE-5's create schema and enforces the RFO
 * rule, and the 360 page keeps today's markup as the fallback.
 *
 * Run: node scripts/test-isp-partner-sub360-workbench.mjs
 */
import { build } from "esbuild";
import { mkdirSync, mkdtempSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
mkdirSync(join(ROOT, "node_modules/.cache"), { recursive: true });
const outdir = mkdtempSync(join(ROOT, "node_modules/.cache/isp-wb-"));
const outfile = join(outdir, "workbench.mjs");
await build({
  entryPoints: [join(ROOT, "src/lib/isp-partner/workbench.ts")],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile,
  logLevel: "silent",
});
const m = await import(outfile);

let failures = 0;
let checks = 0;
const eq = (name, got, want) => {
  checks += 1;
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures += 1;
  console.log(
    `  ${ok ? "ok  " : "FAIL"} ${name}${ok ? "" : ` -- got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`}`,
  );
};

const zw = String.fromCharCode(0x200b);
const rlo = String.fromCharCode(0x202e);
const bom = String.fromCharCode(0xfeff);
const nul = String.fromCharCode(0);

// sanitise
eq(
  "tags stripped",
  m.sanitizeTicketText("<b>slow</b> <script>alert(1)</script>net"),
  "slow alert(1)net",
);
eq("img onerror gone", m.sanitizeTicketText('a<img src=x onerror="x()">b'), "ab");
eq("comment gone", m.sanitizeTicketText("a<!-- hidden -->b"), "ab");
eq("CRLF normalised", m.sanitizeTicketText("a\r\nb\rc"), "a\nb\nc");
eq("invisible + bidi removed", m.sanitizeTicketText(`p${zw}a${rlo}y${bom}${nul}`), "pay");
eq("tabs kept", m.sanitizeTicketText("a\tb"), "a\tb");
eq("blank runs capped", m.sanitizeTicketText("a\n\n\n\n\n\nb"), "a\n\n\nb");
eq(
  "comparison signs kept",
  m.sanitizeTicketText("speed < 2 Mbps and > 1"),
  "speed < 2 Mbps and > 1",
);
eq("capped", m.sanitizeTicketText("x".repeat(30), 10).length, 10);
eq("trimmed", m.sanitizeTicketText("  hi  "), "hi");

// markdown-lite
eq("lite tokens", m.liteBlocks("Line **bold** and `code`\n- item one\n\nend"), [
  {
    t: "p",
    parts: [
      { t: "text", v: "Line " },
      { t: "bold", v: "bold" },
      { t: "text", v: " and " },
      { t: "code", v: "code" },
    ],
  },
  { t: "li", parts: [{ t: "text", v: "item one" }] },
  { t: "p", parts: [{ t: "text", v: "end" }] },
]);
eq("html stays text in tokens", m.liteBlocks("<b>x</b>")[0].parts[0], { t: "text", v: "<b>x</b>" });

// raise ticket
const types = [
  { id: "t-rfo", name: "No connection", sla_minutes: 240, requires_rfo: true, active: true },
  { id: "t-free", name: "Billing", sla_minutes: null, requires_rfo: false, active: true },
];
const ids = { isp_customer_id: "c1", subscriber_id: "s1" };
const form = (p) => ({ ...m.EMPTY_TICKET, subject: "No internet", ...p });
const ok = m.buildTicketBody(form({ description: "<i>since</i> morning" }), types, ids);
eq("body keys = JAZE-5 IspAppsTicketCreateRequest", Object.keys(ok.body).sort(), [
  "assignee_user_id",
  "close_after_raising",
  "description",
  "isp_customer_id",
  "priority",
  "resolution_note",
  "rfo_reason",
  "source",
  "subject",
  "subscriber_id",
  "type_id",
]);
eq("description sanitised", ok.body.description, "since morning");
eq("auto assignee = null", ok.body.assignee_user_id, null);
eq("no type = null", ok.body.type_id, null);
eq("subject required", m.buildTicketBody(form({ subject: "  " }), types, ids).ok, false);
eq(
  "subject one line",
  m.buildTicketBody(form({ subject: "a\nb" }), types, ids).body.subject,
  "a b",
);
const close = form({ type_id: "t-rfo", close_after_raising: true });
eq("close + RFO type needs a reason", m.buildTicketBody(close, types, ids).ok, false);
eq("rfoRequired", m.rfoRequired(close, types), true);
eq(
  "close + reason ok",
  m.buildTicketBody({ ...close, rfo_reason: "cpe_fault", resolution_note: "rebooted" }, types, ids)
    .body,
  {
    ...ok.body,
    description: null,
    type_id: "t-rfo",
    close_after_raising: true,
    rfo_reason: "cpe_fault",
    resolution_note: "rebooted",
  },
);
eq(
  "close on a no-RFO type ok without reason",
  m.buildTicketBody(form({ type_id: "t-free", close_after_raising: true }), types, ids).ok,
  true,
);
eq(
  "RFO not sent unless closing",
  m.buildTicketBody(form({ type_id: "t-rfo", rfo_reason: "upstream" }), types, ids).body.rfo_reason,
  null,
);
eq("sources = JAZE-5 TicketSource", m.SOURCE_OPTIONS.map((o) => o.value).sort(), [
  "email",
  "field",
  "other",
  "phone",
  "portal",
  "walk_in",
  "whatsapp",
]);
eq("RFO reasons = JAZE-5 RfoReason", m.RFO_OPTIONS.map((o) => o.value).sort(), [
  "cpe_fault",
  "fiber_cut",
  "other",
  "power_olt",
  "upstream",
]);

// validity
eq("left", m.validityLeft(2 * 86400 + 3 * 3600), "2 d 3 h left");
eq("ended", m.validityLeft(-90 * 60), "Ended 1 h 30 min ago");
eq("none", m.validityLeft(null), "No end date");

// source checks
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const wb = read("src/components/isp-partner/subscribers/workbench/Workbench.tsx");
eq("no innerHTML in the workbench", wb.includes("dangerouslySetInnerHTML"), false);
eq("no TinyMCE / rich editor", /tinymce|contenteditable/i.test(wb), false);
eq("no IPTV / OTT / Voice services", /\b(IPTV|OTT|Voice)\b/.test(wb), false);
const page = read("src/components/isp-partner/subscribers/Subscriber360Page.tsx");
eq(
  "live bar keeps today's bar as fallback",
  /<LiveBarSlot[\s\S]*fallback=[\s\S]*<LiveBar s=\{s\}/.test(page),
  true,
);
eq(
  "auth matrix keeps today's chips as fallback",
  /<AuthSlot[\s\S]*fallback=[\s\S]*label="MAC bound"/.test(page),
  true,
);
for (const c of [
  "WorkbenchBreadcrumb",
  "WorkbenchHeaderActions",
  "ContactCard",
  "WorkbenchAccordions",
])
  eq(`${c} mounted`, page.includes(`<${c} s={s}`), true);
const net = read("src/components/isp-partner/network/SubscriberNetworkPanel.tsx");
eq(
  "MAC removal offers Disconnect now",
  net.includes('label: "Disconnect now"') &&
    net.includes("disconnectRemovedMac(subscriberId, b.mac)"),
  true,
);

console.log(`\n${checks - failures}/${checks} passed`);
process.exit(failures ? 1 : 0);
