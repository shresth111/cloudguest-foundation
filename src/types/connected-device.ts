export interface ConnectedDevice {
  id: string;
  routerId: string;
  organizationId: string;
  locationId: string;
  macAddress: string;
  ipAddress: string | null;
  hostname: string | null;
  vendor: string | null;
  connectionType: string;
  interface: string | null;
  signalStrengthDbm: number | null;
  isActive: boolean;
  connectedAt: string | null;
  lastSeenAt: string | null;
  comment: string | null;
  guestId: string | null;
  createdAt: string;
}

export interface ConnectedDeviceListResult {
  rows: ConnectedDevice[];
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface DeviceSyncSummary {
  discovered: number;
  updated: number;
  disconnected: number;
}

export interface DeviceSyncRun {
  id: string;
  routerId: string;
  status: string;
  componentResults: Record<string, unknown>;
  startedAt: string;
  completedAt: string;
  createdAt: string;
}
