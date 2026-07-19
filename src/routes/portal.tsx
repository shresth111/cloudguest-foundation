import { createFileRoute, Outlet } from "@tanstack/react-router";
import { PortalRuntimeProvider } from "@/context/PortalRuntimeContext";

export const Route = createFileRoute("/portal")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Guest WiFi — Sign in" },
      { name: "description", content: "Connect to complimentary guest WiFi." },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#0F172A" },
    ],
  }),
  component: PortalRuntimeLayout,
});

function PortalRuntimeLayout() {
  return (
    <PortalRuntimeProvider>
      <Outlet />
    </PortalRuntimeProvider>
  );
}
