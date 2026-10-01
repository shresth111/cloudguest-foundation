import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { AlertTriangle, Check, CheckCircle2, Loader2, Search } from "lucide-react";
import i18n from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { deviceMatchesSearch, keepAddressOffer, type PickableDevice } from "@/lib/firewall-rules";

/**
 * Security -> Firewall -> rule dialog: "A device on your network".
 *
 * A searchable list of the devices the router sees, by the name an owner
 * knows them by ("Front-desk printer"), with the address and MAC beside it so
 * the choice can be checked. Which devices are offered -- and that guests are
 * never offered as a destination -- is decided by `pickableDevices` in
 * lib/firewall-rules, not here; this only draws the list and reports a pick.
 */
export function FirewallDevicePicker({
  devices,
  selectedMac,
  loading,
  failed,
  onPick,
  label,
}: {
  devices: readonly PickableDevice[];
  selectedMac: string | null;
  loading: boolean;
  failed: boolean;
  onPick: (device: PickableDevice) => void;
  /** Accessible name of the list ("Device for Who"). */
  label: string;
}) {
  const { t } = useTranslation("nav", { i18n });
  const [query, setQuery] = useState("");
  const shown = devices.filter((d) => deviceMatchesSearch(d, query));

  if (loading) {
    return (
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        {t("firewallPage.devicesLoading", "Loading the devices on your network…")}
      </p>
    );
  }
  if (failed) {
    return (
      <p role="alert" className="text-xs text-destructive">
        {t(
          "firewallPage.devicesFailed",
          "Couldn't load the devices on your network. Use “A specific address or range” instead, or try again in a minute.",
        )}
      </p>
    );
  }
  if (devices.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        {t(
          "firewallPage.devicesNone",
          "We haven't seen any devices on this router yet. Devices appear here a few minutes after they connect.",
        )}
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("firewallPage.devicesSearch", "Search by name, address or MAC")}
          aria-label={t("firewallPage.devicesSearch", "Search by name, address or MAC")}
          className="pl-8"
        />
      </div>
      <div role="listbox" aria-label={label} className="max-h-56 overflow-y-auto rounded-md border">
        {shown.length === 0 ? (
          <p className="p-3 text-xs text-muted-foreground">
            {t("firewallPage.devicesNoMatch", "No device matches that.")}
          </p>
        ) : (
          shown.map((d) => {
            const selected = d.mac === selectedMac;
            return (
              <button
                key={d.mac}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => onPick(d)}
                className={cn(
                  "flex w-full items-start gap-2 border-b px-3 py-2 text-left last:border-b-0 hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none",
                  selected && "bg-primary/5",
                )}
              >
                <Check
                  className={cn(
                    "mt-0.5 h-4 w-4 shrink-0 text-primary",
                    selected ? "opacity-100" : "opacity-0",
                  )}
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className="truncate text-sm font-medium">{d.name}</span>
                    {d.isGuest && (
                      <Badge variant="outline" className="rounded-full px-1.5 py-0 text-[10px]">
                        {t("firewallPage.deviceGuest", "Guest")}
                      </Badge>
                    )}
                    {!d.isActive && (
                      <Badge
                        variant="outline"
                        className="rounded-full px-1.5 py-0 text-[10px] text-muted-foreground"
                      >
                        {t("firewallPage.deviceOffline", "Not connected now")}
                      </Badge>
                    )}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {d.ip} · {d.mac}
                    {d.detail ? ` · ${d.detail}` : ""}
                  </span>
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

/**
 * Under a picked device: whether its address will stay put, and the one
 * thing the owner can do about it. See `keepAddressOffer` for the five
 * cases. The tick box is the only control; every other case is a sentence.
 */
export function DeviceAddressNote({
  device,
  checking,
  keep,
  onKeepChange,
  error,
}: {
  device: PickableDevice;
  /** The router's leases are still being read. */
  checking: boolean;
  keep: boolean;
  onKeepChange: (keep: boolean) => void;
  error: string | null;
}) {
  const { t } = useTranslation("nav", { i18n });
  const warn = (text: string) => (
    <p className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{text}</span>
    </p>
  );
  const stopsMatching = t(
    "firewallPage.keepStopsMatching",
    "If this device's address changes, this rule will stop matching it.",
  );
  const offer = keepAddressOffer(device);

  let body: ReactNode = null;
  if (offer === "guest") {
    body = (
      <p className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>
          {t(
            "firewallPage.guestWhoNote",
            "This is a guest's device. Guests' addresses change and are handed to the next guest, so this rule may soon match someone else. To keep one guest device off your WiFi, use",
          )}{" "}
          <Link
            to="/blocking"
            search={{ tab: "guests" }}
            className="font-medium underline underline-offset-2"
          >
            {t("firewallPage.guestWhoLink", "Block Websites → Guests & devices")}
          </Link>{" "}
          {t("firewallPage.guestWhoTail", "— it blocks the device itself, not its address.")}
        </span>
      </p>
    );
  } else if (checking) {
    body = (
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        {t("firewallPage.keepChecking", "Checking whether this device keeps its address…")}
      </p>
    );
  } else if (offer === "offer") {
    body = (
      <div className="space-y-1">
        <label className="flex items-start gap-2 text-sm">
          <Checkbox
            checked={keep}
            onCheckedChange={(v) => onKeepChange(v === true)}
            className="mt-0.5"
          />
          <span>
            {t("firewallPage.keepAddress", "Keep this device on the same address")}
            <span className="block text-xs text-muted-foreground">
              {t(
                "firewallPage.keepAddressHint",
                "Recommended. The router will always give {{name}} {{ip}}, so this rule keeps matching it.",
                { name: device.name, ip: device.ip },
              )}
            </span>
          </span>
        </label>
        {!keep && warn(stopsMatching)}
      </div>
    );
  } else if (offer === "kept") {
    body = (
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
        {t("firewallPage.keepAlready", "The router always gives this device {{ip}}.", {
          ip: device.ip,
        })}
      </p>
    );
  } else if (offer === "cannot") {
    body = warn(
      `${t(
        "firewallPage.keepCannot",
        "This device didn't get its address from the router, so we can't keep it fixed from here.",
      )} ${stopsMatching}`,
    );
  } else {
    body = warn(
      `${t(
        "firewallPage.keepUnknown",
        "We couldn't check whether this device keeps its address.",
      )} ${stopsMatching}`,
    );
  }

  return (
    <div className="space-y-1">
      {body}
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

export default FirewallDevicePicker;
