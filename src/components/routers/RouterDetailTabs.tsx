import { useState } from "react";
import { toast } from "sonner";
import {
  Activity,
  AlertTriangle,
  Ban,
  BarChart3,
  CheckCircle2,
  Copy,
  DatabaseBackup,
  FileText,
  Gauge,
  History,
  KeyRound,
  Network,
  RefreshCw,
  RotateCw,
  Router as RouterIcon,
  Send,
  ShieldCheck,
  Trash2,
  Undo2,
  Upload,
  Users,
  Wifi,
  Workflow,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/common/EmptyState";
import { LoadingSkeleton } from "@/components/common/LoadingSkeleton";
import { ErrorState } from "@/components/common/ErrorState";
import { ComingSoonPanel } from "@/components/ui-ext/ComingSoonPanel";
import type { RouterDevice } from "@/types/router";
import { PEER_STATUS_LABEL } from "@/types/router";
import { RouterStatusBadge, HealthStatusBadge } from "./RouterStatusBadge";
import {
  useCreateWireGuardPeer,
  useGenerateProvisioningToken,
  useRevokeWireGuardPeer,
  useRotateWireGuardPeer,
  useWireGuardPeer,
} from "@/hooks/useRouters";
import { useAuditList } from "@/hooks/useAudit";
import {
  useBlockDevice,
  useConnectedDevices,
  useDisconnectDevice,
  useLastDeviceSyncRun,
  useSyncConnectedDevices,
  useUnblockDevice,
  useWhitelistDevice,
} from "@/hooks/useConnectedDevices";
import {
  useConfigVersions,
  useNetworkConfigPreview,
  usePushNetworkConfig,
  useRollbackNetworkConfig,
} from "@/hooks/useNetworkConfig";
import {
  useDiagnosticRuns,
  usePingRouter,
  useTracerouteRouter,
} from "@/hooks/useNetworkDiagnostics";
import {
  useConfigVersionHistory,
  useCreateBackup,
  useFactoryReset,
  useProvisioningStatus,
  useRestoreBackup,
  useRollbackConfigVersion,
  useRotateSecret,
} from "@/hooks/useRouterProvisioning";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import api from "@/services/api";
import type { AppError } from "@/services/api";
import type { WireGuardTunnelSecrets } from "@/types/router";

// The dashboard's SSH-capable config-push bridge -- a browser can't open
// an SSH connection itself, so this small agent (running alongside the
// WireGuard hub) does it, given the router's real connection info fetched
// from GET /routers/{id}/device-connection. The push itself never routes
// through the main backend.
const CONFIG_AGENT_URL = "http://20.219.72.235:9093/config/apply";
const CONFIG_AGENT_SECRET = "configagent-55952aac79cbbf5ac9dc404c228ed5b7";

interface Props {
  router: RouterDevice;
  initialTab?: string;
}

export function RouterDetailTabs({ router, initialTab = "overview" }: Props) {
  const [tab, setTab] = useState(initialTab);

  return (
    <Tabs value={tab} onValueChange={setTab} className="space-y-6">
      <div className="overflow-x-auto">
        <TabsList className="h-auto flex-wrap gap-1 bg-muted/40 p-1">
          {[
            ["overview", "Overview"],
            ["setup-script", "Setup Script"],
            ["wireguard", "WireGuard"],
            ["wifi", "Guest WiFi"],
            ["devices", "Connected Devices"],
            ["monitoring", "Monitoring"],
            ["analytics", "Analytics"],
            ["config", "Configuration"],
            ["provisioning", "Provisioning"],
            ["diagnostics", "Diagnostics"],
            ["audit", "Audit Logs"],
          ].map(([k, l]) => (
            <TabsTrigger
              key={k}
              value={k}
              className="rounded-lg px-3 py-1.5 text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
              {l}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>

      <TabsContent value="overview" className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="rounded-2xl border-border/70 shadow-sm">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Status</div>
                <RouterStatusBadge status={router.status} />
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-border/70 shadow-sm">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-sky-500/10 text-sky-500">
                <Network className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Health</div>
                <HealthStatusBadge status={router.healthStatus} />
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-border/70 shadow-sm">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-500/10 text-emerald-500">
                <KeyRound className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xs text-muted-foreground">API credentials</div>
                <div className="text-sm font-semibold">
                  {router.hasApiCredentials ? "Configured" : "Not set"}
                </div>
              </div>
            </CardContent>
          </Card>
          <ProvisioningTokenCard routerId={router.id} />
        </div>

        <Card className="rounded-2xl border-border/70">
          <CardHeader>
            <CardTitle className="text-base">Device information</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
              <Field label="Serial number" value={router.serialNumber} />
              <Field label="MAC address" value={router.macAddress} />
              <Field label="Model" value={router.model} />
              <Field label="Vendor" value={router.vendor} />
              <Field
                label="RouterOS"
                value={router.routerOsVersion ?? "Unknown (never reported)"}
              />
              <Field label="Organization" value={router.organizationName} />
              <Field label="Location" value={router.locationName} />
              <Field label="Public IP" value={router.publicIpAddress ?? "—"} />
              <Field label="Management IP" value={router.managementIpAddress ?? "—"} />
              <Field
                label="Last seen"
                value={router.lastSeenAt ? new Date(router.lastSeenAt).toLocaleString() : "Never"}
              />
              <Field
                label="Last health check"
                value={
                  router.lastHealthCheckAt
                    ? new Date(router.lastHealthCheckAt).toLocaleString()
                    : "Never"
                }
              />
              <Field label="Registered" value={new Date(router.createdAt).toLocaleString()} />
            </dl>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="setup-script">
        <SetupScriptTab routerId={router.id} />
      </TabsContent>
      <TabsContent value="wireguard">
        <WireGuardTab routerId={router.id} />
      </TabsContent>
      <TabsContent value="wifi">
        <EmptyState
          icon={Wifi}
          title="Guest WiFi SSIDs"
          description="SSIDs, VLANs and captive portal bindings served by this router."
        />
      </TabsContent>
      <TabsContent value="devices">
        <ConnectedDevicesTab routerId={router.id} />
      </TabsContent>
      <TabsContent value="monitoring">
        <ComingSoonPanel
          icon={Gauge}
          title="Monitoring"
          description="Live CPU/RAM/bandwidth telemetry rolls out once this console is wired to a real Monitoring domain — the backend itself only records a self-reported heartbeat today, not active metrics."
        />
      </TabsContent>
      <TabsContent value="analytics">
        <EmptyState
          icon={BarChart3}
          title="Analytics"
          description="Session, auth and usage breakdowns for this router."
        />
      </TabsContent>
      <TabsContent value="config">
        <ConfigTab routerId={router.id} />
      </TabsContent>
      <TabsContent value="provisioning">
        <ProvisioningTab routerId={router.id} />
      </TabsContent>
      <TabsContent value="diagnostics">
        <DiagnosticsTab routerId={router.id} />
      </TabsContent>
      <TabsContent value="audit">
        <RouterAuditTab routerId={router.id} />
      </TabsContent>
    </Tabs>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground">{value}</dd>
    </div>
  );
}

function ConnectedDevicesTab({ routerId }: { routerId: string }) {
  const { data, isLoading, isError, refetch } = useConnectedDevices(routerId);
  const { data: lastSync } = useLastDeviceSyncRun(routerId);
  const sync = useSyncConnectedDevices(routerId);
  const disconnect = useDisconnectDevice(routerId);
  const block = useBlockDevice(routerId);
  const unblock = useUnblockDevice(routerId);
  const whitelist = useWhitelistDevice(routerId);

  const rows = data?.rows ?? [];

  async function run(action: Promise<unknown>, label: string) {
    try {
      await action;
      toast.success(label);
    } catch (err) {
      toast.error((err as unknown as AppError).message || `Failed to ${label.toLowerCase()}`);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {lastSync
            ? `Last synced ${new Date(lastSync.completedAt).toLocaleString()}`
            : "Never synced"}
        </p>
        <Button
          size="sm"
          variant="outline"
          disabled={sync.isPending}
          onClick={() => run(sync.mutateAsync(), "Sync started")}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Sync now
        </Button>
      </div>

      {isLoading ? (
        <LoadingSkeleton rows={4} />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No connected devices"
          description="Run a sync to discover devices currently connected to this router."
        />
      ) : (
        <Card className="rounded-2xl border-border/70">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Device</TableHead>
                  <TableHead>MAC</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead>Connection</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last seen</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell>{d.hostname ?? d.vendor ?? "Unknown device"}</TableCell>
                    <TableCell className="font-mono text-xs">{d.macAddress}</TableCell>
                    <TableCell className="text-sm">{d.ipAddress ?? "—"}</TableCell>
                    <TableCell className="text-sm">{d.connectionType}</TableCell>
                    <TableCell>
                      <Badge variant={d.isActive ? "default" : "outline"}>
                        {d.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {d.lastSeenAt ? new Date(d.lastSeenAt).toLocaleString() : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          title="Disconnect"
                          onClick={() =>
                            run(disconnect.mutateAsync({ deviceId: d.id }), "Device disconnected")
                          }
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          title="Block"
                          onClick={() => run(block.mutateAsync({ deviceId: d.id }), "Device blocked")}
                        >
                          <Ban className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          title="Unblock"
                          onClick={() =>
                            run(unblock.mutateAsync({ deviceId: d.id }), "Device unblocked")
                          }
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          title="Whitelist"
                          onClick={() =>
                            run(whitelist.mutateAsync({ deviceId: d.id }), "Device whitelisted")
                          }
                        >
                          <ShieldCheck className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ConfigTab({ routerId }: { routerId: string }) {
  const preview = useNetworkConfigPreview(routerId);
  const versions = useConfigVersions(routerId);
  const push = usePushNetworkConfig(routerId);
  const rollback = useRollbackNetworkConfig(routerId);
  const [applying, setApplying] = useState(false);

  async function handlePush() {
    try {
      const result = await push.mutateAsync();
      const rendered = result?.version?.renderedContent;
      if (!rendered) {
        toast.success("Nothing to apply -- config is empty");
        return;
      }

      // The record (ConfigVersion/ProvisioningJob) now exists; actually
      // getting it onto the device is this dashboard's own job -- fetch
      // the router's real connection info, then hand the rendered script
      // to the SSH-capable agent directly (no backend involvement in the
      // push itself).
      setApplying(true);
      const conn = await api.get<{ host: string | null; username: string | null; password: string | null }>(
        `/routers/${routerId}/device-connection`,
      );
      if (!conn.data.host || !conn.data.username || !conn.data.password) {
        toast.error("Router has no stored connection details -- can't apply live.");
        return;
      }
      const applyResp = await fetch(CONFIG_AGENT_URL, {
        method: "POST",
        headers: { "X-Agent-Secret": CONFIG_AGENT_SECRET, "Content-Type": "application/json" },
        body: JSON.stringify({
          tunnel_ip: conn.data.host,
          username: conn.data.username,
          password: conn.data.password,
          script: rendered,
        }),
      });
      const applyResult = await applyResp.json();
      if (applyResp.ok && applyResult.applied) {
        toast.success("Config applied to the live device");
      } else {
        toast.error(`Queued, but live apply failed: ${applyResult.detail || applyResult.error || "unknown error"}`);
      }
    } catch (err) {
      toast.error((err as unknown as AppError).message || "Failed to push config");
    } finally {
      setApplying(false);
    }
  }

  async function handleRollback(versionId: string) {
    try {
      await rollback.mutateAsync(versionId);
      toast.success("Rollback queued");
    } catch (err) {
      toast.error((err as unknown as AppError).message || "Failed to roll back");
    }
  }

  if (preview.isLoading || versions.isLoading) return <LoadingSkeleton rows={4} />;
  if (preview.isError || versions.isError) {
    return <ErrorState onRetry={() => { preview.refetch(); versions.refetch(); }} />;
  }

  return (
    <div className="space-y-4">
      <Card className="rounded-2xl border-border/70">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Rendered configuration preview</CardTitle>
            <p className="text-sm text-muted-foreground">
              {preview.data?.dhcpPoolCount ?? 0} DHCP pools · {preview.data?.vlanCount ?? 0} VLANs ·{" "}
              {preview.data?.firewallRuleCount ?? 0} firewall rules ·{" "}
              {preview.data?.portForwardingRuleCount ?? 0} port-forward rules
            </p>
          </div>
          <Button size="sm" disabled={push.isPending || applying} onClick={handlePush}>
            <Send className="mr-2 h-4 w-4" />
            {applying ? "Applying to device..." : "Push config"}
          </Button>
        </CardHeader>
        <CardContent>
          <pre className="max-h-64 overflow-auto rounded-lg bg-muted/40 p-3 text-xs">
            {preview.data?.renderedContent || "No config rendered yet."}
          </pre>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/70">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4" />
            Version history
          </CardTitle>
        </CardHeader>
        <CardContent>
          {versions.data?.rows.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Version</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Applied</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {versions.data.rows.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell>v{v.versionNumber}{v.isBackup ? " (backup)" : ""}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{v.status}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {v.appliedAt ? new Date(v.appliedAt).toLocaleString() : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={rollback.isPending}
                        onClick={() => handleRollback(v.id)}
                      >
                        <Undo2 className="mr-2 h-3.5 w-3.5" />
                        Roll back
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <EmptyState
              icon={History}
              title="No config versions yet"
              description="Push a config to create the first version."
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ProvisioningTab({ routerId }: { routerId: string }) {
  const status = useProvisioningStatus(routerId);
  const versions = useConfigVersionHistory(routerId);
  const rollback = useRollbackConfigVersion(routerId);
  const backup = useCreateBackup(routerId);
  const restore = useRestoreBackup(routerId);
  const factoryReset = useFactoryReset(routerId);
  const rotateSecret = useRotateSecret(routerId);
  const [confirmReset, setConfirmReset] = useState(false);
  const [newSecret, setNewSecret] = useState<string | null>(null);

  async function handleRollback(versionId: string) {
    try {
      await rollback.mutateAsync(versionId);
      toast.success("Rollback queued");
    } catch (err) {
      toast.error((err as unknown as AppError).message || "Failed to roll back");
    }
  }
  async function handleBackup() {
    try {
      await backup.mutateAsync();
      toast.success("Backup job queued");
    } catch (err) {
      toast.error((err as unknown as AppError).message || "Failed to queue backup");
    }
  }
  async function handleRestore(backupVersionId: string) {
    try {
      await restore.mutateAsync(backupVersionId);
      toast.success("Restore job queued");
    } catch (err) {
      toast.error((err as unknown as AppError).message || "Failed to queue restore");
    }
  }
  async function handleFactoryReset() {
    try {
      await factoryReset.mutateAsync();
      toast.success("Factory reset job queued");
    } catch (err) {
      toast.error((err as unknown as AppError).message || "Failed to queue factory reset");
    } finally {
      setConfirmReset(false);
    }
  }
  async function handleRotateSecret() {
    try {
      const r = await rotateSecret.mutateAsync();
      setNewSecret(r.newSecret);
    } catch (err) {
      toast.error((err as unknown as AppError).message || "Failed to rotate secret");
    }
  }

  if (status.isLoading || versions.isLoading) return <LoadingSkeleton rows={4} />;
  if (status.isError || versions.isError) {
    return <ErrorState onRetry={() => { status.refetch(); versions.refetch(); }} />;
  }

  const backupVersions = versions.data?.rows.filter((v) => v.isBackup) ?? [];

  return (
    <div className="space-y-4">
      {newSecret && (
        <Card className="rounded-2xl border-primary/40 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-base">New API secret — shown once</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <KeyRow label="New secret" value={newSecret} />
            <p className="text-xs text-muted-foreground">
              Store this now — it will not be shown again.
            </p>
          </CardContent>
        </Card>
      )}

      <Card className="rounded-2xl border-border/70">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Workflow className="h-4 w-4" />
            Provisioning status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <dl className="grid grid-cols-1 gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
            <Field label="Router status" value={status.data?.routerStatus ?? "—"} />
            <Field
              label="Current config version"
              value={status.data?.latestVersion ? `v${status.data.latestVersion.versionNumber}` : "None"}
            />
          </dl>
          {status.data?.activeJobs.length ? (
            <div className="space-y-1.5">
              <div className="text-xs font-medium text-muted-foreground">Active jobs</div>
              {status.data.activeJobs.map((j) => (
                <div key={j.id} className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-1.5 text-xs">
                  <span>{j.jobType.replace(/_/g, " ")}</span>
                  <Badge variant="outline">{j.status}</Badge>
                </div>
              ))}
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2 pt-1">
            <Button size="sm" variant="outline" disabled={backup.isPending} onClick={handleBackup}>
              <DatabaseBackup className="mr-2 h-3.5 w-3.5" />
              Backup now
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={rotateSecret.isPending}
              onClick={handleRotateSecret}
            >
              <KeyRound className="mr-2 h-3.5 w-3.5" />
              Rotate API secret
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={factoryReset.isPending}
              onClick={() => setConfirmReset(true)}
            >
              <AlertTriangle className="mr-2 h-3.5 w-3.5" />
              Factory reset
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/70">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4" />
            Config version history
          </CardTitle>
        </CardHeader>
        <CardContent>
          {versions.data?.rows.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Version</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Applied</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {versions.data.rows.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell>v{v.versionNumber}{v.isBackup ? " (backup)" : ""}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{v.status}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {v.appliedAt ? new Date(v.appliedAt).toLocaleString() : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={rollback.isPending}
                          onClick={() => handleRollback(v.id)}
                        >
                          <Undo2 className="mr-2 h-3.5 w-3.5" />
                          Roll back
                        </Button>
                        {v.isBackup && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={restore.isPending}
                            onClick={() => handleRestore(v.id)}
                          >
                            <Upload className="mr-2 h-3.5 w-3.5" />
                            Restore
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <EmptyState
              icon={History}
              title="No config versions yet"
              description={`No versions recorded. ${backupVersions.length} backup(s) available.`}
            />
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmReset}
        onOpenChange={setConfirmReset}
        title="Factory reset this router?"
        description="This queues a factory-reset job on the physical device. This cannot be undone."
        confirmLabel="Factory reset"
        destructive
        onConfirm={handleFactoryReset}
      />
    </div>
  );
}

function DiagnosticsTab({ routerId }: { routerId: string }) {
  const [target, setTarget] = useState("");
  const runs = useDiagnosticRuns(routerId);
  const ping = usePingRouter(routerId);
  const traceroute = useTracerouteRouter(routerId);

  async function handlePing() {
    if (!target.trim()) return;
    try {
      await ping.mutateAsync(target.trim());
      toast.success("Ping complete");
    } catch (err) {
      toast.error((err as unknown as AppError).message || "Ping failed");
    }
  }

  async function handleTraceroute() {
    if (!target.trim()) return;
    try {
      await traceroute.mutateAsync(target.trim());
      toast.success("Traceroute complete");
    } catch (err) {
      toast.error((err as unknown as AppError).message || "Traceroute failed");
    }
  }

  return (
    <div className="space-y-4">
      <Card className="rounded-2xl border-border/70">
        <CardHeader>
          <CardTitle className="text-base">Run diagnostic</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="Target host or IP"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            className="max-w-xs"
          />
          <Button size="sm" variant="outline" disabled={ping.isPending} onClick={handlePing}>
            <Activity className="mr-2 h-4 w-4" />
            Ping
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={traceroute.isPending}
            onClick={handleTraceroute}
          >
            <Network className="mr-2 h-4 w-4" />
            Traceroute
          </Button>
        </CardContent>
      </Card>

      {runs.isLoading ? (
        <LoadingSkeleton rows={3} />
      ) : runs.isError ? (
        <ErrorState onRetry={() => runs.refetch()} />
      ) : !runs.data?.rows.length ? (
        <EmptyState
          icon={Activity}
          title="No diagnostic runs yet"
          description="Ping or traceroute a target to see results here."
        />
      ) : (
        <Card className="rounded-2xl border-border/70">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Run at</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.data.rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="capitalize">{r.diagnosticType}</TableCell>
                    <TableCell>{r.target}</TableCell>
                    <TableCell>
                      <Badge variant={r.status === "completed" ? "default" : "outline"}>
                        {r.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(r.createdAt).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function RouterAuditTab({ routerId }: { routerId: string }) {
  // Backend's /audit/entries only filters by entity_type, not a specific
  // entity_id (see backend/app/domains/audit/router.py) -- fetch every
  // router-entity entry and narrow to this router client-side.
  const { data, isLoading, isError, refetch } = useAuditList({
    entityType: "router",
    page: 1,
    pageSize: 100,
  });
  const rows = (data?.rows ?? []).filter((e) => e.entityId === routerId);

  if (isLoading) return <LoadingSkeleton rows={4} />;
  if (isError) return <ErrorState onRetry={() => refetch()} />;
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="No audit entries yet"
        description="Actions taken on this router will appear here."
      />
    );
  }

  return (
    <Card className="rounded-2xl border-border/70">
      <CardHeader>
        <CardTitle className="text-base">Audit log</CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="relative space-y-4 border-l border-border/60 pl-6">
          {rows.map((e) => (
            <li key={e.id} className="relative">
              <span className="absolute -left-[31px] top-1 flex h-6 w-6 items-center justify-center rounded-full border border-border/60 bg-background shadow-sm">
                <FileText className="h-3.5 w-3.5 text-muted-foreground" />
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">{e.action.replace(/_/g, " ")}</span>
                <span className="ml-auto text-[11px] text-muted-foreground">
                  {new Date(e.createdAt).toLocaleString()}
                </span>
              </div>
              {e.description && (
                <p className="text-xs text-muted-foreground">{e.description}</p>
              )}
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}

function ProvisioningTokenCard({ routerId }: { routerId: string }) {
  const generate = useGenerateProvisioningToken();
  const [reveal, setReveal] = useState<{ token: string; expiresAt: string } | null>(null);

  return (
    <Card className="rounded-2xl border-border/70 shadow-sm sm:col-span-2 lg:col-span-1">
      <CardContent className="flex flex-col gap-2 p-4">
        <div className="text-xs text-muted-foreground">Provisioning token</div>
        {reveal ? (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <code className="truncate text-xs">{reveal.token}</code>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => {
                  navigator.clipboard.writeText(reveal.token);
                  toast.success("Copied");
                }}
              >
                <Copy className="h-3 w-3" />
              </Button>
            </div>
            <div className="text-[11px] text-muted-foreground">
              Shown once. Expires {new Date(reveal.expiresAt).toLocaleString()}.
            </div>
          </div>
        ) : (
          <Button
            size="sm"
            variant="outline"
            disabled={generate.isPending}
            onClick={async () => {
              try {
                const r = await generate.mutateAsync(routerId);
                setReveal({ token: r.token, expiresAt: r.expiresAt });
              } catch (err) {
                toast.error((err as unknown as AppError).message || "Failed to generate token");
              }
            }}
          >
            Generate token
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

/** Builds a single one-paste MikroTik RouterOS script: 1-3 DHCP WAN links
 * (failover via distance ordering when >1), LAN bridge + Hotspot (guest
 * WiFi), basic firewall, and platform check-in + a recurring heartbeat
 * scheduler -- agent credential already baked in, no on-router token
 * exchange needed. Pure string templating, no I/O.
 *
 * Load-balancing (PCC) is deliberately out of scope here: it needs each
 * WAN's actual gateway IP to build routing-mark routes, which isn't known
 * ahead of time for a DHCP-assigned link -- generating that blind risks
 * silently breaking the router's internet. Failover (distance-ordered
 * default routes, each independently health-checked by RouterOS's own
 * DHCP client) needs no such assumption and is what's implemented for
 * every WAN count. */
export interface WireguardPeerInfo {
  routerPrivateKey: string;
  serverPublicKey: string;
  routerTunnelIp: string;
  serverEndpointHost: string;
  serverEndpointPort: string;
  tunnelSubnet: string;
}

export function buildRouterSetupScript(opts: {
  apiBase: string;
  agentCredential: string;
  wanIfs: string[];
  lanBridge: string;
  lanIp: string;
  lanCidr: string;
  dnsServers: string;
  hsUser: string;
  hsPass: string;
  enableFirewall: boolean;
  wireguard?: WireguardPeerInfo;
  radius?: { serverAddress: string; sharedSecret: string };
  /** RouterOS API service + a dedicated login for the platform's own
   * control-plane calls (Device Console, VLAN/DHCP pushes, diagnostics) --
   * distinct from `agentCredential` above, which only authenticates the
   * router's one-way heartbeat back to the platform. Without this, every
   * router this script provisions starts with Device Console permanently
   * disabled for it ("no credentials"), needing a separate manual step. */
  apiAccess?: { username: string; secret: string };
}): string {
  const { apiBase, agentCredential, wanIfs, lanBridge, lanIp, lanCidr, dnsServers, hsUser, hsPass, enableFirewall, wireguard, radius, apiAccess } = opts;
  const octets = lanIp.split(".");
  const base3 = octets.slice(0, 3).join(".");
  const poolStart = `${base3}.10`;
  const poolEnd = `${base3}.254`;
  const lanNetwork = `${base3}.0/${lanCidr}`;

  const lines: string[] = [];
  lines.push("{");
  lines.push(`:local apiBase "${apiBase}"`);
  lines.push(`:local agentCredential "${agentCredential}"`);
  lines.push(`:local lanBridge "${lanBridge}"`);
  lines.push(`:local lanIp "${lanIp}"`);
  lines.push(`:local lanCidr "${lanCidr}"`);
  lines.push(`:local lanNetwork "${lanNetwork}"`);
  lines.push(`:local poolStart "${poolStart}"`);
  lines.push(`:local poolEnd "${poolEnd}"`);
  lines.push("");
  lines.push(`:if ([:len [/interface list find where name="WAN"]] = 0) do={ /interface list add name="WAN" }`);
  // A fully factory-reset device (no default configuration kept) has no
  // "bridge" interface at all -- every line below that binds something to
  // $lanBridge (IP address, DHCP server, hotspot) would otherwise fail with
  // "input does not match any value of interface". Safe to run even when a
  // same-named bridge already exists (e.g. the stock default config).
  lines.push(`:if ([:len [/interface bridge find where name=$lanBridge]] = 0) do={`);
  lines.push(`  /interface bridge add name=$lanBridge`);
  lines.push(`}`);
  // A pre-existing default-config bridge (comment "defconf") starts
  // disabled on some factory images -- confirmed live on a real device.
  lines.push(`/interface bridge set [find name=$lanBridge] disabled=no`);

  // WAN IP acquisition (DHCP vs. a leased-line's static IP/gateway) is
  // deliberately NOT handled here -- the field engineer sets that up
  // manually on-site first (via /ip address or /ip dhcp-client directly in
  // WinBox, whichever the actual ISP connection needs), since only they
  // know which this link is. This script only wires each already-connected
  // WAN interface into the "WAN" interface list and NAT, which is the same
  // regardless of how the IP itself was obtained.
  wanIfs.forEach((wanIf, idx) => {
    const n = idx + 1;
    const v = `wan${n}If`;
    lines.push(`:local ${v} "${wanIf}"`);
    lines.push(`:local wan${n}Port [/interface bridge port find where interface=$${v}]`);
    lines.push(`:if ([:len $wan${n}Port] > 0) do={ /interface bridge port remove $wan${n}Port }`);
    lines.push(`:if ([:len [/interface list member find where interface=$${v} list="WAN"]] = 0) do={ /interface list member add list="WAN" interface=$${v} }`);
    lines.push(`:if ([:len [/ip firewall nat find where chain=srcnat out-interface=$${v} action=masquerade]] = 0) do={`);
    lines.push(`  /ip firewall nat add chain=srcnat out-interface=$${v} action=masquerade comment="cloudguest-nat-wan${n}"`);
    lines.push(`}`);
  });

  lines.push("");
  // Every other physical ethernet port (i.e. not one of the WAN interfaces
  // above) becomes a LAN bridge member -- without this, the hotspot/DHCP
  // server this script sets up has no physical port actually wired to it,
  // so no guest device plugged into the router can ever reach it. Matches
  // by RouterOS's own ether-type interfaces (whatever they're named --
  // "ether1", "eth1", or a custom-renamed identity all show up here),
  // not a hardcoded name pattern.
  // Confirmed live on a real device: some units ship with a *second*,
  // hardware-switch default bridge (seen as "bridgeLocal", comment
  // "defconf") that silently pre-claims every physical port. Unconditionally
  // detaches a port from whatever bridge it's currently in (if any) before
  // re-attaching it to ours, rather than skipping it just because it
  // already belonged to *some* bridge.
  const wanNameLiterals = wanIfs.map((w) => `"${w}"`).join("; ");
  lines.push(`:local wanIfNames {${wanNameLiterals}}`);
  lines.push(`:foreach eth in=[/interface ethernet find] do={`);
  lines.push(`  :local ethName [/interface ethernet get $eth name]`);
  lines.push(`  :local isWan false`);
  lines.push(`  :foreach w in=$wanIfNames do={ :if ($w = $ethName) do={ :set isWan true } }`);
  lines.push(`  :if (!$isWan) do={`);
  lines.push(`    :local existingPort [/interface bridge port find where interface=$ethName]`);
  lines.push(`    :if ([:len $existingPort] > 0) do={`);
  lines.push(`      :if ([:len [/interface bridge port find where interface=$ethName bridge=$lanBridge]] = 0) do={`);
  lines.push(`        /interface bridge port remove $existingPort`);
  lines.push(`        /interface bridge port add bridge=$lanBridge interface=$ethName`);
  lines.push(`      }`);
  lines.push(`    } else={`);
  lines.push(`      /interface bridge port add bridge=$lanBridge interface=$ethName`);
  lines.push(`    }`);
  lines.push(`  }`);
  lines.push(`}`);

  lines.push("");
  lines.push(`:foreach addr in=[/ip address find where interface=$lanBridge dynamic=yes] do={ /ip address remove $addr }`);
  lines.push(`:if ([:len [/ip address find where interface=$lanBridge address=($lanIp . "/" . $lanCidr)]] = 0) do={`);
  lines.push(`  /ip address add address=($lanIp . "/" . $lanCidr) interface=$lanBridge`);
  lines.push(`}`);
  lines.push(`/ip dns set servers=${dnsServers} allow-remote-requests=yes`);

  lines.push("");
  lines.push(`:if ([:len [/ip pool find where name="hotspot-pool"]] = 0) do={`);
  lines.push(`  /ip pool add name="hotspot-pool" ranges=($poolStart . "-" . $poolEnd)`);
  lines.push(`}`);
  lines.push(`:if ([:len [/ip dhcp-server find where interface=$lanBridge]] = 0) do={`);
  lines.push(`  /ip dhcp-server add name="hotspot-dhcp" interface=$lanBridge address-pool="hotspot-pool" disabled=no`);
  lines.push(`  /ip dhcp-server network add address=$lanNetwork gateway=$lanIp dns-server=$lanIp`);
  lines.push(`}`);
  lines.push(`:if ([:len [/ip hotspot profile find where name="hsprof1"]] = 0) do={`);
  lines.push(`  /ip hotspot profile add name="hsprof1" hotspot-address=$lanIp html-directory=cloudguest-hotspot`);
  lines.push(`}`);
  lines.push(`:if ([:len [/ip hotspot find where interface=$lanBridge]] = 0) do={`);
  lines.push(`  /ip hotspot add name="hotspot1" interface=$lanBridge address-pool="hotspot-pool" profile="hsprof1" disabled=no`);
  lines.push(`}`);
  lines.push(`:if ([:len [/ip hotspot user find where name="${hsUser}"]] = 0) do={`);
  lines.push(`  /ip hotspot user add name="${hsUser}" password="${hsPass}" server="hotspot1"`);
  lines.push(`}`);

  if (enableFirewall) {
    lines.push("");
    lines.push(`:if ([:len [/ip firewall filter find where comment="cloudguest-fw-established"]] = 0) do={`);
    lines.push(`  /ip firewall filter add chain=input connection-state=established,related action=accept comment="cloudguest-fw-established"`);
    lines.push(`}`);
    lines.push(`:if ([:len [/ip firewall filter find where comment="cloudguest-fw-drop-invalid"]] = 0) do={`);
    lines.push(`  /ip firewall filter add chain=input connection-state=invalid action=drop comment="cloudguest-fw-drop-invalid"`);
    lines.push(`}`);
    lines.push(`:if ([:len [/ip firewall filter find where comment="cloudguest-fw-allow-lan"]] = 0) do={`);
    lines.push(`  /ip firewall filter add chain=input in-interface=$lanBridge action=accept comment="cloudguest-fw-allow-lan"`);
    lines.push(`}`);
    lines.push(`:if ([:len [/ip firewall filter find where comment="cloudguest-fw-allow-icmp"]] = 0) do={`);
    lines.push(`  /ip firewall filter add chain=input protocol=icmp action=accept comment="cloudguest-fw-allow-icmp"`);
    lines.push(`}`);
    lines.push(`:if ([:len [/ip firewall filter find where comment="cloudguest-fw-drop-wan-input"]] = 0) do={`);
    lines.push(`  /ip firewall filter add chain=input in-interface-list=WAN action=drop comment="cloudguest-fw-drop-wan-input"`);
    lines.push(`}`);
    lines.push(`:if ([:len [/ip firewall filter find where comment="cloudguest-fw-fwd-established"]] = 0) do={`);
    lines.push(`  /ip firewall filter add chain=forward connection-state=established,related action=accept comment="cloudguest-fw-fwd-established"`);
    lines.push(`}`);
    lines.push(`:if ([:len [/ip firewall filter find where comment="cloudguest-fw-fwd-drop-invalid"]] = 0) do={`);
    lines.push(`  /ip firewall filter add chain=forward connection-state=invalid action=drop comment="cloudguest-fw-fwd-drop-invalid"`);
    lines.push(`}`);
  }

  if (wireguard) {
    lines.push("");
    lines.push(`:if ([:len [/interface wireguard find where name="wg-cloudguest"]] = 0) do={`);
    lines.push(`  /interface wireguard add name="wg-cloudguest" private-key="${wireguard.routerPrivateKey}" listen-port=13231`);
    lines.push(`}`);
    lines.push(`:if ([:len [/interface wireguard peers find where interface="wg-cloudguest"]] = 0) do={`);
    lines.push(`  /interface wireguard peers add interface="wg-cloudguest" public-key="${wireguard.serverPublicKey}" endpoint-address="${wireguard.serverEndpointHost}" endpoint-port=${wireguard.serverEndpointPort} allowed-address="${wireguard.tunnelSubnet}" persistent-keepalive=25s`);
    lines.push(`}`);
    lines.push(`:if ([:len [/ip address find where interface="wg-cloudguest"]] = 0) do={`);
    lines.push(`  /ip address add address="${wireguard.routerTunnelIp}/24" interface="wg-cloudguest"`);
    lines.push(`}`);
  }

  if (radius) {
    lines.push("");
    lines.push(`:if ([:len [/radius find where address="${radius.serverAddress}"]] = 0) do={`);
    lines.push(`  /radius add service=hotspot address="${radius.serverAddress}" secret="${radius.sharedSecret}"`);
    lines.push(`}`);
    lines.push(`/ip hotspot profile set [find name="hsprof1"] use-radius=yes radius-accounting=yes`);
  }

  if (apiAccess) {
    lines.push("");
    lines.push(`/ip service set api disabled=no`);
    lines.push(`:if ([:len [/user find where name="${apiAccess.username}"]] = 0) do={`);
    lines.push(`  /user add name="${apiAccess.username}" password="${apiAccess.secret}" group=full comment="cloudguest-api"`);
    lines.push(`} else={`);
    lines.push(`  /user set [find name="${apiAccess.username}"] password="${apiAccess.secret}"`);
    lines.push(`}`);
  }

  lines.push("");
  lines.push(`:if ([:len [/system scheduler find name="cloudguest-heartbeat-sched"]] = 0) do={`);
  lines.push(`  /system scheduler add name="cloudguest-heartbeat-sched" interval=5m on-event=("/tool fetch url=\\"" . $apiBase . "/agent/heartbeat\\" http-method=post http-header-field=\\"Content-Type: application/json,X-Agent-Credential: " . $agentCredential . "\\" http-data=\\"{}\\" output=none")`);
  lines.push(`}`);
  lines.push(`/tool fetch url=($apiBase . "/agent/heartbeat") http-method=post http-header-field=("Content-Type: application/json,X-Agent-Credential: " . $agentCredential) http-data="{}" output=none`);
  lines.push("");
  const extras = [wireguard && "WireGuard", radius && "RADIUS", apiAccess && "API access"].filter(Boolean).join(" + ");
  lines.push(`:put "LIVE. ${wanIfs.length} WAN(s) + Hotspot + firewall + heartbeat${extras ? " + " + extras : ""} sab set ho gaya."`);
  lines.push("}");

  return lines.join("\n");
}

export interface RouterSetupScriptChunk {
  label: string;
  script: string;
}

/** Same configuration as `buildRouterSetupScript`, split into small,
 * independently-pasteable pieces instead of one giant `{ ... }` block --
 * confirmed live on a real device that WinBox's terminal can drop/mangle
 * characters on a very long single paste (many long lines, deep `{}`
 * nesting), corrupting the RouterOS parse partway through with no clean
 * way to tell which line actually failed. Each chunk here uses literal
 * values instead of shared `:local` variables (proven live, this same
 * session) so it's safe to paste standalone, in any order, and to re-run
 * if something goes wrong -- unlike the single-block version, nothing here
 * depends on an earlier chunk having already run in the same console
 * session. */
export function buildRouterSetupScriptChunks(opts: {
  apiBase: string;
  agentCredential: string;
  wanIfs: string[];
  lanBridge: string;
  lanIp: string;
  lanCidr: string;
  dnsServers: string;
  hsUser: string;
  hsPass: string;
  enableFirewall: boolean;
  wireguard?: WireguardPeerInfo;
  radius?: { serverAddress: string; sharedSecret: string };
  apiAccess?: { username: string; secret: string };
  /** RouterOS's own device identity (shown in the CLI prompt, e.g.
   * `[admin@gurgaon-branch] >`) -- set to the location name so a field
   * engineer connecting to a random router in the fleet immediately knows
   * which site it is, without cross-referencing the dashboard. */
  identity?: string;
}): RouterSetupScriptChunk[] {
  const { apiBase, agentCredential, wanIfs, lanBridge, lanIp, lanCidr, dnsServers, hsUser, hsPass, enableFirewall, wireguard, radius, apiAccess, identity } = opts;
  const base3 = lanIp.split(".").slice(0, 3).join(".");
  const poolStart = `${base3}.10`;
  const poolEnd = `${base3}.254`;
  const lanNetwork = `${base3}.0/${lanCidr}`;
  const chunks: RouterSetupScriptChunk[] = [];

  {
    const lines: string[] = [];
    lines.push(`:if ([:len [/interface list find where name="WAN"]] = 0) do={ /interface list add name="WAN" }`);
    lines.push(`:if ([:len [/interface bridge find where name="${lanBridge}"]] = 0) do={ /interface bridge add name="${lanBridge}" }`);
    lines.push(`/interface bridge set [find name="${lanBridge}"] disabled=no`);
    wanIfs.forEach((wanIf, idx) => {
      const n = idx + 1;
      lines.push(`:local wan${n}Port [/interface bridge port find where interface="${wanIf}"]`);
      lines.push(`:if ([:len $wan${n}Port] > 0) do={ /interface bridge port remove $wan${n}Port }`);
      lines.push(`:if ([:len [/interface list member find where interface="${wanIf}" list="WAN"]] = 0) do={ /interface list member add list="WAN" interface="${wanIf}" }`);
      lines.push(`:if ([:len [/ip firewall nat find where chain=srcnat out-interface="${wanIf}" action=masquerade]] = 0) do={ /ip firewall nat add chain=srcnat out-interface="${wanIf}" action=masquerade comment="cloudguest-nat-wan${n}" }`);
    });
    chunks.push({ label: "WAN + Bridge", script: lines.join("\n") });
  }

  {
    // Confirmed live on a real device: some units ship with a *second*,
    // hardware-switch default bridge (seen as "bridgeLocal", comment
    // "defconf") that silently pre-claims every physical port -- MikroTik's
    // own default-configuration docs only ever document a single "bridge",
    // so this isn't something to expect universally, but it's real on at
    // least some units/switch chips. The old version of this loop only
    // checked "is this port a member of *any* bridge" and skipped it if
    // so -- which meant a port already sitting in that other bridge was
    // silently left there forever, never joining ours, so the hotspot/DHCP
    // this script sets up had no physical port actually wired to it (no
    // guest device could get an IP at all). Now unconditionally detaches
    // from whatever bridge a port is currently in (if any) before
    // re-attaching it to ours, regardless of that other bridge's name.
    const wanNameLiterals = wanIfs.map((w) => `"${w}"`).join("; ");
    const lines = [
      `:local wanIfNames {${wanNameLiterals}}`,
      `:foreach eth in=[/interface ethernet find] do={`,
      `  :local ethName [/interface ethernet get $eth name]`,
      `  :local isWan false`,
      `  :foreach w in=$wanIfNames do={ :if ($w = $ethName) do={ :set isWan true } }`,
      `  :if (!$isWan) do={`,
      `    :local existingPort [/interface bridge port find where interface=$ethName]`,
      `    :if ([:len $existingPort] > 0) do={`,
      `      :if ([:len [/interface bridge port find where interface=$ethName bridge="${lanBridge}"]] = 0) do={`,
      `        /interface bridge port remove $existingPort`,
      `        /interface bridge port add bridge="${lanBridge}" interface=$ethName`,
      `      }`,
      `    } else={`,
      `      /interface bridge port add bridge="${lanBridge}" interface=$ethName`,
      `    }`,
      `  }`,
      `}`,
    ];
    chunks.push({ label: "LAN Ports (add every non-WAN port to the bridge)", script: lines.join("\n") });
  }

  {
    const lines = [
      `:foreach addr in=[/ip address find where interface="${lanBridge}" dynamic=yes] do={ /ip address remove $addr }`,
      `:if ([:len [/ip address find where interface="${lanBridge}" address="${lanIp}/${lanCidr}"]] = 0) do={ /ip address add address=${lanIp}/${lanCidr} interface="${lanBridge}" }`,
      `/ip dns set servers=${dnsServers} allow-remote-requests=yes`,
    ];
    chunks.push({ label: "LAN IP + DNS", script: lines.join("\n") });
  }

  {
    const lines = [
      `:if ([:len [/ip pool find where name="hotspot-pool"]] = 0) do={ /ip pool add name="hotspot-pool" ranges=${poolStart}-${poolEnd} }`,
      `:if ([:len [/ip dhcp-server find where interface="${lanBridge}"]] = 0) do={`,
      `  /ip dhcp-server add name="hotspot-dhcp" interface="${lanBridge}" address-pool="hotspot-pool" disabled=no`,
      `  /ip dhcp-server network add address=${lanNetwork} gateway=${lanIp} dns-server=${lanIp}`,
      `}`,
      `:if ([:len [/ip hotspot profile find where name="hsprof1"]] = 0) do={ /ip hotspot profile add name="hsprof1" hotspot-address=${lanIp} html-directory=cloudguest-hotspot }`,
      `:if ([:len [/ip hotspot find where interface="${lanBridge}"]] = 0) do={ /ip hotspot add name="hotspot1" interface="${lanBridge}" address-pool="hotspot-pool" profile="hsprof1" disabled=no }`,
      `:if ([:len [/ip hotspot user find where name="${hsUser}"]] = 0) do={ /ip hotspot user add name="${hsUser}" password="${hsPass}" server="hotspot1" }`,
    ];
    chunks.push({ label: "Hotspot", script: lines.join("\n") });
  }

  // Confirmed live: an unauthenticated guest's browser can silently bypass
  // the whole captive-portal redirect via DNS-over-HTTPS/TLS (Chrome/Edge/
  // Firefox/Windows all default to it in some configuration) -- it talks
  // straight to a public resolver over an encrypted channel the hotspot
  // has no valid certificate for, so the request just fails outright
  // instead of triggering a redirect, and the guest sees "site can't be
  // reached" instead of the login page. Per-device "turn off Secure DNS"
  // isn't realistic to ask of every guest, so this blocks the well-known
  // public DoH/DoT resolver IPs (and all DoT, port 853) for
  // *unauthenticated* hotspot traffic only (`hotspot=!auth` -- once a
  // guest logs in, none of this applies to them). A clean drop (not a
  // redirect) is what reliably triggers each browser's own automatic
  // fallback to normal DNS, which the hotspot already correctly
  // intercepts. Always on, not behind a checkbox -- there's no real
  // scenario where a captive portal wants to skip this.
  {
    const dohIps = [
      "1.1.1.1", "1.0.0.1", // Cloudflare
      "8.8.8.8", "8.8.4.4", // Google
      "9.9.9.9", "149.112.112.112", // Quad9
      "208.67.222.222", "208.67.220.220", // OpenDNS
      "94.140.14.14", "94.140.15.15", // AdGuard
    ];
    const lines: string[] = [];
    lines.push(`:if ([:len [/ip firewall address-list find where list="cloudguest-doh-ips"]] = 0) do={`);
    dohIps.forEach((ip) => {
      lines.push(`  /ip firewall address-list add list="cloudguest-doh-ips" address=${ip} comment="cloudguest-doh"`);
    });
    lines.push(`}`);
    lines.push(`:if ([:len [/ip firewall filter find where comment="cloudguest-block-dot-udp"]] = 0) do={ /ip firewall filter add chain=forward hotspot=!auth protocol=udp dst-port=853 action=drop comment="cloudguest-block-dot-udp" }`);
    lines.push(`:if ([:len [/ip firewall filter find where comment="cloudguest-block-dot-tcp"]] = 0) do={ /ip firewall filter add chain=forward hotspot=!auth protocol=tcp dst-port=853 action=drop comment="cloudguest-block-dot-tcp" }`);
    lines.push(`:if ([:len [/ip firewall filter find where comment="cloudguest-block-doh"]] = 0) do={ /ip firewall filter add chain=forward hotspot=!auth protocol=tcp dst-port=443 dst-address-list=cloudguest-doh-ips action=drop comment="cloudguest-block-doh" }`);
    chunks.push({ label: "Block DNS-over-HTTPS (forces captive portal to actually show)", script: lines.join("\n") });
  }

  if (enableFirewall) {
    const lines = [
      `:if ([:len [/ip firewall filter find where comment="cloudguest-fw-established"]] = 0) do={ /ip firewall filter add chain=input connection-state=established,related action=accept comment="cloudguest-fw-established" }`,
      `:if ([:len [/ip firewall filter find where comment="cloudguest-fw-drop-invalid"]] = 0) do={ /ip firewall filter add chain=input connection-state=invalid action=drop comment="cloudguest-fw-drop-invalid" }`,
      `:if ([:len [/ip firewall filter find where comment="cloudguest-fw-allow-lan"]] = 0) do={ /ip firewall filter add chain=input in-interface="${lanBridge}" action=accept comment="cloudguest-fw-allow-lan" }`,
      `:if ([:len [/ip firewall filter find where comment="cloudguest-fw-allow-icmp"]] = 0) do={ /ip firewall filter add chain=input protocol=icmp action=accept comment="cloudguest-fw-allow-icmp" }`,
      `:if ([:len [/ip firewall filter find where comment="cloudguest-fw-drop-wan-input"]] = 0) do={ /ip firewall filter add chain=input in-interface-list=WAN action=drop comment="cloudguest-fw-drop-wan-input" }`,
      `:if ([:len [/ip firewall filter find where comment="cloudguest-fw-fwd-established"]] = 0) do={ /ip firewall filter add chain=forward connection-state=established,related action=accept comment="cloudguest-fw-fwd-established" }`,
      `:if ([:len [/ip firewall filter find where comment="cloudguest-fw-fwd-drop-invalid"]] = 0) do={ /ip firewall filter add chain=forward connection-state=invalid action=drop comment="cloudguest-fw-fwd-drop-invalid" }`,
    ];
    chunks.push({ label: "Firewall", script: lines.join("\n") });
  }

  // Basic per-connection-classifier (PCC) mangle rules for real dual/multi-
  // WAN load balancing -- only meaningful with 2+ WAN links. This marks
  // which WAN each new LAN connection should use (split evenly by
  // source+destination address/port), which the failover-only distance
  // setup in the WAN chunk doesn't give you. NOTE: this only marks
  // connections/routes -- it does NOT add the `/ip route ... gateway=...
  // routing-mark=to_wanN` entries themselves, since (same as the WAN IP
  // itself) only the field engineer on-site knows each link's actual
  // gateway. Add one such route per WAN after this, using the matching
  // `to_wan<N>` routing-mark.
  if (wanIfs.length > 1) {
    const lines: string[] = [];
    wanIfs.forEach((wanIf, idx) => {
      const n = idx + 1;
      lines.push(`:if ([:len [/ip firewall mangle find where comment="cloudguest-mangle-input-wan${n}"]] = 0) do={`);
      lines.push(`  /ip firewall mangle add chain=input in-interface="${wanIf}" action=mark-connection new-connection-mark="wan${n}_conn" passthrough=yes comment="cloudguest-mangle-input-wan${n}"`);
      lines.push(`}`);
      lines.push(`:if ([:len [/ip firewall mangle find where comment="cloudguest-mangle-pcc-wan${n}"]] = 0) do={`);
      lines.push(`  /ip firewall mangle add chain=prerouting in-interface="${lanBridge}" dst-address-type=!local connection-mark=no-mark per-connection-classifier=both-addresses-and-ports:${wanIfs.length}/${idx} action=mark-connection new-connection-mark="wan${n}_conn" passthrough=yes comment="cloudguest-mangle-pcc-wan${n}"`);
      lines.push(`}`);
      lines.push(`:if ([:len [/ip firewall mangle find where comment="cloudguest-mangle-route-wan${n}"]] = 0) do={`);
      lines.push(`  /ip firewall mangle add chain=prerouting connection-mark="wan${n}_conn" action=mark-routing new-routing-mark="to_wan${n}" passthrough=yes comment="cloudguest-mangle-route-wan${n}"`);
      lines.push(`}`);
    });
    chunks.push({ label: "Basic Mangle Rules (dual/multi-WAN load balancing)", script: lines.join("\n") });
  }

  if (identity) {
    chunks.push({
      label: "Router Identity",
      script: `/system identity set name="${identity}"`,
    });
  }

  if (apiAccess) {
    const lines = [
      `/ip service set api disabled=no`,
      `:if ([:len [/user find where name="${apiAccess.username}"]] = 0) do={`,
      `  /user add name="${apiAccess.username}" password="${apiAccess.secret}" group=full comment="cloudguest-api"`,
      `} else={`,
      `  /user set [find name="${apiAccess.username}"] password="${apiAccess.secret}"`,
      `}`,
    ];
    chunks.push({ label: "API Access (unlocks Device Console)", script: lines.join("\n") });
  }

  if (wireguard) {
    const lines = [
      `:if ([:len [/interface wireguard find where name="wg-cloudguest"]] = 0) do={`,
      `  /interface wireguard add name="wg-cloudguest" private-key="${wireguard.routerPrivateKey}" listen-port=13231`,
      `}`,
      `:if ([:len [/interface wireguard peers find where interface="wg-cloudguest"]] = 0) do={`,
      `  /interface wireguard peers add interface="wg-cloudguest" public-key="${wireguard.serverPublicKey}" endpoint-address="${wireguard.serverEndpointHost}" endpoint-port=${wireguard.serverEndpointPort} allowed-address="${wireguard.tunnelSubnet}" persistent-keepalive=25s`,
      `}`,
      `:if ([:len [/ip address find where interface="wg-cloudguest"]] = 0) do={`,
      `  /ip address add address="${wireguard.routerTunnelIp}/24" interface="wg-cloudguest"`,
      `}`,
    ];
    chunks.push({ label: "WireGuard Tunnel", script: lines.join("\n") });
  }

  if (radius) {
    const lines = [
      `:if ([:len [/radius find where address="${radius.serverAddress}"]] = 0) do={`,
      `  /radius add service=hotspot address="${radius.serverAddress}" secret="${radius.sharedSecret}"`,
      `}`,
      `/ip hotspot profile set [find name="hsprof1"] use-radius=yes radius-accounting=yes`,
    ];
    chunks.push({ label: "RADIUS", script: lines.join("\n") });
  }

  {
    const lines = [
      `:if ([:len [/system scheduler find name="cloudguest-heartbeat-sched"]] = 0) do={`,
      `  /system scheduler add name="cloudguest-heartbeat-sched" interval=5m on-event=("/tool fetch url=\\"" . "${apiBase}" . "/agent/heartbeat\\" http-method=post http-header-field=\\"Content-Type: application/json,X-Agent-Credential: " . "${agentCredential}" . "\\" http-data=\\"{}\\" output=none")`,
      `}`,
      `/tool fetch url="${apiBase}/agent/heartbeat" http-method=post http-header-field="Content-Type: application/json,X-Agent-Credential: ${agentCredential}" http-data="{}" output=none`,
    ];
    chunks.push({ label: "Heartbeat", script: lines.join("\n") });
  }

  return chunks;
}

function SetupScriptTab({ routerId }: { routerId: string }) {
  const generate = useGenerateProvisioningToken();
  const [busy, setBusy] = useState(false);
  const [script, setScript] = useState<string | null>(null);
  const [ispCount, setIspCount] = useState<1 | 2 | 3>(1);
  const [wanIfs, setWanIfs] = useState<string[]>(["ether1", "ether2", "ether3"]);
  const [enableFirewall, setEnableFirewall] = useState(true);
  const [form, setForm] = useState({
    lanBridge: "bridge",
    lanIp: "192.168.88.1",
    lanCidr: "24",
    dnsServers: "8.8.8.8,1.1.1.1",
    hsUser: "guest",
    hsPass: "welcome123",
  });

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function setWanIf(idx: number, value: string) {
    setWanIfs((arr) => arr.map((v, i) => (i === idx ? value : v)));
  }

  async function onGenerate() {
    setBusy(true);
    setScript(null);
    try {
      const { token } = await generate.mutateAsync(routerId);
      // Check-in is presented device-side in the zero-touch flow, but its
      // endpoint carries no device-only auth of its own -- only the
      // one-time token -- so performing it here, immediately after minting
      // that token, is equivalent to the router doing it itself a minute
      // later. This lets the dashboard hand back ONE ready-to-run script
      // with the agent credential already baked in, instead of a token the
      // router still has to exchange itself.
      const checkinResp = await api.post<{
        agent_credential?: string;
        router_id?: string;
      }>("/routers/provisioning/check-in", { token });
      const agentCredential = checkinResp.data.agent_credential;
      if (!agentCredential) {
        toast.error("Check-in succeeded but no agent credential was returned.");
        return;
      }
      const apiBase = api.defaults.baseURL || "";
      setScript(
        buildRouterSetupScript({
          apiBase,
          agentCredential,
          wanIfs: wanIfs.slice(0, ispCount),
          enableFirewall,
          ...form,
        }),
      );
      toast.success("Script ready");
    } catch (err) {
      toast.error((err as AppError).message || "Failed to generate setup script");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Yeh ek complete RouterOS script generate karta hai -- WAN internet (1-3 ISP, DHCP se, extra
        ISP hone par apne aap failover), LAN bridge, Hotspot (guest WiFi), basic firewall, aur
        platform check-in + heartbeat scheduler, sab ek saath. Router pe sirf WinBox New Terminal
        me paste karna hai. WAN IP khud DHCP se mil jayegi -- bharne ki zaroorat nahi.
      </p>
      <Card className="rounded-2xl border-border/70 shadow-sm">
        <CardContent className="space-y-4 p-4">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Kitne ISP / WAN connections hain?</label>
            <div className="flex gap-2">
              {([1, 2, 3] as const).map((n) => (
                <Button
                  key={n}
                  type="button"
                  size="sm"
                  variant={ispCount === n ? "default" : "outline"}
                  onClick={() => setIspCount(n)}
                >
                  {n} ISP{n > 1 ? "s" : ""}
                </Button>
              ))}
            </div>
            {ispCount > 1 && (
              <p className="mt-1 text-[11px] text-muted-foreground">
                Failover mode: WAN 1 primary rahega, baaki backup (ISP 1 down hote hi automatic
                switch). DHCP hi use hoga -- static IP daalne ki zaroorat nahi.
              </p>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {wanIfs.slice(0, ispCount).map((v, idx) => (
              <div key={idx}>
                <label className="mb-1 block text-xs text-muted-foreground">
                  WAN {idx + 1} interface naam
                </label>
                <Input value={v} onChange={(e) => setWanIf(idx, e.target.value)} placeholder={`ether${idx + 1}`} />
              </div>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">LAN bridge interface name</label>
              <Input value={form.lanBridge} onChange={(e) => set("lanBridge", e.target.value)} placeholder="bridge" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">LAN IP</label>
              <Input value={form.lanIp} onChange={(e) => set("lanIp", e.target.value)} placeholder="192.168.88.1" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">LAN CIDR</label>
              <Input value={form.lanCidr} onChange={(e) => set("lanCidr", e.target.value)} placeholder="24" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">DNS servers (comma-separated)</label>
              <Input value={form.dnsServers} onChange={(e) => set("dnsServers", e.target.value)} placeholder="8.8.8.8,1.1.1.1" />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs text-muted-foreground">Hotspot login (guest username / password)</label>
              <div className="flex gap-2">
                <Input value={form.hsUser} onChange={(e) => set("hsUser", e.target.value)} placeholder="guest" />
                <Input value={form.hsPass} onChange={(e) => set("hsPass", e.target.value)} placeholder="welcome123" />
              </div>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={enableFirewall}
              onChange={(e) => setEnableFirewall(e.target.checked)}
              className="h-4 w-4 rounded border-input"
            />
            Basic firewall rules bhi lagao (established/related allow, invalid drop, WAN se input block)
          </label>
        </CardContent>
      </Card>

      <Button size="sm" onClick={onGenerate} disabled={busy}>
        {busy ? "Generating..." : "Generate script"}
      </Button>

      {script && (
        <Card className="rounded-2xl border-border/70 shadow-sm">
          <CardContent className="space-y-2 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                Poora copy karo aur router ke WinBox New Terminal me paste karo (ek hi baar).
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(script);
                  toast.success("Copied");
                }}
              >
                <Copy className="mr-1.5 h-3.5 w-3.5" /> Copy
              </Button>
            </div>
            <pre className="max-h-96 overflow-auto rounded-lg bg-muted/50 p-3 text-xs">
              <code>{script}</code>
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function WireGuardTab({ routerId }: { routerId: string }) {
  const { data: rawPeer, isLoading, isError, refetch } = useWireGuardPeer(routerId);
  const create = useCreateWireGuardPeer();
  const rotate = useRotateWireGuardPeer();
  const revoke = useRevokeWireGuardPeer();
  const [secrets, setSecrets] = useState<WireGuardTunnelSecrets | null>(null);

  // A revoked peer row is never deleted server-side (its tunnel IP is just
  // freed for reuse) -- GET keeps returning it with status "revoked" rather
  // than 404. Treat that the same as "no tunnel" rather than showing stale
  // key/rotation data with live Rotate/Revoke actions.
  const peer = rawPeer && rawPeer.status !== "revoked" ? rawPeer : null;

  async function handleCreate() {
    try {
      const s = await create.mutateAsync(routerId);
      setSecrets(s);
      toast.success("Tunnel created");
    } catch (err) {
      toast.error((err as unknown as AppError).message || "Failed to create tunnel");
    }
  }
  async function handleRotate() {
    try {
      const s = await rotate.mutateAsync(routerId);
      setSecrets(s);
      toast.success("Tunnel rotated");
    } catch (err) {
      toast.error((err as unknown as AppError).message || "Failed to rotate tunnel");
    }
  }
  async function handleRevoke() {
    try {
      await revoke.mutateAsync(routerId);
      setSecrets(null);
      toast.success("Tunnel revoked");
    } catch (err) {
      toast.error((err as unknown as AppError).message || "Failed to revoke tunnel");
    }
  }

  if (isLoading) return <LoadingSkeleton rows={4} />;
  if (isError) return <ErrorState onRetry={() => refetch()} />;

  return (
    <div className="space-y-4">
      {secrets && (
        <Card className="rounded-2xl border-primary/40 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-base">New tunnel keys — shown once</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <KeyRow label="Peer private key" value={secrets.peerPrivateKey} />
            <KeyRow label="Hub public key" value={secrets.hubPublicKey} />
            <KeyRow
              label="Hub endpoint"
              value={`${secrets.hubEndpointHost}:${secrets.hubEndpointPort}`}
            />
            <KeyRow label="Tunnel network" value={secrets.tunnelNetworkCidr} />
            <KeyRow label="Tunnel IP" value={secrets.tunnelIpAddress} />
            <p className="text-xs text-muted-foreground">
              Configure the device's local WireGuard interface with these values now — they will not
              be shown again.
            </p>
          </CardContent>
        </Card>
      )}

      <Card className="rounded-2xl border-border/70">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Management tunnel</CardTitle>
            <p className="text-sm text-muted-foreground">
              One WireGuard peer per router, connecting it to the CloudGuest control plane.
            </p>
          </div>
          {peer ? (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRotate}
                disabled={rotate.isPending}
              >
                <RotateCw className="h-4 w-4" />
                <span className="ml-2">Rotate</span>
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleRevoke}
                disabled={revoke.isPending}
              >
                <Trash2 className="h-4 w-4" />
                <span className="ml-2">Revoke</span>
              </Button>
            </div>
          ) : (
            <Button size="sm" onClick={handleCreate} disabled={create.isPending}>
              Create tunnel
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {peer ? (
            <dl className="grid grid-cols-1 gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
              <Field label="Status" value={PEER_STATUS_LABEL[peer.status]} />
              <Field label="Health" value={peer.healthStatus} />
              <Field label="Tunnel IP" value={peer.tunnelIpAddress} />
              <Field label="Public key" value={peer.publicKey} />
              <Field label="Rotation count" value={String(peer.rotationCount)} />
              <Field
                label="Last handshake"
                value={
                  peer.lastHandshakeAt ? new Date(peer.lastHandshakeAt).toLocaleString() : "Never"
                }
              />
            </dl>
          ) : (
            <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              No tunnel configured for this router yet.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function KeyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-background/70 px-3 py-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <code className="max-w-[240px] truncate text-xs">{value}</code>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => {
            navigator.clipboard.writeText(value);
            toast.success("Copied");
          }}
        >
          <Copy className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
