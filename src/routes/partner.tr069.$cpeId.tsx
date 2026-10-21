import { createFileRoute } from "@tanstack/react-router";
import { Tr069DevicePage } from "@/components/isp-partner/tr069/Tr069DevicePage";

export const Route = createFileRoute("/partner/tr069/$cpeId")({
  ssr: false,
  component: Tr069DeviceRoute,
});

function Tr069DeviceRoute() {
  const { cpeId } = Route.useParams();
  return <Tr069DevicePage key={cpeId} cpeId={cpeId} />;
}
