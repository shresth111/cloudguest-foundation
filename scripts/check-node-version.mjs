#!/usr/bin/env node
/**
 * Refuses to start the dev server on a Node major this app is not built for.
 *
 * ## Why this exists
 *
 * On Node 26, `vite dev` starts, prints its banner, binds a port -- and then
 * every route returns `Cannot GET /...`. The SSR handler never mounts. There
 * is no error, no warning, and no stack: a server that looks healthy and
 * serves nothing.
 *
 * That cost real time on 2026-09-06. Four separate engineers hit it in one
 * day, each concluded independently that "npm run dev is broken", and each
 * fell back to a full `NITRO_PRESET=node-server` build plus
 * `.output/server/index.mjs` -- roughly a two-minute round trip for every
 * CSS change. One of them went looking for the cause in the app's own portal
 * routes, which is exactly the wrong place.
 *
 * The app is built and shipped on Node 22 (`Dockerfile`: `FROM
 * node:22-alpine`, both stages). The mismatch is the whole story, and the
 * point of this check is that it says so in one line instead of leaving a
 * 404 to be interpreted.
 *
 * ## Why a hard failure rather than a warning
 *
 * Because the alternative is what we had. A warning scrolls past the Vite
 * banner and the server still comes up broken, which is indistinguishable
 * from the app being broken. Refusing to start is the more honest outcome:
 * nothing was going to work anyway, and now the reason is on screen.
 *
 * `SKIP_NODE_VERSION_CHECK=1` exists for anyone deliberately testing a newer
 * Node -- e.g. checking whether an upstream fix has landed. It is not a
 * workaround for day-to-day use; if it starts being one, the pins below are
 * what should change.
 *
 * ## What this does NOT claim
 *
 * It does not say Node 26 is unsupportable. The failure is upstream --
 * `nitro` is on a `3.0.x-beta` and `vite` on 8.x -- and when those support
 * Node 26 the fix is to raise the pins here, in `.nvmrc`, `.node-version`
 * and the `Dockerfile` together, not to delete this file.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

if (process.env.SKIP_NODE_VERSION_CHECK === "1") {
  console.warn(
    "[node-version] SKIP_NODE_VERSION_CHECK=1 -- starting anyway. If the dev " +
      "server 404s every route, this is why.",
  );
  process.exit(0);
}

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// `.nvmrc` is the single source of truth so a version manager and this check
// can never disagree. Duplicating the number here is how they would.
const expectedMajor = Number.parseInt(
  readFileSync(join(root, ".nvmrc"), "utf8").trim().replace(/^v/, ""),
  10,
);
const actualMajor = Number.parseInt(process.versions.node.split(".")[0], 10);

if (actualMajor === expectedMajor) process.exit(0);

const older = actualMajor < expectedMajor;
console.error(
  [
    "",
    `  This app is built for Node ${expectedMajor}. You are on Node ${process.versions.node}.`,
    "",
    older
      ? "  Your Node is older than the app expects."
      : [
          "  On a newer Node the dev server starts, binds a port, and then",
          "  returns `Cannot GET /` for every route -- the SSR handler never",
          "  mounts, with no error printed. It looks like the app is broken.",
          "  It is not; the Node major is wrong.",
        ].join("\n"),
    "",
    "  Fix it once, either way:",
    "",
    "    brew install node@22   # then put it on PATH, or:",
    "    nvm use                # .nvmrc says 22",
    "    fnm use                # .node-version says 22",
    "",
    `  Node ${expectedMajor} is what the Dockerfile builds and ships, so this is`,
    "  also what production runs.",
    "",
    "  Deliberately testing a newer Node? SKIP_NODE_VERSION_CHECK=1 npm run dev",
    "",
  ].join("\n"),
);
process.exit(1);
