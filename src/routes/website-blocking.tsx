import { createFileRoute, redirect } from "@tanstack/react-router";
import { requireCustomerSession } from "@/lib/authGuards";
import { requireActiveLocationId } from "@/lib/customerLocationGuard";

/**
 * Moved, kept as a redirect.
 *
 * Website Blocking used to be its own row in the Network group. It is now the
 * "Websites & IPs" tab of Security -> Blocking, beside blocked guests, so that
 * everything a venue can block is in one place (see `lib/blocking.ts`). The
 * rules, the screen and the requests are the same ones; only the address
 * moved.
 *
 * This file stays because the old address was linkable and is very likely
 * bookmarked. Without it those links would fall through to a missing route,
 * which reads as the feature having been deleted rather than moved. The
 * session and venue guards run first -- the same order as
 * `background-image.tsx` -- so an expired bookmark still lands on sign-in.
 */
export const Route = createFileRoute("/website-blocking")({
  ssr: false,
  beforeLoad: ({ context, location }) => {
    requireCustomerSession(context.auth, location);
    requireActiveLocationId();
    throw redirect({ to: "/blocking", search: { tab: "websites" } });
  },
});
