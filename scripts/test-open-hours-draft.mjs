/**
 * Regression test for the Open Hours page's explicit-Save flow.
 *
 * The page edits a local draft and persists only on Save. That only works
 * if (1) "dirty" means a real difference, not a different spelling of the
 * same schedule, (2) the client rejects exactly what the backend's
 * `validate_business_hours_schedule` rejects, and (3) the component is
 * actually wired to those helpers, sends the real PUT, and no longer
 * renders the guest preview panel.
 *
 * Same harness as scripts/test-customer-kpis.mjs: the pure helpers are
 * bundled with esbuild and run for real; wiring is checked in the source.
 *
 * Run: node scripts/test-open-hours-draft.mjs
 */
import { build } from "esbuild";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");

let failures = 0;
let checks = 0;
function check(name, ok, extra = "") {
  checks += 1;
  if (ok) {
    console.log(`  ok   ${name}`);
  } else {
    failures += 1;
    console.log(`  FAIL ${name}${extra ? ` -- ${extra}` : ""}`);
  }
}

const outdir = mkdtempSync(join(tmpdir(), "open-hours-draft-"));
const entry = join(outdir, "entry.mjs");
writeFileSync(
  entry,
  `export * from "${join(ROOT, "src/lib/open-hours-draft.ts").replace(/\\/g, "/")}";`,
);
const outfile = join(outdir, "bundle.mjs");
await build({
  entryPoints: [entry],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile,
  logLevel: "silent",
});
const { normalizeOpenHoursDraft, openHoursDraftsEqual, validateOpenHoursSchedule } = await import(
  `file://${outfile}`
);

const base = {
  enabled: true,
  timezone: "Asia/Kolkata",
  schedule: { monday: { open: true, start: "09:00", end: "21:00" } },
  closedMessage: "Closed",
};
const withSchedule = (schedule) => ({ ...base, schedule });

console.log("\ndirty means a real difference");
check("identical drafts are equal", openHoursDraftsEqual(base, structuredClone(base)));
check(
  "a missing day equals an explicitly closed day",
  openHoursDraftsEqual(base, withSchedule({ ...base.schedule, tuesday: { open: false } })),
);
check(
  "a closed day with leftover times equals a closed day",
  openHoursDraftsEqual(
    base,
    withSchedule({ ...base.schedule, sunday: { open: false, start: "09:00", end: "18:00" } }),
  ),
);
check(
  "changing a time is dirty",
  !openHoursDraftsEqual(
    base,
    withSchedule({ monday: { open: true, start: "10:00", end: "21:00" } }),
  ),
);
check(
  "closing an open day is dirty",
  !openHoursDraftsEqual(base, withSchedule({ monday: { open: false } })),
);
check("toggling enforcement is dirty", !openHoursDraftsEqual(base, { ...base, enabled: false }));
check("changing timezone is dirty", !openHoursDraftsEqual(base, { ...base, timezone: "UTC" }));
check(
  "changing the closed message is dirty",
  !openHoursDraftsEqual(base, { ...base, closedMessage: "Back at 9" }),
);
const norm = normalizeOpenHoursDraft(base);
check("normalize fills all seven days", Object.keys(norm.schedule).length === 7);
check(
  "normalize strips times off closed days",
  JSON.stringify(
    normalizeOpenHoursDraft(withSchedule({ friday: { open: false, start: "1" } })).schedule.friday,
  ) === JSON.stringify({ open: false }),
);

console.log("\nvalidation matches the backend");
const v = (day) => validateOpenHoursSchedule({ monday: day });
check(
  "a normal day is valid",
  Object.keys(v({ open: true, start: "09:00", end: "21:00" })).length === 0,
);
check("a closed day is valid", Object.keys(v({ open: false })).length === 0);
check(
  "open all day (00:00-23:59) is valid",
  !v({ open: true, start: "00:00", end: "23:59" }).monday,
);
check(
  "close before open is rejected",
  Boolean(v({ open: true, start: "21:00", end: "09:00" }).monday),
);
check(
  "close equal to open is rejected",
  Boolean(v({ open: true, start: "09:00", end: "09:00" }).monday),
);
check(
  "overnight message says so",
  /overnight/i.test(v({ open: true, start: "22:00", end: "02:00" }).monday ?? ""),
);
check(
  "a cleared start time is rejected",
  Boolean(v({ open: true, start: "", end: "21:00" }).monday),
);
check("a missing end time is rejected", Boolean(v({ open: true, start: "09:00" }).monday));
check(
  "seconds are rejected (backend wants HH:MM)",
  Boolean(v({ open: true, start: "09:00:00", end: "21:00" }).monday),
);
check("24:00 is rejected", Boolean(v({ open: true, start: "09:00", end: "24:00" }).monday));
check(
  "errors are reported per day",
  JSON.stringify(
    Object.keys(
      validateOpenHoursSchedule({
        monday: { open: true, start: "09:00", end: "21:00" },
        wednesday: { open: true, start: "12:00", end: "11:00" },
      }),
    ),
  ) === JSON.stringify(["wednesday"]),
);

console.log("\ncomponent wiring");
const src = readFileSync(join(ROOT, "src/components/features/OperationsFeatures.tsx"), "utf8");
const start = src.indexOf("export function OpenHoursView");
const end = src.indexOf("/* ---------- Top Up Data", start);
const view = src.slice(start, end);
check("OpenHoursView found", start > 0 && end > start);
check("guest preview panel is gone", !/Guest preview/i.test(view));
check(
  "no leftover Apply button",
  !/>\s*\{saving \? "Applying/.test(view) && !/handleApply/.test(view),
);
check("Save button is gated on canSave", /onClick=\{handleSave\} disabled=\{!canSave\}/.test(view));
check("canSave requires dirty and no errors", /canSave\s*=\s*dirty && !hasErrors/.test(view));
check(
  "Discard restores the baseline",
  /function handleDiscard\(\)[\s\S]{0,80}applyDraft\(saved\)/.test(view),
);
check("Save sends the real request", /businessHoursService\.save\(id, sent\)/.test(view));
check(
  "baseline resets only after the request resolves",
  /await businessHoursService\.save\(id, sent\);\s*setSaved\(sent\);/.test(view),
);
check(
  "failure surfaces the backend message",
  /toast\.error\(\(err as AppError\)\.message \|\| "Could not save open hours\."\)/.test(view),
);
check("uses the shared validator", /validateOpenHoursSchedule\(draft\.schedule\)/.test(view));
check("inputs do not auto-save", !/onChange=\{[^}]*businessHoursService/.test(view));

console.log(`\n${checks} checks, ${failures} failed`);
if (failures > 0) process.exit(1);
console.log("all open hours draft checks passed");
