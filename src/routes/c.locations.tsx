import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Compat redirect for the old `/c/locations` URL (this route's own brief
 * life as the real one, earlier today) -- see `c.index.tsx`'s identical
 * comment for the full rationale. Real page now lives at
 * `/switch-location` (`switch-location.tsx`) -- "locations" itself was
 * never available (see customerNav.ts's own comment on why).
 */
export const Route = createFileRoute("/c/locations")({
  beforeLoad: () => {
    throw redirect({ to: "/switch-location" });
  },
});
