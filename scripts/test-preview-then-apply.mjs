/**
 * Regression test for the preview-then-apply machinery, extracted out of
 * `src/routes/master.integrations.tsx` into `@/lib/preview-then-apply`,
 * `@/hooks/usePreviewThenApply` and
 * `@/components/network-integrations/PreviewThenApply`.
 *
 * ## WHY THIS SUITE EXISTS
 *
 * The extraction is a refactor of code that writes to a hotel's live network,
 * and two of its behaviours break *silently* — a broken one still compiles,
 * still renders, still looks right, and only misbehaves on a venue:
 *
 *   1. **The 409 gap normalisation.** The backend emits gap ids lowercase
 *      (`openapi_required`); the copy tables are keyed on the uppercase union.
 *      Drop the `.toUpperCase()` and a perfectly good gap list renders as
 *      "this build does not recognise that precondition" — an amber panel that
 *      names no fix, which is the exact failure seen on the QA venue on
 *      2026-09-12 and fixed in #279. And `data.code` (the refusal) is not
 *      `data.missing` (the gaps): rendering the code as a gap reproduces the
 *      same defect from the other direction.
 *   2. **Stale-preview invalidation.** Apply is gated on a `previewed` flag.
 *      A preview that no longer describes what Apply would do — because the
 *      run was refused, or because an input changed — must take the flag down
 *      with it. Leave the flag up and an operator applies a change they read a
 *      different version of.
 *
 * ## THE EQUIVALENCE PROOF (§3)
 *
 * The strongest assertion here is not about any single rule. `LegacyPanel` in
 * the fixture is the panel's JSX **copied verbatim off `origin/main`'s
 * `master.integrations.tsx`**, with the route's local helpers inlined. Both it
 * and the extracted `<PreviewThenApply>` are rendered over a matrix of states
 * and their markup is compared **string-for-string**. A refactor that changes a
 * class, a heading, a `title`, an `aria-disabled` or the order of two elements
 * fails here, whatever its intent.
 *
 * ## THE ONE NEW IDEA (§5)
 *
 * On this platform a write can return success and do nothing — three separate
 * writes returned `errorCode 0` and changed nothing on real hardware. So
 * `usePreviewThenApply` requires a `readBack` plan and has no arm meaning "the
 * 200 was enough". §5 drives all four confirmation states, including that a
 * surface which declares it cannot read back renders **no** confirmation line
 * rather than borrowing the vocabulary.
 *
 * WHY IT LOOKS LIKE THIS: this repo has no test runner (see
 * `scripts/test-ap-inventory-honesty.mjs` for the same note). The pure module
 * is bundled with esbuild and executed; the components are server-rendered for
 * real; and the hook — which is stateful, effectful and async, and cannot be
 * driven by a server render — runs in a real Chromium, the same way
 * `scripts/test-post-login-html-sandbox.mjs` does.
 *
 * Run: node scripts/test-preview-then-apply.mjs
 */
