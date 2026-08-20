import { Loader2 } from "lucide-react";
import { MStat, MTag } from "@/components/master/MasterKit";
import { StepStatusBadge } from "@/components/ui-ext/StepStatusBadge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  ValidationSummary,
  toStepStatus,
} from "@/components/routers/fleet-wizard/ValidationSummary";
import type { ProvisionJob } from "@/types/provisioning";
import type {
  FleetConfigurationPlan,
  FleetFinalVerificationResult,
  FleetGuestInterfaceAvailabilityResult,
  FleetGuestNetworkRequest,
  FleetGuestVlanDraft,
  FleetPlanRenderResult,
} from "@/types/router-fleet-wizard";

const AVAILABILITY_TONE: Record<string, string> = {
  RECOMMENDED: "online",
  AVAILABLE: "online",
  IN_USE: "pending",
  WAN: "urgent",
  BRIDGE_MEMBER: "pending",
  DISABLED: "offline",
  UNAVAILABLE: "offline",
};

export function GuestInputStep({
  availability,
  loading,
  guestRequest,
  vlanDraft,
  onGuestRequestChange,
  onVlanDraftChange,
}: {
  availability: FleetGuestInterfaceAvailabilityResult | undefined;
  loading: boolean;
  guestRequest: FleetGuestNetworkRequest;
  vlanDraft: FleetGuestVlanDraft;
  onGuestRequestChange: (next: FleetGuestNetworkRequest) => void;
  onVlanDraftChange: (next: FleetGuestVlanDraft) => void;
}) {
  const selectable = (availability?.interfaces ?? []).filter(
    (i) => i.status === "RECOMMENDED" || i.status === "AVAILABLE",
  );

  function toggleInterface(name: string, checked: boolean) {
    const next = checked
      ? [...guestRequest.guestInterfaces, name]
      : guestRequest.guestInterfaces.filter((n) => n !== name);
    onGuestRequestChange({ ...guestRequest, guestInterfaces: next });
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Guest network input</h3>
        <p className="text-sm text-muted-foreground">
          Choose guest Wi-Fi ports from the latest discovery snapshot. The planner uses this request
          when building the configuration plan.
        </p>
      </div>
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading interface availability…
        </div>
      ) : null}
      {availability?.recommendation.message ? (
        <p className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
          {availability.recommendation.message}
        </p>
      ) : null}
      <div className="space-y-2">
        {(availability?.interfaces ?? []).map((iface) => {
          const canSelect = iface.status === "RECOMMENDED" || iface.status === "AVAILABLE";
          return (
            <label
              key={iface.name}
              className="flex items-start gap-3 rounded-xl border border-border p-3"
            >
              <Checkbox
                checked={guestRequest.guestInterfaces.includes(iface.name)}
                disabled={!canSelect}
                onCheckedChange={(checked) => toggleInterface(iface.name, checked === true)}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{iface.name}</span>
                  <MTag label={iface.status} tone={AVAILABILITY_TONE[iface.status]} />
                </div>
                {iface.detail ? (
                  <div className="text-xs text-muted-foreground">{iface.detail}</div>
                ) : null}
              </div>
            </label>
          );
        })}
        {!availability?.interfaces.length ? (
          <p className="text-sm text-muted-foreground">No interfaces returned from discovery.</p>
        ) : null}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Parent bridge</Label>
          <Input
            value={guestRequest.parentBridge ?? ""}
            placeholder={availability?.recommendation.parentBridgeHint ?? "bridge1"}
            onChange={(e) =>
              onGuestRequestChange({
                ...guestRequest,
                parentBridge: e.target.value || null,
              })
            }
          />
        </div>
        <div className="flex items-center justify-between rounded-xl border border-border px-3 py-2">
          <div>
            <div className="text-sm font-medium">VLAN mode</div>
            <div className="text-xs text-muted-foreground">
              Provision guest VLANs instead of bridge ports
            </div>
          </div>
          <Switch
            checked={guestRequest.vlanMode}
            onCheckedChange={(checked) =>
              onGuestRequestChange({ ...guestRequest, vlanMode: checked })
            }
          />
        </div>
      </div>
      {guestRequest.vlanMode ? (
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label>VLAN ID</Label>
            <Input
              type="number"
              value={vlanDraft.vlanId}
              onChange={(e) =>
                onVlanDraftChange({ ...vlanDraft, vlanId: Number(e.target.value) || 0 })
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label>VLAN name</Label>
            <Input
              value={vlanDraft.name}
              onChange={(e) => onVlanDraftChange({ ...vlanDraft, name: e.target.value })}
            />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label>Subnet CIDR</Label>
            <Input
              value={vlanDraft.subnetCidr}
              placeholder="10.10.0.0/24"
              onChange={(e) => onVlanDraftChange({ ...vlanDraft, subnetCidr: e.target.value })}
            />
          </div>
        </div>
      ) : null}
      {selectable.length > 0 && guestRequest.guestInterfaces.length === 0 ? (
        <p className="text-sm text-amber-700">Select at least one recommended guest interface.</p>
      ) : null}
    </div>
  );
}

