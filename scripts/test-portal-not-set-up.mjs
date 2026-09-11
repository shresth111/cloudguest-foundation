/**
 * `/portal/`'s two failure screens: "not set up" vs "trouble connecting".
 *
 * Run: node scripts/test-portal-not-set-up.mjs
 *
 * WHY THIS EXISTS
 * ---------------
 * `portal.index.tsx` picks between them on whether the config resolve got a
 * real answer from the server. It decided that with
 * `isAxiosError(error) && !!error.response` -- but `guestPortalApi` rejects
 * with `toAppError(error)`, a plain object, never an AxiosError. So the check
 * was always false, the "not set up" screen was unreachable, and a
 * definitive `404 {"message":"Location not found: ..."}` was shown to a
 * guest as "Having trouble connecting -- check your connection and try
 * again". Prod nginx logs show a guest doing exactly that: 404 after 404
 * from /captive-portal/resolve, pressing Try again each time.
 *
 * Nothing in tsc could see it: `error` is typed `Error`, and
 * `isAxiosError` narrows any value. A test that hand-builds an AxiosError
 * would pass against the broken code too, which is how it shipped. So this
 * one gets its errors the only honest way: the REAL
 * `portalRuntimeService.resolveConfig`, through the REAL `guestPortalApi`
 * and its interceptor, against a local HTTP server that answers 404 / 429 /
 * 502 or drops the connection. Those rejections are then handed to the REAL
 * route component and the markup is checked for the words a guest reads.
 *
 * Only the seams the screen does not own are stubbed: the router
 * (`createFileRoute` keeps the options so the unexported component is
 * reachable), the runtime context (so `error` can be injected), and the
 * portal chrome (`PortalShell` needs a live router and backdrop hooks that
 * have nothing to do with which message is chosen).
 *
 * Also covers the helpers the fix added to services/api.ts --
 * `isAppError` / `requestErrorOf` / `requestErrorMessage`, which replace the
 * same broken `axios.isAxiosError(err) ? toAppError(err).message : ...`
 * pattern on the dashboard -- and `api`'s blob-error decode.
 */
import { build } from "esbuild";
import { createServer } from "node:http";
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

// ---------------------------------------------------------------------------
// The backend: just enough of /captive-portal/resolve to answer each way.
// ---------------------------------------------------------------------------
const server = createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  const loc = url.searchParams.get("location_id");
  const json = (status, body) => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(body));
  };
  if (!url.pathname.endsWith("/captive-portal/resolve")) return json(404, { detail: "Not Found" });
  if (loc === "missing") {
    return json(404, { success: false, message: `Location not found: ${loc}`, data: {} });
  }
  if (loc === "bad") return json(400, { success: false, message: "Invalid location id", data: {} });
  if (loc === "busy") return json(429, { success: false, message: "Too many requests", data: {} });
  if (loc === "down") {
    res.writeHead(502, { "Content-Type": "text/html" });
    return res.end("<html><body><h1>502 Bad Gateway</h1></body></html>");
  }
  if (loc === "drop") return req.socket.destroy();
  return json(500, { success: false, message: "unexpected test request", data: {} });
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const PORT = server.address().port;

// ---------------------------------------------------------------------------
// Stubs.
// ---------------------------------------------------------------------------
const work = mkdtempSync(join(tmpdir(), "portal-not-set-up-"));

writeFileSync(
  join(work, "router-stub.mjs"),
  `export function useNavigate() { return () => {}; }
   export function createFileRoute() { return (options) => ({ options }); }`,
);

/** The one field under test is `error`; the rest is a settled, session-less
 * load with no device MAC, so neither live-session query is enabled and the
 * routing effect never runs on the server anyway. */
writeFileSync(
  join(work, "runtime-stub.mjs"),
  `export function usePortalRuntime() { return globalThis.__runtime; }
   export function usePortalRuntimeOptional() { return globalThis.__runtime; }`,
);

writeFileSync(
  join(work, "shell-stub.mjs"),
  `import React from "react";
   export function PortalShell({ children }) { return React.createElement("main", null, children); }
   export function PortalTextPlate({ children }) { return React.createElement("div", null, children); }`,
);
writeFileSync(
  join(work, "guest-ui-stub.mjs"),
  `export function PortalConnectingState() { return "CONNECTING"; }`,
);
writeFileSync(join(work, "logo-stub.mjs"), `export function VenueLogo() { return null; }`);
writeFileSync(
  join(work, "error-screen-stub.mjs"),
  `export function PortalErrorScreen() { return null; }`,
);

const p = (rel) => join(ROOT, rel).replace(/\\/g, "/");
const entry = join(work, "entry.mjs");
writeFileSync(
  entry,
  `import React from "react";
   import { renderToStaticMarkup } from "react-dom/server";
   import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
   import { AxiosError } from "axios";
   import { Route } from "${p("src/routes/portal.index.tsx")}";
   import { portalRuntimeService } from "${p("src/services/portal-runtime.service.ts")}";
   import { isPortalConfigMissing } from "${p("src/lib/portal-guest-errors.ts")}";
   import { translate } from "${p("src/lib/portal-i18n.ts")}";
   import {
     api, isAppError, requestErrorOf, requestErrorMessage, toAppError,
   } from "${p("src/services/api.ts")}";
   export { React, renderToStaticMarkup, QueryClient, QueryClientProvider, AxiosError,
     Route, portalRuntimeService, isPortalConfigMissing, translate,
     api, isAppError, requestErrorOf, requestErrorMessage, toAppError };`,
);

