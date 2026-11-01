#!/usr/bin/env node
/**
 * Guard for hard-coded English on the customer (venue-owner) console.
 *
 * WHY
 * ---
 * The dashboard ships English and Hindi (src/lib/i18n). `t()` falls back to
 * English silently, and a JSX text node never goes through `t()` at all, so a
 * Hindi-speaking cafe owner sees a screen that switches language mid-card and
 * nothing in tsc, eslint or the build notices. The PM found every Internet
 * Connection add/edit dialog English-only that way. This script is the gate:
 * it lists every user-visible English literal in the customer trees, and
 * fails CI when one appears that is not on the allow-list.
 *
 * WHAT COUNTS AS A LITERAL (heuristic -- parsed with the TypeScript compiler,
 * so comments and class names are never confused for copy)
 *   - JSX text:                 <p>Router offline</p>
 *   - string children:          {online ? "Online" : "Offline"}
 *   - copy attributes:          placeholder= title= aria-label= alt= label=
 *                               description= tooltip= ... (COPY_ATTRS)
 *   - chart series names:       <Line name="Download" />
 *   - copy-shaped properties:   { label: "Daily" }, { title: "..." } (COPY_PROPS)
 *   - toast messages:           toast.error("Could not save"), and its
 *                               `description:` option
 * Anything inside `t(...)`/`i18n.t(...)` is i18n already and is skipped, as is
 * a line carrying `// i18n-ignore` (or the line after one), and anything between
 * `// i18n-ignore-start` and `// i18n-ignore-end` (English fallbacks that are
 * rendered through t() somewhere else -- say why in the comment).
 *
 * WHAT IS NOT COPY: a string made only of tokens a venue owner reads as-is in
 * both languages -- MAC, IP, WiFi, ISP, units, brand names, numbers and
 * punctuation (TOKENS below). Identifier-shaped lowercase strings
 * ("online", "dhcp-server") in property positions are values, not copy.
 *
 * THE ALLOW-LIST (scripts/i18n-literals-allowlist.json) is
 *   { "<file>": { "<literal>": <count> } }
 * and only ever shrinks:
 *   - a literal not on its file's list (or more copies than listed) fails;
 *   - a listed literal that is gone fails as "stale" until it comes off --
 *     run `node scripts/check-i18n-literals.mjs --write` after translating
 *     to regenerate the list, and review the diff: it must only shrink.
 * The first pass (2026-10-31) cleared Dashboard, Devices, Internet
 * Connection, Network › Advanced, Alerts, the Guests family and the shell;
 * what remains on the list belongs to the batches restyling the other
 * screens, which shrink it as they go.
 *
 * Usage: node scripts/check-i18n-literals.mjs [--write] [--list [file-substring]]
 */
