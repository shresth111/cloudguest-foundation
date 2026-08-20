import { StepStatusBadge, type StepStatus } from "@/components/ui-ext/StepStatusBadge";
import type { FleetCompatibilityCheck } from "@/types/router-fleet-wizard";

export function toStepStatus(status: string): StepStatus {
  if (status === "PASS" || status === "WARNING" || status === "ERROR" || status === "BLOCKED") {
    return status;
  }
  return "PENDING";
}

export function ValidationSummary({
  checks,
  overall,
}: {
  checks: FleetCompatibilityCheck[];
  overall?: string;
}) {
  if (!checks.length) {
    return <p className="text-sm text-muted-foreground">No checks recorded yet.</p>;
  }

  return (
    <div className="space-y-3">
      {overall ? (
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Overall</span>
          <StepStatusBadge status={toStepStatus(overall)} />
        </div>
      ) : null}
      <ul className="divide-y divide-border rounded-xl border border-border">
        {checks.map((check) => (
          <li key={check.name} className="flex items-start justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <div className="text-sm font-medium">{check.name}</div>
              <div className="text-xs text-muted-foreground">{check.detail}</div>
            </div>
            <StepStatusBadge status={toStepStatus(check.status)} />
          </li>
        ))}
      </ul>
    </div>
  );
}
