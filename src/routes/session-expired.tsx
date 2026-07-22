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
          onClick={() => navigate({ to: "/login", search: { redirect }, replace: true })}
        >
          Return to sign in
        </Button>
      </div>
    </AuthLayout>
  );
}
