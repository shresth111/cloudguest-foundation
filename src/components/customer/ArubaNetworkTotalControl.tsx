/**
 * One total speed for one Aruba Instant On guest network: Instant On's "Usage
 * Controlled By: Network". Shown only when the backend's own flag is on. Always
 * previews first, and says applied only when Instant On's read-back confirmed it.
 */
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import i18n from "@/lib/i18n";
import {
  speedLabel,
  type GuestNetworkSpeed,
  type NetworkTotalPreview,
  type VenueGuestSpeed,
} from "@/lib/aruba-guest-speed";
import { arubaGuestSpeedService } from "@/services/aruba-guest-speed.service";

const parseMbps = (value: string): number | null => {
  const n = Number(value);
  return value.trim() && Number.isInteger(n) ? n : null;
};
const inRange = (value: string) => {
  if (!value.trim()) return true;
  const n = parseMbps(value);
  return n !== null && n >= 1 && n <= 1000;
};

export function ArubaNetworkTotalControl({
  locationId,
  network,
  onApplied,
}: {
  locationId: string;
  network: GuestNetworkSpeed;
  onApplied: (result: VenueGuestSpeed) => void;
}) {
  const { t } = useTranslation("accessRules", { i18n });
  const [down, setDown] = useState(network.networkDownloadMbps?.toString() ?? "");
  const [up, setUp] = useState(network.networkUploadMbps?.toString() ?? "");
  const [preview, setPreview] = useState<NetworkTotalPreview | null>(null);
  const valid = inRange(down) && inRange(up);
  const refused = (result: VenueGuestSpeed) =>
    toast.error(
      t("networkTotal.notChanged", "Instant On didn't change the speed. Reason: {{reason}}", {
        reason: result.reason ?? result.status,
      }),
    );
  const failed = () =>
    toast.error(
      t(
        "guestSpeed.applyUnreachable",
        "We couldn't reach Instant On to change the speed, so nothing has changed.",
      ),
    );
  const send = (dryRun: boolean) =>
    arubaGuestSpeedService.setNetworkTotal(locationId, {
      networkId: network.networkId,
      downloadMbps: parseMbps(down),
      uploadMbps: parseMbps(up),
      dryRun,
    });
  const ask = useMutation({
    mutationFn: () => send(true),
    onSuccess: (result) => {
      if (result.status === "preview" && result.preview) setPreview(result.preview);
      else refused(result);
    },
    onError: failed,
  });
  const apply = useMutation({
    mutationFn: () => send(false),
    onSuccess: (result) => {
      setPreview(null);
      if (result.status === "applied") {
        toast.success(t("networkTotal.applied", "Instant On confirmed the new network total."));
        onApplied(result);
      } else refused(result);
    },
    onError: failed,
  });
  const clearing = preview && preview.downloadMbps === null && preview.uploadMbps === null;
  return (
    <div className="mt-3 space-y-3" data-testid="aruba-network-total">
      <p className="text-xs text-slate-500">
        {t(
          "networkTotal.explain",
          "One total shared by all devices on this WiFi network. It's per network, not for the whole venue. A network has either a per-device limit or a total, so this replaces any per-device limit.",
        )}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs text-slate-500">
          {t("networkTotal.download", "Total download (Mbps, 1 to 1000)")}
          <Input
            className="mt-1 h-9 text-sm"
            type="number"
            min={1}
            max={1000}
            value={down}
            onChange={(e) => {
              setDown(e.target.value);
              setPreview(null);
            }}
          />
        </label>
        <label className="text-xs text-slate-500">
          {t("networkTotal.upload", "Total upload (Mbps, 1 to 1000)")}
          <Input
            className="mt-1 h-9 text-sm"
            type="number"
            min={1}
            max={1000}
            value={up}
            onChange={(e) => {
              setUp(e.target.value);
              setPreview(null);
            }}
          />
        </label>
      </div>
      {preview && (
        <p className="text-xs text-slate-700 dark:text-slate-200" data-testid="aruba-total-preview">
          {clearing
            ? t("networkTotal.previewClear", "This removes the total from this network.")
            : t(
                "networkTotal.preview",
                "All devices on this network will share {{down}} down and {{up}} up.",
                {
                  down: speedLabel(preview.downloadMbps),
                  up: speedLabel(preview.uploadMbps),
                },
              )}{" "}
          {preview.replacesPerDevice &&
            t("networkTotal.previewReplaces", "This replaces the per-device limit.")}
        </p>
      )}
      <div className="flex justify-end gap-2">
        {preview ? (
          <Button type="button" size="sm" disabled={apply.isPending} onClick={() => apply.mutate()}>
            {apply.isPending
              ? t("guestSpeed.applying", "Applying…")
              : t("networkTotal.apply", "Apply network total")}
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!valid || ask.isPending}
            onClick={() => ask.mutate()}
          >
            {t("networkTotal.previewButton", "Preview")}
          </Button>
        )}
      </div>
    </div>
  );
}
