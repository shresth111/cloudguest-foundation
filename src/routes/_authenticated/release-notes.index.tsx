import { createFileRoute } from "@tanstack/react-router";
import { Bug, CheckCircle2, Lightbulb, AlertTriangle, ArrowRight, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/system/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface Release {
  version: string;
  date: string;
  type: "major" | "minor" | "patch";
  features: string[];
  improvements: string[];
  bugfixes: string[];
  knownIssues: string[];
  upcoming: string[];
}

const RELEASES: Release[] = [
  {
    version: "3.2.0", date: "2025-07-15", type: "minor",
    features: ["WhatsApp OTP authentication", "Advanced VLAN mapping UI", "Executive analytics dashboard"],
    improvements: ["50% faster portal load times", "Improved session explorer filtering", "Enhanced RADIUS proxy logging"],
    bugfixes: ["Fixed session timeout not reflecting in UI", "Resolved SSID broadcast toggle issue", "Fixed location map rendering on Safari"],
    knownIssues: ["WhatsApp OTP may have 2-3s delay in Southeast Asia region", "VLAN mapping export fails for >100 VLANs"],
    upcoming: ["SSO (SAML/OIDC) integration", "AI-powered network assistant", "Cloud backup automation"],
  },
  {
    version: "3.1.0", date: "2025-06-01", type: "minor",
    features: ["Live session explorer with real-time updates", "Device topology visualization", "Feature flags management UI"],
    improvements: ["Re-designed notification center", "Improved audit trail search", "Better mobile responsiveness"],
    bugfixes: ["Fixed null pointer in router status check", "Resolved billing invoice date calculations", "Fixed portal preview on mobile viewports"],
    knownIssues: ["Notification bell badge count may lag by 30s", "Topology auto-layout breaks for >50 nodes"],
    upcoming: ["RADIUS proxy enhancements", "Executive analytics"],
  },
  {
    version: "3.0.0", date: "2025-04-20", type: "major",
    features: ["Complete UI redesign with new design system", "Multi-tenant organization switcher", "Global search with Ctrl+K", "Command palette (Ctrl+Shift+P)", "Dark mode support"],
    improvements: ["Migrated to TanStack Router for file-based routing", "New shadcn/ui component library", "Performance improvements across all pages", "Reduced bundle size by 40%"],
    bugfixes: ["Fixed authentication token refresh race condition", "Resolved WebSocket connection drops on unstable networks", "Fixed CSV export encoding for non-Latin characters"],
    knownIssues: ["Legacy browser support limited to last 2 versions", "Some third-party integrations require re-authorization"],
    upcoming: ["API marketplace", "Custom role builder", "Advanced automation rules"],
  },
  {
    version: "2.8.0", date: "2025-03-01", type: "patch",
    features: ["RADIUS proxy configuration", "Advanced bandwidth policies"],
    improvements: ["Improved voucher generation speed", "Better error messages on portal"],
    bugfixes: ["Fixed DHCP lease renewal display", "Resolved portal font rendering on iOS"],
    knownIssues: ["None reported"],
    upcoming: ["UI redesign (planned for v3.0)"],
  },
  {
    version: "2.7.0", date: "2025-01-15", type: "minor",
    features: ["Guest portal builder with templates", "Campaign management", "Voucher batch generation"],
    improvements: ["Faster location switching", "Improved audit log readability"],
    bugfixes: ["Fixed duplicate MAC detection", "Resolved timezone issues in reports"],
    knownIssues: ["Portal builder mobile preview differs from actual render"],
    upcoming: ["RADIUS proxy", "Live session monitoring"],
  },
];

const TYPE_STYLES = {
  major: "bg-violet-500/15 text-violet-600 border-violet-500/30",
  minor: "bg-blue-500/15 text-blue-600 border-blue-500/30",
  patch: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
};

export const Route = createFileRoute("/_authenticated/release-notes/")({
  component: ReleaseNotesPage,
});

function ReleaseNotesPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Release notes" description="Track every change, improvement, and fix across platform versions." />
      <div className="relative space-y-8">
        {RELEASES.map((release, idx) => (
          <div key={release.version} className="relative">
            {idx < RELEASES.length - 1 && (
              <div className="absolute left-[23px] top-12 bottom-0 w-px bg-gradient-to-b from-border via-border/50 to-transparent" />
            )}
            <div className="flex gap-5">
              <div className={cn("relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2", TYPE_STYLES[release.type])}>
                <span className="text-[10px] font-bold">{release.version}</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-semibold">v{release.version}</h3>
                  <Badge variant="outline" className={cn("capitalize", TYPE_STYLES[release.type])}>{release.type}</Badge>
                  <span className="text-xs text-muted-foreground">{release.date}</span>
                </div>
                <Card>
                  <CardContent className="grid gap-6 p-5 sm:grid-cols-2 lg:grid-cols-3">
                    {release.features.length > 0 && <Section icon={Sparkles} label="New features" items={release.features} color="text-blue-500" />}
                    {release.improvements.length > 0 && <Section icon={ArrowRight} label="Improvements" items={release.improvements} color="text-emerald-500" />}
                    {release.bugfixes.length > 0 && <Section icon={Bug} label="Bug fixes" items={release.bugfixes} color="text-amber-500" />}
                    {release.knownIssues.length > 0 && <Section icon={AlertTriangle} label="Known issues" items={release.knownIssues} color="text-rose-500" />}
                    {release.upcoming.length > 0 && <Section icon={Lightbulb} label="Upcoming" items={release.upcoming} color="text-violet-500" />}
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Section({ icon: Icon, label, items, color }: { icon: typeof Sparkles; label: string; items: string[]; color: string }) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide">
        <Icon className={cn("h-3.5 w-3.5", color)} />
        <span className={color}>{label}</span>
      </div>
      <ul className="space-y-1">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground/40" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
