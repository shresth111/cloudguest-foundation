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

/** Ternary on purpose. `unknown` means the platform could not establish
 * this precondition without making the very connection that Discovery is
 * about to attempt -- it is NOT a quiet `pass`, and the UI must show it
 * rather than implying a clean bill of health. */
export type DiscoveryPreconditionStatus = "pass" | "fail" | "unknown";

/** One Discovery precondition. `nextStep` is the sentence that tells an
 * operator what to actually do -- "Paste the WireGuard chunk from the
 * router setup script on the device, then wait for it to check in and
 * retry" rather than an IP address and the word "timed out". */
export interface DiscoveryPrecondition {
  key: string;
  label: string;
  status: DiscoveryPreconditionStatus;
  detail: string;
  nextStep: string | null;
}

export interface DiscoveryPreflight {
  routerId: string;
  /** False when at least one precondition is *known* to be unmet. The
   * wizard disables its Discover button and shows `summary`. */
  canAttempt: boolean;
  summary: string | null;
  checks: DiscoveryPrecondition[];
  blockingCount: number;
  unverifiedCount: number;
}

/** Which Step 1 bootstrap rendering to request -- mirrors the backend's
 * `BootstrapMode` (`app/domains/network_config/constants.py`). `onsite` is
 * the cleanup-first fresh-enrollment paste (the default); `remote` is the
 * validate-first, scheduler-staged live cutover with a timed automatic
 * revert, for re-provisioning a router whose existing WireGuard tunnel is
 * also the management path. */
export type FleetBootstrapMode = "onsite" | "remote";

export interface FleetBootstrapScriptPreview {
  routerId: string;
  locationCode: string;
  /** Echoes which rendering the server produced -- the UI must never show
   * a script under a mode it was not generated for. */
  mode: FleetBootstrapMode;
  /** Remote mode only: how long the on-device automatic revert stays armed
   * before restoring the previous tunnel if the cutover never confirms
   * itself. `null` for on-site scripts. */
  revertWindowMinutes: number | null;
  lines: string[];
  /** Newline-joined -- for on-screen display only. */
  script: string;
  /**
   * Semicolon-joined: the form a human actually pastes. RouterOS runs each
   * pasted line as its own command with its own scope, so the `:local enroll`
   * set by the check-in line is gone by the next line -- a multi-line paste
   * makes every field check report "check-in response missing ..." even when
   * the platform returned every field. Confirmed on a real 7.23.3 device.
   */
  scriptSingleLine: string;
  lineCount: number;
  tokenExpiresAt: string;
}

/** Client-derived remote-cutover progress, inferred from polling the
 * router's WireGuard peer (`GET /routers/{id}/wireguard-peer`):
 *
 * - `awaiting_run`: script generated, the device has not checked in yet
 *   (peer `rotationCount` unchanged from the pre-generation baseline).
 * - `cutover_staged`: the device checked in -- the platform rotated the
 *   peer in place (`rotationCount` bumped, `lastHandshakeAt` reset to
 *   null) and the on-device scheduler will fire the cutover; the new
 *   tunnel has not handshaked yet.
 * - `confirmed`: the rotated peer reported a handshake -- the replacement
 *   tunnel reached the hub.
 * - `presumed_reverted`: the revert window elapsed after the cutover was
 *   staged without any handshake -- the device should have restored its
 *   previous tunnel automatically. The API has no explicit revert signal,
 *   so this is a client-side inference, stated as such in the UI. */
export type FleetRemoteCutoverPhase =
  | "awaiting_run"
  | "cutover_staged"
  | "confirmed"
  | "presumed_reverted";

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

export type InterfaceAvailabilityStatus =
  | "RECOMMENDED"
  | "AVAILABLE"
  | "IN_USE"
  | "WAN"
  | "BRIDGE_MEMBER"
  | "DISABLED"
  | "UNAVAILABLE";

export interface FleetGuestInterfaceAvailability {
  name: string;
  status: InterfaceAvailabilityStatus;
  detail: string | null;
  bridge: string | null;
}

export interface FleetGuestInputRecommendation {
  recommendedInterfaces: string[];
  parentBridgeHint: string | null;
  message: string | null;
}

export interface FleetGuestInterfaceAvailabilityResult {
  routerId: string;
  snapshotId: string;
  interfaces: FleetGuestInterfaceAvailability[];
  recommendation: FleetGuestInputRecommendation;
}

export interface FleetGuestVlanDraft {
  vlanId: number;
  name: string;
  subnetCidr: string;
  enableHotspot: boolean;
}

export interface FleetGuestNetworkRequest {
  guestInterfaces: string[];
  vlanMode: boolean;
  vlans: FleetGuestVlanDraft[];
  parentBridge: string | null;
}

export type PlanStatus =
  | "draft"
  | "blocked"
  | "awaiting_approval"
  | "approved"
  | "rendering"
  | "applying"
  | "applied"
  | "failed"
  | "superseded"
  | "rejected";

export type PlanRisk = "none" | "low" | "management_connectivity";

export interface FleetPlanConflict {
  code: string;
  status: FleetCheckStatus;
  summary: string;
  detail: string | null;
  cidrs: string[];
}

export interface FleetPlanDecision {
  code: string;
  summary: string;
  detail: string | null;
  options: string[];
}

export interface FleetPlanAction {
  seq: number;
  ruleId: string;
  actionType: string;
  resourceKind: string;
  routerosPath: string;
  resourceRef: string;
  summary: string;
  risk: PlanRisk;
}

export interface FleetPlanSummary {
  actionCount: number;
  conflictCount: number;
  decisionCount: number;
  highestRisk: PlanRisk;
}

export interface FleetConfigurationPlan {
  id: string;
  routerId: string;
  snapshotId: string;
  status: PlanStatus;
  engineVersion: string;
  requestedConfig: FleetGuestNetworkRequest;
  actions: FleetPlanAction[];
  conflicts: FleetPlanConflict[];
  decisions: FleetPlanDecision[];
  summary: FleetPlanSummary;
}

export interface FleetPlanRenderResult {
  planId: string;
  configVersionId: string;
  configVersionNumber: number;
  status: PlanStatus;
  profilesUsed: string[];
  secretRefs: string[];
  lineCount: number;
  requiresSafetyNet: boolean;
}

export interface FleetPlanPrepareResult {
  planId: string;
  preApplyBackupVersionId: string;
  preApplyBackupVersionNumber: number;
  status: PlanStatus;
  requiresSafetyNet: boolean;
}

export interface FleetPlanApplyResult {
  planId: string;
  configVersionId: string;
  provisioningJobId: string;
  status: PlanStatus;
  configVersionStatus: string;
}

export type FinalVerificationOverall = "ROUTER_ONLINE" | "PARTIAL" | "FAILED";

export interface FleetFinalVerificationChecklist {
  total: number;
  passing: number;
  failing: number;
  notChecked: number;
}

export interface FleetFinalVerificationResult {
  planId: string;
  verificationRunId: string;
  overall: FinalVerificationOverall;
  checks: FleetVerificationCheck[];
  checklist: FleetFinalVerificationChecklist;
  safetyNetRemoved: boolean;
}
