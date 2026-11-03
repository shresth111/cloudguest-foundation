/**
 * Guest WiFi Limits -> speed, at an Aruba Instant On venue: ONE speed for
 * every device on the guest network (10, 20, ... 100 Mbps, or no limit),
 * written to Instant On through its cloud and reported only once Instant On's
 * own read-back confirms it. See `lib/aruba-guest-speed.ts` for what Instant
 * On can and cannot do.
 *
 * Rendered only at a NAS-only venue WITHOUT the hybrid gateway (that venue's
 * per-guest speed stays on the policy Bandwidth field, unchanged). MikroTik
 * and Omada venues never mount it.
 *
 * With Instant On cloud control OFF for the venue the backend answers
 * `unavailable` and nothing is ever sent: the control shows what is needed to
 * turn it on, not a form that would pretend to save.
 */
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Gauge, Info, Lock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  GUEST_SPEED_NEEDS_CLOUD,
  NO_LIMIT,
  SAME_FOR_EVERY_DEVICE,
  SAME_SETTING_AS_SSID_TIERS,
  applyOutcomeMessage,
  currentSpeedSentence,
  fromSelectValue,
  speedLabel,
  speedOptions,
  toSelectValue,
} from "@/lib/aruba-guest-speed";
import { useTranslation } from "react-i18next";
import i18n from "@/lib/i18n";
import { ArubaNetworkTotalControl } from "@/components/customer/ArubaNetworkTotalControl";
import { arubaGuestSpeedService } from "@/services/aruba-guest-speed.service";

