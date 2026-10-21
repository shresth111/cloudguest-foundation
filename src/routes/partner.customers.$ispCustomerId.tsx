import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CustomerDetailPage } from "@/components/isp-partner/customers/CustomerDetailPage";

const TABS = [
  "overview",
  "locations",
  "routers",
  "portal",
  "guests",
  "logs",
  "tr069",
  "reports",
  "billing",
] as const;
type Tab = (typeof TABS)[number];

export const Route = createFileRoute("/partner/customers/$ispCustomerId")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): { tab?: Tab } =>
    typeof search.tab === "string" && (TABS as readonly string[]).includes(search.tab)
      ? { tab: search.tab as Tab }
      : {},
  component: CustomerDetailRoute,
});

function CustomerDetailRoute() {
  const { ispCustomerId } = Route.useParams();
  const { tab } = Route.useSearch();
  const navigate = useNavigate();
  return (
    <CustomerDetailPage
      key={ispCustomerId}
      customerId={ispCustomerId}
      tab={tab ?? "overview"}
      onTab={(t) =>
        navigate({
          to: "/partner/customers/$ispCustomerId",
          params: { ispCustomerId },
          search: t === "overview" ? {} : { tab: t },
          replace: true,
        })
      }
    />
  );
}
