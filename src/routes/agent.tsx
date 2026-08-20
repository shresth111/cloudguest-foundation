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
      // See authGuards.ts's requireCustomerSession's identical guard --
      // never carry a redirect target that's already /login itself
      // forward as the ?redirect= value.
      const isAlreadyOnLogin =
        location.href === "/login" ||
        location.href.startsWith("/login?") ||
        location.href.startsWith("/login#");
      throw redirect({
        to: "/login",
        search: isAlreadyOnLogin ? undefined : { redirect: location.href },
      });
    }
  },
  component: () => <Outlet />,
});
