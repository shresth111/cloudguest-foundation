/**
 * Whitelisting: CSV upload, the rename, and the dashboard notice.
 *
 * 1. lib/whitelist-csv.ts, run for real: header detection, E.164 through
 *    the shared normaliser, emails, dates, the 5,000-row cap, dedupe within
 *    the file and against the live list, per-row reasons, batching.
 * 2. lib/whitelist-status.ts: the notice lights exactly when the backend
 *    would enforce -- the venue's own ACTIVE config with the flag on.
 * 3. Wiring: the upload posts to the bulk endpoint with the tenant in the
 *    header, the screen offers it, the nav and heading carry the new name,
 *    and the dashboard renders the notice from real state.
 *
 * All values are obviously fake.
 *
 * Run: node scripts/test-whitelist-csv.mjs
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

async function load(rel) {
  const outdir = mkdtempSync(join(tmpdir(), "whitelist-csv-"));
  const entry = join(outdir, "entry.mjs");
  writeFileSync(entry, `export * from "${join(ROOT, rel).replace(/\\/g, "/")}";`);
  const outfile = join(outdir, "bundle.mjs");
  await build({
    entryPoints: [entry],
    bundle: true,
    format: "esm",
    platform: "node",
    outfile,
    logLevel: "silent",
    plugins: [
      {
        name: "alias",
        setup(b) {
          b.onResolve({ filter: /^@\// }, (args) => {
            const base = join(ROOT, "src", args.path.slice(2));
            for (const ext of [".ts", ".tsx", "/index.ts"]) {
              try {
                readFileSync(base + ext);
                return { path: base + ext };
              } catch {
                /* next */
              }
            }
            return { path: base };
          });
        },
      },
    ],
  });
  return import(`file://${outfile}`);
}

const csv = await load("src/lib/whitelist-csv.ts");
const status = await load("src/lib/whitelist-status.ts");
const NOW = Date.parse("2026-09-15T06:00:00Z");

console.log("\nthe template parses as a clean upload");
{
  const p = csv.previewWhitelistCsv(csv.WHITELIST_CSV_TEMPLATE, { nowMs: NOW });
  check("no file error", !p.fileError, p.fileError);
  check("all three template rows are ready", p.counts.ready === 3, JSON.stringify(p.counts));
  check("an E.164 phone is kept", p.ready[0].identifier === "+911234500000");
  check("its email rides as the contact note", p.ready[0].email === "guest@example.com");
  check("name maps to the rule's name", p.ready[0].name === "Room 101");
  check("valid_until becomes a UTC instant", /Z$/.test(p.ready[0].expiresAt ?? ""));
  check("a local number gets the picked code", p.ready[1].identifier === "+911234500001");
  check("an email-only row signs in by email", p.ready[2].identifier === "guest2@example.com");
}

console.log("\nphones go through the same normaliser as the single add");
{
  const text =
    "mobile,name\n+44 7700 900000,UK\n01234500002,trunk zero\n911234500003,cc no plus\n123,short\nabc,letters\n9.11234E+11,excel\n";
  const p = csv.previewWhitelistCsv(text, { nowMs: NOW });
  const by = Object.fromEntries(p.rows.map((r) => [r.raw, r]));
  check(
    "an explicit + keeps its own country",
    by["+44 7700 900000"].identifier === "+447700900000",
  );
  check("a trunk 0 is dropped", by["01234500002"].identifier === "+911234500002");
  check("a code without + is recognised", by["911234500003"].identifier === "+911234500003");
  check("too short is invalid with a reason", by["123"].status === "invalid" && !!by["123"].reason);
  check("letters are invalid", by["abc"].status === "invalid");
  check(
    "scientific notation is called out",
    by["9.11234E+11"].status === "invalid" && /scientific/.test(by["9.11234E+11"].reason),
  );
  const us = csv.previewWhitelistCsv("phone\n2025550100\n", { dialCode: "+1", nowMs: NOW });
  check("the picked dialling code is used", us.ready[0]?.identifier === "+12025550100");
}

