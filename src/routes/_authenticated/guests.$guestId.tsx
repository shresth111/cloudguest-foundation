import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { ErrorState } from "@/components/common/ErrorState";
import { PageSkeleton } from "@/components/common/LoadingSkeleton";
import { GuestDetailTabs } from "@/components/guests/GuestDetailTabs";
import { useGuest } from "@/hooks/useGuests";

const searchSchema = z.object({ tab: z.string().optional() });

export const Route = createFileRoute("/_authenticated/guests/$guestId")({
  validateSearch: searchSchema,
  component: GuestDetailPage,
});

function GuestDetailPage() {
  const { guestId } = Route.useParams();
  const { tab } = Route.useSearch();
  const { data: guest, isLoading, isError, refetch } = useGuest(guestId);

  if (isLoading) return <PageSkeleton />;
  if (isError) return <ErrorState onRetry={() => refetch()} />;
  if (!guest)
    return <ErrorState title="Guest not found" description="This guest may have been removed." />;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Link
          to="/guests"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" /> Back to guests
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">
            {guest.displayName ?? guest.identifier}
          </h1>
          <Badge variant={guest.isBlocked ? "destructive" : "outline"}>
            {guest.isBlocked ? "Blocked" : "Active"}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {guest.identifier} · {guest.organizationName} ·{" "}
          {guest.locationName ?? "No location on file"}
        </p>
      </div>
      <GuestDetailTabs guest={guest} initialTab={tab ?? "overview"} />
    </div>
  );
}
