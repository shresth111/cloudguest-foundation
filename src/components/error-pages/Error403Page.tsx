import { Ban, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "@tanstack/react-router";

export function Error403Page() {
  const navigate = useNavigate();
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-rose-500/10">
        <Ban className="h-10 w-10 text-rose-500" />
      </div>
      <h1 className="text-6xl font-bold text-foreground">403</h1>
      <h2 className="mt-4 text-xl font-semibold text-foreground">Access denied</h2>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        You don't have permission to access this resource. Contact your administrator if you think this is a mistake.
      </p>
      <div className="mt-6 flex gap-3">
        <Button onClick={() => navigate({ to: "/dashboard" })}>
          Go to dashboard
        </Button>
        <Button variant="outline" onClick={() => navigate({ to: "/help" })}>
          Contact support
        </Button>
      </div>
    </div>
  );
}
