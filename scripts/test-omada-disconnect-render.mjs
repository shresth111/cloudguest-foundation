/**
 * The Omada per-guest disconnect, rendered -- gate, confirmation, and the
 * four answers that matter.
 *
 * WHAT THIS PROVES THAT THE VERDICT SUITE CANNOT
 * ----------------------------------------------
 * `test-omada-disconnect-verdicts.mjs` drives the pure mapping. This one
 * bundles the REAL components and checks the words actually reach the
 * markup -- a correct verdict object that no element renders is still a
 * blank dialog.
 *
 * WHY TWO RADIX PRIMITIVES ARE STUBBED. `renderToStaticMarkup` renders a
 * Radix portal as the empty string (measured: the dropdown item, the
 * dialog, both come back ""). That is a property of the portal, not of this
 * feature, and it would make every assertion below vacuously pass. So
 * `ui/dropdown-menu` and `ui/dialog` are replaced with plain elements and
 * everything else -- the components, the hooks, the gate, the copy -- is
 * the real thing.
 *
 * THE GATE IS THE MIKROTIK GUARANTEE. `OmadaDisconnectMenuItem` returns
 * null unless the session's venue has an Omada integration. A MikroTik
 * venue has none, so the row menu gains nothing -- that is the mechanism
 * behind "MikroTik renders unchanged", and it is asserted here rather than
 * asserted in a commit message.
 *
 * Run: node scripts/test-omada-disconnect-render.mjs
 */
import { build } from "esbuild";
import { mkdtempSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
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

const outdir = mkdtempSync(join(tmpdir(), "omada-disconnect-render-"));
const p = (rel) => join(ROOT, rel).replace(/\\/g, "/");

/** Permission granted: the "operator who cannot act sees nothing" path is a
 * separate concern from the vendor gate under test here. */
const authStub = join(outdir, "auth-stub.mjs");
writeFileSync(authStub, `export function useAuth() { return { can: () => true }; }`);

/** Every service call throws. The integration list is seeded into the query
 * cache instead, so a render that reaches the network is a loud failure. */
const svcStub = join(outdir, "svc-stub.mjs");
writeFileSync(
  svcStub,
  `export const networkIntegrationService = new Proxy({}, {
     get: () => async () => { throw new Error("the render test makes no requests"); },
   });`,
);
const discStub = join(outdir, "disc-stub.mjs");
writeFileSync(
  discStub,
  `export const omadaDisconnectService = new Proxy({}, {
     get: () => async () => { throw new Error("the render test makes no requests"); },
   });`,
);

/** Radix portals render "" on the server. Plain elements instead, so the
 * copy under test is actually in the markup. */
const ddStub = join(outdir, "dropdown-stub.mjs");
writeFileSync(
  ddStub,
  `import React from "react";
   const pass = (tag) => ({ children, ...rest }) =>
     React.createElement(tag, { "data-stub": true, onClick: rest.onClick }, children);
   export const DropdownMenuItem = pass("div");
   export const DropdownMenu = pass("div");
   export const DropdownMenuContent = pass("div");`,
);
const dialogStub = join(outdir, "dialog-stub.mjs");
writeFileSync(
  dialogStub,
  `import React from "react";
   const pass = (tag) => ({ children }) => React.createElement(tag, null, children);
   export const Dialog = pass("div");
   export const DialogContent = pass("div");
   export const DialogHeader = pass("div");
   export const DialogTitle = pass("h2");
   export const DialogDescription = pass("p");
   export const DialogFooter = pass("div");`,
);

const entry = join(outdir, "entry.mjs");
writeFileSync(
  entry,
  `import React from "react";
   import { renderToStaticMarkup } from "react-dom/server";
   import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
   import {
     OmadaDisconnectMenuItem,
     OmadaDisconnectDialog,
     DisconnectVerdictBody,
   } from "${p("src/components/guests/OmadaSessionDisconnect.tsx")}";
   import {
     describeDisconnectResult,
     describeDisconnectFailure,
   } from "${p("src/lib/omada-disconnect.ts")}";
   export { React, renderToStaticMarkup, QueryClient, QueryClientProvider,
     OmadaDisconnectMenuItem, OmadaDisconnectDialog, DisconnectVerdictBody,
     describeDisconnectResult, describeDisconnectFailure };`,
);

const outfile = join(outdir, "bundle.cjs");
await build({
  entryPoints: [entry],
  bundle: true,
  format: "cjs",
  platform: "node",
  outfile,
  logLevel: "silent",
  absWorkingDir: ROOT,
  nodePaths: [join(ROOT, "node_modules")],
  alias: {
    "@/context/AuthContext": authStub,
    "@/services/network-integration.service": svcStub,
    "@/services/omada-disconnect.service": discStub,
    "@/components/ui/dropdown-menu": ddStub,
    "@/components/ui/dialog": dialogStub,
  },
  loader: { ".ts": "ts", ".tsx": "tsx" },
  jsx: "automatic",
});

const m = createRequire(import.meta.url)(outfile);

const SESSION = {
  id: "s1",
  guestId: "g1",
  guestIdentifier: "raj@example.com",
  deviceId: null,
  deviceMac: "AA:BB:CC:DD:EE:77",
  userAgent: null,
  routerId: "r1",
  routerName: "Lobby AP",
  locationId: "loc-1",
  locationName: "Lobby",
  organizationId: "o1",
  organizationName: "Hotel",
  authMethod: "otp",
  voucherId: null,
  status: "active",
  startedAt: "2026-09-11T08:00:00Z",
  endedAt: null,
  lastActivityAt: "2026-09-11T09:00:00Z",
  ipAddress: "10.0.0.5",
  bytesUploaded: 0,
  bytesDownloaded: 0,
  dataLimitMb: null,
  sessionTimeoutMinutes: null,
  disconnectReason: null,
  createdAt: "2026-09-11T08:00:00Z",
};

const OMADA = [
  {
    id: "int-1",
    locationId: "loc-1",
    provider: "omada",
    name: "Lobby controller",
    authMode: "legacy",
  },
];

function decode(html) {
  return html
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x2014;/g, "—");
}

