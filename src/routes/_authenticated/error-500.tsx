import { createFileRoute } from "@tanstack/react-router";
import { Error500Page } from "@/components/error-pages/Error500Page";

export const Route = createFileRoute("/_authenticated/error-500")({
  component: () => <Error500Page />,
});
