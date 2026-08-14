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
  Eye,
  EyeOff,
  FileText,
  Gauge,
  History,
  KeyRound,
  Loader2,
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
import { routerService } from "@/services/router.service";
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
import api, { getAbsoluteApiBase } from "@/services/api";
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
        <SetupScriptTab
          routerId={router.id}
          organizationId={router.organizationId}
          locationId={router.locationId}
        />
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
        <DiagnosticsTab routerId={router.id} organizationId={router.organizationId} />
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

function DiagnosticsTab({ routerId, organizationId }: { routerId: string; organizationId?: string }) {
  const [target, setTarget] = useState("");
  const runs = useDiagnosticRuns(routerId, organizationId);
  const ping = usePingRouter(routerId, organizationId);
  const traceroute = useTracerouteRouter(routerId, organizationId);

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
  /** The hub's own address *inside* the tunnel (e.g. "10.20.0.1") -- see
   * ``WireGuardTunnelCreateResponse.hub_tunnel_ip_address``'s own
   * docstring. This, not the hub's public IP, is what a generated
   * `/radius add address=...` line should point at: at least one real
   * site's ISP silently drops outbound RADIUS UDP (1812/1813) straight to
   * the hub's public IP, but never touches WireGuard's own UDP port,
   * which every router already has an open tunnel through. */
  hubTunnelIpAddress: string;
}

/** Escapes a string for embedding inside a RouterOS double-quoted string
 * literal -- RouterOS's own parser evaluates `$(...)`/`$var` even inside
 * double quotes, so `$` must be escaped too, not just `"`/`\`. Order
 * matters: backslashes first, then quotes/dollar (each adds a NEW
 * backslash that must not be re-escaped), real newlines last. Apply this
 * ONCE for a value embedded directly as a top-level command argument, or
 * TWICE for a value embedded inside a second, already-escaped layer (e.g.
 * the heartbeat scheduler's `on-event=(...)` string, itself built via
 * RouterOS string concatenation with its own backslash-escaped quotes). */
function escapeForRouterOsString(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\$/g, "\\$").replace(/\n/g, "\\n");
}

/** Shared by both `buildRouterSetupScript` and `buildRouterSetupScriptChunks`
 * -- whichever of the two generated a given router's script, the guest-
 * facing result (which stock MikroTik pages get overridden, and what URL
 * they redirect to) must be identical. */
export interface PortalOverrideConfig {
  frontendBase: string;
  organizationId: string;
  locationId: string;
  routerId: string;
}

/** The real `/portal` entry route's own `validateSearch` (src/routes/
 * portal.tsx) requires exactly these three IDs and optionally reads
 * `mac`/`dst`/`link-login-only`. All three optional params are RouterOS's
 * own *general* hotspot variables -- documented as available on every
 * stock page, not just login.html -- so the same URL shape is reused for
 * every file `PORTAL_OVERRIDE_FILES` overrides below, even ones
 * (status.html/logout.html) where a login-only POST doesn't apply: it lets
 * `/portal`'s own existing routing (src/routes/portal.index.tsx -- a
 * persisted session or a live `checkActiveSession` lookup sends an
 * already-authenticated guest straight to `/portal/session`, anyone else to
 * the normal sign-in flow) decide what to do with them, instead of this
 * script guessing per file. An unused param costs nothing. */
function buildPortalUrl(portalUrl: PortalOverrideConfig): string {
  return (
    `${portalUrl.frontendBase}/portal?organizationId=${portalUrl.organizationId}` +
    `&locationId=${portalUrl.locationId}&routerId=${portalUrl.routerId}` +
    `&mac=$(mac)&dst=$(link-orig)&link-login-only=$(link-login-only)`
  );
}

/** One small, self-refreshing HTML page that redirects to the real portal
 * as close to instantly as RouterOS's own architecture allows -- reused for
 * every file in `PORTAL_OVERRIDE_FILES`. Caller applies
 * `escapeForRouterOsString` once, when embedding this as a RouterOS string
 * literal -- not done here, so this stays plain, readable HTML.
 *
 * Deliberately mirrors the real portal SPA's own dark gradient
 * (`linear-gradient(135deg,#0F172A,#1E293B)`, confirmed against the actual
 * server-rendered `/portal` page) and a plain spinner instead of a
 * "Sign-in required" text block -- a guest who briefly sees this page
 * before the redirect completes should perceive ONE continuous loading
 * transition into the real app, not two visually distinct pages. The
 * redirect itself runs as the very first thing in `<head>`, synchronously,
 * before the browser has any body content to paint -- as close to zero
 * visible flash as a real, separately-served HTML page can get (RouterOS's
 * hotspot must serve *something* for the guest's very first request; there
 * is no way to skip straight to the real portal without serving a page
 * first, this minimizes what that page shows and how long it's visible
 * for). `location.replace` (not `.href`) so this page never enters the
 * guest's browser history -- back-navigation lands them on the real portal
 * or wherever they were, never back on this intermediate page. */
function buildPortalRedirectHtml(url: string, page: { title: string; body: string }): string {
  return [
    "<!DOCTYPE html>",
    '<html><head><meta charset="utf-8">',
    `<script>location.replace("${url}");</script>`,
    `<meta http-equiv="refresh" content="0;url=${url}">`,
    `<title>${page.title}</title>`,
    "<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#0F172A,#1E293B)}",
    ".spin{width:28px;height:28px;border-radius:9999px;border:3px solid rgba(255,255,255,0.15);border-top-color:#fff;animation:s 0.7s linear infinite}",
    "@keyframes s{to{transform:rotate(360deg)}}</style>",
    "</head>",
    '<body><div class="spin"></div></body></html>',
  ].join("\n");
}

