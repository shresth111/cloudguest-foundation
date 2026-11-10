/** IPLOGS-SELFSERVE labels and tones. Partner wording: no tunnel technology. */
import type { IpLogsPipeState, IpLogsState, IpLogsStatus } from "@/services/isp-partner/iplogs";

export const IP_LOGS_PIPE_LABEL: Record<keyof IpLogsStatus["pipes"], string> = {
  syslog: "System logs",
  flows: "Connection logs",
  nat: "NAT translations",
};

export const IP_LOGS_PIPE_STATE_LABEL: Record<IpLogsPipeState, string> = {
  receiving: "Arriving",
  silent: "Stopped",
  awaiting_first: "Waiting for first line",
  not_set_up: "Not set up",
  collector_off: "Not collected yet",
};

export const IP_LOGS_STATE_SHORT: Record<IpLogsState, string> = {
  logs_arriving: "arriving",
  waiting: "waiting for first line",
  not_set_up: "not set up",
  offline: "offline",
  silent: "stopped",
  needs_link: "setup script not done",
  not_supported: "not supported",
};

export function ipLogsPipeTone(state: IpLogsPipeState): string {
  switch (state) {
    case "receiving":
      return "online";
    case "silent":
      return "warning";
    case "awaiting_first":
      return "pending";
    default:
      return "normal";
  }
}

export function ipLogsStateTone(state: IpLogsState): string {
  switch (state) {
    case "logs_arriving":
      return "online";
    case "waiting":
      return "pending";
    case "offline":
      return "offline";
    case "silent":
      return "warning";
    case "needs_link":
      return "info";
    default:
      return "normal";
  }
}

/** Order for the summary strip: problems first. */
export const IP_LOGS_SUMMARY_ORDER: IpLogsState[] = [
  "logs_arriving",
  "silent",
  "offline",
  "waiting",
  "needs_link",
  "not_set_up",
  "not_supported",
];
