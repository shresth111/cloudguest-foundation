/**
 * The alert-channels surfaces must not claim anything they have not proved,
 * and must never render a credential.
 *
 * WHY THIS EXISTS
 * ---------------
 * Settings -> Notifications used to render a Slack webhook input above a Save
 * button that raised `toast.success("Notifications updated")`. Nothing was
 * wired: `settingsService.updateSection` is a `delay(250)` and a mutation of a
 * module-level object, so the value did not survive a refresh. A Slack
 * incoming-webhook URL is bearer-equivalent -- anyone holding it can post into
 * the channel -- and the screen invited an operator to paste one, told them it
 * was stored, and dropped it.
 *
 * The replacement is not "make the save real". The thing it pretended to save
 * already has a home (`POST /api/v1/notifications/channels`: encrypted at
 * rest, org-scoped, delivery-logged, testable), and a second place to
 * configure the same webhook is exactly how this codebase acquired several
 * independent Slack credential paths at once. So the duplicate is gone and the
 * Master console got the real surface.
 *
 * THE ASSERTIONS THAT MATTER, in order of how badly a regression would hurt:
 *
 *   1. THE FAKE CREDENTIAL INPUT DOES NOT COME BACK. No Slack webhook field,
 *      no mock-backed save, no success toast, on the settings panel or in the
 *      settings types/mock state.
 *   2. THE MASTER PAGE NEVER RENDERS A SECRET. It reads only the redacted
 *      `configSummary`, never a `config`, and never a raw webhook URL.
 *   3. "SEND TEST" DOES NOT CLAIM SUCCESS. The endpoint returns 202 -- queued,
 *      not delivered -- so the mutation must not raise `toast.success`.
 *      Claiming a delivery nobody has observed is the precise bug this whole
 *      change is a response to.
 *   4. A TEST DELIVERY IS NOT SHOWN AS A REAL ONE. `lastDelivery.kind` must be
 *      read, or a channel that only ever passed a test reads as proven.
 *   5. THE MASTER CALL DOES NOT NARROW ITSELF TO ONE TENANT. A platform read
 *      must not attach `X-Organization-Id`, and the org id must not be in a
 *      React Query key (it travels as a header).
 *
 * WHY IT LOOKS LIKE THIS: this repo has no test runner (see
 * `scripts/test-master-integration-repair.mjs` for the same note). The screens
 * and the service are asserted against their real sources.
 *
 * Run: node scripts/test-alert-channels-honesty.mjs
 */

import { readFileSync } from "node:fs";
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

const read = (rel) => readFileSync(join(ROOT, rel), "utf8");
/** Comments quote the defects they replaced, so assertions about what the
 * code DOES must read code, not prose. */
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const panel = stripComments(read("src/components/settings/panels/NotificationsPanel.tsx"));
const settingsTypes = stripComments(read("src/types/settings.ts"));
const settingsService = stripComments(read("src/services/settings.service.ts"));
const page = stripComments(read("src/routes/master.notification-channels.tsx"));
const monitoringService = stripComments(read("src/services/monitoring.service.ts"));
/** Prose wraps wherever prettier decides, so prose assertions normalise
 * whitespace rather than pinning a line break that is not ours to choose. */
const flat = (src) => src.replace(/\s+/g, " ");

/* ── 1. The fake credential input does not come back ───────────────────── */

console.log("\nSettings -> Notifications no longer fakes a saved webhook");

check(
  "the settings panel has no Slack webhook input",
  !/slackWebhookUrl/.test(panel),
  "a bearer-equivalent credential bound to an in-memory mock",
);
check("the settings panel has no webhook endpoint input", !/webhookEndpoint/.test(panel));
check(
  "the settings panel no longer raises a success toast",
  !/toast\.success/.test(panel),
  "updateSection persists nothing, so nothing may be reported as updated",
);
check("the settings panel no longer calls the mock save at all", !/useUpdateSection/.test(panel));
check(
  "NotificationSettings carries no credential fields",
  !/slackWebhookUrl|webhookEndpoint/.test(settingsTypes),
  "leaving the field is how the next input reintroduces the bug",
);
check(
  "the settings mock state holds no fake webhook URL",
  !/hooks\.slack\.com/.test(settingsService),
);
check(
  "the panel points at where destinations really live",
  /\/monitoring/.test(panel),
  "removing a screen without saying where the setting went reads as a regression",
);

/* ── 2. The Master page never renders a secret ─────────────────────────── */

console.log("\nThe Master alert-channels page renders redactions, never credentials");

check("the page reads the redacted summary", /configSummary/.test(page));
check(
  "the page never reads a decrypted config off a channel",
  !/\bchannel\.config\b|\bc\.config\b(?!Summary)/.test(page),
  "the API does not return one; reading one would mean it had started to",
);
check("the page renders the masked target, not a URL", /configSummary\??\.target/.test(page));
check(
  "credential inputs in the create drawer are password-typed and not autofilled",
  (page.match(/type="password"/g) || []).length >= 2 && /autoComplete="off"/.test(page),
  "an operator's browser must not offer to save a customer's webhook",
);
check(
  "the create drawer clears its credential draft on close",
  /reset\(\);\s*\n\s*onClose\(\)/.test(page),
  "the secret is a draft in flight, never state this page keeps",
);

/* ── 3. "Send test" does not claim success ─────────────────────────────── */

console.log("\nA queued test is not a delivered one");

const testMutation = page.slice(
  page.indexOf("const test = useMutation"),
  page.indexOf("const setEnabled"),
);
check("the test mutation exists", testMutation.includes("testNotificationChannel"));
check(
  "the test mutation does NOT raise toast.success",
  !/toast\.success/.test(testMutation),
  "202 means accepted for delivery; success would be the original bug again",
);
check(
  "the test mutation refetches so the real outcome can arrive",
  /onChanged\(\)/.test(testMutation),
);
check(
  "the service documents that resolving is not proof",
  /NOT when the \* message lands|NOT when the message lands/.test(
    flat(read("src/services/monitoring.service.ts")),
  ),
);

/* ── 4. A test delivery is not shown as a real one ─────────────────────── */

console.log("\nA test row and an alert row are told apart");

check(
  "the delivery badge reads lastDelivery.kind",
  /kind === "test"/.test(page),
  "otherwise a channel that only ever passed a test reads as proven in production",
);
check(
  "the drawer says plainly what a test row does and does not prove",
  /it does not mean a real alert has ever been delivered here/.test(flat(page)),
);
check("a channel with no delivery at all is labelled, not left blank", /Never used/.test(page));

/* ── 5. The Master call does not narrow itself to one tenant ───────────── */

console.log("\nThe platform read stays platform-wide");

check(
  "the page's list call passes no organizationId",
  /listNotificationChannels\(\{\s*page,\s*pageSize: PAGE_SIZE\s*\}\)/.test(page),
  "attaching an org id silently narrows the master console to one tenant",
);
check(
  "no organization id appears in a React Query key",
  !/organizationId/.test(
    page.slice(page.indexOf("const keys ="), page.indexOf("const CHANNEL_TYPES")),
  ),
  "the org scope is a header and has no business in a cache key",
);
check(
  "creating a channel sends an explicit null for platform-wide",
  /organizationId: form\.platformWide \? null :/.test(page),
  "omitting the key is refused by the API rather than guessed at",
);
check(
  "the service still scopes per-channel writes to the channel's own org",
  /organizationId \? \{ "X-Organization-Id": organizationId \} : undefined/.test(monitoringService),
  "a platform operator is not a member of the tenant whose channel they edit",
);

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
