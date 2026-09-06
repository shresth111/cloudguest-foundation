import { PortalErrorScreen } from "@/components/portal-runtime/PortalErrorScreen";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ShieldCheck, Lock, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  PortalShell,
  PortalCard,
  GUEST_LEGIBILITY_CARD_CLASS,
  PortalTextPlate,
} from "@/components/portal-runtime/PortalShell";
import { usePortalRuntime } from "@/context/PortalRuntimeContext";

/** Which of the two sections this page ever renders gets which mark --
 * keyed on the section's own (English, not yet i18n-wired -- pre-existing,
 * unrelated to this pass) title string, not on position, so the org-
 * supplied branch and DEFAULT_SECTIONS stay in sync automatically. A
 * violet icon badge distinguishes "rules of the road" from "what happens
 * to your data" at a glance, on what was previously two visually
 * identical white cards a guest had to actually read the heading of to
 * tell apart. */
const SECTION_ICONS: Record<string, LucideIcon> = {
  "Terms of service": ShieldCheck,
  "Privacy policy": Lock,
};

function SectionCardTitle({ title }: { title: string }) {
  const Icon = SECTION_ICONS[title];
  return (
    <div className="-mx-4 -mt-4 mb-3 flex items-center gap-2.5 border-b border-[var(--pg-border)] px-4 pb-3 pt-4">
      {Icon && (
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--pg-brand-accent)]/10 text-[var(--pg-brand-accent)]">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
      )}
      <p className="pg-body font-semibold text-[var(--pg-ink)]">{title}</p>
    </div>
  );
}

export const Route = createFileRoute("/portal/terms")({
  errorComponent: PortalErrorScreen,
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
  const hasPhoto = !!config?.backgroundImageUrl;

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
        {/* captive-portal-v7-design-spec.md §1.1 (L1). This route is the
         * one the spec's "bare `<div className="text-center">` outside
         * PortalCard" description does NOT fit: it is a long prose
         * document, and every section heading and every paragraph of that
         * prose already sits inside an opaque `<PortalCard>`. So there is
         * no "plate per heading" to add here, and a plate around the prose
         * column would be the single worst place in the product to put one
         * -- this is the tallest scrolling route, so a column-wide backing
         * would cover essentially the whole photo at full document height,
         * which is exactly PR #81's shipped-and-reverted regression (§0.1
         * item 1). Only three things on this page are actually set on bare
         * photo: this back link, the page <h1>, and the two trailing lines
         * below the cards. Each of those -- and nothing else -- gets its
         * own bounded plate. */}
        {/* Hand-written rather than `PortalTextPlate shape="pill"` for the
         * same reason as the other two back links (see portal.verify.tsx):
         * the plate classes sit on the anchor, so the padding is part of
         * the tap target, and the component wraps rather than decorates. */}
        <Link
          to="/portal/welcome"
          from="/portal/terms"
          search={(prev) => prev}
          className={cn(
            "inline-flex w-fit items-center gap-1.5 pg-meta font-medium text-[var(--pg-ink-muted)] hover:text-[var(--pr-primary,#6366f1)]",
            hasPhoto && cn(GUEST_LEGIBILITY_CARD_CLASS, "rounded-full px-3.5 py-1.5"),
          )}
        >
          <ArrowLeft className="h-4 w-4" /> {t("backLabel")}
        </Link>
        {/* `w-fit` with no `mx-auto`: this heading is left-aligned today
         * and stays left-aligned -- the plate hugs the title, it does not
         * re-center it. That is also why this one is not `PortalTextPlate`:
         * the component hardcodes `mx-auto`, `text-center` and `p-5`, and
         * this heading wants none of the three (start-aligned, `px-5 py-3`).
         * Three simultaneous overrides fighting the component's own
         * opinions is worse than one honest hand-written plate. */}
        <h1
          className={cn(
            "pg-subtitle w-fit max-w-full text-[var(--pg-ink)]",
            hasPhoto && cn("px-5 py-3", GUEST_LEGIBILITY_CARD_CLASS),
          )}
        >
          {t("termsTitle")}
        </h1>
        <div className="space-y-3">
          {sections.length === 0
            ? DEFAULT_SECTIONS.map((s) => (
                <PortalCard key={s.title}>
                  <SectionCardTitle title={s.title} />
                  <div className="space-y-3">
                    {s.groups.map((g) => (
                      <div key={g.heading}>
                        {/* pg-micro/ink-faint, not slate-400 (2.56:1 --
                         * failed everywhere); hierarchy below muted comes
                         * from size, not lightness. */}
                        <p className="pg-micro uppercase tracking-[0.08em] text-[var(--pg-ink-faint)]">
                          {g.heading}
                        </p>
                        <p className="mt-1 pg-meta font-normal leading-relaxed text-[var(--pg-ink-muted)]">
                          {g.body}
                        </p>
                      </div>
                    ))}
                  </div>
                </PortalCard>
              ))
            : sections.map((s) => (
                <PortalCard key={s.title}>
                  <SectionCardTitle title={s.title} />
                  {s.text && (
                    // `whitespace-pre-line`: org-supplied prose may carry
                    // the admin's own paragraph breaks -- render them
                    // instead of collapsing the document to one block.
                    <p className="whitespace-pre-line pg-meta font-normal leading-relaxed text-[var(--pg-ink-muted)]">
                      {s.text}
                    </p>
                  )}
                  {s.url && (
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex min-h-6 items-center pg-meta font-medium text-[var(--pr-primary,#6366f1)] underline underline-offset-2 hover:opacity-80"
                    >
                      {t("termsReadFullDocument")}
                    </a>
                  )}
                </PortalCard>
              ))}
        </div>
        {/* The page's two trailing lines are the last text on this route
         * still set on bare photo. One shared plate rather than two
         * separate ones -- they read as a single closing block, and two
         * stacked one-line plates 20px apart would be visual noise. The
         * inner `gap-5` + the link's existing `mt-1` reproduce exactly the
         * 24px that the parent column's `gap-5` gave these two before they
         * became one flex item. */}
        <div className="mx-auto flex w-fit max-w-full flex-col gap-5 text-center">
          <PortalTextPlate className="flex flex-col gap-5">
            {/* `--pg-ink-faint` (#505E73), not `text-slate-400` (#94A3B8). On
             * this plate's own worst composite #94A3B8 is 1.81:1 -- the exact
             * figure v7 §1.1 L4 records for the footer -- and #505E73 is 4.65:1.
             * Both computed, both reproducing styles.css's own derivation. */}
            <p className="pg-micro font-normal text-[var(--pg-ink-faint)]">
              {t("termsQuestionsAskStaff")}
            </p>
            <Link
              to="/portal/welcome"
              search={portalSearch}
              className="mt-1 inline-flex min-h-6 items-center justify-center pg-meta font-medium text-[var(--pg-ink-muted)] underline-offset-2 hover:text-[var(--pr-primary,#6366f1)] hover:underline"
            >
              {t("termsBackToSignIn")}
            </Link>
          </PortalTextPlate>
        </div>
      </div>
    </PortalShell>
  );
}