const outfile = join(work, "bundle.cjs");
await build({
  entryPoints: [entry],
  bundle: true,
  format: "cjs",
  platform: "node",
  outfile,
  logLevel: "silent",
  absWorkingDir: ROOT,
  nodePaths: [join(ROOT, "node_modules")],
  define: {
    "import.meta.env": JSON.stringify({
      MODE: "test",
      DEV: false,
      PROD: true,
      VITE_API_BASE_URL: `http://127.0.0.1:${PORT}/api/v1`,
    }),
    "process.env.NODE_ENV": '"production"',
  },
  alias: {
    "@tanstack/react-router": join(work, "router-stub.mjs"),
    "@/context/PortalRuntimeContext": join(work, "runtime-stub.mjs"),
    "@/components/portal-runtime/PortalShell": join(work, "shell-stub.mjs"),
    "@/components/portal-runtime/PortalGuestUi": join(work, "guest-ui-stub.mjs"),
    "@/components/portal-runtime/VenueLogo": join(work, "logo-stub.mjs"),
    "@/components/portal-runtime/PortalErrorScreen": join(work, "error-screen-stub.mjs"),
  },
  loader: { ".ts": "ts", ".tsx": "tsx" },
  jsx: "automatic",
});

const m = createRequire(import.meta.url)(outfile);
const t = (key) => m.translate("en", key);