import { readFileSync, readdirSync, statSync, existsSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ALLOW_FILE = join(ROOT, "scripts/i18n-literals-allowlist.json");
const args = process.argv.slice(2);
const WRITE = args.includes("--write");
const LIST = args.includes("--list");
const LIST_FILTER = LIST ? args[args.indexOf("--list") + 1] : undefined;

/** Same customer-rendered trees as check-console-styles.mjs. */
const SCAN_DIRS = [
  "src/components/customer",
  "src/components/network",
  "src/components/features",
  "src/components/security",
  "src/components/traffic-lens",
  "src/components/marketing",
  "src/components/netlogs",
];
const SCAN_FILES = ["src/routes/users.tsx"];
/** Fixture/model files: data, not rendered copy (demo names, model enums). */
const SKIP = [/\/demo\//, /\.demo\.tsx?$/, /demo-fixtures\.ts$/, /\.types\.ts$/, /\/index\.ts$/];

/** Screens this pass cleared. They must stay off the allow-list. */
const CLEARED = [
  "src/components/customer/CustomerSidebar.tsx",
  "src/components/customer/CustomerHeader.tsx",
  "src/components/customer/ConsoleHealth.tsx",
  "src/components/customer/CustomerCommandPalette.tsx",
  "src/components/customer/dashboard/NeedsAttentionCard.tsx",
  "src/components/customer/dashboard/WanStatusCard.tsx",
  "src/components/customer/dashboard/DeviceStatusCard.tsx",
  "src/components/customer/dashboard/BandwidthUtilizationCard.tsx",
  "src/components/customer/isp/IspDialogs.tsx",
  "src/components/features/AlertsView.tsx",
  "src/components/customer/CustomerDashboardPage.tsx",
  "src/components/customer/DeviceHealthTrafficView.tsx",
  "src/components/customer/HardwareHealthDetails.tsx",
  "src/components/customer/FixAProblem.tsx",
  "src/components/features/VouchersPage.tsx",
  "src/components/features/ManageTeamsPage.tsx",
  "src/components/features/UserReports.tsx",
  "src/components/network/network-ui.tsx",
  "src/components/customer/dashboard/overview/ActivityChart.tsx",
  "src/components/customer/dashboard/overview/RecentGuestsTable.tsx",
  "src/components/customer/dashboard/overview/TopologyMap.tsx",
  "src/components/customer/dashboard/overview/console-ui.tsx",
  "src/components/customer/devices/ConnectedDevicesPanel.tsx",
  "src/components/customer/devices/FleetSummaryStrip.tsx",
  "src/components/customer/devices/HardwareDrawer.tsx",
  "src/components/customer/devices/HardwareInventory.tsx",
  "src/components/customer/devices/ui.tsx",
  "src/components/customer/isp/IspDetailsView.tsx",
  "src/components/customer/isp/IspHistoryPanel.tsx",
  "src/components/customer/isp/IspLinkCard.tsx",
  "src/components/customer/isp/IspPathDiagram.tsx",
  "src/components/customer/isp/isp-ui.tsx",
  "src/components/network/DhcpManagement.tsx",
  "src/components/network/VlanManagement.tsx",
  "src/components/network/PortForwardingManagement.tsx",
  "src/components/network/QosManagement.tsx",
  "src/components/customer/console/SectionTabs.tsx",
];

const COPY_ATTRS = new Set([
  "ariaLabel",
  "loadingLabel",
  "empty",
  "emptyLabel",
  "errorPrefix",
  "header",
  "searchPlaceholder",
  "okLabel",
  "submitLabel",
  "badge",
  "placeholder",
  "title",
  "aria-label",
  "aria-description",
  "alt",
  "label",
  "description",
  "subtitle",
  "hint",
  "helper",
  "helperText",
  "tooltip",
  "heading",
  "caption",
  "emptyText",
  "emptyTitle",
  "emptyDescription",
  "emptyMessage",
  "confirmLabel",
  "cancelLabel",
  "previousLabel",
  "nextLabel",
  "actionLabel",
  "eyebrow",
  "lede",
  "message",
  "summary",
  "detail",
]);
const COPY_PROPS = new Set([
  "header",
  "ariaLabel",
  "loadingLabel",
  "empty",
  "emptyLabel",
  "errorPrefix",
  "tooltip",
  "hint",
  "label",
  "title",
  "description",
  "placeholder",
  "hint",
  "helper",
  "tooltip",
  "heading",
  "subtitle",
  "caption",
  "emptyText",
  "summary",
  "detail",
  "eyebrow",
  "lede",
  "body",
  "cta",
  "actionLabel",
  "text",
  "message",
]);
const CHART_TAGS = /^(Line|Bar|Area|Pie|Scatter|Radar|RadialBar)$/;

/** Words a venue owner reads as-is in English *and* Hindi (see
 * docs/design/i18n-style.md). Stripped before deciding if anything is left. */
const TOKENS = [
  "Wi-?Fi",
  "Wyfy(?: Guest)?",
  "MikroTik",
  "RouterOS",
  "Omada",
  "TP-Link",
  "Aruba(?: Instant On)?",
  "Ubiquiti",
  "UniFi",
  "Airtel",
  "Jio",
  "BSNL",
  "ACT",
  "Excitel",
  "Hathway",
  "WhatsApp",
  "Google",
  "Gmail",
  "Slack",
  "MAC",
  "IPv[46]",
  "IP",
  "ISP",
  "OTP",
  "SSID",
  "DHCP",
  "DNS",
  "VLAN",
  "NAT",
  "QoS",
  "WAN\\d?",
  "LAN",
  "PPPoE",
  "SNMP",
  "RADIUS",
  "NAS",
  "AP",
  "APs",
  "CSV",
  "PDF",
  "URL",
  "API",
  "SMS",
  "ID",
  "UTC",
  "IST",
  "GST",
  "TCP",
  "UDP",
  "ICMP",
  "HTTPS?",
  "ether\\d+",
  "sfp\\d*",
  "[KMGT]?bps",
  "[KMGT]?B",
  "ms",
  "dBm",
  "Hz",
  "GHz",
  "UPI",
  "Wyfy",
  "N/A",
  "vs",
  "e\\.g\\.",
  "esc",
  "Ctrl",
];
const TOKEN_RE = new RegExp(`(?<![A-Za-z])(?:${TOKENS.join("|")})(?![A-Za-z])`, "g");

/** True when the text, minus tokens, still has an English word in it. */
export function isCopy(text) {
  // MAC / hex / numeric placeholders ("AA:BB:CC:DD:EE:FF", "10.0.0.1/24").
  if (/^[0-9A-Fa-f:.\-/\s]+$/.test(text) && !/[G-Zg-z]/.test(text)) return false;
  const rest = text.replace(TOKEN_RE, " ");
  return /[A-Za-z]{2,}/.test(rest);
}
/** "online", "dhcp-server", "rx_bytes", "/routers/$id": values, not copy. */
const looksLikeValue = (s) =>
  /^[a-z0-9_.:\-/$#@?=&[\]]*$/.test(s) ||
  // an i18n key used as a message ("common.selectRouter"), translated where rendered
  /^[a-z][A-Za-z0-9]*(\.[A-Za-z0-9_]+)+$/.test(s) ||
  /^[A-Z0-9_]+$/.test(s) ||
  // Tailwind class lists: every token lowercase utility-shaped, one with a dash.
  (/-/.test(s) && s.split(/\s+/).every((w) => /^[a-z0-9:\-/[\].%_()!#&>*,=]+$/.test(w)));

const norm = (s) => s.replace(/\s+/g, " ").trim();

function isInsideTranslateCall(node) {
  for (let p = node.parent; p; p = p.parent) {
    if (ts.isCallExpression(p)) {
      const callee = p.expression;
      const name = ts.isIdentifier(callee)
        ? callee.text
        : ts.isPropertyAccessExpression(callee)
          ? callee.name.text
          : "";
      if (name === "t" || name === "tr" || name === "Trans") return true;
      // A literal that is an argument (not an option value) of any other call
      // is a value passed to code -- cn(), Number(), navigate() -- unless the
      // call is a toast, which is handled explicitly.
    }
    if (ts.isJsxElement(p) || ts.isJsxSelfClosingElement(p)) {
      const tag = (ts.isJsxElement(p) ? p.openingElement.tagName : p.tagName).getText();
      if (tag === "Trans") return true;
    }
  }
  return false;
}

function templateText(node) {
  if (ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  return [node.head.text, ...node.templateSpans.map((s) => `{x}${s.literal.text}`)].join("");
}

/** String-ish values reachable without passing through a call: ternaries,
 * `a || "b"`, parenthesised, template literals. */
function stringLeaves(expr, out = []) {
  if (!expr) return out;
  if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) out.push(expr);
  else if (ts.isTemplateExpression(expr)) out.push(expr);
  else if (ts.isParenthesizedExpression(expr)) stringLeaves(expr.expression, out);
  else if (ts.isConditionalExpression(expr)) {
    stringLeaves(expr.whenTrue, out);
    stringLeaves(expr.whenFalse, out);
  } else if (
    ts.isBinaryExpression(expr) &&
    [
      ts.SyntaxKind.BarBarToken,
      ts.SyntaxKind.QuestionQuestionToken,
      ts.SyntaxKind.AmpersandAmpersandToken,
    ].includes(expr.operatorToken.kind)
  ) {
    stringLeaves(expr.left, out);
    stringLeaves(expr.right, out);
  }
  return out;
}

const textOf = (n) => (ts.isTemplateExpression(n) ? templateText(n) : n.text);

export function literals(src, fileName = "x.tsx") {
  const kind = /\.tsx$|\.jsx$/.test(fileName) ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sf = ts.createSourceFile(fileName, src, ts.ScriptTarget.Latest, true, kind);
  const lines = src.split("\n");
  // `// i18n-ignore-start` ... `// i18n-ignore-end`: English fallbacks that
  // are rendered through t() elsewhere (e.g. an options array's labels).
  const regions = [];
  lines.forEach((l, i) => {
    if (/i18n-ignore-start/.test(l)) regions.push([i, lines.length]);
    if (/i18n-ignore-end/.test(l) && regions.length) regions[regions.length - 1][1] = i;
  });
  const ignored = (pos) => {
    const line = sf.getLineAndCharacterOfPosition(pos).line;
    if (regions.some(([a, b]) => line > a && line < b)) return true;
    return (
      /i18n-ignore(?!-)/.test(lines[line] ?? "") || /i18n-ignore(?!-)/.test(lines[line - 1] ?? "")
    );
  };
  const out = [];
  const add = (node, text, kind, strict = false) => {
    const t = norm(text);
    if (!t || !isCopy(t)) return;
    if (strict && looksLikeValue(t)) return;
    if (ignored(node.getStart(sf)) || isInsideTranslateCall(node)) return;
    out.push({ text: t, kind, line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1 });
  };

  const visit = (node) => {
    if (
      (ts.isJsxElement(node) && node.openingElement.tagName.getText(sf) === "style") ||
      ts.isImportDeclaration(node)
    )
      return;
    if (ts.isJsxText(node)) add(node, node.text, "jsx-text");
    else if (ts.isReturnStatement(node) && node.expression) {
      for (const s of stringLeaves(node.expression))
        if (/\s/.test(textOf(s))) add(s, textOf(s), "return", true);
    } else if (ts.isJsxExpression(node) && node.expression && ts.isJsxElement(node.parent)) {
      for (const s of stringLeaves(node.expression)) add(s, textOf(s), "jsx-string", true);
    } else if (ts.isJsxExpression(node) && node.expression && ts.isJsxFragment(node.parent)) {
      for (const s of stringLeaves(node.expression)) add(s, textOf(s), "jsx-string", true);
    } else if (ts.isJsxAttribute(node) && node.initializer) {
      const name = node.name.getText(sf);
      const tagNode = node.parent.parent;
      const tag = tagNode.tagName?.getText(sf) ?? "";
      const isCopyAttr = COPY_ATTRS.has(name) || (name === "name" && CHART_TAGS.test(tag));
      if (isCopyAttr) {
        const init = node.initializer;
        const leaves = ts.isStringLiteral(init) ? [init] : stringLeaves(init.expression);
        for (const s of leaves) add(s, textOf(s), `attr:${name}`, true);
      }
    } else if (
      ts.isPropertyAssignment(node) &&
      ts.isObjectLiteralExpression(node.parent) &&
      ts.isVariableDeclaration(node.parent.parent) &&
      /(LABEL|TEXT|COPY|WORD|TITLE|MESSAGE)S?$/i.test(node.parent.parent.name.getText(sf))
    ) {
      // Label maps: const PUSH_LABEL = { active: "Applied", ... }
      for (const s of stringLeaves(node.initializer)) add(s, textOf(s), "label-map", true);
    } else if (
      ts.isPropertyAssignment(node) &&
      COPY_PROPS.has(node.name.getText(sf).replace(/["']/g, ""))
    ) {
      for (const s of stringLeaves(node.initializer))
        add(s, textOf(s), `prop:${node.name.getText(sf)}`, true);
    } else if (ts.isCallExpression(node)) {
      const callee = node.expression.getText(sf);
      // zod: z.string().min(1, "Select a router"), .max(…, "…"), .regex(…, "…")
      if (
        ts.isPropertyAccessExpression(node.expression) &&
        /^(min|max|length|regex|email|url|nonempty)$/.test(node.expression.name.text)
      ) {
        const last = node.arguments[node.arguments.length - 1];
        if (last) for (const s of stringLeaves(last)) add(s, textOf(s), "validation", true);
      }
      if (
        /(^|\.)humanizeApiError$|(^|\.)friendlyError$|(^|\.)requestErrorMessage$/.test(callee) &&
        node.arguments[1]
      ) {
        for (const s of stringLeaves(node.arguments[1])) add(s, textOf(s), "error-fallback", true);
      }
      if (/^toast(\.\w+)?$/.test(callee) && node.arguments.length) {
        for (const s of stringLeaves(node.arguments[0])) add(s, textOf(s), "toast", true);
        const opts = node.arguments[1];
        if (opts && ts.isObjectLiteralExpression(opts)) {
          for (const p of opts.properties) {
            if (ts.isPropertyAssignment(p) && p.name.getText(sf) === "description")
              for (const s of stringLeaves(p.initializer)) add(s, textOf(s), "toast", true);
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}

function walk(dir, acc) {
  if (!existsSync(dir)) return acc;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, acc);
    else if (/\.(tsx?|jsx?)$/.test(name) && !/\.(test|spec)\./.test(name)) acc.push(p);
  }
  return acc;
}

// ---------------------------------------------------------------------------
const failures = [];
const check = (name, ok, detail = "") => {
  if (ok) console.log(`  ok   ${name}`);
  else {
    failures.push(name);
    console.log(`  FAIL ${name}${detail ? `\n${detail}` : ""}`);
  }
};

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  console.log("\nthe detector is not vacuous");
  const fixture = `
    export function X({ on }) {
      toast.error("Could not save the plan");
      const opts = [{ value: "daily", label: "Every day" }];
      return (<div>
        <p>Router offline</p>
        <input placeholder="Search guests" aria-label={on ? "Close menu" : "Open menu"} />
        <Line dataKey="rx" name="Download" />
        {on ? "Online now" : "Offline"}
      </div>);
    }`;
  const found = literals(fixture).map((l) => l.text);
  for (const want of [
    "Could not save the plan",
    "Every day",
    "Router offline",
    "Search guests",
    "Close menu",
    "Open menu",
    "Download",
    "Online now",
    "Offline",
  ])
    check(
      `catches ${JSON.stringify(want)}`,
      found.includes(want),
      `     found: ${JSON.stringify(found)}`,
    );
  const clean = literals(`
    export function Y({ t, on }) {
      // Plain English in a comment
      toast.error(t("saveFailed"));
      return (<div className="flex items-center gap-2" data-state={on ? "open" : "closed"}>
        {/* Router offline */}
        <span>MAC · IP · 12 Mbps · WiFi</span>
        <span title={t("x", { defaultValue: "Some default" })}>{t("y")}</span>
        <span>{"—"}</span>
        <span>Hidden copy</span>{/* i18n-ignore */}
      </div>);
    }`).filter((l) => l.text !== "Hidden copy");
  check(
    "comments, class names, t() calls and token-only strings are not flagged",
    clean.length === 0,
    `     ${JSON.stringify(clean)}`,
  );

  console.log("\nthe customer console trees");
  const files = [
    ...SCAN_DIRS.flatMap((d) => walk(join(ROOT, d), [])),
    ...SCAN_FILES.map((f) => join(ROOT, f)).filter(existsSync),
  ]
    .map((p) => relative(ROOT, p))
    .filter((f) => !SKIP.some((re) => re.test(f)))
    .sort();
  check(`scanned ${files.length} files`, files.length > 100, "     the scan roots moved?");

  const found2 = new Map();
  for (const f of files) {
    const ls = literals(readFileSync(join(ROOT, f), "utf8"), f);
    if (ls.length) found2.set(f, ls);
  }

  if (LIST) {
    for (const [f, ls] of found2) {
      if (LIST_FILTER && !f.includes(LIST_FILTER)) continue;
      for (const l of ls) console.log(`${f}:${l.line}\t${l.kind}\t${l.text}`);
    }
    process.exit(0);
  }

  if (WRITE) {
    const out = {};
    for (const [f, ls] of found2) {
      out[f] = {};
      for (const l of ls) out[f][l.text] = (out[f][l.text] ?? 0) + 1;
    }
    writeFileSync(ALLOW_FILE, JSON.stringify(out, null, 2) + "\n");
    const total = [...found2.values()].reduce((a, ls) => a + ls.length, 0);
    console.log(`  wrote ${ALLOW_FILE}: ${total} literals in ${found2.size} files`);
  }

  const allow = existsSync(ALLOW_FILE) ? JSON.parse(readFileSync(ALLOW_FILE, "utf8")) : {};
  const fresh = [];
  for (const [f, ls] of found2) {
    const counts = {};
    for (const l of ls) {
      counts[l.text] = (counts[l.text] ?? 0) + 1;
      if (counts[l.text] > (allow[f]?.[l.text] ?? 0))
        fresh.push(`     ${f}:${l.line}  ${l.kind}  ${JSON.stringify(l.text)}`);
    }
  }
  check(
    "no user-visible English literal outside the allow-list",
    fresh.length === 0,
    fresh.slice(0, 40).join("\n") +
      (fresh.length > 40 ? `\n     ...and ${fresh.length - 40} more` : "") +
      "\n     Move it into src/lib/i18n/locales/{en,hi}/<ns>.json and render it with t().",
  );

  const stale = [];
  for (const [f, lits] of Object.entries(allow)) {
    const have = {};
    for (const l of found2.get(f) ?? []) have[l.text] = (have[l.text] ?? 0) + 1;
    for (const [text, n] of Object.entries(lits))
      if ((have[text] ?? 0) < n) stale.push(`     ${f}  ${JSON.stringify(text)}`);
  }
  check(
    "no allow-list entry is stale (a translated literal comes off the list)",
    stale.length === 0,
    stale.slice(0, 40).join("\n") + "\n     Run: node scripts/check-i18n-literals.mjs --write",
  );

  for (const f of CLEARED) {
    check(
      `${f} has no hard-coded English`,
      !found2.has(f) && !allow[f],
      (found2.get(f) ?? []).map((l) => `     :${l.line}  ${l.text}`).join("\n"),
    );
  }

  const total = Object.values(allow).reduce(
    (a, m) => a + Object.values(m).reduce((x, y) => x + y, 0),
    0,
  );
  console.log(
    `\n  allow-list: ${total} literals in ${Object.keys(allow).length} files left to translate`,
  );

  // -------------------------------------------------------------------------
  console.log("\nEN/HI dictionaries agree (every namespace)");
  const LOC = join(ROOT, "src/lib/i18n/locales");
  const flatten = (obj, prefix = "") =>
    Object.entries(obj).flatMap(([k, v]) =>
      v && typeof v === "object" && !Array.isArray(v)
        ? flatten(v, `${prefix}${k}.`)
        : [[`${prefix}${k}`, v]],
    );
  const enNs = readdirSync(join(LOC, "en"))
    .filter((f) => f.endsWith(".json"))
    .sort();
  const hiNs = readdirSync(join(LOC, "hi"))
    .filter((f) => f.endsWith(".json"))
    .sort();
  check(
    "en and hi ship the same namespace files",
    JSON.stringify(enNs) === JSON.stringify(hiNs),
    `     en=${enNs} hi=${hiNs}`,
  );
  const vars = (s) =>
    [...String(s).matchAll(/\{\{\s*([\w.]+)[^}]*\}\}/g)]
      .map((m) => m[1])
      .sort()
      .join(",");
  const tags = (s) =>
    [...String(s).matchAll(/<\/?(\w+)\s*\/?>/g)]
      .map((m) => m[0])
      .sort()
      .join(",");
  for (const file of enNs) {
    const ns = file.replace(/\.json$/, "");
    const en = new Map(flatten(JSON.parse(readFileSync(join(LOC, "en", file), "utf8"))));
    const hi = new Map(flatten(JSON.parse(readFileSync(join(LOC, "hi", file), "utf8"))));
    // i18next resolves `_one`/`_other` per language; Hindi uses the same two
    // CLDR categories as English, so the plural key sets must match exactly.
    const missing = [...en.keys()].filter((k) => !hi.has(k));
    const extra = [...hi.keys()].filter((k) => !en.has(k));
    check(
      `${ns}: every en key has a hi key`,
      missing.length === 0,
      `     missing: ${missing.join(", ")}`,
    );
    check(`${ns}: no hi-only key`, extra.length === 0, `     extra: ${extra.join(", ")}`);
    const badVars = [...en.keys()].filter((k) => hi.has(k) && vars(en.get(k)) !== vars(hi.get(k)));
    check(
      `${ns}: {{variables}} match in every string`,
      badVars.length === 0,
      badVars.map((k) => `     ${k}: en {${vars(en.get(k))}} hi {${vars(hi.get(k))}}`).join("\n"),
    );
    const badTags = [...en.keys()].filter((k) => hi.has(k) && tags(en.get(k)) !== tags(hi.get(k)));
    check(
      `${ns}: <tags> match in every string`,
      badTags.length === 0,
      badTags.map((k) => `     ${k}`).join("\n"),
    );
    const empty = [...hi.entries()]
      .filter(([, v]) => typeof v === "string" && !v.trim())
      .map(([k]) => k);
    check(`${ns}: no empty hi string`, empty.length === 0, `     ${empty.join(", ")}`);
    const singleOnly = [...en.keys()].filter(
      (k) => k.endsWith("_one") && !en.has(k.replace(/_one$/, "_other")),
    );
    check(
      `${ns}: every _one has an _other`,
      singleOnly.length === 0,
      `     ${singleOnly.join(", ")}`,
    );
  }

  console.log("");
  if (failures.length) {
    console.log(`i18n-literals: ${failures.length} check(s) FAILED`);
    process.exit(1);
  }
  console.log("i18n-literals: all checks passed");
}
