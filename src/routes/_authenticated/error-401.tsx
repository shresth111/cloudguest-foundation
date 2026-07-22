import { createFileRoute } from "@tanstack/react-router";
import { Error401Page } from "@/components/error-pages/Error401Page";

export const Route = createFileRoute("/_authenticated/error-401")({
  component: () => <Error401Page />,
});
