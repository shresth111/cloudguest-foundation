import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { requireCustomerSession } from "@/lib/authGuards";
import { requireActiveLocationId } from "@/lib/customerLocationGuard";
import { CustomerFeaturePage } from "@/components/customer/CustomerFeaturePage";

/**
 * Security -> Firewall: firewall rules, Block Websites and the Security Check
 * as three tabs (see `components/security/FirewallSectionView.tsx` and
 * `lib/firewall-section.ts`).
 *
 * `?section=rules|blocking|security` picks the tab; `?tab=websites|guests`
 * is Block Websites' own tab inside it. Anything else, or nothing, is dropped
 * rather than rejected, so a mistyped link still opens the page.
 *
 * Each tab applies its own controller-venue rule (the rules tab and Block
 * Websites' Websites tab show the controller notice at a controller-only
 * venue; the Security Check and blocked guests work there), so the shell's
 * page-level gate does not cover this page.
 */
export const Route = createFileRoute("/firewall")({
  ssr: false,
  validateSearch: z.object({
    section: z.enum(["rules", "blocking", "security"]).optional().catch(undefined),
    tab: z.enum(["websites", "guests"]).optional().catch(undefined),
  }),
  beforeLoad: ({ context, location }) => {
    requireCustomerSession(context.auth, location);
    requireActiveLocationId();
  },
  component: () => <CustomerFeaturePage feature="firewall" />,
});
