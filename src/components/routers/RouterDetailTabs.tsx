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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/common/EmptyState";
import { LoadingSkeleton } from "@/components/common/LoadingSkeleton";
import { ErrorState } from "@/components/common/ErrorState";
import { ComingSoonPanel } from "@/components/ui-ext/ComingSoonPanel";
import type { RouterDevice } from "@/types/router";
import type {
  DiagnosticRun,
  PingRunResult,
  TracerouteRunResult,
} from "@/types/network-diagnostics";
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
        <MonitoringStat
          label="CPU"
          value={stats.cpuUsagePercent != null ? `${stats.cpuUsagePercent.toFixed(0)}%` : "—"}
        />
        <MonitoringStat
          label="Memory"
          value={stats.memoryUsagePercent != null ? `${stats.memoryUsagePercent.toFixed(0)}%` : "—"}
        />
        <MonitoringStat label="Uptime" value={formatUptime(stats.uptimeSeconds)} />
        <MonitoringStat
          label="Connected clients"
          value={stats.connectedClients != null ? String(stats.connectedClients) : "—"}
        />
        <MonitoringStat label="Bandwidth (window)" value={formatBytes(stats.bandwidthTotalBytes)} />
        <MonitoringStat
          label="Internet"
          value={stats.internetAvailable ? "Reachable" : "Unreachable"}
        />
        <MonitoringStat
          label="WireGuard"
          value={
            stats.wireguard.available ? (stats.wireguard.status ?? "configured") : "not configured"
          }
        />
        <MonitoringStat
          label="RADIUS (success/fail)"
          value={`${stats.radiusSuccessCount}/${stats.radiusFailureCount}`}
        />
      </div>
      <p className="text-[11px] text-muted-foreground">
        Window: {new Date(data!.windowStart).toLocaleString()} –{" "}
        {new Date(data!.windowEnd).toLocaleString()}
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
                          onClick={() =>
                            run(block.mutateAsync({ deviceId: d.id }), "Device blocked")
                          }
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
    return (
      <ErrorState
        onRetry={() => {
          preview.refetch();
          versions.refetch();
        }}
      />
    );
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
                    <TableCell>
                      v{v.versionNumber}
                      {v.isBackup ? " (backup)" : ""}
                    </TableCell>
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
    return (
      <ErrorState
        onRetry={() => {
          status.refetch();
          versions.refetch();
        }}
      />
    );
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
              value={
                status.data?.latestVersion ? `v${status.data.latestVersion.versionNumber}` : "None"
              }
            />
          </dl>
          {status.data?.activeJobs.length ? (
            <div className="space-y-1.5">
              <div className="text-xs font-medium text-muted-foreground">Active jobs</div>
              {status.data.activeJobs.map((j) => (
                <div
                  key={j.id}
                  className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-1.5 text-xs"
                >
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
                    <TableCell>
                      v{v.versionNumber}
                      {v.isBackup ? " (backup)" : ""}
                    </TableCell>
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
  const hops =
    run.diagnosticType === "traceroute"
      ? ((run.result as unknown as TracerouteRunResult)?.hops ?? [])
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
              expanded ? (
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              )
            ) : null}
            {run.diagnosticType}
          </span>
        </TableCell>
        <TableCell>{run.target}</TableCell>
        <TableCell>
          <Badge
            variant={run.status === "completed" || run.status === "success" ? "default" : "outline"}
          >
            {run.status}
          </Badge>
        </TableCell>
        <TableCell className="text-xs">
          {summary ??
            (run.errorMessage ? (
              <span className="text-destructive">{run.errorMessage}</span>
            ) : (
              <span className="text-muted-foreground">—</span>
            ))}
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
                    <TableCell className="text-xs">
                      {hop.address ?? <span className="text-muted-foreground">* (no reply)</span>}
                    </TableCell>
                    <TableCell className="text-xs">{hop.packet_loss_percentage}%</TableCell>
                    <TableCell className="text-xs">
                      {hop.avg_rtt_ms != null ? `${hop.avg_rtt_ms.toFixed(1)} ms` : "—"}
                    </TableCell>
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

function DiagnosticsTab({
  routerId,
  organizationId,
}: {
  routerId: string;
  organizationId?: string;
}) {
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
              {e.description && <p className="text-xs text-muted-foreground">{e.description}</p>}
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
          For a manual/scripted check-in only -- not needed if you use Master Console's Setup Script
          below, which mints and embeds its own token automatically.
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
  /** OPTIONAL raw-address fallback for `serverEndpointHost`, used only when
   * that hostname fails to resolve ON THE DEVICE at peer-creation time.
   *
   * **This must come from the backend. Never type an address here.** The
   * whole reason this field is optional -- rather than a constant next to
   * `GUEST_PORTAL_PUBLIC_BASE` -- is `20.219.72.235`: that address lived as
   * a literal in code, got baked into `endpoint-address=` on 64 field
   * routers, and when the hub's subscription died those routers became
   * unreachable and now need physical visits. The backend even carries a
   * regression test asserting that literal never reappears in its own
   * source (`tests/unit/test_network_config.py`). A literal here would be
   * the same mistake one repo to the left.
   *
   * **As of 2026-08-23 the backend does not expose this.** Verified against
   * `/Users/shresth/cloud-guest-repo/backend`: `wireguard_servers` has
   * `endpoint_host` (String(255), "public hostname or IP address") and no
   * companion address column; `WireGuardTunnelCreateResponse` -- what
   * `POST /routers/{id}/wireguard-peer/allocate-external` returns -- has
   * `hub_endpoint_host`/`hub_endpoint_port` and no address field; and there
   * is no DNS helper or cached resolution anywhere in `app/`. On the
   * `allocate-external` path the value is not even read from the DB: it is
   * copied straight through from `SERVER_ENDPOINT_HOST = "hub.wyfyguest.com"`,
   * a hardcoded constant in `ops/hub-agents/wg_agent.py`.
   *
   * So today this is always `undefined`, and the WireGuard chunk's DNS
   * guard degrades to "refuse to build a peer that points at nothing, and
   * say so" rather than "fall back". The moment the backend adds an address
   * field, wire it up in `RouterSetupScriptAdvanced`'s
   * `allocate-external` response type and the fallback lights up with no
   * change to this generator. See that chunk's own comment for what the
   * backend would need to expose. */
  serverEndpointAddress?: string;
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
    `&mac=$(mac)&ip=$(ip)&dst=$(link-orig)&link-login-only=$(link-login-only)`
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
 *    can never actually occur here.
 *
 * IDENTIFIED BY BASENAME, NOT BY PATH. These used to be written as
 * `flash/hotspot/login.html`. That `flash/` prefix is a per-MODEL detail:
 * it is the mount point on boards that expose their NAND as a separate
 * `flash` directory, and on the boards that do not, the same file is just
 * `hotspot/login.html`. Getting it wrong did not raise anything --
 * RouterOS's `set [find ...]` against an EMPTY match succeeds, silently,
 * with no error to catch -- so on those models every one of these five
 * `set`s did nothing, the paste looked clean, and the guest got MikroTik's
 * stock blue login page instead of the venue's portal. The path is now
 * DISCOVERED at paste time (`/file find where name~"..."`) and a miss is
 * reported loudly; see `buildPortalOverrideFileSetLines`. */
const PORTAL_OVERRIDE_FILES: { file: string; title: string; body: string }[] = [
  {
    file: "login.html",
    title: "Sign-in required",
    body: "You must sign in to access the internet on this network. Redirecting you to the sign-in page...",
  },
  {
    file: "rlogin.html",
    title: "Sign-in required",
    body: "You must sign in to access the internet on this network. Redirecting you to the sign-in page...",
  },
  {
    file: "alogin.html",
    title: "You're connected",
    body: "Redirecting you to your connection status...",
  },
  {
    file: "status.html",
    title: "You're connected",
    body: "Redirecting you to your connection status...",
  },
  {
    file: "logout.html",
    title: "Signed out",
    body: "Redirecting you back to sign-in...",
  },
];

/** The `/file find where name~"..."` pattern that locates one stock hotspot
 * page regardless of which directory prefix this board uses.
 *
 * THE LEADING SLASH IS LOAD-BEARING. RouterOS's `~` is a regex SUBSTRING
 * match, and `login.html` is a substring of BOTH `rlogin.html` and
 * `alogin.html` -- matching on the bare basename would make the login.html
 * chunk overwrite all three pages with login.html's content, silently.
 * Anchoring on the separator (`/login.html`) cannot collide: the character
 * before the basename is `r` or `a` in those two, not `/`.
 *
 * Kept as a suffix match rather than an anchored full path precisely so it
 * keeps working on a board whose prefix nobody here has seen yet -- which
 * is the whole defect being fixed. */
function portalFileMatchPattern(file: string): string {
  return `/${file}`;
}

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
  return PORTAL_OVERRIDE_FILES.map((page) => {
    const pattern = portalFileMatchPattern(page.file);
    const contents = escapeForRouterOsString(buildPortalRedirectHtml(url, page));
    // ONE entered line. `$pfHits` is bound and consumed inside it, because
    // the RouterOS console runs each entered line as its own program, and
    // every `do={}` body below holds exactly one statement.
    //
    // The count is taken FIRST and printed either way. The whole defect
    // being fixed here is that `/file set [find ...]` against an empty
    // match is indistinguishable from a successful write -- same silence,
    // same zero status -- so the only honest report is the number of files
    // the `find` actually matched. On a miss this says so and names the
    // consequence, rather than letting a clean-looking paste imply the
    // venue's portal is installed when the stock MikroTik page is still
    // there.
    const line = [
      `:local pfHits [:len [/file find where name~"${pattern}"]]`,
      `:if ($pfHits > 0) do={ /file set [find where name~"${pattern}"] contents="${contents}" }`,
      `:if ($pfHits > 0) do={ :put ("  Portal page ${page.file}: OK, overwrote " . [:tostr $pfHits] . " file(s).") }`,
      `:if ($pfHits = 0) do={ :put "  FAIL -- portal page ${page.file}: 0 files matched ${pattern} on this device." }`,
      `:if ($pfHits = 0) do={ :put "  NOTHING WAS WRITTEN. Guests will see MikroTik stock page, not the venue portal." }`,
      `:if ($pfHits = 0) do={ :put "  This board stores the hotspot pages under a different path. List them with:" }`,
      `:if ($pfHits = 0) do={ :put "    /file print where name~hotspot" }`,
      `:if ($pfHits = 0) do={ :put "  then re-run the hotspot setup so the stock pages exist, and re-paste this chunk." }`,
      `:if ($pfHits = 0) do={ :log warning "cloudguest: portal page ${page.file} not found -- stock page left in place" }`,
    ].join("; ");
    return { label: page.file, line };
  });
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

/** THE actual fix for a confirmed, severe, fleet-wide bug (field-diagnosed
 * live 2026-08-18, router "WYFY-GUEST"): MikroTik hotspot has TWO separate,
 * independent walled-garden mechanisms, and `buildWalledGardenLine` above
 * only ever populates one of them. `/ip hotspot walled-garden` (host-based,
 * what that function adds) works by inspecting the Host header at the
 * HTTP-proxy layer -- a layer that simply doesn't exist for TLS-encrypted
 * HTTPS traffic, so it can only ever bypass authentication for *plain HTTP*
 * requests. `/ip hotspot walled-garden ip` (IP-address-based, firewall/
 * NAT-layer) is the ONLY mechanism that can bypass authentication for
 * HTTPS, since it acts before the port-443 hotspot redirect fires at all.
 *
 * Confirmed live via firewall hit-counters on a real router: ~98% of real
 * guest traffic today is HTTPS (1,965 HTTPS hits vs. 30 HTTP hits on the
 * hotspot's own redirect rules) -- meaning that, with only the host-based
 * entry in place, the vast majority of guests' very first attempt to reach
 * the real portal (`GUEST_PORTAL_PUBLIC_BASE`, always HTTPS) gets caught by
 * the hotspot's own unauthenticated-HTTPS-redirect instead of passing
 * through -- which wraps the connection in the router's own untrusted
 * self-signed certificate -- producing exactly the "could not establish a
 * secure connection" / "a problem occurred, the webpage couldn't be loaded"
 * errors real guests hit, with the captive portal effectively broken for
 * most real-world devices, not an edge case. Confirmed FIXED live on that
 * same router by manually running `/ip hotspot walled-garden ip add
 * action=accept dst-address=<resolved portal IP>
 * comment="cloudguest-portal-https"`. This function generates the
 * repeatable, self-healing equivalent of that manual fix.
 *
 * `walled-garden ip` needs a real IP address -- unlike the host-based table
 * above, there is no hostname form of this one. The portal's IP is a real
 * DNS A record on this platform's own backend (see
 * `GUEST_PORTAL_PUBLIC_BASE`'s own docstring), not a fixed address baked
 * into this platform, so it can't just be resolved once here at
 * script-GENERATION time and hardcoded as a literal the way e.g.
 * `WAN_RENAME_WARNING_HEADER` bakes in a name -- that would silently go
 * stale the instant the backend's DNS record ever changed, with no signal
 * to an already-provisioned router that anything broke. Instead this
 * resolves the hostname ON THE ROUTER ITSELF, at script-RUN time, via
 * RouterOS's own `:resolve` -- the same primitive the "WAN Connectivity
 * Check" chunk above already uses for its own DNS probe, including the same
 * `:do {} on-error={}` guard (`:resolve` throws on failure -- NXDOMAIN, no
 * DNS reachable yet this early in provisioning, etc. -- and an uncaught
 * throw here would abort the rest of this paste) -- and then ADD-OR-UPDATE
 * (not just add-if-missing) the walled-garden-ip entry with whatever
 * address comes back, every time this chunk is (re-)pasted, matching the
 * "safe to re-paste, self-heals" idiom used everywhere else in this file
 * (e.g. `HOTSPOT_DNS_NAME`'s own static-DNS entry a few lines up: `:if (...
 * = 0) do={ add } else={ set }`).
 *
 * **Known limitation, deliberately not solved here**: this only re-resolves
 * when a human re-pastes this chunk. If the backend's DNS record for the
 * portal ever changes in between, this on-device entry goes stale until the
 * next re-paste -- there is no automatic re-resolve, unlike WAN1's own IP
 * (which the Heartbeat chunk below already re-resolves on its own 5-minute
 * schedule). Deliberately NOT wired into that scheduler here: WAN1's IP is
 * expected to change routinely (DHCP renewal is normal, ordinary operation),
 * while the portal's DNS record is expected to be effectively static (a
 * production A record on this platform's own backend, changed rarely if
 * ever) -- piggybacking a rarely-needed re-resolve onto a 5-minute scheduler
 * that already does something else (report to master) trades a small,
 * real-but-rare staleness window for a permanently-running extra `:resolve`
 * + `/ip hotspot walled-garden ip set` on every device in the fleet, every 5
 * minutes, forever. If the portal's DNS record does change, re-pasting this
 * one chunk (cheap, already how every other self-heal in this file is
 * recovered from) fixes every affected router. Left as a candidate for a
 * dedicated periodic refresh if this specific staleness window ever
 * actually bites in production -- not added preemptively.
 *
 * Returns `null` under the same "not a parseable URL" condition
 * `buildWalledGardenLine` already handles. An IP-literal `frontendBase` (the
 * same rare case that function special-cases) skips `:resolve` entirely --
 * there's nothing to resolve, the literal IS the address -- and so skips its
 * `on-error` guard too, since a literal assignment can't fail the way a
 * live DNS lookup can.
 *
 * **Emitted as ONE `;`-joined line, not a block.** `$portalIp` is bound by
 * the first statement and read by the last -- and the RouterOS console
 * runs EACH ENTERED LINE as its own program, so the previous multi-line
 * form declared `:local portalIp` on one line and then referenced a
 * variable that no longer existed on the next two. Those lines were a
 * syntax error on a real device; the `:resolve` never landed anywhere and
 * the walled-garden entry was never added or updated, silently, which is
 * the exact HTTPS-portal breakage this function exists to fix. Every
 * `do={}` body below still holds exactly one statement (the separate,
 * independently-confirmed rule -- see `wanExistenceCheckLines`), which is
 * why the add and the update are two guarded statements rather than one
 * `:if`/`else={}` pair with multi-statement bodies. */
function buildWalledGardenIpLines(portalUrl: PortalOverrideConfig): string[] | null {
  const portalHost = (() => {
    try {
      return new URL(portalUrl.frontendBase).hostname;
    } catch {
      return "";
    }
  })();
  if (!portalHost) return null;
  const portalHostEsc = escapeForRouterOsString(portalHost);
  const isIpLiteral = /^\d{1,3}(\.\d{1,3}){3}$/.test(portalHost);
  const resolved = isIpLiteral
    ? `:local portalIp "${portalHostEsc}"`
    : `:local portalIp ""; :do { :set portalIp [:resolve "${portalHostEsc}"] } on-error={ :log warning "cloudguest: could not resolve ${portalHostEsc} for HTTPS walled-garden -- guest portal may be unreachable over HTTPS for new devices until this resolves; re-paste this chunk once DNS is healthy" }`;
  const existing = `[/ip hotspot walled-garden ip find where comment="cloudguest-portal-https"]`;
  return [
    [
      resolved,
      `:local existingPortalGardenIp ${existing}`,
      `:if ([:len $portalIp] > 0 && [:len $existingPortalGardenIp] = 0) do={ /ip hotspot walled-garden ip add action=accept dst-address=$portalIp comment="cloudguest-portal-https" }`,
      `:if ([:len $portalIp] > 0 && [:len $existingPortalGardenIp] > 0) do={ /ip hotspot walled-garden ip set $existingPortalGardenIp dst-address=$portalIp }`,
    ].join("; "),
  ];
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

/** How long a hotspot session may pass ZERO bytes in either direction
 * before RouterOS closes it, set on the built-in `default` user profile.
 *
 * This is the ONLY thing that ends a session on this fleet. The same
 * profile sets `keepalive-timeout=none` (a deliberate fix for a confirmed
 * incident where phones locking their screens were hard-logged-out at the
 * factory default of two minutes), and RouterOS's own default for
 * `idle-timeout` is likewise `none` -- so before this constant existed,
 * every session opened on this platform stayed open forever. Slots were
 * held against `shared-users` by guests who had long since left, Master
 * console's device counts only ever went up, and RADIUS never received an
 * accounting Stop.
 *
 * Chosen as a deliberate distance from the two-minute keepalive that
 * caused the original incident, because the two measure different things:
 * keepalive fired on a missed poll, which an idle-but-connected phone
 * misses routinely, whereas this fires only on genuinely zero traffic --
 * something a pocketed phone with push notifications does not sustain.
 * Wide enough not to recreate the false-logout bug under another name,
 * short enough that a departed guest's slot returns within a venue's
 * ordinary turnover. */
const HOTSPOT_IDLE_TIMEOUT = "30m";

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

/** The RouterOS interface name for this router's own WireGuard tunnel back
 * to its hub. **The backend owns this name; this constant only mirrors
 * it.**
 *
 * Verified 2026-08-23 against the backend checkout at
 * `/Users/shresth/cloud-guest-repo/backend`:
 * `app/domains/network_config/renderers.py:672` declares
 * `WIREGUARD_INTERFACE_NAME = "wg-cloudguard"`, and every router-facing
 * path there renders that literal -- `render_wireguard_peer`
 * (`renderers.py:1098-1106`, the `/interface wireguard add`, the
 * `/ip address add ... interface=`, and the hub peer row), the Step 1
 * bootstrap script (`:1604-1638`), and the remote cutover/revert scheduler
 * teardown (`:1659`). Fourteen assertions in
 * `backend/tests/unit/test_network_config.py` pin it (`:707`, `:723`,
 * `:790`, `:808`, `:818-820`, `:922`, `:1055-1059`, `:1075`, `:1113`).
 *
 * This generator previously emitted `wg-cloudguest` -- a name that exists
 * NOWHERE in backend code. Its only occurrence in that repo is prose in
 * `ops/letsencrypt-hotspot/README.md:241-242`, an incident write-up
 * describing a rule someone had placed on one live router by hand. So the
 * two spellings were never two conventions; one was simply wrong, and a
 * router that got both the backend bootstrap and this generator's paste
 * ended up with TWO WireGuard interfaces -- with
 * `cloudguest-fw-allow-wg-mgmt` (a rule only THIS generator creates; the
 * backend renders no rule by that comment) bound to the dead one, so the
 * hub's handshake was dropped and the tunnel never came up.
 *
 * The hub's own Linux-side interface is a genuinely different name (`wg0`,
 * `ops/hub-agents/wg_agent.py:27`) and is configured out-of-band -- that
 * one is not a divergence and must not be "reconciled" with this. */
const WIREGUARD_INTERFACE_NAME = "wg-cloudguard";

/** The name this generator used to emit for the tunnel interface. Retained
 * for one reason only: every router provisioned before this fix still has
 * an interface by this name, and a blind rename would leave it sitting
 * there as a second, dead tunnel. The WireGuard chunk counts it and says
 * so out loud instead of silently adding a sibling next to it. */
const WIREGUARD_LEGACY_INTERFACE_NAME = "wg-cloudguest";

/** How many times the "WAN Routing" chunk asks a DHCP WAN for its gateway
 * before giving up, and how long it waits between attempts. Written out as
 * an unrolled ladder rather than a `:for` loop because a loop cannot
 * express "attempt, then wait only if that did not work" while keeping
 * every `do={}` body to a single statement -- see that chunk's own
 * comment. `${WAN_DHCP_GW_POLL_ATTEMPTS} x ${WAN_DHCP_GW_POLL_DELAY}` is
 * the total patience; keep the product in the tens of seconds (a DHCP
 * lease that has not bound in half a minute is a real fault worth
 * reporting, not something to keep waiting on) and keep the attempt count
 * small, because each retry adds two statements to an already long
 * single-paste line. */
const WAN_DHCP_GW_POLL_ATTEMPTS = 6;
const WAN_DHCP_GW_POLL_DELAY = "5s";

/** The hEX (and every other RouterOS box this fleet uses) has NO
 * battery-backed clock. A fresh unit, and any unit that has been
 * power-cycled, boots with a wrong date -- typically the firmware build
 * date, sometimes 1970. Two things break, both silently:
 *
 *  - **HTTPS certificate validation fails.** `/tool fetch` to
 *    `https://master.wyfyguest.com/...` is rejected before the request is
 *    ever sent, so THE HEARTBEAT NEVER REACHES THE PLATFORM and the router
 *    shows offline in Master console forever -- while guests get perfectly
 *    working WiFi and nobody suspects anything. Confirmed on this project.
 *  - **Scheduler timing is captured against the bad clock.** Half-mitigated
 *    already by `start-time=startup` on the heartbeat scheduler (see that
 *    chunk), which stops RouterOS baking a garbage first-run time into the
 *    entry. That fixes the scheduler; it does not fix the clock, and the
 *    clock is what TLS reads.
 *
 * `Asia/Kolkata` and these two NTP servers are what the field runbook
 * uses. They are deliberately PLAIN IPs, not `pool.ntp.org`: this chunk
 * runs at a point in the script where DNS has been *checked* but a venue's
 * DNS can still be broken (see the WireGuard chunk's own `:resolve`
 * fallback for a confirmed-live "internet fine, DNS broken" router), and
 * an NTP server that cannot be resolved is an NTP server that never syncs.
 * 216.239.35.0 is Google's `time.google.com`; 162.159.200.1 is
 * Cloudflare's `time.cloudflare.com`. */
const CLOCK_TIME_ZONE = "Asia/Kolkata";
const CLOCK_NTP_SERVERS = ["216.239.35.0", "162.159.200.1"];

/** How long the clock chunk waits for the FIRST NTP sync before printing
 * its verdict. Setting `/system ntp client set enabled=yes` does not
 * synchronise anything by itself -- it needs working outbound UDP 123, and
 * plenty of venue firewalls block exactly that. Same unrolled try/wait
 * ladder as `WAN_DHCP_GW_POLL_ATTEMPTS` for the same reason: a `:for` loop
 * cannot express "attempt, and only wait if it did not work" while keeping
 * every `do={}` body to a single statement. */
const CLOCK_NTP_POLL_ATTEMPTS = 5;
const CLOCK_NTP_POLL_DELAY = "4s";

/** The floor the clock chunk's date sanity check uses. This is a FLOOR,
 * not an expiry: its only failure mode as it ages is becoming more
 * lenient, never pointing at something wrong. It exists as a *second*
 * signal behind `/system ntp client get status`, which is the real,
 * never-stale answer to "did the clock actually sync"; the year check is
 * what catches the case where `status` is unreadable (a RouterOS version
 * that does not expose it) but the date is plainly garbage.
 *
 * Deliberately NOT derived from `Date.now()` at generation time: this
 * generator is a pure function, every test in
 * `scripts/test-setup-script-generator.mjs` builds its chunks more than
 * once and compares them, and a clock reading inside it would make the
 * scheduler's stored copy and the pasted copy differ by whatever ran
 * first. */
const CLOCK_SANITY_MIN_YEAR = 2025;

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
 * printed once per missing interface, immediately.
 *
 * Queries the generic `/interface` menu, not `/interface ethernet` --
 * every physical ethernet port is still found here (RouterOS lists every
 * interface type, physical and virtual, under the generic menu), so this
 * is unchanged for the ethernet-only names this used to be called with
 * exclusively. It has to be the generic menu now that
 * `buildRouterSetupScriptChunks`'s `basicConfigOnly` mode exists: a
 * technician who set up a WAN's PPPoE session by hand in WinBox before
 * pasting this script names the *virtual* pppoe-client interface it
 * creates however they like, and that name would never be found under
 * `/interface ethernet` -- this check would otherwise loudly (and
 * wrongly) abort a perfectly valid basic-config script on its very first
 * chunk.
 *
 * Emitted as TWO separate one-statement `:if`s rather than one `:if` with
 * a `:put`-then-`:error` body. Two independent reasons, both hard rules
 * in this file now:
 *  - a multi-statement `do={}` body threw a real syntax error on a live
 *    router (see the Heartbeat chunk's own comment at the `;`-chaining
 *    incident), so every `do={}` in this generator holds exactly one
 *    statement;
 *  - the RouterOS console runs each entered line as its own program, so a
 *    block spread over several lines cannot be assumed to be one program
 *    either -- whether console brace-grouping keeps a block together
 *    across a paste was never verified on this hardware, and this file
 *    does not ship unverified assumptions.
 * The `find` runs twice instead of being cached in a `:local`; it is a
 * read-only query and costs nothing, the same trade the Heartbeat chunk's
 * own comment already made for its double address lookup. */
function wanExistenceCheckLines(wanIfNameExprs: string[]): string[] {
  const lines: string[] = [];
  wanIfNameExprs.forEach((expr) => {
    const missing = `[:len [/interface find where name=${expr}]] = 0`;
    lines.push(
      `:if (${missing}) do={ :put ("*** ERROR: WAN interface \\"" . ${expr} . "\\" was not found on this device. Did you rename it? Re-check /interface print and re-generate this script with the CURRENT name -- do NOT rename the interface to match the script. Aborting before touching bridge/NAT config. ***") }`,
      `:if (${missing}) do={ :error ("cloudguest-setup: WAN interface " . ${expr} . " not found") }`,
    );
  });
  return lines;
}

/** The clock chunk: set the timezone, turn the NTP client on, and then
 * ACTUALLY CHECK that the clock ended up sane -- printing a PASS/FAIL the
 * technician reads before pasting anything that speaks HTTPS.
 *
 * The check is the whole point. `/system ntp client set enabled=yes` is a
 * configuration statement, not a synchronisation: it needs working
 * outbound UDP 123, which at this point in the script is confirmed for
 * ICMP and DNS (the "WAN Connectivity Check" chunk immediately above) but
 * not for NTP -- plenty of venue firewalls pass ping and DNS and drop 123.
 * A router that sails on from here with a 1970 clock fails TLS on every
 * `/tool fetch`, so the heartbeat never lands, so Master console shows it
 * offline forever -- while the guest WiFi works perfectly and nothing
 * anywhere says why. That silent shape is exactly what this prints
 * instead.
 *
 * TWO independent signals, deliberately:
 *  1. `/system ntp client get status` = `"synchronized"`. This is the real
 *     answer and it never goes stale. Read inside `:do {} on-error={}`
 *     because not every RouterOS version exposes the property, and an
 *     unreadable property must degrade to "unknown", never abort the line.
 *  2. The year in `/system clock get date` is at least
 *     `CLOCK_SANITY_MIN_YEAR`. This is the backstop for the case where (1)
 *     is unreadable but the date is plainly garbage. Both RouterOS date
 *     spellings are handled: v7's ISO `2026-08-23` (year at 0..4) and
 *     v6/early-v7's `aug/23/2026` (year at 7..11). `(0 + [:tonum ...])` so
 *     that a `:tonum` returning nothing raises -- and is caught -- rather
 *     than leaving a nil that the following comparison would trip over.
 *
 * SHAPE RULES, same as every other chunk in this file. The NTP-configure
 * statement sits on its OWN entered line rather than being `;`-joined into
 * the verdict line: whether RouterOS treats an unknown parameter as a
 * catchable runtime error or an uncatchable parse error was NOT verified
 * on this hardware, and if it is the latter, joining them would take the
 * verdict down with it -- leaving the exact silent proceed this chunk
 * exists to end. Split like this, the worst case is "NTP was not
 * configured" AND a loud FAIL, which is the correct outcome.
 *
 * Everything that reads `$clkStatus`, `$clkDate`, `$clkYear` or
 * `$clkVerdict` sits on the same entered line as the `:local` that binds
 * it -- the RouterOS console runs each entered line as its own program.
 * Every `do={}` body holds exactly one statement. */
function buildClockNtpChunk(): RouterSetupScriptChunk {
  const serverList = CLOCK_NTP_SERVERS.join(",");
  const notSynced = `$clkStatus != "synchronized"`;
  const readStatus = `:do { :set clkStatus [:tostr [/system ntp client get status]] } on-error={ :set clkStatus "unreadable" }`;
  const verdictStatements: string[] = [`:local clkStatus "unreadable"`, readStatus];
  // Unrolled try/wait ladder, not a `:for` loop -- a loop cannot express
  // "attempt, and only wait if it did not work" with one statement per
  // `do={}` body. Identical idiom to the DHCP-gateway poll in the "WAN
  // Routing" chunk; see WAN_DHCP_GW_POLL_ATTEMPTS' own docstring.
  for (let retry = 1; retry < CLOCK_NTP_POLL_ATTEMPTS; retry++) {
    verdictStatements.push(`:if (${notSynced}) do={ :delay ${CLOCK_NTP_POLL_DELAY} }`);
    verdictStatements.push(`:if (${notSynced}) do={ ${readStatus} }`);
  }
  verdictStatements.push(
    `:local clkDate [:tostr [/system clock get date]]`,
    `:local clkYear 0`,
    `:do { :set clkYear (0 + [:tonum [:pick $clkDate 0 4]]) } on-error={ :set clkYear 0 }`,
    `:if ($clkYear < ${CLOCK_SANITY_MIN_YEAR}) do={ :do { :set clkYear (0 + [:tonum [:pick $clkDate 7 11]]) } on-error={ :set clkYear 0 } }`,
    `:local clkVerdict "FAIL"`,
    `:if ($clkStatus = "synchronized" && $clkYear >= ${CLOCK_SANITY_MIN_YEAR}) do={ :set clkVerdict "PASS" }`,
    `:put ("  NTP client status:  " . $clkStatus)`,
    `:put ("  Router clock reads: " . $clkDate)`,
    `:if ($clkVerdict = "PASS") do={ :put "  RESULT: PASS -- clock is set and NTP is synchronised." }`,
    `:if ($clkVerdict = "PASS") do={ :log info ("cloudguest-clock: NTP synchronised, clock reads " . $clkDate) }`,
    `:if ($clkVerdict != "PASS") do={ :put "  RESULT: FAIL -- THE CLOCK IS NOT SET. Do not paste Heartbeat yet." }`,
    `:if ($clkVerdict != "PASS") do={ :put "  This router has no battery-backed clock, so it boots with a" }`,
    `:if ($clkVerdict != "PASS") do={ :put "  wrong date every single time until NTP works. A wrong date" }`,
    `:if ($clkVerdict != "PASS") do={ :put "  fails HTTPS certificate validation, so /tool fetch to the" }`,
    `:if ($clkVerdict != "PASS") do={ :put "  platform is rejected before it is even sent -- the heartbeat" }`,
    `:if ($clkVerdict != "PASS") do={ :put "  never arrives and this router shows OFFLINE in Master console" }`,
    `:if ($clkVerdict != "PASS") do={ :put "  forever, while the guest WiFi works fine and nothing says why." }`,
    `:if ($clkVerdict != "PASS") do={ :put "  Check outbound UDP 123 is not blocked at this venue and that" }`,
    `:if ($clkVerdict != "PASS") do={ :put "  ${serverList} are reachable, then re-paste THIS chunk." }`,
    `:if ($clkVerdict != "PASS") do={ :log warning ("cloudguest-clock: NTP NOT synchronised (status=" . $clkStatus . ", clock reads " . $clkDate . ") -- HTTPS/TLS and therefore the heartbeat will fail until this is fixed") }`,
  );
  const lines = [
    `:log info "cloudguest-clock: setting time-zone ${CLOCK_TIME_ZONE} and enabling NTP (${serverList})"`,
    `/system clock set time-zone-autodetect=no time-zone-name=${CLOCK_TIME_ZONE}`,
    // RouterOS 7 spells the server list `servers=`; RouterOS 6 has no such
    // property and wants `primary-ntp=`/`secondary-ntp=` instead. Try v7,
    // fall back to v6, and say so if neither was accepted rather than
    // leaving the technician to infer it from a FAIL two lines later. One
    // statement in each `do=`/`on-error=` body, nested -- the same shape
    // the Heartbeat chunk already uses for its immediate-gw/gateway/ARP
    // ladder.
    `:do { /system ntp client set enabled=yes servers=${serverList} } on-error={ :do { /system ntp client set enabled=yes primary-ntp=${CLOCK_NTP_SERVERS[0]} secondary-ntp=${CLOCK_NTP_SERVERS[1]} } on-error={ :log warning "cloudguest-clock: the NTP client would accept neither the RouterOS 7 (servers=) nor the RouterOS 6 (primary-ntp=) syntax -- configure NTP by hand in WinBox under System > NTP Client" } }`,
    `:put "===================================================="`,
    `:put "  CLOCK / NTP CHECK"`,
    verdictStatements.join("; "),
    `:put "===================================================="`,
  ];
  return {
    label: "Clock + NTP (confirm PASS before continuing)",
    script: lines.join("\n"),
  };
}

/** True for a plain dotted-quad. Used only to tell "the backend handed us
 * a hostname" from "the backend handed us an address" -- `endpoint_host`
 * is documented backend-side as "public hostname **or** IP address", one
 * column, one string, either meaning. */
function looksLikeIpv4(value: string): boolean {
  const parts = value.trim().split(".");
  return parts.length === 4 && parts.every((p) => /^\d{1,3}$/.test(p) && Number(p) <= 255);
}

/** The WireGuard peer's `endpoint-address=`, and the DNS check that stops
 * it silently pointing at nothing.
 *
 * THE FAILURE THIS EXISTS FOR. RouterOS resolves `endpoint-address` ONCE,
 * at the moment the peer is created, and never again. If the venue's DNS
 * is not working at that moment, the peer is created pointing at nothing
 * and NOTHING REPORTS IT: the `add` succeeds, the console prints nothing,
 * and the tunnel simply never handshakes. Confirmed live on the founder's
 * own router (2026-08-22): `/tool fetch` returned `resolving error` while
 * WAN, DHCP, gateway, the default route and `/ip dns` servers were all
 * healthy. "Internet fine, DNS broken" is a real state on real hardware,
 * not a hypothetical.
 *
 * `:resolve` is the check, and it THROWS on failure -- so it is wrapped in
 * `:do {} on-error={}`, exactly as the "WAN Connectivity Check" chunk
 * already does for the same primitive. An unwrapped `:resolve` would abort
 * the rest of the line, which on a `;`-joined line means the peer is never
 * added AND nothing is printed: a worse version of the bug.
 *
 * WHAT HAPPENS WHEN IT FAILS, and why it depends on
 * `serverEndpointAddress`:
 *
 *  - **With a backend-supplied address** (`serverEndpointAddress` set): the
 *    peer is built against the raw address so the tunnel comes up today,
 *    and the terminal says loudly that it did, that the address can move,
 *    and that the peer must be REMOVED and this chunk re-pasted once DNS
 *    works. Removal matters because this chunk is add-if-missing: pasting
 *    it again on top of an existing peer does nothing at all.
 *  - **Without one** (today -- see `serverEndpointAddress`'s own docstring;
 *    the backend exposes no address field): NO PEER IS CREATED. That is
 *    deliberate and it is the better outcome. A peer created now would
 *    point at nothing forever and could never be repaired by re-pasting,
 *    because the add-if-missing guard would find it and skip. Creating
 *    nothing leaves the guard's `find` empty, so simply re-pasting this
 *    chunk after DNS is fixed does the right thing with no manual cleanup.
 *    The terminal says exactly that.
 *
 * WHY THE PEER CARRIES A COMMENT. A technician running
 * `/interface wireguard peers print detail` next week has no way to tell
 * whether `endpoint-address` holds a name or an address that was
 * substituted for one, or why. The comment says which, and says what to do
 * about it. It is the only durable record on the device.
 *
 * SHAPE. One `;`-joined line: every `$wg*` is bound and read on the same
 * entered line, because the RouterOS console runs each entered line as its
 * own program. Every `do={}` body holds exactly one statement, which is
 * why the failure banner is a flat list of separately-guarded `:put`s
 * rather than one `:if` with a block -- the same discipline the "WAN
 * Connectivity Check" chunk's verdict line already follows. */
function buildWireguardPeerLines(
  wireguard: WireguardPeerInfo,
  noPeerYet: string,
  peerArgs: string,
): string[] {
  const host = escapeForRouterOsString(wireguard.serverEndpointHost);
  // Already an address: there is nothing to resolve, so there is nothing
  // to check and no fallback to choose. Still comments the peer, because
  // "why is this an address and not a name" is exactly the question the
  // comment exists to answer.
  if (looksLikeIpv4(wireguard.serverEndpointHost)) {
    return [
      `:if (${noPeerYet}) do={ /interface wireguard peers add ${peerArgs} endpoint-address="${host}" comment="cloudguest-wg-hub: RAW ADDRESS ${host} -- the platform issued no hostname for the hub. If the hub moves, this peer must be rebuilt by hand." }`,
    ];
  }
  const fallback = wireguard.serverEndpointAddress?.trim();
  const fallbackEsc = fallback ? escapeForRouterOsString(fallback) : "";
  const stmts: string[] = [
    `:local wgHost "${host}"`,
    `:local wgEp $wgHost`,
    `:local wgCmt "cloudguest-wg-hub: HOSTNAME ${host} -- it resolved on this device when this peer was created"`,
    `:local wgDnsOk false`,
    `:do { :set wgDnsOk ([:len [:resolve $wgHost]] > 0) } on-error={ :set wgDnsOk false }`,
    `:local wgGo $wgDnsOk`,
  ];
  if (fallback) {
    stmts.push(
      `:if ($wgDnsOk = false) do={ :set wgEp "${fallbackEsc}" }`,
      `:if ($wgDnsOk = false) do={ :set wgCmt "cloudguest-wg-hub: RAW ADDRESS ${fallbackEsc} -- ${host} did NOT resolve here at setup time. Remove this peer and re-paste the WireGuard chunk once venue DNS works." }`,
      `:if ($wgDnsOk = false) do={ :set wgGo true }`,
      `:if ($wgDnsOk = false) do={ :put "*** WIREGUARD: DNS FAILED -- TUNNEL BUILT AGAINST A RAW ADDRESS ***" }`,
      `:if ($wgDnsOk = false) do={ :put ("  " . $wgHost . " did not resolve on this router, so the peer was") }`,
      `:if ($wgDnsOk = false) do={ :put ("  created against " . $wgEp . " instead. The tunnel should come up") }`,
      `:if ($wgDnsOk = false) do={ :put "  now, but that address can change without warning and this" }`,
      `:if ($wgDnsOk = false) do={ :put "  router would then be unreachable with no way in but a site visit." }`,
      `:if ($wgDnsOk = false) do={ :put "  FIX THIS VENUE'S DNS, then delete this peer in WinBox" }`,
      `:if ($wgDnsOk = false) do={ :put "  (WireGuard > Peers) and RE-PASTE this chunk. Re-pasting alone" }`,
      `:if ($wgDnsOk = false) do={ :put "  does nothing -- this chunk only adds a peer if none exists." }`,
      `:if ($wgDnsOk = false) do={ :log warning ("cloudguest-wg: " . $wgHost . " did not resolve -- peer built against the raw address " . $wgEp . "; fix DNS, delete the peer and re-paste the WireGuard chunk") }`,
    );
  } else {
    stmts.push(
      `:if ($wgDnsOk = false) do={ :put "*** WIREGUARD: DNS FAILED -- NO TUNNEL WAS BUILT ***" }`,
      `:if ($wgDnsOk = false) do={ :put ("  " . $wgHost . " did not resolve on this router.") }`,
      `:if ($wgDnsOk = false) do={ :put "  RouterOS resolves a peer's endpoint-address ONCE, when the peer" }`,
      `:if ($wgDnsOk = false) do={ :put "  is created. Creating one now would leave it pointing at nothing" }`,
      `:if ($wgDnsOk = false) do={ :put "  forever, and this chunk only adds a peer if none exists -- so" }`,
      `:if ($wgDnsOk = false) do={ :put "  re-pasting later would silently repair nothing. NO PEER WAS" }`,
      `:if ($wgDnsOk = false) do={ :put "  CREATED, on purpose, so that re-pasting DOES work." }`,
      `:if ($wgDnsOk = false) do={ :put "  Master console has no raw hub address to fall back to." }`,
      `:if ($wgDnsOk = false) do={ :put "  Fix this venue's DNS (check /ip dns and the upstream resolver)," }`,
      `:if ($wgDnsOk = false) do={ :put "  then re-paste THIS chunk. Nothing needs undoing first." }`,
      `:if ($wgDnsOk = false) do={ :log warning ("cloudguest-wg: " . $wgHost . " did not resolve -- NO peer created (one built now could never be repaired by re-pasting); fix DNS and re-paste the WireGuard chunk") }`,
    );
  }
  stmts.push(
    `:if ($wgDnsOk = true) do={ :log info ("cloudguest-wg: " . $wgHost . " resolved on this device -- peer endpoint set by hostname") }`,
    `:if ($wgGo = true && ${noPeerYet}) do={ /interface wireguard peers add ${peerArgs} endpoint-address=$wgEp comment=$wgCmt }`,
  );
  return [stmts.join("; ")];
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
 * Deliberately NOT redacted -- this runs inside the authenticated Master Console after
 * the real script has already been generated and shown on screen next to
 * a "Copy" button with the same real secrets -- redacting only the
 * downloaded file while leaving the on-screen version and clipboard copy
 * unredacted would be a false sense of security, not real protection. */
export function chunksToMarkdown(chunks: RouterSetupScriptChunk[], routerName?: string): string {
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
 * the `.rsc` file upload: one paste, no Files-tab upload step.
 *
 * **`;` and a newline are interchangeable AT THE TOP LEVEL ONLY.** The
 * generator relies on that heavily now -- most chunks are already single
 * `;`-joined lines, because the RouterOS console runs each ENTERED LINE
 * as its own program and a `:local` must therefore share a line with
 * every statement that reads it. Inside a `do={ ... }` body the two are
 * NOT interchangeable: a `;`-chained pair there threw a real syntax error
 * on a live router (see the Heartbeat chunk's own comment). The
 * docstring here used to claim the unqualified version, which is what
 * that incident disproved. Nothing this function does can reintroduce the
 * bad shape -- it only joins whole lines, and no chunk emits a
 * multi-statement body for it to flatten -- and
 * `scripts/test-setup-script-generator.mjs` asserts that of this
 * function's own output, not just of the chunks.
 *
 * Two things can't simply be `;`-joined:
 * - `#` comment lines run to end-of-line, so joining one with `; ` would
 *   silently swallow every statement after it as part of the comment.
 *   These carry no runtime meaning (they're annotations for a human
 *   reading the multi-line version) -- dropped entirely here, not escaped.
 * - A statement immediately after an opening `{` (or immediately before a
 *   standalone closing `}`) joins with a plain space instead of `; ` --
 *   matching the inline `do={ ... }` style already used everywhere else in
 *   this generator (e.g. `do={ /interface bridge port remove $wanPort }`);
 *   a leading `;` right inside a fresh block is unnecessary and untested
 *   against real RouterOS, so this avoids introducing it. This is a
 *   line-level heuristic, not a real brace-depth parser. It is now
 *   effectively dead code: every chunk this generator emits is fully
 *   inline, so no line ends in `{` or begins with `}` for it to catch.
 *   Kept as a backstop rather than deleted, and covered by the guard
 *   above either way. */
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
 * generation time. `mode: "pppoe"` needs `pppoeUsername`/`pppoePassword`
 * (the ISP-issued PPPoE login, common on fiber/ADSL links, especially in
 * India) instead of any of the static fields -- RouterOS dials this over
 * `iface` (the physical port) but the resulting session gets its own new
 * *virtual* interface (`/interface pppoe-client`'s own `name=`), which is
 * what actually ends up carrying this WAN's IP; `buildRouterSetupScriptChunks`
 * threads that virtual name through to every downstream NAT/firewall/
 * routing/mangle reference instead of the physical `iface`, and resolves
 * its live gateway the same "can legitimately be empty on first paste,
 * self-heals via the Heartbeat scheduler" way DHCP's gateway is resolved. */
export interface WanEntry {
  iface: string;
  mode: "static" | "dhcp" | "pppoe";
  ip?: string;
  cidr?: string;
  gateway?: string;
  /** PPPoE login credentials -- only meaningful (and required) when
   * `mode === "pppoe"`. */
  pppoeUsername?: string;
  pppoePassword?: string;
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

/** The whole heartbeat report, as ONE RouterOS-legal line: work out which
 * interface is actually carrying this router's internet traffic, read its
 * address, and POST it to master. Used twice per generated script -- once
 * pasted directly, once (after a further `escapeForRouterOsString`) stored
 * as the 5-minute scheduler's `on-event` body. Both copies are
 * byte-identical before that extra escaping pass, which is deliberate:
 * they are the same program, and having them drift was how the recurring
 * copy ended up reporting nothing for years of DHCP renewals.
 *
 * WHY IT IS ONE LINE
 * ------------------
 * The RouterOS console runs EACH ENTERED LINE as its own program: a
 * `:local` declared on one line does not exist on the next. The previous
 * version was three lines sharing `$wan1Ip`, so lines two and three were
 * a syntax error on paste -- while the `/system scheduler add` line above
 * them, being self-contained, succeeded. The scheduler appeared, the
 * router never checked in, and nothing anywhere said so. Every statement
 * that reads a `:local` here is therefore `;`-joined onto the same line
 * that binds it, and every `do={}` body holds exactly one statement (a
 * `;`-chained pair inside an inline `do={}` threw a real syntax error on
 * a live router -- see this chunk's own comment).
 *
 * WHY THE UPLINK IS DERIVED, NOT NAMED
 * ------------------------------------
 * This used to read the address off `wanEffectiveIfs[0]` -- whatever port
 * happened to be typed into "WAN 1 interface", normally `ether1`. A venue
 * with two or three ISPs whose live uplink is on `ether2` reported an
 * EMPTY `public_ip_address` while looking perfectly healthy, and nothing
 * anywhere said so. The port a link is plugged into is not evidence of
 * anything; the interface the active default route goes out of is.
 *
 * So: take the lowest-distance ACTIVE `0.0.0.0/0` route and resolve its
 * outgoing interface. Three resolution paths, tried in order, each
 * guarded, because RouterOS exposes this differently by version and by
 * link type:
 *  1. `immediate-gw`, which RouterOS 7 documents as `address%interface`
 *     -- split on the `%`. (Inferred from MikroTik's v7 documentation of
 *     that property. NOT verified on this fleet's hardware by me.)
 *  2. the route's plain `gateway`, when that names a real interface --
 *     which is what a point-to-point link like PPPoE produces.
 *  3. an `/ip arp` lookup of the gateway address, which is how a v6
 *     device (or any device where `immediate-gw` is absent) still answers
 *     the question, since the router is by definition ARPing its own live
 *     next hop.
 * Anything that survives all three must still name a real interface or it
 * is discarded. Every failure path lands on "not resolved", which is
 * reported as a fault, never as an address.
 *
 * MULTIPLE ACTIVE DEFAULT ROUTES
 * ------------------------------
 * A dual/triple-ISP venue routinely has more than one. This picks the
 * LOWEST DISTANCE deliberately -- that is the route RouterOS itself
 * prefers for the router's own traffic, which is the traffic this
 * heartbeat is, so the address reported is the address master would
 * actually see the request come from. Ties are broken by RouterOS's own
 * ordering within that distance, first match wins, and the sweep is an
 * explicit ascending `:for` over distances rather than "whatever the find
 * returns first" so the choice cannot silently depend on route order. When
 * there is more than one, the count and the winner are written to the log,
 * so "we picked one of several" is visible rather than incidental.
 *
 * THE THREE FAULTS ARE NOT THE SAME FAULT
 * ---------------------------------------
 * An empty string collapses "no uplink at all", "found the uplink, it has
 * no address" and "we never looked" into one indistinguishable value.
 * This file has been burned by exactly that before (`gateway=0.0.0.0`
 * passing a non-empty check). So:
 *  - address read           -> `public_ip_address` is sent.
 *  - no active default route
 *  - route found, interface unresolved
 *  - interface found, no address
 *                           -> the KEY IS OMITTED ENTIRELY, and a
 *                              `:log warning` naming which of the three it
 *                              was is written on the device.
 * Omission is not cosmetic. The backend's `RouterService.heartbeat` does
 * `if public_ip_address is not None: update_data[...] = ...` (checked in
 * `app/domains/router/service.py`, not assumed), so an absent key leaves
 * the last known good address in place while an empty string OVERWRITES
 * it with blank. Today's script sends the empty string. That is why a
 * router whose uplink moved ports shows a blank Public IP in Master
 * console rather than a stale one -- it is actively told the wrong thing.
 * A new JSON field would not help: `AgentHeartbeatRequest` is a plain
 * pydantic `BaseModel`, so unknown keys are silently dropped; the device
 * log is the only place a reason can actually be recorded. */
function buildHeartbeatStatements(opts: {
  apiBase: string;
  agentCredential: string;
  wireguard?: WireguardPeerInfo;
}): string {
  const { apiBase, agentCredential, wireguard } = opts;
  // JSON quotes are escaped one level here (`\"`), which is correct as-is
  // for the directly-pasted copy; the scheduler's stored copy has a second
  // level applied to this whole string by its own
  // `escapeForRouterOsString` call.
  const mgmtPair = wireguard
    ? `\\"management_ip_address\\":\\"${escapeForRouterOsString(wireguard.routerTunnelIp)}\\"`
    : "";
  const mgmtThenComma = mgmtPair ? `${mgmtPair},` : "";
  // `active=yes` AND `routing-mark=""`, and both halves are load-bearing.
  //
  // `active=yes`: RouterOS keeps an unreachable default route in the table
  // and flags it Inactive rather than removing it. Counting
  // `dst-address="0.0.0.0/0"` alone therefore says "1 route, looks
  // healthy" on a router whose fetch returns `Network unreachable` -- the
  // same class of mistake as `gateway=0.0.0.0` passing a non-empty check,
  // which this file has already been burned by once.
  //
  // `routing-mark=""`: on a multi-WAN router THIS GENERATOR ITSELF creates
  // several default routes -- one plain per WAN plus, in load-balance
  // mode, a `routing-mark="to_wan<N>"` route per WAN and a `distance=2`
  // crossover backup per WAN (see the "WAN Routing" chunk). Their marked
  // copies live in their own routing tables and are active there
  // simultaneously, so an unqualified find returns a handful of routes and
  // "the first one" would be whichever WAN's mark happened to sort first,
  // not the uplink carrying this traffic. The heartbeat is the ROUTER'S
  // OWN outbound traffic: the PCC mangle rules only mark LAN-originated
  // prerouting connections, never router-originated output, so this fetch
  // is routed by the MAIN table. The main table's own active default route
  // is therefore the exact, and only, correct answer -- and `routing-mark=""`
  // is the same filter the "WAN Routing" chunk above already uses for the
  // same "unmarked route only" reason. If it ever matches nothing, the
  // "no active default route" warning below fires and no address is sent:
  // a visible fault, never a wrong address.
  const mainDefaults = `[/ip route find where dst-address="0.0.0.0/0" active=yes routing-mark=""]`;
  const ifExists = `[:len [/interface find where name=$hbIf]] > 0`;
  return [
    // -- 1. which interface is carrying the default route ---------------
    `:local hbIf ""`,
    `:local hbDefCount [:len ${mainDefaults}]`,
    `:for hbDist from=1 to=255 do={ :if ($hbIf = "") do={ :foreach hbR in=[/ip route find where dst-address="0.0.0.0/0" active=yes routing-mark="" distance=$hbDist] do={ :if ($hbIf = "") do={ :do { :set hbIf [:tostr [/ip route get $hbR immediate-gw]] } on-error={ :do { :set hbIf [:tostr [/ip route get $hbR gateway]] } on-error={ :set hbIf "" } } } } } }`,
    `:if ([:typeof [:find $hbIf "%"]] != "nil") do={ :set hbIf [:pick $hbIf ([:find $hbIf "%"] + 1) [:len $hbIf]] }`,
    `:if ($hbIf != "" && !(${ifExists})) do={ :do { :set hbIf [:tostr [/ip arp get [find where address=$hbIf] interface]] } on-error={ :set hbIf "" } }`,
    `:if ($hbIf != "" && !(${ifExists})) do={ :set hbIf "" }`,
    // -- 2. say what was chosen, and flag a WAN-list disagreement -------
    `:if ($hbDefCount > 1 && $hbIf != "") do={ :log info ("cloudguest-hb: " . $hbDefCount . " active default routes, using lowest distance via " . $hbIf) }`,
    // Reported anyway rather than suppressed: the route is what actually
    // carries traffic, so its address is the true answer even when this
    // script's own "WAN" interface list disagrees. The disagreement is
    // itself worth a technician's attention -- it means the generated
    // script names the wrong ports -- so it is logged, not swallowed.
    `:if ($hbIf != "" && [:len [/interface list member find where interface=$hbIf list="WAN"]] = 0) do={ :log warning ("cloudguest-hb: uplink " . $hbIf . " is not in the WAN interface list -- address reported anyway, re-generate this script with the right WAN ports") }`,
    // -- 3. read the address off that interface -------------------------
    // `:foreach` + first-wins rather than `/ip address get [find ...]`:
    // `get` on a multi-element find errors, and an interface carrying two
    // addresses is ordinary, not a fault. Erroring there would have been
    // reported as "uplink has no address", which is a lie.
    `:local hbIp ""`,
    `:if ($hbIf != "") do={ :foreach hbA in=[/ip address find where interface=$hbIf] do={ :if ($hbIp = "") do={ :set hbIp [:pick [/ip address get $hbA address] 0 [:find [/ip address get $hbA address] "/"]] } } }`,
    // -- 4. three distinguishable faults, each with its own trace -------
    // Three DIFFERENT sentences, so `/log print` alone says which fault it
    // was. Kept terse on purpose: every character here is paid for twice,
    // once in the pasted copy and once (escaped) inside the scheduler's
    // stored on-event string, and this chunk's lines are already the
    // longest this generator emits.
    `:if ($hbDefCount = 0) do={ :log warning "cloudguest-hb: no ACTIVE default route -- uplink unknown, public_ip_address not sent (master keeps its last known value). See /ip route print" }`,
    `:if ($hbDefCount > 0 && $hbIf = "") do={ :log warning "cloudguest-hb: active default route found but its interface did not resolve (immediate-gw, gateway and ARP all failed) -- public_ip_address not sent" }`,
    `:if ($hbIf != "" && $hbIp = "") do={ :log warning ("cloudguest-hb: uplink " . $hbIf . " carries no IPv4 address -- public_ip_address not sent (a different fault from having no uplink)") }`,
    // -- 5. build the body, omitting what was not read ------------------
    `:local hbJson "{${mgmtPair}}"`,
    `:if ($hbIp != "") do={ :set hbJson ("{${mgmtThenComma}\\"public_ip_address\\":\\"" . $hbIp . "\\"}") }`,
    // A scheduler `on-event` that fails produces no toast, no popup and
    // nothing waiting for anyone to look -- and the one-shot copy's
    // failure scrolls past in the terminal with everything else. Both
    // copies stay wrapped so a failure leaves a real, timestamped line in
    // `/log print` that a technician (or this platform's remote support)
    // can find later. One statement in each of `:do {}` and `on-error={}`.
    `:do { /tool fetch url="${apiBase}/agent/heartbeat" http-method=post http-header-field="Content-Type: application/json,X-Agent-Credential: ${agentCredential}" http-data=$hbJson output=none } on-error={ :log warning "cloudguest-hb: /tool fetch to master failed (timeout/DNS/WAN down) -- see the WAN Connectivity Check chunk" }`,
  ].join("; ");
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
 * deleted; this is the only generator now.)
 *
 * Order, at a glance (default, `basicConfigOnly: false`): "WAN + Bridge" ->
 * "Stale Factory-Default DHCP Client Cleanup" -> "WAN Addressing" -> "WAN
 * Routing" -> the LAN-side chunks (LAN Interfaces/Ports/IP+DNS) ->
 * **"WAN Connectivity Check"** -- a manual checkpoint a technician reads
 * and must see PASS on before continuing (added after a confirmed-live
 * field report of a router whose WAN never actually came up, silently
 * breaking every later internet-dependent chunk -- see that chunk's own
 * comment) -- then **"Clock + NTP"**, a second manual checkpoint (the
 * hardware has no battery-backed clock, so a fresh or power-cycled unit
 * boots with a wrong date; a wrong date fails HTTPS certificate
 * validation, so the heartbeat never reaches the platform and the router
 * shows offline forever while guests get working WiFi -- see
 * `buildClockNtpChunk`'s own comment) -- then the Hotspot/portal/firewall
 * chunks, "Basic Mangle Rules" (paired with "WAN Routing", see that
 * chunk's own comment), and finally the internet-dependent ones these two
 * checkpoints exist for: RADIUS, WireGuard, and Heartbeat.
 *
 * THE TWO CHECKPOINTS SIT WHERE THEY DO FOR A REASON, and the reason is
 * a chain, not a preference. "LAN IP + DNS" is the only chunk that runs
 * `/ip dns set servers=`, and the WAN check's `:resolve` leg needs a
 * resolver -- run the check any earlier and it prints FAIL on a perfectly
 * healthy router (the WAN DHCP client this generator adds sets
 * `use-peer-dns=no`, so there is no other source). "Clock + NTP" then has
 * to follow the check, because NTP needs a working uplink and the check
 * is what proves there is one; and it has to precede every `/tool fetch`,
 * because a wrong clock fails TLS certificate validation. Heartbeat,
 * RADIUS and WireGuard stay below both for the same reachability reason
 * they always did.
 *
 * `basicConfigOnly: true` shortens this to: "WAN + Bridge" -> "Stale
 * Factory-Default DHCP Client Cleanup" ->
 * the same LAN-side chunks (now just "LAN IP", no DNS-server line) ->
 * **"WAN Connectivity Check"** -> **"Clock + NTP"** ->
 * Hotspot/portal/firewall -> RADIUS/WireGuard/Heartbeat. "WAN Addressing",
 * "WAN Routing", and "Basic Mangle Rules" never appear at all -- the
 * technician has already brought each WAN's own connectivity (and the
 * router's own upstream DNS servers) up by hand in WinBox before pasting
 * this. See `basicConfigOnly`'s own docstring below for exactly what still
 * runs and why (NAT masquerade / "WAN" interface-list membership in
 * particular still do, against whatever interface name the technician
 * already set up). */
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
  /** Now only names the local hotspot account to REMOVE, not one to
   * create -- see the Hotspot chunk. Still required (and still defaulted to
   * "guest" by `RouterSetupScriptAdvanced`) because that default is exactly
   * the account this generator used to create on every router, so it is the
   * name that has to be cleaned up in the field. */
  hsUser: string;
  /** @deprecated Read by nothing. The local hotspot user this password
   * belonged to was a full RADIUS/OTP bypass and is no longer created; see
   * the Hotspot chunk for what replaced it. Kept on the interface so the
   * existing form in `RouterSetupScriptAdvanced` keeps type-checking --
   * removing that field is a separate change in a file another engineer is
   * editing concurrently. The form still collects this value and it now
   * goes nowhere, which should be tidied up next. */
  hsPass?: string;
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
  /** Defaults to `false` (today's only behavior, unchanged for every
   * existing caller). `true` drops every chunk this generator produces
   * that either configures a WAN's own IP or decides how traffic is
   * routed across multiple WANs -- "WAN Addressing" (static IP/dhcp-
   * client/pppoe-client per WAN) and "WAN Routing" (the routing-mark'd/
   * distance-ordered default routes) entirely, plus "Basic Mangle Rules"
   * (meaningless without the routing marks "WAN Routing" would have
   * added -- these two chunks are a tightly-coupled pair, see "Basic
   * Mangle Rules"' own comment) and the DNS-server-setting half of "LAN
   * IP + DNS". The technician is expected to have already brought up
   * each WAN's connectivity by hand in WinBox (static/DHCP/PPPoE, their
   * choice) and to set the router's own upstream DNS servers by hand too
   * -- this mode is for a site where automating that is unwanted (a
   * technician who already knows exactly how they want WAN/DNS
   * configured and would rather not have this generator second-guess
   * it), not for one where it's unknown.
   *
   * **What still runs, and why:** every WAN entry's `iface` is still
   * required and still means something concrete even in this mode --
   * NAT masquerade (`out-interface=`) and "WAN" interface-list
   * membership (both normally added in "WAN + Bridge" above, or deferred
   * to "WAN Addressing" for a pppoe WAN whose virtual interface doesn't
   * exist yet at that point) still need to bind to *some* real interface
   * name, addressing mode or not -- dropping them along with the
   * addressing logic would silently leave a technician-configured WAN
   * with no outbound NAT at all, a real regression from today's script,
   * not a simplification of it. Since "WAN Addressing" never runs in
   * this mode, there is no later chunk to defer a pppoe WAN's NAT/list-
   * membership to the way today's script does -- so `wanEffectiveIfs`
   * and the "WAN + Bridge" loop below both ignore `wan.mode` entirely
   * under this flag and add NAT/list-membership immediately, using
   * `wan.iface` literally. That's correct precisely because the
   * technician's manual setup (whatever it produced -- a physical port
   * for static/DHCP, or a virtual pppoe-client interface for PPPoE)
   * already exists on the device by the time this script is ever pasted
   * (see this mode's own contract above), unlike the automated-PPPoE
   * case this generator otherwise handles, where that virtual interface
   * is created mid-script and genuinely doesn't exist yet when "WAN +
   * Bridge" runs. `wanExistenceCheckLines` below was generalized from
   * `/interface ethernet find` to plain `/interface find` for exactly
   * this reason -- a technician-provided PPPoE virtual interface name
   * would never be found under `/interface ethernet`, silently tripping
   * the loud abort this check exists to provide, even though the
   * interface is completely real. "WAN Connectivity Check" also still
   * runs unconditionally in this mode -- it's a read-only ping/DNS
   * diagnostic, not a WAN-configuring chunk, and stays exactly as useful
   * for confirming a technician's manual WAN setup actually works as it
   * is for confirming this generator's own. */
  basicConfigOnly?: boolean;
}): RouterSetupScriptChunk[] {
  const {
    apiBase,
    agentCredential,
    wans,
    lanIfs,
    lanBridge: rawLanBridge,
    lanIp,
    lanCidr,
    dnsServers,
    hsUser,
    enableFirewall,
    wireguard,
    radius,
    apiAccess,
    identity,
    portalUrl,
    wanRoutingMode = "load_balance",
    basicConfigOnly = false,
  } = opts;
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
  // The interface that actually ends up carrying a WAN's IP on-device --
  // the physical port itself for static/dhcp, but for pppoe a brand-new
  // *virtual* interface RouterOS creates for the PPPoE session (this
  // generator names it deterministically, `cloudguest-pppoe-wan<N>`, so
  // every chunk below can reference it without a live lookup). Everything
  // downstream that needs to match this WAN's actual traffic -- NAT
  // masquerade's `out-interface`, the "WAN" interface-list membership the
  // firewall/mangle chunks key off of, and each WAN's own mangle
  // `in-interface` -- must bind to THIS, not the physical name in
  // `wanIfs`: RouterOS delivers decapsulated PPPoE traffic on the
  // pppoe-client's own logical interface, never on the ethernet port
  // underneath it, so matching the physical port for a pppoe WAN would
  // silently never match anything at all.
  // `!basicConfigOnly &&` matters here: in that mode "WAN Addressing"
  // (the chunk that actually creates `cloudguest-pppoe-wan<N>`) never
  // runs at all, so that name would never exist on the device -- every
  // WAN's effective interface in `basicConfigOnly` mode is always
  // `wanIfs[idx]` literally, whatever the technician already set up by
  // hand and typed into the "WAN N interface" field (see
  // `basicConfigOnly`'s own docstring above for the full reasoning).
  const wanEffectiveIfs = wans.map((w, idx) =>
    !basicConfigOnly && w.mode === "pppoe" ? `cloudguest-pppoe-wan${idx + 1}` : wanIfs[idx],
  );
  const hasExplicitLan = !!lanIfs && lanIfs.length > 0;
  const base3 = lanIp.split(".").slice(0, 3).join(".");
  const poolStart = `${base3}.10`;
  const poolEnd = `${base3}.254`;
  const lanNetwork = `${base3}.0/${lanCidr}`;
  const chunks: RouterSetupScriptChunk[] = [];

  {
    const lines: string[] = [];
    lines.push(WAN_RENAME_WARNING_HEADER);
    lines.push(
      `:if ([:len [/interface list find where name="WAN"]] = 0) do={ /interface list add name="WAN" }`,
    );
    lines.push(
      `:if ([:len [/interface bridge find where name="${lanBridge}"]] = 0) do={ /interface bridge add name="${lanBridge}" }`,
    );
    lines.push(`/interface bridge set [find name="${lanBridge}"] disabled=no`);
    // See WAN_RENAME_WARNING_HEADER / wanExistenceCheckLines' own
    // docstring: must run before any bridge-port-removal/NAT below, which
    // otherwise silently no-op (rather than error) on a name that no
    // longer matches anything on the device.
    lines.push(...wanExistenceCheckLines(wanIfs.map((wanIf) => `"${wanIf}"`)));
    wanIfs.forEach((wanIf, idx) => {
      const n = idx + 1;
      // `:foreach` over the find-set instead of `:local wan<N>Port` +
      // `:if ([:len $wan<N>Port] > 0) do={ remove $wan<N>Port }`. The
      // console runs each entered line as its own program, so the old
      // second line referenced a `:local` that no longer existed: it was a
      // syntax error, the WAN port was never detached from a
      // factory-default bridge, and the "add every non-WAN port to the
      // bridge" chunk below then had a WAN sitting in the guest LAN -- the
      // exact L2 hole `WAN_RENAME_WARNING_HEADER` documents, arrived at by
      // a different route. `:foreach` carries no state across lines at
      // all, is a no-op on an empty find, and its body is one statement.
      lines.push(
        `:foreach wanPort in=[/interface bridge port find where interface="${wanIf}"] do={ /interface bridge port remove $wanPort }`,
      );
      // `!basicConfigOnly &&` on the pppoe check -- in `basicConfigOnly`
      // mode "WAN Addressing" never runs (see that flag's own docstring),
      // so there is no later chunk to defer to. Every WAN's NAT/list-
      // membership is added right here instead, unconditionally, against
      // `wanIf` literally -- correct because in this mode the technician
      // has already brought that interface up by hand (physical port or,
      // for a manually-configured PPPoE WAN, its own virtual pppoe-client
      // interface) before ever pasting this script, so it already exists
      // on the device the moment this chunk runs.
      if (!basicConfigOnly && wans[idx].mode === "pppoe") {
        // Deliberately NOT added here for pppoe -- "WAN" interface-list
        // membership needs a real, already-existing interface object
        // (`/interface list member add` errors on a name nothing currently
        // matches), unlike a NAT/mangle interface-name match, which is a
        // plain string comparison with no existence requirement. This
        // WAN's own virtual interface (`cloudguest-pppoe-wan${n}`) doesn't
        // exist yet at this point in the script -- the "WAN Addressing"
        // chunk below creates it, and adds both the WAN list membership and
        // the NAT masquerade rule itself, right after doing so.
      } else {
        lines.push(
          `:if ([:len [/interface list member find where interface="${wanIf}" list="WAN"]] = 0) do={ /interface list member add list="WAN" interface="${wanIf}" }`,
        );
        lines.push(
          `:if ([:len [/ip firewall nat find where chain=srcnat out-interface="${wanIf}" action=masquerade]] = 0) do={ /ip firewall nat add chain=srcnat out-interface="${wanIf}" action=masquerade comment="cloudguest-nat-wan${n}" }`,
        );
      }
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
    // Single `:foreach`, not `:local` + `:if` on the next line -- see the
    // "WAN + Bridge" chunk's own note. Pasted as two lines this never
    // removed anything: the second line read a `:local` the console had
    // already discarded, so the duplicate-address fault below survived
    // every provisioning run that was supposed to clear it.
    const lines = [
      `:foreach staleDefconfClient in=[/ip dhcp-client find where interface="bridgeLocal"] do={ /ip dhcp-client remove $staleDefconfClient }`,
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
  //
  // Skipped entirely in `basicConfigOnly` mode -- the technician has
  // already brought each WAN's own addressing up by hand in WinBox (see
  // `basicConfigOnly`'s own docstring above), so generating this at all
  // would fight whatever they already configured instead of leaving it
  // alone.
  if (!basicConfigOnly) {
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
        lines.push(
          `:foreach staleAddr in=[/ip address find where interface="${iface}" dynamic=yes] do={ /ip address remove $staleAddr }`,
        );
        lines.push(
          `:if ([:len [/ip address find where interface="${iface}" address="${wan.ip}/${wan.cidr}"]] = 0) do={ /ip address add address="${wan.ip}/${wan.cidr}" interface="${iface}" comment="cloudguest-addr-wan${n}" }`,
        );
      } else if (wan.mode === "dhcp") {
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
        // Three independent lines, each re-asking the SAME read-only
        // question ("is our own commented client missing?") instead of one
        // `:local` + a four-statement `:if` body. Two rules force this and
        // both are documented incidents, not style:
        //  - the console runs each entered line as its own program, so the
        //    old `:local wan<N>CloudguestClient` was gone by the time the
        //    next line read it;
        //  - a `do={}` body holds exactly one statement (the live
        //    `;`-chain syntax error, see the Heartbeat chunk).
        // The guard stays true across all three because nothing before the
        // final `add` creates a client carrying our comment, so the
        // sequence is identical to the old nested block -- and re-querying
        // is this file's established answer for a value needed more than
        // once (see the Heartbeat chunk's own double address lookup).
        const wanNoCguestClient = `[:len [/ip dhcp-client find where interface="${iface}" comment="cloudguest-dhcp-wan${n}"]] = 0`;
        lines.push(
          `:if (${wanNoCguestClient}) do={ :foreach otherClient in=[/ip dhcp-client find where interface="${iface}"] do={ /ip dhcp-client remove $otherClient } }`,
        );
        lines.push(
          `:if (${wanNoCguestClient}) do={ :foreach staleAddr in=[/ip address find where interface="${iface}" dynamic=yes] do={ /ip address remove $staleAddr } }`,
        );
        lines.push(
          `:if (${wanNoCguestClient}) do={ /ip dhcp-client add interface="${iface}" disabled=no add-default-route=no use-peer-dns=no comment="cloudguest-dhcp-wan${n}" }`,
        );
      } else {
        // pppoe -- like the dhcp branch above, `add-default-route=no`
        // deliberately: the "WAN Routing" chunk below owns every default
        // route itself. Unlike dhcp, this doesn't attach to the physical
        // `iface` directly -- `/interface pppoe-client add` creates a whole
        // new *virtual* interface for the session, named deterministically
        // here (`cloudguest-pppoe-wan${n}`, matching `wanEffectiveIfs`
        // above) instead of whatever auto-generated name RouterOS would
        // otherwise pick (`pppoe-out1`, ...), so every later chunk can
        // reference it without a live lookup.
        const pppoeIface = wanEffectiveIfs[idx];
        const pppoeUser = escapeForRouterOsString(wan.pppoeUsername ?? "");
        const pppoePass = escapeForRouterOsString(wan.pppoePassword ?? "");
        // Same self-heal discipline as the dhcp branch above -- check for
        // OUR OWN cloudguest-commented pppoe-client specifically, not just
        // "does any pppoe-client already exist on this interface". A
        // foreign/leftover pppoe-client already bound to this physical
        // port (a previous provisioning attempt, or a manual on-site
        // setup) is removed first if ours is missing, so this stays
        // self-healing on every re-run, not just a first-run check.
        // Same three-independent-lines restructure, and for the same two
        // reasons, as the dhcp branch immediately above.
        const wanNoCguestPppoe = `[:len [/interface pppoe-client find where interface="${iface}" comment="cloudguest-pppoe-wan${n}"]] = 0`;
        lines.push(
          `:if (${wanNoCguestPppoe}) do={ :foreach otherPppoe in=[/interface pppoe-client find where interface="${iface}"] do={ /interface pppoe-client remove $otherPppoe } }`,
        );
        lines.push(
          `:if (${wanNoCguestPppoe}) do={ :foreach staleAddr in=[/ip address find where interface="${iface}" dynamic=yes] do={ /ip address remove $staleAddr } }`,
        );
        lines.push(
          `:if (${wanNoCguestPppoe}) do={ /interface pppoe-client add name="${pppoeIface}" interface="${iface}" user="${pppoeUser}" password="${pppoePass}" disabled=no add-default-route=no comment="cloudguest-pppoe-wan${n}" }`,
        );
        // WAN interface-list membership and the NAT masquerade rule for
        // this WAN are added HERE, not in "WAN + Bridge" above, precisely
        // because `${pppoeIface}` didn't exist as a real interface until
        // the `add` immediately above ran (see that chunk's own comment on
        // this same point). Both checks are idempotent the same way as
        // every other chunk in this generator, independent of the
        // self-heal block above -- a no-op on a healthy re-run.
        lines.push(
          `:if ([:len [/interface list member find where interface="${pppoeIface}" list="WAN"]] = 0) do={ /interface list member add list="WAN" interface="${pppoeIface}" }`,
        );
        lines.push(
          `:if ([:len [/ip firewall nat find where chain=srcnat out-interface="${pppoeIface}" action=masquerade]] = 0) do={ /ip firewall nat add chain=srcnat out-interface="${pppoeIface}" action=masquerade comment="cloudguest-nat-wan${n}" }`,
        );
      }
    });
    chunks.push({
      label: "WAN Addressing (static IP, DHCP client, or PPPoE client per WAN)",
      script: lines.join("\n"),
    });
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
  //
  // A PPPoE WAN's gateway is resolved the same live, can-be-empty-at-first
  // way, but from a different place: `/interface pppoe-client` has no
  // queryable `gateway` property the way `/ip dhcp-client` does -- PPPoE is
  // a point-to-point link, and RouterOS surfaces the far end's address (the
  // ISP's own BRAS/concentrator, which doubles as the real next hop here)
  // via the pppoe-client interface's own live runtime state.
  //
  // NOT `/ppp active` (a same-day self-correction of this generator's own
  // prior commit, which used exactly that and shipped believing it worked):
  // `/ppp active` is RouterOS's list of PPP sessions *this router accepted
  // as a server* (PPPoE/PPTP/L2TP/OVPN/SSTP server, or async dial-in) --
  // it is never populated by a session this router itself *dialed out*
  // as a client, which is what `/interface pppoe-client` always is here.
  // `/ppp active find where name="cloudguest-pppoe-wan<N>"` therefore
  // matches nothing, ever, on any real router -- `wan${n}Gw` stayed
  // permanently empty and this WAN's default (and, in load-balance mode,
  // routing-mark'd) route silently never got created, no error, nothing
  // for the Heartbeat scheduler to self-heal since it only ever re-resolves
  // WAN1's *address* (see that chunk's own comment below), never any
  // WAN's gateway or routes. The actual RouterOS-documented mechanism for
  // a pppoe-client's live remote/gateway address is `/interface
  // pppoe-client monitor <name> once as-value` -- a one-shot runtime
  // snapshot (the same family as `/interface ethernet monitor`, not a
  // `find`/`get`-able stored property) whose `remote-address` key is
  // documented by MikroTik as "Remote IP Address allocated to server (ie
  // gateway address)" -- exactly the value this needs. Guarded the same
  // "skip, don't error" way as DHCP's own resolution below: the interface
  // may not exist yet (WAN Addressing hasn't run) or may still be
  // negotiating (status not yet "connected"), and re-pasting this chunk is
  // this generator's own established self-heal for that, not a new
  // mechanism.
  //
  // Skipped entirely in `basicConfigOnly` mode, together with the "Basic
  // Mangle Rules" chunk below -- these two are a tightly-coupled pair (see
  // that chunk's own comment): mangle rules with no matching routing-mark
  // route would black-hole marked traffic, and routes with no mangle
  // marking would never get any ordinary LAN traffic routed into them in
  // the first place, so there is no useful partial version of dropping
  // just one. A technician working in this mode is expected to have
  // already set up their own routing/failover (or accepted the router's
  // own single default route) by hand.
  if (!basicConfigOnly) {
    const lines: string[] = [];
    // ONE LINE PER WAN, `;`-joined -- not a multi-line block, and not two
    // passes (resolve every gateway, then build every route) the way this
    // used to be written.
    //
    // The RouterOS console runs EACH ENTERED LINE as its own program. A
    // `:local` declared on one line does not exist on the next. Every
    // reference to `$wan<N>Gw` and `$plainRoute<N>` below therefore has to
    // sit on the SAME line as its `:local`, or the route statements are a
    // syntax error and this chunk silently builds no default route at all
    // -- the router then has whatever RouterOS's own dhcp-client happened
    // to add (or nothing), with no `check-gateway=ping`, which is exactly
    // the "no gateway-health signal at all" state found live on WYFY-GUEST
    // and described at the end of this chunk.
    //
    // Every `do={}` body here still holds exactly ONE statement, which is
    // why the old `:if (gwOk) do={ ...six statements... }` block became a
    // flat list of statements that each re-state the `gwOk` guard. That is
    // the standing rule in this file after a `;`-chained pair inside an
    // inline `do={}` threw a real syntax error on a live router (see the
    // Heartbeat chunk's own comment).
    wans.forEach((wan, idx) => {
      const n = idx + 1;
      const iface = escapeForRouterOsString(wan.iface);
      const stmts: string[] = [];
      if (wan.mode === "static") {
        stmts.push(`:local wan${n}Gw "${wan.gateway}"`);
      } else if (wan.mode === "pppoe") {
        const pppoeIface = wanEffectiveIfs[idx];
        stmts.push(`:local wan${n}Gw ""`);
        stmts.push(
          `:if ([:len [/interface pppoe-client find where name="${pppoeIface}"]] > 0) do={ :do { :set wan${n}Gw ([/interface pppoe-client monitor [find name="${pppoeIface}"] once as-value]->"remote-address") } on-error={ :log warning "cloudguest: PPPoE WAN${n} gateway not resolved yet (still negotiating) -- re-paste this chunk once connected" } }`,
        );
      } else {
        // Confirmed live on a factory-fresh hEX (2026-08-21): reading the
        // lease immediately after adding the client returns nothing usable,
        // because the lease does not exist yet. `/import` never pauses, so
        // the route below landed with gateway `0.0.0.0`, flag `Is`
        // (Inactive), and every ping said `no route to host` -- on a router
        // whose WAN was perfectly healthy. Pasting chunk-by-chunk hides this
        // entirely: human typing delay is what lets DHCP bind. So this waits.
        //
        // Written as an UNROLLED try/wait ladder rather than the previous
        // `:for ... do={ :if (...) do={ <attempt>; <delay> } }`. That loop
        // packed two `;`-separated statements into one `do={}` body -- the
        // precise shape that threw a live syntax error on a real router
        // (Heartbeat chunk's comment), so it could never have run either.
        // A loop cannot express "attempt, and only wait if it did not work"
        // with one statement per body, so the retries are written out. Each
        // statement is a shape already proven on this hardware, and the
        // total wait (${WAN_DHCP_GW_POLL_ATTEMPTS} attempts,
        // ${WAN_DHCP_GW_POLL_DELAY} apart) is the same order as the 30x1s
        // the loop intended.
        const attempt = `:do { :set wan${n}Gw [:tostr [/ip dhcp-client get [find where interface="${iface}"] gateway]] } on-error={ :set wan${n}Gw "" }`;
        const unresolved = `[:len $wan${n}Gw] = 0 || $wan${n}Gw = "0.0.0.0"`;
        stmts.push(`:local wan${n}Gw ""`);
        stmts.push(attempt);
        for (let retry = 1; retry < WAN_DHCP_GW_POLL_ATTEMPTS; retry++) {
          stmts.push(`:if (${unresolved}) do={ :delay ${WAN_DHCP_GW_POLL_DELAY} }`);
          stmts.push(`:if (${unresolved}) do={ ${attempt} }`);
        }
      }
      // `"0.0.0.0" != ""` is TRUE, so the previous guard passed a zero
      // gateway into `/ip route add` -- RouterOS accepts it and silently
      // flags the route Inactive. Reject it explicitly.
      const gwOk = `$wan${n}Gw != "" && $wan${n}Gw != "0.0.0.0"`;
      // Nothing used to be said when a gateway failed to resolve: the whole
      // `:if (gwOk) do={...}` block was simply skipped, leaving a WAN with
      // no default route and no trace anywhere that it had been attempted.
      // Same "a silent skip is not a report" posture as the Heartbeat
      // chunk's fetch wrappers.
      lines.push(
        [
          ...stmts,
          `:if (!(${gwOk})) do={ :log warning "cloudguest: WAN${n} gateway did not resolve (still \\"" . $wan${n}Gw . "\\") -- no default route added for this WAN; re-paste this chunk once the link is up" }`,
          // Adopt-don't-duplicate: checked by OUR OWN comment first (the
          // normal, healthy-re-run case), but if that's missing this also
          // checks for ANY other route already sitting at this exact
          // dst-address+gateway before adding a new one. Confirmed-plausible
          // failure mode audited into this generator (2026-08-18): a DHCP WAN
          // whose interface already carries a foreign dhcp-client -- e.g. a
          // field engineer's own manually-added client, made before this
          // platform's "WAN Addressing" chunk ever got pasted (or re-pasted)
          // to replace it with this generator's own `add-default-route=no`
          // one -- keeps RouterOS's *default* `add-default-route=yes`
          // behavior, which auto-manages its own dynamic
          // `dst-address=0.0.0.0/0 gateway=<same IP> distance=1` route with
          // no `cloudguest-` comment. `/ip route add` on a byte-identical
          // dst-address+gateway (RouterOS's real duplicate-route check,
          // independent of comment) throws "failure: already have such
          // route" -- a real, visible route-related error, not the usual
          // silent skip this chunk otherwise relies on. Re-tagging that
          // existing route as ours instead of blindly adding a second one
          // fixes this for any WAN mode a foreign default route could show
          // up under, DHCP being the realistic trigger since it's the only
          // mode where RouterOS itself can independently create one.
          `:local plainRoute${n} [/ip route find where comment="cloudguest-plain-wan${n}"]`,
          // `routing-mark=""` on the fallback find so this only ever adopts
          // an unmarked (plain/foreign) route -- never one of this same
          // WAN's own routing-mark'd load-balance/failover routes below,
          // which share this exact dst-address+gateway by design and would
          // otherwise get wrongly mistaken for the plain route on a re-run.
          `:if (${gwOk} && [:len $plainRoute${n}] = 0) do={ :set plainRoute${n} [/ip route find where dst-address="0.0.0.0/0" gateway=$wan${n}Gw routing-mark=""] }`,
          `:if (${gwOk} && [:len $plainRoute${n}] = 0) do={ /ip route add dst-address=0.0.0.0/0 gateway=$wan${n}Gw distance=${n} check-gateway=ping comment="cloudguest-plain-wan${n}" }`,
          `:if (${gwOk} && [:len $plainRoute${n}] > 0) do={ /ip route set $plainRoute${n} gateway=$wan${n}Gw distance=${n} check-gateway=ping comment="cloudguest-plain-wan${n}" }`,
          // The routing-mark'd routes below are what the PCC mangle chunk
          // marks LAN-originated connections into -- meaningless (and never
          // generated) in failover-only mode, which relies purely on the
          // plain distance-ordered route above and RouterOS's own
          // lowest-active-distance selection for the entire failover
          // mechanism, no routing-mark of any kind.
          ...(wans.length > 1 && wanRoutingMode === "load_balance"
            ? (() => {
                // This WAN's own preferred (distance=1) routing-mark'd route
                // -- what the PCC mangle rules below send this WAN's share of
                // LAN-originated connections into. Crossover backup: the
                // *next* WAN's mark also gets a distance=2 route via this
                // WAN's gateway -- a ring (wan1 backs up wan2, wan2 backs up
                // wan3, ..., last WAN backs up wan1), not every pair
                // combination, so this stays one route per WAN regardless of
                // how many WANs there are instead of growing
                // combinatorially. Two WANs is the common case and
                // degenerates to exactly mutual backup.
                const nextN = ((idx + 1) % wans.length) + 1;
                const own = `[:len [/ip route find where comment="cloudguest-route-wan${n}"]]`;
                const backup = `[:len [/ip route find where comment="cloudguest-backup-wan${nextN}-via-wan${n}"]]`;
                return [
                  `:if (${gwOk} && ${own} = 0) do={ /ip route add dst-address=0.0.0.0/0 gateway=$wan${n}Gw routing-mark="to_wan${n}" distance=1 check-gateway=ping comment="cloudguest-route-wan${n}" }`,
                  `:if (${gwOk} && ${own} > 0) do={ /ip route set [find comment="cloudguest-route-wan${n}"] gateway=$wan${n}Gw }`,
                  `:if (${gwOk} && ${backup} = 0) do={ /ip route add dst-address=0.0.0.0/0 gateway=$wan${n}Gw routing-mark="to_wan${nextN}" distance=2 check-gateway=ping comment="cloudguest-backup-wan${nextN}-via-wan${n}" }`,
                  `:if (${gwOk} && ${backup} > 0) do={ /ip route set [find comment="cloudguest-backup-wan${nextN}-via-wan${n}"] gateway=$wan${n}Gw }`,
                ];
              })()
            : []),
        ].join("; "),
      );
    });
    if (wans.length > 1 && wanRoutingMode === "failover_only") {
      // Cleans up routing-mark'd routes a *previous* load-balance
      // provisioning of this same router may have left behind -- without
      // this, old PCC-marked traffic would still be routed via those
      // stale routing-marks even though the mangle chunk below is never
      // generated in this mode, silently reintroducing a load-balance-
      // shaped split under a "failover only" script. Safe to re-run: an
      // empty find is a no-op foreach.
      lines.push(
        `:foreach r in=[/ip route find where comment~"^cloudguest-route-wan"] do={ /ip route remove $r }`,
      );
      lines.push(
        `:foreach r in=[/ip route find where comment~"^cloudguest-backup-wan"] do={ /ip route remove $r }`,
      );
    }
    // MANDATORY for the dashboard's Bandwidth Utilization widget and the
    // whole ISP-health/alerting system (app.domains.isp) to mean anything on
    // this router: `check-gateway=ping` on the default route(s) this chunk
    // adds is what actually detects a dead upstream link at the network
    // level. Skip this chunk (or a technician never pastes it -- see the
    // "Confirmed live in production" comment right below for exactly that
    // failure mode) and the router has no gateway-health signal at all: its
    // only route is RouterOS's bare auto-DHCP one, and dashboard bandwidth
    // numbers/ISP alert rules will read from stale/absent health-check data
    // with no way to distinguish "internet's actually fine" from "nobody
    // ever wired up monitoring." Found live on WYFY-GUEST (2026-08-18) --
    // confirmed via direct RouterOS inspection that its only default route
    // had no check-gateway at all, months after provisioning.
    chunks.push({
      label:
        wanRoutingMode === "failover_only"
          ? "WAN Routing (failover only)"
          : "WAN Routing (load balancing + failover)",
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
    lines.push(
      `:if ([:len [/interface list find where name="LAN"]] = 0) do={ /interface list add name="LAN" }`,
    );
    (lanIfs as string[]).forEach((lanIf) => {
      lines.push(
        `:if ([:len [/interface list member find where interface="${lanIf}" list="LAN"]] = 0) do={ /interface list member add list="LAN" interface="${lanIf}" }`,
      );
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
    // REWRITTEN AS TWO INDEPENDENT ONE-LINE PASSES. The previous form was
    // a nine-line `:foreach` block with four `:local`s and two-statement
    // bodies, and it could not work when pasted: the RouterOS console runs
    // each entered line as its own program, so `$eth`, `$ethName`,
    // `$isWan`, `$isLan` and `$existingPort` were all read on lines after
    // the ones that bound them. Whether the console's brace-continuation
    // keeps such a block together across a paste has never been verified
    // on this hardware, and this generator does not ship on an unverified
    // assumption -- especially not this one, whose failure mode is a port
    // silently never joining the guest bridge (no DHCP for guests at all)
    // or a WAN port silently joining it (the L2 hole
    // `WAN_RENAME_WARNING_HEADER` exists for).
    //
    // Neither pass carries any state: both re-derive everything from
    // RouterOS's own live state inside a single `:foreach ... do={ :if
    // (...) do={ <one statement> } }`, so every `do={}` body holds exactly
    // one statement and no variable ever crosses a line. The repeated
    // `[/interface ethernet get $eth name]` lookups are read-only and cost
    // nothing, the same trade the Heartbeat chunk's own comment already
    // makes for its double address lookup.
    //
    // Pass 1 detaches an eligible LAN port from whatever OTHER bridge
    // currently holds it (`bridge!=` ours) -- the "some units ship a second
    // hardware-switch default bridge that pre-claims every port" case
    // above. Pass 2 then attaches every eligible port that is in no bridge
    // at all, which after pass 1 includes everything pass 1 just freed.
    // Splitting remove-then-add into two passes is what removes the need
    // for a two-statement body, and it is also strictly more re-runnable:
    // a port already in our bridge is skipped by both passes.
    //
    // "Is this a WAN port" is still decided by querying the "WAN" interface
    // list the previous chunk populated (RouterOS's own live state), not by
    // a second hardcoded copy of the WAN names -- see the note above.
    const ethName = `[/interface ethernet get $eth name]`;
    const eligible = [
      `[:len [/interface list member find where interface=${ethName} list="WAN"]] = 0`,
      ...(hasExplicitLan
        ? [`[:len [/interface list member find where interface=${ethName} list="LAN"]] > 0`]
        : []),
    ].join(" && ");
    const lines = [
      `:foreach eth in=[/interface ethernet find] do={ :if (${eligible} && [:len [/interface bridge port find where interface=${ethName} bridge!="${lanBridge}"]] > 0) do={ /interface bridge port remove [find where interface=${ethName} bridge!="${lanBridge}"] } }`,
      `:foreach eth in=[/interface ethernet find] do={ :if (${eligible} && [:len [/interface bridge port find where interface=${ethName}]] = 0) do={ /interface bridge port add bridge="${lanBridge}" interface=${ethName} } }`,
    ];
    chunks.push({
      label: hasExplicitLan
        ? "LAN Ports (only the explicitly-listed interfaces)"
        : "LAN Ports (add every non-WAN port to the bridge)",
      script: lines.join("\n"),
    });
  }

  {
    // Split so `basicConfigOnly` can drop only the DNS-server-setting line
    // below and keep LAN address assignment (never optional -- the
    // hotspot/DHCP-server chunks right after this one both hard-depend on
    // `lanBridge` already carrying `lanIp`) -- see `basicConfigOnly`'s own
    // docstring above for why a technician in this mode wants to set the
    // router's own upstream DNS servers by hand instead.
    //
    // The two WAN-DNS-block firewall rules at the end stay UNCONDITIONAL,
    // in every mode, including `basicConfigOnly` -- unlike the `/ip dns
    // set servers=...` line, they don't set or depend on any particular
    // DNS server value, they only close off port 53 on WAN input. That's
    // real hardening against this router acting as (or being probed as) an
    // open resolver from the internet regardless of whose DNS servers it's
    // actually using or who configured them -- dropping these along with
    // the DNS-server line in basic mode would remove a real security rule
    // for a reason that has nothing to do with it.
    const lines = [
      `:foreach addr in=[/ip address find where interface="${lanBridge}" dynamic=yes] do={ /ip address remove $addr }`,
      `:if ([:len [/ip address find where interface="${lanBridge}" address="${lanIp}/${lanCidr}"]] = 0) do={ /ip address add address=${lanIp}/${lanCidr} interface="${lanBridge}" }`,
      ...(basicConfigOnly
        ? []
        : [
            `/ip dns set servers="${escapeForRouterOsString(dnsServers)}" allow-remote-requests=yes`,
            // `allow-remote-requests=yes` above is a device-wide switch --
            // it has to stay on so guests behind the hotspot (and anything
            // resolving via WireGuard-tunneled management traffic) can
            // actually use this router as a resolver, but that also means
            // DNS is reachable from WAN the moment this chunk runs,
            // regardless of whether the (optional, togglable) "Firewall"
            // chunk below is ever pasted. This rule is unconditional --
            // not gated on `enableFirewall` -- so a technician who
            // generates a script with the broader firewall disabled still
            // doesn't end up with an open recursive resolver reachable
            // from the internet.
          ]),
      `:if ([:len [/ip firewall filter find where comment="cloudguest-fw-block-wan-dns"]] = 0) do={ /ip firewall filter add chain=input in-interface-list=WAN protocol=udp dst-port=53 action=drop comment="cloudguest-fw-block-wan-dns" }`,
      `:if ([:len [/ip firewall filter find where comment="cloudguest-fw-block-wan-dns-tcp"]] = 0) do={ /ip firewall filter add chain=input in-interface-list=WAN protocol=tcp dst-port=53 action=drop comment="cloudguest-fw-block-wan-dns-tcp" }`,
    ];
    chunks.push({ label: basicConfigOnly ? "LAN IP" : "LAN IP + DNS", script: lines.join("\n") });
  }

  // Confirmed live in production (2026-08-17, router "WYFY-GUEST"): a field
  // technician pastes every chunk below top-to-bottom with nothing in
  // between actually verifying WAN/internet/DNS came up first. The reported
  // failure was the Heartbeat chunk's `/tool fetch` to master.wyfyguest.com
  // dying with RouterOS's own "failure: timeout connecting" -- discovered
  // only after the fact, by separately noticing the heartbeat scheduler's
  // own run-count=0 and next-run stuck weeks in the past (see the
  // Heartbeat chunk's own comment below for what this generator now does
  // about that specific symptom). Heartbeat, RADIUS (a remote auth server),
  // and WireGuard (a remote tunnel endpoint) all assume real internet
  // reachability and were getting pasted and left running blind, with no
  // way for the technician to know mid-provisioning whether WAN+DNS
  // actually came up before committing to them.
  //
  // This is a manual checkpoint, not an automated gate: RouterOS has no
  // mechanism for a later, independently-pasted chunk to refuse to run
  // because an earlier one "failed" -- each chunk is its own paste by a
  // human, not one connected script with shared state, so there's no way
  // to make e.g. the Heartbeat chunk below actually block on this one. What
  // this CAN do -- and does -- is print an unambiguous PASS/FAIL the
  // technician reads before deciding whether to paste anything below it,
  // exactly the manual gate this was asked for.
  //
  // POSITION IS PART OF THE FIX. This chunk needs the default route "WAN
  // Routing" adds (an address alone is not enough to reach 8.8.8.8), and it
  // must precede every chunk that assumes real internet reachability
  // (Heartbeat, RADIUS, WireGuard). It ALSO has to come after "LAN IP +
  // DNS", and it previously did not -- that was a real defect, not a
  // nuance. The comment that stood here claimed "the LAN-side chunks ABOVE
  // (LAN Ports, LAN IP + DNS, Hotspot) don't depend on WAN being up", but
  // those chunks were pushed BELOW this one, and the dependency runs the
  // other way: this chunk's `:resolve` leg needs a resolver, and the only
  // line that gives the router one is `/ip dns set servers=` inside "LAN IP
  // + DNS".
  //
  // On a factory-fresh router the old order made the DNS leg fail
  // DETERMINISTICALLY, not intermittently, because the WAN DHCP client this
  // generator adds sets `use-peer-dns=no` (see the WAN chunk -- deliberate,
  // so the ISP cannot quietly become the fleet's resolver). So the router
  // had no DNS servers from any source at this point: ping PASS, DNS FAIL,
  // "RESULT: FAIL -- DO NOT paste the remaining chunks yet" on a router
  // with nothing wrong with it. A check that cries wolf on a healthy box is
  // worse than no check, because the next technician learns to page past
  // it -- and then misses the one time it is real.
  {
    let apiHost = "google.com";
    try {
      const parsedApiBase = new URL(apiBase);
      if (parsedApiBase.hostname) apiHost = parsedApiBase.hostname;
    } catch {
      // `apiBase` isn't a valid absolute URL -- shouldn't happen in
      // practice (see `getAbsoluteApiBase`'s own docstring, the only real
      // caller today), but nothing at the type level guarantees it. Falls
      // back to a well-known public host rather than emitting a DNS test
      // that's doomed to fail regardless of the router's own DNS health.
    }
    const apiHostEsc = escapeForRouterOsString(apiHost);
    // THE VERDICT LINE IS ONE LINE. Everything that reads `$pingOk`,
    // `$dnsOk` or either label sits on the same entered line as the
    // `:local` that binds it, because the RouterOS console runs each
    // entered line as its own program and a `:local` does not survive to
    // the next one. Pasted in its previous multi-line form, every line
    // after `:local pingOk false` was a syntax error -- and this is a
    // block whose entire job is to print a PASS/FAIL a technician then
    // acts on, so it printed a confident verdict computed from variables
    // that did not exist. That is the same shape as the guided-setup
    // audit block that told a factory-fresh hEX it had a dirty config.
    //
    // The `:put` lines that carry no variable stay on their own lines
    // (they are pure output and nothing depends on them), which keeps the
    // one long line down to just the logic and the lines that quote a
    // result. Each `do={}` body holds exactly one statement, so the old
    // `:if (...) do={ 3 statements } else={ 5 statements }` is now one
    // guarded statement per output line.
    const verdictOk = `$pingOk = true && $dnsOk = true`;
    const verdictBad = `!($pingOk = true && $dnsOk = true)`;
    const lines = [
      `:log info "cloudguest: WAN connectivity check starting (ping 8.8.8.8, resolve ${apiHostEsc})"`,
      `:put "===================================================="`,
      `:put "  WAN CONNECTIVITY CHECK"`,
      [
        // `/ping` used as an expression returns the number of replies
        // actually received -- a real reachability test, no DNS involved at
        // all (raw IP), so this alone already tells the technician whether
        // the WAN link/routing/ISP path works before DNS is even in play.
        `:local pingOk ([/ping 8.8.8.8 count=4] > 0)`,
        // `:resolve` throws on failure (NXDOMAIN, no DNS reachable, etc.) --
        // caught here instead of aborting the rest of the chunk. One `:set`
        // statement per `do=`/`on-error=` block, same discipline as the
        // Heartbeat chunk's own fetch line below: a `;`-chained pair of
        // statements inside an inline `do={}` has thrown a real syntax error
        // on a live router before (see that chunk's own comment) -- this
        // stays a single statement in each branch instead.
        `:local dnsOk false`,
        `:do { :set dnsOk ([:len [:resolve "${apiHostEsc}"]] > 0) } on-error={ :set dnsOk false }`,
        // How many resolvers this router actually has. `:resolve` failing
        // says nothing about WHY, and the two reasons need opposite
        // responses from the technician: a broken upstream is a fault to go
        // and fix, whereas zero configured servers just means a chunk has
        // not been pasted yet (or, in `basicConfigOnly`, that the operator
        // was always going to set them by hand). Reported explicitly rather
        // than left for someone to infer from a bare FAIL. Wrapped in
        // `:do`/`on-error=` because the property is spelled differently
        // across RouterOS versions and an unreadable one must degrade to
        // "unknown", never abort the verdict line.
        `:local dnsCount 0`,
        `:do { :set dnsCount [:len [/ip dns get servers]] } on-error={ :set dnsCount 0 }`,
        `:local pingLabel "FAIL"`,
        `:if ($pingOk = true) do={ :set pingLabel "PASS" }`,
        `:local dnsLabel "FAIL"`,
        `:if ($dnsOk = true) do={ :set dnsLabel "PASS" }`,
        `:put ("  Ping 8.8.8.8 (raw internet reachability): " . $pingLabel)`,
        `:put ("  Resolve ${apiHostEsc} (DNS):                " . $dnsLabel)`,
        `:if (${verdictOk}) do={ :put "  RESULT: PASS -- internet and DNS both work. Safe to paste" }`,
        `:if (${verdictOk}) do={ :put "  the remaining chunks (Hotspot, RADIUS, WireGuard, Heartbeat)." }`,
        `:if (${verdictOk}) do={ :log info "cloudguest: WAN connectivity check PASSED" }`,
        `:if (${verdictBad}) do={ :put "  RESULT: FAIL -- DO NOT paste the remaining chunks yet." }`,
        `:if (${verdictBad}) do={ :put "  Fix WAN cabling / ISP link / DNS servers, then re-paste THIS" }`,
        `:if (${verdictBad}) do={ :put "  chunk to re-check. Heartbeat/RADIUS/WireGuard all depend on" }`,
        `:if (${verdictBad}) do={ :put "  real internet reachability and will fail -- some silently --" }`,
        `:if (${verdictBad}) do={ :put "  until this shows PASS on both lines above." }`,
        `:if (${verdictBad} && $dnsCount = 0) do={ :put ("  Configured DNS servers: " . [:tostr $dnsCount] . " -- that alone explains the DNS FAIL.") }`,
        `:if (${verdictBad} && $dnsCount = 0) do={ :put "  This router has no resolver at all, so nothing here can resolve a name." }`,
        `:if (${verdictBad} && $dnsCount = 0) do={ :put "  Paste the LAN IP + DNS chunk first (or set /ip dns servers by hand in basic" }`,
        `:if (${verdictBad} && $dnsCount = 0) do={ :put "  mode), then re-paste this chunk. The WAN itself may be perfectly fine." }`,
        `:if (${verdictBad} && $dnsCount > 0) do={ :put ("  Configured DNS servers: " . [:tostr $dnsCount] . " -- so a resolver IS set and is not answering.") }`,
        `:if (${verdictBad}) do={ :log warning ("cloudguest: WAN connectivity check FAILED (ping=" . $pingLabel . " dns=" . $dnsLabel . ")") }`,
      ].join("; "),
      `:put "===================================================="`,
    ];
    chunks.push({
      label: "WAN Connectivity Check (confirm PASS before continuing)",
      script: lines.join("\n"),
    });
  }

  // Immediately after the connectivity checkpoint, and before ANYTHING
  // that speaks HTTPS. Both halves of that placement are load-bearing:
  //
  //  - it cannot come earlier, because NTP needs a working uplink and
  //    there is none until "WAN Routing" (or, in `basicConfigOnly`, the
  //    technician's own manual setup) has been confirmed by the check
  //    above. Enabling NTP on a router with no route would just produce a
  //    guaranteed FAIL that says nothing about the clock;
  //  - it must come before the Heartbeat chunk, the only place in this
  //    generator that does HTTPS (`/tool fetch` to `${apiBase}`), because
  //    a wrong clock fails certificate validation and the check-in is then
  //    rejected before it is ever sent.
  //
  // The check it follows now sits after "LAN IP + DNS" rather than after
  // "WAN Routing" (see that chunk's own POSITION IS PART OF THE FIX
  // comment -- its `:resolve` leg needs the resolver only "LAN IP + DNS"
  // configures). This chunk moved down with it and its ordering argument
  // is unchanged by that: "after the checkpoint, before any HTTPS" is
  // stated relative to the checkpoint, not to a fixed slot in the list,
  // and every `/tool fetch` in this generator is still below both.
  //
  // Runs in `basicConfigOnly` mode too, for the same reason the
  // connectivity check does: it configures nothing about WAN or routing,
  // and a technician who brought their own WAN up by hand has exactly the
  // same dead clock on exactly the same battery-less hardware.
  chunks.push(buildClockNtpChunk());

  {
    const hsUserEsc = escapeForRouterOsString(hsUser);
    const lines = [
      `:if ([:len [/ip pool find where name="hotspot-pool"]] = 0) do={ /ip pool add name="hotspot-pool" ranges=${poolStart}-${poolEnd} }`,
      // Two separate one-statement `:if`s, each with its OWN existence
      // check, rather than one `:if` whose body added both the server and
      // its network. A multi-statement `do={}` body threw a live syntax
      // error on a real router (see the Heartbeat chunk), and spreading it
      // over lines is no safer -- the console runs each entered line as its
      // own program. Giving the network its own `find` is also more
      // correct than nesting it under the server's: a router that already
      // had the dhcp-server but lost its network entry (or gained the
      // server by hand) used to be skipped silently, leaving guests with
      // leases but no gateway or DNS.
      `:if ([:len [/ip dhcp-server find where interface="${lanBridge}"]] = 0) do={ /ip dhcp-server add name="hotspot-dhcp" interface="${lanBridge}" address-pool="hotspot-pool" disabled=no }`,
      `:if ([:len [/ip dhcp-server network find where address="${lanNetwork}"]] = 0) do={ /ip dhcp-server network add address=${lanNetwork} gateway=${lanIp} dns-server=${lanIp} }`,
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
      // THE LOCAL HOTSPOT USER IS A COMPLETE PORTAL BYPASS, AND THIS
      // GENERATOR USED TO CREATE IT. The line that stood here was
      // `/ip hotspot user add name="guest" password="..."` ("guest" being
      // the default `hsUser` in `RouterSetupScriptAdvanced`) -- so this was
      // ours, not a RouterOS factory default left in place. Confirmed by
      // reading the emitted chunk, not inferred.
      //
      // RouterOS resolves a hotspot login against its LOCAL user list
      // BEFORE it ever asks RADIUS. Anyone who typed those credentials on
      // the stock login page was online immediately with: no OTP, no
      // `guest_sessions` row, no consent capture, no data cap, and no
      // accounting -- and, because the user carried no profile of its own,
      // on the `default` profile with whatever `shared-users` it has. Every
      // guarantee this platform sells, absent, with nothing logged anywhere
      // to show it had happened.
      //
      // So: create nothing, and actively remove the one we shipped. This is
      // a REMOVAL, not a disable -- a disabled hotspot user is one checkbox
      // away from being a bypass again, and unlike the WireGuard interface
      // above there is no way for removing it to strand anybody (RADIUS is
      // the only auth path this platform ever intends to use).
      [
        `:local hsLocal [:len [/ip hotspot user find where name="${hsUserEsc}"]]`,
        `:if ($hsLocal > 0) do={ /ip hotspot user remove [find where name="${hsUserEsc}"] }`,
        `:if ($hsLocal > 0) do={ :put ("  Removed " . [:tostr $hsLocal] . " local hotspot user(s) named ${hsUserEsc} -- that account bypassed OTP entirely.") }`,
        `:if ($hsLocal = 0) do={ :put "  No local hotspot user named ${hsUserEsc} on this device (expected)." }`,
      ].join("; "),
      // Any OTHER local user is the same bypass, and this script has no
      // business silently deleting an account somebody added deliberately.
      // Report the count instead: a non-zero number here is the operator's
      // to explain, and it is visible rather than buried.
      [
        `:local hsLeft [:len [/ip hotspot user find]]`,
        `:if ($hsLeft = 0) do={ :put "  Local hotspot users remaining: 0 -- every guest login now goes to RADIUS/OTP." }`,
        `:if ($hsLeft > 0) do={ :put ("  WARNING: " . [:tostr $hsLeft] . " local hotspot user(s) still exist on this router.") }`,
        `:if ($hsLeft > 0) do={ :put "  RouterOS checks local users BEFORE RADIUS, so each one is a portal bypass:" }`,
        `:if ($hsLeft > 0) do={ :put "  it signs in with no OTP, no session record, no consent and no data cap." }`,
        `:if ($hsLeft > 0) do={ :put "  Review them with /ip hotspot user print and remove any you did not intend." }`,
        `:if ($hsLeft > 0) do={ :log warning "cloudguest: local hotspot users present -- RADIUS/OTP can be bypassed" }`,
      ].join("; "),
      // RouterOS's own factory default for `/ip hotspot user profile
      // name="default"` is `shared-users=1` -- ONE device logged in per
      // guest identity at a time. Confirmed live (WYFY-GUEST, this
      // incident): a guest reusing the same email/phone on a second
      // device (the ordinary phone+laptop case) gets a hard `login
      // failed: no more sessions are allowed for user` on RouterOS's own
      // hotspot login page, not a soft/recoverable error. This profile is
      // never created by this script (it's a built-in RouterOS default
      // that always exists), so there's nothing to gate this `set` on --
      // no `:if [:len [find ...]]` guard needed, same as `login-by`/
      // `dns-name` above being plain unconditional `set`s against
      // `hsprof1`. `shared-users` was NOT set to `0` for "unlimited":
      // MikroTik's own docs give its range as `1..4294967295` with no
      // documented `0`-means-unlimited sentinel (checked, not assumed --
      // unlike `shared-users=0` on some *other* MikroTik properties,
      // this one has no confirmed unlimited value), so `0` would risk
      // silently rejecting or misbehaving on real hardware. `5` is the
      // exact value already confirmed live in production today.
      `:if ([:len [/ip hotspot user profile find where name="default"]] > 0) do={ /ip hotspot user profile set [find where name="default"] shared-users=5 }`,
      // RouterOS's own factory default `keepalive-timeout` on this same
      // "default" user profile is 2 minutes -- confirmed live (WYFY-GUEST,
      // same incident as shared-users above): a real guest's phone
      // briefly locking/backgrounding (ordinary, extremely common mobile
      // behavior, not an actual disconnect) missed the router's periodic
      // keepalive check and got a hard `logged out: keepalive timeout`,
      // even though real data had been flowing seconds earlier (a genuine
      // Acct-Session-Time in the hundreds of seconds, not a stuck/never-
      // worked session). `none` disables this specific check entirely.
      //
      // This comment used to end by claiming that "`idle-timeout=5m` on the
      // hotspot server itself (`/ip hotspot`, untouched by this script)" was
      // the real backstop. That was wrong on both halves and it is why
      // nothing closed a session for so long: `/ip hotspot` has no
      // `idle-timeout` property, and the object that does -- this very user
      // profile -- defaults to `none`. The backstop is set explicitly on the
      // next line; see `HOTSPOT_IDLE_TIMEOUT`.
      `:if ([:len [/ip hotspot user profile find where name="default"]] > 0) do={ /ip hotspot user profile set [find where name="default"] keepalive-timeout=none }`,
      // NOTHING WAS EVER CLOSING A SESSION. `keepalive-timeout=none` above
      // switches off the only reaper this profile had, and `idle-timeout`
      // was never set to replace it -- so a session, once opened, stayed
      // open forever. The comment above used to justify that by pointing at
      // "`idle-timeout=5m` on the hotspot server itself, untouched by this
      // script"; that is the wrong object. `/ip hotspot` (the server) has
      // no `idle-timeout` property at all -- idle timeout lives on the USER
      // PROFILE, which is exactly the object this chunk is configuring and
      // exactly the one that was left at RouterOS's own default of `none`.
      // Result: guests who left hours ago still held their slots against
      // `shared-users`, the device count Master console shows never came
      // down, and RADIUS accounting never saw a Stop for them.
      //
      // Thirty minutes, not five, and deliberately not
      // two: two minutes is the keepalive value whose false logouts caused
      // the incident that turned keepalive off in the first place, and
      // re-introducing a short timer here would recreate that bug wearing a
      // different name. The two measure genuinely different things --
      // keepalive fired on a MISSED POLL (a phone with its screen off is
      // idle by that definition), idle-timeout fires only on ZERO BYTES in
      // either direction, which a connected-but-pocketed phone does not
      // produce for long thanks to push and background sync. A window this
      // wide clears a departed guest well inside a venue's turnover while
      // staying far outside the range where ordinary phone behaviour looks
      // like an absence.
      `:if ([:len [/ip hotspot user profile find where name="default"]] > 0) do={ /ip hotspot user profile set [find where name="default"] idle-timeout=${HOTSPOT_IDLE_TIMEOUT} }`,
      // The four `set`s above are all `[find name="default"]`. RouterOS's
      // `set` against an EMPTY match succeeds silently -- the same trap as
      // the portal `/file set` -- so on a device without that built-in
      // profile every one of them would do nothing and report nothing.
      // Print the count, and read the value back rather than assuming the
      // write landed.
      [
        `:local hsProf [:len [/ip hotspot user profile find where name="default"]]`,
        `:if ($hsProf = 0) do={ :put "  FAIL -- no hotspot user profile named default exists on this router." }`,
        `:if ($hsProf = 0) do={ :put "  shared-users, keepalive-timeout and idle-timeout were NOT applied." }`,
        `:if ($hsProf = 0) do={ :put "  Sessions will never expire and device limits will not hold. Check /ip hotspot user profile print." }`,
        `:if ($hsProf = 0) do={ :log warning "cloudguest: hotspot default user profile missing -- session limits not applied" }`,
        `:if ($hsProf > 0) do={ :put ("  Hotspot default profile: idle-timeout=" . [:tostr [/ip hotspot user profile get [find where name="default"] idle-timeout]] . " shared-users=" . [:tostr [/ip hotspot user profile get [find where name="default"] shared-users]]) }`,
      ].join("; "),
    ];
    chunks.push({ label: "Hotspot", script: lines.join("\n") });
  }

  {
    // **BOOTSTRAP-ONLY FALLBACK -- not the fleet's real fix.** As of
    // 2026-08-18 there is now a REAL, publicly-trusted Let's Encrypt
    // certificate for the hotspot, issued centrally (DNS-01 against
    // GoDaddy's API from `cloudguest-vm`, `20.219.51.94`) and pushed to
    // routers by `ops/letsencrypt-hotspot/renew-hotspot-certs.sh` on a
    // systemd timer -- see `cloud-guest-repo/backend/ops/letsencrypt-hotspot
    // /README.md` for the full mechanism. That real cert is NOT something
    // this generator can produce or embed itself: DNS-01 needs a real
    // DNS-provider API credential and a server that can reach it, neither
    // of which RouterOS's own scripting environment has or should have
    // (the entire point of DNS-01 + centralized renewal is that it does
    // NOT require per-router internet-facing validation). This chunk's
    // self-signed CA + leaf cert below still runs on every provision,
    // purely so `hsprof1` never has NO certificate at all (RouterOS's
    // hotspot HTTPS flatly won't come up with none configured) in the
    // window between this router being provisioned and it being added to
    // `renew-hotspot-certs.sh`'s own `ROUTERS` fleet list. Once that
    // addition happens (a manual, out-of-band step -- see this same
    // README's "Fleet rollout" section for exactly what it requires per
    // router), the centralized renewal script overwrites this
    // self-signed binding with the real cert on its own, and this
    // chunk's output becomes dead weight left on the device, not
    // something anyone needs to come back and clean up here.
    //
    // Best-effort and SECONDARY to the "Walled Garden IP" chunk above,
    // which is the actual, confirmed fix for the primary bug (see
    // `buildWalledGardenIpLines`'s own docstring). Properly
    // walled-gardened HTTPS traffic to the real portal bypasses the
    // hotspot's own interception/redirect ENTIRELY -- it never touches
    // hsprof1's certificate at all, so this chunk is NOT needed for the
    // primary guest-portal flow to work, and was not required to fix the
    // confirmed bug. What it's for instead: any *other* HTTPS site a
    // not-yet-authenticated guest's device tries first (their OS's own
    // captive-portal-detection probe, a bookmarked HTTPS page, etc.) is
    // still intercepted by the hotspot's HTTPS redirect, and giving that
    // interception a real (if self-signed) certificate to present is
    // strictly better than whatever RouterOS falls back to with none
    // configured at all. The guest will still see a browser security
    // warning for any THIRD-PARTY domain either way -- MITM-ing arbitrary
    // HTTPS without the client trusting this router's own CA is not
    // solvable at all, by design; only the platform's own domain can ever
    // be made to work cleanly pre-auth, and that's exactly what Walled
    // Garden IP above already does.
    //
    // Two-step self-signed pattern -- a CA-capable cert that signs
    // itself, then a separate leaf cert signed BY that CA -- confirmed
    // live, working, this session: both `/certificate add` calls and both
    // `/certificate sign` calls completed with no error on a real router
    // (RouterOS 7.23.3, hEX lite). Signing only happens nested inside the
    // same not-yet-exists `:if` as its own `add`, never re-attempted
    // against an already-existing cert on re-paste -- re-signing an
    // already-signed cert was not tested live, and "already exists, leave
    // it alone" is exactly as correct and matches every other
    // not-meant-to-be-refreshed self-heal idiom in this file.
    //
    // **UPDATE -- the binding oddity below is now resolved, confirmed
    // live** (same router/RouterOS version, same-day follow-up). The
    // earlier attempt (`ssl-certificate=...` alone) silently no-op'd
    // because two things were missing, both required in the SAME `set`
    // command: (1) the leaf certificate must be marked `trusted=yes`
    // explicitly -- signing it by our own CA does not implicitly mark it
    // trusted, unlike the CA cert itself; (2) `login-by` must include
    // `https` -- RouterOS's hotspot module appears to only apply/persist
    // `ssl-certificate` when the profile's own `login-by` actually calls
    // for an HTTPS challenge, otherwise the property is accepted (no
    // console error -- it's a real, valid property, confirmed by a
    // control test against a bogus certificate name correctly erroring)
    // but silently discarded rather than stored. With both pieces
    // present, `ssl-certificate=cloudguest-hotspot-leaf` immediately
    // showed up in `print terse` output as expected. `http-pap` is kept
    // alongside `https` in `login-by` (not replaced) since it's what the
    // Hotspot chunk already sets and other flows may still rely on it.
    // CORRECTION (2026-08-21, confirmed live on a factory-fresh hEX,
    // RouterOS 7.23.3): the previous `/certificate sign cloudguest-ca
    // ca=cloudguest-ca` FAILS with `input does not match any value of ca`.
    // `ca=` names the *signing* authority -- a different, already-signed
    // certificate carrying the AUTHORITY flag and a private key. A
    // just-added cert is an unsigned template with no CA capability, so
    // `ca=<itself>` resolves against nothing. Omitting `ca=` entirely is
    // what produces a self-signed root.
    //
    // The "confirmed live, working, this session" note above was a false
    // positive: on that test box `cloudguest-ca` already existed from an
    // earlier manual experiment, so the `:if` guard skipped the whole
    // block and "both sign calls completed with no error" was trivially
    // true. It only runs for the first time on a genuinely fresh router.
    //
    // Also: one statement per `do={}`, with the guard captured into a
    // `:local` BEFORE the add so both branches agree. Multi-statement
    // `do={}` blocks threw a real syntax error on a live router (see the
    // Heartbeat chunk's own comment), which contradicts
    // `chunksToSingleLineScript`'s own "`;` is interchangeable with a
    // newline" docstring.
    //
    // The `:local` guard and the two statements that read it are now ONE
    // `;`-joined line each. They have to be: the RouterOS console runs
    // each entered line as its own program, so `$needCguestCa` was gone by
    // the time the next line asked for it. Both `:if`s were a syntax
    // error, meaning the CA and the leaf were added but NEVER SIGNED -- an
    // unsigned certificate cannot be bound to the hotspot profile, so this
    // chunk's whole point silently did not happen on every fresh router.
    // The `:local` cannot be re-queried away here (unlike elsewhere in
    // this file): the check is "did this exist BEFORE we added it", and
    // re-asking after the `add` gives the opposite answer.
    const lines = [
      [
        `:local needCguestCa ([:len [/certificate find where name="cloudguest-ca"]] = 0)`,
        `:if ($needCguestCa) do={ /certificate add name="cloudguest-ca" common-name="cloudguest-ca" key-usage=key-cert-sign,crl-sign,tls-server }`,
        `:if ($needCguestCa) do={ /certificate sign cloudguest-ca }`,
      ].join("; "),
      `/certificate set [find name="cloudguest-ca"] trusted=yes`,
      // `/certificate sign` can return before signing actually completes,
      // so the leaf's `ca=cloudguest-ca` may run against a CA that is not
      // yet a usable authority -- which fails with the same "input does
      // not match any value of ca" as the old bug and looks identical.
      // Three seconds of insurance. Its own line: it binds nothing and
      // reads nothing, and it must land after the CA is signed.
      `:delay 3s`,
      [
        `:local needCguestLeaf ([:len [/certificate find where name="cloudguest-hotspot-cert"]] = 0)`,
        `:if ($needCguestLeaf) do={ /certificate add name="cloudguest-hotspot-cert" common-name="${HOTSPOT_DNS_NAME}" key-usage=tls-server }`,
        `:if ($needCguestLeaf) do={ /certificate sign cloudguest-hotspot-cert ca=cloudguest-ca }`,
      ].join("; "),
      `/certificate set [find name="cloudguest-hotspot-cert"] trusted=yes`,
      `/ip hotspot profile set [find name="hsprof1"] ssl-certificate="cloudguest-hotspot-cert" login-by=https,http-pap dns-name="${HOTSPOT_DNS_NAME}"`,
    ];
    chunks.push({
      label:
        "Self-Signed HTTPS Certificate (bootstrap only — replace with the fleet's real Let's Encrypt cert via ops/letsencrypt-hotspot/renew-hotspot-certs.sh once this router is added to that script's fleet list)",
      script: lines.join("\n"),
    });
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
      chunks.push({
        label: "Walled Garden (let unauthenticated guests reach the portal)",
        script: walledGarden,
      });
    }

    // Separate chunk, deliberately not folded into the one above: the
    // host-based entry alone only covers plain HTTP -- see
    // `buildWalledGardenIpLines`'s own docstring for the confirmed,
    // severe, fleet-wide bug this fixes (the vast majority of real guest
    // traffic is HTTPS, and without this, that traffic never reaches the
    // real portal at all). Both are needed together, not either/or.
    const walledGardenIp = buildWalledGardenIpLines(portalUrl);
    if (walledGardenIp) {
      chunks.push({
        label: "Walled Garden IP (let unauthenticated guests reach the portal over HTTPS)",
        script: walledGardenIp.join("\n"),
      });
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
      "1.1.1.1",
      "1.0.0.1", // Cloudflare
      "8.8.8.8",
      "8.8.4.4", // Google
      "9.9.9.9",
      "149.112.112.112", // Quad9
      "208.67.222.222",
      "208.67.220.220", // OpenDNS
      "94.140.14.14",
      "94.140.15.15", // AdGuard
    ];
    const lines: string[] = [];
    // One guarded `add` PER ADDRESS instead of one `:if` wrapping ten of
    // them. A ten-statement `do={}` body is exactly the shape that threw a
    // live syntax error (see the Heartbeat chunk), and spreading it over
    // lines is no safer -- the console runs each entered line as its own
    // program. Per-address guards are also strictly more self-healing: the
    // old "does the list exist at all" check meant a list that had been
    // partially emptied by hand never got its missing entries back.
    dohIps.forEach((ip) => {
      lines.push(
        `:if ([:len [/ip firewall address-list find where list="cloudguest-doh-ips" address=${ip}]] = 0) do={ /ip firewall address-list add list="cloudguest-doh-ips" address=${ip} comment="cloudguest-doh" }`,
      );
    });
    lines.push(
      `:if ([:len [/ip firewall filter find where comment="cloudguest-block-dot-udp"]] = 0) do={ /ip firewall filter add chain=forward hotspot=!auth protocol=udp dst-port=853 action=drop comment="cloudguest-block-dot-udp" }`,
    );
    lines.push(
      `:if ([:len [/ip firewall filter find where comment="cloudguest-block-dot-tcp"]] = 0) do={ /ip firewall filter add chain=forward hotspot=!auth protocol=tcp dst-port=853 action=drop comment="cloudguest-block-dot-tcp" }`,
    );
    lines.push(
      `:if ([:len [/ip firewall filter find where comment="cloudguest-block-doh"]] = 0) do={ /ip firewall filter add chain=forward hotspot=!auth protocol=tcp dst-port=443 dst-address-list=cloudguest-doh-ips action=drop comment="cloudguest-block-doh" }`,
    );
    chunks.push({
      label: "Block DNS-over-HTTPS (forces captive portal to actually show)",
      script: lines.join("\n"),
    });
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
  if (!basicConfigOnly && wanIfs.length > 1 && wanRoutingMode === "load_balance") {
    const lines: string[] = [];

    // Weighted split only when EVERY enabled WAN has a positive weight --
    // a partial weighting (the backend's own validate_wan_routing_weights
    // already rejects this at the point an admin confirms load-balance
    // mode, but this generator makes the identical call independently,
    // defensively, on whatever data it's actually handed) silently falls
    // back to the existing even split rather than guessing which WANs the
    // missing weights were meant for.
    const allWeighted = wans.every((w) => typeof w.weight === "number" && w.weight > 0);
    const weightedPlan = allWeighted
      ? buildWeightedPccPlan(wans.map((w) => w.weight as number))
      : null;

    if (weightedPlan) {
      // Ratio changes need delete-then-recreate, not the usual add-if-
      // missing idempotency: a ratio going from e.g. 70:30 (7+3=10 rules)
      // to 50:50 (5+5=10 rules) reuses the same total rule count but a
      // different WAN-to-index mapping -- the existence-check-per-rule
      // pattern every other chunk in this generator uses would leave
      // stale index rules pointing at the wrong WAN. Safe to re-run: an
      // empty find is a no-op foreach, so this is a no-op on a router
      // that has never had weighted PCC rules at all.
      lines.push(
        `:foreach r in=[/ip firewall mangle find where comment~"^cloudguest-mangle-pcc-wan"] do={ /ip firewall mangle remove $r }`,
      );
    }

    // Every `:if ... do={ <one add> }` below is emitted on ONE line. The
    // bodies were always single statements; splitting them over three
    // lines only ever relied on the console keeping a brace-opened block
    // together across a paste, which was never verified on this hardware.
    wanEffectiveIfs.forEach((wanIf, idx) => {
      const n = idx + 1;
      lines.push(
        `:if ([:len [/ip firewall mangle find where comment="cloudguest-mangle-input-wan${n}"]] = 0) do={ /ip firewall mangle add chain=input in-interface="${wanIf}" action=mark-connection new-connection-mark="wan${n}_conn" passthrough=yes comment="cloudguest-mangle-input-wan${n}" }`,
      );
      if (weightedPlan) {
        // One rule PER INDEX in this WAN's own share of the GCD-reduced
        // denominator, not one rule per WAN -- e.g. a 70:30 split
        // (GCD-reduced to 7:3, N=10) gives WAN1 seven rules (indices
        // 0-6) and WAN2 three (indices 7-9). Each rule's own comment
        // (`...-idxK`) is unique, so the cleanup foreach above and this
        // add-if-missing check never collide across a ratio change.
        weightedPlan.indicesByWan[idx].forEach((i) => {
          lines.push(
            `:if ([:len [/ip firewall mangle find where comment="cloudguest-mangle-pcc-wan${n}-idx${i}"]] = 0) do={ /ip firewall mangle add chain=prerouting in-interface="${lanBridge}" dst-address-type=!local connection-mark=no-mark per-connection-classifier=both-addresses-and-ports:${weightedPlan.total}/${i} action=mark-connection new-connection-mark="wan${n}_conn" passthrough=yes comment="cloudguest-mangle-pcc-wan${n}-idx${i}" }`,
          );
        });
      } else {
        lines.push(
          `:if ([:len [/ip firewall mangle find where comment="cloudguest-mangle-pcc-wan${n}"]] = 0) do={ /ip firewall mangle add chain=prerouting in-interface="${lanBridge}" dst-address-type=!local connection-mark=no-mark per-connection-classifier=both-addresses-and-ports:${wanIfs.length}/${idx} action=mark-connection new-connection-mark="wan${n}_conn" passthrough=yes comment="cloudguest-mangle-pcc-wan${n}" }`,
        );
      }
      lines.push(
        `:if ([:len [/ip firewall mangle find where comment="cloudguest-mangle-route-wan${n}"]] = 0) do={ /ip firewall mangle add chain=prerouting connection-mark="wan${n}_conn" action=mark-routing new-routing-mark="to_wan${n}" passthrough=yes comment="cloudguest-mangle-route-wan${n}" }`,
      );
    });
    chunks.push({
      label: weightedPlan
        ? "Basic Mangle Rules (weighted multi-WAN load balancing)"
        : "Basic Mangle Rules (dual/multi-WAN load balancing)",
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
    // Single line, single-statement branches -- the console runs each
    // entered line as its own program, so an `:if`/`else={}` pair split
    // across four lines cannot be relied on to be one program.
    const lines = [
      `/ip service set api disabled=no`,
      `:if ([:len [/user find where name="${apiUser}"]] = 0) do={ /user add name="${apiUser}" password="${apiSecret}" group=full comment="cloudguest-api" } else={ /user set [find name="${apiUser}"] password="${apiSecret}" }`,
    ];
    chunks.push({ label: "API Access (unlocks Device Console)", script: lines.join("\n") });
  }

  if (wireguard) {
    const noPeerYet = `[:len [/interface wireguard peers find where interface="${WIREGUARD_INTERFACE_NAME}"]] = 0`;
    const peerArgs =
      `interface="${WIREGUARD_INTERFACE_NAME}" public-key="${wireguard.serverPublicKey}" ` +
      `endpoint-port=${wireguard.serverEndpointPort} allowed-address="${wireguard.tunnelSubnet}" ` +
      `persistent-keepalive=25s`;
    const lines = [
      // A router provisioned before the wg-cloudguest -> wg-cloudguard fix
      // still carries the old interface. Renaming the constant alone would
      // leave that one in place and quietly ADD a second tunnel beside it,
      // which is the exact two-interface state this fix exists to end -- so
      // the legacy name is counted and reported before anything is created.
      //
      // Deliberately REPORTED, NOT REMOVED. `/interface wireguard remove`
      // on the old tunnel would drop any management session riding it --
      // including, in the remote re-provision flow, the operator's own. An
      // operator who can see the count can remove it in one command; a
      // script that removes it can strand a router that is only reachable
      // through it. Non-zero here means "finish this by hand", and says so.
      [
        `:local wgLegacy [:len [/interface wireguard find where name="${WIREGUARD_LEGACY_INTERFACE_NAME}"]]`,
        `:if ($wgLegacy > 0) do={ :put ("  WARNING: " . [:tostr $wgLegacy] . " legacy tunnel interface(s) named ${WIREGUARD_LEGACY_INTERFACE_NAME} are still on this device.") }`,
        `:if ($wgLegacy > 0) do={ :put "  That name is obsolete. Leaving it in place gives this router TWO tunnels," }`,
        `:if ($wgLegacy > 0) do={ :put "  and the hub only ever talks to ${WIREGUARD_INTERFACE_NAME}. Once this chunk finishes and" }`,
        `:if ($wgLegacy > 0) do={ :put "  the new tunnel shows a handshake, remove the old one by hand:" }`,
        `:if ($wgLegacy > 0) do={ :put "    /interface wireguard remove [find where name=${WIREGUARD_LEGACY_INTERFACE_NAME}]" }`,
        `:if ($wgLegacy > 0) do={ :log warning "cloudguest: legacy ${WIREGUARD_LEGACY_INTERFACE_NAME} interface still present alongside ${WIREGUARD_INTERFACE_NAME}" }`,
        `:if ($wgLegacy = 0) do={ :put "  No legacy ${WIREGUARD_LEGACY_INTERFACE_NAME} interface on this device (expected)." }`,
      ].join("; "),
      `:if ([:len [/interface wireguard find where name="${WIREGUARD_INTERFACE_NAME}"]] = 0) do={ /interface wireguard add name="${WIREGUARD_INTERFACE_NAME}" private-key="${wireguard.routerPrivateKey}" listen-port=13231 }`,
      // NOT a bare `:if (noPeerYet) do={ ...peers add endpoint-address=<host> }`.
      // RouterOS resolves `endpoint-address` once, at creation, and never
      // again, so a peer built while venue DNS is down points at nothing
      // forever and nothing reports it. `buildWireguardPeerLines` does the
      // `:resolve` check first and -- with no backend-supplied raw address
      // to fall back to -- deliberately builds NO peer when it fails,
      // precisely so that the add-if-missing guard above stays satisfiable
      // and simply re-pasting this chunk after DNS is fixed repairs it. The
      // final state check below then counts peer=0 and prints FAIL, so the
      // "no peer" outcome is reported twice, never inferred. See that
      // function's own docstring.
      ...buildWireguardPeerLines(wireguard, noPeerYet, peerArgs),
      `:if ([:len [/ip address find where interface="${WIREGUARD_INTERFACE_NAME}"]] = 0) do={ /ip address add address="${wireguard.routerTunnelIp}/24" interface="${WIREGUARD_INTERFACE_NAME}" }`,
      // Never infer success from the absence of an error: all three lines
      // above are `:if ... do={ add }`, which do nothing at all -- silently,
      // and with a zero exit -- if the `find` was non-empty for a reason
      // other than the one intended. This prints what actually exists now.
      [
        `:local wgIf [:len [/interface wireguard find where name="${WIREGUARD_INTERFACE_NAME}"]]`,
        `:local wgPeer [:len [/interface wireguard peers find where interface="${WIREGUARD_INTERFACE_NAME}"]]`,
        `:local wgAddr [:len [/ip address find where interface="${WIREGUARD_INTERFACE_NAME}"]]`,
        `:put ("  Tunnel ${WIREGUARD_INTERFACE_NAME}: interface=" . [:tostr $wgIf] . " peer=" . [:tostr $wgPeer] . " address=" . [:tostr $wgAddr])`,
        `:if ($wgIf > 0 && $wgPeer > 0 && $wgAddr > 0) do={ :put "  RESULT: PASS -- tunnel is fully configured." }`,
        `:if (!($wgIf > 0 && $wgPeer > 0 && $wgAddr > 0)) do={ :put "  RESULT: FAIL -- a count above is 0, so this router has NO working tunnel." }`,
        `:if (!($wgIf > 0 && $wgPeer > 0 && $wgAddr > 0)) do={ :log warning "cloudguest: ${WIREGUARD_INTERFACE_NAME} incomplete after paste" }`,
      ].join("; "),
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
      // ONE `;`-joined line. `$wanDropRule` and `$wgAllowRule` are read by
      // statements that used to sit on later entered lines than their
      // `:local`s -- and the RouterOS console runs each entered line as its
      // own program, so those reads hit nothing. `place-before=$wanDropRule`
      // in particular was a syntax error, meaning the accept rule (when it
      // was added at all) landed at the END of the input chain, BELOW
      // `cloudguest-fw-drop-wan-input` -- which is precisely the
      // confirmed-live 2026-08-16 "gurugram" bug this `place-before` was
      // added to fix. The tunnel could never handshake.
      //
      // The three-way `:if`/`else={}` nest is flattened into three mutually
      // exclusive one-statement guards for the separate `do={}`-body rule.
      ...(enableFirewall
        ? [
            [
              `:local wanDropRule [/ip firewall filter find where comment="cloudguest-fw-drop-wan-input"]`,
              `:local wgAllowRule [/ip firewall filter find where comment="cloudguest-fw-allow-wg-mgmt"]`,
              `:if ([:len $wgAllowRule] = 0 && [:len $wanDropRule] > 0) do={ /ip firewall filter add chain=input in-interface="${WIREGUARD_INTERFACE_NAME}" action=accept comment="cloudguest-fw-allow-wg-mgmt" place-before=$wanDropRule }`,
              `:if ([:len $wgAllowRule] = 0 && [:len $wanDropRule] = 0) do={ /ip firewall filter add chain=input in-interface="${WIREGUARD_INTERFACE_NAME}" action=accept comment="cloudguest-fw-allow-wg-mgmt" }`,
              `:if ([:len $wgAllowRule] > 0 && [:len $wanDropRule] > 0) do={ /ip firewall filter move $wgAllowRule destination=$wanDropRule }`,
              // Repoint, unconditionally, an accept rule that already
              // exists. The two `add` guards above only fire when the rule
              // is ABSENT, so on every router provisioned before the
              // wg-cloudguest -> wg-cloudguard fix the rule survives
              // untouched -- still bound to the old, now-dead interface,
              // still passing every existence check, and still dropping the
              // hub's handshake. That is the "firewall rule bound to the
              // wrong tunnel" symptom exactly. A `set` costs nothing when
              // the rule is already correct and is the only thing that
              // heals the case where it is not.
              `:if ([:len $wgAllowRule] > 0) do={ /ip firewall filter set $wgAllowRule in-interface="${WIREGUARD_INTERFACE_NAME}" }`,
              `:local wgRuleNow [:len [/ip firewall filter find where comment="cloudguest-fw-allow-wg-mgmt" in-interface="${WIREGUARD_INTERFACE_NAME}"]]`,
              `:if ($wgRuleNow > 0) do={ :put ("  Management accept rule bound to ${WIREGUARD_INTERFACE_NAME}: " . [:tostr $wgRuleNow] . " rule(s).") }`,
              `:if ($wgRuleNow = 0) do={ :put "  FAIL: no input-chain accept rule is bound to ${WIREGUARD_INTERFACE_NAME}." }`,
              `:if ($wgRuleNow = 0) do={ :put "  The hub handshake will be dropped. Check /ip firewall filter print." }`,
              `:if ($wgRuleNow = 0) do={ :log warning "cloudguest: no wg mgmt accept rule bound to ${WIREGUARD_INTERFACE_NAME}" }`,
            ].join("; "),
          ]
        : []),
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
      // One line, one statement per branch -- the console runs each entered
      // line as its own program, so an `:if`/`else={}` split over five
      // lines cannot be assumed to be one program.
      // RouterOS's own default RADIUS timeout is 300ms, confirmed live to be too
      // aggressive for any real (let alone WireGuard-tunneled) WAN path.
      // The `else={}` half is not today's actual root cause (that was
      // server-side, on the FreeRADIUS hub VM) -- flagged separately by an
      // earlier pass over this file as a real, if unrelated, gap: an entry
      // that already exists here could still be sitting `disabled=yes`
      // (e.g. someone toggled it off in WinBox while debugging), and the
      // `:if` only ever handles "missing entirely", never "present but
      // off". Cheap, harmless, self-heals the same idiom as everywhere
      // else in this file -- re-enabling an already-enabled entry is a
      // no-op.
      `:if ([:len [/radius find where address="${radius.serverAddress}"]] = 0) do={ /radius add service=hotspot address="${radius.serverAddress}" secret="${escapeForRouterOsString(radius.sharedSecret)}" timeout=3s } else={ /radius set [find where address="${radius.serverAddress}"] disabled=no }`,
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
    // Looks the address up on `wanEffectiveIfs[0]`, not `wans[0].iface`
    // directly -- for a PPPoE WAN1 the address lands on the virtual
    // pppoe-client interface, never on the physical port underneath it (see
    // `wanEffectiveIfs`'s own docstring above), so the physical name would
    // silently find nothing and this heartbeat would report an empty
    // `public_ip_address` forever, the exact bug being fixed here for DHCP.
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
    // Confirmed live in production (2026-08-17, router "WYFY-GUEST"): a
    // field technician reported this chunk's `/tool fetch` dying with
    // RouterOS's own "failure: timeout connecting" -- a bare fetch failure
    // that raises no RouterOS error visible anywhere except the moment it
    // happens (a scheduler `on-event` failing produces no toast, no popup,
    // nothing waiting for anyone to look; the one-shot copy's failure
    // scrolls past in the terminal along with everything else pasted around
    // it). Both fetch calls below are now wrapped in `:do {} on-error={}`
    // so a failure leaves a real, timestamped trace in `/log print` --
    // `:log warning` -- that a technician (or this platform's own remote
    // support) can actually find later, instead of the router just quietly
    // never reporting in. Each `:do {}`/`on-error={}` body still holds
    // exactly one statement, same "no `;`-chain inside an inline do={}"
    // discipline as everywhere else in this chunk (see below).
    //
    // Separately reported alongside the fetch failure: this scheduler's own
    // `run-count=0` and `next-run` stuck weeks in the past, suggesting it
    // may never have fired at all. RouterOS's `/system scheduler add`
    // captures the CURRENT system clock as start-date/start-time when
    // neither is given explicitly -- on a device with no battery-backed RTC
    // that hasn't synced via NTP yet at the moment this chunk is first
    // pasted (a real possibility this early in provisioning, before the
    // "WAN Connectivity Check" chunk above has even confirmed the WAN path
    // NTP needs is up), that captured start-date/time can be wrong by
    // however far off the pre-sync clock was -- plausibly explaining a
    // next-run that reads as "weeks in the past" relative to the
    // now-corrected clock. This codebase has no prior example of a
    // scheduler self-heal to model this on (searched; none exists), and
    // there wasn't a way to reproduce the stuck state live to confirm this
    // is the exact mechanism rather than just a strong match for the
    // symptom -- flagging that honestly rather than claiming a confirmed
    // root cause. What's done here regardless: the old logic only ever
    // added this scheduler entry once (`:if ([:len [find]] = 0) do={ add
    // }`) and never touched it again on a re-paste, so a device that
    // somehow got a bad entry was stuck with it forever, permanently, with
    // no self-heal on any future visit. Now unconditionally removed and
    // re-added every time this chunk is pasted -- same "delete-then-
    // recreate, not the usual add-if-missing idempotency" call already made
    // for the "Basic Mangle Rules" chunk's ratio changes above, for the
    // same reason: existence alone doesn't mean the existing entry is
    // healthy. Re-pasting this chunk is exactly the recommended fix if
    // `/system scheduler print` is ever seen showing a stuck run-count=0/
    // past next-run again.
    // SPLIT INTO TWO CHUNKS, immediate first. Deriving the uplink instead
    // of naming a port made this body substantially longer, and both
    // copies of it used to sit in one paste -- roughly 5.5KB, by a wide
    // margin the largest single paste this generator produces, in a file
    // whose whole chunking discipline exists because WinBox's terminal was
    // confirmed live to mangle long pastes. Two pastes halve that.
    //
    // The order is deliberate: the immediate check-in runs FIRST, so the
    // technician sees the router flip to online (or sees the `:log
    // warning`) before laying down a scheduler that repeats the same call
    // every five minutes. The reported failure shape was precisely the
    // other way round -- a scheduler that got created while the immediate
    // heartbeat silently never fired -- and separate chunks make that
    // state impossible to mistake for success, because each paste reports
    // on its own.
    chunks.push({
      label: "Heartbeat (check in now, and report the live uplink's IP)",
      // Byte-identical to the scheduler's stored copy below before that
      // copy's extra `escapeForRouterOsString` pass -- same program, one
      // builder, no chance of the two drifting.
      script: buildHeartbeatStatements({ apiBase, agentCredential, wireguard }),
    });
    const lines = [
      // `:local` + its reader on ONE line. Split over two entered lines,
      // the second was a syntax error, so the stale scheduler was never
      // removed and the `add` below hit an already-existing name -- the
      // self-heal this chunk's comment above promises never happened.
      `:local existingHeartbeatSched [/system scheduler find name="cloudguest-heartbeat-sched"]; :if ([:len $existingHeartbeatSched] > 0) do={ /system scheduler remove $existingHeartbeatSched }`,
      // `start-time=startup` is the targeted fix for the reported
      // `run-count=0` / `next-run` weeks in the past. With neither
      // `start-date` nor `start-time` given, RouterOS captures the CURRENT
      // system clock at `add` time -- and on a device with no
      // battery-backed RTC that has not reached NTP yet (routine this
      // early in provisioning), that captured instant is whatever the
      // pre-sync clock said. Once NTP corrects the clock, the stored
      // absolute start sits in the past and `next-run` reads as stuck.
      // `start-time=startup` stores NO absolute instant at all: the
      // schedule is anchored to boot and repeats every `interval`, so
      // there is nothing for a wrong clock to poison.
      //
      // Fixed by CONSTRUCTION, not by observation. This is inferred from
      // MikroTik's documented `start-time` semantics plus the reported
      // symptom; the stuck state was never reproducible here, so the
      // mechanism is still not confirmed. It is safe to be wrong about:
      // the immediate check-in on the last line is what makes a router
      // appear online at provisioning time either way, and the unconditional
      // remove-and-re-add above means a future visit re-lays this entry.
      `/system scheduler add name="cloudguest-heartbeat-sched" interval=5m start-time=startup on-event="${escapeForRouterOsString(buildHeartbeatStatements({ apiBase, agentCredential, wireguard }))}"`,
    ];
    chunks.push({
      label: "Heartbeat Scheduler (re-checks the live uplink every 5 minutes)",
      script: lines.join("\n"),
    });
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
  const [conn, setConn] = useState<{
    host: string | null;
    username: string | null;
    password: string | null;
  } | null>(null);
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
            Login for connecting with an external tool (WinBox, RouterOS API), reachable only over
            the tunnel above. To run commands right here instead, use Master Console's Device
            Console.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => (revealed ? setRevealed(false) : reveal())}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : revealed ? (
            <EyeOff className="h-4 w-4" />
          ) : (
            <Eye className="h-4 w-4" />
          )}
          <span className="ml-2">{revealed ? "Hide" : "Reveal"}</span>
        </Button>
      </CardHeader>
      {revealed && conn && (
        <CardContent className="space-y-2">
          <KeyRow
            label="Connect to (WinBox / API)"
            value={conn.host ?? "Not available -- no reported management IP yet"}
          />
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
