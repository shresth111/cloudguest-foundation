import { createFileRoute, redirect } from "@tanstack/react-router";
import { requireCustomerSession } from "@/lib/authGuards";
import { requireActiveLocationId } from "@/lib/customerLocationGuard";

/**
 * Moved, kept as a redirect.
 *
 * The Security Score used to be its own Security row. It is now the "Security
 * check" tab of Security -> Firewall (`lib/firewall-section.ts`). Same screen,
 * same requests, still not part of the Firewall add-on; only the address
 * moved. The session and venue guards run first, so an expired bookmark still
 * lands on sign-in.
 */
export const Route = createFileRoute("/security")({
  ssr: false,
  beforeLoad: ({ context, location }) => {
    requireCustomerSession(context.auth, location);
    requireActiveLocationId();
    throw redirect({ to: "/firewall", search: { section: "security" } });
  },
});