function decode(html) {
  return html
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

/** What `resolveConfig` really rejects with for this location. */
async function resolveFailure(locationId) {
  try {
    await m.portalRuntimeService.resolveConfig({ organizationId: "org-1", locationId });
  } catch (err) {
    return err;
  }
  throw new Error(`resolve for ${locationId} unexpectedly succeeded`);
}

function renderWith(error) {
  globalThis.__runtime = {
    isLoading: false,
    config: undefined,
    error,
    t,
    routerId: undefined,
    deviceMac: undefined,
    session: undefined,
    setSession: () => {},
    setGuestIdentifier: () => {},
    setEndedSession: () => {},
    organizationId: "org-1",
    locationId: "loc",
    hotspotLoginUrl: undefined,
    language: "en",
  };
  const Screen = m.Route.options.component;
  const qc = new m.QueryClient({ defaultOptions: { queries: { retry: false } } });
  return decode(
    m.renderToStaticMarkup(
      m.React.createElement(m.QueryClientProvider, { client: qc }, m.React.createElement(Screen)),
    ),
  );
}

const NOT_SET_UP = t("notSetUpTitle");
const TROUBLE = t("troubleConnectingTitle");
const TRY_AGAIN = t("tryAgainCta");
check(
  "the English copy under test exists",
  NOT_SET_UP !== "notSetUpTitle" &&
    TROUBLE !== "troubleConnectingTitle" &&
    TRY_AGAIN !== "tryAgainCta",
);

// ---------------------------------------------------------------------------
console.log("\n1. what guestPortalApi really rejects with");

const e404 = await resolveFailure("missing");
const eDrop = await resolveFailure("drop");
check(
  "a 404 rejects with an AppError carrying status 404",
  e404?.status === 404,
  JSON.stringify(e404),
);
check(
  "and it is NOT an AxiosError -- the premise the old check got wrong",
  e404?.isAxiosError !== true,
);
check("the backend's own message survives", e404?.message === "Location not found: missing");
check(
  "a dropped connection rejects with status null / network_error",
  eDrop?.status === null && eDrop?.code === "network_error",
  JSON.stringify(eDrop),
);

// ---------------------------------------------------------------------------
console.log("\n2. a 404 from resolve shows the not-set-up screen");

const html404 = renderWith(e404);
check("renders the not-set-up title", html404.includes(NOT_SET_UP), html404.slice(0, 300));
check("renders the not-set-up body", html404.includes(t("notSetUpBody")));
check("does NOT say trouble connecting", !html404.includes(TROUBLE));
check(
  "offers no Try again -- a retry cannot set a venue up",
  !html404.includes(TRY_AGAIN) && !/<button/.test(html404),
);

// ---------------------------------------------------------------------------
console.log("\n3. a dropped connection keeps trouble-connecting + Try again");

const htmlDrop = renderWith(eDrop);
check("renders the trouble-connecting title", htmlDrop.includes(TROUBLE));
check("renders the trouble-connecting body", htmlDrop.includes(t("troubleConnectingBody")));
check(
  "renders a Try again button",
  /<button[^>]*>[\s\S]*?<\/button>/.test(htmlDrop) && htmlDrop.includes(TRY_AGAIN),
);
check("does NOT say not set up", !htmlDrop.includes(NOT_SET_UP));

// ---------------------------------------------------------------------------
console.log("\n4. which statuses count as 'not set up'");

const e400 = await resolveFailure("bad");
const e429 = await resolveFailure("busy");
const e502 = await resolveFailure("down");
check("400 -> not set up", m.isPortalConfigMissing(e400) === true);
check("429 (resolve's own rate limit) -> retryable", m.isPortalConfigMissing(e429) === false);
check("502 (nginx, backend restarting) -> retryable", m.isPortalConfigMissing(e502) === false);
check(
  "502 renders Try again, not 'not set up'",
  (() => {
    const h = renderWith(e502);
    return h.includes(TRY_AGAIN) && !h.includes(NOT_SET_UP);
  })(),
);
check(
  "408 -> retryable",
  m.isPortalConfigMissing({ status: 408, code: "x", message: "x" }) === false,
);
check(
  "500 -> retryable",
  m.isPortalConfigMissing({ status: 500, code: "x", message: "x" }) === false,
);
check(
  "a non-request error (a TypeError in toRuntimeConfig) -> retryable",
  m.isPortalConfigMissing(new TypeError("cannot read properties of undefined")) === false,
);
check("undefined -> retryable", m.isPortalConfigMissing(undefined) === false);

const rawResponse = new m.AxiosError(
  "Request failed with status code 404",
  "ERR_BAD_REQUEST",
  {},
  null,
  {
    status: 404,
    data: { success: false, message: "Location not found: x", data: {} },
    headers: {},
    config: {},
    statusText: "Not Found",
  },
);
const rawNoResponse = new m.AxiosError("timeout of 6000ms exceeded", "ECONNABORTED", {}, {});
check(
  "backward compat: a raw AxiosError with a 404 response -> not set up",
  m.isPortalConfigMissing(rawResponse),
);
check(
  "backward compat: a raw AxiosError with no response -> retryable",
  !m.isPortalConfigMissing(rawNoResponse),
);

// ---------------------------------------------------------------------------
console.log("\n5. the dashboard helpers that replace isAxiosError(err) ? toAppError(err).message");

const e402 = {
  status: 402,
  code: "payment_required",
  message: "Your plan does not include 'white_label'",
};
check("isAppError: an AppError from the interceptor", m.isAppError(e404));
check("isAppError: a network AppError", m.isAppError(eDrop));
check(
  "isAppError: not a raw AxiosError (it has status/code/message too)",
  !m.isAppError(rawResponse),
);
check("isAppError: not a plain Error", !m.isAppError(new Error("x")));
check(
  "requestErrorMessage: a 402 AppError shows the backend's reason, not the fallback",
  m.requestErrorMessage(e402, "check the connection") === e402.message,
);
check(
  "requestErrorMessage: a network AppError reads as a network failure",
  m.requestErrorMessage(eDrop, "fallback") === "Unable to reach the server",
);
check(
  "requestErrorMessage: a raw AxiosError still works",
  m.requestErrorMessage(rawResponse, "fallback") === "Location not found: x",
);
check(
  "requestErrorMessage: anything else gets the caller's fallback",
  m.requestErrorMessage(new TypeError("boom"), "fallback") === "fallback",
);
check(
  "requestErrorOf: a TypeError is not a request error",
  m.requestErrorOf(new TypeError("x")) === null,
);

// ---------------------------------------------------------------------------
console.log("\n6. api decodes a responseType:'blob' error body before toAppError");

// The report export asks for a blob, so its error body is a Blob too; the
// caller-side decode it used to have could never run (it read `.response`
// off an AppError). Driven through the real interceptor's rejection handler.
const rejected = m.api.interceptors.response.handlers.find((h) => h && h.rejected)?.rejected;
check("found api's response-error interceptor", typeof rejected === "function");
if (typeof rejected === "function") {
  const blobError = (body) =>
    new m.AxiosError(
      "Request failed with status code 403",
      "ERR_BAD_REQUEST",
      { url: "/reports" },
      null,
      {
        status: 403,
        data: new Blob([body], { type: "application/json" }),
        headers: {},
        config: { url: "/reports" },
        statusText: "Forbidden",
      },
    );
  const reason = "Permission denied: 'reports.export' is required at global scope";
  const got = await rejected(
    blobError(JSON.stringify({ success: false, message: reason, data: {} })),
  ).catch((e) => e);
  check(
    "a JSON blob body yields the backend's message",
    got?.message === reason,
    JSON.stringify(got),
  );
  check("and keeps the status", got?.status === 403);
  const gotDetail = await rejected(
    blobError(JSON.stringify({ detail: "Not authenticated" })),
  ).catch((e) => e);
  check("FastAPI's { detail } shape is read too", gotDetail?.message === "Not authenticated");
  const gotHtml = await rejected(blobError("<html>502</html>")).catch((e) => e);
  check(
    "a non-JSON blob falls back to axios's message instead of throwing",
    gotHtml?.status === 403 && gotHtml?.message === "Request failed with status code 403",
  );
}

server.close();
console.log(
  failures === 0
    ? "\nportal not-set-up: all checks passed"
    : `\nportal not-set-up: ${failures} FAILED`,
);
process.exit(failures === 0 ? 0 : 1);
