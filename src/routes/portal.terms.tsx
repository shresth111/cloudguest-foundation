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
 *
 * Content precedence: a venue (organization/location) can publish its own
 * terms/privacy copy or an external URL via `RuntimePortalConfig`
 * (`termsAndConditionsText`/`Url`, `privacyPolicyText`/`Url` -- set per
 * org, see src/services/portal-runtime.service.ts). When present, that
 * org-supplied content always wins and is rendered as-is below -- this
 * page never overrides a venue's own published terms. DEFAULT_SECTIONS
 * only fills in for the (common, e.g. a freshly onboarded venue) case
 * where a venue hasn't published anything of its own yet, so a guest
 * never lands on a blank/one-line placeholder.
 *
 * DEFAULT_SECTIONS content note: drafted to reflect what this platform
 * actually does (see app.domains.guest.models in the backend -- Guest/
 * GuestDevice/GuestSession/GuestQuotaUsage/GuestConsent) rather than
 * generic boilerplate: identifier-based OTP/password/voucher sign-in,
 * MAC/IP + session duration + data-volume capture for bandwidth/fair-use
 * enforcement, returning-guest recognition across visits, and the venue
 * (not this platform) as the operator of its own network. THIS IS A
 * DRAFT, NOT LEGAL ADVICE -- see PR description; a business owner using
 * this as their real default should have it reviewed by actual legal
 * counsel before relying on it, especially for jurisdiction-specific
 * obligations (GDPR, India's DPDP Act, US state laws, etc.) a generic
 * default can't fully cover.
 */
const DEFAULT_SECTIONS: {
  title: string;
  groups: { heading: string; body: string }[];
}[] = [
  {
    title: "Terms of service",
    groups: [
      {
        heading: "Using this network",
        body: "This complimentary WiFi is provided by the venue you're connecting at, running on the Wyfy Guest platform. By signing in, you agree to use it lawfully and responsibly, and not to interfere with the network or other guests' use of it.",
      },
      {
        heading: "Acceptable use",
        body: "No illegal activity, no attempts to disrupt or gain unauthorized access to the network or other devices on it, and no abusive use (spam, malware distribution, excessive automated traffic). The venue may restrict, throttle, or end a guest's access at any time to protect the network.",
      },
      {
        heading: "No guaranteed uptime",
        body: "This network is offered as a convenience, as-is, with no guarantee of uninterrupted, secure, or error-free access. Speed and data may be limited by the venue's fair-use policy. Neither the venue nor Wyfy Guest is liable for losses arising from your use of, or inability to use, this network, to the extent permitted by law. You're responsible for your own device's security.",
      },
    ],
  },
  {
    title: "Privacy policy",
    groups: [
      {
        heading: "What we collect",
        body: "The identifier you sign in with (phone number or email for OTP, or a voucher code), your device's MAC address and IP address, and session details (connect/disconnect times and data used) needed to grant and manage access.",
      },
      {
        heading: "Why we collect it",
        body: "To verify it's really you signing in, apply the venue's fair-use data and speed limits, keep the network secure and recognize your device on return visits so reconnecting is faster.",
      },
      {
        heading: "Who's responsible for it",
        body: "The venue you're connecting at is the operator of this guest WiFi network and controls this data for its own location. Wyfy Guest is the software platform the venue runs on and does not sell guest data to third parties. Front-desk staff see a masked version of your contact details by default.",
      },
      {
        heading: "How long it's kept",
        body: "Session and device details are kept to recognize you as a returning guest and for the venue's own network security and records; they're not deleted the moment you disconnect. Depending on where you are, additional rights may apply under local law (e.g. GDPR in the EU, India's DPDP Act) -- ask venue staff to access or delete your data.",
      },
    ],
  },
];

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
          {sections.length === 0
            ? DEFAULT_SECTIONS.map((s) => (
                <PortalCard key={s.title} variant="light">
                  <p className="text-sm font-semibold text-slate-900">{s.title}</p>
                  <div className="mt-2 space-y-3">
                    {s.groups.map((g) => (
                      <div key={g.heading}>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                          {g.heading}
                        </p>
                        <p className="mt-1 text-sm leading-relaxed text-slate-500">{g.body}</p>
                      </div>
                    ))}
                  </div>
                </PortalCard>
              ))
            : sections.map((s) => (
                <PortalCard key={s.title} variant="light">
                  <p className="text-sm font-semibold text-slate-900">{s.title}</p>
                  {s.text && (
                    <p className="mt-2 text-sm leading-relaxed text-slate-500">{s.text}</p>
                  )}
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
              ))}
        </div>
        <p className="text-center text-xs text-slate-400">
          Questions about this network or your data? Ask venue staff.
        </p>
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
