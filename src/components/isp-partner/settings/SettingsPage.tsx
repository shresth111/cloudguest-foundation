/**
 * `/partner/settings` (PRD §4.12): the ISP profile (read-only: the contract
 * has no edit endpoint for it yet) and the ISP-wide ACS credential, with a
 * rotate that warns existing CPEs must be reconfigured.
 */
import { useState } from "react";
import { toast } from "sonner";
import { MButton, MDialog, MSectionHeader } from "@/components/master/MasterKit";
import { Card, CopyField, ErrorBlock, FormError, Spinner } from "@/components/isp-partner/kit";
import { usePartner } from "@/components/isp-partner/PartnerContext";
import { useRotateTr069Acs, useTr069Acs } from "@/hooks/isp-partner/useTr069";
import { ispErrorMessage } from "@/lib/isp-partner/errors";
import { roleLabel } from "@/lib/isp-partner/format";

function AcsCard() {
  const q = useTr069Acs();
  const rotate = useRotateTr069Acs();
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Card
      title="TR-069: your ISP's ACS credential"
      actions={
        q.data && (
          <MButton variant="outline" onClick={() => setConfirm(true)}>
            Rotate password
          </MButton>
        )
      }
    >
      {q.isLoading ? (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Spinner /> Loading…
        </p>
      ) : q.error || !q.data ? (
        <ErrorBlock error={q.error} onRetry={() => q.refetch()} what="the ACS credential" />
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Devices using this credential arrive unassigned; assign them to a customer from TR-069
            devices. For devices that should land on a customer directly, turn TR-069 on in that
            customer&apos;s TR-069 tab and use its credential instead.
          </p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <CopyField label="ACS URL" value={q.data.acs_url} />
            <CopyField label="Username" value={q.data.username} />
            <CopyField label="Password" value={q.data.password} secret />
          </div>
          <p className="text-[11px] text-muted-foreground">
            {q.data.enabled ? "Enabled." : "Disabled."} Recommended check-in interval:{" "}
            {q.data.periodic_inform_interval_s_recommended} s.
          </p>
        </div>
      )}
      <FormError message={error} />
      <MDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Rotate the ISP ACS password?"
        footer={
          <>
            <MButton variant="outline" onClick={() => setConfirm(false)}>
              Cancel
            </MButton>
            <MButton
              disabled={rotate.isPending}
              onClick={async () => {
                setError(null);
                try {
                  await rotate.mutateAsync();
                  toast.success("Rotated. Reconfigure every device that used the old password.");
                } catch (err) {
                  setError(ispErrorMessage(err));
                }
                setConfirm(false);
              }}
            >
              {rotate.isPending && <Spinner />} Rotate
            </MButton>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          Every device configured with the current password stops checking in until it is
          reconfigured with the new one. Customer credentials are not affected.
        </p>
      </MDialog>
    </Card>
  );
}

export function SettingsPage() {
  const { me, can } = usePartner();
  return (
    <>
      <MSectionHeader eyebrow="Settings" title="Settings" />
      <Card title="ISP profile">
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
          <dt className="text-muted-foreground">Name</dt>
          <dd>{me.isp.name}</dd>
          <dt className="text-muted-foreground">Slug</dt>
          <dd className="font-mono text-xs">{me.isp.slug}</dd>
          <dt className="text-muted-foreground">Status</dt>
          <dd>{me.isp.status}</dd>
          <dt className="text-muted-foreground">Support phone</dt>
          <dd>{me.isp.support_phone ?? "–"}</dd>
          <dt className="text-muted-foreground">Timezone</dt>
          <dd>{me.isp.timezone}</dd>
        </dl>
        <p className="mt-3 text-[11px] text-muted-foreground">
          To change these details, contact Wyfy Guest support (support@wyfyguest.com).
        </p>
      </Card>
      <Card title="You">
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
          <dt className="text-muted-foreground">Name</dt>
          <dd>{me.user.name}</dd>
          <dt className="text-muted-foreground">Email</dt>
          <dd>{me.user.email}</dd>
          <dt className="text-muted-foreground">Role</dt>
          <dd>{roleLabel(me.user.role)}</dd>
          <dt className="text-muted-foreground">Customers</dt>
          <dd>
            {me.confined_customer_ids
              ? `${me.confined_customer_ids.length} assigned to you`
              : "All"}
          </dd>
        </dl>
      </Card>
      {can("tr069.manage") && <AcsCard />}
    </>
  );
}
