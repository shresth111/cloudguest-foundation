# Router Setup Consolidation — Spec

**Status:** Ready for engineering. Three independent workstreams (§6), one of which (W1) is a blocker for the others.
**Audience:** FE engineer ×2, BE engineer, QA. §1 and §5 are mandatory reading for everyone; the rest is per-workstream.
**Branch:** `docs/router-setup-consolidation` off `origin/main` @ `f99c02b`.

## The ask, in the founder's words

> "A problem I have had fixed many times already: in Router Fleet there's an Advanced button — keep only that one and remove the rest. And check the scripts inside the Advanced button. Last time I configured using the .rsc file, and when the script executed RADIUS wasn't there and it didn't run. Make sure no errors happen."

Two asks: **(A)** collapse three setup entry points to one, **(B)** make the generated script stop failing.

Everything below is checked against `origin/main` @ `f99c02b`. Every claim carries a `file:line` or is explicitly marked unverified. Where a prior audit was **wrong**, §1 says so — believe §1 over any earlier document or briefing.

> ### ⚠ Read before starting: most of ask (A) is already built, unmerged
>
> While this spec was being written, branch **`fe/routers-advanced-only`** (commit `5f48b4b`, off `f99c02b`, **not** on `origin/main`) landed most of workstream W1 independently — and arrived at the same redirect decision this spec argues for in §4.1, carrying `$routerId` across as `?advanced=<id>`.
>
> **Already done there:** AC-5.1 (callout deleted), AC-5.2 (module docblock fixed), AC-5.3 (Guided/Wizard buttons removed from both the table row and the drawer; Advanced promoted to primary), §4.1 (both routes converted to `beforeLoad` throw-redirects, with the retirement reasoning in each file's docblock).
>
> **Still open in W1:** AC-5.4 (the customer-side redirect still uses `search: { open: router.id }`, `RouterDetailTabs.tsx:224`); every CI change in §4.5; the component deletions and the analyser/diagnostics move in §4.2 — that branch deliberately left `guided-setup/` and `fleet-wizard/` in the tree, correctly, since their suites import them directly.
>
> **Nothing in §3, §5 or §8 is addressed by that branch.** The two defects that actually explain the founder's last two failures are untouched. Do not read "the buttons are gone" as "the ask is done" — §3.1 in particular means the surviving entry point still generates a RADIUS-less script by default.
>
> Rebase this spec's workstreams onto that branch rather than re-doing it. Sections §2.1–§2.3 describe the **pre-`5f48b4b`** state, deliberately: they are the inventory the decisions were made from.

---

## §1 — Corrections to the prior audit. Read this first.

A prior field audit produced a defect list that has been circulating. **Most of it is fixed.** Building from that list would mean re-fixing solved problems while the two live defects stay live. Verdicts:

| Prior claim | Verdict | Evidence |
|---|---|---|
| Advanced panel's callout calls itself "legacy" and points at the Wizard, misdirecting operators | **Fixed, then re-broke differently.** The callout no longer points at the Wizard — it now points at **Guided Setup** and says *"shuruaat yahan se mat karo"* (don't start here). Still misdirection, still in scope. | `RouterSetupScriptAdvanced.tsx:1697-1730` |
| The module still describes itself as legacy | **Still open (cosmetic).** Module JSDoc is stale: *"legacy client-side… Prefer the server-driven provisioning wizard"* | `RouterSetupScriptAdvanced.tsx:2-3` |
| `/import` never pauses → DHCP lease read microseconds later → `gateway=0.0.0.0`, flags `Is` | **Fixed.** Bounded retry poll (`WAN_DHCP_GATEWAY_POLL_*`), plus `gatewayUsableExpr()` which exists specifically because `"0.0.0.0" != ""` is TRUE and a zero gateway passed the old non-empty check. Failure now `:error`s. | `RouterDetailTabs.tsx:1948-1968`, `:2306-2310`, `:4848` |
| WAN connectivity check FAIL only `:put`s, never `:error`s → `/import` sails past onto a router with no internet | **Fixed.** | `RouterDetailTabs.tsx:5631` |
| No NTP anywhere; hEX has no battery clock → bad `start-time`, `run-count=0`, router shows offline forever | **Fixed.** Timezone + two **plain-IP** NTP servers (deliberately not `pool.ntp.org` — an unresolvable NTP server never syncs), 5×4 s sync poll, and a hard `:error` if the clock is not synchronised. | `RouterDetailTabs.tsx:2330-2349`, `:2603`, `:2608` |
| `flash/hotspot/login.html` hardcoded; wrong model ⇒ `set [find …]` matches nothing and succeeds silently | **Fixed.** Path is now *discovered* at paste time via `/file find where name~"/login.html"`; the leading `/` is load-bearing (`login.html` is a substring of `rlogin.html` and `alogin.html`). | `RouterDetailTabs.tsx:1433-1443`, `:1472-1488` |
| A local `guest` hotspot user is a full portal bypass (RouterOS checks local users before RADIUS) | **Fixed.** The script now *removes* local hotspot users, counts what remains, and warns + `:log warning`s if any survive. | `RouterDetailTabs.tsx:6026-6062` |
| `idle-timeout` never set while `keepalive-timeout=none` is → nothing ever reaps a session | **Fixed.** | `RouterDetailTabs.tsx:6100`, `:6126` |
| WAN check runs before DNS is configured → false FAIL on a healthy box | **Fixed.** Check moved to after "LAN IP + DNS"; it also now reports `dnsCount` so a zero-resolver box is diagnosed rather than blamed on the WAN. | `RouterDetailTabs.tsx:5595-5613`, `:3939` |
| Re-clicking Generate rotates four secrets server-side with no UI warning; WireGuard/RADIUS chunks are add-if-missing with no `else`, so re-pasting cannot repair | **Fixed, both halves.** A blocking `window.confirm` sits above the first server call (not next to the button, so Cancel leaves the on-screen script valid), keyed on `generationCount > 0 \|\| router.hasApiCredentials` so a reload/other-browser/colleague still trips it; plus a persistent non-dismissable `RegeneratedNotice`. And the RADIUS chunk now writes **every** field unconditionally on the converge branch (`service=`, `address=`, `secret=`, `src-address=`, `timeout=3s`), which is what makes re-paste a real repair. | `RouterSetupScriptAdvanced.tsx:471-514`, `:86-108`; `RouterDetailTabs.tsx:6948` |
| Two tunnel names in play: frontend `wg-cloudguest`, backend `wg-cloudguard` | **Fixed in the Advanced generator; STILL LIVE in Guided and in CI.** See §2.3 — this is now an argument *for* deleting Guided, not against. | `RouterDetailTabs.tsx:1928`, `:1935` |
| The Wizard cannot complete on a fresh box and strands the operator at step 2 of 13 | **Confirmed in backend code, both halves.** (a) `RouterService.check_in` writes only `status` and `last_seen_at` (`app/domains/router/service.py:758-761`) — `management_ip_address` is written **only** by the heartbeat, and only if the device reports it (`app/domains/router/service.py:552-553`). (b) Nothing in the backend creates the RouterOS API user, and it says so: *"No backend code path creates that account -- it lives in a setup-script chunk an admin pastes by hand"* (`app/domains/provisioning_engine/planner/preflight.py:407-427`). Discover needs all three of `management_ip_address \|\| public_ip_address`, `api_username`, `api_secret` (`app/domains/provisioning_engine/planner/service.py:190-193`) over port 8728 (`:58`). The bootstrap script embeds no RADIUS and no API user (`app/domains/network_config/renderers.py:400-410`, `:1955-2033`). **So the Wizard's step 1→2 gap is real and structural, and the "API Access" chunk that closes it exists only in this frontend.** *(Numbering nit: the frontend array has 13 entries, `RouterFleetSetupWizard.tsx:93-128`; the backend runbook calls them "12 steps" numbering from 0, `docs/router_fleet/PROVISIONING_RUNBOOK.md:51-72`. Same list.)* |

