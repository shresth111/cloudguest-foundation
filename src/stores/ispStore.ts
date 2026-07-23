import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Per-business-unit ISP/WAN configuration. Configured from the ISP Details
 * page (Business Unit -> up to 4 ISP lines with provider/bandwidth/
 * threshold/alerting); the customer front page's Network Status panel
 * reads this same store so a WAN marked "down" here shows live on the
 * location picker without a separate polling layer -- this is the seam a
 * real `GET /locations/:id/isp-status` push/poll replaces.
 */
export interface IspLine {
  wan: string;
  provider: string;
  connectionType: string;
  bandwidthMbps: number;
  thresholdMbps: number;
  status: "up" | "down";
  emailAlert: boolean;
  smsAlert: boolean;
}

export interface IspConfig {
  businessUnit: string;
  totalInterfaces: number;
  emailOnFluctuation: boolean;
  lines: IspLine[];
}

const SEED: Record<string, IspConfig> = {
  "Marina Bay Hotel": {
    businessUnit: "Marina Bay Hotel",
    totalInterfaces: 2,
    emailOnFluctuation: true,
    lines: [
      { wan: "WAN1", provider: "Airtel", connectionType: "Broadband", bandwidthMbps: 500, thresholdMbps: 100, status: "up", emailAlert: true, smsAlert: false },
      { wan: "WAN2", provider: "ACT Fibernet", connectionType: "Broadband", bandwidthMbps: 300, thresholdMbps: 50, status: "up", emailAlert: true, smsAlert: false },
    ],
  },
  "Downtown CoWork": {
    businessUnit: "Downtown CoWork",
    totalInterfaces: 2,
    emailOnFluctuation: true,
    lines: [
      { wan: "WAN1", provider: "Jio", connectionType: "Broadband", bandwidthMbps: 400, thresholdMbps: 80, status: "down", emailAlert: true, smsAlert: true },
      { wan: "WAN2", provider: "BSNL", connectionType: "Broadband", bandwidthMbps: 200, thresholdMbps: 40, status: "up", emailAlert: false, smsAlert: false },
    ],
  },
  "Eastside Cafe": {
    businessUnit: "Eastside Cafe",
    totalInterfaces: 1,
    emailOnFluctuation: false,
    lines: [
      { wan: "WAN1", provider: "Airtel", connectionType: "Broadband", bandwidthMbps: 100, thresholdMbps: 20, status: "up", emailAlert: false, smsAlert: false },
    ],
  },
  "Airport Lounge T3": {
    businessUnit: "Airport Lounge T3",
    totalInterfaces: 2,
    emailOnFluctuation: true,
    lines: [
      { wan: "WAN1", provider: "Tata Communications", connectionType: "Leased Line", bandwidthMbps: 1000, thresholdMbps: 200, status: "up", emailAlert: true, smsAlert: true },
      { wan: "WAN2", provider: "Airtel", connectionType: "Broadband", bandwidthMbps: 300, thresholdMbps: 60, status: "up", emailAlert: true, smsAlert: false },
    ],
  },
};

interface IspState {
  configs: Record<string, IspConfig>;
  saveConfig: (config: IspConfig) => void;
  toggleLineStatus: (businessUnit: string, wan: string) => void;
}

export const useIspStore = create<IspState>()(
  persist(
    (set) => ({
      configs: SEED,
      saveConfig: (config) => set((s) => ({ configs: { ...s.configs, [config.businessUnit]: config } })),
      toggleLineStatus: (businessUnit, wan) =>
        set((s) => {
          const cfg = s.configs[businessUnit];
          if (!cfg) return s;
          return {
            configs: {
              ...s.configs,
              [businessUnit]: { ...cfg, lines: cfg.lines.map((l) => (l.wan === wan ? { ...l, status: l.status === "up" ? "down" : "up" } : l)) },
            },
          };
        }),
    }),
    { name: "cg-isp-config" },
  ),
);