/** Every stock MikroTik hotspot template file this script overwrites with a
 * redirect to the real portal, and why -- checked against RouterOS's own
 * documented page-serving rules (MikroTik "Hotspot customisation" docs),
 * not assumed:
 *  - login.html: served to a guest who is NOT yet authenticated.
 *  - rlogin.html: served to a NOT-yet-authenticated guest whose request hit
 *    a destination the walled garden disallows -- given the walled-garden
 *    entry this script adds below (only the portal host itself is let
 *    through pre-auth), that's almost every destination a guest's
 *    browser/OS tries first, making this at least as reachable as
 *    login.html itself, not a rare corner case.
 *  - alogin.html: served once the guest IS already authenticated (right
 *    after a login succeeds, or when an already-authorized device's
 *    browser hits the hotspot again -- e.g. an OS's periodic
 *    captive-portal-detection probe). A real, distinct entry into
 *    "you're already connected", not a login-flow page despite the name.
 *  - status.html: served at the hotspot's own address (its LAN IP) to an
 *    already-authenticated guest who navigates there directly.
 *  - logout.html: served once RouterOS finishes processing a real
 *    `$(link-logout)`-triggered logout.
 * Deliberately left as MikroTik's stock files (overriding them would be
 * dead code under this platform's actual hotspot-profile configuration):
 *  - radvert.html: only served when the hotspot profile has an
 *    advertisement scheduled (`advertise-*` settings) -- this script never
 *    sets any. This platform's own guest-facing ad/interstitial
 *    experience (the real Campaigns feature, `CampaignOverlay`) is served
 *    entirely inside the real portal after login instead, so RouterOS
 *    never has an ad "due" that would trigger this file. (The older
 *    single-static-banner `config.advertisementBannerUrl`/`/portal/ad`
 *    mechanism this comment used to reference has been removed --
 *    superseded by Campaigns, with no remaining admin-facing way to even
 *    configure it.)
 *  - redirect.html: RouterOS's own documented fallback for when a
 *    preferred file (rlogin.html/alogin.html/etc.) is missing from the
 *    html-directory. This script only ever overwrites the *contents* of
 *    files that already ship in RouterOS's stock "hotspot" folder (via
 *    `/file set`), never deletes one -- that "file not found" condition
 *    can never actually occur here. */
const PORTAL_OVERRIDE_FILES: { path: string; title: string; body: string }[] = [
  {
    path: "flash/hotspot/login.html",
    title: "Sign-in required",
    body: "You must sign in to access the internet on this network. Redirecting you to the sign-in page...",
  },
  {
    path: "flash/hotspot/rlogin.html",
    title: "Sign-in required",
    body: "You must sign in to access the internet on this network. Redirecting you to the sign-in page...",
  },
  {
    path: "flash/hotspot/alogin.html",
    title: "You're connected",
    body: "Redirecting you to your connection status...",
  },
  {
    path: "flash/hotspot/status.html",
    title: "You're connected",
    body: "Redirecting you to your connection status...",
  },
  {
    path: "flash/hotspot/logout.html",
    title: "Signed out",
    body: "Redirecting you back to sign-in...",
  },
];

/** One `/file set ...` RouterOS command per `PORTAL_OVERRIDE_FILES` entry,
 * each pointed at the same real portal URL. Returned as `{ label, line }`
 * pairs rather than one joined string so a caller can decide for itself
 * whether to paste them as one chunk or several (see
 * `buildRouterSetupScriptChunks`'s own per-file chunking, done for the same
 * WinBox-paste-reliability reason as everything else in that function). */
function buildPortalOverrideFileSetLines(
  portalUrl: PortalOverrideConfig,
): { label: string; line: string }[] {
  const url = buildPortalUrl(portalUrl);
  return PORTAL_OVERRIDE_FILES.map((page) => ({
    label: page.path.replace("flash/hotspot/", ""),
    line: `/file set [find name="${page.path}"] contents="${escapeForRouterOsString(buildPortalRedirectHtml(url, page))}"`,
  }));
}

/** Lets an unauthenticated guest's browser actually reach the real portal
 * at all -- without this, the hotspot's own captive-portal interception
 * blocks it exactly like any other pre-auth destination (see
 * `PORTAL_OVERRIDE_FILES`' own note on rlogin.html). Returns `null` if
 * `frontendBase` isn't a parseable URL (nothing sensible to wall in). IP
 * literal vs. real hostname decides `dst-address` (IP-level walled garden)
 * vs. `dst-host` (host-based) -- using the wrong one silently does nothing,
 * RouterOS won't reject a malformed `dst-address` the way you'd hope. */
function buildWalledGardenLine(portalUrl: PortalOverrideConfig): string | null {
  const portalHost = (() => {
    try {
      return new URL(portalUrl.frontendBase).hostname;
    } catch {
      return "";
    }
  })();
  if (!portalHost) return null;
  const isIpLiteral = /^\d{1,3}(\.\d{1,3}){3}$/.test(portalHost);
  return isIpLiteral
    ? `:if ([:len [/ip hotspot walled-garden ip find where comment="cloudguest-portal"]] = 0) do={ /ip hotspot walled-garden ip add dst-address=${portalHost} action=accept comment="cloudguest-portal" }`
    : `:if ([:len [/ip hotspot walled-garden find where comment="cloudguest-portal"]] = 0) do={ /ip hotspot walled-garden add dst-host="${portalHost}" action=allow comment="cloudguest-portal" }`;
}

/** The `dns-name` this script sets on `hsprof1` (RouterOS's own
 * `/ip hotspot profile` field) -- once set, RouterOS's hotspot redirect
 * uses this hostname instead of the hotspot's raw LAN IP when it sends a
 * newly-connected, not-yet-authenticated guest to the login page, e.g.
 * `http://${HOTSPOT_DNS_NAME}/login` instead of `http://10.5.50.1/login`
 * in the guest's own address bar (confirmed live against a real device).
 *
 * **Deliberately NOT the same name as the real portal domain
 * (`GUEST_PORTAL_PUBLIC_BASE` below), and this is load-bearing, not a
 * style choice.** An earlier version of this script used the same name
 * (`portal.wyfyguest.com`) for both purposes, on the theory that a single
 * consistent hostname would look cleanest in the guest's address bar. That
 * was confirmed BROKEN against a real device: `dns-name` works by making
 * RouterOS answer DNS queries for that name, from THAT router's own guests,
 * with THAT router's own LAN IP (guests get the router itself as their DNS
 * server via DHCP, and RouterOS auto-manages both the DNS answer and a
 * matching walled-garden entry once `dns-name` is set -- no manual `/ip
 * dns static` entry is needed for this local name, RouterOS does it
 * itself). That local override is absolute for connected guests -- it is
 * NOT a fallback that a public DNS record for the same name could ever
 * override for them. So if the *real* portal (the actual sign-in
 * app, hosted on this platform's cloud backend, not on the router) were
 * ever addressed by this same name, every guest's browser would try to
 * reach it AT THE ROUTER'S OWN ADDRESS -- which only ever serves the small
 * local redirect page, never the real app -- and the guest would loop
 * back to the same redirect page instead of reaching sign-in. Confirmed
 * live: guests got stuck exactly this way before this name was split in
 * two. `HOTSPOT_DNS_NAME` must stay a name that is ONLY EVER used for this
 * local, per-router, RouterOS-auto-managed redirect -- never reused as a
 * real publicly-hosted destination. */
const HOTSPOT_DNS_NAME = "wifi.wyfyguest.com";

