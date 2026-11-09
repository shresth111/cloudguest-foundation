/**
 * The opaque username from `/guest/session/active` opens the hotspot, and must
 * never be treated as the guest's phone or email.
 *
 * Run: node --experimental-strip-types scripts/test-portal-resume-username.mjs
 */
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isResumeUsername, realGuestIdentifier } from "../src/lib/portal-resume-username.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFileSync(join(ROOT, file), "utf8");
const ALIAS = `wr1-${"a".repeat(32)}-${"b".repeat(16)}`;

let checks = 0;
const failures = [];
function check(name, ok) {
  checks += 1;
  console.log(`  ${ok ? "ok  " : "FAIL"} ${name}`);
  if (!ok) failures.push(name);
}

check("an alias is recognised", isResumeUsername(ALIAS));
check("a phone is not an alias", !isResumeUsername("+919811122233"));
check("an email is not an alias", !isResumeUsername("a@example.com"));
check("a near-alias is not an alias", !isResumeUsername("wr1-abc-def"));
check("an alias has no real identifier", realGuestIdentifier(ALIAS) === undefined);
check(
  "a phone stays the real identifier",
  realGuestIdentifier("+919811122233") === "+919811122233",
);

for (const file of ["portal.index.tsx", "portal.review.tsx", "portal.session.tsx"]) {
  check(
    `${file} posts the alias when offered`,
    read(`src/routes/${file}`).includes(
      "setGuestIdentifier(liveSession.hotspotUsername ?? liveSession.identifier)",
    ),
  );
}
check(
  "the sign-in form never pre-fills an alias",
  read("src/components/portal-runtime/useGuestSignIn.ts").includes(
    "realGuestIdentifier(guestIdentifier)",
  ),
);
check(
  "a team is never joined as an alias",
  read("src/routes/portal.team.tsx").includes("realGuestIdentifier(heldIdentifier)"),
);

if (failures.length > 0) {
  console.error(`FAIL: ${failures.length} of ${checks}`);
  process.exit(1);
}
console.log(`portal resume username: all checks passed (${checks})`);
