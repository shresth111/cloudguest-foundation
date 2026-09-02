import { createFileRoute, redirect } from "@tanstack/react-router";

// A per-scope "Staff" roster never had a real backend endpoint -- RBAC role
// assignments are scoped per user, not queryable by location/org as a
// reverse index. Retired in favor of the real Users & Roles console.
//
// The redirect is gated on the viewer actually being an operator. /rbac is
// not a customer-safe path, so the parent _authenticated guard bounces every
// real venue owner off it to "/" -- an unconditional redirect here sent them
// somewhere they cannot go and stranded them at the app root with no
// explanation instead of at the destination this comment promises.
export const Route = createFileRoute("/_authenticated/workspace/staff")({
  beforeLoad: ({ context }) => {
    const isOperator = context.auth?.roles?.some((r) => r.scopeType === "global") ?? false;
    throw redirect({ to: isOperator ? "/rbac" : "/workspace" });
  },
});
