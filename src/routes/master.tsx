import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

/**
 * Super Admin "Master" console layout. A separate route tree from the
 * customer (/customer/*) and agent (/agent/*) surfaces so the three are
 * cleanly identifiable. Client-only (auth lives in localStorage); every
 * child renders its own MasterShell.
 */
export const Route = createFileRoute("/master")({
  ssr: false,
  beforeLoad: ({ context, location }) => {
    if (context.auth?.status === "anonymous") {
      throw redirect({ to: "/master-login", search: { redirect: location.href } });
    }
  },
  component: () => <Outlet />,
});
