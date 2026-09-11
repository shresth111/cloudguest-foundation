// WHY `prettier` IS PINNED TO AN EXACT VERSION IN package.json
// -------------------------------------------------------------
// `prettier/prettier` is an eslint ERROR here, so prettier's formatting is a
// CI gate -- which makes prettier's version part of the build contract, not a
// preference. It was previously `^3.7.3`, and the two lockfiles in this repo
// drifted apart underneath that caret:
//
//   bun.lock           -> prettier 3.8.3   (what CI installs; `bun install`)
//   package-lock.json  -> prettier 3.9.6   (what a laptop installs; `npm ci`)
//
// 3.9 changed how it formats multi-line union types, so the SAME committed,
// unmodified source read as 0 errors in CI and 31 errors locally. That made
// "eslint is clean" unusable as a signal: an engineer could not tell their own
// breakage from the baseline.
//
// The trap is that the obvious fix is the wrong one. Running `eslint --fix`
// (or `prettier --write`) on a laptop reformats those unions to 3.9 style,
// which is an ERROR under the 3.8.3 that CI actually runs -- so "fixing" the
// lint locally turns CI red. The repo's formatting was never wrong; only the
// tool version was.
//
// So prettier is pinned exactly and BOTH lockfiles are regenerated together.
// If you bump it, bump it in package.json and regenerate `package-lock.json`
// AND `bun.lock` in the same commit, and expect a formatting commit alongside.
// Restoring a `^` range re-opens this silently.
import js from "@eslint/js";
import eslintPluginPrettier from "eslint-plugin-prettier/recommended";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "dist",
      ".output",
      ".vinxi",
      // Stale agent worktrees are full copies of src/. Without this,
      // eslint walks ~2,900 phantom files and reports 67,000 problems,
      // which makes the real signal (a few hundred, all auto-fixable)
      // impossible to see and makes lint useless as a gate.
      ".claude",
    ],
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "server-only",
              message:
                "TanStack Start does not use the Next.js `server-only` package. Rename the module to `*.server.ts` or mark it with `@tanstack/react-start/server-only`.",
            },
          ],
        },
      ],
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  eslintPluginPrettier,
);
