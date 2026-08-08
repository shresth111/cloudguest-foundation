import { createFileRoute, redirect } from "@tanstack/react-router";
import { customerFeatureHref } from "@/lib/customerNav";

/**
 * Compat redirect for the old `/c/$feature` generic route (this route's
 * own brief life as the real one, earlier today) -- see `c.index.tsx`'s
 * identical comment for the full rationale. Every feature now has its own
 * real top-level route (reports.tsx, alerts.tsx, guest-campaigns.tsx,
 * ...) -- customerFeatureHref() is the single source of truth for where
 * a given feature id actually lives now, same function every nav/redirect
 * call site in the app already goes through.
 */
export const Route = createFileRoute("/c/$feature")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: customerFeatureHref(params.feature) });
  },
});
