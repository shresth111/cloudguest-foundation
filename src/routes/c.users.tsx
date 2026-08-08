import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Compat redirect for the old `/c/users` URL (this route's own brief
 * life as the real one, earlier today) -- see `c.index.tsx`'s identical
 * comment for the full rationale. Real page now lives at `/users`
 * (`users.tsx`) -- no location-id resolution needed here, unlike the
 * `/customer/$locationId/...` compat routes, since this URL never had
 * one in the path to begin with.
 */
export const Route = createFileRoute("/c/users")({
  beforeLoad: () => {
    throw redirect({ to: "/users" });
  },
});
