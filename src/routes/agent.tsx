import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

/**
 * Agent surface. A separate route tree from the owner customer dashboard
 * (/customer/*) and the operator console (/master/*) so the three are
 * cleanly identifiable. The agent sees a dynamic dashboard built from the
 * features their owner granted (see agentPermissionStore).
 */
export const Route = createFileRoute("/agent")({
  ssr: false,
  beforeLoad: ({ context, location }) => {
    if (context.auth?.status === "anonymous") {
      throw redirect({ to: "/login", search: { redirect: location.href } });
    }
  },
  component: () => <Outlet />,
});
