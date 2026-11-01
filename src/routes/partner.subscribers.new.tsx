import { createFileRoute } from "@tanstack/react-router";
import { OnboardPage } from "@/components/isp-partner/onboarding/OnboardPage";

/** `/partner/subscribers/new` (ONBOARD-1): add a subscriber on one page. */
export const Route = createFileRoute("/partner/subscribers/new")({
  ssr: false,
  component: OnboardPage,
});
