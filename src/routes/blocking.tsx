import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";
import { requireCustomerSession } from "@/lib/authGuards";
import { requireActiveLocationId } from "@/lib/customerLocationGuard";

/**
 * Moved, kept as a redirect.
 *
 * Block Websites used to be its own Security row. It is now the "Block
 * websites" tab of Security -> Firewall (`lib/firewall-section.ts`), beside
 * the firewall rules and the Security Check. Same screen, same requests; only
 * the address moved. `?tab=websites|guests` and any `#section` anchor are
 * carried over, so a bookmark lands on the same tab and section.
 *
 * The session and venue guards run first, the same order as
 * `website-blocking.tsx`, so an expired bookmark still lands on sign-in.
 */
export const Route = createFileRoute("/blocking")({
  ssr: false,
  validateSearch: z.object({
    tab: z.enum(["websites", "guests"]).optional().catch(undefined),
  }),
  beforeLoad: ({ context, location, search }) => {
    requireCustomerSession(context.auth, location);
    requireActiveLocationId();
    throw redirect({
      to: "/firewall",
      search: { section: "blocking", tab: search.tab },
      hash: location.hash || undefined,
    });
  },
});
