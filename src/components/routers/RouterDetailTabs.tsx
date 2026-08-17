import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  Activity,
  AlertTriangle,
  Ban,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Copy,
  DatabaseBackup,
  Eye,
  EyeOff,
  FileCode2,
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
import type { DiagnosticRun, PingRunResult, TracerouteRunResult } from "@/types/network-diagnostics";
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
import { useDomainRouterAnalytics } from "@/hooks/useAnalytics";
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
  useApplyNetworkConfigLive,
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
  const navigate = useNavigate();

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
        <EmptyState
          icon={FileCode2}
          title="Setup Script has moved to Master Console"
          description="This tab used an older, DHCP-only script builder with no WireGuard/RADIUS options and a real, confirmed WinBox terminal paste-corruption bug on long pastes -- Master Console's Setup Script panel is the current, fixed, fully-capable version. Open this router there to generate it."
          action={{
            label: "Open in Master Console",
            onClick: () => navigate({ to: "/master/routers", search: { open: router.id } }),
          }}
        />
      </TabsContent>
      <TabsContent value="wireguard">
        <WireGuardTab routerId={router.id} />
      </TabsContent>
      <TabsContent value="wifi">
        <EmptyState
          icon={Wifi}
          title="Guest WiFi isn't managed here"
          description="Hotspot/SSID and captive portal settings for this router live in the customer's own dashboard, under Network -> Hotspot -- not in Master Console. There's no impersonation/view-as-customer feature yet to jump there directly from this screen."
        />
      </TabsContent>
      <TabsContent value="devices">
        <ConnectedDevicesTab routerId={router.id} />
      </TabsContent>
      <TabsContent value="monitoring">
        <MonitoringTab router={router} />
      </TabsContent>
      <TabsContent value="analytics">
        <ComingSoonPanel
          icon={BarChart3}
          title="Analytics"
          description="Session, auth and usage breakdowns for this one router aren't broken out yet -- the guest/auth analytics endpoints this would need are org/location-scoped only today, with no per-router filter. See the Monitoring tab for real per-router CPU/RAM/bandwidth/RADIUS data, which is available now."
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

function formatUptime(seconds: number | null): string {
  if (seconds == null) return "—";
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function MonitoringStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/70 p-3 text-center">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-lg font-semibold text-foreground">{value}</p>
    </div>
  );
}

/** Real CPU/RAM/bandwidth/uptime telemetry, not a "coming soon" stub --
 * `GET /analytics/routers` (via `useDomainRouterAnalytics`) already
 * returns exactly this, per router, but nothing in the app called it
 * before this tab (confirmed via a repo-wide grep -- the hook and its 3
 * siblings were fully typed and completely unused). Filtered to this one
 * router client-side since the endpoint itself is scoped to an
 * organization/location, not a single router -- the same shape
 * `RouterAuditTab` already works around for the same reason. */
