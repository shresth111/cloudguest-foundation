import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";

export const Route = createFileRoute("/")({
  component: IndexRedirect,
});

function IndexRedirect() {
  const { isAuthenticated, isReady } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isReady) return;
    navigate({ to: isAuthenticated ? "/dashboard" : "/login", replace: true });
  }, [isReady, isAuthenticated, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}
