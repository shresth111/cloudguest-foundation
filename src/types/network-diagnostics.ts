export interface DiagnosticRun {
  id: string;
  routerId: string;
  diagnosticType: string;
  target: string;
  status: string;
  result: Record<string, unknown>;
  errorMessage: string | null;
  createdAt: string;
}

/** The shape of `DiagnosticRun.result` for `diagnosticType === "ping"` --
 * passed through untouched from the backend's own `PingResult` dataclass
 * (`network-diagnostics.service.ts`'s `toRun` never remaps `result`'s own
 * keys), so field names stay exactly as the backend emits them: snake_case,
 * not camelCase like every other field on `DiagnosticRun` itself. */
export interface PingRunResult {
  sent: number;
  received: number;
  packet_loss_percentage: number;
  avg_rtt_ms: number | null;
}

/** Same "untouched from the backend" note as `PingRunResult` -- one row
 * per hop, in order. */
export interface TracerouteHop {
  hop_number: number;
  address: string | null;
  packet_loss_percentage: number;
  avg_rtt_ms: number | null;
}

export interface TracerouteRunResult {
  hops: TracerouteHop[];
}

export interface DiagnosticRunListResult {
  rows: DiagnosticRun[];
  total: number;
}
