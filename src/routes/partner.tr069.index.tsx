import { createFileRoute } from "@tanstack/react-router";
import { Tr069InventoryPage } from "@/components/isp-partner/tr069/Tr069InventoryPage";

export const Route = createFileRoute("/partner/tr069/")({
  ssr: false,
  component: Tr069InventoryPage,
});
