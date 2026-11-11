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
  partial: "partly arriving",
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
    case "partial":
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
  "partial",
  "silent",
  "offline",
  "waiting",
  "needs_link",
  "not_set_up",
  "not_supported",
];

// -- DEFAULT-LOGS: the "IP logs: ON / OFF" switch ----------------------------

/** What the switch shows. An older backend has no `switch_on`: `set_up`. */
export function ipLogsSwitchOn(s: { set_up: boolean; switch_on?: boolean }): boolean {
  return s.switch_on ?? s.set_up;
}

/** `null` (never asked) on a router that is not on: the "Turn on IP logs"
 * prompt for routers added before logging was on by default. */
export function ipLogsNeedsPrompt(s: {
  set_up: boolean;
  switch_on?: boolean;
  wanted?: boolean | null;
  blocker: string | null;
}): boolean {
  return s.blocker !== "not_mikrotik" && !ipLogsSwitchOn(s) && s.wanted == null;
}

export interface IpLogsSwitchCopy {
  title: string;
  body: string;
  confirm: string;
}

/** The in-app confirm step, both directions. `needsLink` = the router has no
 * management connection yet (its setup script has not been generated). */
export function ipLogsConfirmCopy(turnOn: boolean, needsLink: boolean): IpLogsSwitchCopy {
  if (turnOn) {
    return {
      title: "Turn IP logs ON?",
      body: needsLink
        ? "IP logs will be part of this router's setup script. Press Generate on the router's page and paste the script once; logs start arriving within minutes."
        : "Wyfy Guest starts storing this router's connection logs. Next you paste a short script into the router terminal (WinBox > New Terminal).",
      confirm: "Turn ON",
    };
  }
  return {
    title: "Turn IP logs OFF?",
    body: needsLink
      ? "IP logs will be left out of this router's setup script. You can turn them on again at any time."
      : "Connection logs stop being stored for this router. Logs already stored are kept. Next you paste a short removal script into the router terminal.",
    confirm: "Turn OFF",
  };
}

/** What the result step says after the switch moved. */
export function ipLogsResultCopy(turnedOn: boolean, needsLink: boolean): string {
  if (turnedOn)
    return needsLink
      ? "IP logs are ON. They are already in this router's setup script: press Generate on the router's page and paste it."
      : "IP logs are ON. Paste this script into the router terminal.";
  return needsLink
    ? "IP logs are OFF. They are left out of this router's setup script."
    : "IP logs are OFF. Paste this script into the router terminal to stop sending.";
}
