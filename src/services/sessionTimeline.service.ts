import { api } from "@/services/api";

/**
 * One guest session's AAA trail -- GET /guest-sessions/{id}/timeline.
 *
 * Authentication (sign-in attempts and router checks, with the reason a
 * refusal happened), authorization (what the guest was allowed: time, idle
 * timeout, data cap, speed) and accounting (what the router reported). The
 * backend writes `title`/`detail` in plain words; `raw` carries the RADIUS
 * attribute values behind them for the details expander. The guest's
 * phone/email is never inside `raw` -- it is `guestIdentifier`, masked by the
 * backend like everywhere else.
 */

export type TimelinePhase = "authentication" | "authorization" | "accounting";
export type TimelineOutcome = "success" | "failure" | "info";

export interface TimelineEntry {
  at: string;
  firstSeenAt: string | null;
  phase: TimelinePhase;
  kind: string;
  outcome: TimelineOutcome;
  title: string;
  detail: string | null;
  repeatCount: number;
  raw: Record<string, string | number | boolean | null>;
}

export interface SessionTimeline {
  sessionId: string;
  guestIdentifier: string | null;
  authorization: {
    authMethod: string;
    authMethodText: string | null;
    timeLimitMinutes: number | null;
    idleTimeoutMinutes: number | null;
    dataLimitMb: number | null;
    speedLimit: string | null;
    routerChecked: boolean;
  };
  accounting: {
    status: string;
    startedAt: string;
    endedAt: string | null;
    durationSeconds: number;
    bytesUploaded: number;
    bytesDownloaded: number;
    deviceIp: string | null;
    deviceMac: string | null;
    nasIpAddress: string | null;
    nasIdentifier: string | null;
    routerName: string | null;
    routerSessionId: string | null;
    venuePublicIp: string | null;
    endReasonText: string | null;
    routerReported: boolean;
  };
  entries: TimelineEntry[];
  notes: string[];
}

interface RawEntry {
  at: string;
  first_seen_at: string | null;
  phase: TimelinePhase;
  kind: string;
  outcome: TimelineOutcome;
  title: string;
  detail: string | null;
  repeat_count: number;
  raw: Record<string, string | number | boolean | null>;
}

interface RawTimeline {
  session_id: string;
  guest_identifier: string | null;
  authorization: {
    auth_method: string;
    auth_method_text: string | null;
    time_limit_minutes: number | null;
    idle_timeout_minutes: number | null;
    data_limit_mb: number | null;
    speed_limit: string | null;
    router_checked: boolean;
  };
  accounting: {
    status: string;
    started_at: string;
    ended_at: string | null;
    duration_seconds: number;
    bytes_uploaded: number;
    bytes_downloaded: number;
    device_ip: string | null;
    device_mac: string | null;
    nas_ip_address: string | null;
    nas_identifier: string | null;
    router_name: string | null;
    router_session_id: string | null;
    venue_public_ip: string | null;
    end_reason_text: string | null;
    router_reported: boolean;
  };
  entries: RawEntry[];
  notes: string[];
}

export function toSessionTimeline(d: RawTimeline): SessionTimeline {
  return {
    sessionId: d.session_id,
    guestIdentifier: d.guest_identifier,
    authorization: {
      authMethod: d.authorization.auth_method,
      authMethodText: d.authorization.auth_method_text,
      timeLimitMinutes: d.authorization.time_limit_minutes,
      idleTimeoutMinutes: d.authorization.idle_timeout_minutes,
      dataLimitMb: d.authorization.data_limit_mb,
      speedLimit: d.authorization.speed_limit,
      routerChecked: d.authorization.router_checked,
    },
    accounting: {
      status: d.accounting.status,
      startedAt: d.accounting.started_at,
      endedAt: d.accounting.ended_at,
      durationSeconds: d.accounting.duration_seconds,
      bytesUploaded: d.accounting.bytes_uploaded,
      bytesDownloaded: d.accounting.bytes_downloaded,
      deviceIp: d.accounting.device_ip,
      deviceMac: d.accounting.device_mac,
      nasIpAddress: d.accounting.nas_ip_address,
      nasIdentifier: d.accounting.nas_identifier,
      routerName: d.accounting.router_name,
      routerSessionId: d.accounting.router_session_id,
      venuePublicIp: d.accounting.venue_public_ip,
      endReasonText: d.accounting.end_reason_text,
      routerReported: d.accounting.router_reported,
    },
    entries: d.entries.map((e) => ({
      at: e.at,
      firstSeenAt: e.first_seen_at,
      phase: e.phase,
      kind: e.kind,
      outcome: e.outcome,
      title: e.title,
      detail: e.detail,
      repeatCount: e.repeat_count,
      raw: e.raw ?? {},
    })),
    notes: d.notes ?? [],
  };
}

export const sessionTimelineService = {
  /** `orgId` rides as `X-Organization-Id`, the same header the Guest Session
   * Log's own list call sends; the backend scopes the session to it (and to
   * the caller's locations) before reading anything else. */
  async get(sessionId: string, orgId: string): Promise<SessionTimeline> {
    const { data } = await api.get<RawTimeline>(
      `/guest-sessions/${encodeURIComponent(sessionId)}/timeline`,
      { headers: { "X-Organization-Id": orgId } },
    );
    return toSessionTimeline(data);
  },
};