function MonitoringTab({ router }: { router: RouterDevice }) {
  const { data, isLoading, isError, refetch } = useDomainRouterAnalytics(
    router.organizationId,
    router.locationId,
  );
  const stats = data?.routers.find((r) => r.routerId === router.id);

  if (isLoading) return <LoadingSkeleton rows={3} />;
  if (isError) return <ErrorState onRetry={() => refetch()} />;
  if (!stats) {
    return (
      <EmptyState
        icon={Gauge}
        title="No telemetry yet"
        description="This router hasn't reported CPU/RAM/bandwidth data yet -- it appears once the agent's own metrics poll runs at least once."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MonitoringStat label="CPU" value={stats.cpuUsagePercent != null ? `${stats.cpuUsagePercent.toFixed(0)}%` : "—"} />
        <MonitoringStat label="Memory" value={stats.memoryUsagePercent != null ? `${stats.memoryUsagePercent.toFixed(0)}%` : "—"} />
        <MonitoringStat label="Uptime" value={formatUptime(stats.uptimeSeconds)} />
        <MonitoringStat label="Connected clients" value={stats.connectedClients != null ? String(stats.connectedClients) : "—"} />
        <MonitoringStat label="Bandwidth (window)" value={formatBytes(stats.bandwidthTotalBytes)} />
        <MonitoringStat label="Internet" value={stats.internetAvailable ? "Reachable" : "Unreachable"} />
        <MonitoringStat label="WireGuard" value={stats.wireguard.available ? (stats.wireguard.status ?? "configured") : "not configured"} />
        <MonitoringStat label="RADIUS (success/fail)" value={`${stats.radiusSuccessCount}/${stats.radiusFailureCount}`} />
      </div>
      <p className="text-[11px] text-muted-foreground">
        Window: {new Date(data!.windowStart).toLocaleString()} – {new Date(data!.windowEnd).toLocaleString()}
      </p>
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
  const applyLive = useApplyNetworkConfigLive(routerId);
  const [applying, setApplying] = useState(false);

  async function handlePush() {
    try {
      const result = await push.mutateAsync();
      const version = result?.version;
      if (!version?.renderedContent) {
        toast.success("Nothing to apply -- config is empty");
        return;
      }

      // The record (ConfigVersion/ProvisioningJob) now exists; actually
      // getting it onto the device is a separate, server-side step (see
      // backend's own apply_network_config_live docstring) -- previously
      // a direct browser->config-agent-bridge fetch() here, which broke
      // under HTTPS (mixed content) and shipped the bridge's own secret
      // in this app's JS bundle. The backend now does that same call
      // itself, keeping the secret server-side only.
      setApplying(true);
      const applyResult = await applyLive.mutateAsync(version.id);
      if (applyResult.applied) {
        toast.success("Config applied to the live device");
      } else {
        toast.error(`Queued, but live apply failed: ${applyResult.detail || "unknown error"}`);
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

/** Compact, human summary of a completed run's own `result` -- see
 * `types/network-diagnostics.ts`'s own `PingRunResult`/`TracerouteRunResult`
 * docstrings for why `result`'s keys stay snake_case unlike the rest of
 * `DiagnosticRun`. Failed runs have no `result` to summarize (the backend
 * writes `{}` on failure -- `errorMessage` is the real signal there). */
function summarizeDiagnosticResult(run: DiagnosticRun): string | null {
  if (run.status !== "completed" && run.status !== "success") return null;
  if (run.diagnosticType === "ping") {
    const r = run.result as unknown as PingRunResult;
    if (typeof r?.sent !== "number") return null;
    const rtt = r.avg_rtt_ms != null ? `${r.avg_rtt_ms.toFixed(1)} ms avg` : "no response";
    return `${r.received}/${r.sent} received · ${r.packet_loss_percentage}% loss · ${rtt}`;
  }
  if (run.diagnosticType === "traceroute") {
    const r = run.result as unknown as TracerouteRunResult;
    if (!Array.isArray(r?.hops)) return null;
    return `${r.hops.length} hop${r.hops.length === 1 ? "" : "s"}`;
  }
  return null;
}

function DiagnosticRunRow({ run }: { run: DiagnosticRun }) {
  const [expanded, setExpanded] = useState(false);
  const hops = run.diagnosticType === "traceroute"
    ? (run.result as unknown as TracerouteRunResult)?.hops ?? []
    : [];
  const canExpand = run.diagnosticType === "traceroute" && hops.length > 0;
  const summary = summarizeDiagnosticResult(run);

  return (
    <>
      <TableRow
        className={canExpand ? "cursor-pointer" : undefined}
        onClick={canExpand ? () => setExpanded((v) => !v) : undefined}
      >
        <TableCell className="capitalize">
          <span className="flex items-center gap-1">
            {canExpand ? (
              expanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            ) : null}
            {run.diagnosticType}
          </span>
        </TableCell>
        <TableCell>{run.target}</TableCell>
        <TableCell>
          <Badge variant={run.status === "completed" || run.status === "success" ? "default" : "outline"}>
            {run.status}
          </Badge>
        </TableCell>
        <TableCell className="text-xs">
          {summary ?? (run.errorMessage ? <span className="text-destructive">{run.errorMessage}</span> : <span className="text-muted-foreground">—</span>)}
        </TableCell>
        <TableCell className="text-xs text-muted-foreground">
          {new Date(run.createdAt).toLocaleString()}
        </TableCell>
      </TableRow>
      {canExpand && expanded && (
        <TableRow>
          <TableCell colSpan={5} className="bg-muted/30 p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Hop</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Loss</TableHead>
                  <TableHead>Avg RTT</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {hops.map((hop) => (
                  <TableRow key={hop.hop_number}>
                    <TableCell className="text-xs">{hop.hop_number}</TableCell>
                    <TableCell className="text-xs">{hop.address ?? <span className="text-muted-foreground">* (no reply)</span>}</TableCell>
                    <TableCell className="text-xs">{hop.packet_loss_percentage}%</TableCell>
                    <TableCell className="text-xs">{hop.avg_rtt_ms != null ? `${hop.avg_rtt_ms.toFixed(1)} ms` : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableCell>
        </TableRow>
      )}
    </>
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
                  <TableHead>Result</TableHead>
                  <TableHead>Run at</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.data.rows.map((r) => (
                  <DiagnosticRunRow key={r.id} run={r} />
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
        <p className="text-[11px] text-muted-foreground">
          For a manual/scripted check-in only -- not needed if you use Master Console's
          Setup Script below, which mints and embeds its own token automatically.
        </p>
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

/** Used by `buildRouterSetupScriptChunks` -- which stock MikroTik pages
 * get overridden, and what URL they redirect to. */
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

export interface RouterSetupScriptChunk {
  label: string;
  script: string;
}

/** Renders a generated setup script's chunks as a single reviewable
 * Markdown document -- same numbered-piece shape the Master Console's
 * "Setup Script" panel already shows on screen (`N. <label>` + a
 * ```routeros``` fence per chunk), just flattened into one file an
 * operator can download, diff against a previous router's script, or
 * hand to someone else for review instead of copy-pasting chunk by chunk.
 *
 * Deliberately NOT redacted -- unlike the standalone
 * `scripts/generate-mikrotik-md.mjs` doc generator (which exists to
 * produce a *shareable* reference copy with every secret replaced by a
 * placeholder), this runs inside the authenticated Master Console after
 * the real script has already been generated and shown on screen next to
 * a "Copy" button with the same real secrets -- redacting only the
 * downloaded file while leaving the on-screen version and clipboard copy
 * unredacted would be a false sense of security, not real protection. */
export function chunksToMarkdown(
  chunks: RouterSetupScriptChunk[],
  routerName?: string,
): string {
  const lines = [
    `# MikroTik CloudGuest Provisioning Script${routerName ? ` -- ${routerName}` : ""}`,
    "",
    `_Generated ${new Date().toISOString()} -- contains real device credentials. Do not commit or share outside this device's own provisioning._`,
    "",
  ];
  chunks.forEach((chunk, i) => {
    lines.push(`## ${i + 1}. ${chunk.label}`, "", "```routeros", chunk.script, "```", "");
  });
  return lines.join("\n");
}

/** Renders a generated setup script's chunks as one plain RouterOS script
 * file -- unlike `chunksToMarkdown` (documentation, meant to be read, never
 * meant to be run), this has zero non-RouterOS syntax: every line is either
 * a `#`-prefixed comment (a real RouterOS comment marker, safe on its own
 * line) or an actual script line straight from the chunk, in the same
 * dependency-respecting order the Master Console panel already lists them
 * in. Meant to be uploaded once via WebFig's Files tab and run with a
 * single `/import file=<name>.rsc` -- the file-based alternative to
 * pasting each chunk into WinBox/WebFig's Terminal by hand, for the exact
 * same reason the chunking itself exists (WinBox/WebFig terminal paste
 * corruption on long input, confirmed live this session): a file upload
 * has no keyboard/clipboard path to corrupt at all. */
export function chunksToRouterOsScript(
  chunks: RouterSetupScriptChunk[],
  routerName?: string,
): string {
  const lines = [
    `# CloudGuest MikroTik provisioning script${routerName ? ` -- ${routerName}` : ""}`,
    `# Generated ${new Date().toISOString()}`,
    `# Upload via WebFig/WinBox Files, then run: /import file=<this-filename>.rsc`,
    "",
  ];
  chunks.forEach((chunk, i) => {
    lines.push(`# --- ${i + 1}. ${chunk.label} ---`, chunk.script, "");
  });
  return lines.join("\n");
}

/** Flattens every chunk into a single RouterOS-legal line -- a third way to
 * get the script onto a device, alongside the multi-paste chunk flow and
 * the `.rsc` file upload: one paste, no Files-tab upload step. RouterOS
 * accepts `;` as a statement separator interchangeably with a newline (the
 * generator itself already relies on this -- see e.g. the heartbeat
 * chunk's own `wan1DynamicResolution.join("; ")`), so joining every real
 * statement line with `; ` reproduces exactly what the multi-line chunks
 * already mean, just on one line.
 *
 * Two things can't simply be `;`-joined:
 * - `#` comment lines run to end-of-line, so joining one with `; ` would
 *   silently swallow every statement after it as part of the comment.
 *   These carry no runtime meaning (they're annotations for a human
 *   reading the multi-line version) -- dropped entirely here, not escaped.
 * - A statement immediately after an opening `{` (or immediately before a
 *   standalone closing `}`) joins with a plain space instead of `; ` --
 *   matching the inline `do={ ... }` style already used everywhere else in
 *   this generator (e.g. `do={ /interface bridge port remove $wan1Port }`);
 *   a leading `;` right inside a fresh block is unnecessary and untested
 *   against real RouterOS, so this avoids introducing it. This is a
 *   line-level heuristic, not a real brace-depth parser -- safe for every
 *   chunk this generator emits today (each is either fully inline already,
 *   or one block opened and closed within a few lines, never nested), but
 *   worth re-checking if a future chunk introduces deeper nesting. */
export function chunksToSingleLineScript(chunks: RouterSetupScriptChunk[]): string {
  const commandLines = chunks
    .flatMap((chunk) => chunk.script.split("\n"))
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));

  let out = "";
  for (const line of commandLines) {
    if (out.length === 0) {
      out = line;
      continue;
    }
    const joinsAsBlock = out.endsWith("{") || line.startsWith("}");
    out += (joinsAsBlock ? " " : "; ") + line;
  }
  return out;
}

export interface RouterSetupScriptValidationIssue {
  severity: "error" | "warning";
  message: string;
}

export interface RouterSetupScriptValidationResult {
  chunkIndex: number;
  label: string;
  issues: RouterSetupScriptValidationIssue[];
}

/** Static-analysis validator for a generated script's chunks -- runs
 * entirely client-side against the generator's own output, before it's
 * ever copy-pasted or `/import`-ed. Deliberately does NOT require a live
 * device: everything here is checking the *generator's own text*, not
 * whether a real router accepts it (that needs an actual RouterOS
 * instance, which is a separate, heavier "test on device" capability, not
 * this one). This exists to catch the exact class of bug this session
 * found twice by hand -- unbalanced brackets/quotes from a template-string
 * mistake, and unescaped `$variable` references inside a nested
 * `on-event="..."` string (the real, confirmed-live root cause of the
 * DHCP-heartbeat bug this session fixed: RouterOS's own double-quoted
 * string parser eagerly interpolates `$var` even one nesting level deep,
 * silently baking in an empty value forever unless the `$` itself is
 * escaped as `\$`) -- automatically, on every future edit to the
 * generator, instead of relying on someone noticing it live again. */
export function validateSetupScriptChunks(
  chunks: RouterSetupScriptChunk[],
): RouterSetupScriptValidationResult[] {
  return chunks.map((chunk, chunkIndex) => {
    const issues: RouterSetupScriptValidationIssue[] = [];
    const s = chunk.script;

    // -- balanced {}, [], () -- ignoring anything inside a double-quoted
    // string literal, since RouterOS strings can legitimately contain any
    // of these characters (e.g. a JSON body in http-data=).
    const stack: string[] = [];
    const pairs: Record<string, string> = { "}": "{", "]": "[", ")": "(" };
    let inString = false;
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (c === "\\" && inString) {
        i++; // skip the escaped character, whatever it is
        continue;
      }
      if (c === '"') {
        inString = !inString;
        continue;
      }
      if (inString) continue;
      if (c === "{" || c === "[" || c === "(") stack.push(c);
      else if (c === "}" || c === "]" || c === ")") {
        if (stack.pop() !== pairs[c]) {
          issues.push({
            severity: "error",
            message: `Unbalanced "${c}" -- a bracket/brace/paren closes without a matching open (or in the wrong order).`,
          });
        }
      }
    }
    if (inString) {
      issues.push({
        severity: "error",
        message: `Unterminated string -- an odd number of unescaped " characters.`,
      });
    }
    if (stack.length > 0) {
      issues.push({
        severity: "error",
        message: `Unclosed ${stack.map((c) => `"${c}"`).join(", ")} -- opened but never closed.`,
      });
    }

    // -- every $variable inside an on-event="..." value must be escaped
    // (\$var), not bare -- see this function's own docstring for why a
    // bare $ here is the exact bug class this session found live.
    const onEventMatch = s.match(/on-event=\(?"((?:\\.|[^"\\])*)"/);
    if (onEventMatch) {
      const body = onEventMatch[1];
      const bareVar = body.match(/(^|[^\\])\$[a-zA-Z]/);
      if (bareVar) {
        issues.push({
          severity: "error",
          message: `on-event body contains an unescaped "$" before a variable name -- RouterOS resolves it at creation time (usually to empty) instead of preserving it for the scheduler to resolve later. Escape it as "\\$".`,
        });
      }
    }

    // -- a stray character immediately before a leading "#" comment marker
    // is exactly the WebFig/WinBox paste-corruption signature seen live
    // this session ("v#" instead of "#") -- flags it if it somehow ended
    // up baked into the generator's own output rather than introduced by
    // a later paste.
    if (/^\s*\S#/.test(s.split("\n")[0] ?? "")) {
      issues.push({
        severity: "warning",
        message: `Chunk's first line has a character immediately before "#" -- this is the exact corruption pattern seen from a bad paste; double-check this chunk's source.`,
      });
    }

    // -- every non-blank, non-continuation line should start with a
    // recognizable RouterOS token: a command path ("/..."), a control-flow
    // keyword (":if"/":local"/":foreach"/":put"/":error"/":set"), a bare
    // "}"/"else={"/"}"-continuation, or a "#" comment. Anything else is
    // either a generator bug or leftover non-script text.
    const knownStart = /^\s*(\/|:[a-z]|\}|else\b|#)/;
    s.split("\n").forEach((line, lineIdx) => {
      if (line.trim() === "") return;
      if (!knownStart.test(line)) {
        issues.push({
          severity: "warning",
          message: `Line ${lineIdx + 1} doesn't start with a recognizable RouterOS token (command path, ":" keyword, "}", or "#" comment): "${line.slice(0, 60)}${line.length > 60 ? "..." : ""}"`,
        });
      }
    });

    return { chunkIndex, label: chunk.label, issues };
  });
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
  /** Only meaningful when the generator's own `wanRoutingMode` option is
   * `"load_balance"` and every other enabled WAN also has a positive
   * weight set -- see `WanRoutingMode`'s own docstring
   * (`app.domains.isp.constants`, backend) for why a *partial* weighting
   * is never honored here: this generator silently falls back to the
   * existing even split the moment even one enabled WAN is missing a
   * weight, the same "no fake opinion, no surprising partial state"
   * posture the backend's own `validate_wan_routing_weights` enforces
   * before this generator ever sees the data. */
  weight?: number;
}

export type WanRoutingMode = "load_balance" | "failover_only";

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/** GCD-reduces a set of per-WAN weights (e.g. `[70, 30]`) to the smallest
 * integer ratio (`[7, 3]`) and assigns each WAN a contiguous block of PCC
 * indices within the reduced total (`N=10`: WAN1 gets indices 0-6, WAN2
 * gets 7-9) -- the real RouterOS mangle-rule pattern this generator's own
 * "Basic Mangle Rules" chunk needs: one rule per index in a WAN's block,
 * not one rule per WAN, which is what actually makes an uneven split
 * possible at all (`per-connection-classifier` has no way to express "0
 * shares" or "get more than an even 1/N share" any other way).
 *
 * Caps the reduced total at 20 and falls back to `null` (even split)
 * above that -- an unrounded ratio (e.g. two oddly-precise percentages
 * like 97:103) can GCD-reduce to a denominator in the hundreds, which
 * would silently generate that many linear mangle-list entries RouterOS
 * walks on every *new* connection. The UI's own ratio input snaps to 5%
 * increments specifically to stay well under this cap; this is the
 * generator's own independent, defensive backstop for whatever value it's
 * actually handed. */
function buildWeightedPccPlan(
  weights: number[],
): { total: number; indicesByWan: number[][] } | null {
  const g = weights.reduce((a, b) => gcd(a, b));
  const reduced = weights.map((w) => w / g);
  const total = reduced.reduce((a, b) => a + b, 0);
  if (total > 20) return null;
  const indicesByWan: number[][] = [];
  let cursor = 0;
  reduced.forEach((share) => {
    const indices: number[] = [];
    for (let i = 0; i < share; i++) indices.push(cursor++);
    indicesByWan.push(indices);
  });
  return { total, indicesByWan };
}

/** Split into small, independently-pasteable pieces instead of one giant
 * `{ ... }` block -- confirmed live on a real device that WinBox's
 * terminal can drop/mangle characters on a very long single paste (many
 * long lines, deep `{}` nesting), corrupting the RouterOS parse partway
 * through with no clean way to tell which line actually failed. Each
 * chunk here uses literal values instead of shared `:local` variables
 * (proven live), so it's safe to *re-run* any one chunk on its own if
 * something goes wrong -- not the same as safe to paste in any *order*:
 * several chunks have real dependencies on an earlier one already having
 * run (e.g. "LAN Ports" references the bridge "WAN + Bridge" creates), so
 * the panel enforces paste order with a soft lock (master.routers.tsx's
 * `copiedChunkIdx`) rather than leaving chunks freely clickable. (An
 * earlier, single-block generator, `buildRouterSetupScript`, had exactly
 * this paste-corruption bug and no static-IP/WireGuard/RADIUS support --
 * deleted; this is the only generator now.) */
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
  /** How 2+ enabled WANs are combined on-device -- defaults to
   * `"load_balance"`, the only behavior this generator has ever produced
   * for a multi-WAN router (every existing caller that doesn't pass this
   * keeps its current real behavior unchanged). `"failover_only"` is a
   * real, structurally *simpler* alternative, not a stripped-down version
   * of load-balance: plain `distance`-ordered `check-gateway=ping`
   * routes, zero PCC/mangle rules of any kind -- a 100/0 weighted split
   * isn't even expressible in RouterOS's own PCC syntax, so this is its
   * own code path. Meaningless (ignored) for a single-WAN router, same as
   * the existing `wans.length > 1` guard already establishes for the
   * mangle chunk. */
  wanRoutingMode?: WanRoutingMode;
}): RouterSetupScriptChunk[] {
  const { apiBase, agentCredential, wans, lanIfs, lanBridge: rawLanBridge, lanIp, lanCidr, dnsServers, hsUser, hsPass, enableFirewall, wireguard, radius, apiAccess, identity, portalUrl, wanRoutingMode = "load_balance" } = opts;
  // Escaped once up front -- `lanBridge` is an operator-editable free-text
  // field (see master.routers.tsx's own input for it) interpolated into
  // RouterOS double-quoted strings all over this function (bridge
  // creation, port adds, DNS/DHCP, hotspot, firewall/mangle in-interface
  // matches); a raw `"` or `\` typed into it would otherwise corrupt every
  // one of those lines the moment the script is pasted. See
  // `escapeForRouterOsString`'s own docstring.
  const lanBridge = escapeForRouterOsString(rawLanBridge);
  // Same reasoning as `lanBridge` above -- each WAN's interface name is
  // interpolated into RouterOS strings throughout this function.
  const wanIfs = wans.map((w) => escapeForRouterOsString(w.iface));
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

  {
    // Confirmed live on a real device (2026-08-17, router "gurugram"): the
    // same factory-default "bridgeLocal" ("defconf") artifact called out
    // above also ships with its own DHCP client already bound to it. Even
    // after this script detaches every physical port from "bridgeLocal"
    // (see the loop above), that DHCP client is left running with no
    // physical link -- but RouterOS keeps its *last-leased address bound
    // to "bridgeLocal" regardless*, since a dhcp-client's lease isn't
    // released just because the interface loses its ports. On this
    // hardware the WAN's own DHCP server hands out the *same* address to
    // both clients (this one and the real WAN one below), so the router
    // ends up with one IP configured on two different interfaces at once.
    // That confuses the router's own ARP/routing for that subnet -- traffic
    // intermittently gets misrouted toward the dead-end "bridgeLocal" and
    // the router replies to its own pings with "host unreachable" -- seen
    // live as ~65% packet loss to the WAN gateway with no cabling/ISP fault
    // at all. "bridgeLocal" is never used for anything in this script (the
    // hotspot LAN uses its own separately-created bridge), so it's always
    // safe to remove this leftover client outright, independent of how
    // many WANs are configured. Safe to re-run: an empty find is a no-op.
    const lines = [
      `:local staleDefconfClient [/ip dhcp-client find where interface="bridgeLocal"]`,
      `:if ([:len $staleDefconfClient] > 0) do={ /ip dhcp-client remove $staleDefconfClient }`,
    ];
    chunks.push({ label: "Stale Factory-Default DHCP Client Cleanup", script: lines.join("\n") });
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
      const iface = escapeForRouterOsString(wan.iface);
      if (wan.mode === "static") {
        // Self-heal, same idea as "LAN IP + DNS" below: clear any dynamic
        // (DHCP-leased) address left on this interface -- from a prior
        // DHCP WAN mode, factory-default config, or an earlier
        // provisioning attempt -- before laying down the static one.
        // Without this a WAN interface can end up carrying two addresses
        // (the intended static one plus a dangling dynamic one) at once.
        // Only ever removes *dynamic* entries, so the static address this
        // WAN is already configured with is never touched -- a no-op on a
        // healthy re-run.
        lines.push(`:foreach staleAddr in=[/ip address find where interface="${iface}" dynamic=yes] do={ /ip address remove $staleAddr }`);
        lines.push(`:if ([:len [/ip address find where interface="${iface}" address="${wan.ip}/${wan.cidr}"]] = 0) do={`);
        lines.push(`  /ip address add address="${wan.ip}/${wan.cidr}" interface="${iface}" comment="cloudguest-addr-wan${n}"`);
        lines.push(`}`);
      } else {
        // Check for OUR OWN cloudguest-commented dhcp-client specifically
        // -- not just "does any dhcp-client already exist on this
        // interface" -- the same class of bug the "Stale Factory-Default
        // DHCP Client Cleanup" chunk above fixed for "bridgeLocal". A
        // factory-default (or previous provisioning attempt's) dhcp-client
        // already bound to this WAN port would otherwise be silently
        // adopted as-is, `add-default-route` and all, still fighting the
        // "WAN Routing" chunk's own routes below. If ours is missing,
        // remove whatever foreign client (and any dynamic address it left
        // behind) is on this interface first, then add the correct one --
        // self-healing on every re-run, not just a first-run check.
        lines.push(`:local wan${n}CloudguestClient [/ip dhcp-client find where interface="${iface}" comment="cloudguest-dhcp-wan${n}"]`);
        lines.push(`:if ([:len $wan${n}CloudguestClient] = 0) do={`);
        lines.push(`  :local wan${n}OtherClient [/ip dhcp-client find where interface="${iface}"]`);
        lines.push(`  :if ([:len $wan${n}OtherClient] > 0) do={ /ip dhcp-client remove $wan${n}OtherClient }`);
        lines.push(`  :foreach staleAddr in=[/ip address find where interface="${iface}" dynamic=yes] do={ /ip address remove $staleAddr }`);
        lines.push(`  /ip dhcp-client add interface="${iface}" disabled=no add-default-route=no use-peer-dns=no comment="cloudguest-dhcp-wan${n}"`);
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
      const iface = escapeForRouterOsString(wan.iface);
      if (wan.mode === "static") {
        lines.push(`:local wan${n}Gw "${wan.gateway}"`);
      } else {
        lines.push(`:local wan${n}Gw ""`);
        lines.push(`:if ([:len [/ip dhcp-client find where interface="${iface}"]] > 0) do={ :set wan${n}Gw [/ip dhcp-client get [find interface="${iface}"] gateway] }`);
      }
    });
    wans.forEach((_, idx) => {
      const n = idx + 1;
      lines.push(`:if ($wan${n}Gw != "") do={`);
      lines.push(`  :if ([:len [/ip route find where comment="cloudguest-plain-wan${n}"]] = 0) do={`);
      lines.push(`    /ip route add dst-address=0.0.0.0/0 gateway=$wan${n}Gw distance=${n} check-gateway=ping comment="cloudguest-plain-wan${n}"`);
      lines.push(`  } else={ /ip route set [find comment="cloudguest-plain-wan${n}"] gateway=$wan${n}Gw }`);
      // The routing-mark'd routes below are what the PCC mangle chunk
      // marks LAN-originated connections into -- meaningless (and never
      // generated) in failover-only mode, which relies purely on the
      // plain distance-ordered route above and RouterOS's own
      // lowest-active-distance selection for the entire failover
      // mechanism, no routing-mark of any kind.
      if (wans.length > 1 && wanRoutingMode === "load_balance") {
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
    if (wans.length > 1 && wanRoutingMode === "failover_only") {
      // Cleans up routing-mark'd routes a *previous* load-balance
      // provisioning of this same router may have left behind -- without
      // this, old PCC-marked traffic would still be routed via those
      // stale routing-marks even though the mangle chunk below is never
      // generated in this mode, silently reintroducing a load-balance-
      // shaped split under a "failover only" script. Safe to re-run: an
      // empty find is a no-op foreach.
      lines.push(`:foreach r in=[/ip route find where comment~"^cloudguest-route-wan"] do={ /ip route remove $r }`);
      lines.push(`:foreach r in=[/ip route find where comment~"^cloudguest-backup-wan"] do={ /ip route remove $r }`);
    }
    chunks.push({
      label: wanRoutingMode === "failover_only" ? "WAN Routing (failover only)" : "WAN Routing (load balancing + failover)",
      script: lines.join("\n"),
    });
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
      `/ip dns set servers="${escapeForRouterOsString(dnsServers)}" allow-remote-requests=yes`,
      // `allow-remote-requests=yes` above is a device-wide switch -- it has
      // to stay on so guests behind the hotspot (and anything resolving
      // via WireGuard-tunneled management traffic) can actually use this
      // router as a resolver, but that also means DNS is reachable from
      // WAN the moment this chunk runs, regardless of whether the
      // (optional, togglable) "Firewall" chunk below is ever pasted. This
      // rule is unconditional -- not gated on `enableFirewall` -- so a
      // technician who generates a script with the broader firewall
      // disabled still doesn't end up with an open recursive resolver
      // reachable from the internet.
      `:if ([:len [/ip firewall filter find where comment="cloudguest-fw-block-wan-dns"]] = 0) do={ /ip firewall filter add chain=input in-interface-list=WAN protocol=udp dst-port=53 action=drop comment="cloudguest-fw-block-wan-dns" }`,
      `:if ([:len [/ip firewall filter find where comment="cloudguest-fw-block-wan-dns-tcp"]] = 0) do={ /ip firewall filter add chain=input in-interface-list=WAN protocol=tcp dst-port=53 action=drop comment="cloudguest-fw-block-wan-dns-tcp" }`,
    ];
    chunks.push({ label: "LAN IP + DNS", script: lines.join("\n") });
  }

  {
    const hsUserEsc = escapeForRouterOsString(hsUser);
    const hsPassEsc = escapeForRouterOsString(hsPass);
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
      `:if ([:len [/ip hotspot user find where name="${hsUserEsc}"]] = 0) do={ /ip hotspot user add name="${hsUserEsc}" password="${hsPassEsc}" server="hotspot1" }`,
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
  // load balancing -- only meaningful with 2+ WAN links, and only in
  // "load_balance" mode (failover-only never generates this chunk at all
  // -- see the "WAN Routing" chunk's own comment on why that's a real,
  // structurally simpler code path, not a degenerate weighting). This
  // marks which WAN each new LAN connection should use, then mark-routes
  // it into that WAN's own `to_wan<N>` routing-mark -- the exact
  // routing-mark the "WAN Routing" chunk above already added a distance=1
  // (preferred) and distance=2 (crossover backup, for failover) route
  // pair for. These two chunks are a pair: mangle rules with no matching
  // routing-mark route would silently black-hole marked traffic the
  // instant its preferred WAN's gateway went down, and routes with no
  // mangle marking would just never get used by ordinary LAN traffic in
  // the first place.
  if (wanIfs.length > 1 && wanRoutingMode === "load_balance") {
    const lines: string[] = [];

    // Weighted split only when EVERY enabled WAN has a positive weight --
    // a partial weighting (the backend's own validate_wan_routing_weights
    // already rejects this at the point an admin confirms load-balance
    // mode, but this generator makes the identical call independently,
    // defensively, on whatever data it's actually handed) silently falls
    // back to the existing even split rather than guessing which WANs the
    // missing weights were meant for.
    const allWeighted = wans.every((w) => typeof w.weight === "number" && w.weight > 0);
    const weightedPlan = allWeighted ? buildWeightedPccPlan(wans.map((w) => w.weight as number)) : null;

    if (weightedPlan) {
      // Ratio changes need delete-then-recreate, not the usual add-if-
      // missing idempotency: a ratio going from e.g. 70:30 (7+3=10 rules)
      // to 50:50 (5+5=10 rules) reuses the same total rule count but a
      // different WAN-to-index mapping -- the existence-check-per-rule
      // pattern every other chunk in this generator uses would leave
      // stale index rules pointing at the wrong WAN. Safe to re-run: an
      // empty find is a no-op foreach, so this is a no-op on a router
      // that has never had weighted PCC rules at all.
      lines.push(`:foreach r in=[/ip firewall mangle find where comment~"^cloudguest-mangle-pcc-wan"] do={ /ip firewall mangle remove $r }`);
    }

    wanIfs.forEach((wanIf, idx) => {
      const n = idx + 1;
      lines.push(`:if ([:len [/ip firewall mangle find where comment="cloudguest-mangle-input-wan${n}"]] = 0) do={`);
      lines.push(`  /ip firewall mangle add chain=input in-interface="${wanIf}" action=mark-connection new-connection-mark="wan${n}_conn" passthrough=yes comment="cloudguest-mangle-input-wan${n}"`);
      lines.push(`}`);
      if (weightedPlan) {
        // One rule PER INDEX in this WAN's own share of the GCD-reduced
        // denominator, not one rule per WAN -- e.g. a 70:30 split
        // (GCD-reduced to 7:3, N=10) gives WAN1 seven rules (indices
        // 0-6) and WAN2 three (indices 7-9). Each rule's own comment
        // (`...-idxK`) is unique, so the cleanup foreach above and this
        // add-if-missing check never collide across a ratio change.
        weightedPlan.indicesByWan[idx].forEach((i) => {
          lines.push(`:if ([:len [/ip firewall mangle find where comment="cloudguest-mangle-pcc-wan${n}-idx${i}"]] = 0) do={`);
          lines.push(`  /ip firewall mangle add chain=prerouting in-interface="${lanBridge}" dst-address-type=!local connection-mark=no-mark per-connection-classifier=both-addresses-and-ports:${weightedPlan.total}/${i} action=mark-connection new-connection-mark="wan${n}_conn" passthrough=yes comment="cloudguest-mangle-pcc-wan${n}-idx${i}"`);
          lines.push(`}`);
        });
      } else {
        lines.push(`:if ([:len [/ip firewall mangle find where comment="cloudguest-mangle-pcc-wan${n}"]] = 0) do={`);
        lines.push(`  /ip firewall mangle add chain=prerouting in-interface="${lanBridge}" dst-address-type=!local connection-mark=no-mark per-connection-classifier=both-addresses-and-ports:${wanIfs.length}/${idx} action=mark-connection new-connection-mark="wan${n}_conn" passthrough=yes comment="cloudguest-mangle-pcc-wan${n}"`);
        lines.push(`}`);
      }
      lines.push(`:if ([:len [/ip firewall mangle find where comment="cloudguest-mangle-route-wan${n}"]] = 0) do={`);
      lines.push(`  /ip firewall mangle add chain=prerouting connection-mark="wan${n}_conn" action=mark-routing new-routing-mark="to_wan${n}" passthrough=yes comment="cloudguest-mangle-route-wan${n}"`);
      lines.push(`}`);
    });
    chunks.push({
      label: weightedPlan ? "Basic Mangle Rules (weighted multi-WAN load balancing)" : "Basic Mangle Rules (dual/multi-WAN load balancing)",
      script: lines.join("\n"),
    });
  }

  if (identity) {
    chunks.push({
      label: "Router Identity",
      script: `/system identity set name="${escapeForRouterOsString(identity)}"`,
    });
  }

  if (apiAccess) {
    const apiUser = escapeForRouterOsString(apiAccess.username);
    const apiSecret = escapeForRouterOsString(apiAccess.secret);
    const lines = [
      `/ip service set api disabled=no`,
      `:if ([:len [/user find where name="${apiUser}"]] = 0) do={`,
      `  /user add name="${apiUser}" password="${apiSecret}" group=full comment="cloudguest-api"`,
      `} else={`,
      `  /user set [find name="${apiUser}"] password="${apiSecret}"`,
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
      // Load-bearing, not optional: the tunnel is only ever reachable by
      // the platform's own WireGuard hub, so treating it as
      // management-trusted (like the LAN rule) is
      // what makes WinBox/API remote access actually work once any
      // input-chain firewall rules exist, rather than relying on an
      // accident of the ruleset never adding a final default-drop.
      // `place-before=` (not a plain `add`, which always appends to the
      // *end* of the list) is what makes this rule land above
      // `cloudguest-fw-drop-wan-input` regardless of which chunk the
      // operator happens to paste first -- confirmed live in production
      // (2026-08-16, router "gurugram"): the Firewall chunk's blanket
      // WAN-input drop rule is generated *before* this one in the array
      // below, so on a plain `add`, pasting chunks in their natural order
      // put this accept rule physically *after* that drop rule --
      // RouterOS evaluates input-chain rules top to bottom and stops at
      // the first match, so the drop rule caught WireGuard's own inbound
      // handshake-response traffic before it ever reached this accept
      // rule, and the tunnel could never handshake at all. `place-before`
      // targets the drop rule if it already exists (Firewall pasted
      // first) and simply appends normally if it doesn't yet (WireGuard
      // pasted first, nothing to place before) -- correct either way, and
      // self-healing if this chunk is ever re-pasted after the bug's
      // effects are already on the device (see `cloudguest-fw-drop-wan-input`
      // below in the Firewall chunk for the paired half of this fix).
      ...(enableFirewall ? [
        `:if ([:len [/ip firewall filter find where comment="cloudguest-fw-allow-wg-mgmt"]] = 0) do={`,
        `  :local wanDropRule [/ip firewall filter find where comment="cloudguest-fw-drop-wan-input"]`,
        `  :if ([:len $wanDropRule] > 0) do={`,
        `    /ip firewall filter add chain=input in-interface="wg-cloudguest" action=accept comment="cloudguest-fw-allow-wg-mgmt" place-before=$wanDropRule`,
        `  } else={`,
        `    /ip firewall filter add chain=input in-interface="wg-cloudguest" action=accept comment="cloudguest-fw-allow-wg-mgmt"`,
        `  }`,
        `} else={`,
        `  :local wanDropRule [/ip firewall filter find where comment="cloudguest-fw-drop-wan-input"]`,
        `  :local wgAllowRule [/ip firewall filter find where comment="cloudguest-fw-allow-wg-mgmt"]`,
        `  :if ([:len $wanDropRule] > 0 && [:len $wgAllowRule] > 0) do={`,
        `    /ip firewall filter move $wgAllowRule destination=$wanDropRule`,
        `  }`,
        `}`,
      ] : []),
    ];
    chunks.push({ label: "WireGuard Tunnel", script: lines.join("\n") });
  }

  if (radius) {
    const lines = [
      // `hsprof1` is normally created by the "Hotspot" chunk above, but
      // this chunk's own `/ip hotspot profile set [find name="hsprof1"]
      // ...` below silently no-ops (RouterOS's `set` on an empty `find`
      // touches nothing and reports no error) if that hasn't run yet --
      // confirmed by inspection, not just theory: there's no on-device
      // signal at all that RADIUS never actually got wired up. Self-heal
      // with the same minimal `hsprof1` shape the "Hotspot" chunk itself
      // creates (see that chunk's own `/ip hotspot profile add` line) so
      // the `set` below always has something real to land on, regardless
      // of paste order.
      `:if ([:len [/ip hotspot profile find where name="hsprof1"]] = 0) do={ /ip hotspot profile add name="hsprof1" hotspot-address=${lanIp} html-directory=hotspot dns-name="${HOTSPOT_DNS_NAME}" }`,
      `:if ([:len [/radius find where address="${radius.serverAddress}"]] = 0) do={`,
      // RouterOS's own default RADIUS timeout is 300ms, confirmed live to be too
      // aggressive for any real (let alone WireGuard-tunneled) WAN path.
      `  /radius add service=hotspot address="${radius.serverAddress}" secret="${escapeForRouterOsString(radius.sharedSecret)}" timeout=3s`,
      `}`,
      `/ip hotspot profile set [find name="hsprof1"] use-radius=yes radius-accounting=yes`,
    ];
    chunks.push({ label: "RADIUS", script: lines.join("\n") });
  }

  {
    // Confirmed live (real MikroTik CHR, RouterOS 7.16, this session): the
    // recurring scheduler used to always send a fixed, generation-time-
    // literal body -- correct for a static WAN1, but for a DHCP WAN1 (the
    // common case) `public_ip_address` was omitted entirely, forever, past
    // the very first one-shot call at provisioning time. A real ISP DHCP
    // renewal handing out a different address was never reported again.
    //
    // Fixed by having the *recurring* on-event body re-resolve WAN1's
    // address live, every time it fires -- the same resolution the
    // one-shot line below already does, embedded one string-literal-
    // nesting level deeper (inside `on-event="..."`). Two things had to be
    // confirmed live before trusting this:
    //   1. RouterOS's own double-quoted-string parser eagerly interpolates
    //      `$variable` even *inside* a string meant to be stored verbatim
    //      for later execution -- `$wan1Ip` in an unescaped on-event body
    //      silently resolves to empty at *creation* time and that empty
    //      value gets permanently baked into the stored script text, never
    //      re-evaluated later. Escaping the dollar sign itself
    //      (`\$wan1Ip`) is what makes it survive as a literal variable
    //      reference for the *stored* script to resolve on each firing --
    //      exactly what `escapeForRouterOsString` already does
    //      (`.replace(/\$/g, "\\$")`), it just was never applied to
    //      anything beyond the flat JSON body before this fix.
    //   2. The resolution logic resolves a real DHCP-assigned address
    //      correctly, not just a manually-set static one -- so this one
    //      dynamic path now covers both static and DHCP WAN1s, replacing
    //      the old static-only special case entirely.
    //
    // The one-shot block below is also collapsed from a multi-line
    // `:if (...) do={` ... `}` spanning several separate array entries
    // (joined with real newlines) into one line -- the multi-line form is
    // exactly what corrupted on paste into WinBox's terminal (confirmed
    // live: this is the literal syntax error reported against a real
    // router this session). Every other chunk in this generator already
    // avoids multi-line blocks for this reason; this one hadn't been
    // brought in line yet.
    //
    // The collapsed line itself went through a second confirmed-live
    // failure before landing here: it originally packed *two*
    // `;`-separated statements into one `do={ ... }` (`:local wan1Full
    // [...]; :set wan1Ip [...]`) -- a shape that appears nowhere else in
    // this entire generator (every other `do={ ... }` one-liner, e.g. the
    // WAN gateway resolution just above --
    // `do={ :set wan${n}Gw [/ip dhcp-client get [find interface=...]
    // gateway] }` -- holds exactly one statement) and it threw a real
    // "syntax error" on a live router at the exact boundary between the
    // two statements. Rather than keep chasing whether RouterOS's
    // interactive-paste parser genuinely rejects `;`-chained statements
    // inside an inline `do={}` here, this drops the untested shape
    // entirely: no intermediate `wan1Full` local, no `;`, just the single
    // `:set` every other one-liner in this file already uses -- the
    // `/ip address get [find ...] address` lookup runs twice (once for
    // `:pick`'s source string, once for `:find`'s) instead of being cached
    // in a local, which costs nothing (it's a read-only query) and keeps
    // this block byte-for-byte consistent with the rest of the generator.
    const wan1DynamicResolution = [
      `:local wan1Ip ""`,
      `:if ([:len [/ip address find where interface="${wans[0].iface}"]] > 0) do={ :set wan1Ip [:pick [/ip address get [find interface="${wans[0].iface}"] address] 0 [:find [/ip address get [find interface="${wans[0].iface}"] address] "/"]] }`,
      `/tool fetch url="${apiBase}/agent/heartbeat" http-method=post http-header-field="Content-Type: application/json,X-Agent-Credential: ${agentCredential}" http-data=("{${wireguard ? `\\"management_ip_address\\":\\"${wireguard.routerTunnelIp}\\",` : ""}\\"public_ip_address\\":\\"" . $wan1Ip . "\\"}") output=none`,
    ].join("; ");
    const onEventBody = escapeForRouterOsString(wan1DynamicResolution);
    const lines = [
      `:if ([:len [/system scheduler find name="cloudguest-heartbeat-sched"]] = 0) do={`,
      `  /system scheduler add name="cloudguest-heartbeat-sched" interval=5m on-event="${onEventBody}"`,
      `}`,
      // The one-shot line runs once right now, immediately, top-level --
      // no extra nesting, so it keeps its existing single-level `\"`
      // escaping (it was never the buggy one; only the scheduler's stored
      // copy needed the extra nesting level above).
      `:local wan1Ip ""`,
      `:if ([:len [/ip address find where interface="${wans[0].iface}"]] > 0) do={ :set wan1Ip [:pick [/ip address get [find interface="${wans[0].iface}"] address] 0 [:find [/ip address get [find interface="${wans[0].iface}"] address] "/"]] }`,
      `/tool fetch url="${apiBase}/agent/heartbeat" http-method=post http-header-field="Content-Type: application/json,X-Agent-Credential: ${agentCredential}" http-data=("{${escapeForRouterOsString(wireguard ? `"management_ip_address":"${wireguard.routerTunnelIp}",` : "")}\\"public_ip_address\\":\\"" . $wan1Ip . "\\"}") output=none`,
    ];
    chunks.push({ label: "Heartbeat (reports management + WAN1 IP)", script: lines.join("\n") });
  }

  return chunks;
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
          <CardTitle className="text-base">WinBox / API login</CardTitle>
          <p className="text-sm text-muted-foreground">
            Login for connecting with an external tool (WinBox, RouterOS API), reachable only
            over the tunnel above. To run commands right here instead, use Master Console's
            Device Console.
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
