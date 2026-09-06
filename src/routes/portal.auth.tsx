import { PortalErrorScreen } from "@/components/portal-runtime/PortalErrorScreen";
import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/portal/auth")({
  errorComponent: PortalErrorScreen,
  component: () => <Outlet />,
});
