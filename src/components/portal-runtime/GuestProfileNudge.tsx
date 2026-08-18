import { useState } from "react";
import { UserRound, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { PortalCard } from "@/components/portal-runtime/PortalShell";
import { PG_INPUT, PG_PRIMARY_BTN } from "@/components/portal-runtime/PortalGuestUi";
import { usePortalRuntime } from "@/context/PortalRuntimeContext";
import { portalRuntimeService } from "@/services/portal-runtime.service";
import { deviceProfilePromptDone, markProfilePromptDone } from "@/lib/portal-profile-prompt";
import type { RuntimeSession } from "@/types/portal-runtime";

/**
 * v4 UX §6.5: the post-OTP "tell us about yourself" prompt used to sit
 * *inside* the login funnel, between OTP verification and the real
 * hotspot-login handoff -- one more screen before a guest who just
 * proved their identity actually got online, breaking the "extras happen
 * after connect" pattern set-password/team-join already established (see
 * `portal.session.tsx`'s own comments on why both moved here). This is
 * that same optional capture, relocated: a dismissible nudge card on
 * `/portal/session`, gated the same way `showPasswordNudge` already is.
 *
 * Shown only for a guest who: signed in via a phone-based OTP channel
 * (SMS/WhatsApp -- an email-OTP guest already gave us their email; a
 * password/voucher guest already has an established identity), is a
 * genuinely new guest (`session.isNewGuest`), and hasn't already
 * filled this in or dismissed it on this device (see
 * `portal-profile-prompt.ts` for why that's a device-local flag, not a
 * backend-tracked field -- profile capture is optional/best-effort by
 * design, not an account property).
 */
export function GuestProfileNudge({ session }: { session: RuntimeSession }) {
  const { t } = usePortalRuntime();
  const [dismissed, setDismissed] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);

  const eligibleAuthMethod =
    session.authMethod === "otp_sms" || session.authMethod === "otp_whatsapp";
  const eligible = eligibleAuthMethod && session.isNewGuest && !deviceProfilePromptDone();

  if (!eligible || dismissed) return null;

  const finish = () => {
    markProfilePromptDone();
    setDismissed(true);
  };

  const onSave = async () => {
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    if (!trimmedName && !trimmedEmail) {
      finish();
      return;
    }
    setSaving(true);
    try {
      await portalRuntimeService.updateGuestProfile({
        guestId: session.guestId,
        sessionId: session.sessionId,
        displayName: trimmedName || undefined,
        email: trimmedEmail || undefined,
      });
    } catch {
      // Never blocks -- the guest already has a real, active session at
      // this point (this is a courtesy detail, not a login step), so a
      // failure here just dismisses silently, same as skip.
    } finally {
      setSaving(false);
      finish();
    }
  };

  return (
    <PortalCard className="relative space-y-3">
      <button
        type="button"
        onClick={finish}
        aria-label={t("skipForNow")}
        className="absolute right-3 top-3 rounded-full p-1 text-[var(--pg-ink-faint)] hover:bg-slate-100 hover:text-[var(--pg-ink-muted)]"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex items-center gap-3 pr-6">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
          <UserRound className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-800">{t("profileNudgeTitle")}</p>
          <p className="truncate text-xs text-slate-500">{t("profileNudgeSubtitle")}</p>
        </div>
      </div>
      <div>
        <label className="text-xs font-semibold text-slate-500">{t("nameLabel")}</label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Jane Doe"
          className={PG_INPUT}
        />
      </div>
      <div>
        <label className="text-xs font-semibold text-slate-500">{t("emailAddress")}</label>
        <Input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          placeholder="you@example.com"
          className={PG_INPUT}
        />
      </div>
      <button type="button" onClick={onSave} disabled={saving} className={PG_PRIMARY_BTN}>
        {saving ? t("savingLabel") : t("continueCta")}
      </button>
    </PortalCard>
  );
}
