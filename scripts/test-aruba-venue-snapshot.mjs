/**
 * Aruba Instant On venue liveness (DASHBOARD_PLAN P1-F) and the persisted
 * venue snapshot (P1-J), the pure halves -- bundled with esbuild and run.
 *
 *   1. MIKROTIK AND OMADA ARE UNCHANGED. `deriveRouterLiveness` /
 *      `deriveLocationLiveness` give the SAME verdict for MikroTik and Omada
 *      rows whether or not a stray `last_radius_at` is on them; the snapshot
 *      rules never refresh or replace a MikroTik/Omada snapshot.
 *   2. P1-F: an Aruba row's `last_radius_at` becomes "Guest sign-ins working
 *      · last activity X ago" (< 60 min) or "No guest activity for Xh"; the
 *      state stays `unknown` (neutral tone, no gate moves); never "Offline"
 *      or "Unknown"; no `last_radius_at` keeps "Set up in Instant On".
 *   3. P1-J: only an Aruba snapshot is ever re-read or replaced; a failed
 *      fresh read never replaces it. A failed-read, MikroTik or Omada
 *      snapshot is never re-read or written (owner rule: zero change there).
 *
 * Run: node scripts/test-aruba-venue-snapshot.mjs
 */
import { build } from "esbuild";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
let ran = 0;
let failures = 0;
const check = (name, ok, extra = "") => {
  ran += 1;
  if (ok) console.log(`  ok   ${name}`);
  else {
    failures += 1;
    console.log(`  FAIL ${name}${extra ? ` -- ${extra}` : ""}`);
  }
};

