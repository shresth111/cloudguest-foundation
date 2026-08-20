export type FleetCheckStatus = "PASS" | "WARNING" | "ERROR" | "BLOCKED" | "PENDING";

export type SnapshotStatus = "complete" | "partial" | "failed";

export type WanVerificationOverall = "ONLINE" | "OFFLINE" | "ERROR" | "DISABLED" | "PENDING";

export interface FleetCompatibilityCheck {
  name: string;
  status: FleetCheckStatus;
  detail: string;
}

export interface FleetCompatibilityReport {
  overall: FleetCheckStatus;
  checks: FleetCompatibilityCheck[];
}

export interface FleetInterfaceSnapshot {
  name: string;
  type: string | null;
  running: boolean | null;
  disabled: boolean | null;
  comment: string | null;
  isWyfyManaged: boolean;
}

export interface FleetBridgeSnapshot {
  name: string;
  comment: string | null;
  isWyfyManaged: boolean;
  ports: string[];
}

export interface FleetIpAddressSnapshot {
  address: string | null;
  interface: string | null;
  comment: string | null;
  isWyfyManaged: boolean;
}

export interface FleetRouterSnapshot {
  id: string;
  routerId: string;
  capturedAt: string;
  status: SnapshotStatus;
  model: string | null;
  routerOsVersion: string | null;
  architecture: string | null;
  totalMemoryBytes: number | null;
  freeMemoryBytes: number | null;
  interfaces: FleetInterfaceSnapshot[];
  bridges: FleetBridgeSnapshot[];
  ipAddresses: FleetIpAddressSnapshot[];
  errorDetail: string | null;
}

export interface FleetDiscoverResult {
  snapshot: FleetRouterSnapshot;
  compatibility: FleetCompatibilityReport;
}

export interface FleetVerificationCheck {
  name: string;
  status: string;
  observed: string | null;
  expected: string | null;
  detail: string | null;
  durationMs: number;
}

export interface FleetWanLinkVerification {
  ispLinkId: string;
  slot: number;
  overall: WanVerificationOverall;
  checks: FleetVerificationCheck[];
}

export interface FleetWanVerificationResult {
  routerId: string;
  runGroupId: string;
  gatePasses: boolean;
  links: FleetWanLinkVerification[];
}

export interface FleetWanVerificationGate {
  routerId: string;
  passes: boolean;
  runGroupId: string | null;
  message: string | null;
}

export interface FleetBasicWanPreview {
  routerId: string;
  renderedContent: string;
  wanLinkCount: number;
}

export interface FleetBasicWanApplyResult {
  versionId: string;
  jobId: string;
  wanLinkCount: number;
}

export interface FleetWanInputDraft {
  providerName: string;
  connectionMode: "static" | "dhcp" | "pppoe";
  role: "primary" | "backup";
  interface: string;
  gatewayIpAddress: string;
  isEnabled: boolean;
}
