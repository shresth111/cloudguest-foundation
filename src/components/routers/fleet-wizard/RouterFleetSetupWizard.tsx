import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Network,
  Radar,
  Route,
  ShieldCheck,
  Wifi,
  Workflow,
} from "lucide-react";
import { toast } from "sonner";
import { MasterShell } from "@/components/master/MasterShell";
import { MButton, MPageShell, MSectionHeader, MStat } from "@/components/master/MasterKit";
import { Stepper } from "@/components/ui-ext/Stepper";
import { StepStatusBadge, type StepStatus } from "@/components/ui-ext/StepStatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  ValidationSummary,
  toStepStatus,
} from "@/components/routers/fleet-wizard/ValidationSummary";
import {
  useApplyBasicWan,
  useDiscoverRouter,
  useFleetProvisionJob,
  usePreviewBasicWan,
  useVerifyRouterWan,
} from "@/hooks/useRouterFleetWizard";
import { routerFleetWizardService } from "@/services/router-fleet-wizard.service";
import type { AppError } from "@/services/api";
import type { RouterDevice } from "@/types/router";
import type {
  FleetDiscoverResult,
  FleetRouterSnapshot,
  FleetWanInputDraft,
  FleetWanVerificationResult,
} from "@/types/router-fleet-wizard";

const STEPS = [
  { key: "discover", title: "Discover", description: "Read-only device sweep", icon: Radar },
  {
    key: "compatibility",
    title: "Compatibility",
    description: "Model & firmware checks",
    icon: ShieldCheck,
  },
  { key: "wan-input", title: "WAN input", description: "ISP links & interfaces", icon: Wifi },
  { key: "wan-apply", title: "WAN apply", description: "Push basic WAN profile", icon: Workflow },
  { key: "wan-verify", title: "WAN verify", description: "Per-link health gate", icon: Network },
  { key: "topology", title: "Topology review", description: "Bridges & addressing", icon: Route },
] as const;

const DEFAULT_WAN_DRAFTS: FleetWanInputDraft[] = [
  {
    providerName: "Primary ISP",
    connectionMode: "dhcp",
    role: "primary",
    interface: "ether1",
    gatewayIpAddress: "",
    isEnabled: true,
  },
  {
    providerName: "Backup ISP",
    connectionMode: "dhcp",
    role: "backup",
    interface: "ether2",
    gatewayIpAddress: "",
    isEnabled: false,
  },
  {
    providerName: "Tertiary ISP",
    connectionMode: "dhcp",
    role: "backup",
    interface: "ether3",
    gatewayIpAddress: "",
    isEnabled: false,
  },
];

function formatBytes(bytes: number | null): string {
  if (bytes == null) return "—";
  const gb = bytes / 1024 ** 3;
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  return `${Math.round(bytes / 1024 ** 2)} MB`;
}

function inferEtherOptions(snapshot: FleetRouterSnapshot | null): string[] {
  const fromSnapshot =
    snapshot?.interfaces
      .map((i) => i.name)
      .filter((name) => /^ether\d+/i.test(name) || name.toLowerCase().startsWith("sfp")) ?? [];
  if (fromSnapshot.length) return fromSnapshot;
  return ["ether1", "ether2", "ether3", "ether4", "ether5"];
}

function stepStatusForIndex(
  index: number,
  currentStep: number,
  completedThrough: number,
  blockedAt: number | null,
): StepStatus | undefined {
  if (blockedAt !== null && index === blockedAt) return "ERROR";
  if (index < completedThrough) return "PASS";
  if (index === currentStep) return "PENDING";
  return undefined;
}

