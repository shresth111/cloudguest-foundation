/**
 * The four things a venue admin can do to ONE guest's device, on the venue's
 * own controller, from the guest panel in Guests.
 *
 * WHY THIS IS THE ONLY SCREEN THAT CARRIES THEM
 * ---------------------------------------------
 * Every one of the backend's per-client routes is keyed on a MAC, and this is
 * the only customer screen where a MAC is on the page. Blocked Guests blocks a
 * phone number; Guest WiFi Limits and Access Tiers describe a policy that
 * applies to whoever signs in next. None of those three knows which device it
 * is talking about, and inventing one would be the worst kind of guess.
 *
 * A MIKROTIK VENUE NEVER SEES THIS PANEL AT ALL. `controllerManaged` is false
 * there -- `every`, not `some`, so a mixed venue and an unreadable venue are
 * false too -- and the first line of the component returns null. No request is
 * made, no capability is read, and the Guests screen is byte-identical to what
 * it was. `scripts/test-omada-client-actions.mjs` asserts that positively.
 *
 * ONE CAPABILITY PER BUTTON, AND THE BACKEND'S OWN SENTENCE BESIDE IT
 * ------------------------------------------------------------------
 * Block, unblock, set speed and clear speed are four separate declarations in
 * `GET .../clients/capabilities`, and each button reads only its own. Where
 * one says no, the button is genuinely disabled and the backend's `reason` is
 * rendered VERBATIM next to it -- that sentence names the credential and the
 * exact place in the controller's settings to add it, which nothing written
 * here could keep true for as long.
 *
 * THERE IS NO "BLOCKED DEVICES" LIST, AND THERE MUST NOT BE.
 * `list_blocked` is declared unsupported on every auth mode: the block flag is
 * not readable through the connection this platform holds, and an empty list
 * would be this product asserting that the venue has blocked nobody. The
 * blocklist a venue can actually read is Blocked Guests, which is ours.
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Ban, Gauge, ShieldCheck } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ControllerControlNotice } from "@/components/customer/ControllerControlNotice";
import i18n from "@/lib/i18n";
import {
  clientActionMessage,
  rateLabel,
  type ClientActionFacts,
} from "@/lib/omada-client-controls";
import { useClientControls, useDeviceActions } from "@/hooks/useClientControls";
import { queueService } from "@/services/queue.service";
import type { AppError } from "@/services/api";

/** A MAC we could actually send. The Guests table writes the literal string
 * "Unknown" into this field when the session carries no device address, and
 * the backend's own floor is 12 characters -- so an unknown device disables
 * every button here rather than posting a word to a controller. */
export function isSendableMac(mac: string | null | undefined): boolean {
  const value = (mac ?? "").trim();
  return value.length >= 12 && value.length <= 32 && value.toLowerCase() !== "unknown";
}