**Net:** the Advanced generator is in far better shape than the briefing assumes. It has a 6,178-line test suite that passes today with 2,448 assertions (`scripts/test-setup-script-generator.mjs`, CI-gated at floor 1950 in `.github/workflows/ci.yml:468-473`). Do not rewrite it. The two defects that actually explain the founder's last two failures are new, narrow, and in §3.

---

## §2 — Inventory of the three entry points

All three are per-router buttons in the fleet table's Actions cell, `master.routers.tsx:434-461`.

### 2.1 Guided (`Compass`) — the current **primary** button

- Route `/master/routers/guided/$routerId` → `master.routers.guided.$routerId.tsx` → `guided-setup/GuidedSetup.tsx`.
- Styled `border-primary bg-primary` — it is the visually dominant action. Tooltip: *"Naye router ke liye yahi use karo"* (use this one for new routers). `master.routers.tsx:436-445`.
- ~300 KB of content across 18 files: 9 phases of universal paste blocks (`phases.content.ts`), an **output analyser** that parses pasted RouterOS terminal output into PASS/FAIL verdicts (`analyse.ts` 52 KB, `assertions.ts` 49 KB), a **diagnostics knowledge base** (`diagnostics.content.ts` 41 KB), and a `RegenerateGuard`.
- **It is not an alternative to Advanced — it is a consumer of it.** `generated-chunks.ts:23-46` maps three phases (`hotspot`, `portal`, `tunnel`) to Advanced's chunk labels, matched **by literal string**, because "the per-router half (the three IDs baked into the portal redirect URL, the WireGuard keypair, the RADIUS secret) can only come from the generator". Guided sends the operator to Advanced and back.
- Sole consumer of `src/lib/master-i18n/` (208 KB, en / hi / hi-Latn). This is the **only Hindi/Hinglish surface in the entire Master console** — verified: no importer of `master-i18n` outside `guided-setup/` and its own route.

### 2.2 Wizard (`Workflow`)

- Route `/master/routers/setup/$routerId` → `master.routers.setup.$routerId.tsx` → `fleet-wizard/RouterFleetSetupWizard.tsx` (53 KB).
- 13 server-driven steps: bootstrap → discover → compatibility → wan-input → wan-apply → wan-verify → topology → guest-input → conflict review → plan approval → apply → final verify → fleet-online (`RouterFleetSetupWizard.tsx:93-128`).
- ~20 backend endpoints via `router-fleet-wizard.service.ts` (bootstrap preview, discovery preflight, discover, compatibility, snapshots, basic-WAN preview/apply/verify, ISP links, guest availability, configuration plan CRUD, apply).
- Its script is rendered **server-side**. No frontend generator fix reaches it. Nothing in the Advanced panel or Guided depends on it.
- **It cannot complete on a factory-fresh box, and this is structural, not a bug to fix.** Step 1 (`discover`) needs `management_ip_address`, `api_username` and `api_secret` (`app/domains/provisioning_engine/planner/service.py:190-193`). Check-in writes none of them (`app/domains/router/service.py:758-761`); only the heartbeat writes the IP (`:552-553`); and no backend path creates the RouterOS API user at all (`app/domains/provisioning_engine/planner/preflight.py:407-427`). The chunk that creates it is generated **here, in the Advanced panel**. So the Wizard's own preflight tells the operator to go run a chunk from the surface this consolidation keeps — which is the clearest possible argument that it is not a competing entry point.
- The parent route `/master/routers` renders `<Outlet/>` when a child matches (`master.routers.tsx:78-90`) — that wrapper exists *only* for the Wizard route, and was itself a bug fix ("the wizard route was unreachable").

