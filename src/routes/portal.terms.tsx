import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { PortalShell, PortalCard } from "@/components/portal-runtime/PortalShell";
import { usePortalRuntime } from "@/context/PortalRuntimeContext";

export const Route = createFileRoute("/portal/terms")({
  component: TermsPage,
});

/**
 * The one page every light-variant guest screen's footer links to (see
 * PortalShell's own "Terms & Privacy" footer link, present on welcome/
 * success/expired/auth-method) -- previously still the old dark "glass on
 * navy" look this whole redesign moved away from everywhere else, so a
 * guest clicking that footer link from the (light) sign-in card landed on
 * a visually unrelated page mid-flow. Same light shell, same card/heading/
 * link treatment as the rest of the redesigned flow now.
 */
function TermsPage() {
  const { config, t, organizationId, locationId, routerId } = usePortalRuntime();
  const portalSearch = { organizationId, locationId, routerId };

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
    <PortalShell variant="light" showHeader={false}>
      <div className="flex flex-1 flex-col gap-5">
        <Link
          to="/portal/welcome"
          from="/portal/terms"
          search={(prev) => prev}
          className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-indigo-600"
        >
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" /> Back
        </Link>
        <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900">
          {t("termsTitle")}
        </h1>
        <div className="space-y-3">
          {sections.length === 0 ? (
            <PortalCard variant="light">
              <p className="text-sm text-slate-500">
                This venue hasn't published specific terms. By connecting you agree to reasonable,
                lawful use of this network.
              </p>
            </PortalCard>
          ) : (
            sections.map((s) => (
              <PortalCard key={s.title} variant="light">
                <p className="text-sm font-semibold text-slate-900">{s.title}</p>
                {s.text && <p className="mt-2 text-sm leading-relaxed text-slate-500">{s.text}</p>}
                {s.url && (
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-block text-sm font-medium text-indigo-600 underline underline-offset-2 hover:text-indigo-700"
                  >
                    Read the full document
                  </a>
                )}
              </PortalCard>
            ))
          )}
        </div>
        <Link
          to="/portal/welcome"
          search={portalSearch}
          className="mt-1 text-center text-xs font-medium text-slate-500 hover:text-indigo-600 hover:underline"
        >
          Back to sign in
        </Link>
      </div>
    </PortalShell>
  );
}