/** The real, publicly-hosted guest portal's own domain -- a genuine GoDaddy
 * DNS A record pointing at this platform's cloud backend (confirmed live:
 * `dig portal.wyfyguest.com` resolves publicly, and the backend serves a
 * real TLS cert for it, provisioned via the same nginx/certbot setup as
 * `app.wyfyguest.com`). This is what a guest's browser actually lands on
 * after the local `HOTSPOT_DNS_NAME` redirect page hands off -- see that
 * constant's own docstring for why these two names must never be the same
 * one. Hardcoded here rather than derived from `window.location.origin`
 * (the previous approach) on purpose: `window.location.origin` bakes in
 * whatever URL the Master-console admin happened to be browsing from at
 * script-generation time (e.g. a temporary sslip.io address, or this
 * dashboard's own `app.wyfyguest.com`, which is the ADMIN dashboard, not a
 * guest-facing domain) -- confirmed live as the root cause of a real
 * incident where an already-provisioned router's guest portal broke
 * because its script had been generated before this domain existed.
 * Hardcoding the real, stable, guest-facing domain here means every
 * future-generated script points at the correct destination regardless of
 * whatever URL Master console happens to be served from that day. */
export const GUEST_PORTAL_PUBLIC_BASE = "https://portal.wyfyguest.com";

/** Every WAN interface name this script references is taken literally,
 * exactly once, from whatever the "WAN N interface" field currently says
 * -- it never re-discovers or renames anything on the device. Confirmed
 * live: a field engineer ran `/interface ethernet set
 * [find default-name=ether1] name=WAN1` on the device *after* generating
 * a script that (correctly, consistently) referenced "ether1" throughout
 * -- every subsequent `find where interface="ether1"` in that script then
 * silently matched nothing, since the interface no longer had that name.
 * The bridge-port-removal step became a silent no-op, and the very next
 * "add every other physical port to the LAN bridge" loop then swept the
 * (unrecognized) renamed WAN port straight into the guest LAN bridge --
 * a real L2 security hole (guests L2-adjacent to the WAN) as well as a
 * broken WAN. **Do not rename a WAN interface, on the device, at any
 * point before or while pasting this script.** If you want a friendlier
 * name than the factory default, check the CURRENT name first
 * (`/interface print`), enter that exact name in the "WAN N interface"
 * field above, generate, and only rename afterward if you must -- never
 * in between. */
const WAN_RENAME_WARNING_HEADER = [
  "# =====================================================================",
  "# WARNING: do NOT rename any WAN interface (e.g. `/interface ethernet",
  "# set ... name=...`) before or while pasting this script. Every line",
  '# below refers to it by the exact name shown in "WAN N interface"',
  "# above -- renaming it first makes every later match on that name",
  "# silently fail, and the unrecognized port then gets swept into the",
  "# LAN bridge instead (WAN/LAN on one L2 segment). Re-generate the",
  "# script with the device's CURRENT interface name if it does not",
  "# match, instead of renaming the interface to match the script.",
  "# =====================================================================",
].join("\n");

/** Emits, for each configured WAN interface, a loud (not silent) check
 * that it actually exists on the device under that exact name *before*
 * anything else runs -- the direct fix for the failure mode
 * ``WAN_RENAME_WARNING_HEADER`` documents: if the name was changed (or
 * simply mistyped) after all, this turns "WAN port silently ends up in
 * the LAN bridge" into an impossible-to-miss banner in the terminal,
 * printed once per missing interface, immediately. */