### 2.3 Advanced (`FileCode2`) — the one to keep

- **Not a route.** A search param on the fleet route: `goToAdvanced(id)` → `navigate({ to: "/master/routers", search: { advanced: id } })` (`master.routers.tsx:290-293`). The route already accepts a **legacy alias**: `advancedId = advancedRouterId ?? setupRouterId` (`master.routers.tsx:70-73`, `:192`). **This alias precedent is the template for §4.**
- Renders `RouterSetupScriptAdvanced.tsx` (1,765 lines), whose generator is `buildRouterSetupScriptChunks` in `RouterDetailTabs.tsx` (7,630 lines).
- Emits ~28 labelled chunks and three delivery channels: chunk-by-chunk copy, one-line flattened paste (`chunksToSingleLineScript`, `RouterDetailTabs.tsx:3160`), `.rsc` download (`chunksToRouterOsScript`, `:3038`), plus a documentation-only `.md`.
- Also the deep-link target from the customer-side Setup Script tab, which is already an `EmptyState` redirect ("Setup Script has moved to Master Console" → `/master/routers?open=<id>`, `RouterDetailTabs.tsx:216-227`). Consolidation is therefore Master-only, as briefed. **Note:** that redirect uses `open`, not `advanced` — it lands on the browse drawer, not the script panel. Minor, worth fixing in W1.

### 2.4 What is lost by deleting Guided and Wizard

| Asset | Lost with | Genuinely valuable? |
|---|---|---|
| Output analyser — parses pasted RouterOS terminal output into verdicts (`analyse.ts`, `assertions.ts`, `engine/`) | Guided | **Yes. Do not delete this.** See §4.2. |
| Diagnostics knowledge base — symptom → cause → fix, 41 KB (`diagnostics.content.ts`, `DiagnosticsLookup.tsx`) | Guided | **Yes.** Standalone-usable; nothing about it is coupled to the phase walk. |
| Hindi / Hinglish (`master-i18n`, 208 KB, 3 locales) | Guided | **Yes, and it is the only one.** The founder writes in Hinglish; the Advanced panel is English-only. §4.3. |
| Phase-by-phase verification gate ("Haan/Nahi" after each phase) | Guided | Partly — §5 rebuilds the same guarantee inside the script itself, which works for `/import` too. |
| `RegenerateGuard` | Guided | No — Advanced has its own equivalent (`RouterSetupScriptAdvanced.tsx:471-514`). |
| Server-driven discovery, compatibility report, WAN apply/verify, configuration plan editor | Wizard | Unresolved — these have no equivalent in Advanced. But they are also the steps that cannot run on a fresh box. Treat as **deferred capability, not deleted capability**; §4.4. |
| `<Outlet/>` wrapper on the fleet route | Wizard | No — becomes dead once the only child route goes. |

### 2.5 Orphans created

**Routes / components**
- `src/routes/master.routers.guided.$routerId.tsx`, `src/routes/master.routers.setup.$routerId.tsx`
- `src/components/routers/guided-setup/` (18 files), `src/components/routers/fleet-wizard/` (4 files)
- `src/lib/master-i18n/` + 5 locale JSONs
- `src/services/router-fleet-wizard.service.ts`, `src/hooks/useRouterFleetWizard.ts`, `src/types/router-fleet-wizard.ts`, `src/lib/discovery-preflight.ts`
- `RouterFleetRoute`'s `<Outlet/>` branch (`master.routers.tsx:78-90`)
- `src/lib/rsc-filename.ts` is shared by both Guided and Advanced — **keep it.**

**Tests (all currently gated in `.github/workflows/ci.yml`)**

| Suite | Floor | Orphaned by | Note |
|---|---|---|---|
| `test:output-analyser` | 116 | Guided | Also **locks in the stale tunnel name** — §3.3 |
| `test:guided-i18n` | — | Guided | Also locks the stale name (`check-guided-i18n.mjs:362`) |
| `test:guided-i18n-state` | — | Guided | |
| `test:guided-i18n-switch` | — | Guided | |
| `test:discovery-preflight` | 19 | Wizard | |
| `test:api-paths` | 5 | Wizard | Regression test for the Fleet Wizard WAN endpoint missing its `/network-config` prefix. The *discipline* is worth keeping even if the wizard goes. |

**i18n keys:** the entire `guided` and `guided-content` namespaces (en, hi, hi-Latn).

**Backend:** roughly 20 endpoints reachable only from the Wizard (`router-fleet-wizard.service.ts:400-770`). **Do not delete any of them in this change.** Removing a frontend caller does not prove no other caller exists, and the device-gateway repo is out of scope here.

### 2.6 Already-dead code found during this audit (out of scope, flagged)