function render(element, rows) {
  const qc = new m.QueryClient({ defaultOptions: { queries: { retry: false } } });
  qc.setQueryData(["network-integrations", "list"], {
    rows: rows ?? [],
    total: (rows ?? []).length,
    totalPages: 1,
    hasNext: false,
    hasPrevious: false,
  });
  return decode(
    m.renderToStaticMarkup(m.React.createElement(m.QueryClientProvider, { client: qc }, element)),
  );
}

const menuItem = (session) =>
  m.React.createElement(m.OmadaDisconnectMenuItem, { session, onSelect() {} });

console.log("\n-- the gate: a MikroTik venue gains nothing --");
{
  // A MikroTik venue has no network integration row at all. Same session,
  // same operator, same permission -- only the integration list differs.
  const mikrotik = render(menuItem(SESSION), []);
  check("no Omada integration renders absolutely nothing", mikrotik === "", mikrotik);

  const omada = render(menuItem(SESSION), OMADA);
  check("an Omada venue does render the control", omada.includes("End access on controller"));
  check(
    "the two differ only by the integration list -- nothing reads a vendor field",
    mikrotik === "" && omada !== "",
  );

  // A controller at another venue must not leak into this one.
  const elsewhere = render(menuItem(SESSION), [{ ...OMADA[0], locationId: "loc-9" }]);
  check("another venue's controller does not arm this row", elsewhere === "", elsewhere);

  // No MAC, nothing to address the request with.
  const noMac = render(menuItem({ ...SESSION, deviceMac: null }), OMADA);
  check("a session with no device MAC renders nothing", noMac === "", noMac);
}

