import { createFileRoute } from "@tanstack/react-router";
import { ForgotPasswordPage } from "@/components/auth/ForgotPasswordPage";

export const Route = createFileRoute("/forgot-password")({
  component: ForgotPasswordRouteComponent,
});

// Standalone route entry point -- used only for direct/deep links to
// /forgot-password (e.g. if it's ever linked from outside the app). The
// login page itself renders `ForgotPasswordPage` inline instead of visiting
// this route, so the address bar never changes for that in-app click (see
// login.tsx).
function ForgotPasswordRouteComponent() {
  return <ForgotPasswordPage />;
}