export function RouterFleetSetupWizard({
  router,
  onBack,
}: {
  router: RouterDevice;
  onBack: () => void;
}) {
  const [step, setStep] = useState(0);
  const [discoverResult, setDiscoverResult] = useState<FleetDiscoverResult | null>(null);
  const [wanDrafts, setWanDrafts] = useState<FleetWanInputDraft[]>(DEFAULT_WAN_DRAFTS);
  const [savedLinkIds, setSavedLinkIds] = useState<string[]>([]);
  const [wanPreview, setWanPreview] = useState<string | null>(null);
  const [applyJobId, setApplyJobId] = useState<string | null>(null);
  const [verification, setVerification] = useState<FleetWanVerificationResult | null>(null);
  const [completedThrough, setCompletedThrough] = useState(-1);
  const [blockedAt, setBlockedAt] = useState<number | null>(null);
  const [lanBridge, setLanBridge] = useState("bridge1");

  const discover = useDiscoverRouter();
  const previewWan = usePreviewBasicWan();
  const applyWan = useApplyBasicWan();
  const verifyWan = useVerifyRouterWan();
  const applyJob = useFleetProvisionJob(applyJobId, true);

  const snapshot = discoverResult?.snapshot ?? null;
  const compatibility = discoverResult?.compatibility ?? null;
  const etherOptions = useMemo(() => inferEtherOptions(snapshot), [snapshot]);

  useEffect(() => {
    if (!snapshot?.bridges.length) return;
    const primary = snapshot.bridges.find((b) => !b.isWyfyManaged) ?? snapshot.bridges[0];
    if (primary?.name) setLanBridge(primary.name);
  }, [snapshot]);

  const stepperItems = STEPS.map((s, index) => ({
    key: s.key,
    title: s.title,
    description: s.description,
    icon: s.icon,
    status: stepStatusForIndex(index, step, completedThrough, blockedAt),
  }));

  async function runDiscover() {
    try {
      const result = await discover.mutateAsync({
        routerId: router.id,
        organizationId: router.organizationId,
      });
      setDiscoverResult(result);
      setBlockedAt(null);
      if (result.snapshot.status === "failed") {
        setBlockedAt(0);
        toast.error(result.snapshot.errorDetail ?? "Discovery failed");
        return;
      }
      setCompletedThrough(0);
      if (result.compatibility.overall === "BLOCKED") {
        setBlockedAt(1);
        toast.error("Compatibility blocked — resolve issues before continuing");
        return;
      }
      setStep(1);
    } catch (err) {
      toast.error((err as AppError).message || "Discovery failed");
      setBlockedAt(0);
    }
  }

  function continueFromCompatibility() {
    if (!compatibility) return;
    if (compatibility.overall === "BLOCKED") {
      setBlockedAt(1);
      toast.error("Compatibility is blocked");
      return;
    }
    setCompletedThrough(1);
    setStep(2);
  }

  async function saveWanInput() {
    const enabled = wanDrafts.filter((d) => d.isEnabled);
    if (!enabled.length) {
      toast.error("Enable at least one WAN link");
      return;
    }
    if (enabled.some((d) => !d.interface.trim())) {
      toast.error("Every enabled WAN needs an interface");
      return;
    }
    try {
      const links = await routerFleetWizardService.syncWanLinks(
        router.id,
        router.organizationId,
        wanDrafts,
      );
      setSavedLinkIds(links.map((l) => l.id));
      setCompletedThrough(2);
      setStep(3);
      toast.success("WAN links saved");
    } catch (err) {
      toast.error((err as AppError).message || "Failed to save WAN links");
    }
  }

  async function loadWanPreview() {
    try {
      const preview = await previewWan.mutateAsync({
        routerId: router.id,
        lanBridge,
        organizationId: router.organizationId,
      });
      setWanPreview(preview.renderedContent);
    } catch (err) {
      toast.error((err as AppError).message || "Failed to render WAN preview");
    }
  }

  async function runWanApply() {
    try {
      const staticAddresses = savedLinkIds
        .map((linkId, index) => {
          const draft = wanDrafts.filter((d) => d.isEnabled)[index];
          if (!draft || draft.connectionMode !== "static" || !draft.gatewayIpAddress.trim()) {
            return null;
          }
          return { linkId, staticAddress: draft.gatewayIpAddress };
        })
        .filter((row): row is { linkId: string; staticAddress: string } => !!row);

      const result = await applyWan.mutateAsync({
        routerId: router.id,
        organizationId: router.organizationId,
        lanBridge,
        staticAddresses,
      });
      setApplyJobId(result.jobId);
      toast.success("WAN apply queued");
    } catch (err) {
      toast.error((err as AppError).message || "WAN apply failed");
    }
  }

  useEffect(() => {
    const status = applyJob.data?.status;
    if (!status) return;
    if (status === "succeeded") {
      setCompletedThrough(3);
    }
    if (status === "failed" || status === "cancelled") {
      setBlockedAt(3);
      toast.error(applyJob.data?.errorMessage ?? "WAN apply job failed");
    }
  }, [applyJob.data]);

  async function runWanVerify() {
    try {
      const result = await verifyWan.mutateAsync({
        routerId: router.id,
        organizationId: router.organizationId,
      });
      setVerification(result);
      if (!result.gatePasses) {
        setBlockedAt(4);
        toast.error("WAN verification gate did not pass");
        return;
      }
      setCompletedThrough(4);
      setStep(5);
      toast.success("WAN verification passed");
    } catch (err) {
      toast.error((err as AppError).message || "WAN verification failed");
      setBlockedAt(4);
    }
  }

  function finishWizard() {
    setCompletedThrough(5);
    toast.success("Steps 1–6 complete — continue with guest network planning in the next phase");
  }

  function canGoNext(): boolean {
    if (step === 0) return !!discoverResult && discoverResult.snapshot.status !== "failed";
    if (step === 1) return !!compatibility && compatibility.overall !== "BLOCKED";
    if (step === 2) return savedLinkIds.length > 0;
    if (step === 3) {
      const status = applyJob.data?.status;
      return status === "succeeded";
    }
    if (step === 4) return !!verification?.gatePasses;
    return false;
  }

  function goNext() {
    if (step === 1) continueFromCompatibility();
    else if (step === 2) void saveWanInput();
    else if (step === 4) runWanVerify();
    else if (step === 5) finishWizard();
    else setStep((s) => Math.min(STEPS.length - 1, s + 1));
  }

  return (
    <MasterShell title={`Provision — ${router.name}`}>
      <MPageShell>
        <MSectionHeader
          eyebrow="Router fleet"
          title={`Provisioning wizard — ${router.name}`}
          description={`${router.organizationName} / ${router.locationName} · ${router.model}`}
          actions={
            <MButton variant="outline" onClick={onBack}>
              <ArrowLeft className="h-3.5 w-3.5" /> Back to fleet
            </MButton>
          }
        />

        <div className="grid gap-0 overflow-hidden rounded-xl border border-border bg-card md:grid-cols-[260px_1fr]">
          <aside className="border-b border-border bg-muted/30 p-4 md:border-b-0 md:border-r">
            <Stepper steps={stepperItems} currentStep={step} onStepClick={setStep} />
          </aside>

          <div className="flex min-h-[560px] flex-col">
            <div className="flex-1 space-y-5 p-6">
              {step === 0 && (
                <DiscoverStep
                  router={router}
                  snapshot={snapshot}
                  loading={discover.isPending}
                  onDiscover={runDiscover}
                />
              )}
              {step === 1 && compatibility && (
                <CompatibilityStep compatibility={compatibility} snapshot={snapshot} />
              )}
              {step === 2 && (
                <WanInputStep
                  drafts={wanDrafts}
                  etherOptions={etherOptions}
                  onChange={setWanDrafts}
                />
              )}
              {step === 3 && (
                <WanApplyStep
                  lanBridge={lanBridge}
                  onLanBridgeChange={setLanBridge}
                  preview={wanPreview}
                  loadingPreview={previewWan.isPending}
                  applying={applyWan.isPending}
                  job={applyJob.data ?? null}
                  jobLoading={applyJob.isFetching}
                  onPreview={loadWanPreview}
                  onApply={runWanApply}
                />
              )}
              {step === 4 && (
                <WanVerifyStep verification={verification} loading={verifyWan.isPending} />
              )}
              {step === 5 && snapshot && <TopologyStep snapshot={snapshot} />}
            </div>

            <div className="flex items-center justify-between border-t border-border px-6 py-4">
              <Button
                type="button"
                variant="outline"
                disabled={step === 0}
                onClick={() => setStep((s) => Math.max(0, s - 1))}
              >
                <ChevronLeft className="h-4 w-4" /> Back
              </Button>
              <div className="text-xs text-muted-foreground">
                Step {step + 1} of {STEPS.length}
              </div>
              {step === 0 ? (
                <Button type="button" onClick={runDiscover} disabled={discover.isPending}>
                  {discover.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  {discoverResult ? "Re-run discovery" : "Run discovery"}
                </Button>
              ) : step === 3 ? (
                <Button type="button" variant="outline" onClick={goNext} disabled={!canGoNext()}>
                  Continue <ChevronRight className="h-4 w-4" />
                </Button>
              ) : step === 4 ? (
                <Button type="button" onClick={runWanVerify} disabled={verifyWan.isPending}>
                  {verifyWan.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  Run verification
                </Button>
              ) : step === 5 ? (
                <Button type="button" onClick={finishWizard}>
                  Complete phase 1
                </Button>
              ) : (
                <Button type="button" onClick={goNext} disabled={!canGoNext()}>
                  Continue <ChevronRight className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </MPageShell>
    </MasterShell>
  );
}

function DiscoverStep({
  router,
  snapshot,
  loading,
  onDiscover,
}: {
  router: RouterDevice;
  snapshot: FleetRouterSnapshot | null;
  loading: boolean;
  onDiscover: () => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Discover live device</h3>
        <p className="text-sm text-muted-foreground">
          Runs a read-only RouterOS sweep via the platform gateway. Nothing is written to{" "}
          {router.name} until you explicitly apply WAN configuration later.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <MStat label="Management IP" value={router.managementIpAddress ?? "—"} />
        <MStat label="API credentials" value={router.hasApiCredentials ? "Present" : "Missing"} />
        <MStat label="WireGuard" value={router.status === "online" ? "Reachable" : "Pending"} />
      </div>
      {snapshot ? (
        <div className="grid gap-3 sm:grid-cols-4">
          <MStat label="Snapshot" value={snapshot.status} />
          <MStat label="Model" value={snapshot.model ?? "—"} />
          <MStat label="RouterOS" value={snapshot.routerOsVersion ?? "—"} />
          <MStat label="Free memory" value={formatBytes(snapshot.freeMemoryBytes)} />
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No snapshot yet — run discovery to capture the current device state.
        </div>
      )}
      <Button type="button" onClick={onDiscover} disabled={loading}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {snapshot ? "Re-run discovery" : "Run discovery"}
      </Button>
    </div>
  );
}

function CompatibilityStep({
  compatibility,
  snapshot,
}: {
  compatibility: NonNullable<FleetDiscoverResult["compatibility"]>;
  snapshot: FleetRouterSnapshot | null;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Compatibility report</h3>
        <p className="text-sm text-muted-foreground">
          Evaluated against the Wave 1 MikroTik matrix using snapshot{" "}
          {snapshot ? new Date(snapshot.capturedAt).toLocaleString() : "—"}.
        </p>
      </div>
      <ValidationSummary checks={compatibility.checks} overall={compatibility.overall} />
      {compatibility.overall === "BLOCKED" ? (
        <p className="text-sm text-rose-600">
          Resolve blocked checks before WAN configuration can continue.
        </p>
      ) : null}
    </div>
  );
}

function WanInputStep({
  drafts,
  etherOptions,
  onChange,
}: {
  drafts: FleetWanInputDraft[];
  etherOptions: string[];
  onChange: (next: FleetWanInputDraft[]) => void;
}) {
  function update(index: number, patch: Partial<FleetWanInputDraft>) {
    onChange(drafts.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">WAN input</h3>
        <p className="text-sm text-muted-foreground">
          Map each ISP uplink to a physical interface. These rows persist as `isp_links` before the
          server-side WAN profile is applied.
        </p>
      </div>
      <div className="space-y-4">
        {drafts.map((draft, index) => (
          <div key={index} className="rounded-xl border border-border p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-medium">WAN {index + 1}</div>
              <div className="flex items-center gap-2">
                <Label htmlFor={`wan-enabled-${index}`} className="text-xs text-muted-foreground">
                  Enabled
                </Label>
                <Switch
                  id={`wan-enabled-${index}`}
                  checked={draft.isEnabled}
                  onCheckedChange={(checked) => update(index, { isEnabled: checked })}
                />
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Provider</Label>
                <Input
                  value={draft.providerName}
                  disabled={!draft.isEnabled}
                  onChange={(e) => update(index, { providerName: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Interface</Label>
                <Select
                  value={draft.interface}
                  disabled={!draft.isEnabled}
                  onValueChange={(value) => update(index, { interface: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select interface" />
                  </SelectTrigger>
                  <SelectContent>
                    {etherOptions.map((name) => (
                      <SelectItem key={name} value={name}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Connection mode</Label>
                <Select
                  value={draft.connectionMode}
                  disabled={!draft.isEnabled}
                  onValueChange={(value) =>
                    update(index, { connectionMode: value as FleetWanInputDraft["connectionMode"] })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dhcp">DHCP</SelectItem>
                    <SelectItem value="static">Static</SelectItem>
                    <SelectItem value="pppoe">PPPoE</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Role</Label>
                <Select
                  value={draft.role}
                  disabled={!draft.isEnabled}
                  onValueChange={(value) =>
                    update(index, { role: value as FleetWanInputDraft["role"] })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="primary">Primary</SelectItem>
                    <SelectItem value="backup">Backup</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {draft.connectionMode === "static" ? (
                <div className="space-y-1.5 md:col-span-2">
                  <Label>Static address (ip/prefix)</Label>
                  <Input
                    value={draft.gatewayIpAddress}
                    disabled={!draft.isEnabled}
                    placeholder="203.0.113.5/24"
                    onChange={(e) => update(index, { gatewayIpAddress: e.target.value })}
                  />
                </div>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function WanApplyStep({
  lanBridge,
  onLanBridgeChange,
  preview,
  loadingPreview,
  applying,
  job,
  jobLoading,
  onPreview,
  onApply,
}: {
  lanBridge: string;
  onLanBridgeChange: (value: string) => void;
  preview: string | null;
  loadingPreview: boolean;
  applying: boolean;
  job: {
    status: string;
    currentStep: string | null;
    progressPercent: number;
    errorMessage: string | null;
  } | null;
  jobLoading: boolean;
  onPreview: () => void;
  onApply: () => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Apply basic WAN profile</h3>
        <p className="text-sm text-muted-foreground">
          Preview the server-rendered RouterOS script, then queue apply through the gateway. Job
          status polls automatically.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
        <div className="space-y-1.5">
          <Label>LAN bridge</Label>
          <Input value={lanBridge} onChange={(e) => onLanBridgeChange(e.target.value)} />
        </div>
        <div className="flex items-end">
          <Button type="button" variant="outline" onClick={onPreview} disabled={loadingPreview}>
            {loadingPreview ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Preview script
          </Button>
        </div>
        <div className="flex items-end">
          <Button type="button" onClick={onApply} disabled={applying}>
            {applying ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Apply to device
          </Button>
        </div>
      </div>
      {preview ? (
        <pre className="max-h-56 overflow-auto rounded-xl border border-border bg-muted/40 p-4 text-xs">
          {preview}
        </pre>
      ) : null}
      {job ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <MStat label="Job status" value={job.status} />
          <MStat label="Step" value={job.currentStep ?? "—"} />
          <MStat label="Progress" value={`${job.progressPercent}%`} />
        </div>
      ) : jobLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Waiting for apply job…
        </div>
      ) : null}
    </div>
  );
}

function WanVerifyStep({
  verification,
  loading,
}: {
  verification: FleetWanVerificationResult | null;
  loading: boolean;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">WAN verification</h3>
        <p className="text-sm text-muted-foreground">
          Structured per-link checks (ping, DNS, gateway) must pass before topology sign-off.
        </p>
      </div>
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Running verification…
        </div>
      ) : null}
      {verification ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Gate</span>
            <StepStatusBadge status={verification.gatePasses ? "PASS" : "ERROR"} />
          </div>
          {verification.links.map((link) => (
            <div key={link.ispLinkId} className="rounded-xl border border-border p-4">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-sm font-medium">
                  WAN slot {link.slot + 1} · {link.ispLinkId.slice(0, 8)}
                </div>
                <StepStatusBadge
                  status={toStepStatus(link.overall === "ONLINE" ? "PASS" : "ERROR")}
                  label={link.overall}
                />
              </div>
              <ValidationSummary
                checks={link.checks.map((c) => ({
                  name: c.name,
                  status: toStepStatus(c.status),
                  detail: c.detail ?? `${c.observed ?? "—"} / expected ${c.expected ?? "—"}`,
                }))}
              />
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Run verification after WAN apply completes successfully.
        </p>
      )}
    </div>
  );
}

function TopologyStep({ snapshot }: { snapshot: FleetRouterSnapshot }) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Topology review</h3>
        <p className="text-sm text-muted-foreground">
          Read-only inventory from the latest discovery snapshot — bridges, interfaces, and
          addressing before guest network planning (steps 7–13).
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <MStat label="Bridges" value={snapshot.bridges.length} />
        <MStat label="Interfaces" value={snapshot.interfaces.length} />
        <MStat label="IP addresses" value={snapshot.ipAddresses.length} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-border p-4">
          <h4 className="mb-3 text-sm font-semibold">Bridges</h4>
          <ul className="space-y-2 text-sm">
            {snapshot.bridges.map((bridge) => (
              <li key={bridge.name} className="rounded-lg bg-muted/40 px-3 py-2">
                <div className="font-medium">{bridge.name}</div>
                <div className="text-xs text-muted-foreground">
                  Ports: {bridge.ports.length ? bridge.ports.join(", ") : "none"}
                </div>
              </li>
            ))}
            {!snapshot.bridges.length ? (
              <li className="text-muted-foreground">No bridges reported.</li>
            ) : null}
          </ul>
        </section>
        <section className="rounded-xl border border-border p-4">
          <h4 className="mb-3 text-sm font-semibold">IP addressing</h4>
          <ul className="space-y-2 text-sm">
            {snapshot.ipAddresses.map((ip, index) => (
              <li
                key={`${ip.interface}-${index}`}
                className="flex justify-between gap-3 rounded-lg bg-muted/40 px-3 py-2"
              >
                <span className="font-mono text-xs">{ip.address ?? "—"}</span>
                <span className="text-xs text-muted-foreground">{ip.interface ?? "—"}</span>
              </li>
            ))}
            {!snapshot.ipAddresses.length ? (
              <li className="text-muted-foreground">No IP addresses reported.</li>
            ) : null}
          </ul>
        </section>
      </div>
      <section className="rounded-xl border border-border p-4">
        <h4 className="mb-3 text-sm font-semibold">Interfaces</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr>
                <th className="pb-2 pr-3">Name</th>
                <th className="pb-2 pr-3">Type</th>
                <th className="pb-2">Running</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.interfaces.map((iface) => (
                <tr key={iface.name} className="border-t border-border/70">
                  <td className="py-2 pr-3 font-medium">{iface.name}</td>
                  <td className="py-2 pr-3 text-muted-foreground">{iface.type ?? "—"}</td>
                  <td className="py-2">{iface.running ? "yes" : "no"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
