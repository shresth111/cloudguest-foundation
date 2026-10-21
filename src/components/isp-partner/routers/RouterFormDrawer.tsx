/** Add a MikroTik router to a location (PRD §4.5), or rename one. No user is
 * created; the setup script comes next, on the router's own page. */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { MButton, MDrawer } from "@/components/master/MasterKit";
import { FormError, Spinner, TextField } from "@/components/isp-partner/kit";
import { useCreateIspRouter, useUpdateIspRouter } from "@/hooks/isp-partner/useIsp";
import { ispErrorMessage, ispFieldErrors } from "@/lib/isp-partner/errors";
import type { IspRouter } from "@/services/isp-partner/types";

const MAC_RE = /^([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}$/;

export function RouterFormDrawer({
  open,
  onClose,
  locationId,
  router,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  locationId: string;
  /** null = add. Editing changes name and model only (API_CONTRACT §4.5). */
  router: IspRouter | null;
  onSaved?: (r: IspRouter) => void;
}) {
  const [name, setName] = useState("");
  const [serial, setSerial] = useState("");
  const [mac, setMac] = useState("");
  const [model, setModel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const create = useCreateIspRouter(locationId);
  const update = useUpdateIspRouter(router?.id ?? "");
  const busy = create.isPending || update.isPending;

  useEffect(() => {
    if (open) {
      setName(router?.name ?? "");
      setSerial(router?.serial_number ?? "");
      setMac(router?.mac_address ?? "");
      setModel(router?.model ?? "");
      setError(null);
      setFieldErrors({});
    }
  }, [open, router]);

  const submit = async () => {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = "Required.";
    if (!model.trim()) errs.model = "Required, e.g. RB750Gr3.";
    if (!router) {
      if (!serial.trim()) errs.serial_number = "Required. It is on the label under the router.";
      if (!MAC_RE.test(mac.trim())) errs.mac_address = "Like E4:8D:8C:12:34:56.";
    }
    setFieldErrors(errs);
    if (Object.keys(errs).length) return;
    setError(null);
    try {
      const saved = router
        ? await update.mutateAsync({ name: name.trim(), model: model.trim() })
        : await create.mutateAsync({
            name: name.trim(),
            serial_number: serial.trim(),
            mac_address: mac.trim().toUpperCase().replace(/-/g, ":"),
            model: model.trim(),
            vendor: "mikrotik",
          });
      toast.success(router ? "Router saved." : `${saved.name} added. Next: generate its setup script.`);
      onSaved?.(saved);
      onClose();
    } catch (err) {
      setFieldErrors(ispFieldErrors(err));
      setError(ispErrorMessage(err, "Could not save the router."));
    }
  };

  return (
    <MDrawer
      open={open}
      onClose={onClose}
      title={router ? `Edit ${router.name}` : "Add router"}
      subtitle="MikroTik only in this release."
      footer={
        <div className="flex justify-end gap-2">
          <MButton variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </MButton>
          <MButton onClick={submit} disabled={busy}>
            {busy && <Spinner />} {router ? "Save" : "Add router"}
          </MButton>
        </div>
      }
    >
      <div className="space-y-3">
        <TextField label="Name" required value={name} onChange={setName} error={fieldErrors.name} hint="e.g. hEX Cafe X" />
        <TextField label="Model" required value={model} onChange={setModel} error={fieldErrors.model} />
        {!router && (
          <>
            <TextField label="Serial number" required value={serial} onChange={setSerial} error={fieldErrors.serial_number} />
            <TextField label="MAC address" required value={mac} onChange={setMac} error={fieldErrors.mac_address} />
          </>
        )}
        <FormError message={error} />
      </div>
    </MDrawer>
  );
}
