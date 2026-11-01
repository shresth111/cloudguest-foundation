/**
 * Subscriber 360 pure helpers (`src/lib/isp-partner/subscribers360.ts`,
 * ADDENDUM_05 JAZE-1): profile draft -> API body (matches the BE
 * `ProfileBody`, extra=forbid), rupee/paise, action gating per display state,
 * and the datetime-local round trip (must not drift by the zone offset).
 *
 * Run: TZ=Asia/Kolkata node scripts/test-isp-partner-sub360.mjs
 */
import { build } from "esbuild";
import { mkdirSync, mkdtempSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
mkdirSync(join(ROOT, "node_modules/.cache"), { recursive: true });
const outdir = mkdtempSync(join(ROOT, "node_modules/.cache/isp-sub360-"));
const outfile = join(outdir, "sub360.mjs");
await build({
  entryPoints: [join(ROOT, "src/lib/isp-partner/subscribers360.ts")],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile,
  logLevel: "silent",
  alias: { "@": join(ROOT, "src") },
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

// The keys of the BE ProfileBody (subscriber360_router.py). extra=forbid, so
// a stray key is a 422.
const PROFILE_BODY_KEYS = [
  "alt_email",
  "gender",
  "billing_city",
  "billing_pincode",
  "install_same_as_billing",
  "install_address",
  "install_area",
  "install_building",
  "install_city",
  "install_pincode",
  "latitude",
  "longitude",
  "installed_at",
  "user_type",
  "connection_type",
  "ont_serial",
  "stb_serial",
  "override_price_paise",
  "billing_anchor_day",
  "after_due_action",
  "exclude_reminders",
  "activation_at",
  "comments",
].sort();

console.log("money");
eq("499 -> 49900", m.rupeesToPaise("499"), 49900);
eq("₹ 1,499.5 -> 149950", m.rupeesToPaise("₹ 1,499.5"), 149950);
eq("0.29 no float error", m.rupeesToPaise("0.29"), 29);
eq("3 decimals refused", m.rupeesToPaise("1.234"), null);
eq("blank -> null", m.rupeesToPaise("  "), null);
eq("paise -> input 149905", m.paiseToRupeesInput(149905), "1499.05");
eq("paise -> input 49900", m.paiseToRupeesInput(49900), "499");
eq("paise null -> ''", m.paiseToRupeesInput(null), "");

console.log("draftToProfile");
const blank = {
  install_same_as_billing: true,
  exclude_reminders: false,
  user_type: "home",
  after_due_action: "suspend",
};
const r0 = m.draftToProfile(blank);
eq("blank draft ok", "body" in r0, true);
eq("body keys == BE ProfileBody keys", Object.keys(r0.body).sort(), PROFILE_BODY_KEYS);
eq(
  "blank -> nulls",
  [r0.body.alt_email, r0.body.latitude, r0.body.activation_at],
  [null, null, null],
);
const full = m.draftToProfile({
  ...blank,
  install_same_as_billing: false,
  install_address: "12 MG Road",
  install_pincode: "110001",
  billing_pincode: "560001",
  latitude: "28.61",
  longitude: "77.2",
  override_price: "499.50",
  billing_anchor_day: "5",
  alt_email: "a@b.in",
});
eq("override price -> paise", full.body.override_price_paise, 49950);
eq("anchor day -> int", full.body.billing_anchor_day, 5);
eq("install address kept when not same", full.body.install_address, "12 MG Road");
eq("lat/long numbers", [full.body.latitude, full.body.longitude], [28.61, 77.2]);
const same = m.draftToProfile({ ...blank, install_address: "ignored" });
eq("same-as-billing clears install_*", same.body.install_address, null);
eq(
  "bad PIN",
  m.draftToProfile({ ...blank, billing_pincode: "012345" }).error,
  "Billing PIN code is 6 digits.",
);
eq("lat out of range", "error" in m.draftToProfile({ ...blank, latitude: "91" }), true);
eq(
  "anchor day 29 refused",
  "error" in m.draftToProfile({ ...blank, billing_anchor_day: "29" }),
  true,
);
eq("price 0 refused", "error" in m.draftToProfile({ ...blank, override_price: "0" }), true);
eq("bad alt email", "error" in m.draftToProfile({ ...blank, alt_email: "nope" }), true);

console.log("datetime round trip (no zone drift)");
const iso = "2026-11-02T04:30:00+00:00"; // 10:00 IST
const local = m.isoToLocalInput(iso);
if (process.env.TZ === "Asia/Kolkata")
  eq("UTC 04:30 -> IST input 10:00", local, "2026-11-02T10:00");
const back = m.draftToProfile({ ...blank, activation_at: local }).body.activation_at;
eq("input -> ISO is the same instant", new Date(back).getTime(), new Date(iso).getTime());
eq("null iso -> ''", m.isoToLocalInput(null), "");
eq("bad iso -> ''", m.isoToLocalInput("garbage"), "");
eq("date-only view", m.isoToLocalDate("2026-11-02T06:30:00+00:00").length, 10);

console.log("allowedActions");
const a = (s, r = true) => m.allowedActions(s, r);
eq(
  "active: renew/freeze/grace",
  [a("active").renew, a("active").freeze, a("active").grace],
  [true, true, true],
);
eq("grace: no second grace", a("grace").grace, false);
eq("blocked: unblock, no renew", [a("blocked").unblock, a("blocked").renew], [true, false]);
eq("perm blocked: no block again", a("permanently_blocked").block, false);
eq(
  "frozen: unfreeze only",
  [a("frozen").unfreeze, a("frozen").freeze, a("frozen").revert],
  [true, false, false],
);
eq("revert needs can_revert", a("active", false).revert, false);

console.log("labels");
eq("state label", m.stateLabel("permanently_blocked"), "Permanently blocked");
eq("unknown state passes through", m.stateLabel("weird"), "weird");
eq("event label fallback", m.eventLabel("fup_throttle"), "fup throttle");
eq(
  "idempotency key 8-64 chars",
  (() => {
    const k = m.idempotencyKey();
    return k.length >= 8 && k.length <= 64;
  })(),
  true,
);

console.log(`\n${checks - failures}/${checks} passed`);
if (failures) process.exit(1);