`src/components/routers/manual-wizard/` — ~400 KB across 12 files — **has no runtime consumer.** The only reference to it outside its own directory is a comment (`RouterDetailTabs.tsx:6196`). Its own index says so plainly: *"Nothing in here executes"* (`manual-wizard/index.ts:33`). Yet `test:manual-wizard` (113 checks) is gated in **both** CI pipelines (`.github/workflows/ci.yml:242`, `Jenkinsfile:139`) — it is the only router-setup suite in the Jenkinsfile at all. CI spends more effort protecting dead content than it does on the generator that keeps breaking. Recommend a separate ticket; do not bundle it here.

---

## §3 — The two live defects that explain the founder's last two failures

Everything in §1 is fixed. These are not.

### 3.1 BLOCKER — RADIUS is silently skipped when the checkbox is off, and nothing says so

**This is the founder's exact complaint: "when the script executed RADIUS wasn't there and it didn't run."**

`RouterSetupScriptAdvanced.tsx:315-316`:

```ts
const [enableWireguard, setEnableWireguard] = useState(false);
const [enableRadius,   setEnableRadius]    = useState(false);
```

**Both default to OFF.** The generation path is `if (enableRadius && wireguard) { … }` (`:680`). `notProvisioned` — the array that drives the loud `INCOMPLETE SCRIPT` chunk and its `:error` — is only ever pushed to from a `catch` block (`:667`, `:701`, `:766`). **A checkbox left unticked is not a caught error.**

So the default path is:

1. Operator opens Advanced, fills in WAN/LAN, clicks Generate without ticking two checkboxes.
2. `notProvisioned` is `[]` → the `INCOMPLETE SCRIPT` chunk is never emitted (`RouterDetailTabs.tsx:4209`) → no `:error`, no `#` banner in the `.rsc` (`:3063-3075`).
3. The script generates ~24 chunks instead of ~28. There is nothing in it, anywhere, naming the gap.
4. `/import` runs clean. `/radius` is empty. The hotspot serves a captive portal that Access-Rejects every guest, with no error on the device.

The code already knows this failure shape — `RouterDetailTabs.tsx:4239-4241` spells it out for the *bridge-500* case: *"the hotspot will reject EVERY guest login. RouterOS reports no error for this."* The guard was built for the failure path and never wired to the un-ticked path.

There is a second, narrower instance of the same bug: if WireGuard fails, `notProvisioned` gets `"WireGuard tunnel"` but **not** `"RADIUS"`, even though `radius` is then unconditionally `undefined` and the RADIUS chunk vanishes too. The `INCOMPLETE SCRIPT` banner under-reports.

The checkbox *coupling* is correct and should be kept: ticking RADIUS turns WireGuard on, unticking WireGuard turns RADIUS off (`:1244-1248`, `:1293-1298`). The defaults are the bug.

### 3.2 BLOCKER — the `.rsc` channel is the only one with no way to tell a partial run from a complete one, and the UI calls it the safe option

`chunksToSingleLineScript` brackets every chunk with progress markers and ends with a `COMPLETE` sentinel (`RouterDetailTabs.tsx:3169-3177`):

```
:put "### cloudguest 9/28 START Heartbeat"   … statements …   :put "### cloudguest 9/28 DONE Heartbeat"
:put "### cloudguest COMPLETE -- all 28 chunk(s) ran. A run that ends anywhere else stopped early."
```

`chunksToRouterOsScript` — the `.rsc` builder — emits **none of them** (`:3038-3081`). It emits `# --- 9. Heartbeat ---` comments, which are comments.

Nine chunks carry a hard `:error` (`RouterDetailTabs.tsx:1663, 2603, 2855, 2962, 4264, 4848, 5631, 6915`, plus the guest-plane deferred checks). Under `/import`, an `:error` aborts the remainder of the file. So the `.rsc` — the channel the founder actually uses — is precisely the channel where "aborted at chunk 9" and "ran all 28" are hardest to distinguish.

And the panel copy actively steers him there. `RouterSetupScriptAdvanced.tsx:1383`: *"Prefer that, or Download .rsc, if you have any doubt."* `:1414`: *"Download .rsc is the actually safe alternative."* The docstring at `:3049-3057` even records that the `.rsc` "is the one that bit first" — and then the function it documents adds no markers.

The fix is the same primitive, applied to the other serializer. It costs ~60 characters per chunk.

### 3.3 Guided has the stale WireGuard interface name, and CI locks it in

`RouterDetailTabs.tsx:1928` — `WIREGUARD_INTERFACE_NAME = "wg-cloudguard"`, with `wg-cloudguest` retained only as `WIREGUARD_LEGACY_INTERFACE_NAME` (`:1935`), read and reported, never removed (`:2803`).

Guided still uses the old name in live-config positions, not just in recovery:

- `phases.content.ts:121` — audit prints `wireguard-count` from `find where name="wg-cloudguest"` → reports **0** on a correctly-provisioned router.
- `phases.content.ts:520` — reads the tunnel IP off `wg-cloudguest` to set `/radius src-address`. On a current router this finds nothing and prints *"wg-cloudguest pe koi address nahi — WireGuard chunk paste hua?"* — i.e. it tells the operator the WireGuard chunk was never pasted, when it was.
- `phases.content.ts:726` — recovery `remove [find name="wg-cloudguest"]`. Correct as-is.
- `diagnostics.content.ts:313-382` — six fixes keyed to the old name. §317-320 even documents the two-name split as a known symptom, which means it was known and Guided was not updated.

