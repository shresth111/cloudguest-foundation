import { createFileRoute } from "@tanstack/react-router";
import { GuestsOverview } from "@/components/workspace/Overviews";

export const Route = createFileRoute("/_authenticated/workspace/guests")({
  component: () => (
    <div>
      <h1 className="mb-4 text-2xl font-semibold tracking-tight">Guests</h1>
      <GuestsOverview />
    </div>
  ),
});