function wanExistenceCheckLines(wanIfNameExprs: string[]): string[] {
  const lines: string[] = [];
  wanIfNameExprs.forEach((expr) => {
    lines.push(
      `:if ([:len [/interface ethernet find where name=${expr}]] = 0) do={`,
      `  :put ("*** ERROR: WAN interface \\"" . ${expr} . "\\" was not found on this device. Did you rename it? Re-check /interface print and re-generate this script with the CURRENT name -- do NOT rename the interface to match the script. Aborting before touching bridge/NAT config. ***")`,
      `  :error ("cloudguest-setup: WAN interface " . ${expr} . " not found")`,
      `}`,
    );
  });
  return lines;
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
  /** See `buildRouterSetupScriptChunks`'s identical field for the full
   * rationale -- overwrites MikroTik's stock hotspot template pages
   * (login/rlogin/alogin/status/logout) to redirect to this platform's own
   * real guest portal instead. */
  portalUrl?: PortalOverrideConfig;
}): string {
  const { apiBase, agentCredential, wanIfs, lanBridge, lanIp, lanCidr, dnsServers, hsUser, hsPass, enableFirewall, wireguard, radius, apiAccess, portalUrl } = opts;
  const octets = lanIp.split(".");
  const base3 = octets.slice(0, 3).join(".");
  const poolStart = `${base3}.10`;
  const poolEnd = `${base3}.254`;
  const lanNetwork = `${base3}.0/${lanCidr}`;

  const lines: string[] = [];
  lines.push("{");
  lines.push(WAN_RENAME_WARNING_HEADER);
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
  // See WAN_RENAME_WARNING_HEADER / wanExistenceCheckLines' own docstring:
  // this must run BEFORE any bridge-port-removal or NAT below, since those
  // silently no-op (rather than error) when the name doesn't match
  // anything -- exactly the failure mode that let a renamed WAN interface
  // end up a member of the LAN bridge instead.
  lines.push(...wanExistenceCheckLines(wanIfs.map((wanIf) => `"${wanIf}"`)));
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
  // "Is this a WAN port" is decided by querying the "WAN" interface list
  // this same script just populated above (RouterOS's own live state),
  // not by re-comparing against a second, separately-hardcoded copy of
  // the WAN names -- one fewer place for the two to silently drift apart,
  // and it stays correct even if a future edit changes how the WAN
  // section above decides what counts as WAN.
  lines.push(`:foreach eth in=[/interface ethernet find] do={`);
  lines.push(`  :local ethName [/interface ethernet get $eth name]`);
  lines.push(`  :local isWan ([:len [/interface list member find where interface=$ethName list="WAN"]] > 0)`);
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
  // Uses RouterOS's own *stock* hotspot template ("hotspot", not a custom-
  // uploaded one) -- present with all its supporting CSS/error/logout pages
  // on every fresh device out of the box. This used to point at a
  // never-uploaded custom folder ("cloudguest-hotspot") -- confirmed to be
  // exactly the same one-off mistake buildRouterSetupScriptChunks's own
  // "Portal Redirect Page" comment already documented and fixed there;
  // this copy of the same logic had drifted and never got that fix. Only
  // the specific files in PORTAL_OVERRIDE_FILES below need to be ours; the
  // stock folder already has everything else they depend on.
  lines.push(`  /ip hotspot profile add name="hsprof1" hotspot-address=$lanIp html-directory=hotspot dns-name="${HOTSPOT_DNS_NAME}"`);
  lines.push(`}`);
  // Unconditional `set` (not nested in the profile-creation `:if` above)
  // so re-running this script also fixes a router whose hsprof1 already
  // existed before this line was added -- same reasoning as the
  // login-by=http-pap `set` immediately below. See HOTSPOT_DNS_NAME's own
  // docstring for why dns-name alone isn't enough and this static record
  // is required alongside it.
  lines.push(`/ip hotspot profile set [find name="hsprof1"] dns-name="${HOTSPOT_DNS_NAME}"`);
  lines.push(`:if ([:len [/ip dns static find where name="${HOTSPOT_DNS_NAME}"]] = 0) do={`);
  lines.push(`  /ip dns static add name="${HOTSPOT_DNS_NAME}" address=$lanIp comment="cloudguest-hotspot-dns-name"`);
  lines.push(`} else={`);
  lines.push(`  /ip dns static set [find name="${HOTSPOT_DNS_NAME}"] address=$lanIp`);
  lines.push(`}`);
  // RouterOS's own default login-by (cookie,http-chap) can't be satisfied
  // by a plain external-portal form POST of username+password -- CHAP
  // needs a challenge/response computed from a chap-id this script's
  // guest-facing login page never fetches, so the NAS silently rejects
  // every login regardless of how correct the username/password are.
  // Confirmed live (Haldwani): the login POST reached the router fine,
  // the router's own hotspot gate just never opened. An unconditional
  // `set` (not nested in the profile-creation `:if`, which only runs
  // for a brand-new profile) so this also fixes a router whose hsprof1
  // already existed before this line was added.
  lines.push(`/ip hotspot profile set [find name="hsprof1"] login-by=http-pap`);
  lines.push(`:if ([:len [/ip hotspot find where interface=$lanBridge]] = 0) do={`);
  lines.push(`  /ip hotspot add name="hotspot1" interface=$lanBridge address-pool="hotspot-pool" profile="hsprof1" disabled=no`);
  lines.push(`}`);
  lines.push(`:if ([:len [/ip hotspot user find where name="${hsUser}"]] = 0) do={`);
  lines.push(`  /ip hotspot user add name="${hsUser}" password="${hsPass}" server="hotspot1"`);
  lines.push(`}`);

  if (portalUrl) {
    lines.push("");
    // See PORTAL_OVERRIDE_FILES' own docstring for exactly which stock
    // MikroTik hotspot pages this replaces and why the rest are left
    // alone. Without this, an unauthenticated guest's browser navigating
    // to the real portal (an ordinary external address as far as the
    // hotspot's concerned) is silently blocked -- the walled garden below
    // is what lets it through before login.
    const walledGarden = buildWalledGardenLine(portalUrl);
    if (walledGarden) lines.push(walledGarden);
    buildPortalOverrideFileSetLines(portalUrl).forEach(({ line }) => lines.push(line));
  }

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
    // The tunnel is only ever reachable by the platform's own WireGuard hub
    // (a single trusted peer, not the public internet) -- treating it as a
    // management-trusted interface, the same as cloudguest-fw-allow-lan
    // above, is what makes WinBox/API remote access to this router
    // actually work once RouterOS has any input-chain firewall rules at
    // all. Without this, remote access happens to work today only because
    // the generated ruleset never adds a final default-drop -- traffic
    // from an interface matched by no rule just falls through to accept.
    // That's fragile (a future stricter default policy would silently cut
    // off remote management with no rule anyone would think to blame), so
    // this makes the real intent an explicit, permanent rule instead of an
    // accident of what the ruleset happens to not block yet.
    if (enableFirewall) {
      lines.push(`:if ([:len [/ip firewall filter find where comment="cloudguest-fw-allow-wg-mgmt"]] = 0) do={`);
      lines.push(`  /ip firewall filter add chain=input in-interface="wg-cloudguest" action=accept comment="cloudguest-fw-allow-wg-mgmt"`);
      lines.push(`}`);
    }
  }

  if (radius) {
    lines.push("");
    lines.push(`:if ([:len [/radius find where address="${radius.serverAddress}"]] = 0) do={`);
    // RouterOS's own default RADIUS timeout is 300ms -- far too aggressive
    // for any real WAN path (let alone one tunneled over WireGuard), and
    // confirmed live to cause routers to report "RADIUS server is not
    // responding" on links with completely ordinary latency. 3s gives a
    // real round trip (including a WireGuard-tunneled one) room to
    // complete before RouterOS gives up and falls back to rejecting the
    // login.
    lines.push(`  /radius add service=hotspot address="${radius.serverAddress}" secret="${radius.sharedSecret}" timeout=3s`);
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
  // Confirmed live: `management_ip_address`/`public_ip_address` stay NULL
  // on the Router row forever, even for a router that has been happily
  // heartbeating as `status=online`/`health_status=healthy` for weeks --
  // because this call's body was always the literal, empty `"{}"`, never
  // actually reporting anything for the backend's own
  // `AgentHeartbeatRequest.management_ip_address` to persist. Once a
  // WireGuard tunnel exists, its tunnel IP *is* this router's one
  // reliably-reachable management address (the router's real WAN IP is
  // often dynamic/behind NAT/CGNAT and not something this script can
  // discover reliably) -- reporting it here is what finally lets
  // BE-008/an admin reach this router's own RouterOS API after
  // provisioning, without hand-typing IPs from a live SSH session onto
  // the RADIUS/WireGuard hub. Escaped once for the plain call below, and
  // AGAIN for the scheduler's `on-event=(...)`, which is itself already
  // one layer of RouterOS string-literal nesting deep.
  const heartbeatJson = wireguard
    ? `{"management_ip_address":"${wireguard.routerTunnelIp}"}`
    : "{}";
  const heartbeatDataOnce = escapeForRouterOsString(heartbeatJson);
  const heartbeatDataTwice = escapeForRouterOsString(heartbeatDataOnce);
  lines.push(`:if ([:len [/system scheduler find name="cloudguest-heartbeat-sched"]] = 0) do={`);
  lines.push(`  /system scheduler add name="cloudguest-heartbeat-sched" interval=5m on-event=("/tool fetch url=\\"" . $apiBase . "/agent/heartbeat\\" http-method=post http-header-field=\\"Content-Type: application/json,X-Agent-Credential: " . $agentCredential . "\\" http-data=\\"${heartbeatDataTwice}\\" output=none")`);
  lines.push(`}`);
  lines.push(`/tool fetch url=($apiBase . "/agent/heartbeat") http-method=post http-header-field=("Content-Type: application/json,X-Agent-Credential: " . $agentCredential) http-data="${heartbeatDataOnce}" output=none`);
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

/** One WAN link's own addressing -- what used to be an undocumented manual
 * on-site step ("get each WAN interface online first, then paste the
 * script") is now part of the generated script itself. `mode: "static"`
 * needs `ip`/`cidr`/`gateway` filled in (the field engineer's own ISP
 * paperwork); `mode: "dhcp"` needs none of them -- the router negotiates
 * its own address and gateway, which `buildRouterSetupScriptChunks`'s
 * "WAN Routing" chunk below then resolves live (`/ip dhcp-client get ...
 * gateway`) rather than baking in a value nobody here could have known at
 * generation time. */
export interface WanEntry {
  iface: string;
  mode: "static" | "dhcp";
  ip?: string;
  cidr?: string;
  gateway?: string;
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
  wans: WanEntry[];
  /** Explicit LAN port allowlist -- when given, only these interfaces join
   * `lanBridge`; every other non-WAN port is left completely alone
   * (neither claimed nor disabled), instead of the old blanket "every
   * physical port that isn't WAN becomes LAN" sweep. Omitted/empty keeps
   * that original sweep behavior unchanged -- this is additive, not a
   * breaking change for a router that never needed per-port control. */
  lanIfs?: string[];
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
  /** When provided, overwrites every *stock* MikroTik hotspot template
   * page this platform's guest can actually reach (see
   * `PORTAL_OVERRIDE_FILES` -- login/rlogin/alogin/status/logout.html, all
   * present on every fresh RouterOS device out of the box, no manual asset
   * upload needed) to redirect to this platform's own real guest portal
   * instead of any of MikroTik's bare default pages. Confirmed live: a
   * router provisioned without this redirects nowhere real, and an earlier
   * hand-edited version of just login.html was found pointing at a
   * since-deleted organization/location/router (a previous session's
   * one-off manual fix that no automated flow ever kept in sync) -- this
   * makes the correct, per-router values part of the repeatable script
   * instead. */
  portalUrl?: PortalOverrideConfig;
}): RouterSetupScriptChunk[] {
  const { apiBase, agentCredential, wans, lanIfs, lanBridge, lanIp, lanCidr, dnsServers, hsUser, hsPass, enableFirewall, wireguard, radius, apiAccess, identity, portalUrl } = opts;
  const wanIfs = wans.map((w) => w.iface);
  const hasExplicitLan = !!lanIfs && lanIfs.length > 0;
  const base3 = lanIp.split(".").slice(0, 3).join(".");
  const poolStart = `${base3}.10`;
  const poolEnd = `${base3}.254`;
  const lanNetwork = `${base3}.0/${lanCidr}`;
  const chunks: RouterSetupScriptChunk[] = [];

  {
    const lines: string[] = [];
    lines.push(WAN_RENAME_WARNING_HEADER);
    lines.push(`:if ([:len [/interface list find where name="WAN"]] = 0) do={ /interface list add name="WAN" }`);
    lines.push(`:if ([:len [/interface bridge find where name="${lanBridge}"]] = 0) do={ /interface bridge add name="${lanBridge}" }`);
    lines.push(`/interface bridge set [find name="${lanBridge}"] disabled=no`);
    // See WAN_RENAME_WARNING_HEADER / wanExistenceCheckLines' own
    // docstring: must run before any bridge-port-removal/NAT below, which
    // otherwise silently no-op (rather than error) on a name that no
    // longer matches anything on the device.
    lines.push(...wanExistenceCheckLines(wanIfs.map((wanIf) => `"${wanIf}"`)));
    wanIfs.forEach((wanIf, idx) => {
      const n = idx + 1;
      lines.push(`:local wan${n}Port [/interface bridge port find where interface="${wanIf}"]`);
      lines.push(`:if ([:len $wan${n}Port] > 0) do={ /interface bridge port remove $wan${n}Port }`);
      lines.push(`:if ([:len [/interface list member find where interface="${wanIf}" list="WAN"]] = 0) do={ /interface list member add list="WAN" interface="${wanIf}" }`);
      lines.push(`:if ([:len [/ip firewall nat find where chain=srcnat out-interface="${wanIf}" action=masquerade]] = 0) do={ /ip firewall nat add chain=srcnat out-interface="${wanIf}" action=masquerade comment="cloudguest-nat-wan${n}" }`);
    });
    chunks.push({ label: "WAN + Bridge", script: lines.join("\n") });
  }

  // Gives each WAN interface an actual address -- this used to be an
  // undocumented manual on-site step ("get each WAN interface online
  // first, then paste the script": run `/ip dhcp-client add` or `/ip
  // address add` by hand before any of the rest of this script could work
  // at all). `add-default-route=no` on every dhcp-client here deliberately
  // -- the "WAN Routing" chunk below owns every default route itself (both
  // the routing-mark'd load-balancing ones and the plain fallback one),
  // the same way it owns a static WAN's route; letting RouterOS's own
  // dhcp-client add a second, unmarked, unmonitored default route of its
  // own would silently fight that chunk's check-gateway-driven failover.
  {
    const lines: string[] = [];
    wans.forEach((wan, idx) => {
      const n = idx + 1;
      if (wan.mode === "static") {
        lines.push(`:if ([:len [/ip address find where interface="${wan.iface}" address="${wan.ip}/${wan.cidr}"]] = 0) do={`);
        lines.push(`  /ip address add address="${wan.ip}/${wan.cidr}" interface="${wan.iface}" comment="cloudguest-addr-wan${n}"`);
        lines.push(`}`);
      } else {
        lines.push(`:if ([:len [/ip dhcp-client find where interface="${wan.iface}"]] = 0) do={`);
        lines.push(`  /ip dhcp-client add interface="${wan.iface}" disabled=no add-default-route=no use-peer-dns=no comment="cloudguest-dhcp-wan${n}"`);
        lines.push(`}`);
      }
    });
    chunks.push({ label: "WAN Addressing (static IP or DHCP client per WAN)", script: lines.join("\n") });
  }

  // Real default routes -- both the routing-mark'd ones the PCC mangle
  // rules below route into, and a plain one per WAN for the router's own
  // traffic (heartbeat, DNS, Netwatch pings) -- not just the mangle marks
  // by themselves, which is all this script used to render (see this
  // function's own git history: the comment used to say outright "this
  // only marks connections/routes -- it does NOT add the `/ip route`
  // entries themselves", leaving that to a field engineer). Every route
  // carries `check-gateway=ping`: RouterOS marks a route inactive (not
  // removed) the moment its gateway stops answering pings, and
  // automatically prefers the next-lowest-distance *active* route sharing
  // the same routing-mark -- the real mechanism both load balancing
  // (distance=1 on every WAN's own mark) and failover (a distance=2
  // crossover backup on every *other* WAN's mark) below rely on, not
  // anything this script has to implement itself.
  //
  // A DHCP WAN's gateway isn't known at script-generation time (unlike a
  // static WAN's, typed in by the field engineer) -- resolved live instead
  // via `/ip dhcp-client get ... gateway`, which can legitimately still be
  // empty the instant this script first runs (lease negotiation is
  // asynchronous). Every route below is skipped, not errored, when that
  // happens; the Heartbeat chunk's scheduler re-runs this same
  // resolve-and-set logic every 5 minutes, so a DHCP WAN that wasn't bound
  // yet on first paste self-heals on its own within one heartbeat interval
  // instead of needing a second manual pass.
  {
    const lines: string[] = [];
    wans.forEach((wan, idx) => {
      const n = idx + 1;
      if (wan.mode === "static") {
        lines.push(`:local wan${n}Gw "${wan.gateway}"`);
      } else {
        lines.push(`:local wan${n}Gw ""`);
        lines.push(`:if ([:len [/ip dhcp-client find where interface="${wan.iface}"]] > 0) do={ :set wan${n}Gw [/ip dhcp-client get [find interface="${wan.iface}"] gateway] }`);
      }
    });
    wans.forEach((_, idx) => {
      const n = idx + 1;
      lines.push(`:if ($wan${n}Gw != "") do={`);
      lines.push(`  :if ([:len [/ip route find where comment="cloudguest-plain-wan${n}"]] = 0) do={`);
      lines.push(`    /ip route add dst-address=0.0.0.0/0 gateway=$wan${n}Gw distance=${n} check-gateway=ping comment="cloudguest-plain-wan${n}"`);
      lines.push(`  } else={ /ip route set [find comment="cloudguest-plain-wan${n}"] gateway=$wan${n}Gw }`);
      if (wans.length > 1) {
        // This WAN's own preferred (distance=1) routing-mark'd route --
        // what the PCC mangle rules below send this WAN's share of
        // LAN-originated connections into.
        lines.push(`  :if ([:len [/ip route find where comment="cloudguest-route-wan${n}"]] = 0) do={`);
        lines.push(`    /ip route add dst-address=0.0.0.0/0 gateway=$wan${n}Gw routing-mark="to_wan${n}" distance=1 check-gateway=ping comment="cloudguest-route-wan${n}"`);
        lines.push(`  } else={ /ip route set [find comment="cloudguest-route-wan${n}"] gateway=$wan${n}Gw }`);
        // Crossover backup: the *next* WAN's mark also gets a distance=2
        // route via this WAN's gateway -- a ring (wan1 backs up wan2, wan2
        // backs up wan3, ..., last WAN backs up wan1), not every pair
        // combination, so this stays one route per WAN regardless of how
        // many WANs there are instead of growing combinatorially. Two WANs
        // is the common case and degenerates to exactly mutual backup.
        const nextIdx = (idx + 1) % wans.length;
        const nextN = nextIdx + 1;
        lines.push(`  :if ([:len [/ip route find where comment="cloudguest-backup-wan${nextN}-via-wan${n}"]] = 0) do={`);
        lines.push(`    /ip route add dst-address=0.0.0.0/0 gateway=$wan${n}Gw routing-mark="to_wan${nextN}" distance=2 check-gateway=ping comment="cloudguest-backup-wan${nextN}-via-wan${n}"`);
        lines.push(`  } else={ /ip route set [find comment="cloudguest-backup-wan${nextN}-via-wan${n}"] gateway=$wan${n}Gw }`);
      }
      lines.push(`}`);
    });
    chunks.push({ label: "WAN Routing (load balancing + failover)", script: lines.join("\n") });
  }

  // Only rendered when the field engineer typed an explicit LAN port list
  // -- builds a real "LAN" interface list the sweep chunk below then
  // requires membership in, the identical existence-check-first discipline
  // WAN_RENAME_WARNING_HEADER/wanExistenceCheckLines already established
  // for WAN: a typo'd or since-renamed LAN interface name fails loudly here
  // instead of that port just silently never joining the bridge.
  if (hasExplicitLan) {
    const lines: string[] = [];
    lines.push(...wanExistenceCheckLines((lanIfs as string[]).map((lanIf) => `"${lanIf}"`)));
    lines.push(`:if ([:len [/interface list find where name="LAN"]] = 0) do={ /interface list add name="LAN" }`);
    (lanIfs as string[]).forEach((lanIf) => {
      lines.push(`:if ([:len [/interface list member find where interface="${lanIf}" list="LAN"]] = 0) do={ /interface list member add list="LAN" interface="${lanIf}" }`);
    });
    chunks.push({ label: "LAN Interfaces (explicit allowlist)", script: lines.join("\n") });
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
    // "Is this a WAN port" is decided by querying the "WAN" interface list
    // the previous chunk just populated (RouterOS's own live state), not
    // by re-comparing against a second, separately-hardcoded copy of the
    // WAN names -- one fewer place for the two to silently drift apart
    // (and the exact duplication that made a renamed WAN interface
    // invisible to this loop in the first place -- see
    // WAN_RENAME_WARNING_HEADER).
    //
    // `hasExplicitLan` flips the *other* half of this same membership
    // check: with no explicit list, every non-WAN port is LAN (the
    // original, still-default behavior); with one, a port must also be a
    // member of the "LAN" list the chunk above just populated -- any port
    // that is neither WAN nor explicitly LAN is left completely alone,
    // not claimed and not disabled, free for whatever else it's wired for.
    const lines = [
      `:foreach eth in=[/interface ethernet find] do={`,
      `  :local ethName [/interface ethernet get $eth name]`,
      `  :local isWan ([:len [/interface list member find where interface=$ethName list="WAN"]] > 0)`,
      hasExplicitLan
        ? `  :local isLan ([:len [/interface list member find where interface=$ethName list="LAN"]] > 0)`
        : `  :local isLan true`,
      `  :if (!$isWan && $isLan) do={`,
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
    chunks.push({
      label: hasExplicitLan
        ? "LAN Ports (only the explicitly-listed interfaces)"
        : "LAN Ports (add every non-WAN port to the bridge)",
      script: lines.join("\n"),
    });
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
      // Uses RouterOS's own *stock* hotspot template ("hotspot", not a
      // custom-uploaded one) -- present with all its supporting CSS/error/
      // logout pages on every fresh device out of the box. A previous,
      // one-off custom folder ("cloudguest-hotspot") required manually
      // uploading a whole asset folder that no repeatable script ever
      // covers; only login.html itself needs to be ours (see the "Portal
      // Redirect Page" chunk below), and the stock folder already has
      // everything else login.html depends on.
      `:if ([:len [/ip hotspot profile find where name="hsprof1"]] = 0) do={ /ip hotspot profile add name="hsprof1" hotspot-address=${lanIp} html-directory=hotspot dns-name="${HOTSPOT_DNS_NAME}" }`,
      // RouterOS's own default login-by (cookie,http-chap) can't be
      // satisfied by a plain external-portal form POST of username+
      // password -- CHAP needs a challenge/response this script's
      // guest-facing login page never fetches, so the NAS silently
      // rejects every login regardless of how correct the credentials
      // are. Confirmed live (Haldwani): login reached the router fine,
      // its own hotspot gate just never opened. Unconditional (not
      // nested in the profile-creation `:if` above, which only runs for
      // a brand-new profile) so re-running this chunk also fixes a
      // router whose hsprof1 already existed before this line was added.
      `/ip hotspot profile set [find name="hsprof1"] login-by=http-pap`,
      // Same "unconditional set fixes an already-existing profile" logic
      // as login-by above, for the address-bar-friendly hostname this
      // profile's own redirect now uses -- see HOTSPOT_DNS_NAME's own
      // docstring for why dns-name and this static record are a pair,
      // not either one alone.
      `/ip hotspot profile set [find name="hsprof1"] dns-name="${HOTSPOT_DNS_NAME}"`,
      `:if ([:len [/ip dns static find where name="${HOTSPOT_DNS_NAME}"]] = 0) do={ /ip dns static add name="${HOTSPOT_DNS_NAME}" address=${lanIp} comment="cloudguest-hotspot-dns-name" } else={ /ip dns static set [find name="${HOTSPOT_DNS_NAME}"] address=${lanIp} }`,
      `:if ([:len [/ip hotspot find where interface="${lanBridge}"]] = 0) do={ /ip hotspot add name="hotspot1" interface="${lanBridge}" address-pool="hotspot-pool" profile="hsprof1" disabled=no }`,
      `:if ([:len [/ip hotspot user find where name="${hsUser}"]] = 0) do={ /ip hotspot user add name="${hsUser}" password="${hsPass}" server="hotspot1" }`,
    ];
    chunks.push({ label: "Hotspot", script: lines.join("\n") });
  }

  if (portalUrl) {
    // Confirmed live: without this, an unauthenticated guest's browser
    // navigating to the real portal (an ordinary external address as far
    // as the hotspot is concerned) is silently blocked -- that's the whole
    // point of a captive portal, the platform's own server is no
    // exception unless explicitly walled off. See `buildWalledGardenLine`'s
    // own docstring for the IP-literal-vs-hostname distinction.
    const walledGarden = buildWalledGardenLine(portalUrl);
    if (walledGarden) {
      chunks.push({ label: "Walled Garden (let unauthenticated guests reach the portal)", script: walledGarden });
    }

    // RouterOS's own string-literal parser evaluates $(...) as command
    // substitution even inside double quotes (confirmed live -- without
    // the `escapeForRouterOsString` call inside
    // `buildPortalOverrideFileSetLines`, $(mac)/$(link-orig)/
    // $(link-login-only) would silently evaluate to empty instead of
    // surviving as literal text for the hotspot's *own*, separate template
    // engine to substitute later when it actually serves one of these
    // files to a connecting guest). One chunk per file (not one big paste)
    // for the same WinBox-paste-reliability reason as every other chunk in
    // this function -- see `PORTAL_OVERRIDE_FILES` for exactly which stock
    // pages this covers and why (login/rlogin for a not-yet-authenticated
    // guest, alogin/status/logout for an already-authenticated one).
    buildPortalOverrideFileSetLines(portalUrl).forEach(({ label, line }) => {
      chunks.push({ label: `Portal Redirect Page (${label})`, script: line });
    });
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

  // Per-connection-classifier (PCC) mangle rules for real dual/multi-WAN
  // load balancing -- only meaningful with 2+ WAN links. This marks which
  // WAN each new LAN connection should use (split evenly by source+
  // destination address/port), then mark-routes it into that WAN's own
  // `to_wan<N>` routing-mark -- the exact routing-mark the "WAN Routing"
  // chunk above already added a distance=1 (preferred) and distance=2
  // (crossover backup, for failover) route pair for. These two chunks are
  // a pair: mangle rules with no matching routing-mark route would silently
  // black-hole marked traffic the instant its preferred WAN's gateway went
  // down (no lower-distance route left for that mark to fall back to), and
  // routes with no mangle marking would just never get used by ordinary
  // LAN traffic in the first place (nothing sends new connections into a
  // routing-mark without one).
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
      // See buildRouterSetupScript's identical rule for why this is needed:
      // the tunnel is only ever reachable by the platform's own WireGuard
      // hub, so treating it as management-trusted (like the LAN rule) is
      // what makes WinBox/API remote access actually work once any
      // input-chain firewall rules exist, rather than relying on an
      // accident of the ruleset never adding a final default-drop.
      ...(enableFirewall ? [
        `:if ([:len [/ip firewall filter find where comment="cloudguest-fw-allow-wg-mgmt"]] = 0) do={`,
        `  /ip firewall filter add chain=input in-interface="wg-cloudguest" action=accept comment="cloudguest-fw-allow-wg-mgmt"`,
        `}`,
      ] : []),
    ];
    chunks.push({ label: "WireGuard Tunnel", script: lines.join("\n") });
  }

  if (radius) {
    const lines = [
      `:if ([:len [/radius find where address="${radius.serverAddress}"]] = 0) do={`,
      // See buildRouterSetupScript's identical comment: RouterOS's own
      // default RADIUS timeout is 300ms, confirmed live to be too
      // aggressive for any real (let alone WireGuard-tunneled) WAN path.
      `  /radius add service=hotspot address="${radius.serverAddress}" secret="${radius.sharedSecret}" timeout=3s`,
      `}`,
      `/ip hotspot profile set [find name="hsprof1"] use-radius=yes radius-accounting=yes`,
    ];
    chunks.push({ label: "RADIUS", script: lines.join("\n") });
  }

  {
    // See buildRouterSetupScript's identical comment: reports this
    // router's WireGuard tunnel IP (its one reliably-reachable management
    // address) as `management_ip_address` on every heartbeat, instead of
    // the previous always-empty `"{}"` body that left that column NULL
    // forever regardless of how many heartbeats arrived.
    // Only a *static* WAN1 has a known-at-generation-time address to embed
    // here -- for a DHCP WAN1 this key is omitted entirely (not sent as an
    // empty string), so the recurring heartbeat's `if public_ip_address is
    // not None` backend check (see RouterService.heartbeat) leaves
    // whatever real value the one-shot line below already recorded alone,
    // rather than blanking it back out on this scheduler's very first tick
    // 5 minutes later. Built as a filtered, comma-joined array (not
    // hand-spliced strings) so an absent key never leaves a stray leading/
    // trailing comma behind -- invalid JSON the backend would 422 on.
    const heartbeatJsonParts = [
      wireguard ? `"management_ip_address":"${wireguard.routerTunnelIp}"` : null,
      wans[0].mode === "static" ? `"public_ip_address":"${wans[0].ip}"` : null,
    ].filter((p): p is string => p !== null);
    const heartbeatJson = `{${heartbeatJsonParts.join(",")}}`;
    const heartbeatDataOnce = escapeForRouterOsString(heartbeatJson);
    const heartbeatDataTwice = escapeForRouterOsString(heartbeatDataOnce);
    const lines = [
      // The *recurring* (every 5m) heartbeat keeps reporting a fixed,
      // generation-time-literal body -- same proven `on-event=("..." .
      // var . "...")` concatenation this scheduler entry already used
      // before WAN reporting existed, deliberately not extended to also
      // re-resolve a DHCP WAN's IP live on every tick: that needs the same
      // string-concatenation nested *inside* this already-concatenated
      // on-event value, a second level of RouterOS quote-escaping this
      // addition did not get to confirm against a real device (see
      // `render_isp_netwatch_entry`'s own "not confirmed live" precedent
      // for the same honesty convention). A DHCP WAN1's address changing
      // between provisioning and the next manual re-run of this script is
      // therefore a real, reported gap, not a silent guess -- the one-shot
      // line below (run immediately, while the field engineer is still on
      // site to notice anything wrong) does resolve it live, just not this
      // recurring one.
      `:if ([:len [/system scheduler find name="cloudguest-heartbeat-sched"]] = 0) do={`,
      `  /system scheduler add name="cloudguest-heartbeat-sched" interval=5m on-event=("/tool fetch url=\\"" . "${apiBase}" . "/agent/heartbeat\\" http-method=post http-header-field=\\"Content-Type: application/json,X-Agent-Credential: " . "${agentCredential}" . "\\" http-data=\\"${heartbeatDataTwice}\\" output=none")`,
      `}`,
      // The one-shot line, by contrast, runs once right now -- so it can
      // afford to resolve WAN1's actual live address first (a plain,
      // single-level `:local`/`:set` + one `http-data=(... . $wan1Ip .
      // ...)` concatenation, the same nesting depth the scheduler line
      // above already uses successfully) instead of the static value typed
      // into the form at generation time, which for a DHCP WAN1 is empty
      // anyway (nothing to type -- see WanEntry's own docstring).
      `:local wan1Ip ""`,
      `:if ([:len [/ip address find where interface="${wans[0].iface}"]] > 0) do={`,
      `  :local wan1Full [/ip address get [find interface="${wans[0].iface}"] address]`,
      `  :set wan1Ip [:pick $wan1Full 0 [:find $wan1Full "/"]]`,
      `}`,
      `/tool fetch url="${apiBase}/agent/heartbeat" http-method=post http-header-field="Content-Type: application/json,X-Agent-Credential: ${agentCredential}" http-data=("{${escapeForRouterOsString(wireguard ? `"management_ip_address":"${wireguard.routerTunnelIp}",` : "")}\\"public_ip_address\\":\\"" . $wan1Ip . "\\"}") output=none`,
    ];
    chunks.push({ label: "Heartbeat (reports management + WAN1 IP)", script: lines.join("\n") });
  }

  return chunks;
}

