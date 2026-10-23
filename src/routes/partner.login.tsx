import { createFileRoute } from "@tanstack/react-router";
import { PartnerLoginPage } from "@/components/isp-partner/PartnerLoginPage";

/** Partner console sign-in (TASKS FE-1). The `/partner` layout renders it
 * bare, without the console chrome. */
export const Route = createFileRoute("/partner/login")({
  ssr: false,
  // `?reset=done` after a finished password reset (PartnerLoginPage note).
  validateSearch: (search: Record<string, unknown>): { reset?: string } =>
    typeof search.reset === "string" ? { reset: search.reset } : {},
  component: PartnerLoginPage,
});
