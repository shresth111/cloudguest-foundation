import { PortalErrorScreen } from "@/components/portal-runtime/PortalErrorScreen";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { RotateCcw } from "lucide-react";
import { PortalShell, PortalCard, PortalTextPlate } from "@/components/portal-runtime/PortalShell";
import { PG_PRIMARY_BTN } from "@/components/portal-runtime/PortalGuestUi";
import { GlyphNotListed } from "@/components/portal-runtime/PortalGlyphs";
import { usePortalRuntime } from "@/context/PortalRuntimeContext";
import { scriptClassOf } from "@/lib/portal-script";

export const Route = createFileRoute("/portal/not-listed")({
  errorComponent: PortalErrorScreen,
  component: NotListedPage,
});

/**
 * Whitelist-only refusal: this property admits only guests on its Always
 * Allowed list, and nothing on that list matches the detail this guest
 * just submitted.
 *
 * ## Why this is not another `/portal/closed`
 *
 * It shares that route's shell/plate/card shape, and stops there. Closed
 * is **pre-emptive**: `portal.index.tsx` reads `config.isOpenNow` and
 * routes before any form renders, so its guest is told "come back later"
 * having done nothing yet.
 *
 * This screen cannot work that way, and the backend makes that structural
 * rather than incidental. Whitelist-only mode is matched against a
 * *person* -- a phone number or an email -- and the platform does not know
 * who the guest is until they type it. On top of that,
 * `whitelist_only_enabled` is deliberately stripped from `GET
 * /captive-portal/resolve` (`ResolvedCaptivePortalConfigResponse` marks it
 * `exclude=True` and the router pops the key as a second guard), precisely
 * so the portal *cannot* announce the mode up front: it would tell anyone
 * who curls the endpoint which properties run closed, and tell a guest
 * nothing they can act on.
 *
 * So this guest arrives **after a submission**. They typed their number,
 * tapped a button, and waited. The copy is written for that: not "come
 * back later" but "the thing you just did did not work, here is why, and
 * it is not your fault" -- followed by the one action that actually helps,
 * which is a person at reception, not a control on this page.
 *
 * ## Two things this screen must never do
 *
 * 1. **Never render the matched rule's `reason`.** It is operator-authored
 *    and routinely says things like "ex-employee, do not readmit". The
 *    only free text here is `whitelistOnlyDeniedMessage`, a field an
 *    operator writes *for guests to read*, resolved independently from
 *    `/captive-portal/resolve` -- this route never touches `AppError
 *    .message`, so a blocklist reason has no path onto it even if the
 *    caller misrouted. See `src/lib/portal-whitelist-refusal.ts`.
 * 2. **No "request access" button.** Granting it needs a staff
 *    notification path that does not exist on either side, and a button
 *    that silently drops requests is worse than no button -- it converts
 *    "go and ask someone" into "wait for a reply that is never coming".
 */
function NotListedPage() {
  const { config, refusedContactKind, t } = usePortalRuntime();
  const navigate = useNavigate({ from: "/portal/not-listed" });

  // "number" / "email" -- see PortalRuntimeState.refusedContactKind for why
  // this is carried rather than inferred, and why phone is the fallback.
  const contact =
    refusedContactKind === "email" ? t("notListedContactEmail") : t("notListedContactPhone");
  const withContact = (key: string) => t(key).replace("{contact}", contact);

  // The venue's own words, when the operator has written any. Null/blank --
  // the normal state -- leaves this frontend's default copy in place, the
  // identical contract `businessHoursClosedMessage` has on /portal/closed.
  const venueMessage = config?.whitelistOnlyDeniedMessage?.trim() || null;

  const title = t("notListedTitle");
  const body = venueMessage ?? withContact("notListedBody");

  return (
    <PortalShell>
      <div className="flex flex-1 flex-col justify-center gap-5">
        {/* captive-portal-v7-design-spec.md §1.1 (L1) -- same plate contract
         * every state screen uses; see portal.closed.tsx's own comment for
         * why the wrapper <div> is this route's layout box and has to stay. */}
        <div className="mx-auto w-fit max-w-full text-center">
          <PortalTextPlate>
            {/* Muted disc, not the danger disc `/portal/failure` uses. The
             * semantic hue is the whole point: a refused guest is not an
             * error state and has not been blocked -- red would tell them
             * they did something wrong, which is the single thing this
             * screen exists to avoid saying. */}
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[color-mix(in_srgb,var(--pg-ink,#1E1B4B)_6%,var(--pg-surface,#fff))] text-[var(--pg-ink-muted)]">
              <GlyphNotListed className="h-8 w-8" />
            </div>
            <h1
              className="pg-subtitle mt-5 text-[var(--pg-ink)]"
              data-pg-script={scriptClassOf(title)}
            >
              {title}
            </h1>
          </PortalTextPlate>
        </div>

        <PortalCard className="text-center">
          {/* Either the venue's free text or the localized default -- both
           * can be long and in any script, so both get the script class. */}
          <p className="pg-body text-[var(--pg-ink-muted)]" data-pg-script={scriptClassOf(body)}>
            {body}
          </p>

          {/* The "go and ask reception" instruction is shown ONLY when the
           * operator has written nothing. When they have, their message IS
           * their instruction -- the backend's own examples are a hotel
           * saying "ask reception" and a corporate office saying "raise a
           * ticket with IT" -- and appending ours would contradict theirs
           * on exactly the sentence the guest is meant to act on. The
           * owner customises the instruction, not the whole screen: the
           * heading, the retry and the branding are unchanged either way. */}
          {!venueMessage && (
            <p className="mt-3 pg-meta text-[var(--pg-ink-muted)]">
              <span className="font-semibold text-[var(--pg-ink)]">
                {t("notListedNextStepLead")}
              </span>{" "}
              {withContact("notListedNextStep")}
            </p>
          )}
        </PortalCard>

        {/* A typo is the one thing the guest CAN fix alone, so it gets the
         * primary action -- and it is the only action on the page. Back to
         * `/portal/auth`, which redirects to the real sign-in card, the
         * same target `/portal/failure` retries to. `search: (prev) => prev`
         * preserves the org/location/router params every portal route
         * requires. */}
        <div className="text-center">
          <p className="pg-meta mb-2 text-[var(--pg-ink-faint)]">
            {withContact("notListedRetryPrompt")}
          </p>
          <button
            type="button"
            onClick={() => navigate({ to: "/portal/auth", search: (prev) => prev })}
            className={`${PG_PRIMARY_BTN} flex items-center justify-center gap-2`}
          >
            <RotateCcw className="h-4 w-4" /> {withContact("notListedRetry")}
          </button>
        </div>
      </div>
    </PortalShell>
  );
}