export function GuestDeviceControls({ mac, guestName }: { mac: string; guestName: string }) {
  const { t } = useTranslation("guests", { i18n });
  const controls = useClientControls();
  const actions = useDeviceActions();
  const [profileId, setProfileId] = useState<string>("");

  const blockVerdict = controls.deviceVerdict("block");
  const unblockVerdict = controls.deviceVerdict("unblock");
  const speedVerdict = controls.deviceVerdict("speed");
  const clearVerdict = controls.deviceVerdict("speed-clear");

  // Only where the venue can actually apply one, and only when the panel is on
  // screen: a venue that cannot set a speed has no use for the list, and a
  // MikroTik venue never reaches this component at all.
  const { data: profiles } = useQuery({
    queryKey: ["customer", "queue-profiles"],
    queryFn: () => queueService.listProfilesForVenue(),
    enabled: speedVerdict.availability !== "unavailable",
    staleTime: 5 * 60_000,
  });

  // A MikroTik venue, a mixed venue, and a venue whose routers could not be
  // read: all three keep the Guests screen exactly as it is today.
  if (!controls.controllerManaged) return null;

  const macUsable = isSendableMac(mac);
  const busy = actions.pending;

  const report = (facts: ClientActionFacts) => {
    const message = clientActionMessage(facts);
    if (message.tone === "success") toast.success(message.text);
    else toast.warning(message.text);
  };
  const fail = (error: unknown) =>
    toast.error((error as AppError)?.message || t("deviceActionError"));

  const run = (job: () => Promise<ClientActionFacts>) => {
    job().then(report).catch(fail);
  };

  const selectedProfile = (profiles ?? []).find((p) => p.id === profileId) ?? null;

  return (
    <div className="rounded-xl border p-3" data-testid="guest-device-controls">
      <p className="text-[11px] font-medium text-muted-foreground">{t("deviceControlsTitle")}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {t("deviceControlsSubtitle", { name: guestName })}
      </p>

      {!macUsable && (
        <p role="note" className="mt-2 text-xs text-muted-foreground">
          {t("deviceControlsNoMac")}
        </p>
      )}

      {/* ── keep this device off the network ────────────────────── */}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          className="text-destructive disabled:text-muted-foreground"
          disabled={busy || !macUsable || blockVerdict.availability === "unavailable"}
          onClick={() => run(() => actions.block(mac))}
        >
          <Ban className="mr-2 h-3.5 w-3.5" />
          {t("blockDevice")}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={busy || !macUsable || unblockVerdict.availability === "unavailable"}
          onClick={() => run(() => actions.unblock(mac))}
        >
          <ShieldCheck className="mr-2 h-3.5 w-3.5" />
          {t("unblockDevice")}
        </Button>
      </div>
      {/* THE TWO UNDO BUTTONS STAY LIVE, AND SAY WHAT HAPPENS WHEN THERE IS
        NOTHING TO UNDO. The sentence itself is at the foot of this panel,
        where it sits under both of them.

        QA found "Allow device" and "Remove limit" enabled for a device that
        was never blocked, never limited and is offline, and asked whether to
        disable them. Disabling them is the option that looks tidy and is the
        dishonest one: it would require this screen to know that the device is
        not blocked and not capped, and it cannot. `list_blocked` is declared
        `supported: false` on every auth mode -- the controller publishes no
        readable list of blocked clients (CAPABILITY-MATRIX §10.8) -- and
        nothing here reads a client's stored `rateLimit` either. A greyed-out
        "Allow device" would therefore be this product asserting "this device
        is not blocked" on no evidence, which is the same defect as an empty
        blocklist claiming nobody is blocked.

        It also has a real cost: a device CAN be blocked outside this panel
        (another admin, the controller's own UI), and the only control that
        releases it would be the one we had disabled.

        So they stay live and the outcome is named up front. `OMADA_CLIENT_NOT_FOUND`
        is already a distinct backend outcome for exactly this case, so acting
        on a device the controller has no record of is answered honestly
        rather than silently -- nothing is sent blind and nothing is
        invented. */}
      <ControllerControlNotice verdict={blockVerdict} />
      {/* Only when it says something the block notice has not already said. */}
      {unblockVerdict.availability === "unavailable" &&
        unblockVerdict.reason !== blockVerdict.reason && (
          <ControllerControlNotice verdict={unblockVerdict} />
        )}

      {/* ── this device's speed ─────────────────────────────────── */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Gauge className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
        <Select
          value={profileId}
          onValueChange={setProfileId}
          disabled={busy || !macUsable || speedVerdict.availability === "unavailable"}
        >
          <SelectTrigger className="h-8 w-56 text-xs" aria-label={t("deviceSpeedProfile")}>
            <SelectValue placeholder={t("deviceSpeedProfilePlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            {(profiles ?? []).map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {/* The profile's own name and its own numbers. Nothing here
                    recomputes a rate: the id is what goes to the backend and
                    the backend reads the rates off the profile. */}
                {p.name} — {rateLabel(p.downloadRateKbps)} / {rateLabel(p.uploadRateKbps)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          variant="outline"
          disabled={
            busy || !macUsable || speedVerdict.availability === "unavailable" || !selectedProfile
          }
          onClick={() => {
            if (!selectedProfile) return;
            // The PROFILE, not its numbers. The backend reads the rates from
            // the profile inside the caller's own organization scope, so a
            // profile that is not this tenant's is refused by the domain that
            // owns the model rather than by a second copy of the rule here.
            run(() => actions.setSpeed(mac, { queueProfileId: selectedProfile.id }));
          }}
        >
          {t("applyDeviceSpeed")}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={busy || !macUsable || clearVerdict.availability === "unavailable"}
          onClick={() => run(() => actions.clearSpeed(mac))}
        >
          {t("clearDeviceSpeed")}
        </Button>
      </div>
      {(profiles ?? []).length === 0 && speedVerdict.availability !== "unavailable" && (
        <p role="note" className="mt-2 text-xs text-muted-foreground">
          {t("deviceSpeedNoProfiles")}
        </p>
      )}
      <ControllerControlNotice verdict={speedVerdict} />
      {clearVerdict.availability === "unavailable" &&
        clearVerdict.reason !== speedVerdict.reason && (
          <ControllerControlNotice verdict={clearVerdict} />
        )}

      {/* Said once, under both undo controls, and only where at least one of
        them is actually offered. */}
      {(unblockVerdict.availability !== "unavailable" ||
        clearVerdict.availability !== "unavailable") && (
        <p role="note" className="mt-3 text-xs text-muted-foreground">
          {t("deviceUndoAlwaysOffered")}
        </p>
      )}
    </div>
  );
}
