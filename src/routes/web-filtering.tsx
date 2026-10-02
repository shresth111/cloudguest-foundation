import { createFileRoute, redirect } from "@tanstack/react-router";
import { requireCustomerSession } from "@/lib/authGuards";
import { requireActiveLocationId } from "@/lib/customerLocationGuard";

/**
 * Moved, kept as a redirect.
 *
 * Web filtering (Cloudflare categories) used to be its own Security row. It is
 * now the "Categories" section of Security -> Block Websites, under the box
 * that blocks one website by name, so a venue owner finds website blocking in
 * one place (see `lib/blocking.ts`). Same component, same requests; only the
 * address moved.
 *
 * Kept because the old address was linkable. The session and venue guards run
 * first, the same order as `website-blocking.tsx`, so an expired bookmark
 * still lands on sign-in. At a controller-managed venue the Websites tab shows
 * the controller notice, exactly as this page did.
 */
export const Route = createFileRoute("/web-filtering")({
  ssr: false,
  beforeLoad: ({ context, location }) => {
    requireCustomerSession(context.auth, location);
    requireActiveLocationId();
    throw redirect({ to: "/blocking", search: { tab: "websites" }, hash: "categories" });
  },
});
