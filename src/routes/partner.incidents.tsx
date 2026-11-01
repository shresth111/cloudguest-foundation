import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { IncidentsPage } from "@/components/isp-partner/incidents/IncidentsPage";

/** `/partner/incidents` (INCIDENTS-1). `?incident=` opens one. */
export const Route = createFileRoute("/partner/incidents")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): { incident?: string } =>
    typeof search.incident === "string" && /^[0-9a-f-]{36}$/i.test(search.incident)
      ? { incident: search.incident }
      : {},
  component: IncidentsRoute,
});

function IncidentsRoute() {
  const { incident } = Route.useSearch();
  const navigate = useNavigate();
  return (
    <IncidentsPage
      incidentId={incident ?? null}
      onIncident={(id) =>
        navigate({ to: "/partner/incidents", search: id ? { incident: id } : {}, replace: true })
      }
    />
  );
}
