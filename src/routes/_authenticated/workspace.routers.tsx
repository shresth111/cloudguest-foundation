import { createFileRoute } from "@tanstack/react-router";
import { RoutersOverview } from "@/components/workspace/Overviews";

export const Route = createFileRoute("/_authenticated/workspace/routers")({
  component: () => (
    <div>
      <h1 className="mb-4 text-2xl font-semibold tracking-tight">Routers</h1>
      <RoutersOverview />
    </div>
  ),
});
