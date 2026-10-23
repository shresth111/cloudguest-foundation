/** Bundle the REAL api.ts + api-shim.ts with esbuild; requests stop at a fake adapter. */
import { build } from "esbuild";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export async function loadShim(root) {
  mkdirSync(join(root, "node_modules/.cache"), { recursive: true });
  const outdir = mkdtempSync(join(root, "node_modules/.cache/isp-shim-"));
  const p = (rel) => join(root, rel).replace(/\\/g, "/");
  const entry = join(outdir, "entry.mjs");
  writeFileSync(
    entry,
    `export { api } from "${p("src/services/api.ts")}";
     export * from "${p("src/lib/isp-partner/api-shim.ts")}";`,
  );
  const outfile = join(outdir, "bundle.mjs");
  await build({
    entryPoints: [entry],
    bundle: true,
    format: "esm",
    platform: "node",
    outfile,
    logLevel: "silent",
    external: ["axios"],
    nodePaths: [join(root, "node_modules")],
    define: { "import.meta.env": JSON.stringify({ VITE_API_BASE_URL: "/api/v1" }) },
    plugins: [
      {
        name: "at-alias",
        setup(b) {
          b.onResolve({ filter: /^@\// }, (args) =>
            b.resolve(`./src/${args.path.slice(2)}`, { resolveDir: root, kind: args.kind }),
          );
        },
      },
    ],
    loader: { ".ts": "ts", ".tsx": "tsx" },
  });
  const mod = await import(outfile);
  const sent = [];
  mod.api.defaults.adapter = async (config) => {
    sent.push(config);
    return {
      data: { success: true, data: {} },
      status: 200,
      statusText: "OK",
      headers: {},
      config,
    };
  };
  mod.installIspApiShim(mod.api);
  return { ...mod, sent };
}
