/** Add a MikroTik router to a location (PRD §4.5), or rename one. No user is
 * created; the setup script comes next, on the router's own page. */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { MButton, MDrawer } from "@/components/master/MasterKit";
import { FormError, Spinner, TextField } from "@/components/isp-partner/kit";
import { useCreateIspRouter, useUpdateIspRouter } from "@/hooks/isp-partner/useIsp";
import { useIpLogsFeatures } from "@/hooks/isp-partner/useIpLogs";
import { ispErrorMessage, ispFieldErrors } from "@/lib/isp-partner/errors";
import type { IspRouter, IspRouterCreate } from "@/services/isp-partner/types";

const MAC_RE = /^([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}$/;

export function RouterFormDrawer({
  open,
  onClose,
  locationId,
  router,
  onSaved,
  onCreate,
  creating,
}: {
  open: boolean;
  onClose: () => void;
  locationId: string;
  /** null = add. Editing changes name and model only (API_CONTRACT §4.5). */
  router: IspRouter | null;
  onSaved?: (r: IspRouter) => void;
  /** DECISIONS-1: replaces the owner's create call (franchisee route). */
  onCreate?: (body: IspRouterCreate) => Promise<IspRouter>;
  creating?: boolean;
}) {
  const [name, setName] = useState("");
  const [serial, setSerial] = useState("");
  const [mac, setMac] = useState("");
  const [model, setModel] = useState("");
  // DEFAULT-LOGS: "IP logs (recommended)", on by default. Shown, and sent as
  // `ip_logs`, only when the backend probe answers; otherwise the body is
  // exactly what it was.
  const ipLogsFeatures = useIpLogsFeatures(open && !router);
  const ipLogsOffered = !router && !!ipLogsFeatures.data?.default_on_add_router;
  const [ipLogs, setIpLogs] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const create = useCreateIspRouter(locationId);
  const update = useUpdateIspRouter(router?.id ?? "");
  const busy = create.isPending || update.isPending || !!creating;

  useEffect(() => {
    if (open) {
      setName(router?.name ?? "");
      setSerial(router?.serial_number ?? "");
      setMac(router?.mac_address ?? "");
      setModel(router?.model ?? "");
      setIpLogs(true);
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
        : await (onCreate ?? create.mutateAsync)({
            name: name.trim(),
            serial_number: serial.trim(),
            mac_address: mac.trim().toUpperCase().replace(/-/g, ":"),
            model: model.trim(),
            vendor: "mikrotik",
            ...(ipLogsOffered ? { ip_logs: ipLogs } : {}),
          });
      toast.success(
        router
          ? "Router saved."
          : ipLogsOffered && ipLogs
            ? `${saved.name} added with IP logs ON. Next: generate its setup script (IP logs are in it).`
            : `${saved.name} added. Next: generate its setup script.`,
      );
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
        <TextField
          label="Name"
          required
          value={name}
          onChange={setName}
          error={fieldErrors.name}
          hint="e.g. hEX Cafe X"
        />
        <TextField
          label="Model"
          required
          value={model}
          onChange={setModel}
          error={fieldErrors.model}
        />
        {!router && (
          <>
            <TextField
              label="Serial number"
              required
              value={serial}
              onChange={setSerial}
              error={fieldErrors.serial_number}
            />
            <TextField
              label="MAC address"
              required
              value={mac}
              onChange={setMac}
              error={fieldErrors.mac_address}
            />
          </>
        )}
        {ipLogsOffered && (
          <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-border p-3">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 accent-primary"
              checked={ipLogs}
              onChange={(e) => setIpLogs(e.target.checked)}
            />
            <span className="space-y-0.5">
              <span className="block text-sm font-medium">IP logs (recommended)</span>
              <span className="block text-xs text-muted-foreground">
                Sends this router&apos;s system logs and connection logs to Wyfy Guest for NetLogs,
                IPDR and CGNAT lookup. They go into the setup script, so you paste only once. You
                can turn them off later on the router&apos;s page.
              </span>
            </span>
          </label>
        )}
        <FormError message={error} />
      </div>
    </MDrawer>
  );
}