And CI asserts the stale name: `scripts/test-output-analyser.mjs:168,189` fixtures on `name="wg-cloudguest"`, and `scripts/check-guided-i18n.mjs:362` holds `\bwg-cloudguest\b` as a protected token. **Both suites are green on `origin/main` while asserting a name the generator abandoned.** Deleting Guided deletes this class of drift permanently — which is the strongest technical argument for the founder's instruction.

---

## §4 — Recommendation on the orphans

### 4.1 Routes: keep as redirects, do not 404. **Decision: redirect.**

Both routes stay as files; each becomes a `beforeLoad` throw-redirect to `/master/routers?advanced=$routerId`. Reasons, in order of weight:

1. **The failure mode is asymmetric.** A 404 lands on an operator standing at a rack with WinBox open. A redirect lands him on the one panel he now needs. The cost of being wrong about a bookmark is a support call from a venue; the cost of the redirect is ~15 lines.
2. **The precedent already exists in this exact route.** `advanced` already carries a legacy alias `setup` (`master.routers.tsx:70-73`, `:192`), added for the same reason. Follow it rather than inventing a policy.
3. **Guided's URL is in circulation.** It is linked from inside the Advanced panel itself (`RouterSetupScriptAdvanced.tsx:1723`), so it is reachable from the surface being kept — not merely from bookmarks.

Redirect, do not `<Navigate>`-render: a rendered redirect flashes a shell first. Use TanStack's `beforeLoad` + `redirect()` so the URL never renders.

**Retire the redirects on a date, not on a vibe.** Add a `// REMOVE AFTER 2026-12-01` marker on both files.

### 4.2 Components: delete `fleet-wizard/`, delete Guided's *UI*, **keep Guided's analyser and diagnostics**

The output analyser (`analyse.ts`, `assertions.ts`, `engine/`) and the diagnostics knowledge base (`diagnostics.content.ts`, `DiagnosticsLookup.tsx`) are the parts of Guided that are not a second entry point — they are a debugging tool that happens to live behind one. Move them to `src/components/routers/diagnostics/` and surface them as a **tab inside the Advanced panel**, not a route. That keeps `test:output-analyser` alive and honest (after fixing its stale fixture, §3.3), and it means "paste the output back, tell me what's wrong" survives the consolidation.

This is not scope creep — it is what makes the consolidation safe to do at all. Without it, deleting Guided deletes the only tool that reads a failed run.

Delete outright: `GuidedSetup.tsx`, `PhaseView.tsx`, `CheckRow.tsx`, `CopyBlock.tsx`, `LanguageSwitch.tsx`, `RegenerateGuard.tsx`, `GeneratedChunkCallout.tsx`, `progress.ts`, `rsc.ts`, `generated-chunks.ts`, `phases.content.ts`, `types.ts`, and all of `fleet-wizard/` + its service/hooks/types.

### 4.3 Hindi: an explicit decision the founder must make, not an implicit deletion

Deleting Guided removes the Master console's only Hindi/Hinglish surface. Two options; **do not pick one silently:**

- **(a) Drop it.** Advanced is English-only and stays that way. Cheapest. Defensible if the Advanced panel's operators read English — but the founder's own tooltips and callouts are written in Hinglish, which is evidence against.
- **(b) Carry `master-i18n` over to the diagnostics tab** (§4.2). That is where an operator under pressure actually needs his own language, and it is the smallest surface that justifies the 208 KB.

Recommendation: **(b)**, and translate only the diagnostics namespace. Ship (a) only if the founder says so in writing.

### 4.4 Backend endpoints: leave every one of them alone

Delete no backend route in this change. Deleting the frontend caller is not evidence there is no other caller, `wyfy-device-gateway` is out of scope, and an unused endpoint costs nothing while a wrongly-deleted one costs a re-deploy. If a cleanup is wanted, it is a separate ticket gated on log evidence of zero traffic.

### 4.5 CI

- Delete the four Guided/Wizard suites' steps **in the same PR** that deletes their sources — a suite importing a deleted module fails the `tests` job for everyone.
- **Keep** `test:output-analyser`, retargeted at the moved module, floor unchanged at 116, **with its `wg-cloudguest` fixtures corrected to `wg-cloudguard`** (§3.3).
- **Add `test:setup-script` to `Jenkinsfile`.** It is gated in `.github/workflows/ci.yml:468-473` (floor 1950) but absent from the Jenkinsfile, whose only router-setup suite is `test:manual-wizard` — a test for dead code (§2.6). Both pipelines should gate the generator.

---

## §5 — Acceptance criteria for "make sure no errors happen"

The founder's sentence cannot be satisfied literally: a router with no WAN cable *must* produce an error. The disease is not errors — **it is a script that silently does half its job and reports nothing.** So "no errors" is translated into four properties, each independently checkable.

### 5.0 The four properties

1. **Nothing is ever silently absent.** Any subsystem the operator asked for and did not get is named in the artifact, and the artifact refuses to run.
2. **A genuine precondition failure aborts loudly.** No WAN, no DHCP lease, no NTP sync, no tunnel address → stop, with a message naming the cause and the remedy. Do not "continue anyway".
3. **Re-running is safe and repairs.** Every chunk is idempotent, and re-pasting a fresh script converges an already-provisioned router rather than duplicating or no-op'ing.
4. **The operator can always tell "ran clean" from "aborted three lines in"**, in every delivery channel, without reading a column number.

