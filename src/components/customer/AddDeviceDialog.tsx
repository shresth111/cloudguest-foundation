/**
 * Add-device form used by the location picker's hardware drawer.
 *
 * Deliberately standalone (rather than importing the Devices page's own
 * NetworkHardwareView form) so the location-picker route doesn't pull that
 * heavy dashboard module — and its recharts/framer-motion dependencies —
 * into its chunk. It writes through the exact same `useMonitoredHardware`
 * hook, so demo and real accounts behave identically to the Devices page.
 */
import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DEVICE_TYPES, type DeviceType } from "@/stores/deviceStore";
import { floorSuggestions, normalizeFloor } from "@/lib/device-floors";
import { useMonitoredHardware } from "@/hooks/useMonitoredHardware";
import { requestErrorMessage } from "@/services/api";

const STRICT_MAC_RE = /^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/;

/** Normalizes commonly-pasted MAC formats (dashes, dots, no separators)
 * into canonical "AA:BB:CC:DD:EE:FF". Returns null when unsalvageable. */
function normalizeMac(raw: string): string | null {
  const hex = raw.trim().replace(/[^0-9A-Fa-f]/g, "");
  if (hex.length !== 12) return null;
  return (hex.toUpperCase().match(/.{2}/g) ?? []).join(":");
}

// Floor starts empty, not on a guessed "GF". It is optional on the backend
// (nullable String(50)) and a venue that does not think in floors should not
// have to clear a value it never chose.
const emptyForm = {
  name: "",
  mac: "",
  type: "Access Point" as DeviceType,
  floor: "",
};

export function AddDeviceDialog({
  open,
  onOpenChange,
  locationId,
  locationName,
  onAdded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locationId: string;
  locationName?: string;
  onAdded?: () => void;
}) {
  const { devices, addDevice } = useMonitoredHardware(locationId);
  const [form, setForm] = useState(emptyForm);
  const [macError, setMacError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const close = (next: boolean) => {
    if (!next) {
      setForm(emptyForm);
      setMacError(null);
    }
    onOpenChange(next);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!locationId) {
      toast.error("Select a location first.");
      return;
    }
    if (!form.name.trim()) {
      toast.error("Give this device a name.");
      return;
    }
    const mac = normalizeMac(form.mac);
    if (!mac || !STRICT_MAC_RE.test(mac)) {
      const msg = "Enter a valid MAC address, e.g. AA:BB:CC:DD:EE:FF";
      setMacError(msg);
      return;
    }
    if (devices.some((d) => d.mac.toUpperCase() === mac)) {
      setMacError("A device with this MAC is already set up.");
      return;
    }
    setMacError(null);
    setSubmitting(true);
    try {
      await addDevice(locationId, form.name.trim(), mac, form.type, form.floor);
      toast.success(`${form.type} added on ${form.floor}`);
      setForm(emptyForm);
      onOpenChange(false);
      onAdded?.();
    } catch (err) {
      toast.error(requestErrorMessage(err, "Could not add this device."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add a device</DialogTitle>
          <DialogDescription>
            Register hardware by MAC address{locationName ? ` at ${locationName}` : ""} to start
            monitoring its status.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="add-device-name">Device name</Label>
            <Input
              id="add-device-name"
              autoFocus
              placeholder="Lobby AP"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="add-device-mac">MAC address</Label>
            <Input
              id="add-device-mac"
              placeholder="AA:BB:CC:DD:EE:FF"
              value={form.mac}
              aria-invalid={!!macError}
              aria-describedby={macError ? "add-device-mac-error" : undefined}
              onChange={(e) => {
                setForm({ ...form, mac: e.target.value });
                if (macError) setMacError(null);
              }}
              className={cn("font-mono", macError && "border-destructive")}
            />
            {macError && (
              <p id="add-device-mac-error" className="text-xs font-medium text-destructive">
                {macError}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Device type</Label>
            <div className="flex flex-wrap gap-2">
              {DEVICE_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  aria-pressed={form.type === t}
                  onClick={() => setForm({ ...form, type: t })}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                    form.type === t
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:bg-muted",
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Free text with suggestions, not a fixed list. The
           * six-item floor constant this replaced was the same list for
           * every venue
           * -- wrong for a 12-storey hotel, a mall with basements, and a
           * single-storey cafe alike. This venue's own floors come first;
           * see @/lib/device-floors. */}
          <div className="space-y-1.5">
            <Label htmlFor="device-floor">Floor</Label>
            <Input
              id="device-floor"
              list="device-floor-suggestions"
              value={form.floor}
              placeholder="Optional — e.g. GF, 3F, B1"
              maxLength={50}
              onChange={(e) => setForm({ ...form, floor: e.target.value })}
              onBlur={(e) => setForm({ ...form, floor: normalizeFloor(e.target.value) })}
            />
            <datalist id="device-floor-suggestions">
              {floorSuggestions(devices).map((f) => (
                <option key={f} value={f} />
              ))}
            </datalist>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => close(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Adding…" : "Add device"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
