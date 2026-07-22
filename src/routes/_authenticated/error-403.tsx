import { createFileRoute } from "@tanstack/react-router";
import { Error403Page } from "@/components/error-pages/Error403Page";

export const Route = createFileRoute("/_authenticated/error-403")({
  component: () => <Error403Page />,
});