console.log("\ndedupe and skip");
{
  const text =
    "phone,email\n+911234500010,\n+91 12345 00010,\n,dup@example.com\n,DUP@example.com\n+911234500011,\n";
  const p = csv.previewWhitelistCsv(text, { nowMs: NOW, existing: ["+911234500011"] });
  check("a repeat in the file is skipped", p.counts.duplicates === 2, JSON.stringify(p.counts));
  check("an entry already on the list is skipped", p.counts.alreadyListed === 1);
  check("only the new ones are ready", p.counts.ready === 2);
}

console.log("\nrows that cannot be added say why");
{
  const text =
    "phone,email,valid_until\n+911234500020,not-an-email,\n+911234500021,,2001-01-01\n+911234500022,,31/12/2026\n,,\n+911234500023,,2099-12-31\n";
  const p = csv.previewWhitelistCsv(text, { nowMs: NOW });
  const reasons = p.rows.filter((r) => r.status === "invalid").map((r) => r.reason);
  check(
    "a bad contact email is invalid",
    reasons.some((r) => /valid email/.test(r)),
  );
  check(
    "a past date is invalid",
    reasons.some((r) => /past/.test(r)),
  );
  check(
    "an unreadable date is invalid",
    reasons.some((r) => /isn't a date/.test(r)),
  );
  check("a blank line is dropped, not reported", p.rows.length === 4, String(p.rows.length));
  check("a bare date means the end of that day", p.ready.length === 1);
  check("row numbers are 1-based data rows", p.rows[0].line === 1 && p.rows[3].line === 4);
}

console.log("\nfile-level problems");
check("empty file", !!csv.previewWhitelistCsv("", { nowMs: NOW }).fileError);
check(
  "an unrecognised header is refused, not guessed",
  !!csv.previewWhitelistCsv("foo,bar\n1,2\n", { nowMs: NOW }).fileError,
);
{
  const p = csv.previewWhitelistCsv("+911234500030\n+911234500031\n", { nowMs: NOW });
  check("a headerless one-column list is accepted", !p.fileError && p.counts.ready === 2);
}
{
  const rows = Array.from({ length: 5001 }, (_, i) => `+9112345${String(i).padStart(5, "0")}`);
  const p = csv.previewWhitelistCsv(`phone\n${rows.join("\n")}\n`, { nowMs: NOW });
  check(
    "more than 5,000 rows is refused outright",
    !!p.fileError && /5,000|5000/.test(p.fileError),
  );
  const ok = csv.previewWhitelistCsv(`phone\n${rows.slice(0, 5000).join("\n")}\n`, { nowMs: NOW });
  check("exactly 5,000 rows is accepted", !ok.fileError && ok.counts.ready === 5000);
  const batches = csv.chunkRows(ok.ready);
  check(
    "5,000 rows go up as five 1,000-row requests",
    batches.length === 5 && batches.every((b) => b.length === 1000),
  );
}
{
  const p = csv.previewWhitelistCsv('phone,name\r\n"+911234500040","Smith, J ""VIP"""\r\n', {
    nowMs: NOW,
  });
  check("quoted fields with commas and quotes parse", p.ready[0]?.name === 'Smith, J "VIP"');
  check(
    "a UTF-8 BOM does not break the header",
    !csv.previewWhitelistCsv("﻿phone\n+911234500041\n", { nowMs: NOW }).fileError,
  );
}

console.log("\nthe dashboard notice lights only when the backend enforces");
{
  const LOC = "loc-1";
  const on = { location_id: LOC, is_active: true, whitelist_only_enabled: true };
  check("the venue's active config with the flag on", status.isWhitelistOnlyOn([on], LOC));
  check(
    "off when the flag is off",
    !status.isWhitelistOnlyOn([{ ...on, whitelist_only_enabled: false }], LOC),
  );
  check(
    "off when that config is inactive (not what resolves)",
    !status.isWhitelistOnlyOn([{ ...on, is_active: false }], LOC),
  );
  check(
    "off for another venue's config",
    !status.isWhitelistOnlyOn([{ ...on, location_id: "loc-2" }], LOC),
  );
  check(
    "off for an org default (the flag is refused there)",
    !status.isWhitelistOnlyOn([{ ...on, location_id: null }], LOC),
  );
  check("off with no location", !status.isWhitelistOnlyOn([on], ""));
}

console.log("\nwiring");
const svc = readFileSync(join(ROOT, "src/services/guest.service.ts"), "utf8");
const importFn = svc.slice(
  svc.indexOf("async importWhitelistRules("),
  svc.indexOf("async deactivateAccessRule("),
);
check("posts to the bulk import endpoint", /"\/guest-access\/rules\/import"/.test(importFn));
check("as whitelist rules", /rule_type: "whitelist"/.test(importFn));
check("every row written to the chosen location", /location_id: input\.locationId/.test(importFn));
check(
  "tenant rides in X-Organization-Id",
  /"X-Organization-Id": input\.organizationId/.test(importFn),
);
check(
  "batches of 1,000 by default, split by the tested chunker",
  /input\.batchSize \?\? WHITELIST_IMPORT_BATCH_SIZE/.test(importFn) &&
    /chunkRows\(input\.rows, size\)/.test(importFn),
);

const cust = readFileSync(join(ROOT, "src/services/customer.service.ts"), "utf8");
const statusFn = cust.slice(
  cust.indexOf("async whitelistOnlyEnabled("),
  cust.indexOf("async getDashboardSeries("),
);
check(
  "the notice's request is header-scoped",
  /"X-Organization-Id": organizationId/.test(statusFn),
);
check("...and decided by the shared rule", /isWhitelistOnlyOn\(/.test(statusFn));

const wl = readFileSync(join(ROOT, "src/components/features/WhiteList.tsx"), "utf8");
check("the heading is the full name", /Only Allowed \/ Whitelisting/.test(wl));
check(
  "the screen offers Upload CSV",
  /data-testid="whitelist-csv-open"/.test(wl) && /<WhitelistCsvUpload/.test(wl),
);
check("the list is re-read after an upload", /onImported=\{\(\) => setReloadKey/.test(wl));
check("the whole list is read, not one page", /listWhitelistRules\(org\)/.test(wl));
check(
  "saving the switch refreshes the dashboard notice",
  /invalidateQueries\(\{ queryKey: customerKeys\.whitelistOnly\(wlLocationId\) \}\)/.test(wl),
);
check(
  "the copy no longer claims turning it on drops nobody",
  !/drops nobody/.test(wl) && /next time the router/.test(wl),
);

const up = readFileSync(join(ROOT, "src/components/features/WhitelistCsvUpload.tsx"), "utf8");
check(
  "a template can be downloaded",
  /downloadCsv\("whitelist-template\.csv", WHITELIST_CSV_TEMPLATE\)/.test(up),
);
check("the expected columns are shown", /WHITELIST_CSV_COLUMNS\.join/.test(up));
check("nothing is sent before confirming", /data-testid="whitelist-csv-confirm"/.test(up));
check(
  "the result shows added / already listed / invalid",
  /"Added"/.test(up) && /"Already on the list"/.test(up) && /"Invalid"/.test(up),
);

const dash = readFileSync(join(ROOT, "src/components/customer/CustomerDashboardPage.tsx"), "utf8");
check("the dashboard reads the real flag", /useWhitelistOnlyStatus\(locationId\)/.test(dash));
check("the notice renders only on a confirmed ON", /whitelistOnly\.data === true/.test(dash));
check(
  "with the promised wording",
  /Whitelisting is ON — only listed guests can connect/.test(dash),
);
check("and a link to the page", /handleNav\("whitelist"\)/.test(dash));

const nav = readFileSync(join(ROOT, "src/lib/customerNav.ts"), "utf8");
check("the nav label is Whitelisting", /id: "whitelist", label: "Whitelisting"/.test(nav));
const en = JSON.parse(readFileSync(join(ROOT, "src/lib/i18n/locales/en/nav.json"), "utf8"));
check("the en translation agrees", JSON.stringify(en).includes('"whitelist":"Whitelisting"'));

console.log(failures === 0 ? "\nall checks passed\n" : `\n${failures} check(s) FAILED\n`);
process.exit(failures === 0 ? 0 : 1);