Property 1 is defect §3.1. Property 4 is defect §3.2. Properties 2 and 3 are largely met today and mostly need locking down with tests.

### 5.1 AC-1 — Completeness is asserted, not assumed

- **AC-1.1** `enableWireguard` and `enableRadius` default to `true` (`RouterSetupScriptAdvanced.tsx:315-316`). A new router with a factory-reset box is the common case; the current defaults optimise for the rare one.
- **AC-1.2** Any *deselected* subsystem pushes a `notProvisioned` entry with `why: "not selected in the Advanced panel"`. Deliberate omission and failed omission must be indistinguishable **in the artifact** — the operator holding the `.rsc` a week later cannot recover the intent.
- **AC-1.3** When `enableRadius` is true and `wireguard` is undefined, `notProvisioned` gains **both** `"WireGuard tunnel"` **and** `"RADIUS"`.
- **AC-1.4** Generating with any subsystem missing requires an explicit confirm naming what will be absent and what it costs, reusing the `SECRET_REPAIR` dialog shape (`:471-514`) rather than a toast.
- **AC-1.5** Test: for every combination of the two checkboxes, the emitted chunk set and the `INCOMPLETE SCRIPT` chunk agree — a chunk label is absent **iff** a matching `notProvisioned` entry exists. This invariant is the whole of AC-1 and it is a pure function of the generator, so it belongs in `test-setup-script-generator.mjs`.

### 5.2 AC-2 — Preconditions abort loudly, and the abort is the *first* thing in the file

- **AC-2.1** These stay hard `:error`s, unchanged: incomplete script (`:4264`), no DHCP gateway (`:4848`), no WAN/DNS (`:5631`), clock not synchronised (`:2603`), RADIUS `src-address` not on the tunnel interface (`:6915`), no HTTPS walled-garden entry (`:1663`), tunnel identity mismatch (`:2855`).
- **AC-2.2** The guest-plane verdicts (walled-garden, portal-identity) stay **deferred to the end** and stay non-fatal to the management plane. The reasoning at `:4182-4198` is correct and load-bearing: a broken portal is fixable remotely, an absent tunnel/API-user/heartbeat is a site visit. **Do not "improve" this by moving them earlier.**
- **AC-2.3** The RADIUS chunk's own read-back verdict currently `:put`s FAIL without `:error`ing (`:6975-6976`). Decide explicitly and record the decision in the code: it runs *after* the tunnel is up, so an `:error` there costs nothing downstream — recommend promoting it to `:error`, since a FAIL means no guest can ever log in.
- **AC-2.4** `INCOMPLETE SCRIPT` remains chunk **#1**, and its `#`-comment restatement remains at the very top of the `.rsc` (`:3063-3075`). It configures nothing, so aborting there costs nothing.

### 5.3 AC-3 — Idempotence

- **AC-3.1** Running the same `.rsc` twice on the same router leaves identical device state and produces no duplicate objects — specifically no second `/radius` entry (RouterOS tries servers in order; a stale first entry makes every login wait out its timeout, `:6989`), no second hotspot profile, no second scheduler, no second firewall rule.
- **AC-3.2** Every "converge" branch writes **every** field it owns, not just the changed ones. The RADIUS chunk is the reference implementation (`:6948`) and the comment above it records exactly why (`service=`, `timeout=`, `address=` were each unrepairable by re-paste before). Audit the WireGuard, Heartbeat, Hotspot and API Access chunks against that standard.
- **AC-3.3** `SECRET_REPAIR[s].repairableByRepaste` is true **iff** that secret's chunk has a converge branch that writes it. Already asserted for RADIUS (`:6897-6899`); extend the assertion to all four secrets.
- **AC-3.4** Idempotence is a *device* property. The generator test can only assert the shape (guarded `add`, unconditional `set`). Mark the on-device half as a manual QA gate — see §5.6 — rather than pretending a text test covers it.

### 5.4 AC-4 — Run/abort is legible in every channel

- **AC-4.1** `chunksToRouterOsScript` emits the same `SINGLE_LINE_MARKER_PREFIX` START/DONE/COMPLETE markers as `chunksToSingleLineScript`, as real `:put` statements (not `#` comments — a comment prints nothing, and printing is the point).
- **AC-4.2** Test: for the same chunk array, the set of markers in the `.rsc` output equals the set in the one-line output. One assertion, and it can never drift again.
- **AC-4.3** The panel's `.rsc` copy tells the operator what to look for after `/import`, in the same words as the one-line copy already uses (`:1401`): the last line must read `### cloudguest COMPLETE`; a trailing `START <n>/<N> <label>` names the chunk it died in.
- **AC-4.4** The downloaded `.rsc` carries the same instruction in its `#` header, because the file is read without the panel around it.
- **AC-4.5** *Unverified, needs a device:* whether RouterOS `/import` echoes `:put` output to the terminal, and whether its trailing "Script file loaded and executed successfully" is emitted only on a clean run. If `/import` suppresses `:put`, AC-4.1 must fall back to writing markers into `/log` (`:log info`) instead, and AC-4.3 changes to "check `/log print`". **Resolve this on real hardware before implementing AC-4.1** — the whole of AC-4 hinges on it and nobody in this repo has recorded the answer.

### 5.5 AC-5 — The panel stops pointing elsewhere

