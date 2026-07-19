import { createFileRoute } from "@tanstack/react-router";
import { StaffOverview } from "@/components/workspace/Overviews";

export const Route = createFileRoute("/_authenticated/workspace/staff")({
  component: () => (
    <div>
      <h1 className="mb-4 text-2xl font-semibold tracking-tight">Staff</h1>
      <StaffOverview />
    </div>
  ),
});
