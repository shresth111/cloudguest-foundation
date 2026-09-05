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
import type { DiagnosticRun } from "@/types/network-diagnostics";
// Shared with the customer dashboard's Connection Tools page -- the two
// had already drifted on RTT precision and on how a silent hop is drawn.
import {
  didDiagnosticExecute,
  summarizeDiagnosticResult,
  tracerouteHopsOf,
} from "@/lib/diagnostics-presentation";
import { PEER_STATUS_LABEL } from "@/types/router";
import { deriveLanAddressing } from "@/lib/lan-addressing";
import { RouterStatusBadge, HealthStatusBadge } from "./RouterStatusBadge";
import {
  useAllocateWireGuardPeer,
  useGenerateProvisioningToken,
  useRevokeWireGuardPeer,
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
import type { WireGuardTunnelAllocation } from "@/types/router";

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
            // `advanced`, not `open`. `open` lands on the fleet list with the
            // browse drawer selected -- one more click from a button whose
            // label promises the script panel, and the operator who followed
            // it is the one who most needs to arrive there. `advanced` is the
            // param that renders `RouterSetupScriptAdvanced` directly, and it
            // is now the fleet's only provisioning entry point.
            onClick: () => navigate({ to: "/master/routers", search: { advanced: router.id } }),
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

function DiagnosticRunRow({ run }: { run: DiagnosticRun }) {
  const [expanded, setExpanded] = useState(false);
  const hops = run.diagnosticType === "traceroute" ? tracerouteHopsOf(run) : [];
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
          <Badge variant={didDiagnosticExecute(run) ? "default" : "outline"}>{run.status}</Badge>
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
  /** NULL when the platform reused this router's existing peer rather
   * than allocating a new one. An agent-allocated peer's private key was
   * generated on the hub and never held by this platform (it is stored as
   * `EXTERNALLY_MANAGED_KEY_SENTINEL`), so there is nothing to write --
   * and nothing that needs writing, because the device already has the
   * matching key. The chunk omits its `private-key=` lines entirely in
   * that case rather than writing a placeholder over a working interface,
   * which would break the very tunnel it is meant to repair.
   *
   * See the backend's `allocate_external_wireguard_peer`: reuse is now the
   * default because `ops/hub-agents/wg_agent.py` has no delete or update
   * verb, so every allocation is permanent and unreclaimable. */
  routerPrivateKey: string | null;
  serverPublicKey: string;
  /** THE PUBLIC KEY THE PLATFORM HAS REGISTERED FOR THIS ROUTER -- the
   * device's own identity as the hub understands it, not the hub's key
   * (that is `serverPublicKey`).
   *
   * Needs nothing new from the backend: `public_key` is already on
   * `WireGuardPeerResponse`, the base of the `WireGuardTunnelCreateResponse`
   * that `allocate-external` returns, and it is populated on both the
   * allocate path and the reuse path. The frontend simply never declared it.
   *
   * Exists so `buildTunnelIdentityCheckChunk` can compare what the DEVICE
   * holds against what the PLATFORM believes, at paste time, before anything
   * is changed. `register_external_radius_nas` binds this router's FreeRADIUS
   * `client{}` stanza to the tunnel IP that accompanies this key, so a device
   * carrying a different one is an unknown client whose every Access-Request
   * is dropped with no reply. Until this existed there was nothing on the
   * router that could say so. */
  peerPublicKey: string;
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
/** The on-disk identity stamp written into every hotspot page this script
 * overrides, and into `/system note`.
 *
 * THE FAILURE THIS EXISTS FOR, confirmed live 2026-08-27 at "huda city
 * center". The device was serving `login.html` carrying
 * `organizationId=af85f1eb...`, `locationId=7510a5ed...`,
 * `routerId=01c9171e...` -- all three hard-deleted from the platform hours
 * earlier, when the router was re-enrolled under a different tenant. The
 * portal was asked to resolve a location that no longer existed, fell back to
 * an organization that also no longer existed, and returned 404 on EVERY
 * guest load while the phone's rfc8908 probes came through fine. The guest
 * saw a spinner, then nothing.
 *
 * The proximate cause was mundane -- the newer `.rsc` never imported (it hit
 * the filename-with-spaces bug), so the previous run's files simply stayed.
 * The DEFECT is that nothing anywhere noticed: hotspot bound, profile
 * correct, RADIUS present, tunnel up, clock right, every check passing, and
 * no check at all comparing what is ON DISK against what the platform now
 * believes. A device re-provisioned into a different tenant is not
 * hypothetical here; it is what happened.
 *
 * A marker makes that check a string comparison against known-good rather
 * than URL parsing -- the same `CGBOOT`-style identification the backend's
 * bootstrap renderer already uses for the tunnel's rows. It is an HTML
 * comment, so it is invisible to guests, and it contains only UUIDs and an
 * ISO timestamp -- no `"`, `\`, or `$` -- so it survives
 * `escapeForRouterOsString` untouched and is safe as a `:find` needle.
 *
 * `g=` IS PRINTED, NEVER COMPARED. It changes on every Generate by design;
 * comparing it would make every check fail. The three ids are what get
 * compared, and they are compared INDIVIDUALLY rather than as one URL: the
 * whole-URL form would break fleet-wide on any future change to
 * `buildPortalUrl`'s parameter list or order, and it could not say WHICH id
 * was wrong -- a bad `routerId` means these pages came from another device,
 * while a bad `organizationId`/`locationId` means this device was re-enrolled
 * under another tenant. Those need different answers. */
function portalMarker(p: PortalOverrideConfig, generatedAt: string): string {
  return `cloudguest-portal r=${p.routerId} o=${p.organizationId} l=${p.locationId} g=${generatedAt}`;
}

function buildPortalRedirectHtml(
  url: string,
  page: { title: string; body: string },
  marker: string,
): string {
  return [
    "<!DOCTYPE html>",
    // See `portalMarker`: this is the only durable record on the device of
    // WHICH TENANT this page was generated for, and the only thing a check
    // can read back. First line after the doctype so a human opening the file
    // sees it immediately.
    `<!-- ${marker} -->`,
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
  generatedAt: string,
): { label: string; line: string }[] {
  const url = buildPortalUrl(portalUrl);
  const marker = portalMarker(portalUrl, generatedAt);
  return PORTAL_OVERRIDE_FILES.map((page) => {
    const pattern = portalFileMatchPattern(page.file);
    const contents = escapeForRouterOsString(buildPortalRedirectHtml(url, page, marker));
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

/** Both walled-garden mechanisms, written together, with a verdict that can
 * actually fail.
 *
 * MikroTik hotspot has TWO separate, independent walled gardens and they are
 * NOT interchangeable. `/ip hotspot walled-garden` (host-based) matches the
 * Host header at the HTTP-proxy layer -- a layer that does not exist for TLS
 * -- so it can only ever bypass authentication for PLAIN HTTP.
 * `/ip hotspot walled-garden ip` (address-based, firewall/NAT layer) acts
 * before the port-443 hotspot redirect fires and is the ONLY mechanism that
 * can bypass authentication for HTTPS. `GUEST_PORTAL_PUBLIC_BASE` is always
 * HTTPS, so the host-based entry ALONE IS NOT A PARTIAL FIX -- it is no fix.
 *
 * CONFIRMED TWICE, on real hardware:
 *  - 2026-08-18, fleet-wide (router "WYFY-GUEST"): firewall hit-counters
 *    showed 1,965 HTTPS hits against 30 HTTP hits on the hotspot's own
 *    redirect rules -- ~98% of real guest traffic. With only the host-based
 *    entry, nearly every guest's first attempt to reach the portal was caught
 *    by the hotspot's own unauthenticated-HTTPS redirect and wrapped in the
 *    router's untrusted self-signed certificate. Fixed live by hand with
 *    `/ip hotspot walled-garden ip add action=accept dst-address=<ip>`.
 *  - 2026-08-27, "huda city center": `/ip hotspot walled-garden` held
 *    `auth.wyfyguest.com` at HITS: 0 -- it had never matched anything, because
 *    the hostname it keys on is inside TLS -- while
 *    `/ip hotspot walled-garden ip` was empty and Safari reported "couldn't
 *    establish a secure connection".
 *
 * WHY ONE CHUNK AND NOT TWO. This replaces `buildWalledGardenLine` +
 * `buildWalledGardenIpLines`, which emitted two adjacent chunks with
 * near-identical labels and -- the part that actually mattered -- printed
 * NOTHING AT ALL between them. (An earlier version of this comment called
 * them "the only two chunks in the entire script" that did so. That was
 * wrong, and worth correcting rather than quietly deleting: a sweep of every
 * emitted chunk found EIGHT silent ones, including Firewall and the
 * Heartbeat. Two of those are fixed alongside this note; the rest are listed
 * in the review that found them.) No PASS,
 * no FAIL, no count. On a failed `:resolve` the address-based half degraded
 * to a `:log warning` nobody reads and a clean prompt that read as success.
 * Two silent chunks are also two chances to paste one and not the other. They
 * are one feature, so they are now one chunk with one verdict -- and the
 * verdict keys on the ADDRESS-BASED entry specifically, because a check that
 * counted entries would have printed PASS on huda while no guest on that
 * network could load the portal at all.
 *
 * THE `:resolve` STAYS ON THE DEVICE, deliberately. A generate-time literal
 * would go stale the instant the backend's DNS record changed, with no signal
 * to an already-provisioned router -- and this repo has already paid that
 * bill: `20.219.72.235` was exactly such a literal, it was baked into
 * `endpoint-address=` on 64 field routers, and when the hub's subscription
 * died those routers became unreachable and needed physical visits (the
 * backend even carries a regression test asserting that literal never
 * reappears in its source). A backend-supplied address is the same mistake
 * one layer up. The price of resolving on the device is that this only
 * re-resolves when a human re-pastes, which means THE PORTAL MUST KEEP
 * RESOLVING TO ONE STABLE ADDRESS. A rotating A-record set, a load balancer
 * with changing IPs, or a CDN in front would wall in whichever address this
 * router happened to get and block the rest -- a portal that works for some
 * guests and not others, intermittently, which is materially worse to debug
 * than a clean failure. That constraint is real, it is currently invisible
 * anywhere but this comment, and it needs to be known by whoever next
 * changes that DNS record.
 *
 * `[:typeof $portalIp] = "ip"`, NOT `[:len $portalIp] > 0`. `:local portalIp
 * ""` creates a STRING; `:set portalIp [:resolve ...]` rebinds it to
 * RouterOS's own `ip` type. `:len` over a non-string is not a character count
 * and is not reliably defined -- if it throws, the entered line aborts AFTER
 * the `:do {} on-error={}` has already caught nothing, so neither the add nor
 * the set ever runs, silently, on every device in the fleet. That is a live
 * suspect for huda's empty ip table (`:put [:typeof [:resolve "..."]]` on the
 * bench settles it), and `:typeof` is the correct guard either way, which is
 * why this does not wait for the answer.
 *
 * SHAPE. Two entered lines: writes, then verdict. `$portalIp`/`$pgOk` are
 * bound and read within the first, because the RouterOS console runs each
 * ENTERED LINE as its own program; the verdict re-reads both tables from the
 * device rather than carrying variables across that boundary. Every `do={}`
 * body holds exactly one statement -- a `;`-chained inline body threw a real
 * syntax error on this hardware. Returns `null` when `frontendBase` is not a
 * parseable URL (nothing sensible to wall in). */
function buildWalledGardenLines(portalUrl: PortalOverrideConfig): string[] | null {
  const portalHost = (() => {
    try {
      return new URL(portalUrl.frontendBase).hostname;
    } catch {
      return "";
    }
  })();
  if (!portalHost) return null;
  const h = escapeForRouterOsString(portalHost);
  const isIpLiteral = /^\d{1,3}(\.\d{1,3}){3}$/.test(portalHost);
  // A literal IS an address: nothing to resolve, so no `:resolve` and no
  // `on-error` guard (a literal assignment cannot fail the way a live DNS
  // lookup can). A bare dotted quad binds as RouterOS's own `ip` type, so
  // the `[:typeof $portalIp] = "ip"` gate below is satisfied identically on
  // both paths -- one gate, not two.
  const resolved = isIpLiteral
    ? `:local portalIp ${portalHost}`
    : `:local portalIp ""; :do { :set portalIp [:resolve "${h}"] } on-error={ :set portalIp "" }`;
  return [
    [
      resolved,
      `:local pgOk ([:typeof $portalIp] = "ip")`,
      // -- HOST-BASED (plain HTTP + the OS captive-portal probe). Add-or-set,
      //    so a changed portal hostname converges instead of leaving a stale
      //    entry sitting beside a new one, both matching, neither correct.
      `:if ([:len [/ip hotspot walled-garden find where comment="cloudguest-portal"]] = 0) do={ /ip hotspot walled-garden add dst-host="${h}" action=allow comment="cloudguest-portal" }`,
      `:if ([:len [/ip hotspot walled-garden find where comment="cloudguest-portal"]] > 0) do={ /ip hotspot walled-garden set [find where comment="cloudguest-portal"] dst-host="${h}" action=allow disabled=no }`,
      // -- ADDRESS-BASED (the only one that can pass HTTPS).
      `:if ($pgOk && [:len [/ip hotspot walled-garden ip find where comment="cloudguest-portal-https"]] = 0) do={ /ip hotspot walled-garden ip add action=accept dst-address=$portalIp comment="cloudguest-portal-https" }`,
      `:if ($pgOk && [:len [/ip hotspot walled-garden ip find where comment="cloudguest-portal-https"]] > 0) do={ /ip hotspot walled-garden ip set [find where comment="cloudguest-portal-https"] action=accept dst-address=$portalIp disabled=no }`,
    ].join("; "),
    // -- VERDICT, on its own entered line: it re-reads both tables from the
    //    device rather than trusting the variables above, which is the whole
    //    point -- every `add`/`set` here is guarded, and a guarded command
    //    that does not fire is indistinguishable from one that succeeded.
    [
      `:local pgHost [:len [/ip hotspot walled-garden find where comment="cloudguest-portal" disabled=no]]`,
      `:local pgIp [:len [/ip hotspot walled-garden ip find where comment="cloudguest-portal-https" disabled=no]]`,
      `:put ("  host-based entry (HTTP only)=" . [:tostr $pgHost] . "   address-based entry (HTTPS)=" . [:tostr $pgIp])`,
      `:if ($pgIp > 0 && $pgHost > 0) do={ :put "  RESULT: PASS -- guests can reach the portal over both HTTP and HTTPS." }`,
      `:if ($pgIp > 0 && $pgHost = 0) do={ :put "  RESULT: PARTIAL -- HTTPS passes; the plain-HTTP/probe entry is missing." }`,
      `:if ($pgIp = 0) do={ :put "  RESULT: FAIL -- NO address-based walled-garden entry exists on this router." }`,
      `:if ($pgIp = 0) do={ :put "  The portal is HTTPS-only. The host-based entry matches the Host header," }`,
      `:if ($pgIp = 0) do={ :put "  which is inside TLS and the hotspot never sees it, so that entry will sit" }`,
      `:if ($pgIp = 0) do={ :put "  at HITS: 0 forever. Every guest gets this router's own self-signed" }`,
      `:if ($pgIp = 0) do={ :put "  certificate instead of the portal: SECURE CONNECTION FAILED." }`,
      `:if ($pgIp = 0) do={ :put "  Most likely cause: ${h} did not resolve on THIS router." }`,
      `:if ($pgIp = 0) do={ :put "  Check /ip dns on this router, confirm the name resolves here, and re-paste." }`,
      `:if ($pgIp = 0) do={ :log warning "cloudguest: no address-based walled-garden entry -- the HTTPS portal is unreachable for every guest" }`,
      // HARD STOP, same discipline as the Clock/NTP and WAN checks. A router
      // with a hotspot and no HTTPS walled garden is the worst outcome
      // available: it intercepts, it serves login.html, and then every guest
      // hits a certificate error. It looks provisioned and it serves no one.
      `:if ($pgIp = 0) do={ :error "cloudguest-portal: STOPPING -- no HTTPS walled-garden entry, so the portal is unreachable for every guest. Fix DNS on this router and re-paste this chunk." }`,
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

/** The ONE value this generator ever writes to `hsprof1`'s `login-by`, and
 * the reason there is exactly one writer of it in the whole file.
 *
 * **THE DEFECT THIS REPLACES.** Two separate chunks used to set `login-by`
 * on the same profile. The "Hotspot" chunk set `login-by=http-pap`; a
 * later "Self-Signed HTTPS Certificate" chunk set
 * `login-by=https,http-pap` alongside `ssl-certificate=` pointing at a
 * certificate the ROUTER had generated and signed for itself. Both `set`s
 * succeeded, in paste order, and the last one won -- so every router this
 * generator provisioned ended up serving its hotspot login page over TLS
 * with a certificate no client on earth trusts, for a hostname
 * (`HOTSPOT_DNS_NAME`) that deliberately resolves only on that router.
 * Confirmed live, guest-facing: a real Android phone on a freshly
 * provisioned hEX showed a certificate/security warning the moment the
 * captive portal opened. Nothing in the generator reported the conflict,
 * because there is nothing to report -- two `set`s of the same property is
 * legal RouterOS and silent by construction.
 *
 * **WHAT UNTRUSTED TLS ACTUALLY BREAKS -- THREE SYMPTOMS, ONE CAUSE.**
 * With `https` in `login-by`, RouterOS stops redirecting unauthenticated
 * guests to `http://<dns-name>/login` and redirects them to
 * `https://<dns-name>/login` instead, presenting a certificate no guest
 * device has ever heard of. That single fact produces all of:
 *
 *  - **No sign-in popup on Windows or macOS at all.** Every OS decides
 *    "am I online?" by fetching one plain-HTTP URL and inspecting the
 *    answer (Windows NCSI wants `connecttest.txt` to say exactly
 *    `Microsoft Connect Test`; Apple's CNA wants `hotspot-detect.html` to
 *    say `Success`; Android wants `generate_204` to answer 204/empty).
 *    The popup is what each does when it gets something ELSE -- normally
 *    the hotspot's own 302 to the login page. A TLS handshake failure is
 *    not an HTTP-level answer at all, so the probe dies in transport and
 *    the OS lands in its plain "no internet" branch: a globe icon and
 *    nothing to click. Reported live 2026-08-23 from a provisioned hEX,
 *    Windows and macOS both on a LAN cable.
 *  - **A visible certificate error on Android**, which is the same
 *    failure rendered in a browser surface rather than swallowed. This is
 *    the symptom that got noticed; it is not the worst of the three.
 *  - **"OTP verifies but no internet", after a successful sign-in.**
 *    `$(link-login-only)` -- the URL the real portal POSTs the guest's
 *    credentials to, threaded through `buildPortalUrl` -- inherits its
 *    scheme from this very property. `src/routes/portal.success.tsx`
 *    states in its own docstring that this URL "is always a plain-HTTP
 *    address on the venue's own LAN", and does a top-level form POST to
 *    it. Turn `https` on and that assumption is false: the POST lands on
 *    an endpoint whose certificate the browser rejects, the NAS gate
 *    never opens, and the guest sits on a verified OTP with no internet.
 *
 * **A CORRECTION, RECORDED BECAUSE THE WRONG VERSION IS PERSUASIVE.** An
 * earlier draft of this comment argued that plain HTTP here is free
 * because "nothing secret ever crosses the hotspot's own page" -- the
 * page being a spinner and a `location.replace(...)` to the real portal,
 * with no `<form>` and no `<input>` in it (`PORTAL_OVERRIDE_FILES`, via
 * `buildPortalRedirectHtml`). The first half is true and worth keeping:
 * the guest TYPES nothing on the router's page; the phone number and the
 * OTP are entered on the real portal, a public origin with a real
 * certificate, over real HTTPS. But the conclusion drawn from it was
 * wrong. Credentials DO cross the router's own origin afterwards, via the
 * `$(link-login-only)` POST above. The honest argument is not "nothing
 * sensitive touches this origin" -- it is that this leg is a LAN-local
 * POST to the guest's own gateway carrying a hotspot username and a fixed
 * placeholder password (`HOTSPOT_FALLBACK_PASSWORD`), which is not the
 * credential that authenticated anybody; the OTP was verified against the
 * backend over HTTPS long before this POST exists. Untrusted TLS here
 * does not protect that leg, it destroys it.
 *
 * `http-pap` itself is not a security choice either way -- it is the only
 * `login-by` method RouterOS has that a plain external-portal form POST
 * can satisfy; see the Hotspot chunk's own comment for the confirmed-live
 * incident behind it. This constant does not change that. It changes only
 * that `https` is not bolted on beside it.
 *
 * **WHAT THIS IS NOT.** It is not a claim that hotspot HTTPS is wrong in
 * principle. There IS a real, publicly-trusted Let's Encrypt certificate
 * for `wifi.wyfyguest.com` -- issued centrally by DNS-01 (which needs no
 * public A record for the name, only a TXT record in the zone, which is
 * why the name being router-local is not an obstacle to issuing for it)
 * and pushed to fleet routers by `cloud-guest-repo/backend/ops/
 * letsencrypt-hotspot/renew-hotspot-certs.sh`. That script sets
 * `ssl-certificate=<the real leaf> login-by=https,http-pap` itself, in one
 * atomic remote command, on the routers listed in its own `ROUTERS`
 * inventory. That is the correct way for this fleet to have HTTPS on the
 * hotspot, and this generator deliberately does not compete with it: the
 * generator never writes `ssl-certificate` at all, so a re-paste can no
 * longer rebind a router that has the real certificate onto a self-signed
 * one (which is what the deleted chunk did, unconditionally, on every
 * re-paste). A re-paste does still return `login-by` to `http-pap` on such
 * a router; that is a visible downgrade to a working, warning-free HTTP
 * redirect page, not a breakage, and the renewal script's next rebind
 * restores it.
 *
 * **THE SINGLE-WRITER RULE IS THE FIX, not the value.** Had this property
 * been written from one place, the second writer could not have existed.
 * `scripts/test-setup-script-generator.mjs` section 13 now asserts exactly
 * that over every emitted chunk of every variant: one `set` per
 * hotspot-profile property, per generated script. Changing the value here
 * is a one-line edit; adding a second writer anywhere fails the build. */
const HOTSPOT_LOGIN_BY = "http-pap";

/** The label of the ONE chunk allowed to bring `hsprof1` into existence,
 * and the name the RADIUS chunk tells the operator to go and paste.
 *
 * **THE SECOND HALF OF THE SINGLE-WRITER RULE, learned the hard way a
 * second time.** `HOTSPOT_LOGIN_BY` above stopped two chunks from `set`ting
 * `login-by`. It did not stop a second chunk from CREATING the profile --
 * and creation is a write of `login-by` too, just an invisible one.
 * RouterOS gives a profile born without an explicit `login-by` its own
 * default, `cookie,http-chap`, and the Hotspot chunk's comment on its
 * `login-by=` line already records what that costs, confirmed live in
 * Haldwani: CHAP needs a challenge/response the guest-facing login page
 * never fetches, so the NAS rejects every login no matter how correct the
 * credentials are.
 *
 * The RADIUS chunk used to carry its own `/ip hotspot profile add
 * name="hsprof1" ...` as a self-heal for "the Hotspot chunk has not been
 * pasted yet". Its `add` was copied from the Hotspot chunk's, which is
 * correct THERE because a `set login-by=$hsLoginBy` follows it three lines
 * later; copied into a chunk with no such `set`, it created a profile in
 * exactly the state the rest of this file documents as broken. In the one
 * scenario that self-heal existed for, it produced a router that looks
 * provisioned -- `/radius` written, `use-radius=yes` applied, the chunk's
 * own verdict printing `RESULT: PASS` -- and rejects every guest login.
 *
 * The obvious repair (append `login-by=` to that `add`) is the one thing
 * `HOTSPOT_LOGIN_BY`'s docstring forbids: a second place in this file that
 * decides this property, which is the shape that shipped untrusted TLS to
 * every guest. So the self-heal is gone instead. `hsprof1` is created in
 * exactly one place, by the chunk named here, a few lines above the ONE
 * `set` that decides `login-by` -- so there is no code path anywhere that
 * can bring this profile into being without that decision being made about
 * it in the same breath.
 *
 * Refusing is only acceptable because the refusal is ACTIONABLE: the RADIUS
 * chunk names this label on the console, on screen, at the top of its own
 * output. That is why the label is a constant rather than a string typed
 * twice -- an instruction that names a chunk the operator cannot find in
 * their chunk list is the same dead end as no instruction at all. */
const HOTSPOT_CHUNK_LABEL = "Hotspot";

/** The stable RouterOS certificate name that `/opt/wyfy/renew-hotspot-certs.sh`
 * binds on a router after pushing the fleet's real Let's Encrypt certificate
 * (SANs: `wifi.wyfyguest.com`, `portal.wyfyguest.com`, `*.portal.wyfyguest.com`).
 *
 * THIS GENERATOR NEVER CREATES IT, and that has not changed -- a
 * router-signed certificate in front of a guest is exactly what was deleted
 * from this file. This name exists here for one purpose: to RECOGNISE the
 * real one when the renewal script has already put it there, so a re-paste
 * stops undoing it.
 *
 * Why that mattered enough to add: `HOTSPOT_LOGIN_BY`'s own docstring
 * accepted the downgrade -- "the renewal script's next rebind restores it"
 * -- but that rebind only happens when a certificate actually RENEWS, which
 * is a ~60-90 day window. Until then the guest sees Chrome's "the
 * information you're about to submit is not secure" on the router's own
 * login form. Reported live 2026-08-23, after a paste that was otherwise
 * completely successful. */
const HOTSPOT_FLEET_CERT_NAME = "wyfy-hotspot-fleet";

/** A RouterOS regex (used with `~`) matching the hostnames every major OS
 * fetches to answer "am I really online?" -- Windows NCSI, Apple's Captive
 * Network Assistant, Android's connectivity check, Firefox's, and the two
 * Linux desktop ones.
 *
 * **THIS IS A DENYLIST, NOT AN ALLOWLIST, AND THE DIRECTION IS THE WHOLE
 * POINT.** The intuitive reading of "the sign-in popup does not appear" is
 * that the probe is being blocked and should be let through the walled
 * garden. That is backwards, and it is the one change that would remove
 * the popup permanently rather than fix it. Each of these probes exists so
 * the OS can decide whether it has real internet. Let it through and the
 * OS gets the genuine success answer it was looking for, concludes the
 * network is fine, and never offers a sign-in -- while the guest is still
 * unauthenticated and still has no internet. The popup IS the OS reacting
 * to the probe being intercepted and answered with a redirect, so the
 * hotspot must keep intercepting every one of these.
 *
 * So this pattern is only ever used to SEARCH for such an entry and report
 * it as a fault. Nothing in this generator may ever `add` or `set` one of
 * these names into `/ip hotspot walled-garden` or `/ip dns static`;
 * `test-setup-script-generator.mjs` section 14 sweeps every emitted
 * statement for exactly that and fails the build if one appears.
 *
 * Deliberately carries no backslash escapes. RouterOS's own string parser
 * and its regex engine both get a say in this literal, and `.` matching any
 * character instead of a literal dot costs nothing here -- a false positive
 * would need a real walled-garden host spelled `captiveXapple`. Anything
 * that needs escaping in a `~` pattern is left out instead.
 *
 * **Known limit, stated rather than papered over:** this can only see the
 * HOST-based table and static DNS. `/ip hotspot walled-garden ip` holds
 * addresses, not names, so a resolved probe IP added there is invisible to
 * this check. There is no reliable way to recognise one, and guessing would
 * mean shipping a list of third-party IPs that goes stale silently. */
const CAPTIVE_DETECTION_HOST_PATTERN =
  "(msftconnecttest|msftncsi|connectivitycheck|detectportal|captive.apple|gstatic|clients3.google|nmcheck|network-test.debian|connectivity-check.ubuntu)";

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
 * `dig auth.wyfyguest.com` resolves publicly, and the backend serves a
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
export const GUEST_PORTAL_PUBLIC_BASE = "https://auth.wyfyguest.com";

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

/** The `comment=` this generator stamps on the `/radius` entry it owns.
 *
 * Marker-based identification, not shape-based: `find where address=...`
 * cannot distinguish an entry this script created from one that merely sits
 * at the same address, which makes it impossible to adopt safely, impossible
 * to converge `address=` when the hub moves, and impossible to tell an
 * operator's own RADIUS server from ours when deciding what may be touched.
 * Same discipline as the backend's `_BOOTSTRAP_MGMT_TAG` ("CGBOOT") on the
 * tunnel's own rows, and as `cloudguest-portal*` on the walled garden. */
const RADIUS_MARKER = "cloudguest-radius";

/** The UDP port this router is told to LISTEN on for RADIUS
 * Change-of-Authorization and Disconnect-Request packets (RFC 5176).
 *
 * NOT RouterOS's own default of 1700: 3799 is the IANA-assigned port, and
 * it is the port the platform actually sends to. The same number is a
 * named constant on both of the other two writers of this setting --
 * `RADIUS_COA_PORT` in the backend's `network_config/renderers.py` and the
 * literal in `wyfy_device_gateway.mikrotik_adapter.set_radius_client_config`
 * -- so a router configured by any of the three routes ends up listening
 * on the same port the platform talks to. Finding 3799 on a device is
 * evidence this platform wrote it. */
const RADIUS_COA_PORT = 3799;

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
const WAN_DHCP_GW_POLL_DELAY_S = 5;
const WAN_DHCP_GW_POLL_DELAY = `${WAN_DHCP_GW_POLL_DELAY_S}s`;

/** How long the whole "WAN Routing" chunk may spend WAITING, across every
 * WAN in it. Each WAN with an asynchronous source (DHCP, PPPoE) takes a
 * share; a single-WAN router gets the lot and is unaffected by this
 * existing. It is a chunk-wide budget rather than a per-WAN one because
 * the cost a technician pays is the chunk's total: `/import` never pauses
 * and nothing is printed while a `:delay` runs, so a four-WAN paste with
 * a full ladder each is over a minute of dead terminal, which gets read as
 * a hang and power-cycled mid-provision. Kept under the suite's own 60s
 * per-chunk ceiling with room to spare. */
const WAN_GW_POLL_BUDGET_S = 45;

/** RouterOS 7's name for a route's routing table, and the filter that
 * selects the MAIN one.
 *
 * MEASURED, NOT ASSUMED. On the founder's hEX lite (RouterOS 7.23.3
 * stable, `factory-software: 6.44.6` -- so it shipped on v6 and was
 * upgraded):
 *
 *     :put [:len [/ip route find where routing-table="main"]]  ->  1
 *     :put [:len [/ip route find where routing-mark=""]]       ->  0
 *
 * The v6 spelling this generator used everywhere does NOT error on v7. It
 * is taken as an unknown filter and silently matches an empty set, so
 * every default-route lookup in the generated script returned nothing on
 * every router in the fleet, and nothing anywhere reported it. That is the
 * exact failure class this generator exists to eliminate.
 *
 * ONE PATH, v7, DELIBERATELY -- and it says so out loud on anything else.
 * A v6/v7 fork would double every route statement in lines that are
 * already at the paste-size budget, and there is exactly one device
 * available to test against, which is on v7: a fork would ship one tested
 * path and one imagined one. So the generator emits v7 vocabulary only,
 * and `buildRouterOsVersionCheckStatements` below reads the version off
 * the device and prints an unmissable banner naming what will not work if
 * the major version is anything other than 7 -- including the case where
 * the version cannot be read at all. The UNKNOWN case is loud, which is
 * the property that matters; silently guessing a branch is what this whole
 * change is about not doing.
 *
 * `new-routing-mark=` on `/ip firewall mangle` is a DIFFERENT property and
 * keeps its name on v7 -- only `/ip route`'s own property was renamed. The
 * mangle chunk is deliberately untouched. */
const ROUTE_MAIN_TABLE_FILTER = `routing-table="main"`;

/** Comments that tag the two objects this generator binds to the interface
 * it DISCOVERED, as opposed to the one the operator typed into the form.
 * Everything Wyfy manages on a router is comment-tagged, and these two are
 * the tags for "we found the real uplink and pointed our own rule at it".
 * They are also the only handle used to find those objects again on a
 * re-run: a user's own masquerade or interface-list member carries neither
 * tag and is therefore never read, re-pointed or removed. */
const DISCOVERED_WAN_LIST_COMMENT = "cloudguest-wanlist-live";
const DISCOVERED_NAT_COMMENT = "cloudguest-nat-live";
/** The property name used when CREATING a route in a non-main table. Same
 * v7 rename as `ROUTE_MAIN_TABLE_FILTER`; see its docstring. On v7 the
 * table must also exist first -- see `routingTablePreambleLines`. */
const ROUTE_TABLE_PROPERTY = `routing-table`;

/** v7 will not accept a route into a routing table that has not been
 * declared, so every `to_wan<N>` table this generator routes into is
 * created first. Idempotent by explicit count, and the count is branched
 * on zero: `/routing table add` on an existing name errors, and a `find`
 * against a menu a RouterOS version does not have returns empty in
 * silence, so "we made it" is never inferred -- it is counted and stated.
 *
 * The tables are NOT removed anywhere, including by the failover-only
 * cleanup that removes this generator's marked routes. An empty routing
 * table costs nothing, and a name a previous operator might also be using
 * is not this script's to delete. */
function routingTablePreambleLines(tableNames: string[]): string[] {
  return tableNames.flatMap((name) => [
    `:if ([:len [/routing table find where name="${name}"]] = 0) do={ :do { /routing table add name="${name}" fib } on-error={ :log warning "cloudguest: could not create routing table ${name} -- on RouterOS 7 a route cannot enter a table that does not exist, so this WAN's load-balancing routes will not be created. Check /routing table print" } }`,
    `:if ([:len [/routing table find where name="${name}"]] = 0) do={ :put "*** WARNING: routing table ${name} does not exist after trying to create it. Load balancing will not work. See /log print. ***" }`,
  ]);
}

/** Reads the RouterOS major version off the device and says, unmissably,
 * what will not work if it is not 7.
 *
 * This is not a fork. The generator emits v7 vocabulary only (see
 * `ROUTE_MAIN_TABLE_FILTER`), and this exists so that a router which is
 * NOT v7 -- or whose version cannot be read at all -- produces a banner a
 * technician cannot page past, instead of a script that appears to work
 * while every route lookup in it matches nothing. Both the wrong-version
 * and the unknown-version cases take the loud branch; only a confirmed
 * "7" is quiet.
 *
 * Every `:local` is bound and read on the one line the caller joins, and
 * `[:find]` returning nothing would make `:pick` error, so the major
 * version parse is wrapped rather than trusted. */
function buildRouterOsVersionCheckStatements(): string[] {
  return [
    `:local rosVer ""`,
    `:do { :set rosVer [:tostr [/system resource get version]] } on-error={ :set rosVer "" }`,
    `:local rosMajor ""`,
    `:do { :set rosMajor [:pick $rosVer 0 [:find $rosVer "."]] } on-error={ :set rosMajor "" }`,
    `:if ($rosMajor = "7") do={ :log info ("cloudguest: RouterOS " . $rosVer . " -- using routing-table= route syntax") }`,
    `:if ($rosMajor != "7") do={ :put ("*** WARNING: this script uses RouterOS 7 route syntax (routing-table=). This device reports version \\"" . $rosVer . "\\". ***") }`,
    `:if ($rosMajor != "7") do={ :put "*** On RouterOS 6 the property is routing-mark=, and a find using the wrong one MATCHES NOTHING WITHOUT ERRORING. ***" }`,
    `:if ($rosMajor != "7") do={ :put "*** Do not trust this chunk's output on this device. Check /ip route print by hand and report the version. ***" }`,
    `:if ($rosMajor != "7") do={ :log warning ("cloudguest: RouterOS major version is \\"" . $rosMajor . "\\", not 7 -- this script's route lookups may match nothing silently on this device") }`,
  ];
}

/** How long a PPPoE WAN is given to finish negotiating before its gateway
 * is declared unresolved. Same shape and the same reason as
 * `WAN_DHCP_GW_POLL_ATTEMPTS` above -- PPPoE dial-up is asynchronous in
 * exactly the way a DHCP lease is, and reading `remote-address` off a
 * session that is still in `dialing`/`authenticating` returns nothing
 * usable. Before this existed the PPPoE branch made exactly ONE attempt
 * and then told the technician to "re-paste this chunk once connected",
 * which on a chunk-by-chunk paste is the difference between a WAN that
 * configures itself and one that needs a second visit. */
const WAN_PPPOE_GW_POLL_ATTEMPTS = 6;
const WAN_PPPOE_GW_POLL_DELAY_S = 5;
const WAN_PPPOE_GW_POLL_DELAY = `${WAN_PPPOE_GW_POLL_DELAY_S}s`;

/** The one bounded retry primitive this generator has. Emits
 * `attempts - 1` wait/retry pairs after an initial attempt the caller has
 * already pushed, so the total is `attempts` tries `delay` apart.
 *
 * WHY IT IS UNROLLED AND WHY IT IS SHARED
 * ---------------------------------------
 * Unrolled because a `:for` loop cannot express "attempt, and only wait if
 * that did not work" while keeping every `do={}` body to exactly one
 * statement, which is a hard rule in this file after a `;`-chained pair
 * inside an inline `do={}` threw a real syntax error on a live router (see
 * the Heartbeat chunk's own comment).
 *
 * Shared because the same ladder was previously written out by hand in
 * three separate places (the DHCP gateway poll, the NTP sync poll, and
 * -- missing entirely -- the PPPoE gateway poll). Three copies of a retry
 * block is three places for the bound to drift, and the third one being
 * absent is how a PPPoE WAN ended up with a single attempt and a "come
 * back later" log line. Every retry in this generator now goes through
 * here, so the shape is one thing, bounded by construction, and every
 * `do={}` body it emits holds exactly one statement.
 *
 * `unresolved` is re-evaluated on the device before every wait and before
 * every retry -- it is a guard, not a loop counter, so the ladder costs
 * nothing but a few string comparisons once the value has been read. */
function buildBoundedRetryLadder(opts: {
  /** The RouterOS statement that tries once. Re-emitted verbatim. */
  attempt: string;
  /** RouterOS boolean expression: true while the value is still not usable. */
  unresolved: string;
  /** Total attempts INCLUDING the caller's own first one. */
  attempts: number;
  /** RouterOS time literal, e.g. `"5s"`. */
  delay: string;
  /** Extra precondition ANDed onto the retry (not the wait) -- for a
   * source that may not exist to be read at all, e.g. a pppoe-client
   * interface the addressing chunk has not created yet. Folded into the
   * SAME `:if` rather than nested inside the retry's own body: one
   * statement per `do={}` body is the rule, and a nested `:if` inside an
   * `:if` body is a deeper shape than anything this file has proven on
   * this hardware. */
  attemptPrecondition?: string;
}): string[] {
  const { attempt, unresolved, attempts, delay, attemptPrecondition } = opts;
  const retryWhen = attemptPrecondition
    ? `(${unresolved}) && ${attemptPrecondition}`
    : `${unresolved}`;
  const stmts: string[] = [];
  for (let retry = 1; retry < attempts; retry++) {
    stmts.push(`:if (${unresolved}) do={ :delay ${delay} }`);
    stmts.push(`:if (${retryWhen}) do={ ${attempt} }`);
  }
  return stmts;
}

/** Work out, live on the device, which interface is actually carrying this
 * router's internet traffic -- and, optionally, what its next hop is.
 * Emitted as a list of statements the caller `;`-joins onto ONE entered
 * line, because the RouterOS console runs each entered line as its own
 * program and a `:local` declared on one line does not exist on the next.
 *
 * THIS IS THE ONLY PLACE THAT ANSWERS "WHICH WAN IS UP".
 * -----------------------------------------------------
 * It used to exist once, inside `buildHeartbeatStatements`. The WAN
 * configuration chunks answered the same question a completely different
 * way -- by trusting the port typed into "WAN N interface" and reading
 * `/ip dhcp-client` on it -- so a router could have its heartbeat
 * correctly reporting the live uplink while the routing chunk that built
 * that uplink's routes had assumed a different interface entirely. One
 * builder, one set of qualifiers, one definition of "the uplink".
 *
 * WHAT IT DOES, IN ORDER
 * ----------------------
 *  1. Count the ACTIVE default routes in the MAIN table
 *     (`$<p>DefCount`). Both qualifiers are load-bearing and neither is
 *     stylistic:
 *      - `active=yes`: RouterOS keeps an unreachable default route in the
 *        table and flags it Inactive rather than removing it, so an
 *        unqualified count says "1 route, looks healthy" about a router
 *        whose every ping says `no route to host`.
 *      - `routing-table="main"`: THIS GENERATOR ITSELF adds a
 *        `routing-table="to_wan<N>"` default route per WAN plus a
 *        `distance=2` crossover backup per WAN in load-balance mode. Those
 *        live in their own routing tables and are active there
 *        simultaneously, so an unqualified find returns a handful of
 *        routes across several tables and "the first one" is whichever
 *        table happened to sort first. The router's own traffic is routed
 *        by the main table; the main table's own active default route is
 *        the only correct answer.
 *
 *        `routing-table=`, NOT `routing-mark=`. This is RouterOS 7
 *        vocabulary and the difference is not cosmetic. Measured on the
 *        founder's hEX lite, RouterOS 7.23.3, factory-software 6.44.6:
 *
 *          :put [:len [/ip route find where routing-table="main"]]  -> 1
 *          :put [:len [/ip route find where routing-mark=""]]       -> 0
 *
 *        The v6 spelling does not error on v7. It is accepted as an
 *        unknown filter and SILENTLY MATCHES AN EMPTY SET -- which is this
 *        project's entire recurring failure shape, sitting inside the one
 *        function whose job is to eliminate it. Every `find` that used it
 *        returned nothing on every v7 router in the fleet, and nothing
 *        anywhere said so. `/ip route print` on the same device confirms
 *        the vocabulary: the column header reads `ROUTING-TABLE`, value
 *        `main`.
 *
 *        WHICH IS WHY THE COUNT IS NOT OPTIONAL. Renaming the token fixes
 *        today's instance; it does nothing about the next rename. So this
 *        builder always binds `$<p>DefCount` from the SAME filter the
 *        sweep uses and always emits a zero branch that says out loud that
 *        the filter matched nothing and names a stale filter name as one
 *        of the two possible reasons. A future RouterOS that renames
 *        something else fails visibly instead of quietly answering "no
 *        uplink" on a healthy router.
 *  2. Sweep distances 1..255 ASCENDING and take the first active main-table
 *     default route found -- the lowest-distance one, which is the route
 *     RouterOS itself prefers. An explicit ascending sweep rather than
 *     "whatever the find returns first", so the choice cannot silently
 *     depend on route order.
 *  3. Resolve that route to a real outgoing interface, three guarded paths
 *     in order, because RouterOS exposes this differently by version and
 *     by link type:
 *      a. `immediate-gw`, documented in RouterOS 7 as `address%interface`
 *         -- split on the `%`. (Inferred from MikroTik's v7 documentation
 *         of that property; NOT verified on this fleet's hardware.)
 *      b. the route's plain `gateway`, when that already NAMES an
 *         interface -- which is what a point-to-point link like PPPoE
 *         produces.
 *      c. an `/ip arp` lookup of the gateway address, which is how a
 *         device that exposes no `immediate-gw` still answers the
 *         question: the router is by definition ARPing its own live next
 *         hop.
 *  4. VERIFY THE RESULT IS A REAL INTERFACE. Anything that survives all
 *     three paths must still match `/interface find where name=...` or it
 *     is discarded back to `""`. Every inference above therefore degrades
 *     to "not resolved" -- a state the caller reports as a distinct fault
 *     -- rather than to a plausible-looking wrong interface name.
 *  5. Optionally (`withGateway`) resolve `$<p>Gw`, the next hop of the same
 *     lowest-distance active main-table default route.
 *
 * THE GATEWAY IS A SECOND SWEEP, NOT A SECOND STATEMENT
 * -----------------------------------------------------
 * Capturing the route id in step 2 and reading both properties off it
 * afterwards would need two statements inside the innermost `do={}`, which
 * this hardware has rejected. Guarding the sweep on `[:typeof $id] = "str"`
 * instead would work only if a RouterOS internal id reports a type other
 * than `str`, and if that inference were wrong the sweep would silently
 * select the HIGHEST-distance route instead of the lowest -- a quiet wrong
 * answer, which is the one outcome this file will not ship. So the gateway
 * is read by a second sweep using the byte-identical qualified find in the
 * byte-identical ascending order, which selects the same route unless the
 * routing table changes between the two statements. If it does change, both
 * halves still come from an active main-table default route, and the
 * caller's interface-match guard is what rejects a mismatched pair -- the
 * failure is "no route added, and a log line saying so", never a route
 * built out of two different uplinks.
 *
 * VARIABLE NAMING. Every local is prefixed, so several copies of this can
 * coexist on one entered line (the "WAN Routing" chunk emits one per WAN)
 * without colliding. */
function buildUplinkDiscoveryStatements(
  prefix: string,
  opts?: { withGateway?: boolean },
): string[] {
  const p = prefix;
  // Both qualifiers, on every default-route lookup this function emits.
  // Written once, interpolated everywhere, so a future edit cannot drop
  // them from one lookup and leave them on another -- the exact hole a
  // mutation pass found in this suite's own guards twice already.
  const qualified = `/ip route find where dst-address="0.0.0.0/0" active=yes ${ROUTE_MAIN_TABLE_FILTER}`;
  const ifExists = `[:len [/interface find where name=$${p}If]] > 0`;
  const stmts = [
    `:local ${p}If ""`,
    // COUNTED FROM THE SAME FILTER THE SWEEP USES. A `find` whose filter
    // name RouterOS no longer recognises returns an empty set without
    // erroring -- confirmed on v7 with the v6 `routing-mark=` spelling --
    // so "0 routes" and "this script is speaking the wrong dialect" are
    // indistinguishable from the value alone. THE ZERO BRANCH IS PART OF
    // THIS BUILDER'S CONTRACT, not an optional extra: every caller must
    // branch on `$<p>DefCount = 0` and say so out loud, naming a stale
    // filter name as one of the two possible causes. Section 12 of
    // `scripts/test-setup-script-generator.mjs` fails the build if any
    // call site binds the count without branching on zero.
    `:local ${p}DefCount [:len [${qualified}]]`,
    // THE ZERO BRANCH IS EMITTED HERE, not left to the caller. A caller
    // that binds the count and forgets to read it is exactly how a silent
    // empty match ships, and one of them (the WAN-list/NAT line) did
    // forget, which this suite caught. Terse on purpose -- it is paid for
    // on every line that discovers an uplink, including the heartbeat's,
    // which is also stored escaped inside the scheduler. Callers add their
    // own, longer, situation-specific fault A on top.
    `:if ($${p}DefCount = 0) do={ :log warning "cloudguest: 0 active main-table default routes -- no uplink, or a filter name this RouterOS build rejects" }`,
    `:for ${p}Dist from=1 to=255 do={ :if ($${p}If = "") do={ :foreach ${p}R in=[${qualified} distance=$${p}Dist] do={ :if ($${p}If = "") do={ :do { :set ${p}If [:tostr [/ip route get $${p}R immediate-gw]] } on-error={ :do { :set ${p}If [:tostr [/ip route get $${p}R gateway]] } on-error={ :set ${p}If "" } } } } } }`,
    // SELF-CALIBRATING SENTINEL, not a literal `"nil"`.
    //
    // `:find` returns the position, or a not-found value whose `:typeof`
    // this codebase has spelled TWO DIFFERENT WAYS -- `"nil"` here and
    // `"nothing"` in the portal identity check -- which cannot both be
    // right. If the real answer is `"nothing"`, this comparison was ALWAYS
    // TRUE, so the strip below always ran, and `[:pick $if (<not-found> + 1)
    // ...]` errors -- aborting this whole `;`-joined line, which is the
    // entire heartbeat. The router would then never check in and would show
    // OFFLINE on the dashboard forever while serving guests perfectly: the
    // exact silent state this generator keeps producing by other means.
    //
    // Deriving the sentinel from a find that is guaranteed to miss makes
    // this correct under either answer without waiting on a bench test, and
    // costs one statement on a line that already has thirty.
    // Computed INLINE rather than bound to a `:local`: this line is
    // interpolated into several chunks and one of them (WAN Routing on PPPoE)
    // was already within 20 characters of the 3300-char paste cap, which the
    // suite enforces rather than raising. Inline is also simply shorter than
    // the statement it replaces.
    `:if ([:typeof [:find $${p}If "%"]] != [:typeof [:find "a" "zz"]]) do={ :set ${p}If [:pick $${p}If ([:find $${p}If "%"] + 1) [:len $${p}If]] }`,
    `:if ($${p}If != "" && !(${ifExists})) do={ :do { :set ${p}If [:tostr [/ip arp get [find where address=$${p}If] interface]] } on-error={ :set ${p}If "" } }`,
    `:if ($${p}If != "" && !(${ifExists})) do={ :set ${p}If "" }`,
  ];
  if (opts?.withGateway) {
    stmts.push(
      `:local ${p}Gw ""`,
      `:for ${p}GwDist from=1 to=255 do={ :if ($${p}Gw = "") do={ :foreach ${p}GwR in=[${qualified} distance=$${p}GwDist] do={ :if ($${p}Gw = "") do={ :do { :set ${p}Gw [:tostr [/ip route get $${p}GwR gateway]] } on-error={ :set ${p}Gw "" } } } } }`,
    );
  }
  return stmts;
}

/** RouterOS boolean: `$<p>Gw` holds something that can actually be used as
 * a gateway. `"0.0.0.0" != ""` is TRUE, and a zero gateway is exactly what
 * `/ip route add` accepts and then silently flags Inactive -- this file has
 * been burned by that once already, so the zero case is rejected by name
 * rather than by an emptiness test. */
function gatewayUsableExpr(varName: string): string {
  return `$${varName} != "" && $${varName} != "0.0.0.0"`;
}

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
 * own comment already made for its double address lookup.
 *
 * `role` EXISTS BECAUSE THE CONSEQUENCE IS NOT THE SAME ON BOTH SIDES.
 * The "LAN Interfaces (explicit allowlist)" chunk calls this too, and it
 * used to get the WAN copy verbatim: a technician who mistyped a LAN port
 * was told "configured WAN interface ether7 does not exist" and that "the
 * WAN Routing chunk resolves the live uplink from the routing table
 * instead". Both halves are false for a LAN port. Nothing recovers a
 * missing LAN port -- there is no routing table to discover it from; it
 * simply never joins the guest bridge, and if it was the only one named,
 * no guest gets an address at all. The operator was sent to look at their
 * WAN, which was fine, for a fault on the other side of the router. */
type InterfaceRole = "WAN" | "LAN";

const INTERFACE_ROLE_COPY: Record<
  InterfaceRole,
  { consequence: string; nextStep: string; logTail: string }
> = {
  WAN: {
    consequence:
      "Nothing is being renamed and nothing is aborting -- the WAN Routing chunk resolves the live uplink from the routing table instead.",
    nextStep:
      "*** If this router is online, that is fine. If it is not, check /interface print and re-generate with the real name. ***",
    logTail:
      "does not exist on this device -- continuing, and resolving the real uplink from the active default route instead",
  },
  LAN: {
    consequence:
      "It will NOT be added to the guest bridge, and nothing later recovers it -- unlike a WAN, there is no routing table to discover a LAN port from.",
    nextStep:
      "*** If this was the only LAN port named, no guest gets an address at all. Check /interface print and re-generate with the real name. ***",
    logTail:
      "does not exist on this device -- it will not join the guest bridge and no chunk below can recover it",
  },
};

function wanExistenceCheckLines(ifNameExprs: string[], role: InterfaceRole = "WAN"): string[] {
  const copy = INTERFACE_ROLE_COPY[role];
  const lines: string[] = [];
  ifNameExprs.forEach((expr) => {
    const missing = `[:len [/interface find where name=${expr}]] = 0`;
    lines.push(
      `:if (${missing}) do={ :put ("*** NOTE: no interface on this device is named \\"" . ${expr} . "\\". ${copy.consequence} ***") }`,
      `:if (${missing}) do={ :put "${copy.nextStep}" }`,
      `:if (${missing}) do={ :log warning ("cloudguest: configured ${role} interface " . ${expr} . " ${copy.logTail}") }`,
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
  // `do={}` body. The SAME primitive as the DHCP and PPPoE gateway polls
  // in the "WAN Routing" chunk, not a third hand-written copy of the same
  // shape; see `buildBoundedRetryLadder`'s own docstring.
  verdictStatements.push(
    ...buildBoundedRetryLadder({
      attempt: readStatus,
      unresolved: notSynced,
      attempts: CLOCK_NTP_POLL_ATTEMPTS,
      delay: CLOCK_NTP_POLL_DELAY,
    }),
  );
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
    // The `:error` is appended INSIDE this `;`-joined line, not placed on
    // one of its own: `$clkVerdict` is bound by the statements above it and
    // the RouterOS console runs each ENTERED LINE as its own program, so a
    // separate line would read an unbound variable -- the generator's own
    // validator catches exactly this, and did.
    [
      ...verdictStatements,
      // HARD STOP, not just a printed verdict.
      //
      // This chunk's own FAIL text explains that a wrong clock fails TLS,
      // which fails `/tool fetch`, which means the heartbeat never arrives
      // and the router shows OFFLINE forever while guests are served fine.
      // Every downstream chunk that talks to the platform (Heartbeat,
      // Heartbeat Scheduler, and the portal-page fetches) depends on this
      // being true, so continuing past a FAIL only produces that exact
      // silent state.
      //
      // The two delivery channels behave differently, and BOTH are correct:
      //   - pasting chunk by chunk: `:error` ends THIS chunk loudly, in red.
      //     The operator fixes DNS/UDP 123 and re-pastes this one chunk.
      //     Later chunks are separate pastes and are unaffected, so nothing
      //     is lost.
      //   - `/import` of the .rsc, or the one-line paste: `:error` aborts the
      //     WHOLE run at this point, which is the entire reason it is here --
      //     a half-configured router that is honestly incomplete beats a
      //     fully-configured one that is permanently invisible.
      `:if ($clkVerdict != "PASS") do={ :error "cloudguest-clock: STOPPING -- the clock is not NTP-synchronised. IF YOU RAN THIS AS AN /import FILE, THE FILE ENDS HERE: RADIUS, the WireGuard tunnel, the API user and the heartbeat below this point did NOT run, however finished the router looks. Fix time sync (this router needs outbound UDP/123), then import the SAME file again -- every chunk is idempotent. (Pasting chunk by chunk? Fix it and re-paste just this chunk.)" }`,
    ].join("; "),
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
    const rawCmt = `cloudguest-wg-hub: RAW ADDRESS ${host} -- the platform issued no hostname for the hub. If the hub moves, this peer must be rebuilt by hand.`;
    return [
      `:if (${noPeerYet}) do={ /interface wireguard peers add ${peerArgs} endpoint-address="${host}" comment="${rawCmt}" }`,
      // Same update branch as the hostname path below -- an address-only
      // endpoint still carries a rotating public key, so an existing peer
      // must be converged onto the platform's current one rather than left
      // holding a key the hub no longer accepts.
      `:if (!(${noPeerYet})) do={ /interface wireguard peers set [find where interface="${escapeForRouterOsString(WIREGUARD_INTERFACE_NAME)}"] ${peerArgs} endpoint-address="${host}" comment="${rawCmt}" }`,
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
      `:if ($wgDnsOk = false) do={ :put "  FIX THIS VENUE'S DNS, then RE-PASTE this chunk. As of 2026-08-27" }`,
      `:if ($wgDnsOk = false) do={ :put "  this chunk UPDATES an existing peer as well as adding a missing" }`,
      `:if ($wgDnsOk = false) do={ :put "  one, so re-pasting is enough -- nothing needs deleting by hand." }`,
      `:if ($wgDnsOk = false) do={ :log warning ("cloudguest-wg: " . $wgHost . " did not resolve -- peer built against the raw address " . $wgEp . "; fix DNS, delete the peer and re-paste the WireGuard chunk") }`,
    );
  } else {
    stmts.push(
      `:if ($wgDnsOk = false) do={ :put "*** WIREGUARD: DNS FAILED -- NO TUNNEL WAS BUILT ***" }`,
      `:if ($wgDnsOk = false) do={ :put ("  " . $wgHost . " did not resolve on this router.") }`,
      `:if ($wgDnsOk = false) do={ :put "  RouterOS resolves a peer's endpoint-address ONCE, when the peer" }`,
      `:if ($wgDnsOk = false) do={ :put "  is created. Creating one now would leave it pointing at nothing" }`,
      `:if ($wgDnsOk = false) do={ :put "  forever. NO PEER WAS CREATED, on purpose: a peer built now" }`,
      `:if ($wgDnsOk = false) do={ :put "  would be pinned to an unresolvable name, and re-pasting" }`,
      `:if ($wgDnsOk = false) do={ :put "  updates a peer rather than rebuilding it from scratch." }`,
      `:if ($wgDnsOk = false) do={ :put "  Master console has no raw hub address to fall back to." }`,
      `:if ($wgDnsOk = false) do={ :put "  Fix this venue's DNS (check /ip dns and the upstream resolver)," }`,
      `:if ($wgDnsOk = false) do={ :put "  then re-paste THIS chunk. Nothing needs undoing first." }`,
      `:if ($wgDnsOk = false) do={ :log warning ("cloudguest-wg: " . $wgHost . " did not resolve -- NO peer created (one built now could never be repaired by re-pasting); fix DNS and re-paste the WireGuard chunk") }`,
    );
  }
  stmts.push(
    `:if ($wgDnsOk = true) do={ :log info ("cloudguest-wg: " . $wgHost . " resolved on this device -- peer endpoint set by hostname") }`,
    `:if ($wgGo = true && ${noPeerYet}) do={ /interface wireguard peers add ${peerArgs} endpoint-address=$wgEp comment=$wgCmt }`,
    // THE UPDATE BRANCH -- the half that did not exist until 2026-08-27.
    //
    // Until now this chunk only ever ADDED a peer. Every Generate rotates
    // the keypair and allocates a new tunnel IP server-side, so a router
    // that had been provisioned once and then re-generated ended up with
    // the platform holding one identity and the device holding another,
    // and re-pasting was a silent no-op: `noPeerYet` was false, so nothing
    // ran and nothing said so. `SECRET_REPAIR.wireguard.repairableByRepaste`
    // was `false` for exactly this reason, and the documented recovery was
    // "delete the interface and peer on the device by hand" -- i.e. a site
    // visit for a router whose only management path is the tunnel being
    // repaired. Confirmed live on router 01c9171e: hub holding three peers
    // (10.20.0.2/.3/.4), handshake only on .3, platform tracking .4.
    //
    // `set` on the whole `[find where interface=...]` set, not on one
    // peer: the correct steady state is exactly one hub peer on this
    // interface, and a device that has somehow accumulated several must
    // converge all of them rather than leave a stale one alongside.
    `:if ($wgGo = true && !(${noPeerYet})) do={ /interface wireguard peers set [find where interface="${escapeForRouterOsString(WIREGUARD_INTERFACE_NAME)}"] ${peerArgs} endpoint-address=$wgEp comment=$wgCmt }`,
    `:if ($wgGo = true && !(${noPeerYet})) do={ :log info "cloudguest-wg: existing hub peer updated in place to the platform's current key/endpoint" }`,
  );
  return [stmts.join("; ")];
}

/** Compares the tunnel identity the DEVICE holds against the identity the
 * PLATFORM has registered -- at paste time, before anything is changed.
 *
 * THE FAILURE THIS EXISTS FOR, confirmed live 2026-08-27 at "huda city
 * center". The device was healthy on 10.20.0.6 with public key `7hu3t0FJ...`,
 * handshaking, 2476 bytes received. The platform tracked 10.20.0.8 with a
 * completely different key, `status=pending`, never handshaked,
 * `rotation_count=6`. `register_external_radius_nas` binds the router's
 * FreeRADIUS `client{}` stanza to the tunnel IP THE PLATFORM holds, so every
 * Access-Request arrived from an address the hub had no client for and was
 * dropped as an unknown client: no reply, nothing logged, a perfectly correct
 * shared secret, a live tunnel, and every guest login failing. Every other
 * check on that router passed. NOTHING ANYWHERE SAID THE TWO ENDS DISAGREED.
 *
 * WHY IT CAN BE CHECKED AT ALL. The device knows its own public key and
 * tunnel address; this script is generated with what the platform expects
 * (`peerPublicKey` / `routerTunnelIp`); so the comparison is a string
 * compare on the router. It needs no hub call and no backend change.
 *
 * THE TWO OUTCOMES ARE GENUINELY DIFFERENT, and only one is repairable:
 *  - This script CARRIES a private key (a fresh allocation, or an explicit
 *    rotation): the WireGuard chunk below re-keys the device onto the
 *    platform's identity, so a mismatch is a warning and the run continues.
 *  - This script carries NO private key (the platform reused an existing
 *    peer -- see `routerPrivateKey`): there is no way to move this device
 *    onto the platform's identity, because that key was generated on the hub
 *    and never retained by anyone. Continuing would rebuild every downstream
 *    object around an identity the hub will not accept, and would point
 *    `/radius src-address=` at an address this router does not hold. So it
 *    `:error`s, and names rotation as the only exit. That abort is the thing
 *    that would have stopped huda's second `.rsc` before it touched the
 *    device, and it is what makes the RADIUS chunk's `src-address=` safe to
 *    write at all.
 *
 * SHAPE, all forced by RouterOS rather than chosen. `get` THROWS on an empty
 * `[find]`, so every read is wrapped in `:do {} on-error={}` and takes
 * `[:pick ... 0]` (a `find where` returns an array) -- the same idiom the
 * backend's own remote-bootstrap block uses. Every `$id*` is bound and read
 * on ONE entered line, because the console runs each entered line as its own
 * program. Every `do={}` body holds exactly one statement. `[:len $idHaveKey]`
 * is a legitimate character count here because `public-key` is a string --
 * unlike `[:len]` over `:resolve`'s `ip`-typed value, which is the unsound
 * form deliberately avoided in `buildWalledGardenLines`.
 *
 * The legacy `wg-cloudguest` interface is READ AND REPORTED, never removed:
 * it can be the only path an operator is connected over, and this chunk runs
 * on devices reached exactly that way. */
function buildTunnelIdentityCheckChunk(wireguard: WireguardPeerInfo): RouterSetupScriptChunk {
  const iface = WIREGUARD_INTERFACE_NAME;
  const legacy = WIREGUARD_LEGACY_INTERFACE_NAME;
  // A comparison against a key the platform did not send is not a check, it
  // is a guaranteed FAIL -- and one that would abort every paste on the
  // no-private-key path. `public_key` is a required field on the backend
  // response, so an empty one means something upstream is wrong; this reports
  // that and compares only the tunnel address, rather than inventing a verdict
  // it has no grounds for.
  const wantKey = escapeForRouterOsString(wireguard.peerPublicKey ?? "");
  const haveWantKey = Boolean(wireguard.peerPublicKey);
  const wantAddr = `${wireguard.routerTunnelIp}/24`;
  const canRekey = Boolean(wireguard.routerPrivateKey);
  return {
    label: "Tunnel Identity Check (confirm PASS or NEW before continuing)",
    script: [
      `:put "===================================================="`,
      `:put "  TUNNEL IDENTITY CHECK"`,
      [
        `:local idWantKey "${wantKey}"`,
        `:local idWantAddr "${wantAddr}"`,
        `:local idHaveKey ""`,
        `:local idHaveAddr ""`,
        `:local idLegacyKey ""`,
        `:do { :set idHaveKey [/interface wireguard get [:pick [/interface wireguard find where name="${iface}"] 0] public-key] } on-error={ :set idHaveKey "" }`,
        `:do { :set idHaveAddr [:tostr [/ip address get [:pick [/ip address find where interface="${iface}"] 0] address]] } on-error={ :set idHaveAddr "" }`,
        `:do { :set idLegacyKey [/interface wireguard get [:pick [/interface wireguard find where name="${legacy}"] 0] public-key] } on-error={ :set idLegacyKey "" }`,
        `:local idOk (${haveWantKey ? "$idHaveKey = $idWantKey && " : ""}$idHaveAddr = $idWantAddr)`,
        ...(haveWantKey
          ? []
          : [
              `:put "  NOTE: the platform sent no public key for this router, so only the"`,
              `:put "  tunnel address is compared below. Report this -- it is a platform fault."`,
            ]),
        `:put ("  platform expects: key " . $idWantKey . "  at " . $idWantAddr)`,
        `:put ("  this device has:  key " . $idHaveKey . "  at " . $idHaveAddr)`,
        `:if ([:len $idLegacyKey] > 0) do={ :put ("  legacy ${legacy} is ALSO present here, key " . $idLegacyKey) }`,
        `:if ([:len $idHaveKey] = 0) do={ :put "  RESULT: NEW -- no ${iface} tunnel here yet. The WireGuard chunk will build one." }`,
        `:if ([:len $idHaveKey] > 0 && $idOk) do={ :put "  RESULT: PASS -- this device holds the identity the platform has registered." }`,
        `:if ([:len $idHaveKey] > 0 && !$idOk) do={ :put "  RESULT: FAIL -- IDENTITY MISMATCH." }`,
        `:if ([:len $idHaveKey] > 0 && !$idOk) do={ :put "  The hub keys this router's FreeRADIUS client entry to the address the" }`,
        `:if ([:len $idHaveKey] > 0 && !$idOk) do={ :put "  PLATFORM holds. Packets from the address above are dropped as an unknown" }`,
        `:if ([:len $idHaveKey] > 0 && !$idOk) do={ :put "  client: no reply, nothing logged, shared secret irrelevant. Guests cannot log in." }`,
        `:if ([:len $idHaveKey] > 0 && !$idOk) do={ :log warning ("cloudguest-wg: identity mismatch -- device " . $idHaveKey . " at " . $idHaveAddr . "; platform " . $idWantKey . " at " . $idWantAddr) }`,
        ...(canRekey
          ? [
              `:if ([:len $idHaveKey] > 0 && !$idOk) do={ :put "  This script CARRIES a private key, so the WireGuard chunk below re-keys this device onto the platform identity. Carry on." }`,
            ]
          : [
              `:if ([:len $idHaveKey] > 0 && !$idOk) do={ :error "cloudguest-wg: STOPPING -- identity mismatch, and this script carries no private key because the platform reused an existing peer. That key was generated on the hub and never retained, so this device cannot be moved onto it. Press Generate again with Rotate the WireGuard tunnel ticked, and use the NEW script." }`,
            ]),
      ].join("; "),
      `:put "===================================================="`,
    ].join("\n"),
  };
}

/** Reads the deployed `login.html` back off the device and compares its
 * embedded ids to the ones this script was generated with.
 *
 * See `portalMarker` for the confirmed-live failure this exists for (huda
 * city center, 2026-08-27: a router serving a deleted tenant's portal link,
 * 404 on every guest load, every other check passing).
 *
 * WHAT THIS IS AND IS NOT. The file-write chunks are already
 * unconditional-converge with their own PASS/FAIL -- they overwrite whatever
 * is on disk on every paste and print the match count. There is no
 * add-if-missing defect there. The failure was that THE SCRIPT NEVER RAN, so
 * a paste-time check does not by itself make this impossible; it makes it
 * loud where it was silent, and it gives a technician standing at a suspect
 * router one thing to paste. The half that makes it genuinely impossible is
 * the platform noticing on its own -- see the `/system note` stamp in the
 * Portal Redirect Page chunks and the backend note beside it.
 *
 * GRANULARITY: three ids, compared individually, not the whole URL. See
 * `portalMarker`'s own docstring.
 *
 * `[:typeof [:find ...]] != $piNoFind`, NOT `[:len [:find ...]] > 0`, and
 * NOT a hard-coded spelling of the not-found sentinel either. This file
 * contained both `"nil"` and `"nothing"` for that same value, in the uplink
 * helper and here, so one of the two was always wrong; the sentinel is now
 * derived on the device from a find that must miss.
 *
 * FOR THE RECORD, since deriving it means we no longer have to care:
 * the value was measured on a real hEX, RouterOS 7.23.3 --
 *     :put [:typeof [:find "abc" "z"]]
 *     nil
 * So the uplink helper's `"nil"` was right and this file's `"nothing"`
 * was wrong, which had made all three id comparisons permanently true.
 * The derivation below is kept anyway: it is correct under any future
 * spelling, and this file has now been wrong about RouterOS semantics
 * twice by guessing.
 * `:find` returns the position, or `nothing` when the needle is absent, and
 * `:len` over `nothing` is not a valid test of that -- the same class of
 * unsound guard as `[:len]` over `:resolve`'s `ip` value in
 * `buildWalledGardenLines`. `[:len $piC]` a few lines down IS legitimate,
 * because `/file get ... contents` really is a string.
 *
 * THE TYPENAME IS `"nil"`, MEASURED, NOT GUESSED. This shipped as
 * `"nothing"` and was wrong, which made all three comparisons below
 * PERMANENTLY TRUE -- the check printed PASS on every device, including the
 * one whose pages carried a deleted tenant's ids, which is the exact failure
 * it was written to catch. Confirmed on RouterOS 7.23.3, hEX:
 *     :put [:typeof [:find "abc" "z"]]
 *     nil
 * The uplink helper above already used `"nil"` correctly, so the file
 * disagreed with itself; one spelling now, and this is it.
 *
 * `/file get [find] contents` on a ~700-byte page (what
 * `buildPortalRedirectHtml` produces) is well inside RouterOS's limits;
 * `get` throws on an empty `[find]`, hence `:pick ... 0` and the `:do {}
 * on-error={}` wrapper. */
function buildPortalIdentityCheckChunk(
  portalUrl: PortalOverrideConfig,
  generatedAt: string,
): RouterSetupScriptChunk {
  const pat = portalFileMatchPattern("login.html");
  const mk = escapeForRouterOsString(portalMarker(portalUrl, generatedAt));
  const r = portalUrl.routerId;
  const o = portalUrl.organizationId;
  const l = portalUrl.locationId;
  return {
    label: "Portal Identity Check (confirm PASS before handing the venue over)",
    script: [
      `:put "===================================================="`,
      `:put "  PORTAL IDENTITY CHECK"`,
      [
        `:local piC ""`,
        `:do { :set piC [/file get [:pick [/file find where name~"${pat}"] 0] contents] } on-error={ :set piC "" }`,
        `:local piN [:len [/file find where name~"${pat}"]]`,
        // Derived, not spelled. See `wanUplinkLines`' own note: this file
        // contained both `"nil"` and `"nothing"` for the same value, so one
        // of the two was silently broken. Had `"nothing"` been the wrong
        // guess, all three of these would have been permanently true and
        // this entire check would have printed PASS on every device --
        // a check that cannot fail, which is the thing it exists to end.
        `:local piNoFind [:typeof [:find "a" "zz"]]`,
        `:local piHasR ([:typeof [:find $piC "routerId=${r}"]] != $piNoFind)`,
        `:local piHasO ([:typeof [:find $piC "organizationId=${o}"]] != $piNoFind)`,
        `:local piHasL ([:typeof [:find $piC "locationId=${l}"]] != $piNoFind)`,
        `:local piMk [:find $piC "cloudguest-portal r="]`,
        `:local piOk ($piN > 0 && $piHasR && $piHasO && $piHasL)`,
        `:put ("  login.html copies on this device: " . [:tostr $piN])`,
        `:put ("  platform expects: ${mk}")`,
        `:if ([:typeof $piMk] != $piNoFind) do={ :put ("  on disk:          " . [:pick $piC $piMk ($piMk + 140)]) }`,
        `:if ([:typeof $piMk] = $piNoFind) do={ :put "  on disk:          no cloudguest marker (these pages predate it, or are not ours)" }`,
        `:if ([:len $piC] = 0) do={ :put "  RESULT: FAIL -- could not read login.html on this device at all." }`,
        `:if ($piOk) do={ :put "  RESULT: PASS -- the deployed pages carry this router's current ids." }`,
        `:if ([:len $piC] > 0 && !$piOk) do={ :put "  RESULT: FAIL -- THIS DEVICE IS SERVING ANOTHER TENANT'S PORTAL LINK." }`,
        `:if ([:len $piC] > 0 && !$piHasL) do={ :put "  locationId on disk is not the one this script was generated for." }`,
        `:if ([:len $piC] > 0 && !$piHasO) do={ :put "  organizationId on disk is not the one this script was generated for." }`,
        `:if ([:len $piC] > 0 && !$piHasR) do={ :put "  routerId on disk is not this router -- these pages came from another device." }`,
        `:if ([:len $piC] > 0 && !$piOk) do={ :put "  Those ids may name records that no longer exist. The portal answers 404 on" }`,
        `:if ([:len $piC] > 0 && !$piOk) do={ :put "  every guest load: the guest sees a spinner, then nothing. Meanwhile every" }`,
        `:if ([:len $piC] > 0 && !$piOk) do={ :put "  other check on this router passes, which is exactly how this went unseen." }`,
        `:if (!$piOk) do={ :log warning "cloudguest-portal: deployed hotspot pages carry ids that are not this router's -- every guest load 404s" }`,
        `:if (!$piOk) do={ :error "cloudguest-portal: STOPPING -- this device is not serving this venue's portal. Paste all five Portal Redirect Page chunks, then re-paste this one." }`,
      ].join("; "),
      // The other four pages, shallowly: only that each carries the CURRENT
      // locationId. `/file set [find ...]` writes every match identically, so
      // a divergence between them can only come from a previous run using a
      // different match pattern -- rare, but silent, and cheap to rule out.
      //
      // The `.` is left UNESCAPED, matching the `/login.html` pattern this
      // file has used in production all along (`portalFileMatchPattern`): a
      // regex `.` matches any character, which is harmless across this fixed
      // set of names, and `\.` inside a RouterOS double-quoted string is not
      // a documented escape -- the parser's treatment of an unknown one is
      // exactly the kind of thing that fails silently on one board and not
      // another.
      //
      // The alternation regex is one `~` match rather than four separate
      // `find`s purely to keep this to one entered line. If `~` turns out not
      // to accept POSIX alternation on some board, the fallback is four lines
      // each using `portalFileMatchPattern`, which is already proven in
      // production.
      [
        `:local piL "locationId=${l}"`,
        `:local piStale 0`,
        `:local piNoFind2 [:typeof [:find "a" "zz"]]`,
        `:foreach f in=[/file find where name~"/(rlogin|alogin|status|logout).html"] do={ :if ([:typeof [:find [/file get $f contents] $piL]] = $piNoFind2) do={ :set piStale ($piStale + 1) } }`,
        `:if ($piStale = 0) do={ :put "  rlogin/alogin/status/logout: all carry this venue's locationId." }`,
        `:if ($piStale > 0) do={ :put ("  WARNING: " . [:tostr $piStale] . " other hotspot page(s) still carry a different locationId.") }`,
        `:if ($piStale > 0) do={ :log warning "cloudguest-portal: some hotspot pages still carry another location's id" }`,
      ].join("; "),
      `:put "===================================================="`,
    ].join("\n"),
  };
}

export interface RouterSetupScriptChunk {
  label: string;
  script: string;
}

/** A SUBSYSTEM THIS SCRIPT DOES NOT CONFIGURE, AND WHY.
 *
 * Two shapes, and the difference between them is the whole of item 2.
 *
 * A FAILURE (`deliberate` absent/false) is the platform having tried and
 * not got there: an allocate call that threw, a RADIUS bridge that 502'd.
 * The script `:error`s -- there is a cause to fix and re-pasting this
 * artifact cannot fix it.
 *
 * A CHOICE (`deliberate: true`) is the operator having deselected the
 * subsystem, and it does NOT `:error`, deliberately: aborting a run
 * somebody scoped on purpose is how a warning becomes something people
 * page past. That softer ending was the seam. Three things said "this is
 * partial" -- an amber panel, a `# !!` header, a last line that names the
 * gap -- and NONE of them stopped anything, so an operator who noticed
 * none of the three got a venue with no guest login and a green finish.
 *
 * SO THE SOFT ENDING IS NOT AVAILABLE FOR FREE. `acknowledgement` is
 * REQUIRED on the choice branch, and it is required to be the text the
 * operator TYPED to reach this state -- not a boolean the caller can set,
 * because a boolean is exactly what "the box was unticked" already was.
 * The generator re-checks it at runtime (`isAcknowledgedChoice`) and a
 * `deliberate: true` entry that arrives with an empty acknowledgement is
 * treated as a FAILURE and `:error`s. Fail-closed: a caller that forgets
 * to collect the acknowledgement gets the loud ending, never the quiet
 * one.
 *
 * The text is carried into the artifact -- the section-1 banner, the
 * `.rsc` header -- so the operator holding the file a week later can see
 * not just THAT it was a choice but that a human typed the consequence
 * out. That is the in-file acknowledgement, and it is the thing a
 * screenshot of a green run cannot fake. */
export type SetupScriptGap =
  | {
      what: string;
      why: string;
      deliberate?: false;
      /** Never set on the failure branch: nobody acknowledged a 502. */
      acknowledgement?: undefined;
    }
  | {
      what: string;
      why: string;
      deliberate: true;
      /** Verbatim what the operator typed to switch this subsystem off.
       * Empty or whitespace-only demotes this entry to a failure. */
      acknowledgement: string;
    };

/** Whether a gap may take the non-aborting ending. `deliberate` alone is
 * not enough -- see `SetupScriptGap`. */
function isAcknowledgedChoice(gap: SetupScriptGap): boolean {
  return gap.deliberate === true && (gap.acknowledgement ?? "").trim().length > 0;
}

/** THE PHRASE THAT BUYS A PARTIAL PROVISION, AND IT IS THE CONSEQUENCE.
 *
 * Not the subsystem name. "Type RADIUS to continue" is satisfiable by
 * someone who has not read a word of the dialog; "type NO GUEST LOGIN"
 * is not, and that is the entire mechanism -- there is nothing else in a
 * modal that makes a person think. The operator has to write out the
 * outcome they are choosing.
 *
 * Lives HERE, next to `SetupScriptGap`, rather than in the panel: the
 * type requires an acknowledgement and this is what a valid one is, so
 * the requirement and its satisfaction are one file apart from nothing.
 * It also makes the decision a pure function the generator suite can
 * CALL -- the panel's copy of this was source-grepped, and a grep for
 * `typed === null` stayed green when the comparison that actually
 * accepts or rejects the phrase was mutated to accept anything. */
export const DESELECT_PHRASE = {
  radius: "NO GUEST LOGIN",
  wireguard: "NO PLATFORM ACCESS",
} as const;

/** What the operator is being asked to accept, in the words the script
 * and the panel will both use. */
/* eslint-disable-next-line react-refresh/only-export-components --
   The suite (`scripts/test-setup-script-generator.mjs`) imports this to
   assert against the real implementation rather than a copy, which is the
   only way these guards mean anything. Extracting it would mean moving the
   generator's core out of the file the whole suite is built around, in the
   highest-risk file in this repo, immediately after hardening it -- a real
   regression risk traded for a lint warning. Scoped here rather than spent
   as headroom on the repo-wide --max-warnings ratchet, so the ratchet keeps
   catching drift that is not this. */
export const DESELECT_CONSEQUENCE: Record<keyof typeof DESELECT_PHRASE, string> = {
  radius:
    "Without RADIUS this router's hotspot comes up, serves the portal, looks completely correct -- and Access-Rejects EVERY guest login. No OTP, no session, no accounting. RouterOS reports no error for this and neither does the dashboard; the guest just sees the sign-in fail. The venue has WiFi with nobody able to use it.",
  wireguard:
    "Without the tunnel this router never reaches the platform: no heartbeat, no Discovery, no Device Console, and it sits at 'provisioning' on the dashboard forever while guest WiFi works fine. RADIUS also has no address to source from, so it goes with it.",
};

/** Grades what the operator typed. Returns the canonical acknowledgement
 * to record in the script, or `null` -- and `null` MUST leave the
 * subsystem enabled.
 *
 * `typed === null` is `window.prompt` cancelled, and it is also
 * `window.prompt` suppressed by the browser. Both mean "no human said
 * yes", and both have to fail toward a FULL provision: a dialog policy
 * nobody set must not be able to produce the exact script this gate
 * exists to prevent.
 *
 * Trimmed and case-folded on purpose. The requirement is that they read
 * it and wrote it, not that they matched a shell's idea of equality; a
 * stray space from a double-click is not a different decision. Anything
 * that is not the phrase -- including the empty string, the subsystem's
 * own name, or the phrase with something appended -- is a no. */
/* eslint-disable-next-line react-refresh/only-export-components --
   The suite (`scripts/test-setup-script-generator.mjs`) imports this to
   assert against the real implementation rather than a copy, which is the
   only way these guards mean anything. Extracting it would mean moving the
   generator's core out of the file the whole suite is built around, in the
   highest-risk file in this repo, immediately after hardening it -- a real
   regression risk traded for a lint warning. Scoped here rather than spent
   as headroom on the repo-wide --max-warnings ratchet, so the ratchet keeps
   catching drift that is not this. */
export function deselectAcknowledgement(
  which: keyof typeof DESELECT_PHRASE,
  typed: string | null,
): string | null {
  if (typed === null) return null;
  return typed.trim().toUpperCase() === DESELECT_PHRASE[which] ? DESELECT_PHRASE[which] : null;
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
    // HOW TO READ THE RUN, IN THE FILE, BECAUSE THE FILE TRAVELS ALONE.
    //
    // AC-4.3/4.4. The panel says this too, but the panel is not at the
    // venue -- the operator saved this file, walked to a rack and opened
    // it in whatever Windows has. The instruction has to be inside it.
    //
    // Two ways to read it on purpose. `/import` echoing `:put` is an
    // ASSUMPTION -- see `markerStatements` -- so the `/log` route is named
    // first and is not presented as a fallback: it is the one that works
    // whatever `/import` does with console output, and it survives the
    // terminal buffer scrolling past on a 30-chunk run.
    `# HOW TO TELL A CLEAN RUN FROM ONE THAT STOPPED HALFWAY:`,
    `#   /log print where message~"${SINGLE_LINE_MARKER_PREFIX}"`,
    `# The last line must read '${SINGLE_LINE_MARKER_PREFIX} COMPLETE'. If the last line`,
    `# is a 'START <n>/<N> <name>' instead, that chunk is where the import`,
    `# stopped and nothing below it ran. Every marker is also printed to the`,
    `# terminal, so the same last line is readable there if /import echoes it.`,
    "",
  ];
  // THE .rsc IS ITS OWN DELIVERY CHANNEL, AND IT IS THE ONE THAT BIT FIRST.
  //
  // A downloaded file has no toast, no banner and no panel around it: the
  // operator saves it, walks to the venue, uploads it and runs `/import`.
  // Confirmed live 2026-08-27 -- the operator's first attempt was a
  // downloaded .rsc that simply had no RADIUS in it, and there was nothing
  // in the file to say so. The `INCOMPLETE SCRIPT` chunk was present as
  // `:put` lines somewhere in the middle, which is invisible when you are
  // reading a file rather than watching a terminal, and `/import` prints
  // them past far too fast to catch.
  //
  // So the gap is restated at the very top of the file, in `#` comments --
  // the first thing anyone opening it sees, and the one part of a .rsc
  // that survives being read in a text editor as plainly as it survives
  // `/import`.
  const incomplete = chunks.filter((c) => c.label.startsWith("INCOMPLETE SCRIPT"));
  if (incomplete.length > 0) {
    lines.push(
      `# ====================================================`,
      // Same words the device itself prints from section 1, so the file's
      // header and the terminal cannot tell the reader two different
      // stories about the same script.
      incomplete.every((c) => c.label.includes("(by choice)"))
        ? `# !! THIS SCRIPT IS PARTIAL BY CHOICE -- READ BEFORE IMPORTING`
        : `# !! THIS SCRIPT IS INCOMPLETE -- READ BEFORE IMPORTING`,
      `# ====================================================`,
      ...incomplete.map((c) => `# !! ${c.label}`),
      // THE TYPED ACKNOWLEDGEMENT, LIFTED OUT OF THE CHUNK IT WAS
      // PRINTED IN.
      //
      // Read back out of the emitted script rather than taken from a
      // second copy of the gap list, for the same reason section 15.8's
      // warning is derived: two sources for one fact is how the file
      // header and the device output came to tell different stories in
      // the first place. If the banner does not say it, the header
      // cannot either.
      //
      // Why it belongs at the top of the file at all: a `.rsc` gets
      // re-imported, forwarded and blamed weeks later, and "(by choice)"
      // records only that a flag was set. The typed string records that
      // a human read the consequence and wrote it out. When a venue has
      // no guest login, this line is the difference between "who
      // approved this" and an argument.
      ...incomplete
        .flatMap((c) => c.script.split("\n"))
        .filter((l) => l.includes("acknowledged: the operator typed"))
        .map(
          (l) =>
            `# !! ${l
              .replace(/^:put\s+"\s*/, "")
              .replace(/"$/, "")
              .trim()}`,
        ),
      `# !! The missing pieces, and what each costs, are spelled out in`,
      `# !! section 1 below. Importing this file leaves the router`,
      // A file that is short BY CHOICE imports to the end and configures a
      // router that is genuinely missing those subsystems -- telling its
      // reader to "fix the cause" would send them looking for a fault that
      // does not exist. What they need instead is the one fact that makes
      // the omission recoverable: it is a checkbox, not an outage.
      ...(incomplete.every((c) => c.label.includes("(by choice)"))
        ? [
            `# !! half-configured -- deliberately: these were switched OFF in`,
            `# !! the Advanced panel before this file was generated. Nothing`,
            `# !! failed. Tick them and press Generate again for a full one.`,
          ]
        : [
            `# !! half-configured. Fix the cause, press Generate again, and`,
            `# !! download a NEW .rsc.`,
          ]),
      `# ====================================================`,
      "",
    );
  }
  // PROGRESS MARKERS, THE SAME ONES THE ONE-LINE PASTE HAS HAD ALL ALONG.
  //
  // `/import` ABORTS ON THE FIRST ERROR AND DOES NOT SAY WHICH CHUNK IT WAS
  // IN. Confirmed live on a hEX (RouterOS 7.23.3, 2026-09-01): a `comment=`
  // on `/ip hotspot` -- a menu that has no such property -- killed the
  // import at "line 75 column 183", so Hotspot, RADIUS, WireGuard and
  // Heartbeat never ran. RouterOS reports a FILE line/column and nothing
  // else; mapping that back to a chunk means opening the .rsc in an editor,
  // at a venue, and counting. The founder's report of this session -- "the
  // script executed, RADIUS wasn't there and it didn't run" -- is that same
  // shape, and the reason it was hard to diagnose is that the file's own
  // output gave no way to tell a run that stopped at chunk 10 from one that
  // completed.
  //
  // `chunksToSingleLineScript` solved this for the flattened paste in
  // August and the .rsc never got it, which is the asymmetry that matters
  // most: the .rsc is the channel the founder actually uses. Same prefix,
  // same `START <n>/<N>` / `DONE <n>/<N>` / `COMPLETE` vocabulary, so the
  // two delivery channels report identically and an operator only has to
  // learn one thing:
  //
  //  - last line `COMPLETE`             -> every chunk ran.
  //  - last line `START 10/32 Hotspot`  -> chunk 10 is where it died, by
  //    NAME. Chunks 11-32 (RADIUS, WireGuard, Heartbeat) did not run.
  //  - last line `DONE 10/32` with no `START 11/32` -> the file was
  //    truncated between chunks rather than erroring.
  //
  // These are plain top-level statements over a double-quoted literal,
  // which is exactly what the rest of this generator already trusts in both
  // channels: nothing to parse, nothing to escape at run time, and no
  // dependence on any variable. They are deliberately NOT `#` comments --
  // a comment prints nothing, and output an operator can read back is the
  // entire point. The `# --- N. label ---` comments stay as well: they are
  // what makes RouterOS's own "line 75" mappable when someone does open the
  // file.
  //
  // Each marker is emitted TWICE, to two different sinks. See
  // `markerStatements` for why the whole scheme would otherwise rest on an
  // assumption nobody has tested on hardware.
  //
  // The label goes through `escapeForRouterOsString` for the same reason it
  // does in the single-line builder: it is operator-influenced text (a WAN
  // count, a portal filename) inside a double-quoted RouterOS string.
  const total = chunks.length;
  chunks.forEach((chunk, i) => {
    const n = i + 1;
    const label = escapeForRouterOsString(chunk.label);
    lines.push(
      `# --- ${n}. ${chunk.label} ---`,
      ...markerStatements(markerText("START", n, total, label)),
      chunk.script,
      ...markerStatements(markerText("DONE", n, total, label)),
      "",
    );
  });
  // THE ONLY POSITIVE PROOF THE FILE RAN TO THE END. Without it, "no error
  // scrolled past" is the only evidence of success available to someone
  // watching an import, and that is precisely the evidence that was wrong
  // every time this went wrong.
  lines.push(...chunksToCompletionMarkerStatements(chunks), "");
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
 *   above either way.
 *
 * **ONE ERROR ABORTS THE REST OF THE LINE, AND THAT USED TO BE INVISIBLE.**
 * Confirmed live (2026-08-23, the founder's own provisioning run): a
 * concatenation-parentheses bug -- since fixed -- made RouterOS stop with a
 * single `expected end of command (line 1 column 1464)` partway through the
 * flattened script. Everything before that column had already run;
 * everything after it, including the whole Heartbeat chunk, never did. So
 * the router served guests perfectly and never created its heartbeat
 * scheduler, and Master console showed it offline with nothing anywhere
 * connecting the two. RouterOS reports ONE error for the whole line and no
 * indication of how far it got, and a column number in a 3,000-character
 * paste is not something an operator can map back to a chunk.
 *
 * So every chunk is bracketed by a `:put` PROGRESS MARKER: `START <n>/<N>`
 * before its statements and `DONE <n>/<N>` after them, with a final
 * `COMPLETE` marker at the end. These are the only thing that can tell a
 * partial run from a complete one, because they are the only output that
 * exists whether or not a chunk prints anything of its own:
 *
 *  - Last line `COMPLETE` -> every chunk ran.
 *  - Last line `START 9/14 Heartbeat` -> chunk 9 is where it died, and
 *    chunks 10-14 did not run at all. That is a chunk name, not a column
 *    number, and it maps straight onto the chunk list in the panel.
 *  - Last line `DONE 9/14` with no `START 10/14` -> the paste itself was
 *    truncated between chunks rather than erroring.
 *
 * Markers, NOT removing the feature and NOT relying on the panel's warning
 * text alone. The warning was already there and it did not help: it says a
 * long paste can be corrupted, which is a different failure from a syntax
 * error aborting the remainder, and neither one is legible after the fact
 * without knowing where the run stopped. The panel copy now states the
 * abort behaviour explicitly as well (see `RouterSetupScriptAdvanced`) --
 * both, because the marker tells you what happened and the copy tells you
 * to go looking. The markers are plain top-level `:put`s of a
 * double-quoted literal: nothing to parse, nothing to escape at runtime,
 * and they cost ~60 characters per chunk against a 5-figure paste.
 *
 * `#` comment lines are still dropped (see above) -- the markers
 * deliberately are NOT comments, since a comment prints nothing and the
 * whole point is output an operator can read back. */
export const SINGLE_LINE_MARKER_PREFIX = "### cloudguest";

/** THE MARKERS DO NOT GET TO DEPEND ON AN UNTESTED ASSUMPTION.
 *
 * Every progress marker in both channels -- `START n/N`, `DONE n/N`,
 * `COMPLETE` -- was a bare `:put`, and the whole run/abort legibility
 * scheme rested on one thing NOBODY IN THIS REPO HAS EVER CONFIRMED ON
 * HARDWARE: that `/import` echoes `:put` output to the terminal at all.
 * The spec records it as an open question (AC-4.5, "resolve this on real
 * hardware before implementing AC-4.1") and it was never resolved. The
 * one-line paste has carried these markers since August without the
 * question being asked there either -- it is less doubtful there, because
 * a pasted line runs in the console the operator is looking at, but "less
 * doubtful" is not "measured".
 *
 * If `/import` swallows `:put`, the operator reads nothing, and every fix
 * that was made for "the script executed, RADIUS wasn't there and it
 * didn't run" is void -- silently, and in exactly the channel the founder
 * uses.
 *
 * So each marker is written to BOTH sinks. `:log` needs no terminal: it
 * lands in `/log` and is read back with
 * `/log print where message~"### cloudguest"` after the fact. This is not
 * merely a hedge against the open question -- it is strictly better
 * evidence than `:put` even if `:put` does echo, because an `/import` on
 * a 32-chunk script prints far more than a WinBox terminal buffer holds
 * and the useful line has scrolled off by the time anyone looks. The
 * `:put` half stays, and stays LAST of the pair, because the runbook
 * everybody actually follows is "read the last line".
 *
 * `:log info "<literal>"` is not a new shape for this generator: it is
 * already used on the RouterOS-version, clock, WireGuard-DNS and
 * missing-subsystem paths. It cannot fail on a device that has a log,
 * which is every device.
 *
 * THE COST OF BEING WRONG IN THE OTHER DIRECTION IS ~55 CHARACTERS PER
 * MARKER, on a file channel where size is free and a paste channel that
 * was already five figures. The cost of being wrong about `:put` is a
 * silent half-provisioned router, which is the entire subject of this
 * file. */
/* eslint-disable-next-line react-refresh/only-export-components --
   The suite (`scripts/test-setup-script-generator.mjs`) imports this to
   assert against the real implementation rather than a copy, which is the
   only way these guards mean anything. Extracting it would mean moving the
   generator's core out of the file the whole suite is built around, in the
   highest-risk file in this repo, immediately after hardening it -- a real
   regression risk traded for a lint warning. Scoped here rather than spent
   as headroom on the repo-wide --max-warnings ratchet, so the ratchet keeps
   catching drift that is not this. */
export function markerStatements(text: string): string[] {
  return [`:log info "${text}"`, `:put "${text}"`];
}

/** The text inside a START/DONE marker. `label` is expected to have been
 * through `escapeForRouterOsString` already -- it is operator-influenced
 * (a WAN count, a portal filename) and is being interpolated into a
 * RouterOS double-quoted string. */
function markerText(kind: "START" | "DONE", n: number, total: number, label: string): string {
  return `${SINGLE_LINE_MARKER_PREFIX} ${n}/${total} ${kind} ${label}`;
}

/** EVERY STATEMENT EITHER RENDERER IS ALLOWED TO INVENT, ENUMERATED.
 *
 * The `.rsc` and the flattened paste are the only two places where text
 * that no chunk wrote reaches a router, and the guarantee that makes the
 * other ~3,000 assertions in `test-setup-script-generator.mjs` mean
 * anything is that the renderers add NOTHING EXECUTABLE OF THEIR OWN --
 * because every guard in that suite reads `chunk.script`, not the file.
 *
 * Progress markers are the one exception, and an exception stated as
 * "anything containing the marker prefix is fine" is not a bound: it
 * would wave through `/system reboot; :put "### cloudguest"` just as
 * happily. So the exception is an ENUMERATION instead. This function
 * returns the exact, complete, ordered list of statements the renderers
 * may contribute for a given chunk array; the suite asserts set equality
 * against it rather than pattern-matching, and separately asserts that
 * every member of it is an inert print/log of a double-quoted literal.
 *
 * Both renderers are built from the same two helpers this composes, so a
 * renderer that grew a statement this does not predict is red, and a
 * renderer that stopped emitting one this predicts is red as well. */
/* eslint-disable-next-line react-refresh/only-export-components --
   The suite (`scripts/test-setup-script-generator.mjs`) imports this to
   assert against the real implementation rather than a copy, which is the
   only way these guards mean anything. Extracting it would mean moving the
   generator's core out of the file the whole suite is built around, in the
   highest-risk file in this repo, immediately after hardening it -- a real
   regression risk traded for a lint warning. Scoped here rather than spent
   as headroom on the repo-wide --max-warnings ratchet, so the ratchet keeps
   catching drift that is not this. */
export function progressMarkerStatements(chunks: RouterSetupScriptChunk[]): string[] {
  const total = chunks.length;
  return [
    ...chunks.flatMap((chunk, i) => {
      const label = escapeForRouterOsString(chunk.label);
      return [
        ...markerStatements(markerText("START", i + 1, total, label)),
        ...markerStatements(markerText("DONE", i + 1, total, label)),
      ];
    }),
    ...chunksToCompletionMarkerStatements(chunks),
  ];
}

/** THE LAST LINE OF THE FILE, AND THE ONLY ONE ANYONE PROMISES TO READ.
 *
 * Both channels end with a `COMPLETE` sentinel, and the field runbook is
 * one sentence long: import it, read the last line. That instruction is
 * only safe if the last line can tell the difference between the two ways
 * a run ends well-formed:
 *
 *   - every chunk ran and the router is fully provisioned;
 *   - every chunk ran and the router is missing a whole subsystem,
 *     because the script was generated without one.
 *
 * A DELIBERATE gap does not `:error` -- on purpose, so that a warning
 * somebody meant to see does not become a warning everyone learns to click
 * past -- which means it reaches this line and, until this function
 * existed, printed the identical `COMPLETE -- all N chunk(s) ran` as a
 * complete provision. That is the original defect wearing a sentinel: a
 * script that quietly did less than the operator believed, with a green
 * light at the end of it. The banner at the top says so, but the top of an
 * `/import` has scrolled off by then, and "read the last line" is the
 * instruction that actually gets followed at a rack.
 *
 * So the gap rides on the last line too. Derived from the chunk list
 * itself -- the same `INCOMPLETE SCRIPT` label the `.rsc` header keys off
 * -- so the two channels and the file header cannot disagree, and a chunk
 * count that changes cannot leave this behind. */
function chunksToCompletionMarkerStatements(chunks: RouterSetupScriptChunk[]): string[] {
  const total = chunks.length;
  const head = `${SINGLE_LINE_MARKER_PREFIX} COMPLETE -- all ${total} chunk(s) ran`;
  const gapChunk = chunks.find((c) => c.label.startsWith("INCOMPLETE SCRIPT"));
  if (!gapChunk) {
    return markerStatements(`${head}. A run that ends anywhere else stopped early.`);
  }
  // The label already carries the subsystem names and the "(by choice)"
  // distinction; reusing it rather than re-deriving keeps this line, the
  // section-1 banner and the `.rsc` header telling one story.
  const what = escapeForRouterOsString(
    gapChunk.label.replace(/^INCOMPLETE SCRIPT(?: \(by choice\))? -- /, ""),
  );
  return markerStatements(
    `${head}, BUT THIS SCRIPT WAS NOT A FULL PROVISION: ${what}. This router is NOT finished -- see section 1 at the top of this run. A run that ends anywhere else stopped early.`,
  );
}

export function chunksToSingleLineScript(chunks: RouterSetupScriptChunk[]): string {
  const total = chunks.length;
  const commandLines = chunks.flatMap((chunk, i) => {
    const n = i + 1;
    const label = escapeForRouterOsString(chunk.label);
    const body = chunk.script
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith("#"));
    return [
      ...markerStatements(markerText("START", n, total, label)),
      ...body,
      ...markerStatements(markerText("DONE", n, total, label)),
    ];
  });
  commandLines.push(...chunksToCompletionMarkerStatements(chunks));

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

/** Every block body opened by `do={`, `:do {`, `on-error={` or `else={`,
 * with the statements it contains, split at that body's OWN depth. String
 * contents are skipped throughout, so a `do={` inside a `:put` message is
 * not mistaken for real syntax and a nested single-statement block counts
 * as one statement rather than many.
 *
 * Deliberately the same algorithm as `doBodies` in
 * `scripts/test-setup-script-generator.mjs`: that one gates the
 * generator's source in CI, this one gates the text actually sitting in
 * front of the operator. The two must not be able to disagree about what
 * a "statement" is. */
function routerOsBlockBodies(s: string): { body: string; statements: string[] }[] {
  const opens: number[] = [];
  let inStr = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (c === "\\") i++;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') {
      inStr = true;
      continue;
    }
    if (c === "{" && /(?::do|\bdo=|on-error=|else=)\s*$/.test(s.slice(Math.max(0, i - 12), i)))
      opens.push(i);
  }

  const bodies: { body: string; statements: string[] }[] = [];
  for (const open of opens) {
    let depth = 0;
    let close = -1;
    let str = false;
    for (let i = open; i < s.length; i++) {
      const c = s[i];
      if (str) {
        if (c === "\\") i++;
        else if (c === '"') str = false;
        continue;
      }
      if (c === '"') {
        str = true;
        continue;
      }
      if (c === "{") depth++;
      else if (c === "}" && --depth === 0) {
        close = i;
        break;
      }
    }
    // Unbalanced -- the bracket-balance check above already reports it,
    // and guessing at a body here would report the same fault twice under
    // a second, less accurate name.
    if (close === -1) continue;
    const body = s.slice(open + 1, close);

    const parts: string[] = [];
    let cur = "";
    let d = 0;
    let bstr = false;
    for (let i = 0; i < body.length; i++) {
      const c = body[i];
      if (bstr) {
        cur += c;
        if (c === "\\") cur += body[++i] ?? "";
        else if (c === '"') bstr = false;
        continue;
      }
      if (c === '"') {
        bstr = true;
        cur += c;
        continue;
      }
      if (c === "{" || c === "[" || c === "(") d++;
      else if (c === "}" || c === "]" || c === ")") d--;
      if (d === 0 && (c === ";" || c === "\n")) {
        parts.push(cur);
        cur = "";
        continue;
      }
      cur += c;
    }
    parts.push(cur);
    bodies.push({ body, statements: parts.map((p) => p.trim()).filter(Boolean) });
  }
  return bodies;
}

/** THE EXACT LIST OF THINGS `validateSetupScriptChunks` LOOKS FOR.
 *
 * Exported and rendered verbatim in the panel next to the result, because
 * the gap between what this checks and what an operator hears when it
 * passes is itself a confirmed-live incident (2026-08-23): the founder
 * clicked Validate, it passed, he pasted the flattened script into a live
 * router, and it died at `expected end of command (line 1 column 1464)` --
 * taking the Heartbeat chunk and everything after it with it. The router
 * then served guests perfectly and showed offline in Master console.
 *
 * The line it died on was
 * `:log warning "... (still \"" . $wan1Gw . "\") ..."`. Every bracket and
 * every quote in it balances. It is still invalid RouterOS, because a `.`
 * concatenation used as a bare command argument has to be wrapped in
 * parentheses. Balance and validity are different questions, and this
 * function only ever answered the first one while the word "Validated"
 * answered the second. */
export const SETUP_SCRIPT_VALIDATOR_CHECKS = [
  "Brackets, braces, parentheses and double quotes balance (string contents ignored).",
  "A `.` concatenation passed as a bare argument to `:put` / `:log` / `:error` -- must be wrapped in parentheses. This is the fault that aborted a live paste on 2026-08-23 at column 1464 and silently discarded every chunk after it.",
  "A `do={}` / `else={}` / `on-error={}` body holding more than one statement -- a confirmed live syntax error on this hardware.",
  "A `$variable` read on a line that did not bind it -- the RouterOS console runs each entered line as its own program, so the read hits nothing and the block prints a confident wrong answer.",
  'An unescaped `$var` inside a nested `on-event="..."` string, which RouterOS resolves at creation time instead of at run time.',
  'A stray character immediately before a leading `#` -- the WinBox/WebFig paste-corruption signature ("v#" for "#").',
  "Every line starting with a recognisable RouterOS token.",
] as const;

/** What a clean pass does NOT mean. Rendered next to the result for the
 * same reason as the list above. */
export const SETUP_SCRIPT_VALIDATOR_LIMITS =
  "This is a text check against six known failure shapes, not a RouterOS parser and not a test on a device. " +
  "It cannot tell you that a command exists, that a property name is spelled right, that a value is in range, " +
  "or that any of this is correct for THIS router. A clean pass means none of the six shapes below were found -- nothing more.";

/** Static-analysis validator for a generated script's chunks -- runs
 * entirely client-side against the generator's own output, before it's
 * ever copy-pasted or `/import`-ed. Deliberately does NOT require a live
 * device: everything here is checking the *generator's own text*, not
 * whether a real router accepts it (that needs an actual RouterOS
 * instance, which is a separate, heavier "test on device" capability, not
 * this one).
 *
 * SCOPE IS PART OF THE CONTRACT -- see `SETUP_SCRIPT_VALIDATOR_CHECKS` and
 * `SETUP_SCRIPT_VALIDATOR_LIMITS` above, which the panel renders next to
 * the verdict. Deliberately NOT a RouterOS parser: a bounded list of
 * shapes this project has actually been burned by, each one traceable to
 * an incident, plus a plain statement that it checks nothing else. A
 * validator that appears to check everything is worse than one that
 * checks four things and says so -- the first gets trusted for the
 * wrong questions, which is exactly how a 3,000-character paste went into
 * a live router on the strength of the word "Validated". */
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

    // -- a `.` CONCATENATION USED AS A BARE COMMAND ARGUMENT.
    //
    // `:log warning "a" . $x . "b"` balances perfectly and is invalid
    // RouterOS: the console reads `"a"` as the whole argument and then
    // finds a `.` where the command should have ended. It reports
    // `expected end of command (line 1 column N)` -- and on the flattened
    // single-line script that aborts every chunk after it. Confirmed live
    // twice. The legal form is `:log warning ("a" . $x . "b")`.
    //
    // Only flags a `.` at the argument's OWN depth: anything inside
    // `(...)`, `[...]`, `{...}` or a double-quoted string is fine, which
    // is what keeps `("a" . $x)`, `[:tostr $n]` and every dotted IP
    // literal out of the results. Over-strictness matters as much as
    // blindness here -- a validator that cries wolf is a validator that
    // gets clicked past.
    for (const m of s.matchAll(/:(?:put|error|log[ \t]+[a-z]+)(?=[ \t])/g)) {
      const start = (m.index ?? 0) + m[0].length;
      let depth = 0;
      let str = false;
      for (let i = start; i < s.length; i++) {
        const c = s[i];
        if (str) {
          if (c === "\\") i++;
          else if (c === '"') str = false;
          continue;
        }
        if (c === '"') {
          str = true;
          continue;
        }
        if (c === "(" || c === "[" || c === "{") depth++;
        else if (c === ")" || c === "]") depth--;
        else if (c === "}") {
          if (depth === 0) break; // this statement's enclosing block closed
          depth--;
        } else if (depth === 0 && (c === ";" || c === "\n")) break;
        else if (depth === 0 && c === ".") {
          issues.push({
            severity: "error",
            message: `"${m[0].trim()}" is given a "." concatenation without parentheses around it -- RouterOS stops at "expected end of command" here, and in the one-line copy that discards every chunk after this one. Wrap the whole argument: ${m[0].trim()} ("..." . $var . "...").`,
          });
          break;
        }
      }
    }

    // -- a `do={}` / `else={}` / `on-error={}` body holding more than one
    // statement. `;`-chaining two statements inside an inline body threw a
    // real syntax error on a live router; splitting the same body over
    // several lines only trades that confirmed defect for an unverified
    // assumption about console brace-continuation. Same rule, and the same
    // detection, as `scripts/test-setup-script-generator.mjs`'s own guard
    // -- that one gates the generator's source, this one gates the text
    // actually on the operator's screen.
    for (const body of routerOsBlockBodies(s)) {
      if (body.statements.length > 1) {
        issues.push({
          severity: "error",
          message: `A "do={ ... }" body holds ${body.statements.length} statements -- a ";"-chained body threw a real syntax error on this hardware. Give each statement its own guard. Body: "${body.body.trim().slice(0, 80)}${body.body.trim().length > 80 ? "..." : ""}"`,
        });
      }
    }

    // -- a `$variable` READ on a line that did not BIND it. The RouterOS
    // console runs each ENTERED LINE as its own program, so a `:local` on
    // an earlier line no longer exists here: the line is either a syntax
    // error or, worse, evaluates against nothing and prints a confident
    // wrong answer. `:set` is a use, not a binder -- that is exactly what
    // failed on the hEX. Same rule as the generator's own CI guard.
    s.split("\n").forEach((line, lineIdx) => {
      const bound = new Set([
        ...[...line.matchAll(/:(?:local|global)\s+([A-Za-z_][A-Za-z0-9_]*)/g)].map((m) => m[1]),
        ...[...line.matchAll(/:(?:for|foreach)\s+([A-Za-z_][A-Za-z0-9_]*)\s+(?:from|in)\b/g)].map(
          (m) => m[1],
        ),
      ]);
      const used = new Set([
        ...[...line.matchAll(/\$([A-Za-z_][A-Za-z0-9_]*)/g)].map((m) => m[1]),
        ...[...line.matchAll(/:set\s+([A-Za-z_][A-Za-z0-9_]*)/g)].map((m) => m[1]),
      ]);
      const unbound = [...used].filter((v) => !bound.has(v));
      if (unbound.length > 0) {
        issues.push({
          severity: "error",
          message: `Line ${lineIdx + 1} reads ${unbound.map((v) => `"$${v}"`).join(", ")} but does not bind it on that same line -- the RouterOS console runs each entered line as its own program, so the value is gone. Join the statements onto one line with ";".`,
        });
      }
    });

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
/** `comment=` on every `/ip hotspot ip-binding` row the heartbeat's
 * authorized-MAC sync owns.
 *
 * Load-bearing in both directions. The sync REMOVES only rows carrying it,
 * so an operator's own manual bypass -- this platform has already seen a
 * venue AP bypassed by hand on a live router -- is never deleted out from
 * under them. And it ADDS only where no binding exists at all, so a MAC
 * somebody already bypassed manually does not collect a duplicate row on
 * every five-minute tick.
 *
 * Same `cloudguest-<thing>` shape as the NAT/walled-garden markers the
 * backend renderer uses for exactly the same "find my own rows, touch
 * nothing else" reason. */
const AUTHORIZED_MAC_COMMENT = "cloudguest-authmac";

function buildHeartbeatStatements(opts: {
  apiBase: string;
  agentCredential: string;
  wireguard?: WireguardPeerInfo;
}): string {
  const { apiBase, agentCredential, wireguard } = opts;
  // ROUTER-ORIGINATED TRAFFIC IS DELIBERATELY UNMARKED.
  // ---------------------------------------------------
  // This is the policy for everything this router sends on its own behalf
  // -- this heartbeat, DNS, NTP, the WireGuard handshake -- and it is a
  // decision, not an omission.
  //
  // The `/tool fetch` below carries no `routing-mark`, no `routing-table`,
  // and no source address. It is therefore routed by the MAIN table, and
  // the main table's lowest-distance ACTIVE default route is whichever WAN
  // is alive right now. That single fact is the whole failover story: when
  // WAN1's gateway stops answering, `check-gateway=ping` flags WAN1's
  // distance=1 route Inactive, WAN2's distance=2 route becomes the
  // lowest-distance active default, and the NEXT heartbeat -- five minutes
  // later, from the scheduler, with no reprovisioning, no regeneration and
  // no reboot -- goes out over WAN2 and reports WAN2's address. When WAN1
  // comes back its distance=1 route goes active again and the traffic
  // fails back on its own, for the same reason and with the same
  // no-intervention property.
  //
  // In PCC (load-balance) mode the generator DOES create `to_wan<N>`
  // tables and mark traffic into them, and marking this fetch into one of
  // them would be a real hazard: a heartbeat marked `to_wan1` on a router
  // whose WAN1 is dead is a heartbeat that never arrives, and the platform
  // would show the router offline while its guests browse happily over
  // WAN2. It cannot happen here, by construction rather than by care:
  //  - the only `action=mark-routing` rule this generator emits is in
  //    `chain=prerouting`, and router-originated packets never traverse
  //    prerouting -- they start at `output`;
  //  - this generator emits NO `chain=output` mangle rule at all, in any
  //    mode;
  //  - the PCC connection-marking rules are additionally pinned to
  //    `in-interface=<lanBridge>`, so they only ever see guest traffic.
  // `scripts/test-setup-script-generator.mjs` pins all three, plus the
  // absence of any mark/table/src-address on this fetch, so the policy
  // cannot be regressed by an edit that looks locally reasonable.
  //
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
  //
  // The sweep, the three resolution paths and the real-interface check are
  // NOT written out here any more: they are
  // `buildUplinkDiscoveryStatements`, shared byte-for-byte with the "WAN
  // Routing" chunk, so the chunk that BUILDS the uplink's routes and the
  // chunk that REPORTS the uplink cannot drift about what "the uplink"
  // means. This call is what binds `$hbIf` and `$hbDefCount` below.
  return [
    // -- 1. which interface is carrying the default route ---------------
    ...buildUplinkDiscoveryStatements("hb"),
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

/** Opens the NAS gate for guests who have already signed in.
 *
 * ## The gap this closes
 *
 * A guest verifies an OTP, the backend really creates a `GuestSession`,
 * the portal really says "You're connected" -- and the hotspot gate stays
 * shut, because nothing ever told the router. Confirmed live on router
 * 21e13913 (2026-08-29): an `active` session carrying a real device MAC,
 * `GET /agent/authorized-macs` correctly returning that MAC, `run-count=475`
 * on the heartbeat scheduler, and on the device `/ip hotspot active` empty
 * with the `hs-auth` NAT chain at 0 bytes.
 *
 * The endpoint had been built and worked. It simply had no consumer
 * anywhere in either repo -- `render_mac_authorization_entry`'s docstring
 * in the backend already described this sync as something the heartbeat
 * "already uses", and it did not exist. This is that consumer.
 *
 * ## Its own chunk, and its own scheduler, deliberately
 *
 * Not folded into `buildHeartbeatStatements`. Two reasons, both enforced
 * by the generator's own test suite rather than taste: the heartbeat
 * scheduler's single `on-event` line is already near the 3300-char paste
 * ceiling WinBox mangles past, and the agent credential is asserted to
 * appear exactly twice across the Heartbeat chunks. A second `/tool fetch`
 * in there breaks both.
 *
 * Separate is also the better failure story: a broken MAC sync must not
 * stop the router reporting that it is alive.
 *
 * Every `do={ }` body holds EXACTLY ONE statement -- a `;`-chained body is
 * a real syntax error on this hardware, which the validator refuses. */
function buildAuthorizedMacStatements(opts: { apiBase: string; agentCredential: string }): string {
  const { apiBase, agentCredential } = opts;
  return [
    `:local amData ""`,
    `:do { :set amData ([/tool fetch url="${apiBase}/agent/authorized-macs" http-header-field="X-Agent-Credential: ${agentCredential}" output=user as-value]->"data") } on-error={ :log warning "cloudguest-am: authorized-MAC fetch failed" }`,
    `:local amBad 0`,
    `:local amMacs [:toarray ""]`,
    `:if ($amData != "") do={ :do { :set amMacs ([:deserialize from=json value=$amData]->"mac_addresses") } on-error={ :set amBad 1 } }`,
    `:if ($amBad = 1) do={ :log warning "cloudguest-am: authorized-MAC reply unparseable" }`,
    // Only a real, parsed reply may change bindings. An EMPTY list is a
    // legitimate answer -- nobody is signed in -- and must still run the
    // removal pass below. Treating "no MACs" as "do nothing" is exactly
    // what would leave a guest bypassed forever after they disconnect.
    `:local amOk 0`,
    `:if ($amData != "" && $amBad = 0) do={ :set amOk 1 }`,
    // REMOVE FIRST, and only rows carrying this platform's own comment.
    // One OTP must not buy permanent free internet. Scoping the remove to
    // the comment is what keeps an operator's manual bindings safe -- a
    // live router in this fleet has one for the venue's own AP, and
    // deleting that would strand the hardware.
    `:if ($amOk = 1) do={ :foreach amB in=[/ip hotspot ip-binding find where comment="${AUTHORIZED_MAC_COMMENT}"] do={ :if ([:typeof [:find $amMacs [/ip hotspot ip-binding get $amB mac-address]]] = "nothing") do={ /ip hotspot ip-binding remove $amB } } }`,
    // ADD only where NO binding exists -- not "none of ours". A MAC an
    // operator already bypassed by hand must not collect a duplicate row
    // on every tick.
    //
    // AND NEVER for a MAC that is CURRENTLY a live authenticated hotspot
    // session (`/ip hotspot active`). This is the self-inflicted teardown
    // this platform saw live on router 10.5.50.1 (huda city center):
    //   22:48:34 hotspot: <mac> (10.5.50.240): logged in       <- RADIUS OK
    //   22:48:35 hotspot: logged out: host removed: ip binding changed
    // Adding a `type=bypassed` ip-binding for a MAC that RouterOS is
    // already tracking as an authenticated hotspot host makes RouterOS
    // reconcile the two -- a bypassed MAC is by definition NOT a managed
    // hotspot client -- by REMOVING the live host ("ip binding changed").
    // That kills the working session one tick after it succeeds; the phone
    // (worst on iOS, which also rotates its MAC) then sees "no internet"
    // and flaps DHCP. A MAC that is already `active` is already through the
    // gate and needs no bypass at all, so skipping it is a pure no-op for
    // the healthy path. The bypass is still added for a MAC that is
    // authorized in the backend but NOT active on the device -- the
    // gate-stuck case (`/ip hotspot active` empty despite a live session)
    // this sync was built to close, and clean reconnect-without-re-login --
    // because those MACs have no live host for the add to tear down.
    `:if ($amOk = 1) do={ :foreach amM in=$amMacs do={ :if ([:len [/ip hotspot ip-binding find where mac-address=$amM]] = 0 && [:len [/ip hotspot active find where mac-address=$amM]] = 0) do={ /ip hotspot ip-binding add mac-address=$amM type=bypassed comment="${AUTHORIZED_MAC_COMMENT}" } } }`,
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
  /** ISO-8601 stamp baked into the portal pages' `cloudguest-portal` marker
   * and into `/system note`, so the device carries a readable record of WHICH
   * generation last landed on it. Defaults to now; accepted as an argument so
   * the generator stays a pure function of its inputs for tests. */
  generatedAt?: string;
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
  /* `hsPass` stood here, `@deprecated`, "read by nothing", with a note
   * that the form still collected it and that removing the field was a
   * separate change. Both halves are done as of 2026-08-23: the field is
   * gone from `RouterSetupScriptAdvanced` and the option is gone from
   * here. It was removed rather than wired up because the only object a
   * hotspot password can configure is a local `/ip hotspot user`, and this
   * generator deliberately DELETES that account -- RouterOS resolves a
   * local user before it asks RADIUS, so it is a complete portal bypass
   * (no OTP, no session record, no consent, no data cap). See the Hotspot
   * chunk. Any caller still passing `hsPass` is passing an excess property
   * that has never done anything. */
  enableFirewall: boolean;
  wireguard?: WireguardPeerInfo;
  radius?: {
    serverAddress: string;
    sharedSecret: string;
    /** THIS ROUTER'S OWN TUNNEL IP, written to `/radius src-address=`.
     *
     * The backend's `network_config/renderers.py` module docstring calls
     * this "the one field this whole feature lives or dies on", and its own
     * `render_radius_client` has always emitted it -- this generator never
     * did. FreeRADIUS matches an incoming Access-Request against its client
     * list BY SOURCE IP (confirmed live: the hub's `clients.conf` keys each
     * entry by `ipaddr`). A MikroTik with an unset `src-address` sources
     * RADIUS from whichever interface the routing table picks for the
     * destination -- typically the WAN, an address the hub has never heard
     * of -- and FreeRADIUS then drops the request with no reply, nothing
     * logged, and a perfectly correct shared secret. The least debuggable
     * failure this platform can produce, and the one huda city center spent
     * an evening on.
     *
     * Only ever the tunnel IP the PLATFORM has allocated. The chunk refuses
     * to write it if the router does not actually hold that address -- see
     * the `rdSrcOk` guard, and `buildTunnelIdentityCheckChunk` for the
     * paste-time check that stops a diverged device reaching this at all. */
    srcAddress: string;
  };
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
  /** Things the panel tried to provision and could not -- a hub bridge that
   * refused, a RADIUS registration that 502'd. Passed in so the SCRIPT can
   * announce the gap instead of quietly being shorter.
   *
   * Silence was the real defect. When the RADIUS bridge failed the panel
   * showed a toast and generated 22 chunks instead of 23; the operator
   * pasted all of them, the router came up, the hotspot served, and every
   * guest login would have failed because `/radius` was empty. Nothing in
   * the script mentioned it. Confirmed live 2026-08-23.
   *
   * `deliberate: true` means the operator CHOSE to leave this subsystem out
   * (an unticked box in the Advanced panel) rather than the platform having
   * tried and failed. Both still get named in the banner and in the
   * downloaded `.rsc`'s header, because the thing that actually hurt was
   * never "we failed" -- it was a script quietly one chunk shorter than the
   * operator believed, which is the state a DESELECTED subsystem produced
   * too and which nothing recorded, because this array was only ever
   * appended to from a `catch` and an unticked box is not a caught error.
   * What differs is the ending: a FAILURE `:error`s (fix the cause,
   * regenerate, use the new file); a DELIBERATE omission does not, because
   * there is no cause to fix and refusing to run a script somebody
   * configured on purpose only teaches them to page past the banner. A
   * mixed list takes the failure ending -- there is a real fault in it.
   *
   * AND `deliberate: true` NOW COSTS SOMETHING TO CLAIM. See
   * `SetupScriptGap`: the softer ending is not available to a caller that
   * merely sets a boolean, because a boolean is what the panel's three
   * warnings were -- all of them true, none of them evidence that anybody
   * read one. */
  notProvisioned?: SetupScriptGap[];
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
    generatedAt = new Date().toISOString(),
    wanRoutingMode = "load_balance",
    basicConfigOnly = false,
    notProvisioned = [],
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
  // The DHCP pool and the DHCP network entry are DERIVED FROM THE PREFIX,
  // not from the first three octets of `lanIp` -- see
  // `deriveLanAddressing`'s own docstring for the three reachable-from-the-
  // UI subnets the old octet-slicing got wrong. `lan.ok === false` means
  // the LAN address/prefix pair cannot describe a usable subnet at all, and
  // the Hotspot chunk below refuses to emit a pool rather than inventing
  // one; nothing else in this generator depends on these three values.
  const lan = deriveLanAddressing(lanIp, lanCidr);
  const chunks: RouterSetupScriptChunk[] = [];
  // GUEST-PLANE VERDICTS RUN LAST, AFTER THE MANAGEMENT PLANE IS UP.
  //
  // Three checks in this script `:error` on failure, which under `/import`
  // (the delivery channel the founder actually uses) aborts everything after
  // them. That is right for the WAN and clock checks -- nothing downstream
  // can work without an uplink or a correct clock, and tonight that abort
  // did its job on a factory-reset box with no DNS.
  //
  // It is WRONG for the walled-garden and portal-identity checks, and that
  // was my own mistake in the convergence pass. Both sat before the tunnel,
  // API access and heartbeat chunks, so a venue whose DNS was merely slow at
  // paste time got a router with a broken portal AND no WireGuard tunnel AND
  // no API user AND no check-in -- i.e. nothing to fix it with except a site
  // visit. The portal being wrong is recoverable remotely; the management
  // plane being absent is not. So the WRITES stay where they are (order
  // matters for what they depend on) and only the VERDICTS move here, to run
  // once the router is reachable. Each re-reads the device, so none of them
  // depends on a variable from the chunk it came from.
  const deferredChecks: RouterSetupScriptChunk[] = [];

  // THE BACKSTOP: A GAP IS A PROPERTY OF THE SCRIPT, NOT OF THE CALLER'S
  // MEMORY.
  //
  // `notProvisioned` is handed in by the caller, and that is exactly how
  // this failure survived four fixes: the panel remembered to report the
  // cases somebody had already been bitten by (a throw from the allocate
  // call, a throw from the RADIUS bridge) and had no way to report the one
  // nobody had thought of yet -- an unticked checkbox. The panel now
  // reports that one too, but it reports it because a person edited a
  // second file, and the next omission will be missed the same way this one
  // was. So the generator derives the gaps itself, from `opts`, and the
  // caller's list becomes an ENRICHMENT of that rather than the source of
  // it: whether `/radius add` is in the emitted script does not depend on
  // WHY `opts.radius` is undefined.
  //
  // `lan.ok` is the "this script builds a hotspot" test, and it is the same
  // one the Hotspot chunk itself branches on a few hundred lines below --
  // an unusable LAN prefix means no hotspot is emitted at all, and a script
  // that builds no hotspot is not missing RADIUS, it is a different
  // artifact (the `basicConfigOnly` WAN-repair flow, say). Only a script
  // that DOES stand up a guest network and then cannot authenticate,
  // reach the platform, or serve the venue's own pages has a gap worth
  // stopping for.
  //
  // Caller entries WIN on collision, and that is the whole point of the
  // merge order: the caller knows the cause ("the box was not ticked", "the
  // bridge returned 502") and the `deliberate` flag that decides whether
  // this script `:error`s. A derived-only entry means no caller claimed
  // this gap at all, which is a bug in the caller -- so it is NOT
  // `deliberate`, and it stops the import. Loud is correct there: the
  // alternative is the silence that started all of this.
  const derivedGaps: SetupScriptGap[] = lan.ok
    ? [
        !wireguard && {
          what: "WireGuard tunnel",
          why: "no WireGuard peer was supplied to the generator, so this script builds no tunnel -- the router has no path to the platform a venue firewall cannot close, and RADIUS has no address to source from",
        },
        !radius && {
          what: "RADIUS",
          why: "no RADIUS registration was supplied to the generator, so this script writes no /radius entry -- the hotspot comes up, the portal loads, and every guest login is Access-Rejected with nothing on the router or the hub naming the cause",
        },
        !portalUrl && {
          what: "portal redirect pages",
          why: "no portal URL was supplied to the generator, so the stock MikroTik login page is left in place -- guests are asked for a RouterOS username on a network the venue is paying to brand",
        },
      ].filter((g): g is { what: string; why: string } => g !== false)
    : [];
  const gaps = [
    ...notProvisioned,
    ...derivedGaps.filter((d) => !notProvisioned.some((n) => n.what === d.what)),
  ];

  // FIRST CHUNK, NOT LAST, and only when something is actually missing.
  // An operator pastes top to bottom and stops reading once it is going
  // well; a warning at the end is read after the damage is done. This one
  // is the first thing on screen and the first thing the terminal prints.
  //
  // It configures NOTHING. It exists because the alternative -- a script
  // that is simply one chunk shorter -- is indistinguishable from a
  // complete one, and that is how a router reached a venue with an empty
  // `/radius` and a hotspot that rejected every guest.
  if (gaps.length > 0) {
    // A list that is ENTIRELY deliberate omissions still gets the banner
    // (the operator needs to see, at the venue, that this file was never
    // going to configure RADIUS) but not the `:error`: nothing failed, and
    // there is nothing to go and fix. Any genuine failure in the list makes
    // the whole thing fatal again -- see `notProvisioned`'s own docstring.
    // `isAcknowledgedChoice`, not `g.deliberate === true`. A caller that
    // sets the flag without collecting a typed acknowledgement gets the
    // FAILURE ending, which is the fail-closed direction: the worst
    // outcome of a caller bug is a script that refuses to run, never a
    // script that quietly half-provisions a venue.
    const allDeliberate = gaps.every(isAcknowledgedChoice);
    const lines = [
      `:put "===================================================="`,
      allDeliberate
        ? `:put "  THIS SCRIPT IS PARTIAL BY CHOICE -- READ BEFORE PASTING"`
        : `:put "  THIS SCRIPT IS INCOMPLETE -- READ BEFORE PASTING"`,
      `:put "===================================================="`,
    ];
    for (const gap of gaps) {
      lines.push(`:put "  MISSING: ${escapeForRouterOsString(gap.what)}"`);
      lines.push(`:put "    why: ${escapeForRouterOsString(gap.why)}"`);
      // WHO SAID YES, IN THE ARTIFACT. A `.rsc` outlives the panel and
      // the session that made it; "(by choice)" alone records that a flag
      // was set, not that a human was ever in the loop. The typed string
      // is the only part of this that a caller cannot produce by
      // accident.
      if (isAcknowledgedChoice(gap)) {
        lines.push(
          `:put "    acknowledged: the operator typed '${escapeForRouterOsString(gap.acknowledgement ?? "")}' to switch this off"`,
        );
      }
      // What it actually costs, per subsystem -- an operator cannot weigh
      // "RADIUS is missing" without knowing that it means no guest can log
      // in at all.
      if (/radius/i.test(gap.what)) {
        lines.push(
          `:put "    effect: the hotspot will reject EVERY guest login. RouterOS reports"`,
        );
        lines.push(`:put "            no error for this -- the guest just sees the sign-in fail."`);
      }
      if (/wireguard|tunnel/i.test(gap.what)) {
        lines.push(`:put "    effect: this router will never reach the platform. No heartbeat,"`);
        lines.push(
          `:put "            no Discovery, and it stays 'provisioning' on the dashboard."`,
        );
      }
      if (/api access|device console/i.test(gap.what)) {
        lines.push(`:put "    effect: Device Console stays locked for this router -- no remote"`);
        lines.push(`:put "            command, config push or reboot from the dashboard. Guest"`);
        lines.push(`:put "            WiFi is unaffected, so nothing else will look wrong."`);
      }
      lines.push(
        `:log warning "cloudguest: generated script is missing ${escapeForRouterOsString(gap.what)} -- ${escapeForRouterOsString(gap.why)}"`,
      );
    }
    if (allDeliberate) {
      lines.push(`:put "  Nothing failed -- these were switched OFF in the Advanced panel before"`);
      lines.push(`:put "  this script was generated, so it was never going to configure them."`);
      lines.push(`:put "  This run continues. If that is not what you wanted, tick the boxes and"`);
      lines.push(`:put "  press Generate again."`);
    } else {
      lines.push(`:put "  Fix the cause, press Generate again, and use the NEW script."`);
      lines.push(`:put "  Pasting this one leaves the router half-configured."`);
    }
    lines.push(`:put "===================================================="`);
    // AND THEN STOP. Everything above this is `:put`, which is exactly
    // enough for a technician watching a terminal and exactly nothing for
    // the `/import` path -- output scrolls past unread and the run
    // continues into WAN, hotspot and firewall regardless.
    //
    // That is not hypothetical: the operator's first attempt on
    // 2026-08-27 was a downloaded .rsc with no RADIUS chunk in it, and
    // nothing about running it said so. A router provisioned with
    // silently-absent RADIUS is worse than one not provisioned at all --
    // it looks finished, it serves a captive portal, and every guest
    // login fails with no error anywhere that names the cause.
    //
    // This chunk configures nothing, so aborting costs nothing. Both
    // delivery channels get the behaviour they need from the one line:
    // `/import` and the one-line paste stop here, before anything is
    // touched; a technician pasting chunk by chunk sees a red error on a
    // chunk that was never going to change the device, and simply moves
    // on to the next chunk if they have decided to proceed anyway.
    //
    // ...UNLESS THE GAP IS THE OPERATOR'S OWN DECISION. Then there is no
    // cause to fix and stopping would be theatre: the banner has already
    // said, on the device and in the file's header, exactly what this
    // script does not configure and what that costs. Aborting a run
    // somebody deliberately scoped is how a warning becomes something
    // people learn to click past, which would cost us the one above.
    if (!allDeliberate) {
      lines.push(
        `:error "cloudguest: STOPPING -- this script is INCOMPLETE (${gaps
          .map((g) => escapeForRouterOsString(g.what))
          .join(
            ", ",
          )} missing). Under /import this ends the file HERE -- nothing below this line ran, and nothing on this router was changed by this script. Fix the cause, press Generate again, and import the NEW file."`,
      );
    }
    chunks.push({
      // Keeps the `INCOMPLETE SCRIPT` prefix in both cases on purpose:
      // `chunksToRouterOsScript` keys the downloaded `.rsc`'s header off
      // exactly that prefix, and a deliberately-partial file needs that
      // header just as much -- more, arguably, since it is the one that
      // will not stop by itself.
      label: allDeliberate
        ? `INCOMPLETE SCRIPT (by choice) -- ${gaps.map((g) => g.what).join(" and ")} not included`
        : `INCOMPLETE SCRIPT -- ${gaps.map((g) => g.what).join(" and ")} missing`,
      script: lines.join("\n"),
    });
  }

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
    // COUNT BOTH, DO NOT INFER EITHER. A router reset with the hardware
    // button held long enough comes up with NO default configuration at
    // all: no bridge, no `WAN`/`LAN` interface lists, no defconf firewall,
    // no DHCP client. Both lines above are `:if ([:len [find]] = 0) do={
    // add }`, which is silent when it fires AND silent when it does not,
    // and the `set ... disabled=no` on the line above is the exact
    // `set [find ...]`-against-an-empty-match shape that succeeds with no
    // error while touching nothing. Every chunk below this one binds to
    // one or both of these two objects by name -- the bridge (LAN IP,
    // DHCP server, hotspot, mangle `in-interface=`) and the "WAN" list
    // (the firewall's `in-interface-list=WAN`, the LAN-port sweep's
    // "is this a WAN port" test) -- so if either is missing here, a dozen
    // later `find`s quietly match nothing and the whole paste reports
    // success having built nothing. Printed as a number, on the chunk that
    // is responsible for them, rather than left to be discovered three
    // chunks later as an absence.
    lines.push(
      [
        `:local wanListN [:len [/interface list find where name="WAN"]]`,
        `:local lanBrN [:len [/interface bridge find where name="${lanBridge}"]]`,
        `:put ("  WAN interface list: " . [:tostr $wanListN] . "   LAN bridge ${lanBridge}: " . [:tostr $lanBrN])`,
        `:if ($wanListN > 0 && $lanBrN > 0) do={ :put "  RESULT: PASS -- both exist; the chunks below have something to bind to." }`,
        `:if (!($wanListN > 0 && $lanBrN > 0)) do={ :put "  RESULT: FAIL -- a count above is 0, so this router has no usable base config." }`,
        `:if (!($wanListN > 0 && $lanBrN > 0)) do={ :put "  Every later chunk matches on these two by name, and a find that matches" }`,
        `:if (!($wanListN > 0 && $lanBrN > 0)) do={ :put "  nothing is SILENT on RouterOS -- do not paste further until this says PASS." }`,
        `:if (!($wanListN > 0 && $lanBrN > 0)) do={ :log warning "cloudguest: WAN interface list or LAN bridge ${lanBridge} missing after the WAN + Bridge chunk" }`,
      ].join("; "),
    );
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
    //
    // THE COUNT IS THE POINT, NOT THE REMOVAL. A router reset with no
    // default configuration has no "bridgeLocal" at all, so this `find`
    // matches nothing -- which is the correct outcome, and used to be
    // completely indistinguishable from "matched and removed": an empty
    // `:foreach` is a no-op that prints nothing, exits clean, and leaves
    // the operator to assume from the silence that the duplicate-address
    // fault described above was cleared. It may never have been there.
    // Confirmed safe on both shapes: `:foreach` over an empty find neither
    // errors nor iterates, so this chunk cannot fail on a bare router --
    // it just had no way of saying which of the two things happened.
    // Bound and read on ONE entered line, `:foreach` body one statement.
    const lines = [
      [
        `:local staleDefconfN [:len [/ip dhcp-client find where interface="bridgeLocal"]]`,
        `:foreach staleDefconfClient in=[/ip dhcp-client find where interface="bridgeLocal"] do={ /ip dhcp-client remove $staleDefconfClient }`,
        `:if ($staleDefconfN > 0) do={ :put ("  Removed " . [:tostr $staleDefconfN] . " stale factory-default DHCP client(s) bound to bridgeLocal.") }`,
        `:if ($staleDefconfN > 0) do={ :log info ("cloudguest: removed " . [:tostr $staleDefconfN] . " defconf dhcp-client(s) on bridgeLocal") }`,
        `:if ($staleDefconfN = 0) do={ :put "  DHCP clients on bridgeLocal: 0 found, nothing removed." }`,
        `:if ($staleDefconfN = 0) do={ :put "  Expected, and not a fault: a router reset with NO default configuration" }`,
        `:if ($staleDefconfN = 0) do={ :put "  never had a bridgeLocal for one to sit on. This chunk had nothing to do." }`,
      ].join("; "),
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
        // AND THE STATIC ONE THIS GENERATOR PUT THERE LAST TIME. The sweep
        // above is `dynamic=yes` only, so a STATIC address survives a
        // re-paste forever: change the WAN's IP in Master console,
        // re-paste, and the `add` below lays the new address down BESIDE
        // the old one instead of replacing it. The interface then carries
        // two static addresses, the router answers ARP for both, and which
        // one it sources from is not something the operator chose -- the
        // same one-IP-on-two-places confusion the "bridgeLocal" cleanup
        // chunk documents, arrived at from the other direction, except
        // this one never heals because nothing ever removes it.
        //
        // Removes ONLY entries carrying this generator's own
        // `cloudguest-addr-wan<N>` comment, and only when the address is
        // not the one being configured now -- so an address an operator
        // added by hand is never read or removed, and a healthy re-run is
        // a no-op. Nested one-statement bodies; no `:local` crosses a line.
        lines.push(
          `:foreach ownAddr in=[/ip address find where interface="${iface}" comment="cloudguest-addr-wan${n}"] do={ :if ([/ip address get $ownAddr address] != "${wan.ip}/${wan.cidr}") do={ /ip address remove $ownAddr } }`,
        );
        lines.push(
          `:if ([:len [/ip address find where interface="${iface}" address="${wan.ip}/${wan.cidr}"]] = 0) do={ /ip address add address="${wan.ip}/${wan.cidr}" interface="${iface}" comment="cloudguest-addr-wan${n}" }`,
        );
        // Any OTHER static address on this WAN is somebody's deliberate
        // choice and this script has no business deleting it -- but it is
        // also the difference between "this WAN has the address I
        // configured" and "this WAN has the address I configured plus one
        // I do not know about", which is invisible unless it is counted.
        // Reported, not removed: the same discipline as the local hotspot
        // user sweep in the Hotspot chunk.
        lines.push(
          [
            `:local wan${n}AddrN [:len [/ip address find where interface="${iface}"]]`,
            `:if ($wan${n}AddrN = 1) do={ :put "  WAN${n} (${iface}) carries exactly one address: ${wan.ip}/${wan.cidr}." }`,
            `:if ($wan${n}AddrN != 1) do={ :put ("  WARNING: WAN${n} (${iface}) carries " . [:tostr $wan${n}AddrN] . " addresses, not 1.") }`,
            `:if ($wan${n}AddrN != 1) do={ :put "  A second address on one WAN makes this router answer ARP for both and" }`,
            `:if ($wan${n}AddrN != 1) do={ :put "  source traffic from whichever RouterOS picks. Check /ip address print." }`,
            `:if ($wan${n}AddrN != 1) do={ :log warning "cloudguest: WAN${n} (${iface}) does not carry exactly one address after this paste" }`,
          ].join("; "),
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
    // FIRST: say which RouterOS dialect this chunk is speaking, and check
    // the device agrees. Everything below uses v7's `routing-table=`, and
    // the v6 spelling it replaced does not error on v7 -- it matches
    // nothing, silently (see `ROUTE_MAIN_TABLE_FILTER`). The reverse is
    // just as silent, so a device that is not v7 gets a banner rather than
    // a script that reports success having matched nothing.
    lines.push(buildRouterOsVersionCheckStatements().join("; "));
    // SECOND: on v7 a route cannot enter a routing table that has not been
    // declared, so every `to_wan<N>` table the load-balancing routes below
    // use is created before any of them is added.
    if (wans.length > 1 && wanRoutingMode === "load_balance") {
      lines.push(...routingTablePreambleLines(wans.map((_, idx) => `to_wan${idx + 1}`)));
    }
    // Each WAN that has to WAIT for an asynchronous source (a DHCP lease,
    // a PPPoE session) gets a share of one chunk-wide patience budget
    // rather than its own full ladder. A single-WAN router is unaffected
    // -- it gets the whole budget, exactly as before. What this stops is
    // four WANs stacking four full ladders into one paste and freezing the
    // technician's terminal for over a minute, which reads as a hang and
    // gets the router power-cycled mid-provision.
    const pollingWans = wans.filter((w) => w.mode !== "static").length;
    const pollAttempts = (max: number, delaySeconds: number) =>
      Math.max(
        2,
        Math.min(
          max,
          1 + Math.floor(WAN_GW_POLL_BUDGET_S / (delaySeconds * Math.max(pollingWans, 1))),
        ),
      );
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
      const effIface = wanEffectiveIfs[idx];
      const stmts: string[] = [];
      if (wan.mode === "static") {
        // ESCAPED, not interpolated raw. `wan.gateway` is free text typed
        // into an operator-facing form (see `RouterSetupScriptAdvanced`);
        // a stray `"` or `\` in it used to close this RouterOS string
        // literal early and corrupt the rest of an already very long
        // single-paste line -- the same reason `lanBridge` and every
        // `iface` above go through `escapeForRouterOsString`. An omitted
        // gateway lands here as `""`, which fails `gwOk` below and falls
        // through to the routing-table resolution like any other
        // unresolved WAN, instead of emitting the literal string
        // "undefined" as a gateway.
        stmts.push(`:local wan${n}Gw "${escapeForRouterOsString(wan.gateway ?? "")}"`);
      } else if (wan.mode === "pppoe") {
        const pppoeIface = effIface;
        // PPPoE dial-up is asynchronous in exactly the way a DHCP lease
        // is: `remote-address` on a session still in `dialing`/
        // `authenticating` is not there to read. This used to make ONE
        // attempt and then log "re-paste this chunk once connected",
        // which meant a PPPoE WAN pasted at normal speed routinely got no
        // default route at all on the first pass. Same bounded ladder as
        // DHCP below, same primitive.
        const pppoeExists = `[:len [/interface pppoe-client find where name="${pppoeIface}"]] > 0`;
        const attempt = `:do { :set wan${n}Gw ([/interface pppoe-client monitor [find name="${pppoeIface}"] once as-value]->"remote-address") } on-error={ :set wan${n}Gw "" }`;
        const unresolved = `[:len $wan${n}Gw] = 0 || $wan${n}Gw = "0.0.0.0"`;
        stmts.push(`:local wan${n}Gw ""`);
        stmts.push(`:if (${pppoeExists}) do={ ${attempt} }`);
        stmts.push(
          ...buildBoundedRetryLadder({
            attempt,
            unresolved,
            attempts: pollAttempts(WAN_PPPOE_GW_POLL_ATTEMPTS, WAN_PPPOE_GW_POLL_DELAY_S),
            delay: WAN_PPPOE_GW_POLL_DELAY,
            attemptPrecondition: pppoeExists,
          }),
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
        // with one statement per body, so the retries are written out --
        // once, in `buildBoundedRetryLadder`, shared with the PPPoE branch
        // above and the NTP poll in the clock chunk rather than copied a
        // third time. Each statement is a shape already proven on this
        // hardware, and the total wait (${WAN_DHCP_GW_POLL_ATTEMPTS}
        // attempts, ${WAN_DHCP_GW_POLL_DELAY} apart) is the same order as
        // the 30x1s the loop intended.
        //
        // `/ip dhcp-client` is the FIRST source consulted for a DHCP WAN,
        // not the only one. It is the right first source -- this
        // generator's own dhcp-client carries `add-default-route=no`, so
        // on a first paste there is no default route in the table yet to
        // learn a gateway from, and the lease is the only place the answer
        // exists. But it is a source about a NAMED PORT, and a named port
        // is an assumption: a technician who runs this WAN's DHCP on a
        // VLAN sub-interface, or who renamed the port, or who brought the
        // link up some other way entirely, has a perfectly working uplink
        // that this find matches nothing on. When that happens the routing
        // table below is consulted instead, and it is authoritative for
        // every WAN mode alike.
        const attempt = `:do { :set wan${n}Gw [:tostr [/ip dhcp-client get [find where interface="${iface}"] gateway]] } on-error={ :set wan${n}Gw "" }`;
        const unresolved = `[:len $wan${n}Gw] = 0 || $wan${n}Gw = "0.0.0.0"`;
        stmts.push(`:local wan${n}Gw ""`);
        stmts.push(attempt);
        stmts.push(
          ...buildBoundedRetryLadder({
            attempt,
            unresolved,
            attempts: pollAttempts(WAN_DHCP_GW_POLL_ATTEMPTS, WAN_DHCP_GW_POLL_DELAY_S),
            delay: WAN_DHCP_GW_POLL_DELAY,
          }),
        );
      }
      // `"0.0.0.0" != ""` is TRUE, so the previous guard passed a zero
      // gateway into `/ip route add` -- RouterOS accepts it and silently
      // flags the route Inactive. Reject it explicitly.
      const gwOk = gatewayUsableExpr(`wan${n}Gw`);
      // Nothing used to be said when a gateway failed to resolve: the whole
      // `:if (gwOk) do={...}` block was simply skipped, leaving a WAN with
      // no default route and no trace anywhere that it had been attempted.
      // Same "a silent skip is not a report" posture as the Heartbeat
      // chunk's fetch wrappers.
      //
      // This line is the RAW VALUE, alongside the three diagnoses above,
      // not instead of them -- it says what the variable actually held
      // when it was rejected (`""`, `0.0.0.0`, something unexpected),
      // which none of A/B/C carries. It is deliberately not a generic
      // substitute for them: strip A/B/C and this alone tells a technician
      // nothing about where to look.
      lines.push(
        [
          ...stmts,
          // PARENTHESISED. A concatenation passed as a command ARGUMENT
          // must be wrapped in `( ... )` on RouterOS: without them the
          // console parses `:log warning "<string>"` as a complete command
          // and then hits `. $wan1Gw . "..."` as a second, meaningless
          // command on the same statement -- a hard `syntax error` that
          // aborts THE WHOLE `;`-joined line. Confirmed live on the
          // founder's hEX (2026-08-23): the WAN Routing chunk returned
          // nothing but `error`, so the gateway poll, the plain default
          // route and every routing-mark'd route below it never ran. The
          // router was left with no default route at all -- the exact
          // "no gateway-health signal" state this chunk exists to prevent.
          //
          // This was the ONLY unparenthesised concatenation the generator
          // emitted; every other `:put`/`:log`/`:error` that concatenates
          // (wanExistenceCheckLines, the clock verdict, the heartbeat's
          // three fault traces, every count line) already had them. One
          // site, missed once -- which is precisely why it is now swept
          // for rather than left to review. See section 11.
          `:if (!(${gwOk})) do={ :log warning ("cloudguest: WAN${n} gateway did not resolve (value \\"" . $wan${n}Gw . "\\") -- no route added; re-paste once the link is up") }`,
          // STOP HERE, on this WAN's own line, rather than letting the run
          // continue to the connectivity check two chunks later.
          //
          // THE /import DHCP RACE. `/import file-name=...` never pauses
          // between statements. Chunk-by-chunk pasting hides this entirely
          // -- human typing delay between one paste and the next is more
          // than enough for a DHCP lease to bind -- which is exactly why
          // this only ever bites the downloaded-.rsc path, the one a
          // technician reaches for when they want the job to be reliable.
          //
          // The bounded ladder above already polls for the lease
          // (${WAN_DHCP_GW_POLL_ATTEMPTS} attempts, ${WAN_DHCP_GW_POLL_DELAY} apart), so
          // reaching this line means the lease genuinely never bound
          // within that window, not that we asked too early. Continuing
          // past it produces the confirmed field state: `/ip route` holding
          // `0.0.0.0/0` via `0.0.0.0` flagged `Is` (Inactive), every ping
          // answering "no route to host", and -- because the run carries on
          // -- a fully built hotspot on a box with no internet at all.
          //
          // The connectivity check downstream would also catch this now
          // that it `:error`s, but it reports the SYMPTOM ("ping failed").
          // This reports the CAUSE, naming the interface and the value
          // actually read, at the point it happened. `gwOk` is bound on
          // this same `;`-joined line, so this must stay on it.
          // Deliberately terse. The `:log warning` immediately above already
          // records the raw value and the re-paste hint, and this generator
          // caps an entered line because WinBox's
          // terminal mangles long pastes -- the suite fails the build rather
          // than let that cap be raised. Cause and next step, nothing more.
          `:if (!(${gwOk})) do={ :error "cloudguest: STOPPING -- WAN${n} (${iface}) got no DHCP gateway. Under /import the file ENDS HERE: nothing below ran. Fix the uplink, then import again." }`,
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
          //
          // AND NO `active=yes` HERE, DELIBERATELY -- the one default-route
          // lookup in this generator that does not carry it. Every other
          // one is asking "which uplink is live", where an Inactive route
          // is a trap. This one is asking the opposite question: "is this
          // dst-address+gateway SLOT already occupied", because RouterOS's
          // duplicate-route check is on dst-address+gateway alone and
          // `/ip route add` onto an occupied slot throws "failure: already
          // have such route". An Inactive route occupies the slot exactly
          // as much as an active one does -- a foreign dhcp-client's
          // auto-route on a WAN whose link is momentarily down is the
          // realistic case -- so filtering it out here would skip the
          // adopt branch, fall into the add branch, and turn a silent
          // no-op into a hard error mid-paste. `routing-mark=""` is
          // required and present; `active=yes` would be actively wrong.
          // `scripts/test-setup-script-generator.mjs` pins this: it
          // requires both qualifiers on every default-route lookup EXCEPT
          // this exact shape, and separately requires this shape to exist,
          // so neither the rule nor its one exception can quietly go away.
          `:if (${gwOk} && [:len $plainRoute${n}] = 0) do={ :set plainRoute${n} [/ip route find where dst-address="0.0.0.0/0" gateway=$wan${n}Gw ${ROUTE_MAIN_TABLE_FILTER}] }`,
          `:if (${gwOk} && [:len $plainRoute${n}] = 0) do={ /ip route add dst-address=0.0.0.0/0 gateway=$wan${n}Gw distance=${n} check-gateway=ping comment="cloudguest-plain-wan${n}" }`,
          // Wrapped for the same reason as the fallback line's own adopt
          // branch below: the foreign route this exists to adopt is, in the
          // motivating case, RouterOS's own DHCP-client auto-route, and
          // that one is DYNAMIC. `/ip route set` on a dynamic entry is
          // refused, which unwrapped aborts the rest of this line mid-paste
          // -- taking the routing-mark'd routes after it down with it. The
          // router keeps the default route it already had either way; what
          // is lost is `check-gateway=ping`, and that is what the message
          // names.
          `:if (${gwOk} && [:len $plainRoute${n}] > 0) do={ :do { /ip route set $plainRoute${n} gateway=$wan${n}Gw distance=${n} check-gateway=ping comment="cloudguest-plain-wan${n}" } on-error={ :log warning "cloudguest: WAN${n} default route cannot be modified (likely dynamic, from RouterOS's own DHCP client). Internet works; check-gateway=ping is unset, so ISP health has nothing to read" } }`,
        ].join("; "),
      );

      // ---- SECOND LINE: the routing table, for every WAN mode alike ----
      //
      // A SEPARATE ENTERED LINE, deliberately, for two reasons.
      //
      // 1. SCOPE. Nothing here reads `$wan<N>Gw`; it resolves its own
      //    value from the device. So it does not need to sit on the line
      //    that binds that variable, and it must not -- folding it in took
      //    the DHCP WAN's line from 3.1KB to 5.8KB, nearly double the
      //    longest line this generator has ever emitted, in a file whose
      //    entire chunking discipline exists because WinBox's terminal was
      //    confirmed live to drop characters out of a long paste. Split,
      //    both lines stay under the size that has been shipping.
      // 2. IT IS A DIFFERENT QUESTION. The line above asks the source this
      //    WAN's MODE implies -- the DHCP lease on a named port, the
      //    pppoe-client with a known name, a gateway the operator typed
      //    in. Every one of those is an assumption about where this WAN
      //    lives, and every one can be wrong on a router that is
      //    nonetheless perfectly online: a renamed port, a VLAN or SFP
      //    sub-interface the form never knew about, an ISP that moved, a
      //    static gateway mistyped or left blank. This line asks the
      //    device instead. If there is an ACTIVE default route in the MAIN
      //    table then that route IS how this router reaches the internet
      //    right now, and its next hop IS a usable gateway -- no
      //    assumption involved. It is `buildUplinkDiscoveryStatements`,
      //    the same builder and therefore literally the same qualified
      //    lookups the Heartbeat chunk uses, so "the uplink" cannot mean
      //    two different things in two chunks of one script.
      //
      // ONLY WHEN THE LINE ABOVE PRODUCED NOTHING. The trigger is
      // `[:len [find where comment="cloudguest-plain-wan<N>"]] = 0` -- a
      // fact read off the device, not a variable carried across a line
      // boundary (which would not survive) . So this never fights the line
      // above, never re-points a route that one just set correctly, and is
      // a no-op on every healthy re-run.
      //
      // MATCHED BY INTERFACE, NOT ADOPTED BLIND. On a multi-WAN router the
      // discovered uplink belongs to exactly ONE of the WANs; handing its
      // gateway to a different WAN would build a route that sends WAN2's
      // marked traffic out of WAN1, which is worse than no route at all.
      // So multi-WAN takes it only when the discovered interface IS this
      // WAN's own effective interface. A single-WAN router is the one
      // deliberate exception: there is no other WAN to confuse it with,
      // "the configured name is not what the device uses" is precisely the
      // case this exists for, and the disagreement is logged as a warning
      // rather than absorbed, because the technician needs to know the
      // form does not match the hardware.
      {
        const p = `w${n}f`;
        const disc = `$${p}If`;
        const discGw = `$${p}Gw`;
        const discGwOk = gatewayUsableExpr(`${p}Gw`);
        const matchesThisWan = `${disc} = "${effIface}"`;
        // Single WAN: any resolved uplink is this router's uplink.
        const match = wans.length === 1 ? `${disc} != ""` : matchesThisWan;
        const noRouteYet = `$${p}Have = 0`;
        // HOISTED INTO A BOOLEAN, once, and read six times. The literal
        // guard is ~70 characters and every statement below has to restate
        // it (one statement per `do={}` body, and a `:local` does not
        // survive to the next entered line -- so it must be restated, and
        // it must be restated ON THIS LINE). Written out six times it put
        // this line over the paste-size budget the suite enforces, in a
        // file whose whole chunking discipline exists because WinBox
        // mangles long pastes. `:set` on the same line is a use, not a
        // binding, so the `:local` still sits here with its readers.
        const useIt = `$${p}Use = true`;
        const useItRaw = `${noRouteYet} && ${match} && ${discGwOk}`;
        // `set` deliberately does NOT restate `dst-address` -- the route was
        // found BY its dst-address, and re-setting a key field on an
        // existing route is a change this hardware has never been asked to
        // make.
        const routeProps = `gateway=${discGw} distance=${n} check-gateway=ping comment="cloudguest-plain-wan${n}"`;
        const fallbackStmts: string[] = [
          ...buildUplinkDiscoveryStatements(p, { withGateway: true }),
          `:local ${p}Have [:len [/ip route find where comment="cloudguest-plain-wan${n}"]]`,
          // ADOPT, DON'T ADD-AND-ERROR. The gateway here came OUT of an
          // existing default route, so a route at this exact
          // dst-address+gateway always exists -- and RouterOS's own
          // duplicate check is on dst-address+gateway alone, so a blind
          // `/ip route add` would throw "failure: already have such route"
          // every single time. The existing unmarked route is re-tagged as
          // ours instead, which is what gives it `check-gateway=ping` and
          // therefore gives the dashboard's ISP-health signal something to
          // read. `:local` bound unconditionally (a conditional binding is
          // not a binding) and only filled in when there is a gateway to
          // look one up by; `[:len ""]` is 0, so the add branch below is
          // still correct if it never gets filled.
          // Same `routing-mark=""`-yes / `active=yes`-no reasoning as the
          // adoption find on the line above -- see that comment.
          `:local ${p}Use false`,
          `:if (${useItRaw}) do={ :set ${p}Use true }`,
          `:local ${p}Slot ""`,
          `:if (${useIt}) do={ :set ${p}Slot [/ip route find where dst-address="0.0.0.0/0" gateway=${discGw} ${ROUTE_MAIN_TABLE_FILTER}] }`,
          `:if (${useIt}) do={ :log info ("cloudguest: WAN${n} gateway " . ${discGw} . " taken from the live route on " . ${disc} . " (${wan.mode} lookup found none)") }`,
          `:if (${useIt} && [:len $${p}Slot] = 0) do={ /ip route add dst-address=0.0.0.0/0 ${routeProps} }`,
          // WRAPPED, because the route being adopted here is very often
          // DYNAMIC. The gateway came out of a live default route, and the
          // realistic way a live default route exists that this generator
          // did not create is RouterOS's own dhcp-client auto-route
          // (`add-default-route=yes`, the factory default) -- which is a
          // dynamic entry, and `/ip route set` on a dynamic entry is
          // refused. Unwrapped that is a hard error that aborts the rest of
          // this line mid-paste. Wrapped, the router keeps the working
          // default route it already had and the technician gets told the
          // one thing that is actually lost: `check-gateway=ping`, which is
          // what the dashboard's ISP-health and bandwidth signals read.
          // (`set` refusing a dynamic route is inferred from RouterOS's
          // general treatment of dynamic entries, not verified on this
          // fleet -- so it is written to degrade to a named warning whether
          // the inference is right or wrong.)
          `:if (${useIt} && [:len $${p}Slot] > 0) do={ :do { /ip route set $${p}Slot ${routeProps} } on-error={ :log warning ("cloudguest: WAN${n} route via " . ${disc} . " cannot be modified (likely dynamic, from RouterOS's own DHCP client). Internet works; check-gateway=ping is not set, so ISP health/bandwidth have nothing to read") } }`,
        ];
        if (wans.length === 1) {
          fallbackStmts.push(
            `:if (${noRouteYet} && ${disc} != "" && !(${matchesThisWan}) && ${discGwOk}) do={ :log warning ("cloudguest: WAN1 is configured as \\"${effIface}\\" but the live default route leaves via " . ${disc} . " -- used the live route; re-generate with the real name") }`,
          );
        }
        // ---- three faults that must not collapse into one --------------
        //
        // "no gateway" is three different situations to whoever is standing
        // at the router, and one generic message sends them to the wrong
        // place. Three distinct sentences, so `/log print` alone says which:
        //  A. nothing is routing at all -- cable, link, or ISP.
        //  B. something IS routing, but the interface behind it could not
        //     be named (immediate-gw, gateway-as-name and ARP all failed)
        //     -- a RouterOS-version/link-type problem, not connectivity.
        //  C. the interface is real and known and still has no usable next
        //     hop -- a link that is up and unconfigured, the one of the
        //     three that is usually fixable on the spot.
        fallbackStmts.push(
          `:if (${noRouteYet} && $${p}DefCount = 0) do={ :log warning "cloudguest: no active default route found in main routing table -- WAN${n} has no gateway, no route added" }`,
          `:if (${noRouteYet} && $${p}DefCount > 0 && ${disc} = "") do={ :log warning "cloudguest: active default route found but WAN interface could not be resolved -- WAN${n} has no route" }`,
          `:if (${noRouteYet} && ${disc} != "" && !(${discGwOk})) do={ :log warning ("cloudguest: WAN interface " . ${disc} . " resolved but carries no usable address or gateway -- WAN${n} has no route") }`,
        );
        lines.push(fallbackStmts.join("; "));
      }

      // ---- THIRD LINE: this WAN's routing-table'd load-balance routes ---
      //
      // DERIVED FROM THE PLAIN ROUTE, not from `$wan<N>Gw`. That is what
      // makes this its own line and it is the better design regardless of
      // line length: the plain route is the single record of what this
      // WAN's gateway actually turned out to be, whichever of the two
      // lines above established it -- the mode-specific source, or the
      // routing table. Reading it back means the marked routes CANNOT
      // disagree with the plain one, and it replaces two duplicate copies
      // of this block (one per line above) with one.
      //
      // Load-balance only. Failover-only mode routes entirely on the plain
      // distance-ordered routes and RouterOS's own lowest-active-distance
      // selection, and creates no marked routes at all -- see the cleanup
      // just below, which removes any left by a previous load-balance
      // provisioning of the same router.
      if (wans.length > 1 && wanRoutingMode === "load_balance") {
        // This WAN's own preferred (distance=1) route in its own table --
        // what the PCC mangle rules send this WAN's share of LAN
        // connections into. Crossover backup: the NEXT WAN's table also
        // gets a distance=2 route via this WAN's gateway -- a ring (wan1
        // backs up wan2, ..., last backs up wan1), not every pair, so this
        // stays one route per WAN however many WANs there are instead of
        // growing combinatorially. Two WANs degenerates to mutual backup.
        const nextN = ((idx + 1) % wans.length) + 1;
        const g = `w${n}m`;
        const gwOkM = gatewayUsableExpr(`${g}Gw`);
        const own = `[:len [/ip route find where comment="cloudguest-route-wan${n}"]]`;
        const backup = `[:len [/ip route find where comment="cloudguest-backup-wan${nextN}-via-wan${n}"]]`;
        lines.push(
          [
            `:local ${g}Plain [/ip route find where comment="cloudguest-plain-wan${n}"]`,
            `:local ${g}Gw ""`,
            // `get` on a multi-element find errors; our own comment matches
            // at most one, but the read is wrapped rather than assumed.
            `:if ([:len $${g}Plain] > 0) do={ :do { :set ${g}Gw [:tostr [/ip route get $${g}Plain gateway]] } on-error={ :set ${g}Gw "" } }`,
            `:if (!(${gwOkM})) do={ :log warning "cloudguest: WAN${n} has no usable plain default route, so its load-balancing routes were not created -- guest traffic assigned to this WAN by the mangle rules would have nowhere to go. Fix this WAN's gateway and re-paste this chunk" }`,
            `:if (${gwOkM} && ${own} = 0) do={ /ip route add dst-address=0.0.0.0/0 gateway=$${g}Gw ${ROUTE_TABLE_PROPERTY}="to_wan${n}" distance=1 check-gateway=ping comment="cloudguest-route-wan${n}" }`,
            `:if (${gwOkM} && ${own} > 0) do={ /ip route set [find comment="cloudguest-route-wan${n}"] gateway=$${g}Gw }`,
            `:if (${gwOkM} && ${backup} = 0) do={ /ip route add dst-address=0.0.0.0/0 gateway=$${g}Gw ${ROUTE_TABLE_PROPERTY}="to_wan${nextN}" distance=2 check-gateway=ping comment="cloudguest-backup-wan${nextN}-via-wan${n}" }`,
            `:if (${gwOkM} && ${backup} > 0) do={ /ip route set [find comment="cloudguest-backup-wan${nextN}-via-wan${n}"] gateway=$${g}Gw }`,
          ].join("; "),
        );
      }
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
      // AND THE MARKS THAT POINTED AT THEM. The two sweeps above delete
      // every routing-mark'd route; the "Basic Mangle Rules" chunk is not
      // generated at all in this mode, so nothing else in a failover-only
      // script ever touches `/ip firewall mangle`. A router previously
      // provisioned for load balancing therefore kept its PCC rules, went
      // on marking guest connections `to_wan<N>`, and had no route in any
      // `to_wan<N>` table to carry them -- the exact black hole this
      // chunk's own comment says the mangle/route pair exists to prevent,
      // reached from the other side. Guests came up, got an address,
      // loaded the portal off the router itself, and then nothing beyond
      // it resolved or loaded.
      //
      // Removes only rules carrying this generator's own comment prefix,
      // the same ownership rule as the route sweeps above and the mangle
      // chunk's own. Safe to re-run: an empty find is a no-op foreach.
      lines.push(
        `:foreach r in=[/ip firewall mangle find where comment~"^cloudguest-mangle-"] do={ /ip firewall mangle remove $r }`,
      );
      // Read back rather than assume. A leftover marking rule here is
      // invisible on the router (traffic is marked, routed nowhere, and
      // logged nowhere), so the count is printed either way.
      lines.push(
        [
          `:local foMangle [:len [/ip firewall mangle find where comment~"^cloudguest-mangle-"]]`,
          // Counted by THIS GENERATOR'S OWN COMMENT, not by
          // `routing-table~"^to_wan"`: the property name differs between
          // RouterOS 6 and 7 and a `find where` on a property a route does
          // not carry is not a shape this file has confirmed. The comment
          // prefix is exactly what the two sweeps above match on, so this
          // verifies them directly.
          `:local foMarked [:len [/ip route find where comment~"^cloudguest-(route|backup)-wan"]]`,
          `:put ("  failover-only: load-balancing mangle rules left=" . [:tostr $foMangle] . "   routing-mark'd routes left=" . [:tostr $foMarked])`,
          `:if ($foMangle = 0 && $foMarked = 0) do={ :put "  RESULT: PASS -- no connection is marked for a routing table that has no routes." }`,
          `:if ($foMangle > 0 || $foMarked > 0) do={ :put "  RESULT: FAIL -- a load-balancing leftover survived this failover-only paste." }`,
          `:if ($foMangle > 0) do={ :put "  Guest connections are still being marked to_wan<N> with no route to carry them:" }`,
          `:if ($foMangle > 0) do={ :put "  they get an address and the portal, and nothing past this router." }`,
          `:if ($foMangle > 0 || $foMarked > 0) do={ :log warning "cloudguest: failover-only paste left load-balancing mangle marks or routing-mark'd routes behind -- marked guest traffic has nowhere to go" }`,
        ].join("; "),
      );
    }
    // ---- what this router's uplink ACTUALLY is, now that routing is set --
    //
    // Everything above is per-WAN and speaks in this generator's own
    // logical labels ("WAN1", "WAN2"). This last line asks the device the
    // one question the technician actually has -- WHICH INTERFACE IS
    // CARRYING THE INTERNET, AND ON WHAT ADDRESS -- and answers it from the
    // routing table, using the same builder, the same qualified lookups and
    // the same three-way resolution the Heartbeat chunk uses. If the two
    // ever disagreed, one of them would be lying; sharing the builder is
    // what makes disagreeing impossible.
    //
    // This is also what makes FAILOVER legible. On a re-paste after WAN1
    // has died, the lowest-distance ACTIVE main-table default route is
    // WAN2's, so this prints WAN2's real interface and WAN2's real address
    // -- not "WAN1", which is merely the link that was configured first.
    // The three faults get the same three distinct sentences the per-WAN
    // block above uses, for the same reason: they send a technician to
    // three different places.
    {
      const p = "wanChk";
      const ifResolved = `$${p}If != ""`;
      lines.push(
        [
          ...buildUplinkDiscoveryStatements(p, { withGateway: true }),
          // Same `:foreach` + first-wins as the Heartbeat chunk, and for
          // the same reason: `/ip address get` on a multi-element find
          // errors, and an uplink carrying two addresses is ordinary, not a
          // fault -- erroring there would be reported as "no address",
          // which is a lie.
          `:local ${p}Ip ""`,
          `:if (${ifResolved}) do={ :foreach ${p}A in=[/ip address find where interface=$${p}If] do={ :if ($${p}Ip = "") do={ :set ${p}Ip [:pick [/ip address get $${p}A address] 0 [:find [/ip address get $${p}A address] "/"]] } } }`,
          `:put "  ------------------------------------------------"`,
          `:if (${ifResolved} && $${p}Ip != "") do={ :put ("  LIVE UPLINK: " . $${p}If . "  address " . $${p}Ip . "  gateway " . $${p}Gw) }`,
          `:if (${ifResolved} && $${p}Ip != "") do={ :log info ("cloudguest: live uplink is " . $${p}If . " (address " . $${p}Ip . ", gateway " . $${p}Gw . ", " . [:tostr $${p}DefCount] . " active default route(s))") }`,
          `:if ($${p}DefCount = 0) do={ :put "  LIVE UPLINK: none -- no active default route found in main routing table" }`,
          `:if ($${p}DefCount = 0) do={ :log warning "cloudguest: no active default route found in main routing table -- this router cannot reach the internet; check cabling, the ISP link, and re-paste this chunk" }`,
          `:if ($${p}DefCount > 0 && $${p}If = "") do={ :put "  LIVE UPLINK: unresolved -- a default route is active but its interface could not be named" }`,
          `:if ($${p}DefCount > 0 && $${p}If = "") do={ :log warning "cloudguest: active default route found but WAN interface could not be resolved (immediate-gw, gateway-as-name and ARP all failed) -- routing may still work; report this router's RouterOS version" }`,
          `:if (${ifResolved} && $${p}Ip = "") do={ :put ("  LIVE UPLINK: " . $${p}If . " -- interface resolved but it carries NO usable address") }`,
          `:if (${ifResolved} && $${p}Ip = "") do={ :log warning ("cloudguest: WAN interface " . $${p}If . " resolved but carries no usable address or gateway -- a different fault from having no uplink at all") }`,
        ].join("; "),
      );
      // ---- bind the Wyfy-managed objects to the DISCOVERED interface ---
      //
      // A SECOND LINE, because this one changes configuration rather than
      // reporting it, and because both together are past the paste-size
      // budget. It re-runs the same discovery (a `:local` does not survive
      // to the next entered line, and this is the same builder, so the two
      // lines cannot disagree about which interface they mean).
      //
      // WHY THIS EXISTS AT ALL. "WAN + Bridge" adds the WAN interface-list
      // membership and the NAT masquerade against the interface NAME the
      // operator typed into the form. That name can be wrong -- a renamed
      // port, a VLAN or SFP sub-interface, an ISP that moved -- and when it
      // is, the router ends up with a masquerade rule pointing at an
      // interface carrying no traffic and a WAN list that does not contain
      // the real uplink, which breaks the firewall's own
      // `in-interface-list=WAN` matching. Previously this was a warning
      // telling the technician to re-generate the script. Now the actually
      // live interface is added, so the router is correct on this paste.
      //
      // EVERY OBJECT HERE IS WYFY-MANAGED AND COMMENT-TAGGED. Nothing is
      // removed, nothing not carrying this generator's own comment is read
      // or written, and every add is gated on an explicit count so a
      // re-run updates rather than duplicates. A user's own NAT rules and
      // their own interface-list members are never touched.
      lines.push(
        [
          ...buildUplinkDiscoveryStatements(p, { withGateway: true }),
          // Interface-list membership. Add only if this exact interface is
          // not already a member -- so a WAN whose configured name was
          // right is a no-op here, and no membership is ever duplicated.
          `:local ${p}InList 0`,
          `:if (${ifResolved}) do={ :set ${p}InList [:len [/interface list member find where interface=$${p}If list="WAN"]] }`,
          `:if (${ifResolved} && $${p}InList = 0) do={ /interface list member add list="WAN" interface=$${p}If comment="${DISCOVERED_WAN_LIST_COMMENT}" }`,
          `:if (${ifResolved} && $${p}InList = 0) do={ :log info ("cloudguest: added live uplink " . $${p}If . " to the WAN interface list -- the configured WAN port name is not the interface this router actually uses") }`,
          // NAT masquerade for the live uplink, keyed on THIS generator's
          // own comment so a re-run updates the one rule it owns and never
          // reads, moves or removes a rule anyone else added.
          `:local ${p}Nat [/ip firewall nat find where comment="${DISCOVERED_NAT_COMMENT}"]`,
          `:if (${ifResolved} && [:len $${p}Nat] = 0) do={ /ip firewall nat add chain=srcnat out-interface=$${p}If action=masquerade comment="${DISCOVERED_NAT_COMMENT}" }`,
          `:if (${ifResolved} && [:len $${p}Nat] > 0) do={ :do { /ip firewall nat set $${p}Nat chain=srcnat out-interface=$${p}If action=masquerade } on-error={ :log warning ("cloudguest: could not re-point the Wyfy-managed masquerade at " . $${p}If . " -- guests may not get NAT over the live uplink. Check /ip firewall nat print") } }`,
          `:if (!(${ifResolved})) do={ :log warning "cloudguest: no uplink interface resolved, so the Wyfy-managed WAN list membership and masquerade were left exactly as they are -- nothing was guessed" }`,
          `:put "  ------------------------------------------------"`,
        ].join("; "),
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
    // `"LAN"` -- see `wanExistenceCheckLines`' own `role` docstring. This
    // call used to take the default and name the WAN as the fault.
    lines.push(
      ...wanExistenceCheckLines(
        (lanIfs as string[]).map((lanIf) => `"${lanIf}"`),
        "LAN",
      ),
    );
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
    //
    // THE PPPoE PARENT PORT IS NOT A LAN PORT, AND THE "WAN" LIST DOES NOT
    // KNOW THAT ON A BARE ROUTER. For a PPPoE WAN this generator
    // deliberately puts only the VIRTUAL `cloudguest-pppoe-wan<N>`
    // interface into the "WAN" interface list -- the physical port
    // underneath it is never added, because "WAN + Bridge" cannot add a
    // list member for an interface that does not exist yet (see that
    // chunk's own comment). So the physical port that actually carries the
    // PPPoE session tests as "not a WAN port" here.
    //
    // On a router reset WITH the default configuration that never showed
    // up, because MikroTik's own defconf already contains `/interface list
    // member add interface=ether1 list=WAN` -- defconf, not this script,
    // was what kept the PPPoE parent port out of the guest bridge. Reset
    // the same router with NO default configuration and that membership
    // does not exist, nothing else adds it, and this sweep bridges the
    // live WAN port into the guest LAN: WAN and LAN on one L2 segment,
    // the exact hole `WAN_RENAME_WARNING_HEADER` exists for, arrived at by
    // a third route. It is silent, because bridging a port is a perfectly
    // legal thing to do and RouterOS has no opinion about it.
    //
    // Excluded by LIVE STATE (`/interface pppoe-client find where
    // interface=<port>`), not by a second hardcoded copy of the WAN names
    // -- same reasoning as the "WAN" list test it sits beside, and it
    // additionally covers `basicConfigOnly`, where the technician's own
    // hand-made pppoe-client is the only thing that knows which port is
    // the uplink. By the time this chunk is pasted the client exists: "WAN
    // Addressing" creates it two chunks earlier, and in `basicConfigOnly`
    // the technician made it before the script was ever generated.
    const ethName = `[/interface ethernet get $eth name]`;
    const eligible = [
      `[:len [/interface list member find where interface=${ethName} list="WAN"]] = 0`,
      `[:len [/interface pppoe-client find where interface=${ethName}]] = 0`,
      ...(hasExplicitLan
        ? [`[:len [/interface list member find where interface=${ethName} list="LAN"]] > 0`]
        : []),
    ].join(" && ");
    const lines = [
      `:foreach eth in=[/interface ethernet find] do={ :if (${eligible} && [:len [/interface bridge port find where interface=${ethName} bridge!="${lanBridge}"]] > 0) do={ /interface bridge port remove [find where interface=${ethName} bridge!="${lanBridge}"] } }`,
      `:foreach eth in=[/interface ethernet find] do={ :if (${eligible} && [:len [/interface bridge port find where interface=${ethName}]] = 0) do={ /interface bridge port add bridge="${lanBridge}" interface=${ethName} } }`,
      // COUNT THE RESULT. Both passes above are `:foreach` over a `find`:
      // on an empty or fully-ineligible set they iterate zero times, add
      // nothing, print nothing and exit clean -- identical output to a
      // sweep that worked. The failure that hides in that silence is total,
      // not partial: a guest bridge with no physical port in it carries the
      // LAN address, the DHCP server and the hotspot and serves nobody,
      // because nothing is wired to it. That is the same "no guest device
      // could get an IP at all" symptom this loop was rewritten for once
      // already, so it is now a number the operator reads, printed on the
      // chunk that is responsible for it.
      [
        `:local lanPortsN [:len [/interface bridge port find where bridge="${lanBridge}"]]`,
        `:put ("  Ports now in ${lanBridge}: " . [:tostr $lanPortsN])`,
        `:if ($lanPortsN > 0) do={ :put "  RESULT: PASS -- the guest bridge has at least one physical port." }`,
        `:if ($lanPortsN = 0) do={ :put "  RESULT: FAIL -- NOTHING is bridged into ${lanBridge}." }`,
        `:if ($lanPortsN = 0) do={ :put "  The LAN address, DHCP server and hotspot below will all come up and" }`,
        `:if ($lanPortsN = 0) do={ :put "  serve nobody, because no cable reaches them. No guest gets an IP." }`,
        `:if ($lanPortsN = 0) do={ :put "  Every ethernet port on this board is either in the WAN list, carrying a" }`,
        `:if ($lanPortsN = 0) do={ :put "  PPPoE session, or (with an explicit LAN allowlist) not on it. Check" }`,
        `:if ($lanPortsN = 0) do={ :put "  /interface ethernet print and re-generate naming the real LAN ports." }`,
        `:if ($lanPortsN = 0) do={ :log warning "cloudguest: no bridge port in ${lanBridge} after the LAN Ports chunk -- guests cannot get an address" }`,
      ].join("; "),
      // WHICH ports, by name, not just how many. Port naming varies by
      // board (`ether2`..`ether5` on an hEX is not universal) and this
      // generator never assumes it -- it sweeps whatever
      // `/interface ethernet find` returns. Printing the resulting names is
      // how an operator on a model nobody here has seen confirms the sweep
      // picked the ports they meant, instead of trusting a count that would
      // look identical if it had picked the wrong ones. One statement in
      // the `:foreach` body; no state crosses a line.
      `:foreach lanP in=[/interface bridge port find where bridge="${lanBridge}"] do={ :put ("    LAN port: " . [:tostr [/interface bridge port get $lanP interface]]) }`,
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
      // ALWAYS, INCLUDING basicConfigOnly. This used to be part of the
      // `servers=` line below and fell away with it in basic mode, and the
      // two are not the same kind of setting at all:
      //
      //   servers=              WHICH upstream resolvers this router uses.
      //                         A technician may legitimately want to set
      //                         those by hand -- that is what basic mode is
      //                         for.
      //   allow-remote-requests WHETHER this router answers DNS for the
      //                         devices behind it. Off, it answers nobody.
      //
      // The hotspot chunk further down sets `dns-name` and adds a static
      // `wifi.wyfyguest.com -> lanIp` record, and both are worthless if the
      // router refuses to answer. Worse, the guest's captive-portal probe
      // needs a DNS answer to be intercepted at all -- with this off the
      // probe fails outright, the phone concludes the network is fine, and
      // NO SIGN-IN PAGE EVER POPS UP. Confirmed live 2026-08-23: profile,
      // dns-name, walled-garden and RADIUS were all correct on the device
      // and the portal only appeared if the guest typed the LAN IP by hand.
      //
      // So the resolver switch is emitted unconditionally, exactly like the
      // two WAN-DNS-block firewall rules below and for the same reason: it
      // is not a preference, it is a thing the rest of the script depends
      // on. The WAN-side port 53 drops directly below keep this from
      // meaning an open resolver on the internet.
      `/ip dns set allow-remote-requests=yes`,
      ...(basicConfigOnly
        ? []
        : [
            `/ip dns set servers="${escapeForRouterOsString(dnsServers)}"`,
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
        // Inside the `;`-joined line for the same reason as the Clock + NTP
        // chunk's `:error`: `$pingOk`/`$dnsOk` are bound by the statements
        // above and would be gone on a fresh entered line.
        // HARD STOP -- same reasoning as the Clock + NTP chunk's own
        // `:error` (see there for why the paste and `/import` channels want
        // different behaviour and both get it from this one line).
        //
        // Specific to this check: with no working uplink, the clock cannot
        // sync, `/tool fetch` cannot reach the platform, the portal pages
        // cannot be fetched and the heartbeat cannot register. A hotspot
        // configured on a box with no internet is the worst outcome
        // available -- it serves a captive portal that can never
        // authenticate anyone, which reads to venue staff as "the WiFi is
        // broken" rather than "the uplink was never plugged in".
        `:if (${verdictBad}) do={ :error "cloudguest: STOPPING -- no working WAN uplink (see the ping/DNS lines above). IF YOU RAN THIS AS AN /import FILE, THE FILE ENDS HERE: RADIUS, the WireGuard tunnel, the API user and the heartbeat below this point did NOT run, however finished the router looks. Fix the uplink, then import the SAME file again -- every chunk is idempotent. (Pasting chunk by chunk? Fix it and re-paste just this chunk.)" }`,
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

  if (!lan.ok) {
    // REFUSE, LOUDLY, RATHER THAN INVENT A SUBNET. Everything this chunk
    // creates is keyed on the LAN network and the pool range, and neither
    // can be computed from the address/prefix pair the operator gave. The
    // old code could not reach this state because it never looked at the
    // prefix at all -- it just emitted a `/24`-shaped pool whatever was
    // typed, which is the defect. Emitting nothing here is safe: every
    // object below is created by this chunk alone, so an un-pasted chunk
    // leaves the router exactly as it was, and the label says so in the
    // chunk list before the operator ever opens it.
    const reason = escapeForRouterOsString(lan.reason);
    chunks.push({
      label: "Hotspot -- NOT GENERATED (LAN address/CIDR unusable)",
      script: [
        `:put "===================================================="`,
        `:put "  HOTSPOT + DHCP: NOTHING WAS GENERATED"`,
        `:put "  RESULT: FAIL -- ${reason}."`,
        `:put "  No /ip pool, DHCP server, DHCP network or hotspot is created by this chunk."`,
        `:put "  Fix the LAN IP / LAN CIDR fields in Master console and re-generate."`,
        `:log warning "cloudguest: hotspot chunk not generated -- ${reason}"`,
      ].join("\n"),
    });
  } else {
    const hsUserEsc = escapeForRouterOsString(hsUser);
    const poolRanges = `${lan.poolStart}-${lan.poolEnd}`;
    const lanNetwork = lan.network;
    const lines = [
      `# DHCP pool ${poolRanges} (${lan.poolSize} addresses) inside ${lanNetwork}, gateway ${lanIp}`,
      // SET, NOT JUST ADD. `:if ([:len [find]] = 0) do={ add }` alone is
      // not idempotent for a value that can CHANGE: re-generating after
      // the LAN prefix was corrected leaves the old, wrong `ranges=` in
      // place forever, because the pool still exists and the `add` never
      // fires and nothing else ever rewrites it.
      //
      // Two independent lines, each re-asking the same read-only question,
      // rather than a `:local` shared between them -- the established
      // idiom in this file (see the WAN dhcp branch's own note). It keeps
      // the `add` line's own `[:len [find ...]] = 0` test on the line that
      // does the adding, and it means the `set` is branched on an explicit
      // non-zero count instead of being a bare `set [find ...]` that would
      // succeed silently against an empty match.
      `:if ([:len [/ip pool find where name="hotspot-pool"]] = 0) do={ /ip pool add name="hotspot-pool" ranges=${poolRanges} }`,
      `:if ([:len [/ip pool find where name="hotspot-pool"]] > 0) do={ /ip pool set [find name="hotspot-pool"] ranges=${poolRanges} }`,
      // A DHCP network entry from a PREVIOUS prefix survives a re-paste --
      // it is a different `address=`, so the add-if-missing check below
      // never sees it and never removes it. Two entries then serve the
      // same bridge and RouterOS picks by longest match, so a stale `/24`
      // silently wins over a corrected `/25` and guests keep getting the
      // old gateway. Only entries whose gateway is THIS router's LAN
      // address are touched, so a network entry for any other interface is
      // never read or removed. Nested one-statement bodies, no `:local`
      // crossing a line.
      `:foreach dn in=[/ip dhcp-server network find where gateway=${lanIp}] do={ :if ([/ip dhcp-server network get $dn address] != "${lanNetwork}") do={ /ip dhcp-server network remove $dn } }`,
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
      // DHCP OPTION 114 -- RFC 8910, the Captive-Portal URI.
      //
      // Everything else in this script relies on the guest's device GUESSING
      // that a portal exists: it fetches its own probe URL, the hotspot
      // intercepts it, the redirect is read as "captive". That works on
      // Wi-Fi and is unreliable on a cable -- macOS does not open its
      // Captive Network Assistant for an Ethernet interface at all, so a
      // laptop plugged in with a patch lead gets an address, gets no popup,
      // and looks broken until someone types the address by hand.
      // Confirmed live 2026-08-23 on exactly that: browser-typed worked,
      // nothing appeared on its own.
      //
      // Option 114 removes the guessing. The lease itself says "this
      // network has a captive portal, here it is". Windows 11, macOS 13+,
      // iOS 14+ and Android all read it, and they read it on wired links
      // too. It is additive: a device that ignores 114 still hits the
      // probe-interception path exactly as before, so this can only help.
      //
      // IT POINTS AT THE RFC 8908 API, NOT AT A PAGE. This was wrong when
      // first written, and the mistake is worth keeping visible: option 114
      // does not carry "the portal's address", it carries the address of a
      // Captive Portal API that ANSWERS that question in JSON:
      //
      //     {"captive": true, "user-portal-url": "http://wifi.wyfyguest.com/"}
      //
      // Pointed at an HTML page instead, a conforming client fetches it,
      // fails to parse it as `application/captive+json`, and silently
      // ignores the whole option -- which looks exactly like option 114 not
      // working at all.
      //
      // The backend already serves this at `/captive-portal/rfc8908`, and
      // that endpoint's own docstring says it exists to be reached "via the
      // RFC 8910 DHCP Option 114 URI the Setup Script's DHCP Option 114
      // chunk configures". It was built for this and nothing pointed at it.
      //
      // `portal_url` is still the hotspot's own `dns-name`, and that part
      // was always right: the JSON's `user-portal-url` is where the device
      // is actually sent, and it must be THIS router's redirect page, which
      // carries the $(mac)/$(link-login-only) substitution the portal needs.
      // Sending the device straight to the cloud portal would give it a
      // session it has no way to log into -- see HOTSPOT_DNS_NAME.
      //
      // Reachable before login: the walled-garden IP rule accepts the
      // platform's own address, which is the same box this API is served
      // from, so the fetch succeeds while the guest is still unauthenticated.
      //
      // ADD-OR-UPDATE, not add-if-missing: the value embeds the hotspot
      // hostname, and an option left over from an earlier run with a
      // different one is worse than none -- the device would be sent
      // somewhere this router does not answer.
      `:if ([:len [/ip dhcp-server option find where name="cloudguest-captive-portal"]] = 0) do={ /ip dhcp-server option add name="cloudguest-captive-portal" code=114 value="'${apiBase}/captive-portal/rfc8908?portal_url=http://${HOTSPOT_DNS_NAME}/'" } else={ /ip dhcp-server option set [find name="cloudguest-captive-portal"] code=114 value="'${apiBase}/captive-portal/rfc8908?portal_url=http://${HOTSPOT_DNS_NAME}/'" }`,
      // Attached through an option SET rather than directly, because
      // `/ip dhcp-server network` takes `dhcp-option` as a list and a bare
      // assignment would discard anything already there.
      `:if ([:len [/ip dhcp-server option sets find where name="cloudguest-opts"]] = 0) do={ /ip dhcp-server option sets add name="cloudguest-opts" options=cloudguest-captive-portal } else={ /ip dhcp-server option sets set [find name="cloudguest-opts"] options=cloudguest-captive-portal }`,
      `:if ([:len [/ip dhcp-server network find where address="${lanNetwork}"]] > 0) do={ /ip dhcp-server network set [find where address="${lanNetwork}"] dhcp-option-set=cloudguest-opts }`,
      // Read back. Every line above is an `:if`, and `set [find ...]`
      // against an empty match succeeds silently -- the failure this file
      // has been bitten by six times. A guest with no option 114 is not
      // broken, only back to guessing, so this reports rather than fails.
      [
        `:local optN [:len [/ip dhcp-server option find where name="cloudguest-captive-portal"]]`,
        `:local setN [:len [/ip dhcp-server network find where address="${lanNetwork}" and dhcp-option-set="cloudguest-opts"]]`,
        `:if (($optN > 0) && ($setN > 0)) do={ :put "  Captive-portal DHCP option (114) is set and attached -- wired clients get the portal without guessing." }`,
        `:if ($optN = 0) do={ :put "  NOTE: DHCP option 114 was not created. Guests still reach the portal by probe interception; a cabled laptop may need the address typed by hand." }`,
        `:if (($optN > 0) && ($setN = 0)) do={ :put "  NOTE: DHCP option 114 exists but is not attached to this network, so it will not be handed out." }`,
      ].join("; "),
      // Uses RouterOS's own *stock* hotspot template ("hotspot", not a
      // custom-uploaded one) -- present with all its supporting CSS/error/
      // logout pages on every fresh device out of the box. A previous,
      // one-off custom folder ("cloudguest-hotspot") required manually
      // uploading a whole asset folder that no repeatable script ever
      // covers; only login.html itself needs to be ours (see the "Portal
      // Redirect Page" chunk below), and the stock folder already has
      // everything else login.html depends on.
      `:if ([:len [/ip hotspot profile find where name="hsprof1"]] = 0) do={ /ip hotspot profile add name="hsprof1" hotspot-address=${lanIp} html-directory=hotspot dns-name="${HOTSPOT_DNS_NAME}" }`,
      // COUNT hsprof1 BEFORE ANYTHING SETS A PROPERTY ON IT. The `add`
      // above is `:if ([:len [find]] = 0) do={ add }` -- silent when it
      // fires and silent when it does not -- and the `set [find
      // name="hsprof1"] ...` lines below it succeed against an empty match
      // on RouterOS, writing nothing and reporting nothing. Every one of
      // those properties (login-by, dns-name, and, when the certificate
      // chunk runs, ssl-certificate) is load-bearing for guest login, so a
      // profile that failed to be created takes the whole hotspot down
      // with a console that printed only success.
      //
      // Deliberately its own line ABOVE the sets rather than a guard
      // wrapped around each of them: it covers every property write that
      // follows, including ones this chunk does not own, without any of
      // those lines being edited. That matters right now -- the
      // `login-by=` line below is being worked on in parallel for the
      // self-signed-certificate / `login-by=https` warning, and this guard
      // is deliberately not on it.
      [
        `:local hsProfPre [:len [/ip hotspot profile find where name="hsprof1"]]`,
        `:if ($hsProfPre = 0) do={ :put "  FAIL -- hotspot profile hsprof1 does not exist on this router." }`,
        `:if ($hsProfPre = 0) do={ :put "  The login-by and dns-name settings on the next lines will match NOTHING" }`,
        `:if ($hsProfPre = 0) do={ :put "  and RouterOS will report success anyway. Every guest login then fails." }`,
        `:if ($hsProfPre = 0) do={ :log warning "cloudguest: hsprof1 missing before the hotspot profile property writes -- login-by/dns-name will land on no object" }`,
        `:if ($hsProfPre > 0) do={ :put ("  Hotspot profile hsprof1: " . [:tostr $hsProfPre] . " -- the settings below have something to land on.") }`,
      ].join("; "),
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
      //
      // THE ONLY PLACE IN THIS FILE THAT WRITES `login-by`. It used to be
      // one of two, and the other one won -- see `HOTSPOT_LOGIN_BY`'s own
      // docstring for the guest-facing certificate warning that produced,
      // and for why the value has no `https` in it.
      // STILL ONE `set` OF `login-by`, on one line, with the VALUE decided on
      // the device. The single-writer rule is untouched -- that rule is what
      // stopped two chunks fighting over this property, and it is not what
      // this changes.
      //
      // The gate is NOT "does a certificate object exist". It is "is this
      // profile ALREADY BOUND to the fleet certificate", which is a
      // materially different question and the only safe one. A cert object
      // sitting unbound on the device (imported but never bound, or left
      // over from something else) would let `https` stand up a TLS server
      // against whatever RouterOS picks -- the original bug, re-entered
      // through a side door. Reading `ssl-certificate` off the profile
      // instead means this can only ever PRESERVE a binding the renewal
      // script made; it can never create one.
      //
      // `ssl-certificate` itself is still never written here. That
      // invariant is the reason a re-paste can no longer rebind a router
      // onto a self-signed certificate, and it stays.
      [
        `:local hsBound [:len [/ip hotspot profile find where name="hsprof1" and ssl-certificate~"${HOTSPOT_FLEET_CERT_NAME}"]]`,
        `:local hsLoginBy "${HOTSPOT_LOGIN_BY}"`,
        `:if ($hsBound > 0) do={ :set hsLoginBy "https,${HOTSPOT_LOGIN_BY}" }`,
        `:if ([:len [/ip hotspot profile find where name="hsprof1"]] > 0) do={ /ip hotspot profile set [find name="hsprof1"] login-by=$hsLoginBy }`,
        `:if ($hsBound > 0) do={ :put ("  login-by: https,${HOTSPOT_LOGIN_BY} -- this router already carries the trusted fleet certificate, leaving HTTPS on") }`,
        `:if ($hsBound = 0) do={ :put ("  login-by: ${HOTSPOT_LOGIN_BY} -- no trusted certificate is bound here, so the login page stays plain HTTP") }`,
        `:if ($hsBound = 0) do={ :put ("  That is correct, not a fault: a router-signed certificate would warn every guest before they ever saw the portal.") }`,
      ].join("; "),
      // Same "set fixes an already-existing profile" logic as login-by
      // above, for the address-bar-friendly hostname this profile's own
      // redirect now uses -- see HOTSPOT_DNS_NAME's own docstring for why
      // dns-name and this static record are a pair, not either one alone.
      //
      // GATED ON AN EXPLICIT COUNT, not left as a bare `set [find ...]`.
      // The count block above already reports a missing hsprof1, but
      // reporting is not the same as not doing it: an ungated `set`
      // against an empty match still returns success, so the console shows
      // a warning and then a clean prompt, which reads as "it recovered".
      // Bound and read on ONE entered line, one statement per `do={}`.
      [
        `:local hsDnsProf [:len [/ip hotspot profile find where name="hsprof1"]]`,
        `:if ($hsDnsProf > 0) do={ /ip hotspot profile set [find name="hsprof1"] dns-name="${HOTSPOT_DNS_NAME}" }`,
        `:if ($hsDnsProf = 0) do={ :put "  dns-name=${HOTSPOT_DNS_NAME} was NOT set -- no hotspot profile named hsprof1." }`,
        `:if ($hsDnsProf = 0) do={ :log warning "cloudguest: dns-name not set -- hsprof1 does not exist" }`,
      ].join("; "),
      `:if ([:len [/ip dns static find where name="${HOTSPOT_DNS_NAME}"]] = 0) do={ /ip dns static add name="${HOTSPOT_DNS_NAME}" address=${lanIp} comment="cloudguest-hotspot-dns-name" } else={ /ip dns static set [find name="${HOTSPOT_DNS_NAME}"] address=${lanIp} }`,
      // CONVERGE THE SERVER BIND, not merely its existence.
      //
      // Add-if-missing on `interface=` could never repair three states, each
      // of which breaks every guest login while the old verdict printed PASS:
      //   - `disabled=yes`, e.g. someone toggled it off in WinBox while
      //     debugging and never toggled it back;
      //   - `profile=default` instead of `hsprof1`, which is the worst of the
      //     three -- the RADIUS chunk's `use-radius=yes` then lands on a
      //     profile nothing is bound to, so the hotspot never asks RADIUS
      //     anything and every login fails with the entry looking perfect;
      //   - `address-pool=` repointed at a pool outside the LAN prefix.
      //
      // Keyed on `interface=` because the binding is what matters, and
      // deliberately NOT writing `name=` on an existing server: renaming an
      // object an operator named themselves buys nothing and `name` is not
      // load-bearing here.
      // NO `comment=` on either of these. The `/ip hotspot` SERVER menu has
      // no comment property -- RouterOS rejects the whole statement with
      // `bad parameter comment` and, because this ships as an /import file,
      // the error ABORTS the rest of the script. Confirmed live on a hEX
      // running RouterOS 7.23.3 on 2026-09-01: the import died here at line
      // 75 col 183, so hotspot, RADIUS, WireGuard and heartbeat never ran and
      // the router looked half-provisioned for reasons nothing explained.
      //
      // Nothing is lost by dropping it: both statements key off
      // `interface=`, not the comment, and no other chunk looks for
      // "cloudguest-hotspot". Other menus here DO take comments
      // (walled-garden, firewall filter, dhcp-client, radius, ip-binding) --
      // this is a per-menu quirk, not a rule about /import.
      `:if ([:len [/ip hotspot find where interface="${lanBridge}"]] = 0) do={ /ip hotspot add name="hotspot1" interface="${lanBridge}" address-pool="hotspot-pool" profile="hsprof1" disabled=no }`,
      `:if ([:len [/ip hotspot find where interface="${lanBridge}"]] > 0) do={ /ip hotspot set [find where interface="${lanBridge}"] address-pool="hotspot-pool" profile="hsprof1" disabled=no }`,
      // `hotspot-address` on an ALREADY-EXISTING profile. The `add` above only
      // sets it on a brand-new one, so a router whose LAN IP has since changed
      // kept redirecting guests at an address that is no longer on the device.
      // Same count-gated shape as the `dns-name` write above, for the same
      // reason: `set [find ...]` against an empty match succeeds silently.
      [
        `:local hsAddrProf [:len [/ip hotspot profile find where name="hsprof1"]]`,
        `:if ($hsAddrProf > 0) do={ /ip hotspot profile set [find name="hsprof1"] hotspot-address=${lanIp} }`,
        `:if ($hsAddrProf = 0) do={ :log warning "cloudguest: hotspot-address not set -- hsprof1 does not exist" }`,
      ].join("; "),
      // FIVE OBJECTS THIS CHUNK CREATES, FIVE COUNTS READ BACK. On a
      // router reset with the default configuration, several of these
      // already exist in some form and the `add`s are no-ops. On a router
      // reset with NO default configuration every one of them is created
      // here for the first time -- and every `add` above is wrapped in
      // `:if ([:len [find]] = 0) do={ ... }`, which is silent whether it
      // fired or not. The two unconditional `/ip hotspot profile set [find
      // name="hsprof1"] ...` lines above are worse than silent: `set`
      // against an empty match SUCCEEDS on RouterOS, so if the profile
      // `add` never landed, `login-by=http-pap` and the dns-name both go
      // nowhere and the hotspot rejects every single guest login with
      // nothing anywhere saying why.
      //
      // Same shape as the WireGuard chunk's own final state check: print
      // the five numbers, then a single PASS/FAIL derived from them. Bound
      // and read on ONE entered line; every `do={}` body one statement.
      // A CHECK THAT CANNOT FAIL IS NOT A CHECK. The version that stood
      // here asked only "does an object with the name/address I just used
      // exist?" -- five questions whose answer was fixed by the five `add`
      // lines above them. On a `/25` LAN handing out `.128`-`.254` (the
      // exact defect `deriveLanAddressing` now removes) every one of those
      // counts was non-zero and the chunk printed `RESULT: PASS` at a
      // technician standing next to a router no guest could use.
      //
      // Two of the five reads are now about the CONTENT, not the presence:
      // the pool's actual `ranges=` string, and how many DHCP network
      // entries claim to be this bridge's gateway. Both can be wrong on a
      // router where all five objects exist -- a hand-edited pool, a
      // leftover network entry from an earlier prefix -- and both are the
      // states that actually break guest addressing.
      [
        `:local hsPool [:len [/ip pool find where name="hotspot-pool"]]`,
        `:local hsRanges ""`,
        `:if ($hsPool = 1) do={ :do { :set hsRanges [:tostr [/ip pool get [find name="hotspot-pool"] ranges]] } on-error={ :set hsRanges "" } }`,
        `:local hsDhcp [:len [/ip dhcp-server find where interface="${lanBridge}"]]`,
        `:local hsNet [:len [/ip dhcp-server network find where address="${lanNetwork}"]]`,
        `:local hsNetGw [:len [/ip dhcp-server network find where gateway=${lanIp}]]`,
        `:local hsProf1 [:len [/ip hotspot profile find where name="hsprof1"]]`,
        // NOT a bare presence count. A hotspot server that exists but is
        // disabled, or bound to the wrong profile, serves no one -- and the
        // presence-only form scored those states as PASS, which is exactly
        // the "check that cannot fail" this same block warns about two
        // comments above. The convergence lines above make all three true;
        // this is what proves they did.
        `:local hsSrv [:len [/ip hotspot find where interface="${lanBridge}" profile="hsprof1" disabled=no]]`,
        `:local hsOk ($hsPool = 1 && $hsRanges = "${poolRanges}" && $hsDhcp > 0 && $hsNet = 1 && $hsNetGw = 1 && $hsProf1 > 0 && $hsSrv > 0)`,
        `:put ("  pool=" . [:tostr $hsPool] . " dhcp-server=" . [:tostr $hsDhcp] . " dhcp-network=" . [:tostr $hsNet] . " profile=" . [:tostr $hsProf1] . " hotspot=" . [:tostr $hsSrv])`,
        `:put ("  pool ranges=" . $hsRanges . "   expected=${poolRanges}   (inside ${lanNetwork})")`,
        `:put ("  dhcp networks whose gateway is ${lanIp}: " . [:tostr $hsNetGw] . "   expected=1")`,
        `:if ($hsOk) do={ :put "  RESULT: PASS -- every object exists AND the pool lies inside ${lanNetwork}." }`,
        `:if (!$hsOk) do={ :put "  RESULT: FAIL -- guest WiFi will not work as configured." }`,
        `:if ($hsRanges != "${poolRanges}") do={ :put "  The pool above does not hand out ${poolRanges}. Addresses outside" }`,
        `:if ($hsRanges != "${poolRanges}") do={ :put "  ${lanNetwork} lease fine and then cannot reach this router at all." }`,
        `:if ($hsNetGw > 1) do={ :put "  More than one DHCP network claims gateway ${lanIp} -- a leftover from an" }`,
        `:if ($hsNetGw > 1) do={ :put "  earlier LAN prefix. RouterOS picks by longest match, so the stale one can win." }`,
        `:if ($hsProf1 = 0) do={ :put "  A zero profile= in particular is silent: the login-by and dns-name" }`,
        `:if ($hsProf1 = 0) do={ :put "  set commands above succeed against nothing and every guest login fails." }`,
        `:if (!$hsOk) do={ :log warning "cloudguest: hotspot chunk verdict FAIL -- pool/dhcp-server/network/hsprof1/hotspot incomplete, or the pool does not lie inside ${lanNetwork}" }`,
      ].join("; "),
      // READ `login-by` BACK OFF THE DEVICE, because this is the property
      // that was silently overwritten by a later chunk for the entire
      // life of that chunk and nothing anywhere said so. The count above
      // proves the profile exists; it does not prove what is IN it, and
      // "the paste printed no error" was never evidence of either.
      //
      // `ssl-certificate` is printed beside it deliberately. This
      // generator no longer writes that property at all, so what shows up
      // here is whatever is already on the device -- either `none` (a
      // fresh router, or one this generator built after the self-signed
      // chunk was deleted), the real Let's Encrypt leaf pushed by
      // `ops/letsencrypt-hotspot/renew-hotspot-certs.sh`, or the stale
      // `cloudguest-hotspot-cert` left behind on a router provisioned
      // before this change. With `login-by=http-pap` a stale binding is
      // inert -- RouterOS only brings the hotspot's TLS server up when
      // `login-by` asks for it -- but the operator should be able to SEE
      // that rather than infer it.
      [
        `:local hsLoginByN [:len [/ip hotspot profile find where name="hsprof1"]]`,
        `:if ($hsLoginByN > 0) do={ :put ("  hsprof1 (" . [:tostr $hsLoginByN] . " matched) login-by=" . [:tostr [/ip hotspot profile get [find name="hsprof1"] login-by]] . " ssl-certificate=" . [:tostr [/ip hotspot profile get [find name="hsprof1"] ssl-certificate]]) }`,
        `:if ($hsLoginByN > 0) do={ :put "  login-by must read http-pap. If it reads https and ssl-certificate names a" }`,
        `:if ($hsLoginByN > 0) do={ :put "  cloudguest-* certificate, this router serves its login redirect over TLS with a" }`,
        `:if ($hsLoginByN > 0) do={ :put "  cert it signed itself: Windows and macOS then show NO sign-in popup at all," }`,
        `:if ($hsLoginByN > 0) do={ :put "  Android shows a security warning, and the portal's login POST fails after OTP." }`,
        `:if ($hsLoginByN > 0) do={ :put "  Re-paste this chunk. Do not add https back by hand." }`,
        `:if ($hsLoginByN = 0) do={ :put ("  FAIL -- hsprof1 count is " . [:tostr $hsLoginByN] . ", so the login-by set above landed on nothing.") }`,
        `:if ($hsLoginByN = 0) do={ :put "  RouterOS reports success for a set against an empty match, so nothing else will say so." }`,
        `:if ($hsLoginByN = 0) do={ :put "  Every guest login will be rejected by the hotspot itself. Check /ip hotspot profile print." }`,
        `:if ($hsLoginByN = 0) do={ :log warning "cloudguest: hsprof1 missing -- login-by was not applied to any hotspot profile" }`,
      ].join("; "),
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
    // Labelled from `HOTSPOT_CHUNK_LABEL` rather than a literal because the
    // RADIUS chunk PRINTS this label at an operator who has to go and find
    // this chunk in their list. Renaming it here and nowhere else would
    // leave that instruction pointing at a chunk that no longer exists.
    chunks.push({ label: HOTSPOT_CHUNK_LABEL, script: lines.join("\n") });
  }

  // ===================================================================
  // THE "Self-Signed HTTPS Certificate" CHUNK USED TO BE HERE. IT IS
  // DELETED, AND THIS IS THE RECORD OF WHY -- because the argument for
  // keeping it was "it has been there a long time and somebody added it
  // deliberately", and that turned out to be evidence of nothing.
  // ===================================================================
  //
  // What it did: `/certificate add` + `sign` a `cloudguest-ca` root, then
  // a `cloudguest-hotspot-cert` leaf signed by it with
  // `common-name=wifi.wyfyguest.com`, mark both `trusted=yes`, and bind
  // the leaf onto `hsprof1` with `ssl-certificate=... login-by=https,
  // http-pap dns-name=...`.
  //
  // WHY IT IS GONE, IN THE ORDER THE EVIDENCE ACTUALLY RUNS:
  //
  // 1. THAT BINDING WAS THE GUEST-FACING BUG. It was the SECOND writer of
  //    `login-by` on `hsprof1` and it ran after the Hotspot chunk's
  //    `login-by=http-pap`, so it won. Every router this generator
  //    provisioned served its captive-portal page over TLS with a
  //    certificate the router had signed for itself. Confirmed live on a
  //    real Android phone against a freshly provisioned hEX: a security
  //    warning the instant the portal opened. See `HOTSPOT_LOGIN_BY`.
  //
  // 2. IT WAS NEVER THE FIX FOR THE INCIDENT IT CITED. This chunk's own
  //    comment claimed kinship with the confirmed-live "could not
  //    establish a secure connection" failures of 2026-08-18. Read
  //    `buildWalledGardenLines`'s docstring: that incident was
  //    unauthenticated HTTPS to the REAL portal being caught by the
  //    hotspot's own redirect, "which wraps the connection in the
  //    router's own untrusted self-signed certificate", and it was
  //    confirmed FIXED by `/ip hotspot walled-garden ip add`. This
  //    certificate is the thing that wrapped the connection. Removing it
  //    cannot reintroduce a fault it was on the wrong side of, and the
  //    walled-garden-IP chunk that really fixed it is untouched.
  //
  // 3. ITS OWN STATED REMAINING PURPOSE CONCEDED IT DOES NOT WORK. The
  //    comment's fallback justification was third-party HTTPS a
  //    pre-auth device tries first -- and then admitted, correctly,
  //    "the guest will still see a browser security warning for any
  //    THIRD-PARTY domain either way". A leaf for `wifi.wyfyguest.com`
  //    presented for `www.example.com` is a name mismatch. So the choice
  //    was never "warning vs. no warning", it was "warning vs. a plain
  //    connection failure", and a connection failure is what every OS's
  //    captive-portal detector is built to handle. With no `https` in
  //    `login-by` RouterOS does not stand up a hotspot TLS server to
  //    intercept with at all.
  //
  // 4. NOTHING ELSE ON THE ROUTER REFERENCED EITHER CERTIFICATE. Checked,
  //    not assumed: no other line in this generator names them; the
  //    heartbeat's `/tool fetch` validates against RouterOS's own public
  //    CA store; `/ip service` here only enables the plain API. The
  //    manual-wizard path never creates them at all and provisions
  //    `hsprof1` with `login-by=http-pap` and no `ssl-certificate` --
  //    it was the generator, not the platform, that was the odd one out.
  //
  // 5. THE REAL CERTIFICATE DOES NOT NEED THIS ONE AS A PLACEHOLDER.
  //    `cloud-guest-repo/backend/ops/letsencrypt-hotspot/
  //    renew-hotspot-certs.sh` imports its OWN Let's Encrypt leaf under
  //    its own name and rebinds `ssl-certificate=... login-by=https,
  //    http-pap` in one atomic remote command; its README records that it
  //    leaves the old self-signed objects untouched and that they may
  //    simply be removed. The old "so hsprof1 is never left with NO
  //    certificate" rationale only bites when hotspot HTTPS is being
  //    turned on, which is now exclusively that script's business.
  //
  // 6. A ROUTER-HELD, TRUSTED, CA-CAPABLE KEY IS NOT FREE. `cloudguest-ca`
  //    was created with `key-cert-sign` and marked `trusted=yes` on a
  //    fleet whose SSH credential is shared across routers (that script's
  //    README calls the shared password a known gap). Generating one on
  //    every provision to sign a leaf nothing uses is cost with no
  //    benefit left on the other side.
  //
  // A router provisioned before this change keeps both certificate
  // objects; deleting this chunk removes nothing from any device. With
  // `login-by=http-pap` a leftover binding is inert, and the Hotspot
  // chunk now prints `ssl-certificate` back so an operator can see it
  // rather than infer it.
  //
  // DELIBERATELY NOT DONE HERE: this generator does not write
  // `ssl-certificate` at all any more -- not even to clear it. Clearing
  // it would unbind the real Let's Encrypt leaf on a fleet router on the
  // next re-paste, which is the same class of silent damage this chunk
  // was doing.
  if (portalUrl) {
    // Confirmed live: without this, an unauthenticated guest's browser
    // navigating to the real portal (an ordinary external address as far
    // as the hotspot is concerned) is silently blocked -- that's the whole
    // point of a captive portal, the platform's own server is no
    // exception unless explicitly walled off.
    //
    // ONE chunk, not the two this replaces. See `buildWalledGardenLines`'
    // own docstring: the host-based and address-based tables are one
    // feature, the address-based half is the only one that can pass HTTPS,
    // and as two chunks they were the only two in the whole script that
    // printed nothing at all -- which is how huda city center ran for
    // hours with an empty `walled-garden ip` table and a host entry at
    // HITS: 0 while every guest got a certificate error.
    const walledGarden = buildWalledGardenLines(portalUrl);
    if (walledGarden) {
      const [writes, verdict] = walledGarden;
      chunks.push({
        label: "Walled Garden (let unauthenticated guests reach the portal, HTTP + HTTPS)",
        script: writes,
      });
      // The verdict `:error`s, so it waits for the management plane. See
      // `deferredChecks`.
      deferredChecks.push({
        label: "Walled Garden Check (HTTPS portal reachability -- confirm PASS)",
        script: verdict,
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
    buildPortalOverrideFileSetLines(portalUrl, generatedAt).forEach(({ label, line }) => {
      chunks.push({ label: `Portal Redirect Page (${label})`, script: line });
    });

    // THE RUN STAMP. `/system note` is a single settable string this platform
    // otherwise never touches, and it is the cheapest honest answer to "which
    // generation last completed on this device".
    //
    // It exists because of the gap underneath huda city center: a `.rsc` that
    // fails to import leaves the PREVIOUS run 100% intact, with no signal on
    // the device or on the platform. The one-line paste path already ends with
    // `### cloudguest COMPLETE` precisely so a truncated run is visible; the
    // `.rsc` path had no equivalent, so a router could serve a deleted
    // tenant's portal for hours while every check passed.
    //
    // WHAT IT PROVES, EXACTLY: that THIS chunk ran with THESE ids. It does not
    // prove the files on disk contain them -- those two diverge only when
    // `/file set` matched zero files, which the chunks above already report as
    // FAIL and log. That is a real limitation, stated rather than papered
    // over, and it is why the Portal Identity Check below reads the FILE.
    //
    // FOR THE BACKEND (not done here, deliberately -- this is the frontend
    // half): the heartbeat scheduler already reads a device value at runtime
    // and interpolates it into its JSON body (`$hbIp`, the live WAN IP), so
    // adding `:local hbNote [/system note get note]` and one more field is
    // structurally the same, proven work. With the platform comparing that
    // field against its own record, a router serving the wrong tenant is
    // flagged on the dashboard within 5 minutes with nobody at the venue --
    // which is the difference between this being diagnosable and being
    // impossible.
    chunks.push({
      label: "Portal Stamp (records which generation this device is running)",
      script: [
        `/system note set note="${escapeForRouterOsString(portalMarker(portalUrl, generatedAt))}" show-at-login=no`,
        [
          // `get`, NOT `find`. `/system note` is a single-record settings
          // menu -- like `/system identity` or `/ip dns` -- and `find` is not
          // a command there. Confirmed on RouterOS 7.23.3, hEX:
          //     :put [:len [/system note find]]
          //     bad command name find (line 1 column 26)
          //
          // That is a PARSE error, so `:do/on-error` cannot catch it, and it
          // kills the whole entered line. On the chunk-paste path that is one
          // red line. Under `/import` and the one-line paste it aborts
          // EVERYTHING AFTER THIS CHUNK -- Portal Identity, Firewall, Router
          // Identity, API Access, Tunnel Identity, WireGuard, RADIUS,
          // Heartbeat and the Heartbeat Scheduler. The entire management and
          // authentication plane, on a router that looks provisioned.
          `:local pnV ""`,
          `:do { :set pnV [/system note get note] } on-error={ :set pnV "" }`,
          `:if ([:typeof [:find $pnV "cloudguest-portal r="]] != "nil") do={ :put "  Run stamp written. Read it back any time with: /system note print" }`,
          `:if ([:typeof [:find $pnV "cloudguest-portal r="]] = "nil") do={ :put "  NOTE: the run stamp was not written -- /system note may be unavailable on this board." }`,
          `:if ([:typeof [:find $pnV "cloudguest-portal r="]] = "nil") do={ :log warning "cloudguest: /system note run stamp not written" }`,
        ].join("; "),
      ].join("\n"),
    });

    // Self-contained -- its real value is as a standalone paste on any
    // router someone suspects. It also `:error`s, so it runs with the other
    // deferred checks once the router is remotely reachable rather than
    // stranding it. See `deferredChecks`.
    deferredChecks.push(buildPortalIdentityCheckChunk(portalUrl, generatedAt));
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

  // THE OS SIGN-IN POPUP: A TRIPWIRE, NOT A CONFIGURATION.
  //
  // Every OS decides "am I behind a captive portal?" by fetching one
  // specific plain-HTTP URL and looking at what comes back. Windows NCSI
  // wants `connecttest.txt` to contain exactly `Microsoft Connect Test`;
  // macOS and iOS want `hotspot-detect.html` to contain `Success`;
  // Android wants `generate_204` to answer 204 with an empty body. The
  // popup is what each one does when it gets ANYTHING ELSE -- which, on a
  // correctly configured hotspot, is the hotspot's own 302 to the login
  // page. Nothing has to be configured to make this happen; the hotspot's
  // ordinary HTTP interception already does it, and `HOTSPOT_LOGIN_BY`
  // is what keeps that redirect on a scheme the probes can actually
  // complete (see that constant's own docstring for the three symptoms
  // that appear when it is not).
  //
  // So there is nothing to ADD here, and that is the point of this chunk.
  // What it does is check that nobody has added the one thing that would
  // break it permanently.
  //
  // THE WRONG FIX, WHICH LOOKS EXACTLY LIKE THE RIGHT ONE. Faced with "no
  // sign-in popup", the intuitive move -- and the top answer on every
  // forum -- is to put the OS detection hosts into the walled garden so
  // the probes "can get through". That is backwards. A probe that gets
  // through reaches the real Microsoft/Apple/Google server and gets the
  // genuine success answer it was looking for; the OS concludes the
  // network is fine and never offers a sign-in, while the guest is still
  // unauthenticated with no internet. It is the single change that
  // converts "popup sometimes missing" into "popup permanently gone", and
  // it is unrecoverable by any other setting.
  //
  // The same applies to `/ip dns static`: an entry answering a probe
  // hostname with something the OS accepts is the same defeat by another
  // route.
  //
  // This generator never emits either (swept for over every emitted
  // statement by `test-setup-script-generator.mjs` section 14). This
  // chunk covers the case the generator cannot: a human, or a previous
  // owner of the device, having added one by hand. It counts and reports;
  // it does not delete, because an operator may have added a
  // walled-garden host deliberately for some other purpose and silently
  // removing entries is how this file's own local-hotspot-user bug got
  // interesting.
  {
    const lines = [
      [
        `:local cdWg [:len [/ip hotspot walled-garden find where dst-host~"${CAPTIVE_DETECTION_HOST_PATTERN}"]]`,
        `:local cdDns [:len [/ip dns static find where name~"${CAPTIVE_DETECTION_HOST_PATTERN}"]]`,
        `:put ("  connectivity-check hosts allowed: walled-garden=" . [:tostr $cdWg] . " static-dns=" . [:tostr $cdDns])`,
        `:if ($cdWg = 0 && $cdDns = 0) do={ :put "  RESULT: PASS -- every OS probe is intercepted, so the sign-in popup can fire." }`,
        `:if ($cdWg > 0 || $cdDns > 0) do={ :put "  RESULT: FAIL -- a connectivity-check host is being answered instead of intercepted." }`,
        `:if ($cdWg > 0 || $cdDns > 0) do={ :put "  The OS then gets the success reply it was probing for, decides this network is" }`,
        `:if ($cdWg > 0 || $cdDns > 0) do={ :put "  online, and NEVER shows a sign-in popup -- while the guest still has no internet." }`,
        `:if ($cdWg > 0) do={ :put "  Review and remove: /ip hotspot walled-garden print" }`,
        `:if ($cdDns > 0) do={ :put "  Review and remove: /ip dns static print" }`,
        `:if ($cdWg > 0 || $cdDns > 0) do={ :log warning "cloudguest: a connectivity-check host is allowed pre-auth -- OS captive-portal popups are disabled by it" }`,
      ].join("; "),
    ];
    chunks.push({
      // `--`, not an em dash. Chunk labels are no longer only UI text and
      // `#` comments: both delivery channels now `:put` them back as
      // RouterOS string literals (the flattened paste has since August, the
      // .rsc as of this change), and this was the ONE non-ASCII byte in the
      // entire generated script. Every other label in this generator
      // already spells it `--`. Nothing about UTF-8 in a RouterOS string is
      // known to be broken -- this is simply not the file to find out in,
      // and the fix costs a character.
      label: "Captive-Portal Detection (check only -- nothing here should need changing)",
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
    // SEVEN RULES ADDED, SEVEN COUNTED. Every line above is
    // `:if ([:len [find]] = 0) do={ add }`, silent whether it fired or not,
    // and this chunk printed nothing at all -- one of eight that did. Its
    // failure modes are not cosmetic: no `cloudguest-fw-drop-wan-input` means
    // the router's own services are exposed to the internet, and a WAN
    // interface list that is EMPTY means that rule matches nothing while
    // still existing, which no count of rules would ever reveal. Both are
    // read back here.
    lines.push(
      [
        `:local fwN [:len [/ip firewall filter find where comment~"cloudguest-fw-"]]`,
        `:local fwWanList [:len [/interface list member find where list="WAN"]]`,
        `:put ("  cloudguest firewall rules present: " . [:tostr $fwN] . " of 7")`,
        `:put ("  interfaces in the WAN list: " . [:tostr $fwWanList])`,
        `:if ($fwN >= 7 && $fwWanList > 0) do={ :put "  RESULT: PASS -- the rule set is complete and the WAN list has something in it." }`,
        `:if ($fwN < 7) do={ :put "  RESULT: FAIL -- a rule is missing. Re-paste this chunk and read the count again." }`,
        `:if ($fwN < 7) do={ :log warning "cloudguest: firewall rule set incomplete after paste" }`,
        `:if ($fwWanList = 0) do={ :put "  RESULT: FAIL -- the WAN interface list is EMPTY." }`,
        `:if ($fwWanList = 0) do={ :put "  cloudguest-fw-drop-wan-input matches in-interface-list=WAN, so with an empty" }`,
        `:if ($fwWanList = 0) do={ :put "  list it drops nothing and this router accepts input from its uplink." }`,
        `:if ($fwWanList = 0) do={ :log warning "cloudguest: WAN interface list is empty -- the WAN input drop rule matches nothing" }`,
      ].join("; "),
    );
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

    // ORDER IS THE WHOLE POINT OF THIS CHUNK, AND A PLAIN `add` APPENDS.
    //
    // RouterOS walks `prerouting` top to bottom. The `action=mark-routing`
    // rules match on `connection-mark="wan<N>_conn"`, which only exists
    // because the PCC `action=mark-connection` rules above them set it on
    // the connection's FIRST packet. Put a mark-routing rule above the PCC
    // rule that feeds it and that first packet -- the SYN -- is still
    // `no-mark` when the routing decision is made, so it leaves by the
    // main table's default route instead of its assigned WAN. The reply
    // comes back on the other link, the handshake never completes, and the
    // share of new connections PCC had assigned to any WAN that is not the
    // main-table default simply dies. Nothing on the router reports it.
    //
    // The old sweep could only ever produce that state. It removed the PCC
    // rules (and only for a weighted plan), then re-added them with a plain
    // `add`, which appends to the END of the list -- BELOW the mark-routing
    // rules, which were never removed and so were never re-added. A first
    // paste was correct; the second one silently inverted it. That is the
    // opposite of "safe to re-paste, self-heals", which is this generator's
    // whole idiom.
    //
    // So: sweep every mangle rule this generator owns, unconditionally, in
    // both the weighted and the even-split path, and re-add them in
    // dependency order -- all mark-connection rules first, every
    // mark-routing rule after. Ordering then holds BY CONSTRUCTION on
    // every paste, not just the first. Only rules carrying this
    // generator's own `cloudguest-mangle-` comment are removed, so a
    // hand-written mangle rule is never read or touched. Safe to re-run:
    // an empty find is a no-op foreach.
    lines.push(
      `:foreach r in=[/ip firewall mangle find where comment~"^cloudguest-mangle-"] do={ /ip firewall mangle remove $r }`,
    );

    // Every `:if ... do={ <one add> }` below is emitted on ONE line. The
    // bodies were always single statements; splitting them over three
    // lines only ever relied on the console keeping a brace-opened block
    // together across a paste, which was never verified on this hardware.
    //
    // The `:if ([:len [find]] = 0)` guards are kept even though the sweep
    // above has just emptied the set: if that line alone were somehow not
    // run (a paste truncated between the two, an operator pasting from the
    // middle), these stay idempotent instead of duplicating every rule.
    const markConnectionLines: string[] = [];
    const markRoutingLines: string[] = [];
    wanEffectiveIfs.forEach((wanIf, idx) => {
      const n = idx + 1;
      markConnectionLines.push(
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
          markConnectionLines.push(
            `:if ([:len [/ip firewall mangle find where comment="cloudguest-mangle-pcc-wan${n}-idx${i}"]] = 0) do={ /ip firewall mangle add chain=prerouting in-interface="${lanBridge}" dst-address-type=!local connection-mark=no-mark per-connection-classifier=both-addresses-and-ports:${weightedPlan.total}/${i} action=mark-connection new-connection-mark="wan${n}_conn" passthrough=yes comment="cloudguest-mangle-pcc-wan${n}-idx${i}" }`,
          );
        });
      } else {
        markConnectionLines.push(
          `:if ([:len [/ip firewall mangle find where comment="cloudguest-mangle-pcc-wan${n}"]] = 0) do={ /ip firewall mangle add chain=prerouting in-interface="${lanBridge}" dst-address-type=!local connection-mark=no-mark per-connection-classifier=both-addresses-and-ports:${wanIfs.length}/${idx} action=mark-connection new-connection-mark="wan${n}_conn" passthrough=yes comment="cloudguest-mangle-pcc-wan${n}" }`,
        );
      }
      markRoutingLines.push(
        `:if ([:len [/ip firewall mangle find where comment="cloudguest-mangle-route-wan${n}"]] = 0) do={ /ip firewall mangle add chain=prerouting connection-mark="wan${n}_conn" action=mark-routing new-routing-mark="to_wan${n}" passthrough=yes comment="cloudguest-mangle-route-wan${n}" }`,
      );
    });
    lines.push(...markConnectionLines, ...markRoutingLines);

    // The counts, and the ordering invariant stated in the operator's own
    // terms. `[/ip firewall mangle find]` returns the rule ids in table
    // order, so `:find` on that array is a rule's real row -- the same
    // list RouterOS itself walks, not a restatement of what the lines
    // above intended. A mark-routing rule sitting above the last
    // mark-connection rule is exactly the outage described above, and it
    // is a printed FAIL instead of nothing.
    //
    // THE POSITIONAL HALF IS WRAPPED IN `:do {} on-error={}` AND SAYS SO
    // WHEN IT COULD NOT RUN. `:find` over an array of internal ids is the
    // one thing in this block that has not been confirmed on this
    // hardware, and this file does not ship unverified assumptions
    // silently. If it errors, the ordering verdict degrades to "not
    // verified" and the counts still stand -- rather than taking the whole
    // `;`-joined line down with it, which on a single-line paste would
    // abort every chunk after this one. The ordering itself does not
    // depend on this check: the sweep + ordered re-add above establishes
    // it by construction. This exists to catch the case where THAT did not
    // fully run.
    const expectedMarkConn = markConnectionLines.length;
    const expectedMarkRoute = markRoutingLines.length;
    lines.push(
      [
        `:local mgAll [/ip firewall mangle find]`,
        `:local mgConn 0`,
        `:local mgLastConn -1`,
        `:local mgRoute 0`,
        `:local mgFirstRoute 99999`,
        `:local mgOrderKnown true`,
        `:foreach r in=[/ip firewall mangle find where comment~"^cloudguest-mangle-(input|pcc)-wan"] do={ :set mgConn ($mgConn + 1) }`,
        `:foreach r in=[/ip firewall mangle find where comment~"^cloudguest-mangle-route-wan"] do={ :set mgRoute ($mgRoute + 1) }`,
        `:do { :foreach r in=[/ip firewall mangle find where comment~"^cloudguest-mangle-(input|pcc)-wan"] do={ :if ([:find $mgAll $r] > $mgLastConn) do={ :set mgLastConn [:find $mgAll $r] } } } on-error={ :set mgOrderKnown false }`,
        `:do { :foreach r in=[/ip firewall mangle find where comment~"^cloudguest-mangle-route-wan"] do={ :if ([:find $mgAll $r] < $mgFirstRoute) do={ :set mgFirstRoute [:find $mgAll $r] } } } on-error={ :set mgOrderKnown false }`,
        `:local mgOrdered ($mgOrderKnown = false || $mgLastConn < $mgFirstRoute)`,
        `:local mgOk ($mgConn = ${expectedMarkConn} && $mgRoute = ${expectedMarkRoute} && $mgOrdered)`,
        `:put ("  mark-connection rules=" . [:tostr $mgConn] . " (expected ${expectedMarkConn})   mark-routing rules=" . [:tostr $mgRoute] . " (expected ${expectedMarkRoute})")`,
        `:if ($mgOrderKnown) do={ :put ("  last mark-connection at row " . [:tostr $mgLastConn] . ", first mark-routing at row " . [:tostr $mgFirstRoute]) }`,
        `:if (!$mgOrderKnown) do={ :put "  Rule ORDER could not be read on this RouterOS version -- counts only below." }`,
        `:if ($mgOk && $mgOrderKnown) do={ :put "  RESULT: PASS -- every mark-routing rule sits BELOW every mark-connection rule." }`,
        `:if ($mgOk && !$mgOrderKnown) do={ :put "  RESULT: PASS (counts only) -- rebuilt in order by this chunk, order not re-read." }`,
        `:if (!$mgOk) do={ :put "  RESULT: FAIL -- the load-balancing mangle rules are wrong or out of order." }`,
        `:if (!$mgOrdered) do={ :put "  A mark-routing rule is ABOVE a mark-connection rule. The first packet of" }`,
        `:if (!$mgOrdered) do={ :put "  each new connection is still no-mark at that row, so it leaves by the main" }`,
        `:if (!$mgOrdered) do={ :put "  table instead of its assigned WAN and the handshake never completes." }`,
        `:if (!$mgOk) do={ :put "  Re-paste this whole chunk: its first line clears these rules and rebuilds them in order." }`,
        `:if (!$mgOk) do={ :log warning "cloudguest: multi-WAN mangle rules missing or mis-ordered -- new connections assigned to a non-default WAN will fail" }`,
      ].join("; "),
    );

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
    // BEFORE the tunnel chunk, deliberately: it reports what is on the device
    // as it stands, and (when this script carries no key to re-key with)
    // refuses to let the run continue onto a device the hub will not accept.
    // See `buildTunnelIdentityCheckChunk`'s own docstring for huda city
    // center, where the two ends disagreed for hours with nothing to say so.
    chunks.push(buildTunnelIdentityCheckChunk(wireguard));
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
      // Both private-key lines are conditional on the platform actually
      // HAVING a key to write. When the peer was reused there is none --
      // see `routerPrivateKey`'s own docstring. The interface is still
      // created if missing (a device that has lost it needs one), but with
      // no key: that is a visible, diagnosable half-state, whereas writing
      // a sentinel string would silently break a working tunnel.
      ...(wireguard.routerPrivateKey
        ? [
            `:if ([:len [/interface wireguard find where name="${WIREGUARD_INTERFACE_NAME}"]] = 0) do={ /interface wireguard add name="${WIREGUARD_INTERFACE_NAME}" private-key="${wireguard.routerPrivateKey}" listen-port=13231 }`,
          ]
        : [
            `:if ([:len [/interface wireguard find where name="${WIREGUARD_INTERFACE_NAME}"]] = 0) do={ :put "  NOTE: no ${WIREGUARD_INTERFACE_NAME} interface here, and this script carries no private key" }`,
            `:if ([:len [/interface wireguard find where name="${WIREGUARD_INTERFACE_NAME}"]] = 0) do={ :put "  (the platform reused an existing tunnel). Re-generate with Rotate ticked." }`,
            `:if ([:len [/interface wireguard find where name="${WIREGUARD_INTERFACE_NAME}"]] = 0) do={ :log warning "cloudguest-wg: reused tunnel but the device has no interface -- re-generate with rotation" }`,
          ]),
      // The private key half of the update path (see
      // `buildWireguardPeerLines`' own update branch for the peer half).
      // Every Generate mints a NEW keypair server-side; without this line
      // an already-provisioned router kept its old private key forever
      // while the hub had been told to expect the new public key, so the
      // handshake could never complete and re-pasting repaired nothing.
      ...(wireguard.routerPrivateKey
        ? [
            `:if ([:len [/interface wireguard find where name="${WIREGUARD_INTERFACE_NAME}"]] > 0) do={ /interface wireguard set [find where name="${WIREGUARD_INTERFACE_NAME}"] private-key="${wireguard.routerPrivateKey}" listen-port=13231 }`,
          ]
        : [
            // Listen-port is still asserted -- it is not secret material and
            // an existing interface on the wrong port cannot handshake.
            `:if ([:len [/interface wireguard find where name="${WIREGUARD_INTERFACE_NAME}"]] > 0) do={ /interface wireguard set [find where name="${WIREGUARD_INTERFACE_NAME}"] listen-port=13231 }`,
          ]),
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
      // The tunnel-address half of the update path. The server allocates a
      // fresh tunnel IP on every Generate, so this is the line that made
      // the platform and the device disagree about which address this
      // router answers on -- and it is load-bearing well beyond WireGuard:
      // `register_external_radius_nas` binds the router's FreeRADIUS
      // `client{}` stanza to the tunnel IP the PLATFORM holds. A device
      // still on the previous address sources its RADIUS packets from an
      // IP the hub has no client for, and FreeRADIUS drops them as an
      // unknown client -- silently, with no reply and nothing logged
      // against the router. That is why re-pasting has to converge this.
      //
      // Scoped to addresses on THIS interface only, so a venue that
      // happens to use an overlapping range on a LAN port is untouched.
      // REMOVE-THEN-ADD, not `set` on the whole non-matching set.
      //
      // `set [find where interface=X address!=WANT] address=WANT` is correct
      // only when exactly one row matches. With TWO wrong addresses it writes
      // the same value to both and RouterOS errors `already have such
      // address`, aborting the entered line; with the right address already
      // present alongside a wrong one it collides the same way. Both states
      // are reachable on a router that has been re-provisioned more than once,
      // which is precisely the population this convergence exists for.
      //
      // The `:foreach` + `remove` + `add`-if-missing shape is the one this
      // file already uses for WAN addressing (`cloudguest-addr-wan<n>`), and
      // it is safe for the same reason: scoped to THIS interface only, so a
      // venue that happens to use an overlapping range on a LAN port is never
      // touched. Nothing else on the device owns an address on the tunnel.
      `:foreach wgAddrRow in=[/ip address find where interface="${WIREGUARD_INTERFACE_NAME}"] do={ :if ([:tostr [/ip address get $wgAddrRow address]] != "${wireguard.routerTunnelIp}/24") do={ /ip address remove $wgAddrRow } }`,
      `:if ([:len [/ip address find where interface="${WIREGUARD_INTERFACE_NAME}" address="${wireguard.routerTunnelIp}/24"]] = 0) do={ /ip address add address="${wireguard.routerTunnelIp}/24" interface="${WIREGUARD_INTERFACE_NAME}" }`,
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
    // THE ONE SENTENCE THIS CHUNK PRINTS WHEN IT REFUSES, and the reason it
    // is computed here rather than spelled inline: the honest instruction
    // depends on whether THIS script even contains a chunk that creates
    // `hsprof1`. On a router with an unusable LAN address/prefix pair the
    // Hotspot chunk refuses to emit anything at all (`lan.ok === false`, see
    // its own REFUSE, LOUDLY comment), so "paste the Hotspot chunk" would
    // send the operator to a chunk whose entire body is a FAIL message --
    // a dead end dressed up as a fix, which is worse than the silence this
    // whole change is removing. In that case the real remedy is upstream of
    // the router entirely, and it is the same one the refusing chunk itself
    // prints, word for word.
    const hotspotRemedy = lan.ok
      ? `WHAT TO RUN: paste the ${HOTSPOT_CHUNK_LABEL} chunk from this same script, confirm its RESULT: PASS, then re-paste this chunk.`
      : `WHAT TO RUN: this script has NO chunk that creates hsprof1 -- the ${HOTSPOT_CHUNK_LABEL} chunk was not generated because the LAN address/CIDR cannot describe a usable subnet. Fix the LAN IP / LAN CIDR fields in Master console, re-generate, and paste the new Hotspot chunk before this one.`;
    const lines = [
      // REFUSE TO CREATE `hsprof1`, AND SAY WHERE IT COMES FROM INSTEAD.
      //
      // This line used to be a self-heal: `:if ([:len [find]] = 0) do={ /ip
      // hotspot profile add name="hsprof1" hotspot-address=... html-directory=
      // hotspot dns-name="..." }`, copied from the Hotspot chunk so that the
      // `set`s below always had something to land on regardless of paste
      // order. The copy dropped the half that matters. In the Hotspot chunk
      // that `add` is followed, three lines later, by the ONE `set` in this
      // file that decides `login-by`; here there was no such `set`, so the
      // profile it created kept RouterOS's own default, `cookie,http-chap`
      // -- which the Hotspot chunk's own comment records as rejecting every
      // guest login, confirmed live in Haldwani. The self-heal therefore
      // produced, in precisely the scenario it existed for, a router with a
      // `/radius` entry, `use-radius=yes`, this chunk's verdict printing
      // `RESULT: PASS`, and not one guest able to log in.
      //
      // Appending `login-by=` here is the repair that suggests itself and it
      // is the one `HOTSPOT_LOGIN_BY`'s docstring forbids: a second place in
      // this file with an opinion about this property is the exact shape
      // that shipped a self-signed certificate to every guest. Worse, it
      // would have gone GREEN -- section 13.1's sweep reads `set` and not
      // `add`, measured, so the rule would have been broken in spirit with
      // the guard still passing. That is why section 13.1b now exists and
      // why it grades a model of the device rather than the source text. So
      // creation moves wholly to the chunk that already owns the decision,
      // and this chunk asks instead of assuming.
      //
      // WHAT THE OPERATOR LOSES AND WHAT THEY GAIN. They lose a paste-order
      // convenience that never worked: a profile with no `login-by` is not
      // a working hotspot that RADIUS is merely missing from, it is a
      // hotspot that refuses everyone. They gain a chunk that names the
      // chunk to run, by its exact label, at the top of its own output --
      // and every `set` below is already count-gated, so refusing costs
      // nothing except the writes that would have been meaningless anyway.
      //
      // NOT AN `:error`. The chunk keeps going and still writes `/radius`:
      // that entry is correct, idempotent and useful on its own, and under
      // `/import` an abort here would also take the heartbeat with it --
      // leaving a router that cannot report itself to Master console, which
      // is the one failure that turns a re-paste into a site visit. See
      // section 15.3's ABORT_POLICY for why the aborts this file does have
      // are a written-down decision rather than a habit. The chunk's own
      // closing verdict already reads FAIL in this state, because
      // `use-radius` never landed.
      [
        `:local rdProfPre [:len [/ip hotspot profile find where name="hsprof1"]]`,
        `:if ($rdProfPre > 0) do={ :put ("  Hotspot profile hsprof1: " . [:tostr $rdProfPre] . " -- the RADIUS settings below have something to land on.") }`,
        `:if ($rdProfPre = 0) do={ :put "  FAIL -- no hotspot profile named hsprof1 exists on this router." }`,
        `:if ($rdProfPre = 0) do={ :put "  This chunk deliberately does NOT create one. A profile created here would carry" }`,
        `:if ($rdProfPre = 0) do={ :put "  RouterOS's default login-by (cookie,http-chap), which rejects EVERY guest login" }`,
        `:if ($rdProfPre = 0) do={ :put "  while the router looks fully provisioned. Only the hotspot chunk sets login-by." }`,
        `:if ($rdProfPre = 0) do={ :put "  ${hotspotRemedy}" }`,
        `:if ($rdProfPre = 0) do={ :put "  The /radius entry below is still written -- it is correct on its own and re-pasting is safe." }`,
        `:if ($rdProfPre = 0) do={ :log warning "cloudguest-radius: hsprof1 missing -- refusing to create it here; ${hotspotRemedy}" }`,
      ].join("; "),
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
      //
      // AND IT WRITES `secret=`. This is the half that made rotating the
      // shared secret a no-op on every router that had ever been
      // provisioned. Master console's Generate rotates the RADIUS secret
      // (see `rotatingSecrets`), the operator re-pastes this chunk, the
      // `:if` sees a `/radius` entry already at that address, and the
      // `else` branch set `disabled=no` and NOTHING ELSE -- so the router
      // kept answering with the old secret while the hub had moved to the
      // new one. RouterOS does not report a secret mismatch as a secret
      // mismatch: the hub simply drops the request as unauthentic and the
      // router times out, so every single guest login Access-Rejects with
      // nothing on either side naming the cause. `secret=` on an existing
      // entry is idempotent when it already matches, so this costs a
      // healthy re-paste nothing.
      //
      // `SECRET_REPAIR.radius.repairableByRepaste` moves WITH this line --
      // it is `true` precisely because this branch now writes the secret,
      // and `scripts/test-setup-script-generator.mjs` asserts the two
      // together so neither can drift from the other.
      // REFUSE TO WRITE AN src-address THIS ROUTER DOES NOT HOLD.
      //
      // `src-address=` pointing at an address that is not on the box makes
      // RouterOS source nothing at all -- strictly worse than leaving it
      // unset, because the failure moves from "wrong source IP" to "no
      // packet". The WireGuard chunk runs BEFORE this one and converges the
      // tunnel address, so reaching here without it means that chunk failed,
      // was skipped, or the device is on an identity the platform does not
      // know about. All three are fatal to guest login and all three used to
      // be silent. Say which, and stop.
      [
        `:local rdSrcOk [:len [/ip address find where address="${radius.srcAddress}/24" interface="${WIREGUARD_INTERFACE_NAME}"]]`,
        `:if ($rdSrcOk = 0) do={ :put "  FAIL -- this router does not hold ${radius.srcAddress} on ${WIREGUARD_INTERFACE_NAME}." }`,
        `:if ($rdSrcOk = 0) do={ :put "  RADIUS would be pinned to an address that is not here, and send nothing." }`,
        `:if ($rdSrcOk = 0) do={ :log warning "cloudguest-radius: ${radius.srcAddress} is not on ${WIREGUARD_INTERFACE_NAME} -- refusing to write src-address" }`,
        `:if ($rdSrcOk = 0) do={ :error "cloudguest-radius: STOPPING -- ${radius.srcAddress} is not on ${WIREGUARD_INTERFACE_NAME}. Paste the WireGuard Tunnel chunk, confirm its PASS, then re-paste this one." }`,
      ].join("; "),
      // ADOPT, CREATE, CONVERGE -- three guarded statements keyed on a
      // MARKER, not on a shape.
      //
      // `find where address=...` cannot tell OUR entry from one that merely
      // happens to sit at the same address, which means it can neither adopt
      // safely nor converge `address=` itself when the hub moves. The comment
      // is the same `CGBOOT`-style identification the backend's bootstrap
      // renderer already uses for the tunnel's own rows.
      //
      // Line 1 adopts an entry this generator created before the marker
      // existed, so a re-paste heals a fleet router instead of adding a
      // second `/radius` beside the first (RouterOS tries servers IN ORDER;
      // a stale one first makes every login wait out its timeout).
      `:if ([:len [/radius find where comment="${RADIUS_MARKER}"]] = 0 && [:len [/radius find where address="${radius.serverAddress}"]] > 0) do={ /radius set [find where address="${radius.serverAddress}"] comment="${RADIUS_MARKER}" }`,
      `:if ([:len [/radius find where comment="${RADIUS_MARKER}"]] = 0) do={ /radius add service=hotspot address="${radius.serverAddress}" secret="${escapeForRouterOsString(radius.sharedSecret)}" src-address=${radius.srcAddress} timeout=3s comment="${RADIUS_MARKER}" }`,
      // EVERY FIELD, UNCONDITIONALLY. The `else={}` branch this replaces wrote
      // `secret=` and `disabled=no` and nothing else, so three separate things
      // could never be repaired by a re-paste on an already-provisioned router:
      //   - `service=` -- an entry narrowed to e.g. `ppp` passes the `find`,
      //     gets its secret updated, and is still invisible to the hotspot.
      //   - `timeout=` -- RouterOS's own default is 300ms, confirmed live to be
      //     far too aggressive for a WireGuard-tunnelled path. Every router
      //     provisioned before `timeout=3s` was added kept 300ms forever.
      //   - `address=` -- a hub that moves could never be followed.
      //   - `authentication-port=`/`accounting-port=` -- see below.
      // Re-writing a field that already matches costs a healthy re-paste
      // nothing, which is the whole argument for writing all of them.
      //
      // THE PORTS ARE WRITTEN EXPLICITLY EVEN THOUGH THEY ARE THE DEFAULTS.
      // `service=hotspot` already defaults `authentication-port=1812` and
      // `accounting-port=1813` onto a NEW entry (confirmed live on RouterOS
      // 7.21.5 by the backend's own renderer, whose `RADIUS_AUTH_PORT`/
      // `RADIUS_ACCT_PORT` these mirror), so on the `add` above they change
      // nothing. They exist for the ADOPT path: the first line of this trio
      // takes over an entry that was already sitting at the hub's address
      // without this generator's marker, and an entry this generator did not
      // create can carry anything -- 1645/1646 was the de-facto pair before
      // 1812/1813 and is still what some hand-built configs use. Adopting
      // such a row and then converging every field EXCEPT its ports leaves a
      // router talking to the right hub, with the right secret, from the
      // right source address, on ports nothing is listening on. That fails
      // the same way everything else in this chunk fails: no error, no log,
      // just Access-Requests that are never answered.
      `:if ([:len [/radius find where comment="${RADIUS_MARKER}"]] > 0) do={ /radius set [find where comment="${RADIUS_MARKER}"] service=hotspot address="${radius.serverAddress}" secret="${escapeForRouterOsString(radius.sharedSecret)}" src-address=${radius.srcAddress} authentication-port=1812 accounting-port=1813 timeout=3s disabled=no }`,
      // OPEN THE DOOR THE PLATFORM ALREADY KNOCKS ON. Everything above
      // registers this router so it can ASK the hub a question
      // (Access-Request) and be answered. This line is the other
      // direction: the hub telling an already-authenticated session to
      // change or end, unprompted -- RADIUS Change-of-Authorization and
      // Disconnect-Request, RFC 5176. RouterOS does not listen for those
      // unless it is told to, and "not listening" on a UDP port is not an
      // error anyone sees: the packet arrives, nothing is bound, it is
      // dropped, and the sender is never told.
      //
      // `app/domains/guest/radius_coa.py` builds and sends those packets
      // for real, which is what "Block guest" and "End session" on the
      // customer dashboard actually do. Without this line those two
      // buttons report success, write the intended state server-side, and
      // change NOTHING on the router -- the blocked guest keeps browsing
      // until their session times out on its own. The backend's
      // `render_radius_client` and the gateway's
      // `set_radius_client_config` have both always emitted it; this
      // generator never did, so a router provisioned ONLY from this paste
      // script (the normal path for a new site) was deaf to CoA while
      // looking completely correct -- `/radius` populated, guests logging
      // in, dashboard green.
      //
      // NO `find` GUARD, DELIBERATELY -- and that is not the oversight it
      // looks like next to every other line in this chunk. `/radius
      // incoming` is a SINGLETON settings object, router-global rather
      // than one row per registered server (which is also why it is
      // emitted unconditionally here rather than once per `/radius`
      // entry). There is nothing to count and nothing to duplicate: `set`
      // on it is a plain property write, so a re-paste is a no-op, not a
      // second listener. A `[:len [... find ...]] = 0` guard around it
      // would not be defensive, it would be a `find` against a menu that
      // enumerates nothing -- the silent-empty-match shape this file is
      // full of warnings about.
      `/radius incoming set accept=yes port=${RADIUS_COA_PORT}`,
      // COUNT-GATED, not a bare `set [find ...]`. The read-back below already
      // reports a missing hsprof1, but reporting is not the same as not doing
      // it: an ungated `set` against an empty match returns success, so the
      // console shows a warning and then a clean prompt, which reads as "it
      // recovered". Same shape as the `dns-name` write in the Hotspot chunk.
      [
        `:local rdUseProf [:len [/ip hotspot profile find where name="hsprof1"]]`,
        `:if ($rdUseProf > 0) do={ /ip hotspot profile set [find name="hsprof1"] use-radius=yes radius-accounting=yes }`,
        `:if ($rdUseProf = 0) do={ :log warning "cloudguest: use-radius not applied -- hsprof1 does not exist" }`,
      ].join("; "),
      // NOTHING IN THIS CHUNK CREATES `hsprof1` ANY MORE, so the count is
      // read back at the end as well as at the start. The two reads are not
      // redundant: the opening one tells the operator what to go and paste
      // before they have watched twenty lines of RADIUS output scroll past,
      // and this one is what the machine-readable verdict is computed from.
      // Between them an operator can still remove the profile in WinBox
      // mid-paste, and the state that produces -- a `/radius` entry
      // configured and a hotspot that never asks it anything -- is exactly
      // the one that used to print nothing at all. Read it back, both ways.
      // READ BACK THE CONTENT, NOT THE PRESENCE. A check that only asked
      // "does a /radius entry exist" would have printed PASS on every router
      // this chunk has ever mis-configured: the entry existed, at the right
      // address, with the right secret, and guests still could not log in
      // because nothing was sourcing from the address the hub had registered.
      // `src-address` is read off the object itself, not inferred.
      [
        `:local rdProf [:len [/ip hotspot profile find where name="hsprof1"]]`,
        `:local rdN [:len [/radius find where comment="${RADIUS_MARKER}" address="${radius.serverAddress}" disabled=no]]`,
        `:local rdSrcNow ""`,
        `:do { :set rdSrcNow [:tostr [/radius get [:pick [/radius find where comment="${RADIUS_MARKER}"] 0] src-address]] } on-error={ :set rdSrcNow "" }`,
        `:local rdUse [:len [/ip hotspot profile find where name="hsprof1" use-radius=yes]]`,
        `:local rdOther [:len [/radius find where comment!="${RADIUS_MARKER}"]]`,
        `:local rdOk ($rdN > 0 && $rdSrcNow = "${radius.srcAddress}" && $rdUse > 0)`,
        `:put ("  radius entry=" . [:tostr $rdN] . "   src-address=" . $rdSrcNow . " (expected ${radius.srcAddress})")`,
        `:put ("  hsprof1 profiles=" . [:tostr $rdProf] . "   of which use-radius=yes: " . [:tostr $rdUse])`,
        `:if ($rdOk) do={ :put "  RESULT: PASS -- registered, enabled, sourcing from this router's tunnel IP, and the hotspot asks it." }`,
        `:if (!$rdOk) do={ :put "  RESULT: FAIL -- a value above is wrong. No guest will authenticate." }`,
        // WORDED AS "SKIPPED", NOT "LANDED ON NOTHING". It used to say the
        // latter, which was already only half true (the `use-radius` write
        // is count-gated) and is now flatly false: nothing was attempted
        // against a missing profile, and nothing was created to stand in for
        // one either. An operator who reads "landed on nothing" goes looking
        // for a write that failed; the actual next step is a chunk they have
        // not pasted, so say that instead -- and say it with the same label
        // the chunk list shows them.
        `:if ($rdProf = 0) do={ :put "  No hotspot profile named hsprof1 exists, so use-radius was SKIPPED, not applied." }`,
        `:if ($rdProf = 0) do={ :put "  ${hotspotRemedy}" }`,
        `:if ($rdN = 0) do={ :put "  No enabled /radius entry carries the ${RADIUS_MARKER} marker at ${radius.serverAddress}." }`,
        `:if ($rdSrcNow != "${radius.srcAddress}") do={ :put "  src-address is not this router's tunnel IP, so the hub sees an unknown client:" }`,
        `:if ($rdSrcNow != "${radius.srcAddress}") do={ :put "  the request is dropped with no reply and nothing logged, secret irrelevant." }`,
        `:if (!$rdOk) do={ :log warning "cloudguest: RADIUS chunk verdict FAIL -- entry/src-address/use-radius incomplete" }`,
        // Report, never remove: another entry may be the venue operator's own,
        // and this script does not own objects it did not create.
        `:if ($rdOther > 0) do={ :put ("  NOTE: " . [:tostr $rdOther] . " other /radius entr(y/ies) exist here. RouterOS tries servers IN ORDER -- a dead one first makes every login wait out its timeout.") }`,
      ].join("; "),
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
      // Byte-identical to the scheduler's stored copy below before that copy's
      // extra `escapeForRouterOsString` pass -- same program, one builder, no
      // chance of the two drifting. The suite asserts exactly that, and caught
      // an attempt here to append a verdict onto this chunk: the two copies
      // drifted immediately, and the extra statements pushed the line past the
      // 3300-char paste cap as well. The verdict lives in its own chunk
      // instead (`Heartbeat Check`), re-deriving the uplink for itself rather
      // than borrowing variables across a boundary the console does not carry
      // them over.
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
    // Its own scheduler, on its own line, for the reasons in
    // `buildAuthorizedMacStatements`' docstring. Removed-and-re-added like
    // the heartbeat's so a re-paste replaces a stale agent credential
    // instead of leaving the old one running forever.
    chunks.push({
      label: "Guest Access Sync (opens the gate for guests who signed in)",
      script: [
        // Run once, right now, before arming the timer -- the same
        // "check in now, then schedule it" shape the heartbeat above
        // uses. A technician standing at the venue should not have to
        // wait a full interval to see whether this works, and any guest
        // already signed in gets their gate opened immediately.
        buildAuthorizedMacStatements({ apiBase, agentCredential }),
        `:local existingAmSched [/system scheduler find name="cloudguest-authmac-sched"]; :if ([:len $existingAmSched] > 0) do={ /system scheduler remove $existingAmSched }`,
        `/system scheduler add name="cloudguest-authmac-sched" interval=1m start-time=startup on-event="${escapeForRouterOsString(buildAuthorizedMacStatements({ apiBase, agentCredential }))}"`,
      ].join("\n"),
    });
  }

  // THE GUEST DATA PATH -- the failure nobody had modelled until tonight.
  //
  // At huda city center the guest authenticated, got 10.5.50.250, loaded the
  // portal, and had NO INTERNET, because no masquerade rule existed. Every
  // check in this script passed: the hotspot was bound, the profile correct,
  // RADIUS accepted, the tunnel was up, the router itself could ping out.
  // The router pinging out is exactly the thing that does not need NAT, so
  // the WAN Connectivity Check could never have caught this.
  //
  // This generator DOES emit masquerade (three sites: static WAN, PPPoE, and
  // the discovered-uplink path) -- but nothing anywhere read it back. That is
  // the second shape of gap: not "wrong logic", but "emitted and never
  // verified". Read-only, so it is safe to run on any device at any time,
  // and it is the one check that speaks for the guest rather than the router.
  //
  // Keyed on `chain=srcnat action=masquerade` GENERALLY, not on this
  // generator's own comments: a rule an operator added by hand is a
  // perfectly good rule, and the question here is "can guests reach the
  // internet", not "did we write it".
  deferredChecks.push({
    label: "Guest Data Path (can an authenticated guest actually reach the internet)",
    script: [
      `:put "===================================================="`,
      `:put "  GUEST DATA PATH CHECK"`,
      [
        `:local gdNat [:len [/ip firewall nat find where chain=srcnat action=masquerade]]`,
        `:local gdOurs [:len [/ip firewall nat find where chain=srcnat action=masquerade comment~"cloudguest-nat"]]`,
        `:local gdWan [:len [/interface list member find where list="WAN"]]`,
        `:put ("  srcnat masquerade rules=" . [:tostr $gdNat] . " (of which this platform's: " . [:tostr $gdOurs] . ")   WAN list members=" . [:tostr $gdWan])`,
        `:if ($gdNat > 0 && $gdWan > 0) do={ :put "  RESULT: PASS -- traffic leaving this router is masqueraded and the WAN list is populated." }`,
        `:if ($gdNat = 0) do={ :put "  RESULT: FAIL -- NO srcnat masquerade rule exists on this router." }`,
        `:if ($gdNat = 0) do={ :put "  Guests will sign in successfully, get an address, load the portal, and then" }`,
        `:if ($gdNat = 0) do={ :put "  have no internet at all. Nothing else in this script detects that, because" }`,
        `:if ($gdNat = 0) do={ :put "  the router's OWN traffic does not need NAT and every other check passes." }`,
        // Deliberately NOT a runnable command inside a printed string. Two of
        // this project's own guards fire on that shape -- the "every add
        // carries an existence test" sweep and the `:put` concatenation scan
        // -- and both are right that RouterOS text in a message is
        // indistinguishable from RouterOS text meant to run.
        `:if ($gdNat = 0) do={ :put "  Fix: create a srcnat masquerade rule for the WAN interface list, or" }`,
        `:if ($gdNat = 0) do={ :put "  re-paste the WAN Addressing and WAN Routing chunks, which make one per uplink." }`,
        `:if ($gdNat = 0) do={ :log warning "cloudguest: no srcnat masquerade -- authenticated guests have no internet" }`,
        `:if ($gdNat > 0 && $gdWan = 0) do={ :put "  RESULT: FAIL -- masquerade exists but the WAN interface list is EMPTY." }`,
        `:if ($gdNat > 0 && $gdWan = 0) do={ :put "  Any rule written against out-interface-list=WAN matches nothing, so this" }`,
        `:if ($gdNat > 0 && $gdWan = 0) do={ :put "  router may still NAT via a name that no longer carries the uplink." }`,
        `:if ($gdNat > 0 && $gdWan = 0) do={ :log warning "cloudguest: WAN interface list empty -- out-interface-list rules match nothing" }`,
      ].join("; "),
      `:put "===================================================="`,
    ].join("\n"),
  });
  // THE HEARTBEAT REPORTS NOTHING, so this reports for it.
  //
  // Every diagnostic in `buildHeartbeatStatements` is a `:log warning` and
  // nothing else, so that chunk printed NOTHING -- including when `/tool
  // fetch` failed outright. Its own push-site comment claimed "each paste
  // reports on its own"; that was aspiration, not behaviour. The state it
  // hides is the worst-shaped one this platform produces: the router serves
  // guests perfectly and is INVISIBLE on the dashboard, which reads as a
  // platform fault rather than a device one and has cost days before.
  //
  // A SEPARATE CHUNK that re-derives the uplink, not an append onto the
  // heartbeat's own line. That chunk and the scheduler's stored copy must stay
  // byte-identical, and the console runs each entered line as its own program,
  // so borrowing `$hbIf`/`$hbIp` was never possible either. Re-walking the
  // route table costs nothing and makes this pasteable on its own, against any
  // router, at any time.
  //
  // Fetch success itself is deliberately NOT claimed. `/tool fetch
  // output=none` leaves no artefact on the device to read back, so this
  // reports what resolved and sends the operator to the one place that knows.
  deferredChecks.push({
    label: "Heartbeat Check (confirm this router actually appears online)",
    script: [
      `:put "===================================================="`,
      `:put "  HEARTBEAT / UPLINK REPORT"`,
      [
        ...buildUplinkDiscoveryStatements("hbc"),
        `:local hbcIp ""`,
        `:if ($hbcIf != "") do={ :foreach hbcA in=[/ip address find where interface=$hbcIf] do={ :if ($hbcIp = "") do={ :set hbcIp [:pick [/ip address get $hbcA address] 0 [:find [/ip address get $hbcA address] "/"]] } } }`,
        `:put ("  uplink interface=" . $hbcIf . "   address=" . $hbcIp)`,
        `:if ($hbcDefCount = 0) do={ :put "  RESULT: FAIL -- no ACTIVE default route, so this router has no uplink." }`,
        `:if ($hbcDefCount > 0 && $hbcIf = "") do={ :put "  RESULT: FAIL -- a default route exists but its interface did not resolve." }`,
        `:if ($hbcIf != "" && $hbcIp = "") do={ :put "  RESULT: FAIL -- the uplink carries no IPv4 address." }`,
        `:if ($hbcIf != "" && $hbcIp != "") do={ :put "  RESULT: PASS (device side) -- an uplink resolved and the check-in was sent." }`,
        `:put "  NOW CONFIRM IT LANDED: this router must show ONLINE in Master console."`,
        `:put "  If it does not, the fetch failed on clock, TLS or DNS. Read the log with"`,
        `:put "  /log print where message~cloudguest"`,
        `:put "  A router that serves guests fine but never checks in looks like a platform"`,
        `:put "  fault and is not one. Do not hand the venue over until it shows online."`,
      ].join("; "),
      `:put "===================================================="`,
    ].join("\n"),
  });
  // WITHIN THE DEFERRED BLOCK: EVERY READ-ONLY REPORT FIRST, EVERY HARD
  // STOP LAST.
  //
  // Two of these four checks `:error` (Walled Garden, Portal Identity) and
  // two are pure read-back with nothing that can abort (Guest Data Path,
  // Heartbeat Check). In source order the two aborting ones came first, so
  // under `/import` -- where an `:error` ends the run -- a venue whose
  // portal DNS was merely slow at import time lost the two verdicts that
  // answer the questions the operator is standing there to answer: "can a
  // guest actually reach the internet" and "does this router appear online".
  // Both are free to run and both are exactly what someone needs in order
  // to decide what the portal failure even means.
  //
  // This is the same argument that moved these four to the end of the
  // script in the first place (see `deferredChecks`' own comment above): a
  // stop must not cost information that was already paid for. Applied one
  // level down, it says the stops go last. The partition is stable, so the
  // relative order inside each half is unchanged, and it is derived from
  // the chunk text rather than from a hand-kept list -- a check that gains
  // or loses an `:error` later moves on its own instead of silently
  // landing in the wrong half.
  // `\b`, not `":error "`. A substring test with a trailing space silently
  // misses `:error"..."` -- legal RouterOS, and one keystroke away -- which
  // would put a chunk that CAN stop the import into the "cannot abort" half
  // and undo this partition without failing anything. Same predicate shape
  // the suite's own ABORT_POLICY sweep uses, so the two cannot disagree
  // about what "this chunk can abort" means.
  const canAbort = (c: RouterSetupScriptChunk) => /:error\b/.test(c.script);
  chunks.push(...deferredChecks.filter((c) => !canAbort(c)));
  chunks.push(...deferredChecks.filter(canAbort));
  return chunks;
}

/** Turns a failed hub allocation into something an operator can act on.
 *
 * "Failed to create tunnel" was the entire previous error surface, and it
 * was worse than useless here: the two failures that actually happen --
 * the hub bridge being unreachable, and the backend refusing a
 * platform-generated keypair -- have completely different responses, and
 * the backend already spells each of them out. THE BACKEND'S OWN MESSAGE IS
 * ALWAYS PREFERRED. This only frames it, and only invents text when there
 * genuinely is none.
 *
 * Note on where these messages come from: `HubBridgeUnavailableError`
 * subclasses `CloudGuestError`, not `WireGuardError`, so it flows through
 * the shared `cloudguest_error_handler` and its `message` reaches
 * `AppError.message` intact -- but code catching `WireGuardError` will not
 * see it. That is a real, separate backend trap; see the note on
 * `hub_reconciliation/tasks.py`. */
function describeHubAllocationFailure(err: unknown, action: string): string {
  const e = err as AppError | undefined;
  const detail = e?.message?.trim();

  // No response at all -- the browser never got one. Nothing was allocated,
  // so this is safe to retry, and saying so matters: the operator's instinct
  // on a failed allocate is to click again, and on THIS endpoint clicking
  // again is normally the expensive thing to do.
  if (e?.status === null || e?.code === "network_error") {
    return `Couldn't ${action}: this console could not reach the platform at all, so nothing was allocated. Retry is safe.`;
  }
  // The backend's own 502 for the hub bridge -- `allocate_external_wireguard_peer`
  // raises it both when httpx cannot connect AND when the bridge answers a
  // real >=400, and in the latter case `detail` is the bridge's own words,
  // the only description of the failure that exists anywhere (the agent's
  // `log_message` is a deliberate no-op, so nothing reaches the hub's
  // journal either).
  if (e?.status === 502 || e?.status === 503 || e?.status === 504) {
    return (
      detail ||
      "The WireGuard hub bridge could not be reached and gave no reason. The tunnel was not allocated."
    );
  }
  // 409 here is almost certainly `HubCannotLearnPlatformKeyError`, i.e. a
  // caller that reached a platform-generates-the-keypair endpoint. This tab
  // no longer has a path there, so if it appears, something else does.
  if (e?.status === 409 && detail) {
    return `${detail} (This console should no longer be able to reach that path -- please report it.)`;
  }
  if (e?.status === 403) {
    return (
      detail ||
      "Your account does not hold the platform-wide `wireguard.create` permission this action needs."
    );
  }
  return detail || `Couldn't ${action}, and the platform gave no reason.`;
}

function WireGuardTab({ routerId }: { routerId: string }) {
  const { data: rawPeer, isLoading, isError, refetch } = useWireGuardPeer(routerId);
  // ONE mutation for both buttons, because there is now only one endpoint.
  // See `useAllocateWireGuardPeer` and `routerService.allocateWireGuardPeerFromHub`:
  // `POST /routers/{id}/wireguard-peer/allocate-external` is the only path
  // that produces a keypair BOTH SIDES know, because the hub mints it.
  const allocate = useAllocateWireGuardPeer();
  const revoke = useRevokeWireGuardPeer();
  const [allocation, setAllocation] = useState<WireGuardTunnelAllocation | null>(null);
  const [confirmReallocate, setConfirmReallocate] = useState(false);

  // A revoked peer row is never deleted server-side (its tunnel IP is just
  // freed for reuse) -- GET keeps returning it with status "revoked" rather
  // than 404. Treat that the same as "no tunnel" rather than showing stale
  // key/rotation data with live Rotate/Revoke actions.
  const peer = rawPeer && rawPeer.status !== "revoked" ? rawPeer : null;

  /** `rotate=false` (the Create button) asks the backend to hand back this
   * router's existing peer if it has a usable one, and only allocate when it
   * genuinely has none. `rotate=true` (Re-allocate) asks for a new one --
   * but the backend still refuses to allocate over a device the hub reports
   * handshaking right now, and adopts that live identity instead, returning
   * `reused: true`. Both outcomes are success; which one happened is what
   * the toast has to say honestly, because they mean different things for
   * the setup script the operator is about to paste. */
  async function handleAllocate(rotate: boolean) {
    const action = rotate ? "re-allocate the tunnel" : "create the tunnel";
    try {
      const result = await allocate.mutateAsync({ routerId, rotate });
      setAllocation(result);
      if (result.reused) {
        toast.info(
          rotate
            ? `No new peer was allocated. The hub reports this router already connected on ${result.tunnelIpAddress}, so the platform adopted that identity instead -- a device cannot be made to change the key it already imported by anything done server-side. If it has genuinely been reflashed, wait for its handshake to go stale (5 minutes) and try again.`
            : `This router already had a usable tunnel on ${result.tunnelIpAddress} -- it was returned as-is and no new peer was allocated on the hub.`,
        );
      } else {
        toast.success(
          `New tunnel allocated on the hub: ${result.tunnelIpAddress}. This peer is permanent -- the hub agent has no removal verb.`,
        );
      }
    } catch (err) {
      toast.error(describeHubAllocationFailure(err, action));
    }
  }

  async function handleRevoke() {
    try {
      await revoke.mutateAsync(routerId);
      setAllocation(null);
      toast.success("Tunnel revoked");
    } catch (err) {
      toast.error((err as unknown as AppError).message || "Failed to revoke tunnel");
    }
  }

  if (isLoading) return <LoadingSkeleton rows={4} />;
  if (isError) return <ErrorState onRetry={() => refetch()} />;

  return (
    <div className="space-y-4">
      {allocation && (
        <Card className="rounded-2xl border-primary/40 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-base">
              {allocation.reused
                ? "Existing tunnel reused — no new peer allocated"
                : "New tunnel keys — shown once"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {/* NULL on every reuse/adoption. The private key of a
                hub-allocated peer is generated ON THE HUB and never held by
                this platform (it is stored as the documented
                EXTERNALLY_MANAGED_KEY_SENTINEL), so there is nothing to show
                -- and nothing that needs showing, because the device already
                holds the matching key. Rendering a placeholder here, or a
                `private-key=` line in a script built from it, would overwrite
                a working interface with a key the hub has never heard of. */}
            {allocation.peerPrivateKey ? (
              <KeyRow label="Peer private key" value={allocation.peerPrivateKey} />
            ) : (
              <p className="rounded-lg bg-background/70 px-3 py-2 text-xs text-muted-foreground">
                No private key — and none is needed. This peer's keypair was generated on the hub
                and has never been held by this platform; the device already has the matching key.
                Do not write a <code>private-key=</code> line for this interface.
              </p>
            )}
            <KeyRow label="Peer public key" value={allocation.publicKey} />
            <KeyRow label="Hub public key" value={allocation.hubPublicKey} />
            <KeyRow
              label="Hub endpoint"
              value={`${allocation.hubEndpointHost}:${allocation.hubEndpointPort}`}
            />
            <KeyRow label="Tunnel network" value={allocation.tunnelNetworkCidr} />
            <KeyRow label="Tunnel IP (this router)" value={allocation.tunnelIpAddress} />
            {/* The hub's address INSIDE the tunnel, not its public one. This
                is what a `/radius add address=` line must point at: at least
                one real site's ISP silently drops outbound RADIUS UDP
                (1812/1813) to the hub's public IP but never touches
                WireGuard's own port. */}
            <KeyRow label="Hub tunnel IP (for RADIUS)" value={allocation.hubTunnelIpAddress} />
            <p className="text-xs text-muted-foreground">
              {allocation.peerPrivateKey
                ? "Configure the device's local WireGuard interface with these values now — the private key will not be shown again."
                : "These are the values this router's interface should already match. Nothing here is newly secret."}
            </p>
          </CardContent>
        </Card>
      )}

      <Card className="rounded-2xl border-border/70">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Management tunnel</CardTitle>
            <p className="text-sm text-muted-foreground">
              One WireGuard peer per router, connecting it to the Wyfy Guest control plane. The
              keypair is minted on the hub, never here — that is the only way both ends can know it.
            </p>
          </div>
          {peer ? (
            <div className="flex gap-2">
              {/* "Re-allocate", not "Rotate", and it asks first. Rotation is
                  still meaningful under hub allocation -- a reflashed device
                  has genuinely lost its key and needs a new peer -- but it is
                  not the cheap, reversible operation the old label implied.
                  `ops/hub-agents/wg_agent.py` has no delete and no update
                  verb, so a peer this replaces stays on the hub forever,
                  holding its tunnel address out of the /24. */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmReallocate(true)}
                disabled={allocate.isPending}
              >
                <RotateCw className="h-4 w-4" />
                <span className="ml-2">Re-allocate</span>
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
            <Button size="sm" onClick={() => handleAllocate(false)} disabled={allocate.isPending}>
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

      <ConfirmDialog
        open={confirmReallocate}
        onOpenChange={setConfirmReallocate}
        title="Allocate a new peer for this router?"
        description={
          "This asks the hub to mint a brand new keypair and tunnel IP. The peer it replaces cannot be removed -- the hub agent has no delete verb -- so the old one stays on the hub forever, holding its address out of the tunnel subnet. The device will also stop reaching RADIUS until it is reconfigured with the new values, because its FreeRADIUS client stanza is keyed on the tunnel IP. If the hub reports this router handshaking right now, the platform will refuse and adopt the live identity instead."
        }
        confirmLabel="Allocate new peer"
        destructive
        onConfirm={() => {
          setConfirmReallocate(false);
          void handleAllocate(true);
        }}
      />
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
