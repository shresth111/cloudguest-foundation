/** Customer detail → TR-069 (TASKS FE-10): switch, credential, devices. */
import { useState } from "react";
import { toast } from "sonner";
import { MButton, MDialog } from "@/components/master/MasterKit";
import { Card, CopyField, ErrorBlock, FormError, Spinner } from "@/components/isp-partner/kit";
import { Tr069DevicesTable } from "@/components/isp-partner/tr069/Tr069DevicesTable";
import { usePartner } from "@/components/isp-partner/PartnerContext";
import {
  useRotateTr069Customer,
  useSetTr069CustomerEnabled,
  useTr069Customer,
} from "@/hooks/isp-partner/useTr069";
import { ispErrorMessage } from "@/lib/isp-partner/errors";

export function CustomerTr069Tab({
  customerId,
  suspended,
}: {
  customerId: string;
  suspended: boolean;
}) {
  const { can } = usePartner();
  const manage = can("tr069.manage");
  const q = useTr069Customer(customerId);
  const toggle = useSetTr069CustomerEnabled(customerId);
  const rotate = useRotateTr069Customer(customerId);
  const [confirm, setConfirm] = useState<null | "off" | "rotate">(null);
  const [error, setError] = useState<string | null>(null);

  const setEnabled = async (enabled: boolean) => {
    setError(null);
    try {
      await toggle.mutateAsync(enabled);
      toast.success(
        enabled ? "TR-069 turned on for this customer." : "TR-069 turned off for this customer.",
      );
      setConfirm(null);
    } catch (err) {
      setError(ispErrorMessage(err));
      setConfirm(null);
    }
  };

  return (
    <div className="space-y-4">
      <Card
        title="TR-069 management"
        actions={
          manage &&
          q.data &&
          (q.data.enabled ? (
            <>
              <MButton variant="outline" onClick={() => setConfirm("rotate")}>
                Rotate password
              </MButton>
              <MButton variant="outline" onClick={() => setConfirm("off")}>
                Turn off
              </MButton>
            </>
          ) : (
            <MButton onClick={() => setEnabled(true)} disabled={toggle.isPending}>
              {toggle.isPending && <Spinner />} Turn on
            </MButton>
          ))
        }
      >
        {q.isLoading ? (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Spinner /> Loading…
          </p>
        ) : q.error || !q.data ? (
          <ErrorBlock error={q.error} onRetry={() => q.refetch()} what="this customer's TR-069" />
        ) : (
          <div className="space-y-3">
            <p className="text-sm">
              {q.data.enabled
                ? "On. Devices configured with this credential are assigned to this customer automatically."
                : "Off. This customer's devices stay listed, but cannot check in, and refresh and reboot are refused."}
            </p>
            {suspended && (
              <p className="text-xs text-muted-foreground">
                The customer is suspended. Its devices stay manageable: refresh works, reboot is
                refused until service is resumed.
              </p>
            )}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <CopyField label="ACS URL" value={q.data.acs_url} />
              <CopyField label="Username" value={q.data.username} />
              <CopyField label="Password" value={q.data.password} secret />
            </div>
            {q.data.enabled && !q.data.password && (
              <p className="text-[11px] text-muted-foreground">
                The password is shown only to roles that manage TR-069.
              </p>
            )}
            <p className="text-[11px] text-muted-foreground">
              Recommended check-in interval: {q.data.periodic_inform_interval_s_recommended} s.{" "}
              {q.data.notes}
            </p>
          </div>
        )}
        <div className="mt-2">
          <FormError message={error} />
        </div>
      </Card>

      <Card title="Devices">
        <Tr069DevicesTable query={{ isp_customer_id: customerId }} hideCustomer />
      </Card>

      <MDialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title={
          confirm === "off"
            ? "Turn TR-069 off for this customer?"
            : "Rotate this customer's ACS password?"
        }
        footer={
          <>
            <MButton variant="outline" onClick={() => setConfirm(null)}>
              Cancel
            </MButton>
            <MButton
              disabled={toggle.isPending || rotate.isPending}
              onClick={async () => {
                if (confirm === "off") return setEnabled(false);
                setError(null);
                try {
                  await rotate.mutateAsync();
                  toast.success("Password rotated. Reconfigure this customer's devices with it.");
                } catch (err) {
                  setError(ispErrorMessage(err));
                }
                setConfirm(null);
              }}
            >
              {(toggle.isPending || rotate.isPending) && <Spinner />}{" "}
              {confirm === "off" ? "Turn off" : "Rotate"}
            </MButton>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          {confirm === "off"
            ? "Its devices are refused at the ACS from now on and cannot be refreshed or rebooted. Turning it back on reuses the same credential."
            : "Every device using the current password stops checking in until its TR-069 settings are updated with the new one (paste the router's TR-069 script again)."}
        </p>
      </MDialog>
    </div>
  );
}
