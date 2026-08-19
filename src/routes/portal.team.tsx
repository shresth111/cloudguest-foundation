import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Users2, Loader2, CheckCircle2 } from "lucide-react";
import { PortalShell, PortalCard, PortalTextPlate } from "@/components/portal-runtime/PortalShell";
import { AlertBanner, PG_INPUT, PG_PRIMARY_BTN } from "@/components/portal-runtime/PortalGuestUi";
import { Input } from "@/components/ui/input";
import { usePortalRuntime } from "@/context/PortalRuntimeContext";
import { portalRuntimeService } from "@/services/portal-runtime.service";
import { friendlyGuestAuthError } from "@/lib/portal-guest-errors";
import type { AppError } from "@/services/api";

export const Route = createFileRoute("/portal/team")({
  component: TeamJoinPage,
});

/**
 * Optional "join a team with a code" step -- reached only via the real
 * "Have a team code?" nudge on portal.session.tsx (never inserted into the
 * login funnel itself, never forced).
 *
 * Design decision -- ADDITIONAL step after a real login, not a login
 * method of its own, and definitely not a RADIUS/MAC-whitelist bypass.
 * Verified directly against the actual code, not assumed:
 *
 * - `POST /guest-teams/join` (`GuestTeamService.join_team`) calls
 *   `GuestService.get_or_create_device`, which writes a `GuestDevice` row
 *   (`app.domains.guest.models`). That is a *different table* from
 *   `app.domains.mac_authorization.models.MacAuthorizationEntry`, the only
 *   table `RadiusService.authorize`'s MAC-whitelist bypass
 *   (`GuestService.login_via_mac_whitelist`) ever reads. Joining a team
 *   never writes a whitelist entry, so it can never grant RADIUS-authorized
 *   internet access on its own -- there is no shared code path at all
 *   between the two, confirmed by reading both modules' models directly.
 * - `join_team` never creates a `GuestSession` either -- it only creates/
 *   reuses a guest identity, registers a device, and inserts a
 *   `GuestTeamMember` row. Without an active `GuestSession`, `RadiusService
 *   .authorize`'s username-to-session lookup has nothing to find, so a
 *   team join alone cannot get a guest online.
 * - GuestTeamManagement.tsx's own admin-facing copy describes a team as
 *   "Shared-code groups guests join with a team code -- optional pooled
 *   data quota and member caps" -- a grouping/quota-sharing construct
 *   layered on top of an *already-connected* guest, unlike a voucher code
 *   (`login_via_voucher`), which genuinely does authenticate a fresh
 *   connection by itself.
 *
 * So this page requires a real, already-active `session` (guarded below,
 * same pattern as portal.set-password.tsx) and calls `join_team` with the
 * exact `guestIdentifier`/`deviceMac` that session's own login already
 * established -- never a second identity-proving step. Nothing here (or
 * anything it calls) touches RadiusService, radius_authorize/
 * radius_accounting, or portal.success.tsx's hotspot-login POST.
 *
 * No `captive_portal_configs` flag gates this (unlike
 * `voucher_enabled`/`otp_sms_enabled`/etc, each of which gates a real
 * *login method*): an invalid/unrelated team code simply 404s via
 * `GuestTeamNotFoundError` on its own, so a per-location toggle would only
 * add a way to hide an already-self-gating, harmless optional link -- not
 * worth a backend migration for a card a guest with no code can just skip.
 */
