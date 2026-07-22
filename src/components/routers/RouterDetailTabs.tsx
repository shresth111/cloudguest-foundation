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
import type { AppError } from "@/services/api";
import type { WireGuardTunnelSecrets } from "@/types/router";

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

  async function handlePush() {
    try {
      await push.mutateAsync();
      toast.success("Config rendered and queued for application");
    } catch (err) {
      toast.error((err as unknown as AppError).message || "Failed to push config");
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
          <Button size="sm" disabled={push.isPending} onClick={handlePush}>
            <Send className="mr-2 h-4 w-4" />
            Push config
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
