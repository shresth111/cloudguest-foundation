import { createFileRoute } from "@tanstack/react-router";
import { PartnerLoginPage } from "@/components/isp-partner/PartnerLoginPage";

/** Partner console sign-in (TASKS FE-1). The `/partner` layout renders it
 * bare, without the console chrome. */
export const Route = createFileRoute("/partner/login")({
  ssr: false,
  component: PartnerLoginPage,
});
