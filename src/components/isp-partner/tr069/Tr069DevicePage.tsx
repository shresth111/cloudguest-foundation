/**
 * `/partner/tr069/$cpeId` (PRD §4.9): curated parameters, refresh, reboot
 * (with confirm), task history and assignment to a customer/location.
 * Passwords are never part of the parameters (the backend never reads them).
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Power, RefreshCw } from "lucide-react";
import {
  MButton,
  MDialog,
  MSectionHeader,
  MTable,
  MTag,
  MTd,
  MTh,
  MTr,
  M_INPUT,
} from "@/components/master/MasterKit";
import {
  Card,
  CustomerSelect,
  ErrorBlock,
  FormError,
  LoadingBlock,
  Spinner,
} from "@/components/isp-partner/kit";
import { usePartner } from "@/components/isp-partner/PartnerContext";
import { useIspCustomerLocations, useIspCustomerOptions } from "@/hooks/isp-partner/useIsp";
import {
  useTr069Device,
  useTr069DeviceTask,
  useTr069Tasks,
  useUpdateTr069Device,
} from "@/hooks/isp-partner/useTr069";
import { ispErrorMessage } from "@/lib/isp-partner/errors";
import { formatAgo, formatDateTime, formatDuration } from "@/lib/isp-partner/format";
import type { Tr069DeviceDetail } from "@/services/isp-partner/types";

const TASK_LABEL: Record<string, string> = {
  refresh_params: "Refresh parameters",
  reboot: "Reboot",
};
const TASK_STATUS_LABEL: Record<string, string> = {
  queued: "Queued, runs at next check-in",
  done: "Done",
  fault: "Failed on the device",
  expired: "Expired (device did not check in within 24 h)",
};

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="min-w-0 break-words">{v ?? "–"}</dd>
    </>
  );
}

function AssignCard({ device }: { device: Tr069DeviceDetail }) {
  const customers = useIspCustomerOptions();
  const [customerId, setCustomerId] = useState(device.isp_customer_id ?? "");
  const [locationId, setLocationId] = useState(device.isp_location_id ?? "");
  const [label, setLabel] = useState(device.label ?? "");
  const [error, setError] = useState<string | null>(null);
  const locations = useIspCustomerLocations(customerId, !!customerId);
  const update = useUpdateTr069Device(device.id);

  useEffect(() => {
    setCustomerId(device.isp_customer_id ?? "");
    setLocationId(device.isp_location_id ?? "");
    setLabel(device.label ?? "");
  }, [device.isp_customer_id, device.isp_location_id, device.label]);

  const save = async () => {
    setError(null);
    try {
      await update.mutateAsync({
        isp_customer_id: customerId || null,
        isp_location_id: customerId ? locationId || null : null,
        label: label.trim() || null,
      });
      toast.success(customerId ? "Device assigned." : "Device unassigned.");
    } catch (err) {
      setError(ispErrorMessage(err));
    }
  };

  return (
    <Card title="Assignment">
      <div className="space-y-3">
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">Customer</span>
          <CustomerSelect
            value={customerId}
            onChange={(id) => {
              setCustomerId(id);
              setLocationId("");
            }}
            customers={customers.data}
            allLabel="Unassigned"
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">Location (optional)</span>
          <select
            className={M_INPUT}
            value={locationId}
            disabled={!customerId}
            onChange={(e) => setLocationId(e.target.value)}
          >
            <option value="">No specific location</option>
            {customerId &&
              (locations.data?.items ?? []).map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
          </select>
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">Label</span>
          <input
            className={M_INPUT}
            value={label}
            maxLength={200}
            onChange={(e) => setLabel(e.target.value)}
          />
        </label>
        <FormError message={error} />
        <MButton onClick={save} disabled={update.isPending}>
          {update.isPending && <Spinner />} Save assignment
        </MButton>
      </div>
    </Card>
  );
}

export function Tr069DevicePage({ cpeId }: { cpeId: string }) {
  const { can } = usePartner();
  const q = useTr069Device(cpeId);
  const tasks = useTr069Tasks(cpeId);
  const task = useTr069DeviceTask(cpeId);
  const [confirmReboot, setConfirmReboot] = useState(false);
  const [taskMessage, setTaskMessage] = useState<string | null>(null);
  const [taskError, setTaskError] = useState<string | null>(null);

  if (q.isLoading) return <LoadingBlock />;
  if (q.error || !q.data)
    return <ErrorBlock error={q.error} onRetry={() => q.refetch()} what="this device" />;
  const d = q.data;
  const p = d.params;

  const run = async (kind: "refresh" | "reboot") => {
    setTaskError(null);
    setTaskMessage(null);
    try {
      const res = await task.mutateAsync(kind);
      setTaskMessage(
        res.status === "queued"
          ? `${kind === "reboot" ? "Reboot" : "Refresh"} queued. Runs at next check-in. ${res.message ?? ""}`
          : res.message || "Done.",
      );
      setConfirmReboot(false);
    } catch (err) {
      setTaskError(ispErrorMessage(err));
      setConfirmReboot(false);
    }
  };

  return (
    <>
      <MSectionHeader
        eyebrow="TR-069 device"
        title={d.label || d.serial_number || d.genieacs_device_id}
        description={`${[d.manufacturer, d.model].filter(Boolean).join(" ")} · ${d.genieacs_device_id}`}
        actions={
          <>
            <MTag label={d.online ? "Online" : "Offline"} tone={d.online ? "online" : "offline"} />
            {can("tr069.execute") && (
              <>
                <MButton variant="outline" disabled={task.isPending} onClick={() => run("refresh")}>
                  <RefreshCw /> Refresh parameters
                </MButton>
                <MButton
                  variant="outline"
                  disabled={task.isPending}
                  onClick={() => setConfirmReboot(true)}
                >
                  <Power /> Reboot
                </MButton>
              </>
            )}
          </>
        }
      />
      {!d.management_enabled && (
        <p className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-2.5 text-xs">
          Management is off for this device (its customer&apos;s TR-069 is switched off, or your ISP
          credential is disabled). It stays listed, but refresh and reboot are refused.
        </p>
      )}
      {taskMessage && (
        <p role="status" className="rounded-lg border border-sky-500/40 bg-sky-500/5 p-2.5 text-xs">
          {taskMessage}
        </p>
      )}
      <FormError message={taskError} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Parameters">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
            <Row k="Uptime" v={formatDuration(p.uptime_s)} />
            <Row k="WAN IP" v={p.wan_ip ?? d.wan_ip} />
            <Row k="WAN type" v={p.wan_connection_type} />
            <Row k="PPPoE user" v={p.pppoe_username} />
            <Row k="LAN hosts" v={p.lan_hosts} />
            <Row k="Hardware" v={p.hardware_version} />
            <Row k="Software" v={p.software_version ?? d.software_version} />
            <Row k="Data model" v={d.data_model} />
            <Row
              k="Last check-in"
              v={
                <span title={formatDateTime(d.last_inform_at)}>{formatAgo(d.last_inform_at)}</span>
              }
            />
            <Row k="First seen" v={formatDateTime(d.first_seen_at)} />
            <Row k="Parameters read" v={formatDateTime(d.params_refreshed_at)} />
          </dl>
          {p.wifi.length > 0 && (
            <div className="mt-3">
              <p className="mb-1 text-xs font-semibold text-muted-foreground">WiFi</p>
              <ul className="space-y-1 text-sm">
                {p.wifi.map((w) => (
                  <li key={w.index} className="flex flex-wrap gap-x-2">
                    <span className="font-medium">{w.ssid ?? "(no SSID)"}</span>
                    <span className="text-muted-foreground">{w.band ?? ""}</span>
                    <span className="text-muted-foreground">
                      {w.enabled === false
                        ? "off"
                        : w.clients != null
                          ? `${w.clients} clients`
                          : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
        {can("tr069.manage") ? (
          <AssignCard device={d} />
        ) : (
          <Card title="Assignment">
            <p className="text-sm">{d.customer_name ?? "Unassigned"}</p>
            {d.location_name && <p className="text-xs text-muted-foreground">{d.location_name}</p>}
          </Card>
        )}
      </div>

      <Card title="Task history">
        {tasks.isLoading ? (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Spinner /> Loading…
          </p>
        ) : tasks.error ? (
          <ErrorBlock error={tasks.error} onRetry={() => tasks.refetch()} what="task history" />
        ) : (tasks.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No tasks yet.</p>
        ) : (
          <MTable
            head={
              <>
                <MTh>Task</MTh>
                <MTh>Status</MTh>
                <MTh>Queued</MTh>
                <MTh>Finished</MTh>
              </>
            }
          >
            {(tasks.data ?? []).map((t) => (
              <MTr key={t.id}>
                <MTd>{TASK_LABEL[t.kind] ?? t.kind}</MTd>
                <MTd>
                  <MTag
                    label={TASK_STATUS_LABEL[t.status] ?? t.status}
                    tone={
                      t.status === "done" ? "active" : t.status === "queued" ? "pending" : "offline"
                    }
                  />
                </MTd>
                <MTd className="text-xs">{formatDateTime(t.created_at)}</MTd>
                <MTd className="text-xs">{formatDateTime(t.completed_at)}</MTd>
              </MTr>
            ))}
          </MTable>
        )}
      </Card>

      <MDialog
        open={confirmReboot}
        onClose={() => setConfirmReboot(false)}
        title="Reboot this device?"
        footer={
          <>
            <MButton variant="outline" onClick={() => setConfirmReboot(false)}>
              Cancel
            </MButton>
            <MButton disabled={task.isPending} onClick={() => run("reboot")}>
              {task.isPending && <Spinner />} Queue reboot
            </MButton>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          The reboot is queued and runs when the device next checks in (devices behind NAT rarely
          accept an immediate request). Everyone connected through it loses internet for a minute or
          two while it restarts.
        </p>
      </MDialog>
    </>
  );
}