- **AC-5.1** Delete the "Provisioning a new router? Use Guided Setup" callout and both its links (`RouterSetupScriptAdvanced.tsx:1697-1730`).
- **AC-5.2** Fix the module JSDoc (`:2-3`) — it still calls this file legacy and recommends the wizard.
- **AC-5.3** Remove the `Compass` / `Workflow` imports and the two `<Link>`s in the fleet table (`master.routers.tsx:436-452`); the Advanced button becomes the primary-styled single action.
- **AC-5.4** Point the customer-side redirect at the script panel: `search: { advanced: router.id }` rather than `{ open: router.id }` (`RouterDetailTabs.tsx:222`).

### 5.6 The manual gate — one real router, recorded

None of the above proves the script works. Before this ships, one factory-reset MikroTik gets provisioned end-to-end **via the `.rsc` channel**, and the operator records:

1. The full `/import` terminal output.
2. `/radius print detail`, `/interface wireguard print`, `/ip hotspot print`, `/system ntp client print`, `/user print`.
3. A guest phone completing OTP sign-in and reaching the internet.
4. The router showing **online** in Master console within 10 minutes.
5. The same `.rsc` imported a **second** time (AC-3.1), with the same five outputs re-captured and diffed.

Paste the results into this document's PR. A green test suite is not evidence about a router.

---

## §6 — Workstreams

| | Scope | Depends on |
|---|---|---|
| **W1 — Consolidate the UI** | **Mostly done on `fe/routers-advanced-only`.** Remaining: AC-5.4, CI changes per §4.5, component deletions + analyser/diagnostics move per §4.2 | Founder's §4.3 Hindi decision |
| **W2 — Completeness** | AC-1.1–1.5 + AC-6.1/6.5, i.e. defect §3.1 | none — **start here** |
| **W3 — Legibility & idempotence** | AC-2.3, AC-3.1–3.4, AC-4.1–4.5, i.e. defect §3.2 | AC-4.5 device answer before AC-4.1 |
| **W4 — RADIUS operator-facing facts** | AC-6.2–6.4 | W2 |
| **W5 — out of scope, ship first** | §8.5 `regenerate-secret` hazard | — |

W2 and W3 are both pure-generator changes and both land in `RouterDetailTabs.tsx` + `test-setup-script-generator.mjs`; sequence them, do not parallelise them across two engineers. W1 and W4 touch disjoint files and can run alongside.

**W2 first.** It is the founder's literal complaint, it is ~30 lines, and it is shippable without waiting on anything.

**W5 is not part of this consolidation and should still go out before it** — §8.5 is a customer-facing button that silently de-authenticates a venue.

---

## §7 — Open questions requiring a decision before implementation

1. **§4.3 — Hindi.** Drop, or carry to the diagnostics tab? Founder decides.
2. **AC-4.5 — `/import` and `:put`.** Needs one device. Blocks AC-4.1's implementation shape.
3. **AC-2.3 — should the RADIUS read-back verdict `:error`?** Recommend yes; wants one line of founder/BE agreement because it changes abort behaviour on already-deployed routers being re-pasted.
4. **§2.6 — `manual-wizard/`.** 400 KB of dead code with 113 CI-gated assertions. Separate ticket, but someone should own the decision.
5. **§8.5 — the customer-facing `regenerate-secret` button.** Needs a decision this week; it is a live foot-gun independent of this consolidation.
6. **§8.4 — should the backend gain a non-rotating read/resync path?** BE decision. Everything in §8 is workaroundable without it; nothing is *comfortable* without it.

---

## §8 — The RADIUS question

The operator reported *"RADIUS wasn't there and it didn't run."* §3.1 is the frontend half. This section is what has to be true **before** the `.rsc` is generated for the RADIUS chunk to work at all — established from backend code — and what the UI does and does not tell the operator.

### 8.1 The preconditions, in order. All four are hard.

1. **A WireGuard peer must already exist for the router.** `register_external_radius_nas` calls `wireguard_service.get_peer(...)` and **404s** if there is none (`app/domains/guest/router.py:1274-1278`). The frontend gets this right by construction — `allocate-external` runs first (`RouterSetupScriptAdvanced.tsx:614-644`) and the RADIUS block is gated on `wireguard` being truthy (`:680`).
2. **The NAS must be registered through `register-external`, which is the only path that reaches the hub.** It `POST`s `{tunnel_ip, nas_identifier, secret}` to the FreeRADIUS agent with an `X-Agent-Secret` header (`app/domains/guest/radius_bridge.py:93-163`, agent at `ops/hub-agents/radius_agent.py:215-260`) and raises 502 if the push fails. **Every other registration path is DB-only** and produces a NAS the hub has never heard of: `POST /radius/nas` (`guest/router.py:1198-1229`), the provisioning-engine auto-register (`app/domains/provisioning_engine/service.py:952-963`, which also uses a *different* identifier scheme, `router-{id}` vs `cg-{id[:8]}`), and `POST /customers/{id}/generate-nas` — which is a **stub that writes nothing at all and returns a random fake secret** while reporting "NAS device registered" (`app/domains/customer_provisioning/service.py:120-131`).
3. **The NAS identifier is server-assigned and never round-trips.** `nas_identifier = f"cg-{str(router_id)[:8]}"`, set on first registration only (`guest/router.py:1296`); a rotate keeps the existing one. The hub keys its `client{}` stanza on `shortname = <nas_identifier>` and `ipaddr = <tunnel_ip>/32` (`radius_agent.py:27-38`, `:215-260`). Nothing about this is surfaced in the Advanced panel, and nothing needs to be — but see 8.3.
4. **The device must source from the tunnel IP the platform registered.** Already enforced on-device: the RADIUS chunk refuses to write `src-address` if the router does not hold that address on `wg-cloudguard`, and `:error`s (`RouterDetailTabs.tsx:6910-6915`). Correct, keep.

