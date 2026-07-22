import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { PortalShell, PortalCard } from "@/components/portal-runtime/PortalShell";
import { usePortalRuntime } from "@/context/PortalRuntimeContext";

export const Route = createFileRoute("/portal/terms")({
  component: TermsPage,
});

function TermsPage() {
  const { config, t } = usePortalRuntime();

  const sections = [
    config?.termsAndConditionsText || config?.termsAndConditionsUrl
      ? {
          title: "Terms of service",
          text: config.termsAndConditionsText,
          url: config.termsAndConditionsUrl,
        }
      : null,
    config?.privacyPolicyText || config?.privacyPolicyUrl
      ? { title: "Privacy policy", text: config.privacyPolicyText, url: config.privacyPolicyUrl }
      : null,
  ].filter((s): s is { title: string; text: string | null; url: string | null } => s !== null);

  return (
    <PortalShell>
      <div className="flex flex-1 flex-col gap-5">
        <Link
          to="/portal/welcome"
          from="/portal/terms"
          search={(prev) => prev}
          className="inline-flex w-fit items-center gap-1.5 text-sm text-white/70 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" /> Back
        </Link>
        <h1 className="text-2xl font-semibold">{t("termsTitle")}</h1>
        <div className="space-y-3">
          {sections.length === 0 ? (
            <PortalCard>
              <p className="text-sm text-white/70">
                This venue hasn't published specific terms. By connecting you agree to reasonable,
                lawful use of this network.
              </p>
            </PortalCard>
          ) : (
            sections.map((s) => (
              <PortalCard key={s.title}>
                <p className="text-sm font-semibold">{s.title}</p>
                {s.text && <p className="mt-2 text-sm text-white/70">{s.text}</p>}
                {s.url && (
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-block text-sm text-white underline underline-offset-2"
                  >
                    Read the full document
                  </a>
                )}
              </PortalCard>
            ))
          )}
        </div>
      </div>
    </PortalShell>
  );
}
