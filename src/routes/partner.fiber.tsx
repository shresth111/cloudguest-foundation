import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { FiberPage } from "@/components/isp-partner/fiber/FiberPage";

/** `/partner/fiber` (J22, lane JAZE-6). `?node=` opens a node. */
export const Route = createFileRoute("/partner/fiber")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): { node?: string } =>
    typeof search.node === "string" && /^[0-9a-f-]{36}$/i.test(search.node)
      ? { node: search.node }
      : {},
  component: FiberRoute,
});

function FiberRoute() {
  const { node } = Route.useSearch();
  const navigate = useNavigate();
  return (
    <FiberPage
      nodeId={node ?? null}
      onNode={(id) =>
        navigate({ to: "/partner/fiber", search: id ? { node: id } : {}, replace: true })
      }
    />
  );
}
