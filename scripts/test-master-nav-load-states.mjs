/**
 * Regression test: the Master console must tell "could not read" from "nothing there".
 *
 * FAILURE MODES THIS LOCKS DOWN, each reproduced in a browser on 2026-11-04:
 *
 * 1. A 500 from /me/permissions OR /auth/me left an empty sidebar with no
 *    message and no retry. /auth/me was in the same Promise.all, so its failure
 *    threw away a good permission list.
 * 2. A failed /radius/nas read showed "NAS clients 0" and "No NAS clients
 *    registered yet." A failed fleet read showed "No routers provisioned yet."
 *    The only other signal was a toast that disappears after a few seconds.
 * 3. With one organization chosen in the header picker, both lists read as
 *    though the platform had nothing, when only that organization did.
 * 4. The demo session's grant is `*`, which no real key ever matches, so the
 *    demo Master console had an empty sidebar.
 *
 * This repo has no test runner, so the invariants are checked in the source.
 *
 * Run: node scripts/test-master-nav-load-states.mjs
 */
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const auth = read("src/context/AuthContext.tsx");
const shell = read("src/components/master/MasterShell.tsx");
const nas = read("src/routes/master.nas.tsx");
const fleet = read("src/routes/master.routers.tsx");
const failures = [];
const expect = (ok, msg) => {
  if (!ok) failures.push(msg);
};

// 1. Permissions failure is known, and visible.
expect(
  /Promise\.allSettled\(\[\s*authService\.me\(\),\s*authService\.myPermissions\(\),?\s*\]\)/.test(
    auth,
  ),
  "rehydrate must settle /auth/me and /me/permissions separately",
);
expect(
  /freshPermissions\.status === "fulfilled"[\s\S]{0,120}else \{\s*setPermissionsFailed\(true\);/.test(
    auth,
  ),
  "rehydrate must record a /me/permissions failure",
);
expect(
  /const can = useCallback\(\(permission: string\) => permissions\.has\(permission\)/.test(auth),
  "can() stays an exact match; the demo wildcard belongs to the Master caps only",
);
expect(
  /\{permissionsFailed && \(\s*<button\s+onClick=\{\(\) => void reloadPermissions\(\)\}/.test(
    shell,
  ),
  "MasterShell must offer a retry when permissions failed to load",
);

// 2. A failed read never reports an empty list.
expect(
  /const unread = loadFailed && nasClients\.length === 0;/.test(nas),
  "NAS page must derive `unread` from the failed load",
);
expect(
  /!loading && !unread && rows\.length === 0/.test(nas),
  "NAS empty line must not render after a failed load",
);
for (const key of ["total", "active", "disabled", "pending"]) {
  expect(nas.includes(`value={count(stats.${key})}`), `NAS ${key} tile must not report 0 unread`);
}
expect(
  /!loading && !fleetUnread && rows\.length === 0/.test(fleet),
  "Fleet empty line must not render after a failed read",
);
expect(
  /fleetQuery\.isError \|\|\s*\(fleetQuery\.data\?\.unreachableLocationCount/.test(fleet),
  "Fleet `unread` must cover a failed query and an all-locations-failed fan-out",
);
for (const key of ["total", "online", "degraded", "offline"]) {
  expect(
    fleet.includes(`value={count(summary.${key})}`),
    `Fleet ${key} tile must not report 0 unread`,
  );
}

// 3. These two pages show every organization, so the picker must not offer a
// choice that would do nothing there.
expect(
  /pathname !== "\/master\/nas" && pathname !== "\/master\/routers" && \(\s*<OrganizationScopePicker \/>/.test(
    shell,
  ),
  "the organization picker must stay hidden on NAS / RADIUS and Router Fleet",
);

// 4. The demo grant opens the Master nav, and nowhere else.
expect(/const all = can\("\*"\);/.test(shell), "useOperatorCaps must honour the demo `*` grant");
expect(
  (auth.match(/setPermissions\(new Set\(\["\*"\]\)\)/g) ?? []).length === 2,
  "only the two demo-session branches may set the `*` grant",
);

// The two nav entries themselves.
expect(
  /to: "\/master\/nas", label: "NAS \/ RADIUS", icon: Server, cap: "nas"/.test(shell) &&
    /to: "\/master\/routers", label: "Router Fleet", icon: Router, cap: "routers"/.test(shell) &&
    /nas: \["radius\.read"\]/.test(shell) &&
    /routers: \["routers\.read"\]/.test(shell),
  "NAS / RADIUS and Router Fleet nav entries or their permission keys changed",
);
expect(
  /"\/master\/nas",\s*"\/master\/routers",/.test(shell),
  "both entries must stay in MASTER_NAV_GROUPS, or they silently never render",
);

// 5. The organization picker's choice never outlives its session.
expect(
  (auth.match(/removeStored\(ACTIVE_ORG_STORAGE_KEY\)/g) ?? []).length === 2,
  "both logout and a fresh login must clear the saved organization choice",
);

// 6. A login whose permissions fail leaves no live session behind.
const loginBody = auth.slice(auth.indexOf("await authService.login(creds)"));
expect(
  /myPermissions = await authService\.myPermissions\(\);\s*\} catch \(err\) \{\s*clearStoredSession\(\);\s*throw err;/.test(
    loginBody,
  ) && loginBody.indexOf("myPermissions = await") < loginBody.indexOf('setStatus("authenticated")'),
  "login must load permissions before going live, and clear the session if they fail",
);

if (failures.length) {
  for (const f of failures) console.error(`FAIL: ${f}`);
  process.exit(1);
}
console.log("OK: Master nav and lists tell a failed read from an empty one");