function TeamJoinPage() {
  const { session, guestIdentifier, deviceMac, t } = usePortalRuntime();
  const navigate = useNavigate({ from: "/portal/team" });

  useEffect(() => {
    // No real, already-verified identity to attach a team membership to
    // (e.g. a guest navigated here directly, or refreshed and lost
    // context) -- send them back into the real login flow first.
    if (!session || !guestIdentifier) {
      navigate({ to: "/portal/auth", replace: true, search: (prev) => prev });
    }
  }, [session, guestIdentifier, navigate]);

  const [teamCode, setTeamCode] = useState("");
  const [joined, setJoined] = useState<{ alreadyMember: boolean } | null>(null);

  const join = useMutation<{ isNewMembership: boolean }, AppError>({
    mutationFn: () =>
      portalRuntimeService.joinTeam({
        teamCode: teamCode.trim(),
        identifier: guestIdentifier ?? "",
        deviceMac,
      }),
    onSuccess: (result) => setJoined({ alreadyMember: !result.isNewMembership }),
  });

  // Team-join never touches RadiusService/GuestSession (see this file's
  // own docstring) -- there's no real hotspot-login POST to redo, so this
  // returns straight to /portal/session (the real resting page this nudge
  // now lives on), not back through the transitional /portal/success.
  const backToSession = () => navigate({ to: "/portal/session", search: (prev) => prev });

  if (!session || !guestIdentifier) return null;

  return (
    <PortalShell>
      <div className="flex flex-1 flex-col gap-5">
        {/* captive-portal-v7-design-spec.md §1.1 (L1). The plate is
         * `PortalTextPlate` -- the one seam that owns "is there a photo",
         * the bounded `w-fit` sizing that is deliberately NOT a wash over
         * the whole content column (§0.1 item 1's twice-shipped mistake),
         * and §1.4 C5's refusal rule. Its own doc comment carries the
         * reasoning this used to copy per route.
         *
         * The wrapper `<div>` is this route's layout box, not the plate,
         * and has to stay: with no photo the plate renders its children
         * bare, so without this box they would drop straight into the
         * column's `gap-5` and lose `text-center`. */}
        <div className="mx-auto w-fit max-w-full text-center">
          <PortalTextPlate>
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-indigo-50 text-indigo-600">
              <Users2 className="h-6 w-6" />
            </div>
            <h1 className="pg-subtitle mt-4 text-[var(--pg-ink)]">{t("teamPageTitle")}</h1>
            {/* `--pg-ink-muted`, not the hardcoded `text-slate-500` it replaces: v7
             * §1.5 retuned that token #64748B -> #475569, and a slate class does
             * not follow it. 3.36:1 -> 5.36:1 against this plate's own worst
             * composite (`--pg-surface` at 85% over a near-black photo region);
             * full derivation in styles.css's own `--pg-ink-muted` note. Backing
             * the block and leaving its subtitle at 3.36:1 would only have half-
             * fixed L1, whose own wording is "an unbacked <h1> *and subtitle*". */}
            <p className="mt-1 text-sm text-[var(--pg-ink-muted)]">{t("teamPageSubtitle")}</p>
          </PortalTextPlate>
        </div>

        <PortalCard>
          {joined ? (
            <div className="flex flex-col items-center gap-3 py-2 text-center">
              <CheckCircle2 className="h-10 w-10 text-emerald-500" />
              <p className="text-sm font-semibold text-slate-800">
                {joined.alreadyMember ? t("teamAlreadyJoined") : t("teamJoined")}
              </p>
              <p className="text-xs text-slate-500">{t("teamJoinedHelper")}</p>
              <button type="button" onClick={backToSession} className={PG_PRIMARY_BTN}>
                {t("backToConnection")}
              </button>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (teamCode.trim() && !join.isPending) join.mutate();
              }}
              className="space-y-3"
            >
              <label className="text-xs font-semibold text-slate-500">{t("teamCodeLabel")}</label>
              <Input
                value={teamCode}
                onChange={(e) => setTeamCode(e.target.value.toUpperCase())}
                placeholder={t("teamCodePlaceholder")}
                maxLength={32}
                autoFocus
                autoCapitalize="characters"
                autoComplete="off"
                className={PG_INPUT}
              />
              <AlertBanner
                message={join.error ? friendlyGuestAuthError(join.error, "team_join") : null}
              />
              <button
                type="submit"
                disabled={join.isPending || !teamCode.trim()}
                className={PG_PRIMARY_BTN}
              >
                {join.isPending ? (
                  <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                ) : (
                  t("joinTeam")
                )}
              </button>
              <button
                type="button"
                onClick={backToSession}
                disabled={join.isPending}
                className="h-11 w-full rounded-[14px] text-sm font-semibold text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
              >
                {t("skipForNow")}
              </button>
            </form>
          )}
        </PortalCard>
      </div>
    </PortalShell>
  );
}
