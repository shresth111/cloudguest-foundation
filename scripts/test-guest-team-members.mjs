/**
 * Test for the team-roster wiring that makes "remove a member" usable from
 * the customer Teams screen (`ManageTeamsPage.tsx`), plus the mapping in
 * `guest.service.ts::listTeamMembers`.
 *
 * WHY THIS EXISTS
 * ---------------
 * The backend has always exposed DELETE
 * /guest-teams/{team_id}/members/{guest_id} (remove a member) and the
 * frontend has always shipped `guestService.removeTeamMember` wired to it --
 * but nothing could call it, because the only read that returned members
 * (GET /guest-teams/{id}) returns a member *count*, never a roster. There
 * was no way to learn which guest_id to remove, so a backend-supported
 * management action was dead. This adds the roster read and surfaces
 * removal in the Manage Team dialog.
 *
 * Load-bearing assertions, worst-first:
 *
 *   1. THE MAPPING READS THE FIELDS THE BACKEND ACTUALLY SENDS. guest_id,
 *      display_name, identifier, joined_at, is_active -- reading a name
 *      nobody serves is indistinguishable from missing data at runtime.
 *   2. NULL IDENTITY IS PRESERVED, NEVER FABRICATED. A member whose guest
 *      row is gone comes back with identifier/displayName null, so the UI
 *      can show "Unknown member" rather than inventing one.
 *   3. THE READ IS ORG-SCOPED. When an org id is known it goes out as
 *      X-Organization-Id, so guest_teams.read resolves for an org-scoped
 *      customer session (the endpoint 403s otherwise).
 *   4. REMOVAL IS ACTUALLY WIRED, AND DEMO MODE NEVER HITS THE BACKEND. The
 *      dialog's Remove button calls guestService.removeTeamMember, the
 *      roster loads via listTeamMembers, and both are guarded by `demo` so
 *      the demo persona (no backend) is untouched.
 *
 * WHY IT LOOKS LIKE THIS: this repo has no test runner (see
 * scripts/test-connection-verdicts.mjs for the same note). The service is
 * bundled with esbuild against a mock `@/services/api` and executed for
 * real; the component wiring is checked against the real source.
 *
 * Run: node scripts/test-guest-team-members.mjs
 */
import { build } from "esbuild";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");

let failures = 0;
function check(name, ok, extra = "") {
  if (ok) {
    console.log(`  ok   ${name}`);
  } else {
    failures += 1;
    console.log(`  FAIL ${name}${extra ? ` -- ${extra}` : ""}`);
  }
}
const eq = (name, actual, expected) =>
  check(
    name,
    actual === expected,
    `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
  );

// ---------------------------------------------------------------------------
// Bundle guestService against a mock api and run listTeamMembers for real.
// ---------------------------------------------------------------------------
const outdir = mkdtempSync(join(tmpdir(), "guest-team-members-"));
const mockApi = join(outdir, "mock-api.mjs");
writeFileSync(
  mockApi,
  `export const calls = [];
export let nextResponse = { data: { items: [], total_items: 0 } };
export function setNextResponse(r) { nextResponse = r; }
export const api = {
  async get(url, config) { calls.push({ method: "get", url, config }); return nextResponse; },
  async post() { return { data: {} }; },
  async put() { return { data: {} }; },
  async delete(url, config) { calls.push({ method: "delete", url, config }); return { data: {} }; },
};
`,
);
const entry = join(outdir, "entry.mjs");
writeFileSync(
  entry,
  `export { guestService } from ${JSON.stringify(join(ROOT, "src/services/guest.service.ts"))};\n` +
    `export { calls, setNextResponse } from ${JSON.stringify(mockApi)};\n`,
);
const bundle = join(outdir, "bundle.mjs");
await build({
  entryPoints: [entry],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: bundle,
  logLevel: "silent",
  // `@/...` is the app's own alias for src/ (vite-tsconfig-paths); esbuild
  // needs telling separately. `@/services/api` is redirected to the mock so
  // no real axios/network is pulled in -- the same file the service imports
  // and the entry re-exports, so `calls`/`setNextResponse` share one state.
  alias: { "@/services/api": mockApi, "@": join(ROOT, "src") },
});
const { guestService, calls, setNextResponse } = await import(`file://${bundle}`);

console.log("\nlistTeamMembers maps the fields the backend actually sends");
setNextResponse({
  data: {
    items: [
      {
        id: "m-1",
        team_id: "team-1",
        guest_id: "g-1",
        identifier: "+919876543210",
        display_name: "Ava",
        joined_at: "2026-09-01T10:00:00Z",
        is_active: true,
      },
      {
        id: "m-2",
        team_id: "team-1",
        guest_id: "g-2",
        identifier: null,
        display_name: null,
        joined_at: "2026-09-02T10:00:00Z",
        is_active: true,
      },
    ],
    total_items: 2,
  },
});
const roster = await guestService.listTeamMembers("team-1", "org-9");
eq("returns one row per member", roster.length, 2);
eq("membershipId <- id", roster[0].membershipId, "m-1");
eq("guestId <- guest_id", roster[0].guestId, "g-1");
eq("identifier <- identifier", roster[0].identifier, "+919876543210");
eq("displayName <- display_name", roster[0].displayName, "Ava");
eq("joinedAt <- joined_at", roster[0].joinedAt, "2026-09-01T10:00:00Z");
eq("isActive <- is_active", roster[0].isActive, true);

console.log("\nnull identity is preserved, never fabricated from the guest_id");
eq("a gone guest row keeps identifier null", roster[1].identifier, null);
eq("a gone guest row keeps displayName null", roster[1].displayName, null);
check("the opaque guest_id is not smuggled into the identifier", roster[1].identifier !== "g-2");

console.log("\nthe read is org-scoped so guest_teams.read resolves for a customer");
const lastGet = calls.filter((c) => c.method === "get").at(-1);
eq("hits the roster endpoint", lastGet.url, "/guest-teams/team-1/members");
eq(
  "sends X-Organization-Id when an org id is known",
  lastGet.config?.headers?.["X-Organization-Id"],
  "org-9",
);

console.log("\nno org id -> no header sent (org context resolved elsewhere)");
setNextResponse({ data: { items: [], total_items: 0 } });
const empty = await guestService.listTeamMembers("team-2");
eq("empty roster maps to []", empty.length, 0);
const noOrgGet = calls.filter((c) => c.method === "get").at(-1);
check("no header config when no org id", noOrgGet.config === undefined);

// ---------------------------------------------------------------------------
// Component wiring: removal is real, and demo mode never hits the backend.
// ---------------------------------------------------------------------------
console.log("\nManageTeamsPage wires the roster + removal, and guards demo mode");
const page = readFileSync(join(ROOT, "src/components/features/ManageTeamsPage.tsx"), "utf8");
check(
  "openManage loads the roster via guestService.listTeamMembers",
  /guestService\.listTeamMembers\(/.test(page),
);
check(
  "the Remove action calls guestService.removeTeamMember",
  /guestService\.removeTeamMember\(/.test(page),
);
check(
  "removal is a no-op in demo mode (no backend roster exists there)",
  /const removeMember = async[\s\S]*?if \(!manageTeam \|\| demo\) return;/.test(page),
);
check(
  "openManage short-circuits before any backend call in demo mode",
  /const openManage = \(t: Team\) => \{[\s\S]*?if \(demo\) \{[\s\S]*?return;/.test(page),
);

if (failures) {
  console.log(`\n${failures} failed`);
  process.exit(1);
}
console.log("\nall passed");
