import { Wrench, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function ErrorMaintenancePage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-sky-500/10">
        <Wrench className="h-10 w-10 text-sky-500" />
      </div>
      <h1 className="text-5xl font-bold text-foreground">Under maintenance</h1>
      <p className="mt-4 max-w-md text-sm text-muted-foreground">
        We're performing scheduled maintenance to improve your experience. Services will be back shortly.
      </p>
      <div className="mt-4 flex items-center gap-2">
        <Badge variant="outline" className="text-sm">Estimated completion: 2 hours</Badge>
      </div>
      <div className="mt-8 flex gap-3">
        <Button variant="outline">
          <Bell className="mr-2 h-4 w-4" /> Notify me when done
        </Button>
        <Button variant="outline" onClick={() => window.open("https://status.cloudguest.io", "_blank")}>
          Status page
        </Button>
      </div>
    </div>
  );
}
