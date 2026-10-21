/**
 * Suspend / reactivate a customer, behind a confirm (PRD §4.3).
 *
 * Phase 1 wording is exact about what suspension does: it suspends the
 * customer's account and blocks TR-069 actions for its devices. It does NOT
 * promise to cut guest WiFi -- existing behaviour keeps guests online, and
 * the founder has not decided otherwise (STATUS Q4).
 */
import { useState } from "react";
import { toast } from "sonner";
import { MButton, MDialog, M_INPUT } from "@/components/master/MasterKit";
import { FormError, Spinner } from "@/components/isp-partner/kit";
import { useSetIspCustomerSuspended } from "@/hooks/isp-partner/useIsp";
import { ispErrorMessage } from "@/lib/isp-partner/errors";
import type { IspCustomer } from "@/services/isp-partner/types";

export function SuspendCustomerDialog({
  customer,
  open,
  onClose,
}: {
  customer: IspCustomer;
  open: boolean;
  onClose: () => void;
}) {
  const suspend = customer.status !== "suspended";
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const m = useSetIspCustomerSuspended(customer.id);

  const go = async () => {
    if (suspend && !reason.trim()) {
      setError("Give a reason; it is kept with the customer's record.");
      return;
    }
    setError(null);
    try {
      await m.mutateAsync({ suspend, reason: reason.trim().slice(0, 255) });
      toast.success(suspend ? `${customer.name} suspended.` : `${customer.name} reactivated.`);
      setReason("");
      onClose();
    } catch (err) {
      setError(ispErrorMessage(err));
    }
  };

  return (
    <MDialog
      open={open}
      onClose={onClose}
      title={suspend ? `Suspend ${customer.name}?` : `Reactivate ${customer.name}?`}
      footer={
        <>
          <MButton variant="outline" onClick={onClose} disabled={m.isPending}>
            Cancel
          </MButton>
          <MButton
            onClick={go}
            disabled={m.isPending}
            className={suspend ? "bg-destructive text-destructive-foreground" : undefined}
          >
            {m.isPending && <Spinner />} {suspend ? "Suspend" : "Reactivate"}
          </MButton>
        </>
      }
    >
      {suspend ? (
        <div className="space-y-3 text-sm">
          <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
            <li>The customer is marked suspended everywhere in this console.</li>
            <li>Its TR-069 devices stop accepting refresh and reboot.</li>
            <li>
              Guest WiFi at its locations is <strong className="text-foreground">not</strong> cut by
              this. Guests keep signing in as before.
            </li>
          </ul>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Reason</span>
            <input
              className={M_INPUT}
              maxLength={255}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          The customer becomes active again and TR-069 actions work for its devices.
        </p>
      )}
      <div className="mt-3">
        <FormError message={error} />
      </div>
    </MDialog>
  );
}
