import { Link, useRouterState } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { useLocation } from "@/hooks/useLocations";
import { useNas } from "@/hooks/useNas";

const STATIC_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  customers: "Customers",
  locations: "Location Master",
  nas: "NAS",
  vouchers: "Voucher Master",
  policies: "Policies",
  analytics: "Analytics",
  billing: "Billing",
  audit: "Audit Logs",
  settings: "Settings",
  workspace: "Workspace",
  rbac: "Users & Roles",
  infrastructure: "Infrastructure",
  "feature-catalog": "Feature Catalog",
  marketplace: "Marketplace",
  subscription: "Subscription",
  system: "System",
  "api-keys": "API Keys",
  integrations: "Integrations",
  notifications: "Notifications",
  onboarding: "Onboarding",
  account: "Account",
  "id-generator": "ID Generator",
};

function humanize(seg: string) {
  return STATIC_LABELS[seg] ?? seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, " ");
}

export function Breadcrumbs() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const segments = pathname.split("/").filter(Boolean);

  // Detect dynamic ids in known paths so we can resolve friendlier labels.
  const locIdx = segments[0] === "locations" ? 1 : -1;
  const locationId = locIdx > 0 ? segments[locIdx] : "";
  const nasIdx = locIdx > 0 && segments[locIdx + 1] === "nas" ? locIdx + 2 : -1;
  const nasId = nasIdx > 0 ? segments[nasIdx] : "";

  const { data: location } = useLocation(locationId);
  const { data: nas } = useNas(locationId, nasId);

  if (segments.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className="flex items-center text-sm text-muted-foreground">
      <Link to="/dashboard" className="hover:text-foreground">
        Home
      </Link>
      {segments.map((seg, i) => {
        const isLast = i === segments.length - 1;
        const href = "/" + segments.slice(0, i + 1).join("/");

        let label = humanize(seg);
        if (i === locIdx && location?.name) label = location.name;
        else if (i === nasIdx && nas?.name) label = nas.name;

        return (
          <span key={seg + i} className="flex items-center">
            <ChevronRight className="mx-1 h-4 w-4" />
            {isLast ? (
              <span className="font-medium text-foreground">{label}</span>
            ) : (
              <Link to={href} className="hover:text-foreground">
                {label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
