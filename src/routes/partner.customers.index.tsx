import { createFileRoute } from "@tanstack/react-router";
import { CustomersPage } from "@/components/isp-partner/customers/CustomersPage";

export const Route = createFileRoute("/partner/customers/")({
  ssr: false,
  component: CustomersPage,
});
