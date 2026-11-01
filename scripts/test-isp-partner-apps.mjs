/**
 * APPS-FE over JAZE-5 (`/isp/apps/*`):
 * - the pure helpers in `src/lib/isp-partner/apps.ts` (transition maps that
 *   mirror apps_tasks / apps_inventory, the RFO rule of apps_helpdesk,
 *   body builders for discounts / announcements / leads);
 * - `src/services/isp-partner/apps.ts`: every one of the 45 backend routes
 *   (method + path from apps_router.py on integ) is reached by some service
 *   call, and dated filters are plain YYYY-MM-DD.
 * `@/services/api` is replaced with a recorder; nothing goes on the network.
 *
 * Run: TZ=Asia/Kolkata node scripts/test-isp-partner-apps.mjs
 */
import { build } from "esbuild";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
mkdirSync(join(ROOT, "node_modules/.cache"), { recursive: true });
const outdir = mkdtempSync(join(ROOT, "node_modules/.cache/isp-apps-"));
const stub = join(outdir, "api-stub.mjs");
writeFileSync(
  stub,
  `export const calls = [];
   const rec = (method) => async (url, a, b) => {
     const cfg = method === "get" || method === "delete" ? a : b;
     calls.push({ method, url, params: cfg?.params ?? {}, body: method === "get" || method === "delete" ? undefined : a, cfg });
     return { data: { items: [] }, headers: {} };
   };
   export const requestErrorOf = () => null;
   export default { get: rec("get"), post: rec("post"), put: rec("put"), patch: rec("patch"), delete: rec("delete") };`,
);
const outfile = join(outdir, "apps.mjs");
await build({
  stdin: {
    contents: `export * from "@/lib/isp-partner/apps";
               export { appsService } from "@/services/isp-partner/apps";
               export { calls } from "@/services/api";`,
    resolveDir: ROOT,
    loader: "ts",
  },
  bundle: true,
  format: "esm",
  platform: "node",
  outfile,
  logLevel: "silent",
  alias: { "@": join(ROOT, "src") },
  plugins: [
    {
      name: "api-stub",
      setup(b) {
        b.onResolve({ filter: /^@\/services\/api$/ }, () => ({ path: stub }));
      },
    },
  ],
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

console.log("helpdesk rules (apps_helpdesk)");
eq("untyped ticket needs no RFO", m.needsRfo(null), false);
eq("type with requires_rfo", m.needsRfo({ requires_rfo: true }), true);
eq("type without", m.needsRfo({ requires_rfo: false }), false);
const t = { status: "open", rfo_reason: null };
eq(
  "resolve without RFO refused for an RFO type",
  "error" in m.ticketStatusBody("resolved", t, { requires_rfo: true }, "", ""),
  true,
);
eq(
  "resolve with RFO",
  m.ticketStatusBody("resolved", t, { requires_rfo: true }, "fiber_cut", " spliced ").body,
  {
    status: "resolved",
    rfo_reason: "fiber_cut",
    resolution_note: "spliced",
  },
);
eq("resolve untyped without RFO", m.ticketStatusBody("closed", t, null, "", "").body, {
  status: "closed",
});
eq(
  "existing RFO counts",
  "body" in
    m.ticketStatusBody(
      "resolved",
      { status: "open", rfo_reason: "upstream" },
      { requires_rfo: true },
      "",
      "",
    ),
  true,
);
eq("same status refused", "error" in m.ticketStatusBody("open", t, null, "", ""), true);
eq(
  "in progress has no RFO",
  m.ticketStatusBody("in_progress", t, { requires_rfo: true }, "", "").body,
  { status: "in_progress" },
);
const now = Date.parse("2026-11-01T10:00:00Z");
eq(
  "sla due",
  m.slaText(
    { sla_state: "within", due_at: "2026-11-01T13:00:00Z", status: "open", tat_minutes: null },
    now,
  ),
  "Due in 3 h",
);
eq(
  "sla breached",
  m.slaText(
    { sla_state: "breached", due_at: "2026-11-01T09:30:00Z", status: "open", tat_minutes: null },
    now,
  ),
  "Breached 30 min ago",
);
eq(
  "sla none",
  m.slaText({ sla_state: "no_sla", due_at: null, status: "open", tat_minutes: null }, now),
  "No SLA",
);
eq(
  "resolved late",
  m.slaText(
    { sla_state: "breached", due_at: "2026-11-01T09:00:00Z", status: "resolved", tat_minutes: 100 },
    now,
  ),
  "Resolved late",
);
eq(
  "sla hours -> minutes",
  [m.slaMinutes("4"), m.slaMinutes(""), m.slaMinutes("0"), m.slaMinutes("2000")],
  [240, null, "bad", "bad"],
);

console.log("tasks (apps_tasks.TASK_TRANSITIONS)");
eq("unclaimed ->", m.taskNext("unclaimed"), ["assigned", "cancelled"]);
eq("completed is final", m.taskNext("completed"), []);
eq("unknown future state -> no buttons", m.taskNext("awaiting_parts"), []);
eq("view unclaimed", m.taskQuery("unclaimed", { page: 2 }), { page: 2, status: "unclaimed" });
eq("view mine", m.taskQuery("mine"), { mine: true });
eq("reject needs a reason", "error" in m.taskStatusBody("rejected", "", " "), true);
eq("complete with note", m.taskStatusBody("completed", " fitted ", "").body, {
  status: "completed",
  completion_note: "fitted",
});

console.log("inventory (apps_inventory.UNIT_TRANSITIONS)");
eq("in stock ->", m.unitNext("in_stock"), ["assigned", "faulty", "retired"]);
eq("assigned ->", m.unitNext("assigned"), ["returned", "faulty"]);
eq("retired is final", m.unitNext("retired"), []);
eq("csv only", typeof m.importProblem({ size: 10, name: "units.xlsx" }), "string");
eq("csv 512 KB cap", typeof m.importProblem({ size: 600 * 1024, name: "u.csv" }), "string");
eq("csv ok", m.importProblem({ size: 100, name: "u.CSV" }), null);
eq("template header", m.UNIT_CSV_TEMPLATE, "serial,sku,mac,note\n");

console.log("discounts");
const d0 = {
  ...m.emptyDiscount(),
  code: "monsoon-10",
  kind: "percent",
  value: "10",
  max_discount: "150",
};
eq("create percent", m.discountBody(d0, true).body, {
  code: "MONSOON-10",
  kind: "percent",
  value: 10,
  description: null,
  max_discount_paise: 15000,
  min_amount_paise: null,
  max_uses: null,
  valid_from: null,
  valid_until: null,
  active: true,
});
eq("flat in paise", m.discountBody({ ...d0, kind: "flat", value: "99.50" }, true).body.value, 9950);
eq("percent over 100 refused", "error" in m.discountBody({ ...d0, value: "120" }, true), true);
eq("bad code refused", "error" in m.discountBody({ ...d0, code: "x y" }, true), true);
eq(
  "patch never sends code/kind/value",
  ["code", "kind", "value"].some((k) => k in m.discountBody(d0, false).body),
  false,
);
const local = m.discountBody(
  { ...d0, valid_from: "2026-11-01", valid_until: "2026-11-30" },
  true,
).body;
eq("valid_from = local start of day", new Date(local.valid_from).getHours(), 0);
eq("valid_until = local end of day", new Date(local.valid_until).getHours(), 23);
eq(
  "reversed dates refused",
  "error" in m.discountBody({ ...d0, valid_from: "2026-11-30", valid_until: "2026-11-01" }, true),
  true,
);

console.log("announcements / leads");
eq(
  "selected needs customers",
  "error" in
    m.announcementBody({
      title: "t",
      body: "b",
      audience: "selected",
      customer_ids: [],
      send_email: true,
    }),
  true,
);
eq(
  "all clears ids",
  m.announcementBody({
    title: " t ",
    body: " b ",
    audience: "all",
    customer_ids: ["x"],
    send_email: false,
  }).body,
  {
    title: "t",
    body: "b",
    audience: "all",
    customer_ids: [],
    send_email: false,
  },
);
const lb = m.leadBody({
  name: " Asha ",
  phone: " 98765 ",
  email: "",
  address: "",
  city: "",
  source: "phone",
  isp_customer_id: "",
  interested_package_id: "",
  notes: "",
});
eq("lead body nulls", lb.body, {
  name: "Asha",
  phone: "98765",
  email: null,
  address: null,
  city: null,
  source: "phone",
  isp_customer_id: null,
  interested_package_id: null,
  notes: null,
});
eq(
  "lead bad email",
  "error" in
    m.leadBody({
      name: "a",
      phone: "",
      email: "x",
      address: "",
      city: "",
      source: "phone",
      isp_customer_id: "",
      interested_package_id: "",
      notes: "",
    }),
  true,
);
eq("dropping needs a reason", "error" in m.leadStatusBody("dropped", ""), true);
eq("dropped body", m.leadStatusBody("dropped", "too far").body, {
  status: "dropped",
  dropped_reason: "too far",
});
eq("converted only via convert", "error" in m.leadStatusBody("converted", ""), true);
eq("converted lead has no status moves", m.leadPatchStatuses("converted"), []);
eq(
  "convert goes through CAF when it is on",
  [m.convertRoute(true), m.convertRoute(false)],
  ["caf", "apps"],
);
eq(
  "unknown status label readable",
  m.label(m.TASK_STATUS_LABEL, "awaiting_parts"),
  "Awaiting parts",
);

console.log("every backend route is reached (apps_router.py on integ, 45 routes)");
const ROUTES =
  `GET /ticket-types|POST /ticket-types|POST /ticket-types/defaults|PATCH /ticket-types/:id|GET /tickets|GET /tickets/stats|GET /tickets/export.csv|POST /tickets|GET /tickets/:id|PATCH /tickets/:id|POST /tickets/:id/comments|GET /tasks|GET /tasks/export.csv|POST /tasks|GET /tasks/:id|POST /tasks/:id/claim|PATCH /tasks/:id|GET /announcements|POST /announcements|GET /announcements/:id|PATCH /announcements/:id|DELETE /announcements/:id|POST /announcements/:id/send|GET /discounts|POST /discounts|POST /discounts/preview|PATCH /discounts/:id|GET /discounts/:id/redemptions|GET /inventory/items|POST /inventory/items|PATCH /inventory/items/:id|GET /inventory/units|GET /inventory/units/export.csv|POST /inventory/units|POST /inventory/units/import|GET /inventory/units/:id|POST /inventory/units/:id/move|GET /leads|GET /leads/export.csv|GET /leads/funnel|POST /leads|GET /leads/:id|PATCH /leads/:id|POST /leads/:id/install|POST /leads/:id/convert`.split(
    "|",
  );
const s = m.appsService;
const ID = "11111111-2222-3333-4444-555555555555";
const file = new Blob(["serial,sku\n"], { type: "text/csv" });
await s.probe();
await s.ticketTypes();
await s.createTicketType({ name: "x" });
await s.seedTicketTypes();
await s.patchTicketType(ID, { active: false });
await s.tickets({ since: "2026-10-01", until: "2026-10-31" });
const ticketsCall = m.calls.at(-1);
await s.ticketStats({ since: "2026-10-01" });
await s.ticketsCsv({ status: "open", page: 2 });
const csvCall = m.calls.at(-1);
await s.createTicket({
  isp_customer_id: ID,
  subject: "s",
  source: "phone",
  priority: "normal",
  close_after_raising: false,
});
await s.ticket(ID);
await s.patchTicket(ID, { status: "resolved" });
await s.comment(ID, "hi");
await s.tasks({ mine: true });
await s.tasksCsv({ mine: true });
const tasksCsvCall = m.calls.at(-1);
await s.createTask({ title: "t" });
await s.task(ID);
await s.claimTask(ID);
await s.patchTask(ID, { status: "completed" });
await s.announcements();
await s.createAnnouncement({ title: "t", body: "b" });
await s.announcement(ID);
await s.patchAnnouncement(ID, { title: "t" });
await s.deleteAnnouncement(ID);
await s.sendAnnouncement(ID);
await s.discounts({ active: true });
await s.createDiscount({ code: "ABC", kind: "flat", value: 100 });
await s.previewDiscount({ code: "ABC", gross_paise: 100 });
await s.patchDiscount(ID, { active: false });
await s.redemptions(ID);
await s.items();
await s.createItem({ name: "n", sku: "s", category: "ont" });
await s.patchItem(ID, { name: "n" });
await s.units({ state: "in_stock" });
await s.unitsCsv({});
await s.addUnit({ item_id: ID, serial: "S1" });
await s.importUnits(file);
const importCall = m.calls.at(-1);
await s.unit(ID);
await s.moveUnit(ID, { state: "assigned" });
await s.leads({});
await s.leadsCsv({});
await s.funnel();
await s.createLead({ name: "n" });
await s.lead(ID);
await s.patchLead(ID, { status: "contacted" });
await s.scheduleInstall(ID, {});
await s.convertLead(ID, { identifier: "9876500000" });
const seen = new Set(
  m.calls
    .filter((c) => c.url.startsWith("/isp/apps"))
    .map(
      (c) => `${c.method.toUpperCase()} ${c.url.replace("/isp/apps", "").replaceAll(ID, ":id")}`,
    ),
);
const missing = ROUTES.filter((r) => !seen.has(r));
eq("all 45 routes reached", missing, []);
eq(
  "no call outside the 45",
  [...seen].filter((r) => !ROUTES.includes(r)),
  [],
);
eq(
  "ticket since/until are plain dates",
  [ticketsCall.params.since, ticketsCall.params.until],
  ["2026-10-01", "2026-10-31"],
);
eq(
  "CSV export drops paging",
  ["page", "page_size"].some((k) => k in csvCall.params),
  false,
);
eq("task CSV drops 'mine' (not an export param)", "mine" in tasksCsvCall.params, false);
eq(
  "import is multipart",
  [importCall.body instanceof FormData, importCall.cfg.headers["Content-Type"]],
  [true, undefined],
);

console.log(`\n${checks - failures}/${checks} passed`);
if (failures) process.exit(1);
