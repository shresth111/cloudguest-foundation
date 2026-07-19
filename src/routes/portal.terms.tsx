import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { PortalShell, PortalCard } from "@/components/portal-runtime/PortalShell";
import { usePortalRuntime } from "@/context/PortalRuntimeContext";

export const Route = createFileRoute("/portal/terms")({
  component: TermsPage,
});

const SECTIONS = [
  {
    title: "Terms of service",
    body: "By connecting to this WiFi network you agree to fair use, no illegal activity, and reasonable bandwidth limits set by the venue.",
  },
  {
    title: "Privacy policy",
    body: "We collect the minimum data required to authenticate you: device identifier, session times, and volume of data used. We do not sell your personal data.",
  },
  {
    title: "Cookie policy",
    body: "This portal uses local storage to remember your preferences (language, accessibility). No third-party tracking cookies are used.",
  },
];

function TermsPage() {
  const { t } = usePortalRuntime();
  return (
    <PortalShell>
      <div className="flex flex-1 flex-col gap-5">
        <Link to="/portal/welcome" className="inline-flex w-fit items-center gap-1.5 text-sm text-white/70 hover:text-white">
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" /> Back
        </Link>
        <h1 className="text-2xl font-semibold">{t("termsTitle")}</h1>
        <div className="space-y-3">
          {SECTIONS.map((s) => (
            <PortalCard key={s.title}>
              <p className="text-sm font-semibold">{s.title}</p>
              <p className="mt-2 text-sm text-white/70">{s.body}</p>
            </PortalCard>
          ))}
        </div>
      </div>
    </PortalShell>
  );
}
