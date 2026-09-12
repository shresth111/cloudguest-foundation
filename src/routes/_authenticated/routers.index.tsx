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
        {/* Not "MikroTik routers": this table lists controller-managed rows
            too (contract §11.5), and the old sentence printed a vendor claim
            directly above an Omada row that the table's own cells go out of
            their way to describe correctly. "Provision" is likewise only
            true of the agent-managed half -- a controller is configured on
            the controller -- so the verb covers both without promising the
            wrong one for either. */}
        <p className="text-sm text-muted-foreground">
          Every router and vendor controller across your locations, with its tunnels and RADIUS.
        </p>
      </div>
      <RouterTable />
    </div>
  );
}
