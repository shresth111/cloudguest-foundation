import { createFileRoute } from "@tanstack/react-router";
import { UsersPage } from "@/components/isp-partner/users/UsersPage";

export const Route = createFileRoute("/partner/users")({
  ssr: false,
  component: UsersPage,
});
