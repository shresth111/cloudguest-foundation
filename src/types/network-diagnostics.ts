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

export interface DiagnosticRunListResult {
  rows: DiagnosticRun[];
  total: number;
}