export function ArubaGuestSpeedControl({
  locationId,
  demo = false,
}: {
  locationId: string | null | undefined;
  demo?: boolean;
}) {
  const { t } = useTranslation("accessRules", { i18n });
  const queryClient = useQueryClient();
  const queryKey = ["aruba-guest-speed", locationId];
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey,
    queryFn: () => arubaGuestSpeedService.read(locationId as string),
    enabled: !!locationId && !demo,
    staleTime: 60_000,
    retry: false,
  });

  const networks = useMemo(() => data?.networks ?? [], [data]);
  const presets = data?.presetsMbps ?? [];
  const [networkId, setNetworkId] = useState<string>("");
  const network = networks.find((n) => n.networkId === networkId) ?? networks[0] ?? null;
  const [down, setDown] = useState<string>(NO_LIMIT);
  const [up, setUp] = useState<string>(NO_LIMIT);
  const [confirming, setConfirming] = useState(false);
  // Each device or the whole network: one mode per network in Instant On. Starts
  // on what the network holds.
  const [modeChoice, setModeChoice] = useState<"device" | "network" | null>(null);
  const mode =
    data?.networkTotalWriteEnabled &&
    (modeChoice ?? (network?.otherModeLimit ? "network" : "device")) === "network"
      ? "network"
      : "device";

  // Start the pickers from what the network holds now.
  useEffect(() => {
    if (!network) return;
    setDown(toSelectValue(network.downloadMbps));
    setUp(toSelectValue(network.uploadMbps));
  }, [network?.networkId, network?.downloadMbps, network?.uploadMbps]); // eslint-disable-line react-hooks/exhaustive-deps

  const apply = useMutation({
    mutationFn: () =>
      arubaGuestSpeedService.apply(locationId as string, {
        networkId: network!.networkId,
        downloadMbps: fromSelectValue(down),
        uploadMbps: fromSelectValue(up),
      }),
    onSuccess: (result) => {
      const message = applyOutcomeMessage(result);
      if (message.tone === "success") toast.success(message.text);
      else if (message.tone === "warning") toast.warning(message.text);
      else toast.error(message.text);
      if (result.networks.length > 0) queryClient.setQueryData(queryKey, result);
      else void refetch();
    },
    onError: () =>
      toast.error(
        t(
          "guestSpeed.applyUnreachable",
          "We couldn't reach Instant On to change the speed, so nothing has changed.",
        ),
      ),
  });

  const unchanged =
    !!network &&
    fromSelectValue(down) === network.downloadMbps &&
    fromSelectValue(up) === network.uploadMbps;

  const notice = (tone: "info" | "lock", text: string, testId: string) => {
    const Icon = tone === "lock" ? Lock : Info;
    return (
      <p
        role="note"
        data-testid={testId}
        className="mt-2 flex items-start gap-1.5 text-xs text-slate-500 dark:text-slate-400"
      >
        <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>{text}</span>
      </p>
    );
  };

  return (
    <div
      className="mt-4 rounded-md border border-slate-200 p-3 dark:border-slate-700"
      data-testid="aruba-guest-speed"
    >
      <p className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
        <Gauge className="h-4 w-4 text-[var(--wy-accent)]" aria-hidden="true" />
        {t("guestSpeed.title", "Guest speed limit (per device)")}
      </p>
      {notice("info", SAME_FOR_EVERY_DEVICE, "aruba-guest-speed-same-for-all")}

      {demo ? null : isLoading ? (
        <p className="mt-2 text-xs text-slate-400">
          {t("guestSpeed.asking", "Asking Instant On…")}
        </p>
      ) : isError || !data ? (
        notice(
          "lock",
          t(
            "guestSpeed.readFailed",
            "We couldn't read the guest WiFi speed from Instant On just now. Reload to try again.",
          ),
          "aruba-guest-speed-error",
        )
      ) : data.status === "unavailable" ? (
        notice("lock", GUEST_SPEED_NEEDS_CLOUD, "aruba-guest-speed-needs-cloud")
      ) : data.status === "failed" || networks.length === 0 ? (
        notice(
          "lock",
          data.status === "failed"
            ? applyOutcomeMessage(data).text
            : t(
                "guestSpeed.noNetwork",
                "Instant On shows no guest WiFi network at this venue yet.",
              ),
          "aruba-guest-speed-unreadable",
        )
      ) : (
        <>
          {data.networkTotalWriteEnabled && network && (
            <fieldset className="mt-3 flex flex-wrap gap-4 text-xs" data-testid="aruba-speed-mode">
              <legend className="sr-only">
                {t("networkTotal.modeLabel", "Speed limit applies to")}
              </legend>
              <label className="inline-flex items-center gap-1.5">
                <input
                  type="radio"
                  name="aruba-speed-mode"
                  checked={mode === "device"}
                  onChange={() => setModeChoice("device")}
                />
                {t("networkTotal.modeDevice", "Each device")}
              </label>
              <label className="inline-flex items-center gap-1.5">
                <input
                  type="radio"
                  name="aruba-speed-mode"
                  checked={mode === "network"}
                  onChange={() => setModeChoice("network")}
                />
                {t("networkTotal.modeNetwork", "Whole WiFi network")}
              </label>
            </fieldset>
          )}
          {mode === "network" && network && locationId ? (
            <ArubaNetworkTotalControl
              key={network.networkId}
              locationId={locationId}
              network={network}
              onApplied={(result) => {
                if (result.networks.length > 0) queryClient.setQueryData(queryKey, result);
                else void refetch();
              }}
            />
          ) : (
            <>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                {networks.length > 1 && (
                  <label className="text-xs text-slate-500">
                    {t("guestSpeed.network", "Guest network")}
                    <Select value={network?.networkId ?? ""} onValueChange={setNetworkId}>
                      <SelectTrigger
                        className="mt-1 h-9 text-sm"
                        aria-label={t("guestSpeed.network", "Guest network")}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {networks.map((n) => (
                          <SelectItem key={n.networkId} value={n.networkId}>
                            {n.networkName ?? n.networkId}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </label>
                )}
                {(
                  [
                    ["download", t("guestSpeed.download", "Download"), down, setDown],
                    ["upload", t("guestSpeed.upload", "Upload"), up, setUp],
                  ] as const
                ).map(([id, label, value, set]) => (
                  <label key={id} className="text-xs text-slate-500">
                    {label}
                    <Select value={value} onValueChange={set}>
                      <SelectTrigger
                        className="mt-1 h-9 text-sm"
                        aria-label={t(`guestSpeed.${id}PerDevice`, `${label} speed per device`)}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NO_LIMIT}>
                          {t("guestSpeed.noLimit", "No limit")}
                        </SelectItem>
                        {speedOptions(
                          presets,
                          id === "download"
                            ? (network?.downloadMbps ?? null)
                            : (network?.uploadMbps ?? null),
                        ).map((p) => (
                          <SelectItem key={p} value={String(p)}>
                            {speedLabel(p)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </label>
                ))}
              </div>
              {network && (
                <p className="mt-2 text-xs text-slate-500" data-testid="aruba-guest-speed-current">
                  {network.networkName ? `${network.networkName}: ` : ""}
                  {currentSpeedSentence(network)}
                </p>
              )}
              <p className="mt-1 text-xs text-slate-400">{SAME_SETTING_AS_SSID_TIERS}</p>
              <div className="mt-3 flex justify-end">
                <Button
                  type="button"
                  size="sm"
                  disabled={!network || network.otherModeLimit || unchanged || apply.isPending}
                  onClick={() => setConfirming(true)}
                >
                  {apply.isPending
                    ? t("guestSpeed.applying", "Applying…")
                    : t("guestSpeed.apply", "Apply guest speed")}
                </Button>
              </div>
            </>
          )}
        </>
      )}

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("guestSpeed.confirmTitle", "Change the speed for every guest device?")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                "guestSpeed.confirmBody",
                "Every device on {{network}} will be held to {{down}} down and {{up}} up. We'll confirm with Instant On before saying it's done.",
                {
                  network:
                    network?.networkName ?? t("guestSpeed.theGuestNetwork", "the guest network"),
                  down: speedLabel(fromSelectValue(down)),
                  up: speedLabel(fromSelectValue(up)),
                },
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("guestSpeed.cancel", "Cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirming(false);
                apply.mutate();
              }}
            >
              {t("guestSpeed.confirmApply", "Apply")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