### 8.2 Secret rotation — the briefing was right, and it is worse than stated

`register-external` **rotates unconditionally** when a NAS row already exists (`guest/router.py:1280-1298` — `if existing: regenerate_secret(...) else: register_nas(...)`), overwriting `shared_secret_encrypted` with the old plaintext unrecoverable (`app/domains/guest/service.py:4486-4493`). The lookup is not status-filtered, so a `DISABLED` NAS is rotated too.

The part the briefing did not have: **there is no read-only getter and no non-rotating re-push.** Confirmed absent:

- No endpoint returns the current shared secret. It is exposed exactly once, in `RadiusNasCreatedResponse` (`app/domains/guest/schemas.py:523-530`), from three POSTs only. Every `GET` omits it (`_nas_response`, `guest/router.py:320-338`).
- No `resync` endpoint pushes the existing secret to the hub without rotating.
- This is deliberate, and the reasoning is recorded in-tree (`app/domains/hub_reconciliation/service.py:169-177`): a general-purpose reveal would make *"hand me this NAS's live credential"* a supported operation.

**Consequence, and this is the operational rule:** once Generate is clicked, the only copy of the working RADIUS secret in the world is the one in that script. If the operator loses it, the *only* way to get a working one is to click Generate again — which rotates again. **Registering and pasting must happen in one sitting.** The panel's regenerate confirm already says the right thing in general terms (`RouterSetupScriptAdvanced.tsx:497-511`) but does not say *this*.

The one thing that self-heals: the 5-minute reconciliation sweep re-pushes the **current** DB secret to the hub on tunnel-address drift, without rotating (`app/domains/hub_reconciliation/service.py:169-185`, interval `constants.py:39`). It repairs a stale *hub*. It cannot repair a stale *device*.

### 8.3 What the UI must tell the operator — AC-6

- **AC-6.1** The `INCOMPLETE SCRIPT` chunk and the `.rsc` header must fire when RADIUS was never requested, not only when it failed. This is AC-1.2; restated here because RADIUS is the case that motivated it.
- **AC-6.2** The regenerate confirm (`:497-511`) gains one sentence for the RADIUS secret specifically: *"This script is the only copy. There is no way to read this secret back — losing it means generating again, which rotates it again."* Verified true (§8.2), and it is the fact that turns a shrug into care.
- **AC-6.3** The panel states the one-sitting rule where the operator reads it before walking to the venue: register and paste in the same session; do not generate today and paste tomorrow.
- **AC-6.4** After a successful generate with RADIUS on, show the assigned `nas_identifier` (`cg-<8>`) and the registered tunnel IP in the panel. Both come back on the response path already; they are what an engineer needs to grep the hub's `clients.conf` when a venue reports "no guest can log in", and today neither is visible anywhere in the console.
- **AC-6.5** Test: `enableRadius === true` ⇒ the emitted chunk list contains a `"RADIUS"` chunk **or** `notProvisioned` contains a RADIUS entry. Never neither. (This is AC-1.5 specialised, and it is the single assertion that would have caught the 2026-08-27 incident.)

### 8.4 Backend asks — small, and neither blocks the frontend work

1. **`GET /radius/nas/{nas_id}/secret`** (global scope, audited) or, better, **`POST /radius/nas/register-external/{router_id}?rotate=false`** — return the existing secret and re-push it to the hub without rotating. This is the same `?rotate=` shape the WireGuard allocate path already uses (`RouterSetupScriptAdvanced.tsx:635-644`), so it is a familiar contract, and it would make "re-generate the script without breaking the router" possible for the first time. Weigh against the deliberate no-reveal stance at `hub_reconciliation/service.py:169-177`; the `?rotate=false` framing sidesteps most of that objection because the secret still only leaves the system through a provisioning call.
2. **Make the DB-only registration paths refuse or warn.** `POST /customers/{id}/generate-nas` (`app/domains/customer_provisioning/service.py:120-131`) returns a fabricated secret and a success message while writing nothing. It should 501, not lie.

### 8.5 HAZARD found during this audit — `regenerate-secret` is wired to two UI buttons and never reaches the hub

`POST /radius/nas/{nas_id}/regenerate-secret` (`app/domains/guest/router.py:1548-1574`) rotates the DB secret and **does not call `push_nas_client`**. The hub keeps the old secret; the DB has a new one; the device has the old one. Every guest login on that router then Access-Rejects, with — per the pattern documented throughout this codebase — nothing on either side naming the cause. The 5-minute sweep does **not** fix it: it only fires on tunnel-address drift (`hub_reconciliation/service.py:326-360`).

The frontend exposes this on two surfaces:

- `src/routes/master.nas.tsx:196` — Master console.
- `src/routes/_authenticated/locations.$locationId.nas.$nasId.tsx:58` — **customer-facing.** A venue owner can break their own RADIUS from their own dashboard, with a button that reports success.

**This is out of scope for the consolidation and should be its own ticket, this week.** Minimum fix: make the endpoint push to the bridge like `register-external` does, or remove both buttons until it does. Do not ship the consolidation while a customer-facing button can silently de-authenticate a venue.