import { build } from "esbuild";
import { mkdtempSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const p = (rel) => join(ROOT, rel).replace(/\\/g, "/");

let failures = 0;
function check(name, ok, extra = "") {
  if (ok) {
    console.log(`  ok   ${name}`);
  } else {
    failures += 1;
    console.log(`  FAIL ${name}${extra ? ` -- ${extra}` : ""}`);
  }
}
const eq = (name, a, e) =>
  check(name, a === e, `expected ${JSON.stringify(e)}, got ${JSON.stringify(a)}`);
const deep = (name, a, e) =>
  check(
    name,
    JSON.stringify(a) === JSON.stringify(e),
    `expected ${JSON.stringify(e)}, got ${JSON.stringify(a)}`,
  );

const outdir = mkdtempSync(join(tmpdir(), "preview-then-apply-"));

// ===========================================================================
// 1. The pure module, bundled alone and executed.
// ===========================================================================

const libEntry = join(outdir, "lib-entry.mjs");
writeFileSync(
  libEntry,
  `export * from "${p("src/lib/preview-then-apply.ts")}";
   export {
     CONTROLLER_SETUP_GAP_COPY,
     CONTROLLER_SETUP_GAP_ORDER,
     isControllerSetupGap,
   } from "${p("src/types/network-integration.ts")}";`,
);
const libBundle = join(outdir, "lib.mjs");
await build({
  entryPoints: [libEntry],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: libBundle,
  logLevel: "silent",
  absWorkingDir: ROOT,
  nodePaths: [join(ROOT, "node_modules")],
  loader: { ".ts": "ts", ".tsx": "tsx" },
});

const lib = await import(`file://${libBundle}`);
const {
  refusalGapsFromError,
  orderGapsBy,
  previewApplyReducer,
  PREVIEW_APPLY_INITIAL,
  describeWriteConfirmation,
  CONTROLLER_SETUP_GAP_COPY,
  CONTROLLER_SETUP_GAP_ORDER,
  isControllerSetupGap,
} = lib;

console.log("\n1. The 409 refusal -- both halves of it\n");

// The shape measured on the live QA venue, 2026-09-12.
deep(
  "a lowercase `missing` list is normalised to the uppercase copy keys",
  refusalGapsFromError({
    status: 409,
    data: { code: "NETWORK_INTEGRATION_AUTOCONFIG_PRECONDITIONS", missing: ["openapi_required"] },
  }),
  ["OPENAPI_REQUIRED"],
);

// The assertion that says WHY the line above is load-bearing rather than
// cosmetic: the wire casing is not a key of the copy table, so without the
// normalisation this exact payload renders as "unrecognised".
check(
  "the wire casing is NOT a key of the gap copy table",
  isControllerSetupGap("openapi_required") === false &&
    isControllerSetupGap("OPENAPI_REQUIRED") === true,
);
check(
  "so the normalised gap resolves to copy that names a fix",
  Boolean(CONTROLLER_SETUP_GAP_COPY.OPENAPI_REQUIRED?.fix),
);

deep(
  "`data.missing` wins over `data.code` -- the code names the refusal, not a gap",
  refusalGapsFromError({
    status: 409,
    data: { code: "NETWORK_INTEGRATION_AUTOCONFIG_PRECONDITIONS", missing: ["site_not_selected"] },
  }),
  ["SITE_NOT_SELECTED"],
);
deep(
  "with no `missing`, the typed code is the fallback rather than silence",
  refusalGapsFromError({ status: 409, data: { code: "NETWORK_INTEGRATION_SSID_FOREIGN_PORTAL" } }),
  ["NETWORK_INTEGRATION_SSID_FOREIGN_PORTAL"],
);
deep(
  "a top-level `code` is read when `data` carries none",
  refusalGapsFromError({ status: 409, code: "NETWORK_INTEGRATION_SITE_SHARED" }),
  ["NETWORK_INTEGRATION_SITE_SHARED"],
);
deep(
  "several gaps all normalise",
  refusalGapsFromError({
    status: 409,
    data: { missing: ["guest_ssid_missing", "OPENAPI_REQUIRED"] },
  }),
  ["GUEST_SSID_MISSING", "OPENAPI_REQUIRED"],
);
deep(
  "non-string entries are dropped rather than rendered as `undefined`",
  refusalGapsFromError({ status: 409, data: { missing: ["openapi_required", 7, null] } }),
  ["OPENAPI_REQUIRED"],
);
eq(
  "a 409 with neither a code nor gaps falls through to the ordinary toast",
  refusalGapsFromError({ status: 409, data: { missing: [] } }),
  null,
);
eq(
  "a 500 carrying a `missing` list is NOT a typed refusal",
  refusalGapsFromError({ status: 500, data: { missing: ["openapi_required"] } }),
  null,
);
eq("a 409-less error falls through", refusalGapsFromError({ code: "boom" }), null);
eq("undefined falls through rather than throwing", refusalGapsFromError(undefined), null);
eq("null falls through rather than throwing", refusalGapsFromError(null), null);

console.log("\n2. Gap ordering -- the dependency chain, unrecognised last\n");

deep(
  "gaps sort into the backend's documented fix order",
  orderGapsBy(CONTROLLER_SETUP_GAP_ORDER, [
    "GUEST_SSID_MISSING",
    "OPENAPI_REQUIRED",
    "INTEGRATION_DISABLED",
  ]),
  ["INTEGRATION_DISABLED", "OPENAPI_REQUIRED", "GUEST_SSID_MISSING"],
);
deep(
  "an unrecognised gap sorts last and is NOT dropped",
  orderGapsBy(CONTROLLER_SETUP_GAP_ORDER, ["SOMETHING_NEW", "OPENAPI_REQUIRED"]),
  ["OPENAPI_REQUIRED", "SOMETHING_NEW"],
);
check(
  "ordering does not mutate its input",
  (() => {
    const input = ["GUEST_SSID_MISSING", "INTEGRATION_DISABLED"];
    orderGapsBy(CONTROLLER_SETUP_GAP_ORDER, input);
    return input[0] === "GUEST_SSID_MISSING";
  })(),
);

console.log("\n3. The state machine -- every transition the route relied on\n");

const OUTCOME = (over = {}) => ({
  dryRun: true,
  ok: true,
  changed: true,
  steps: [],
  raw: { a: 1 },
  ...over,
});

const afterPreview = previewApplyReducer(
  { ...PREVIEW_APPLY_INITIAL, gaps: ["OPENAPI_REQUIRED"] },
  { type: "run-succeeded", dryRun: true, outcome: OUTCOME() },
);
eq("a completed dry run arms Apply", afterPreview.previewed, true);
deep("a body means nothing is blocking it any more, so gaps clear", afterPreview.gaps, []);
check("the preview's outcome is held", afterPreview.outcome !== null);

const afterApply = previewApplyReducer(afterPreview, {
  type: "run-succeeded",
  dryRun: false,
  outcome: OUTCOME({ dryRun: false }),
});
eq(
  "a real apply leaves the previewed flag where it was (unchanged from origin/main)",
  afterApply.previewed,
  true,
);
eq("an apply's outcome replaces the preview's", afterApply.outcome.dryRun, false);

const refused = previewApplyReducer(afterPreview, {
  type: "run-refused",
  gaps: ["OPENAPI_REQUIRED"],
});
eq("a refusal disarms Apply", refused.previewed, false);
eq(
  "a refusal drops the stale preview rather than leaving it under the amber panel",
  refused.outcome,
  null,
);
deep("a refusal shows its gaps", refused.gaps, ["OPENAPI_REQUIRED"]);

const failedState = { ...afterPreview };
eq(
  "an untyped error is a toast, not a state change -- the preview survives",
  previewApplyReducer(failedState, { type: "run-failed" }),
  failedState,
);

const invalidated = previewApplyReducer(refused, { type: "invalidate" });
eq("invalidating disarms Apply", invalidated.previewed, false);
eq("invalidating drops the outcome", invalidated.outcome, null);
deep(
  "invalidating KEEPS the gaps -- a precondition is not fixed by toggling an option",
  invalidated.gaps,
  ["OPENAPI_REQUIRED"],
);

deep(
  "reset returns to the initial state",
  previewApplyReducer(refused, { type: "reset" }),
  PREVIEW_APPLY_INITIAL,
);

eq(
  "an unknown event leaves the state alone",
  previewApplyReducer(afterPreview, { type: "nonsense" }),
  afterPreview,
);

eq(
  "a confirmation from a read-back is held",
  previewApplyReducer(afterApply, {
    type: "confirmed",
    confirmation: { state: "confirmed", detail: "read back" },
  }).confirmation.state,
  "confirmed",
);
eq(
  "a fresh run clears the previous run's confirmation",
  previewApplyReducer(
    { ...afterApply, confirmation: { state: "confirmed", detail: "read back" } },
    { type: "run-succeeded", dryRun: true, outcome: OUTCOME() },
  ).confirmation,
  null,
);

eq(
  "the confirmation vocabulary has no `applied successfully` arm",
  describeWriteConfirmation({ state: "not-read-back", why: "nothing reads it back" }),
  "nothing reads it back",
);

// ===========================================================================
// 4/5. The components and the hook, rendered and driven for real.
// ===========================================================================

const fixture = join(outdir, "fixture.tsx");
writeFileSync(
  fixture,
  `import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MButton } from "${p("src/components/master/MasterKit.tsx")}";
import { PreviewThenApply } from "${p("src/components/network-integrations/PreviewThenApply.tsx")}";
import {
  CONTROLLER_CONFIGURE_OUTCOME_LABEL,
  CONTROLLER_CONFIGURE_STEP_LABEL,
  CONTROLLER_SETUP_GAP_COPY,
  CONTROLLER_SETUP_GAP_ORDER,
  isControllerSetupGap,
} from "${p("src/types/network-integration.ts")}";
import { orderGapsBy } from "${p("src/lib/preview-then-apply.ts")}";
import { KeyRound, Loader2, ShieldCheck } from "lucide-react";

const orderedGaps = (gaps) => orderGapsBy(CONTROLLER_SETUP_GAP_ORDER, gaps);

/**
 * THE PANEL AS IT SHIPPED, copied verbatim out of origin/main's
 * master.integrations.tsx (efa82f2 .. ae0f536, lines 1188-1382) with the
 * route's own \`orderedGaps\`/\`busy\`/\`configureBlock\` inlined as props. Nothing
 * here may be "tidied": its whole value is being the thing we are diffing
 * against.
 */
function LegacyPanel({ configureGaps, outcome, previewed, takeOver, busy, configureBlock, pending, onGapFix }) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Sets the guest portal URL on the SSID, adds the pre-authentication access rule, and
        creates the hotspot operator account on the controller — the steps otherwise done by
        hand in Omada. Preview first; nothing is written until you apply.
      </p>

      {configureGaps.length > 0 && (
        <div className="space-y-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
          <p className="text-sm font-medium">Not ready yet — fix this first:</p>
          <ol className="space-y-1.5">
            {orderedGaps(configureGaps).map((g) => {
              const copy = isControllerSetupGap(g) ? CONTROLLER_SETUP_GAP_COPY[g] : null;
              return (
                <li key={g} className="text-sm">
                  <span className="font-medium">{copy?.title ?? g}</span>
                  <span className="block text-xs text-muted-foreground">
                    {copy?.fix ??
                      "This build does not recognise that precondition — ask support."}
                  </span>
                  {g === "OPENAPI_REQUIRED" && (
                    <MButton
                      variant="outline"
                      className="mt-1.5"
                      disabled={busy}
                      onClick={onGapFix}
                    >
                      <KeyRound /> Switch to Open API credentials
                    </MButton>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {outcome && (
        <div className="space-y-2 rounded-lg border border-border bg-muted/40 p-3">
          <p className="text-sm font-medium">
            {outcome.dryRun
              ? "What this would change"
              : outcome.changed
                ? "What was changed"
                : "Nothing needed changing"}
          </p>

          {!outcome.ok && (
            <p className="text-sm font-medium text-destructive">
              {outcome.dryRun
                ? "Some steps would fail. The controller is unchanged."
                : "Some steps failed — the controller is only partly configured."}
            </p>
          )}

          {outcome.steps.length > 0 ? (
            <ul className="space-y-1.5">
              {outcome.steps.map((st, i) => (
                <li key={\`\${st.step}-\${i}\`} className="text-sm">
                  <span className="font-medium">
                    {CONTROLLER_CONFIGURE_STEP_LABEL[st.step] ?? st.step}
                  </span>{" "}
                  <span
                    className={
                      st.outcome === "failed" ? "text-destructive" : "text-muted-foreground"
                    }
                  >
                    — {CONTROLLER_CONFIGURE_OUTCOME_LABEL[st.outcome] ?? st.outcome}
                  </span>
                  {st.message && (
                    <span className="block text-xs text-muted-foreground">{st.message}</span>
                  )}
                  {st.outcome === "failed" && st.providerCode != null && (
                    <span className="block text-xs text-muted-foreground">
                      Controller error code {st.providerCode}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">The controller reported no steps.</p>
          )}

          <details className="mt-1">
            <summary className="cursor-pointer text-xs text-muted-foreground">
              Exactly what the controller reported
            </summary>
            <pre className="mt-2 max-h-64 overflow-auto rounded bg-background p-2 text-[11px] leading-relaxed">
              {JSON.stringify(outcome.raw, null, 2)}
            </pre>
          </details>
        </div>
      )}

      <label className="flex cursor-pointer items-start gap-2 text-sm">
        <input type="checkbox" className="mt-0.5" checked={takeOver} onChange={() => {}} />
        <span>
          Take over the SSID&rsquo;s existing portal
          <span className="block text-xs text-muted-foreground">
            Overwrites a portal configuration already on that guest network.
          </span>
        </span>
      </label>

      {configureBlock && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          <p className="font-medium">Not available on this contract</p>
          <p className="text-muted-foreground">{configureBlock}</p>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <MButton
          variant="outline"
          disabled={busy || configureBlock !== null}
          aria-disabled={busy || configureBlock !== null}
          title={configureBlock ?? undefined}
          onClick={() => {}}
        >
          {pending ? <Loader2 className="animate-spin" /> : <ShieldCheck />}
          Preview changes
        </MButton>
        <MButton
          variant="primary"
          disabled={!previewed || busy || configureBlock !== null}
          aria-disabled={!previewed || busy || configureBlock !== null}
          title={
            configureBlock ??
            (previewed ? undefined : "Run the preview first — this writes to a live controller.")
          }
          onClick={() => {}}
        >
          Apply to controller
        </MButton>
      </div>
    </div>
  );
}

/** The same scenario, through the extracted component. */
function ExtractedPanel({ configureGaps, outcome, previewed, takeOver, busy, configureBlock, pending, onGapFix, confirmation = null }) {
  const state = {
    gaps: configureGaps,
    previewed,
    confirmation,
    outcome: outcome
      ? {
          dryRun: outcome.dryRun,
          ok: outcome.ok,
          changed: outcome.changed,
          raw: outcome.raw,
          steps: outcome.steps.map((st) => ({
            key: st.step,
            label: CONTROLLER_CONFIGURE_STEP_LABEL[st.step] ?? st.step,
            outcomeLabel: CONTROLLER_CONFIGURE_OUTCOME_LABEL[st.outcome] ?? st.outcome,
            failed: st.outcome === "failed",
            message: st.message,
            providerCode: st.providerCode,
          })),
        }
      : null,
  };
  return (
    <PreviewThenApply
      state={state}
      busy={busy}
      running={pending}
      onPreview={() => {}}
      onApply={() => {}}
      blocked={configureBlock}
      orderGaps={orderedGaps}
      gapCopy={(g) => (isControllerSetupGap(g) ? CONTROLLER_SETUP_GAP_COPY[g] : null)}
      renderGapAction={(g) =>
        g === "OPENAPI_REQUIRED" ? (
          <MButton variant="outline" className="mt-1.5" disabled={busy} onClick={onGapFix}>
            <KeyRound /> Switch to Open API credentials
          </MButton>
        ) : null
      }
      intro={
        <p className="text-sm text-muted-foreground">
          Sets the guest portal URL on the SSID, adds the pre-authentication access rule, and
          creates the hotspot operator account on the controller — the steps otherwise done by
          hand in Omada. Preview first; nothing is written until you apply.
        </p>
      }
    >
      <label className="flex cursor-pointer items-start gap-2 text-sm">
        <input type="checkbox" className="mt-0.5" checked={takeOver} onChange={() => {}} />
        <span>
          Take over the SSID&rsquo;s existing portal
          <span className="block text-xs text-muted-foreground">
            Overwrites a portal configuration already on that guest network.
          </span>
        </span>
      </label>
    </PreviewThenApply>
  );
}

export function renderLegacy(props) {
  return renderToStaticMarkup(<LegacyPanel {...props} />);
}
export function renderExtracted(props) {
  return renderToStaticMarkup(<ExtractedPanel {...props} />);
}
`,
);

const fixtureBundle = join(outdir, "fixture.cjs");
await build({
  entryPoints: [fixture],
  bundle: true,
  format: "cjs",
  platform: "node",
  outfile: fixtureBundle,
  logLevel: "silent",
  absWorkingDir: ROOT,
  nodePaths: [join(ROOT, "node_modules")],
  loader: { ".ts": "ts", ".tsx": "tsx" },
  jsx: "automatic",
});

const { renderLegacy, renderExtracted } = createRequire(import.meta.url)(fixtureBundle);

console.log("\n4. The panel renders byte-for-byte as it did on origin/main\n");

const step = (over = {}) => ({
  step: "portal",
  outcome: "created",
  message: "Portal created.",
  providerCode: null,
  details: {},
  ...over,
});

const BASE = {
  configureGaps: [],
  outcome: null,
  previewed: false,
  takeOver: false,
  busy: false,
  configureBlock: null,
  pending: false,
  onGapFix: () => {},
};

const SCENARIOS = [
  ["idle, nothing run yet", {}],
  ["mid-run: the spinner is on Preview and every control is dead", { busy: true, pending: true }],
  [
    "blocked by the portal contract",
    { configureBlock: "This venue authorises guests over RADIUS." },
  ],
  [
    "blocked AND previewed -- the block still wins on both buttons",
    { previewed: true, configureBlock: "This venue authorises guests over RADIUS." },
  ],
  ["one recognised gap, with its on-screen fix", { configureGaps: ["OPENAPI_REQUIRED"] }],
  [
    "several gaps, sorted, the unrecognised one printed verbatim and last",
    { configureGaps: ["SOMETHING_NEW", "GUEST_SSID_MISSING", "OPENAPI_REQUIRED"] },
  ],
  [
    "a gap while busy -- its fix button is dead too",
    { configureGaps: ["OPENAPI_REQUIRED"], busy: true },
  ],
  [
    "a dry run that would change things",
    {
      previewed: true,
      outcome: {
        dryRun: true,
        ok: true,
        changed: true,
        raw: { ok: true, steps: 3 },
        steps: [step(), step({ step: "pre_auth_access", outcome: "unchanged", message: "" })],
      },
    },
  ],
  [
    "a dry run with a step that would fail, carrying the controller's code",
    {
      previewed: true,
      outcome: {
        dryRun: true,
        ok: false,
        changed: false,
        raw: { ok: false },
        steps: [step({ outcome: "failed", message: "Refused.", providerCode: -41501 })],
      },
    },
  ],
  [
    "an apply that changed things",
    {
      previewed: true,
      outcome: {
        dryRun: false,
        ok: true,
        changed: true,
        raw: { ok: true },
        steps: [step({ step: "hotspot_operator", outcome: "updated" })],
      },
    },
  ],
  [
    "an apply that needed no change",
    {
      previewed: true,
      outcome: {
        dryRun: false,
        ok: true,
        changed: false,
        raw: {},
        steps: [step({ outcome: "unchanged" })],
      },
    },
  ],
  [
    "a partial apply -- 200 with ok:false, which is not an HTTP error",
    {
      previewed: true,
      outcome: {
        dryRun: false,
        ok: false,
        changed: true,
        raw: { ok: false },
        steps: [step(), step({ step: "hotspot_operator", outcome: "failed", providerCode: -1600 })],
      },
    },
  ],
  [
    "a run that reported no steps at all",
    { previewed: true, outcome: { dryRun: true, ok: true, changed: false, raw: null, steps: [] } },
  ],
  [
    "a step this build has no label for, printed raw rather than dropped",
    {
      previewed: true,
      outcome: {
        dryRun: true,
        ok: true,
        changed: true,
        raw: {},
        steps: [step({ step: "brand_new_step", outcome: "conjured" })],
      },
    },
  ],
  [
    "a failed step with no provider code -- no empty `Controller error code`",
    {
      previewed: true,
      outcome: {
        dryRun: false,
        ok: false,
        changed: false,
        raw: {},
        steps: [step({ outcome: "failed", providerCode: null })],
      },
    },
  ],
  ["take-over armed", { takeOver: true, previewed: true }],
];

for (const [name, over] of SCENARIOS) {
  const props = { ...BASE, ...over };
  const a = renderLegacy(props);
  const b = renderExtracted(props);
  check(
    `identical markup: ${name}`,
    a === b,
    a === b ? "" : `\n    legacy:    ${a.slice(0, 400)}\n    extracted: ${b.slice(0, 400)}`,
  );
}

// The scenarios above are only worth anything if they actually exercise the
// distinctions they claim to. A fixture that rendered the same string every
// time would pass all sixteen.
//
// Exactly one pair collides, and it is the correct answer rather than a hole:
// a blocked panel renders identically whether or not a preview is held,
// because the block wins on both buttons -- the same `disabled`, the same
// `aria-disabled`, and the block's sentence in both `title`s rather than
// "run the preview first". Pinned as an equality so that if the block ever
// stops winning, this fails.
const renders = SCENARIOS.map(([, o]) => renderExtracted({ ...BASE, ...o }));
eq("the scenarios are distinct renders, bar one deliberate pair", new Set(renders).size, 15);
eq(
  "and the pair is the blocked one: a block wins over a held preview",
  renderExtracted({ ...BASE, configureBlock: "This venue authorises guests over RADIUS." }),
  renderExtracted({
    ...BASE,
    previewed: true,
    configureBlock: "This venue authorises guests over RADIUS.",
  }),
);

// And the diff has to be able to fail: perturb one prop and the two must part.
check(
  "the equivalence check can detect a difference (control)",
  renderExtracted({ ...BASE, previewed: true }) !== renderLegacy({ ...BASE, previewed: false }),
);

console.log("\n5. The read-back -- the only thing allowed to say a write landed\n");

const applied = {
  ...BASE,
  previewed: true,
  outcome: { dryRun: false, ok: true, changed: true, raw: {}, steps: [step()] },
};

const notReadBack = renderExtracted({
  ...applied,
  confirmation: {
    state: "not-read-back",
    why: "Nothing reads the controller's configuration back.",
  },
});
check(
  "a surface that declared it cannot read back renders NO confirmation line",
  notReadBack === renderExtracted(applied) && !notReadBack.includes("Nothing reads the controller"),
);

const confirmed = renderExtracted({
  ...applied,
  confirmation: {
    state: "confirmed",
    detail: "Read back from the controller: the portal URL is ours.",
  },
});
check(
  "a confirmed read-back says what it saw",
  confirmed.includes("Read back from the controller: the portal URL is ours."),
);
check(
  "a confirmed read-back is not rendered in the destructive tone",
  !confirmed.includes('<p class="text-sm font-medium text-destructive">Read back'),
);

const contradicted = renderExtracted({
  ...applied,
  confirmation: {
    state: "contradicted",
    detail: "The controller reported success and the SSID still carries the previous portal.",
  },
});
check(
  "a contradicted read-back -- the errorCode 0 case -- is loud",
  contradicted.includes("text-destructive") &&
    contradicted.includes("still carries the previous portal"),
);

const unreadable = renderExtracted({
  ...applied,
  confirmation: {
    state: "unreadable",
    detail: "Could not read the configuration back — timed out.",
  },
});
check(
  "a read-back that itself failed says so, and does not call the write failed",
  unreadable.includes("Could not read the configuration back") &&
    !unreadable.includes("Some steps failed"),
);

check(
  "no confirmation state claims the write succeeded on the strength of its own response",
  [confirmed, contradicted, unreadable, notReadBack].every(
    (m) => !/applied successfully|written successfully|saved successfully/i.test(m),
  ),
);

// ===========================================================================
// 6. The hook, driven in a real browser.
// ===========================================================================

console.log("\n6. usePreviewThenApply, driven for real\n");

const hookEntry = join(outdir, "hook-entry.tsx");
writeFileSync(
  hookEntry,
  `import React from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { usePreviewThenApply } from "${p("src/hooks/usePreviewThenApply.ts")}";

const toOutcome = (r) => ({ dryRun: r.dryRun, ok: true, changed: true, steps: [], raw: r });

function Harness() {
  const [inputs, setInputs] = React.useState("a");
  const c = usePreviewThenApply({
    run: (dryRun) => globalThis.__run(dryRun),
    toOutcome,
    readBack: globalThis.__readBack,
    onPreviewed: () => { globalThis.__log.push("previewed"); },
    onApplied: (_o, conf) => { globalThis.__log.push("applied:" + conf.state); },
    onRefused: (gaps) => { globalThis.__log.push("refused:" + gaps.join(",")); },
    onFailed: () => { globalThis.__log.push("failed"); },
    inputs: globalThis.__useInputs ? inputs : undefined,
  });
  globalThis.__c = c;
  globalThis.__setInputs = setInputs;
  return (
    <div>
      <span id="previewed">{String(c.state.previewed)}</span>
      <span id="gaps">{c.state.gaps.join(",")}</span>
      <span id="outcome">{c.state.outcome ? "yes" : "no"}</span>
      <span id="conf">{c.state.confirmation ? c.state.confirmation.state : "none"}</span>
      <span id="running">{String(c.isRunning)}</span>
    </div>
  );
}

globalThis.__mount = () => {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const el = document.createElement("div");
  document.body.appendChild(el);
  createRoot(el).render(
    <QueryClientProvider client={qc}>
      <Harness />
    </QueryClientProvider>,
  );
};
`,
);

const hookBundle = join(outdir, "hook.js");
await build({
  entryPoints: [hookEntry],
  bundle: true,
  format: "iife",
  platform: "browser",
  outfile: hookBundle,
  logLevel: "silent",
  absWorkingDir: ROOT,
  nodePaths: [join(ROOT, "node_modules")],
  loader: { ".ts": "ts", ".tsx": "tsx" },
  jsx: "automatic",
  define: { "process.env.NODE_ENV": '"development"' },
});

const { chromium } = await import("playwright");
const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent("<!doctype html><html><body></body></html>");
await page.addScriptTag({ path: hookBundle });

/** Drive one scenario inside the page and return what the hook did. */
async function drive(script) {
  return page.evaluate(script);
}

const SETUP = `
  globalThis.__log = [];
  globalThis.__useInputs = USE_INPUTS;
  globalThis.__readBack = READ_BACK;
  globalThis.__run = RUN;
  document.body.innerHTML = "";
  globalThis.__mount();
  const settle = () => new Promise((r) => setTimeout(r, 40));
  const read = () => ({
    previewed: document.getElementById("previewed").textContent,
    gaps: document.getElementById("gaps").textContent,
    outcome: document.getElementById("outcome").textContent,
    conf: document.getElementById("conf").textContent,
    log: globalThis.__log.slice(),
  });
  await settle();
`;

const NO_READ_BACK = `{ kind: "not-read-back", why: "nothing reads it back" }`;

// -- the dry-run gate ------------------------------------------------------
{
  const r = await drive(`(async () => {
    ${SETUP.replace("USE_INPUTS", "false")
      .replace("READ_BACK", NO_READ_BACK)
      .replace("RUN", `(dryRun) => Promise.resolve({ dryRun })`)}
    const before = read();
    globalThis.__c.preview(); await settle();
    const afterPreview = read();
    globalThis.__c.apply(); await settle();
    return { before, afterPreview, afterApply: read() };
  })()`);
  eq("Apply starts disarmed", r.before.previewed, "false");
  eq("a completed preview arms Apply", r.afterPreview.previewed, "true");
  deep("and fires onPreviewed, not onApplied", r.afterPreview.log, ["previewed"]);
  deep("apply fires onApplied with the declared confirmation", r.afterApply.log, [
    "previewed",
    "applied:not-read-back",
  ]);
  eq("the apply's confirmation is held in state", r.afterApply.conf, "not-read-back");
}

// -- the 409, end to end ---------------------------------------------------
{
  const r = await drive(`(async () => {
    ${SETUP.replace("USE_INPUTS", "false")
      .replace("READ_BACK", NO_READ_BACK)
      .replace(
        "RUN",
        `(dryRun) => globalThis.__fail
           ? Promise.reject({ status: 409, data: { code: "PRECONDITIONS", missing: ["openapi_required"] } })
           : Promise.resolve({ dryRun })`,
      )}
    globalThis.__fail = false;
    globalThis.__c.preview(); await settle();
    const armed = read();
    globalThis.__fail = true;
    globalThis.__c.apply(); await settle();
    return { armed, refused: read() };
  })()`);
  eq("armed by the first preview", r.armed.previewed, "true");
  eq("a 409 disarms Apply", r.refused.previewed, "false");
  eq("a 409 drops the stale preview", r.refused.outcome, "no");
  eq("the gap reaches the screen UPPERCASE", r.refused.gaps, "OPENAPI_REQUIRED");
  check("onRefused carries the normalised gap", r.refused.log.includes("refused:OPENAPI_REQUIRED"));
  check("onFailed did NOT fire for a typed refusal", !r.refused.log.includes("failed"));
}

// -- an ordinary error leaves the preview alone ---------------------------
{
  const r = await drive(`(async () => {
    ${SETUP.replace("USE_INPUTS", "false")
      .replace("READ_BACK", NO_READ_BACK)
      .replace(
        "RUN",
        `(dryRun) => globalThis.__fail
           ? Promise.reject({ status: 503, message: "controller unreachable" })
           : Promise.resolve({ dryRun })`,
      )}
    globalThis.__fail = false;
    globalThis.__c.preview(); await settle();
    globalThis.__fail = true;
    globalThis.__c.apply(); await settle();
    return read();
  })()`);
  eq("a 503 does not disarm Apply", r.previewed, "true");
  eq("a 503 does not blank the preview an operator is reading", r.outcome, "yes");
  check("it goes to onFailed", r.log.includes("failed"));
  eq("and shows no gaps", r.gaps, "");
}

// -- stale-preview invalidation -------------------------------------------
{
  const r = await drive(`(async () => {
    ${SETUP.replace("USE_INPUTS", "false")
      .replace("READ_BACK", NO_READ_BACK)
      .replace("RUN", `(dryRun) => Promise.resolve({ dryRun })`)}
    globalThis.__c.preview(); await settle();
    const armed = read();
    globalThis.__c.invalidate(); await settle();
    return { armed, after: read() };
  })()`);
  eq("armed", r.armed.previewed, "true");
  eq("invalidate() disarms Apply", r.after.previewed, "false");
  eq("invalidate() drops the outcome", r.after.outcome, "no");
}

{
  const r = await drive(`(async () => {
    ${SETUP.replace("USE_INPUTS", "true")
      .replace("READ_BACK", NO_READ_BACK)
      .replace("RUN", `(dryRun) => Promise.resolve({ dryRun })`)}
    const onMount = read();
    globalThis.__c.preview(); await settle();
    const armed = read();
    globalThis.__setInputs("b"); await settle();
    const edited = read();
    globalThis.__c.preview(); await settle();
    globalThis.__setInputs("b"); await settle();
    return { onMount, armed, edited, same: read() };
  })()`);
  eq("mounting is not an edit", r.onMount.previewed, "false");
  eq("armed by a preview", r.armed.previewed, "true");
  eq("changing the inputs disarms Apply", r.edited.previewed, "false");
  eq("changing the inputs drops the preview", r.edited.outcome, "no");
  eq("setting the inputs to the same value does not disarm", r.same.previewed, "true");
}

// -- the read-back ---------------------------------------------------------
{
  const r = await drive(`(async () => {
    ${SETUP.replace("USE_INPUTS", "false")
      .replace(
        "READ_BACK",
        `{ kind: "read-back", verify: async () => ({ state: globalThis.__verdict, detail: "d" }) }`,
      )
      .replace("RUN", `(dryRun) => Promise.resolve({ dryRun })`)}
    globalThis.__verdict = "confirmed";
    globalThis.__c.preview(); await settle();
    globalThis.__c.apply(); await settle();
    const ok = read();
    globalThis.__verdict = "contradicted";
    globalThis.__c.apply(); await settle();
    return { ok, bad: read() };
  })()`);
  eq("a read-back that matches lands as confirmed", r.ok.conf, "confirmed");
  check("onApplied is handed the confirmation", r.ok.log.includes("applied:confirmed"));
  eq("a read-back that disagrees lands as contradicted", r.bad.conf, "contradicted");
  check(
    "onApplied is handed the contradiction rather than a success",
    r.bad.log.includes("applied:contradicted"),
  );
}

{
  const r = await drive(`(async () => {
    ${SETUP.replace("USE_INPUTS", "false")
      .replace(
        "READ_BACK",
        `{ kind: "read-back", verify: async () => { throw new Error("controller unreachable"); } }`,
      )
      .replace("RUN", `(dryRun) => Promise.resolve({ dryRun })`)}
    globalThis.__c.preview(); await settle();
    globalThis.__c.apply(); await settle();
    return read();
  })()`);
  eq("a read-back that throws lands as unreadable, not as a failed write", r.conf, "unreadable");
  check("and the apply still reports through onApplied", r.log.includes("applied:unreadable"));
}

{
  const r = await drive(`(async () => {
    ${SETUP.replace("USE_INPUTS", "false")
      .replace(
        "READ_BACK",
        `{ kind: "read-back", verify: () => new Promise((res) => { globalThis.__release = () => res({ state: "confirmed", detail: "d" }); }) }`,
      )
      .replace("RUN", `(dryRun) => Promise.resolve({ dryRun })`)}
    globalThis.__c.preview(); await settle();
    globalThis.__c.apply(); await settle();
    const midVerify = document.getElementById("running").textContent;
    globalThis.__release(); await settle();
    return { midVerify, after: document.getElementById("running").textContent, conf: read().conf };
  })()`);
  eq(
    "the screen stays busy while the read-back is in flight -- the write has returned and nothing yet knows if it took",
    r.midVerify,
    "true",
  );
  eq("and goes idle once it answers", r.after, "false");
  eq("with the verdict held", r.conf, "confirmed");
}

await browser.close();

// ===========================================================================

console.log("");
if (failures > 0) {
  console.log(`${failures} check(s) failed.`);
  process.exit(1);
}
console.log("all checks passed");
