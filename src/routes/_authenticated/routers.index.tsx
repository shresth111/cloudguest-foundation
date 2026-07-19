import { createFileRoute } from "@tanstack/react-router";
import { RouterTable } from "@/components/routers/RouterTable";

export const Route = createFileRoute("/_authenticated/routers/")({
  component: RoutersListPage,
});

function RoutersListPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Routers</h1>
        <p className="text-sm text-muted-foreground">
          Provision and monitor MikroTik routers, tunnels and RADIUS across every location.
        </p>
      </div>
      <RouterTable />
    </div>
  );
}