const outdir = mkdtempSync(join(tmpdir(), "aruba-venue-snapshot-"));
const entry = join(outdir, "entry.mjs");
const src = (p) => join(ROOT, p).replace(/\\/g, "/");
writeFileSync(
  entry,
  `export { deriveLocationLiveness, deriveRouterLiveness, livenessTone, guestActivityCopy, quietSpell }
     from "${src("src/lib/location-liveness.ts")}";
   export { livenessIsFailedRead, venueSnapshotNeedsRefresh, reconcileVenueLiveness, effectiveVenueLiveness }
     from "${src("src/lib/venue-snapshot.ts")}";`,
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
const L = await import(outfile);

const NOW = new Date("2026-10-04T10:00:00.000Z");
const ago = (min) => new Date(NOW.getTime() - min * 60_000).toISOString();
const row = (vendor, extra = {}) => ({
  id: "r1",
  name: "Gateway",
  status: vendor === "mikrotik" ? "online" : "pending_provisioning",
  last_seen_at: vendor === "mikrotik" ? ago(1) : null,
  vendor,
  ...extra,
});

console.log("\n1. MikroTik and Omada verdicts are unchanged");
for (const vendor of ["mikrotik", "tplink_omada"]) {
  for (const extra of [{}, { status: "offline" }, { controller_state: "reachable" }]) {
    const plain = L.deriveLocationLiveness([row(vendor, extra)], NOW);
    const stray = L.deriveLocationLiveness(
      [row(vendor, { ...extra, last_radius_at: ago(2) })],
      NOW,
    );
    check(
      `${vendor} ${JSON.stringify(extra)}: a stray last_radius_at changes nothing`,
      JSON.stringify(plain) === JSON.stringify(stray),
    );
    check(
      `${vendor} ${JSON.stringify(extra)}: no lastGuestActivityIso`,
      !("lastGuestActivityIso" in plain),
    );
    check(`${vendor}: snapshot never refreshed`, !L.venueSnapshotNeedsRefresh(plain));
    check(
      `${vendor}: never written over by a fresh ${vendor} read`,
      L.reconcileVenueLiveness(plain, stray) === null,
    );
    check(
      `${vendor}: a failed fresh read renders as before (fresh verdict)`,
      L.effectiveVenueLiveness(L.deriveLocationLiveness(null), plain).state === "unknown" &&
        L.effectiveVenueLiveness(L.deriveLocationLiveness(null), plain).routers.length === 0,
    );
  }
}
{
  const mixed = [row("mikrotik"), row("aruba_instant_on", { id: "r2", last_radius_at: ago(2) })];
  const v = L.deriveLocationLiveness(mixed, NOW);
  const plainMixed = L.deriveLocationLiveness(
    [row("mikrotik"), row("aruba_instant_on", { id: "r2" })],
    NOW,
  );
  check(
    "mixed MikroTik + Aruba venue: verdict unchanged by last_radius_at",
    JSON.stringify(v) === JSON.stringify(plainMixed),
  );
  check("mixed venue: no venue-level lastGuestActivityIso", !("lastGuestActivityIso" in v));
}

console.log("\n2. Aruba guest activity (P1-F)");
{
  const none = L.deriveLocationLiveness([row("aruba_instant_on")], NOW);
  check(
    "no last_radius_at: Set up in Instant On kept",
    none.label === "Set up in Instant On",
    none.label,
  );
  for (const [min, label, sentence] of [
    [0.2, "Guest sign-ins working", "Guest sign-ins working · last activity just now"],
    [4, "Guest sign-ins working", "Guest sign-ins working · last activity 4 minutes ago"],
    [59, "Guest sign-ins working", "Guest sign-ins working · last activity 59 minutes ago"],
    [61, "No recent guest activity", "No guest activity for 1h"],
    [180, "No recent guest activity", "No guest activity for 3h"],
    [60 * 50, "No recent guest activity", "No guest activity for 2 days"],
  ]) {
    const v = L.deriveLocationLiveness(
      [row("aruba_instant_on", { last_radius_at: ago(min) })],
      NOW,
    );
    check(`${min} min: label "${label}"`, v.label === label, v.label);
    check(`${min} min: "${sentence}"`, v.summary === sentence, v.summary);
    check(
      `${min} min: state unknown, neutral tone`,
      v.state === "unknown" && L.livenessTone(v.state) === "neutral",
    );
    check(`${min} min: never Offline/Unknown`, !/offline|unknown/i.test(`${v.label} ${v.summary}`));
    check(`${min} min: router row stays not-applicable`, v.routers[0].state === "not-applicable");
  }
  for (const bad of ["not-a-date", "2026-10-05T10:00:00.000Z"]) {
    const v = L.deriveLocationLiveness([row("aruba_instant_on", { last_radius_at: bad })], NOW);
    check(
      `unusable last_radius_at ${bad}: Set up in Instant On`,
      v.label === "Set up in Instant On",
      v.label,
    );
  }
  const two = L.deriveLocationLiveness(
    [
      row("aruba_instant_on", { last_radius_at: ago(300) }),
      row("aruba_instant_on", { id: "r2", last_radius_at: ago(3) }),
    ],
    NOW,
  );
  check("two APs: newest activity speaks", /3 minutes ago/.test(two.summary), two.summary);
  check("two APs: lastGuestActivityIso is the newest", two.lastGuestActivityIso === ago(3));
  const routerOnly = L.deriveLocationLiveness(
    [row("aruba_instant_on", { last_radius_at: ago(4) })],
    NOW,
  ).routers[0];
  check("router badge: Guest sign-ins working", routerOnly.shortLabel === "Guest sign-ins working");
  check(
    "router detail names the activity",
    /last activity 4 minutes ago/.test(routerOnly.detail),
    routerOnly.detail,
  );
  const declared = L.deriveLocationLiveness(
    [row("aruba_instant_on", { controller_state: "no_controller_api", last_radius_at: ago(120) })],
    NOW,
  );
  check(
    "controller_state no_controller_api + 2h: No recent guest activity",
    declared.label === "No recent guest activity" &&
      declared.routers[0].shortLabel === "No recent guest activity",
    declared.label,
  );
  const perRouter = L.deriveRouterLiveness(
    row("aruba_instant_on", { last_radius_at: ago(4) }),
    NOW,
  );
  check(
    "per-router callers (Master fleet, Fix-a-Problem) unchanged",
    perRouter.shortLabel === "Set up in Instant On",
    perRouter.shortLabel,
  );
}

console.log("\n3. The venue snapshot (P1-J)");
{
  const aruba = L.deriveLocationLiveness(
    [row("aruba_instant_on", { last_radius_at: ago(4) })],
    NOW,
  );
  const failed = L.deriveLocationLiveness(null);
  const mikrotik = L.deriveLocationLiveness([row("mikrotik")], NOW);
  check("failed read is a failed read", L.livenessIsFailedRead(failed));
  check("missing liveness is a failed read", L.livenessIsFailedRead(undefined));
  check(
    "no-router venue is NOT a failed read",
    !L.livenessIsFailedRead(L.deriveLocationLiveness([], NOW)),
  );
  check("Aruba snapshot refreshes on load", L.venueSnapshotNeedsRefresh(aruba));
  check(
    "failed snapshot is NOT re-read on load (as origin/staging)",
    !L.venueSnapshotNeedsRefresh(failed),
  );
  check("missing snapshot is NOT re-read on load", !L.venueSnapshotNeedsRefresh(undefined));
  check(
    "CHECKING snapshot is NOT re-read on load",
    !L.venueSnapshotNeedsRefresh(L.deriveLocationLiveness(null)),
  );
  check("failed fresh read never replaces Aruba", L.reconcileVenueLiveness(aruba, failed) === null);
  check(
    "failed snapshot + Aruba read -> left alone (as origin/staging)",
    L.reconcileVenueLiveness(failed, aruba) === null,
  );
  check(
    "Aruba snapshot + fresh Aruba -> fresh stored",
    L.reconcileVenueLiveness(aruba, aruba) === aruba,
  );
  check(
    "Aruba snapshot + MikroTik read -> MikroTik stored",
    L.reconcileVenueLiveness(aruba, mikrotik) === mikrotik,
  );
  check(
    "failed snapshot + MikroTik read -> left alone",
    L.reconcileVenueLiveness(failed, mikrotik) === null,
  );
  check("render: failed fresh read keeps Aruba", L.effectiveVenueLiveness(failed, aruba) === aruba);
  check("render: good fresh read wins", L.effectiveVenueLiveness(mikrotik, aruba) === mikrotik);
  check(
    "render: undefined fresh stays undefined",
    L.effectiveVenueLiveness(undefined, aruba) === undefined,
  );
}

console.log(`\n${ran} checks ran`);
if (failures) {
  console.log(`aruba venue snapshot: ${failures} FAILED`);
  process.exit(1);
}
console.log("aruba venue snapshot: all checks passed");