console.log("\n-- the confirmation says what will happen, in plain words --");
{
  const html = render(
    m.React.createElement(m.OmadaDisconnectDialog, { session: SESSION, onClose() {} }),
    OMADA,
  );
  const words = html.toLowerCase();
  check("it names the guest", html.includes("raj@example.com"));
  check("it names the venue", html.includes("Lobby"));
  check("it shows the device it will act on", html.includes("AA:BB:CC:DD:EE:77"));
  check("it says the guest can sign in again", words.includes("connect again"));
  check("IT SAYS IT IS NOT A BAN", words.includes("it is not a ban"));
  check("it says nothing is blocked", words.includes("nothing is blocked"));
  check(
    "it never claims a permanent block",
    !words.includes("permanently") && !words.includes("banned") && !words.includes("blacklist"),
    words,
  );
  check("the reason field is marked optional", words.includes("reason (optional)"));
  check("and says the guest never sees it", words.includes("guest never sees it"));
}

console.log("\n-- the four answers, rendered --");
{
  const verdictHtml = (verdict) =>
    render(m.React.createElement(m.DisconnectVerdictBody, { verdict })).toLowerCase();

  const base = {
    disconnected: true,
    provider: "omada",
    clientMac: "AA:BB:CC:DD:EE:77",
    hadActiveAuthorization: true,
    deauthorizedAt: "2026-09-11T09:20:00Z",
    guestSessionId: "u1",
    guestSessionEnded: true,
  };

  // 1. the plain success
  {
    const v = m.describeDisconnectResult(base);
    const html = verdictHtml(v);
    check("success renders its title", html.includes("access ended"));
    check("success renders the not-a-ban line", html.includes("not a ban"));
    check("success is styled as success, not as a warning", html.includes("emerald"));
  }

  // 2. THE LAPSED GRANT. disconnected:true + had_active_authorization:false.
  {
    const v = m.describeDisconnectResult({ ...base, hadActiveAuthorization: false });
    const html = verdictHtml(v);
    check("the lapsed-grant answer renders as ACCESS ENDED", html.includes("access ended"));
    check("it explains the grant had already lapsed", html.includes("already lapsed"));
    check(
      "it is styled as a success -- no amber, no destructive",
      html.includes("emerald") && !html.includes("amber") && !html.includes("destructive"),
      html,
    );
    check(
      "no failure word reaches the screen",
      !html.includes("failed") && !html.includes("error") && !html.includes("warning"),
      html,
    );
  }

  // 3. the 501
  {
    const v = m.describeDisconnectFailure({ status: 501, message: "OMADA_API_UNSUPPORTED" });
    const html = verdictHtml(v);
    check(
      "501 renders as a specific refusal, not a generic failure",
      html.includes("can't end a guest's access"),
    );
    check("501 names the missing hotspot operator credentials", html.includes("hotspot operator"));
    check("501 tells the operator what to add", html.includes("add hotspot operator credentials"));
    check(
      "501 never repeats CR-006's Open API / legacy claim",
      !html.includes("open api") && !html.includes("legacy"),
      html,
    );
    check("501 never says the controller cannot do this", !html.includes("not supported"), html);
    check("501 shows no raw error code", !html.includes("omada_api_unsupported"), html);
  }

  // 4. the 502
  {
    const v = m.describeDisconnectFailure({ status: 502, message: "Bad Gateway" });
    const html = verdictHtml(v);
    check("502 SAYS NOTHING CHANGED", html.includes("nothing was changed"));
    check("502 says the access is exactly as it was", html.includes("exactly as it was"));
    check("502 does not claim the guest was disconnected", !html.includes("access ended"));
    check(
      "502 never suggests a partial action",
      !html.includes("may have") && !html.includes("might have"),
      html,
    );
  }
}

console.log();
if (failures > 0) {
  console.error(`FAIL: ${failures} check(s) failed.`);
  process.exit(1);
}
console.log("omada disconnect render: all checks passed");
