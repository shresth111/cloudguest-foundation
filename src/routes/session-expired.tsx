import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Clock } from "lucide-react";
import { useEffect } from "react";
import { z } from "zod";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";

export const Route = createFileRoute("/session-expired")({
  validateSearch: z.object({ redirect: z.string().optional() }),
  component: SessionExpiredPage,
});

function SessionExpiredPage() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const { redirect } = Route.useSearch();

  useEffect(() => {
    void logout();
  }, [logout]);

  // api.ts's response interceptor sends *any* session here on a 401 it
  // can't refresh -- a Master Console session's expired token lands here
  // exactly the same way a customer's does, `redirect` carrying whichever
  // page they were on (e.g. "/master/customers"). This used to always
  // point "Return to sign in" at /login (the customer/org-owner sign-in
  // page) regardless of that -- so a platform operator whose session
  // expired mid-console got dropped onto the customer login page instead
  // of back to /master-login. Route by the same prefix the /master and
  // /agent route guards themselves key off of, so each surface's session
  // expiring sends you back to *that* surface's own sign-in, not always
  // the customer one.
  const signInTarget = redirect?.startsWith("/master") ? "/master-login" : "/login";

  return (
    <AuthLayout title="Your session has expired" subtitle="For your security, please sign in again to continue.">
      <div className="flex flex-col items-center gap-6 rounded-xl border border-border bg-card p-8 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <Clock className="h-5 w-5 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground">
          You've been signed out due to inactivity or an expired session token.
        </p>
        <Button
          className="w-full"
          onClick={() => navigate({ to: signInTarget, search: { redirect }, replace: true })}
        >
          Return to sign in
        </Button>
      </div>
    </AuthLayout>
  );
}