function SetupScriptTab({
  routerId,
  organizationId,
  locationId,
}: {
  routerId: string;
  organizationId: string;
  locationId: string;
}) {
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
      // Absolute, not `api.defaults.baseURL` directly -- this gets baked
      // verbatim into a RouterOS `/tool fetch url=...` command below, which
      // has no origin of its own to resolve a relative URL against. See
      // `getAbsoluteApiBase`'s docstring.
      const apiBase = getAbsoluteApiBase();
      setScript(
        buildRouterSetupScript({
          apiBase,
          agentCredential,
          wanIfs: wanIfs.slice(0, ispCount),
          enableFirewall,
          // GUEST_PORTAL_PUBLIC_BASE, not window.location.origin -- see that
          // constant's own docstring for why: this must be the real,
          // stable, guest-facing portal domain regardless of whatever URL
          // Master console itself happens to be served from.
          portalUrl: { frontendBase: GUEST_PORTAL_PUBLIC_BASE, organizationId, locationId, routerId },
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

      {peer && <RemoteAccessCard routerId={routerId} />}
    </div>
  );
}

/**
 * WinBox/RouterOS-API connection details for an operator who needs to
 * reach this specific device directly (e.g. from WinBox, outside this
 * console) -- only reachable at all via the WireGuard tunnel above, since
 * these routers sit behind NAT/CGNAT at the venue. Credentials stay
 * hidden until explicitly revealed: `GET /routers/{id}/device-connection`
 * is `routers.manage`-gated AND audited server-side
 * (`AuditAction.ROUTER_CREDENTIALS_REVEALED`) precisely because this is a
 * real secret, not metadata -- so this component never fetches it
 * eagerly or caches it in a query, only on an explicit click, matching
 * the endpoint's own "who saw this and when" intent.
 */
export function RemoteAccessCard({ routerId }: { routerId: string }) {
  const [conn, setConn] = useState<{ host: string | null; username: string | null; password: string | null } | null>(null);
  const [loading, setLoading] = useState(false);
  const [revealed, setRevealed] = useState(false);

  async function reveal() {
    setLoading(true);
    try {
      const data = await routerService.getDeviceConnection(routerId);
      setConn(data);
      setRevealed(true);
    } catch (err) {
      toast.error((err as unknown as AppError).message || "Failed to fetch connection details");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="rounded-2xl border-border/70">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base">Remote access</CardTitle>
          <p className="text-sm text-muted-foreground">
            WinBox/RouterOS API login for this device, reachable only over the tunnel above.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => (revealed ? setRevealed(false) : reveal())}
          disabled={loading}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          <span className="ml-2">{revealed ? "Hide" : "Reveal"}</span>
        </Button>
      </CardHeader>
      {revealed && conn && (
        <CardContent className="space-y-2">
          <KeyRow label="Connect to (WinBox / API)" value={conn.host ?? "Not available -- no reported management IP yet"} />
          <KeyRow label="Login" value={conn.username ?? "—"} />
          <KeyRow label="Password" value={conn.password ?? "—"} />
          <p className="text-xs text-muted-foreground">
            Open WinBox on your machine and connect to the address above -- only reachable from a
            machine on the WireGuard tunnel network. Viewing this was just logged to this router's
            Audit Logs tab.
          </p>
        </CardContent>
      )}
    </Card>
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
