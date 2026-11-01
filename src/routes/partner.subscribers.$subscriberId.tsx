import { createFileRoute } from "@tanstack/react-router";
import { Subscriber360Page } from "@/components/isp-partner/subscribers/Subscriber360Page";

/** `/partner/subscribers/:id` -- Subscriber 360 (ADDENDUM_05 J1). */
export const Route = createFileRoute("/partner/subscribers/$subscriberId")({
  ssr: false,
  component: Subscriber360Route,
});

function Subscriber360Route() {
  const { subscriberId } = Route.useParams();
  return <Subscriber360Page key={subscriberId} subscriberId={subscriberId} />;
}
