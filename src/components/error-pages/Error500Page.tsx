import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

export function Error500Page() {
  const navigate = useNavigate();
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-destructive/10">
        <AlertTriangle className="h-10 w-10 text-destructive" />
      </div>
      <h1 className="text-6xl font-bold text-foreground">500</h1>
      <h2 className="mt-4 text-xl font-semibold text-foreground">Server error</h2>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        Something went wrong on our end. Our team has been notified and is working on a fix.
      </p>
      <div className="mt-6 flex gap-3">
        <Button onClick={() => { window.location.reload(); }}>
          <RefreshCw className="mr-2 h-4 w-4" /> Try again
        </Button>
        <Button variant="outline" onClick={() => { toast.success("Report submitted"); }}>
          Report issue
        </Button>
      </div>
    </div>
  );
}