export function ConflictReviewStep({ plan }: { plan: FleetConfigurationPlan | null }) {
  if (!plan) {
    return <p className="text-sm text-muted-foreground">Build a plan to review conflicts.</p>;
  }

  const conflictChecks = plan.conflicts.map((c) => ({
    name: c.code,
    status: c.status,
    detail: `${c.summary}${c.detail ? ` — ${c.detail}` : ""}`,
  }));

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Conflict review</h3>
        <p className="text-sm text-muted-foreground">
          Rule engine output for plan <span className="font-mono">{plan.id.slice(0, 8)}</span> —
          status <span className="font-medium">{plan.status}</span>.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        <MStat label="Actions" value={plan.summary.actionCount} />
        <MStat label="Conflicts" value={plan.summary.conflictCount} />
        <MStat label="Decisions" value={plan.summary.decisionCount} />
        <MStat label="Highest risk" value={plan.summary.highestRisk} />
      </div>
      {plan.conflicts.length ? (
        <ValidationSummary
          checks={conflictChecks}
          overall={plan.status === "blocked" ? "BLOCKED" : undefined}
        />
      ) : (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          No blocking conflicts — continue to plan preview.
        </p>
      )}
      {plan.decisions.length ? (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold">Operator decisions required</h4>
          <ul className="space-y-2">
            {plan.decisions.map((d) => (
              <li key={d.code} className="rounded-lg border border-border px-3 py-2 text-sm">
                <div className="font-medium">{d.summary}</div>
                {d.detail ? <div className="text-xs text-muted-foreground">{d.detail}</div> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export function PlanApprovalStep({
  plan,
  renderResult,
  approving,
  rendering,
  onApproveAndRender,
}: {
  plan: FleetConfigurationPlan | null;
  renderResult: FleetPlanRenderResult | null;
  approving: boolean;
  rendering: boolean;
  onApproveAndRender: () => void;
}) {
  if (!plan) return null;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Plan preview & approval</h3>
        <p className="text-sm text-muted-foreground">
          Review planned actions, approve the plan, and compile a draft config version (secrets stay
          server-side as placeholders).
        </p>
      </div>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2">#</th>
              <th className="px-3 py-2">Rule</th>
              <th className="px-3 py-2">Summary</th>
              <th className="px-3 py-2">Risk</th>
            </tr>
          </thead>
          <tbody>
            {plan.actions.map((action) => (
              <tr key={action.seq} className="border-t border-border/70">
                <td className="px-3 py-2">{action.seq}</td>
                <td className="px-3 py-2 font-mono text-xs">{action.ruleId}</td>
                <td className="px-3 py-2">{action.summary}</td>
                <td className="px-3 py-2">
                  {action.risk !== "none" ? (
                    <MTag label={action.risk} tone="urgent" />
                  ) : (
                    <span className="text-muted-foreground">none</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {renderResult ? (
        <div className="grid gap-3 sm:grid-cols-4">
          <MStat label="Config version" value={`v${renderResult.configVersionNumber}`} />
          <MStat label="Script lines" value={renderResult.lineCount} />
          <MStat label="Secret refs" value={renderResult.secretRefs.length} />
          <MStat
            label="Safety net"
            value={renderResult.requiresSafetyNet ? "Scheduled" : "Not required"}
          />
        </div>
      ) : (
        <Button type="button" onClick={onApproveAndRender} disabled={approving || rendering}>
          {(approving || rendering) && <Loader2 className="h-4 w-4 animate-spin" />}
          Approve & render plan
        </Button>
      )}
    </div>
  );
}

export function PlanApplyStep({
  job,
  jobLoading,
  preparing,
  applying,
  onRunApply,
}: {
  job: ProvisionJob | null | undefined;
  jobLoading: boolean;
  preparing: boolean;
  applying: boolean;
  onRunApply: () => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Apply progress</h3>
        <p className="text-sm text-muted-foreground">
          Captures a pre-apply backup marker, pushes the rendered config version through the
          gateway, and polls the provisioning job until completion.
        </p>
      </div>
      <Button type="button" onClick={onRunApply} disabled={preparing || applying}>
        {(preparing || applying) && <Loader2 className="h-4 w-4 animate-spin" />}
        Prepare & apply plan
      </Button>
      {job ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <MStat label="Job status" value={job.status} />
          <MStat label="Step" value={job.currentStep ?? "—"} />
          <MStat label="Progress" value={`${job.progressPercent}%`} />
        </div>
      ) : jobLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Polling apply job…
        </div>
      ) : null}
      {job?.errorMessage ? <p className="text-sm text-rose-600">{job.errorMessage}</p> : null}
    </div>
  );
}

export function FinalVerifyStep({
  result,
  loading,
  onVerify,
}: {
  result: FleetFinalVerificationResult | null;
  loading: boolean;
  onVerify: () => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Final verification</h3>
        <p className="text-sm text-muted-foreground">
          Post-apply health gate — evaluates router online state, WireGuard, and refreshes the fleet
          checklist.
        </p>
      </div>
      <Button type="button" onClick={onVerify} disabled={loading}>
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        Run final verification
      </Button>
      {result ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Overall</span>
            <StepStatusBadge
              status={toStepStatus(
                result.overall === "ROUTER_ONLINE"
                  ? "PASS"
                  : result.overall === "PARTIAL"
                    ? "WARNING"
                    : "ERROR",
              )}
              label={result.overall}
            />
          </div>
          <ValidationSummary
            checks={result.checks.map((c) => ({
              name: c.name,
              status: toStepStatus(c.status),
              detail: c.detail ?? `${c.observed ?? "—"} / expected ${c.expected ?? "—"}`,
            }))}
          />
          <div className="grid gap-3 sm:grid-cols-4">
            <MStat label="Checklist total" value={result.checklist.total} />
            <MStat label="Passing" value={result.checklist.passing} />
            <MStat label="Failing" value={result.checklist.failing} />
            <MStat label="Not checked" value={result.checklist.notChecked} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function FleetOnlineStep({
  result,
  routerName,
}: {
  result: FleetFinalVerificationResult | null;
  routerName: string;
}) {
  const online = result?.overall === "ROUTER_ONLINE";
  const partial = result?.overall === "PARTIAL";

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Fleet online</h3>
        <p className="text-sm text-muted-foreground">
          Provisioning complete for <span className="font-medium">{routerName}</span>. The router
          remains in the fleet with an updated checklist based on final verification.
        </p>
      </div>
      <div
        className={
          online
            ? "rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center"
            : partial
              ? "rounded-xl border border-amber-200 bg-amber-50 p-6 text-center"
              : "rounded-xl border border-rose-200 bg-rose-50 p-6 text-center"
        }
      >
        <div className="text-2xl font-semibold">
          {online ? "Router online" : partial ? "Partially online" : "Verification incomplete"}
        </div>
        <div className="mt-2 text-sm text-muted-foreground">
          {result
            ? `${result.checklist.passing}/${result.checklist.total} checklist items passing`
            : "Run final verification to complete provisioning."}
        </div>
        {result?.safetyNetRemoved ? (
          <div className="mt-3 text-xs text-muted-foreground">
            Scheduled safety-net revert removed after successful verification.
          </div>
        ) : null}
      </div>
    </div>
  );
}
