import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

/**
 * `/settings` used to render sixteen "Platform settings" panels (General,
 * Authentication, Security, Email, SMS, Storage, Integrations, Payment, API,
 * System, Backup, Feature flags, ...). Every save, "Test connection",
 * "Back up now", "Restart services" and "Clear cache" on them went to
 * `settingsService`, an in-memory object with `delay()` calls
 * (services/settings.service.ts): each showed a success toast, nothing
 * reached the backend, and a reload put the old values back. The one real
 * part, API keys, has its own page.
 *
 * The page is reachable: `_authenticated.tsx` lets any GLOBAL-scope operator
 * in, off the master host, by typed URL or the command palette's
 * "Open Settings". So it no longer renders those panels. It says what is
 * real and where it lives. The panel components and the mock service are
 * left in the tree, unreferenced from here, for whoever wires them to a
 * backend.
 */
export const Route = createFileRoute("/_authenticated/settings/")({
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Platform settings</h1>
      </header>
      <Card className="border-amber-500/40 bg-amber-500/5">
        <CardContent className="flex items-start gap-3 p-5 text-sm">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div className="space-y-3">
            <p className="font-medium">
              These settings are not connected to the backend, so this page has been turned off.
            </p>
            <p className="text-muted-foreground">
              Email, SMS, storage, backup, system and the other platform panels here only ever saved
              to the browser&apos;s memory. They showed a success message and changed nothing. The
              settings that are real live on their own pages:
            </p>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <Link to="/api-keys" className="text-primary underline-offset-2 hover:underline">
                  API keys
                </Link>
              </li>
              <li>
                <Link to="/branding" className="text-primary underline-offset-2 hover:underline">
                  Branding
                </Link>
              </li>
              <li>
                <Link
                  to="/master/notification-channels"
                  className="text-primary underline-offset-2 hover:underline"
                >
                  Alert channels (Master console)
                </Link>
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
