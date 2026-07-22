import { ShieldAlert, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "@tanstack/react-router";

export function Error401Page() {
  const navigate = useNavigate();
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-amber-500/10">
        <ShieldAlert className="h-10 w-10 text-amber-500" />
      </div>
      <h1 className="text-6xl font-bold text-foreground">401</h1>
      <h2 className="mt-4 text-xl font-semibold text-foreground">Unauthorized</h2>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        You need to sign in to access this page. Please log in with your credentials.
      </p>
      <div className="mt-6 flex gap-3">
        <Button onClick={() => navigate({ to: "/login" })}>
          Sign in
        </Button>
        <Button variant="outline" onClick={() => navigate({ to: "/" })}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Go home
        </Button>
      </div>
    </div>
  );
}
