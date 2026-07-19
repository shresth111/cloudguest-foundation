import { Link } from "@tanstack/react-router";
import { MapPin, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function WorkspaceEmpty({
  title = "Welcome to CloudGuest",
  description = "Create your first location to begin managing Guest WiFi and routers.",
  cta = "Create location",
  to = "/locations",
}: {
  title?: string;
  description?: string;
  cta?: string;
  to?: string;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center gap-4 py-16 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          <MapPin className="h-6 w-6" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
        </div>
        <Button asChild>
          <Link to={to}>
            <Plus className="mr-2 h-4 w-4" /> {cta}
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
