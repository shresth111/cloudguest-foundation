import { createFileRoute } from "@tanstack/react-router";
import { RoutersPage } from "@/components/isp-partner/routers/RoutersPage";

export const Route = createFileRoute("/partner/routers/")({
  ssr: false,
  component: RoutersPage,
});
