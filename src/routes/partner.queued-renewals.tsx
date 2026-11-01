import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { QueuedRenewalsPage } from "@/components/isp-partner/queued/QueuedRenewalsPage";
import { parseQueuedSearch, type QueuedSearch } from "@/lib/isp-partner/queued-list";

/** `/partner/queued-renewals` (P3-SWEEP): ISP-wide queued renewals. Every
 * filter is in the URL (status, q, package, within, page). */
export const Route = createFileRoute("/partner/queued-renewals")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): QueuedSearch => parseQueuedSearch(search),
  component: QueuedRenewalsRoute,
});

function QueuedRenewalsRoute() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  return (
    <QueuedRenewalsPage
      search={search}
      onSearch={(next) => navigate({ to: "/partner/queued-renewals", search: next, replace: true })}
    />
  );
}
