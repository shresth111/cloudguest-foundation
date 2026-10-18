import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { requireCustomerSession } from "@/lib/authGuards";
import { requireActiveLocationId } from "@/lib/customerLocationGuard";
import { CustomerFeaturePage } from "@/components/customer/CustomerFeaturePage";

/**
 * Support & Logs -> NetLogs (`components/netlogs/NetLogsView.tsx`).
 *
 * Every filter is a search param (see `lib/netlogs.ts` for the mapping):
 * `range`, `from`, `to`, `loc`, `router`, `sev`, `cat`, `st`, `q`. Each is a
 * plain optional string here and is validated by `filtersFromSearch`, which
 * drops anything it does not understand -- so a mistyped or stale link still
 * opens the page instead of failing the route.
 */
const optional = z.string().max(400).optional().catch(undefined);

export const Route = createFileRoute("/netlogs")({
  ssr: false,
  validateSearch: z.object({
    range: optional,
    from: optional,
    to: optional,
    loc: optional,
    router: optional,
    sev: optional,
    cat: optional,
    st: optional,
    q: optional,
  }),
  beforeLoad: ({ context, location }) => {
    requireCustomerSession(context.auth, location);
    requireActiveLocationId();
  },
  component: () => <CustomerFeaturePage feature="netlogs" />,
});
