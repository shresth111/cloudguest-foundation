import { createFileRoute, redirect } from "@tanstack/react-router";

// Dead-end scaffolding -- never wired to the real audit domain (no import
// from @/services/audit.service or @/components/audit/*), just a static
// 12-row hardcoded table. Retired in favor of /audit.
//
// The redirect is gated on the viewer actually being an operator. /audit is
// not a customer-safe path, so the parent _authenticated guard bounces every
// real venue owner off it to "/" -- an unconditional redirect here sent them
// somewhere they cannot go and stranded them at the app root with no
// explanation instead of at the destination this comment promises.
export const Route = createFileRoute("/_authenticated/workspace/audit")({
  beforeLoad: ({ context }) => {
    const isOperator = context.auth?.roles?.some((r) => r.scopeType === "global") ?? false;
    throw redirect({ to: isOperator ? "/audit" : "/workspace" });
  },
});
