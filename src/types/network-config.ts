export interface NetworkConfigPreview {
  routerId: string;
  renderedContent: string;
  dhcpPoolCount: number;
  vlanCount: number;
  portForwardingRuleCount: number;
  hotspotProfileCount: number;
  qosTrafficRuleCount: number;
  dnsRecordCount: number;
  firewallRuleCount: number;
}

export interface ConfigVersionSummary {
  id: string;
  routerId: string;
  profileId: string | null;
  versionNumber: number;
  status: string;
  isBackup: boolean;
  rollbackOfVersionId: string | null;
  appliedAt: string | null;
  createdAt: string;
}

export interface ConfigVersion extends ConfigVersionSummary {
  renderedContent: string;
}

export interface ConfigVersionListResult {
  rows: ConfigVersionSummary[];
  total: number;
  totalPages: number;
}

export interface ConfigVersionDiff {
  fromVersionId: string;
  fromVersionNumber: number;
  toVersionId: string;
  toVersionNumber: number;
  diffLines: string[];
}

export interface ProvisioningJobSummary {
  id: string;
  status: string;
}

export interface ConfigVersionApplyResult {
  version: ConfigVersion;
  job: ProvisioningJobSummary;
}
