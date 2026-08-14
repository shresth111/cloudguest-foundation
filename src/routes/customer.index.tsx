import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Compat redirect for the old bare `/customer` URL -- this was the
 * location picker's own URL for a long time (well before today's whole
 * URL-shortening effort), then briefly the dashboard's, before the /c
 * rename moved everything again without leaving this one behind (a real
 * gap: this 404'd until this file existed). Points at the dashboard now,
 * the same "customer home" meaning every other entry point resolves to.
 */
export const Route = createFileRoute("/customer/")({
  beforeLoad: () => {
    throw redirect({ to: "/" });
  },
});
