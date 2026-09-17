import { useId } from "react";
import { usePortalRuntime } from "@/context/PortalRuntimeContext";
import type { UseGuestSignInReturn } from "./useGuestSignIn";

/**
 * "Which group do you belong to?" -- the venue's guest-team picker.
 *
 * It used to live inside `OtpForm` alone, so a guest signing in on the
 * password tab never saw it: the first time they were asked about a group was
 * after they were already connected, which reads as the portal asking a
 * question it should have asked up front. Every credential form now renders
 * this same picker, so the question is asked once, at sign-in, whichever
 * method the guest uses.
 *
 * Shown only when the venue has a guest team (Devices & Team -> Guest Groups)
 * that is actually joinable right now (active, not full). The selection is
 * carried through the login and joined automatically once the guest is
 * verified -- see `useGuestSignIn`'s `joinPickedTeam`. An optional, honest
 * extra field: guests who are not part of a team leave it on the default.
 */
export function GuestGroupPicker(sign: UseGuestSignInReturn) {
  const { t } = usePortalRuntime();
  // The admin Portal Preview mounts a second live copy of the whole shell, so
  // a fixed id here would be duplicated on that page and the `<label>` could
  // bind to the other copy's select. Same reason PasswordSignInForm uses it.
  const selectId = `${useId()}-guest-team`;
  if (sign.openTeams.length === 0) return null;
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={selectId}
        className="block text-[length:calc(0.8125rem*var(--pg-type-scale,1))] font-medium text-[var(--pg-ink)]"
      >
        {t("groupPickerLabel")}
      </label>
      <select
        id={selectId}
        value={sign.selectedTeamCode}
        onChange={(e) => sign.setSelectedTeamCode(e.target.value)}
        className="w-full rounded-xl border border-[var(--pg-border)] bg-[var(--pg-surface)] px-3 py-2.5 text-[length:calc(0.9375rem*var(--pg-type-scale,1))] text-[var(--pg-ink)] outline-none transition-[border-color,box-shadow] focus:border-[var(--pr-primary,#6366f1)] focus:ring-4 focus:ring-[var(--pr-primary,#6366f1)]/15"
      >
        <option value="">{t("groupNoneOption")}</option>
        {sign.openTeams.map((team) => (
          <option key={team.id} value={team.teamCode}>
            {team.name}
          </option>
        ))}
      </select>
    </div>
  );
}
