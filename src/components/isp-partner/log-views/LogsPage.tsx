/** `/partner/logs` page wrapper: binds the filters to the URL. */
import { useNavigate, useSearch } from "@tanstack/react-router";
import { MSectionHeader } from "@/components/master/MasterKit";
import { LogsView } from "@/components/isp-partner/log-views/LogsView";
import { filtersFromSearch, searchFromFilters } from "@/components/isp-partner/log-views/logFilters";

export function LogsPage() {
  const search = useSearch({ strict: false }) as Record<string, unknown>;
  const navigate = useNavigate();
  const filters = filtersFromSearch(search);
  return (
    <>
      <MSectionHeader
        eyebrow="Logs"
        title="Logs"
        description="Router logs, IPDR connection records and guest sign-ins across your customers."
      />
      <LogsView
        filters={filters}
        onChange={(next) =>
          navigate({ to: "/partner/logs", search: searchFromFilters(next), replace: true })
        }
      />
    </>
  );
}
