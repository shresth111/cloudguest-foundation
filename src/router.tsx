import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import type { RouterAuthContext } from "@/context/AuthContext";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient, auth: undefined as RouterAuthContext | undefined },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
