/** The signed-in ISP, its user and grants, from `GET /isp/me`. */
import { createContext, useContext } from "react";
import type { IspMe } from "@/services/isp-partner/types";

export interface PartnerContextValue {
  me: IspMe;
  can: (permission: string) => boolean;
  /** True for owner/admin: never confined, may manage staff fully. */
  isOwnerOrAdmin: boolean;
}

export const PartnerContext = createContext<PartnerContextValue | null>(null);

export function usePartner(): PartnerContextValue {
  const ctx = useContext(PartnerContext);
  if (!ctx) throw new Error("usePartner() outside the partner layout");
  return ctx;
}

export function buildPartnerContext(me: IspMe): PartnerContextValue {
  const granted = new Set(me.permissions ?? []);
  return {
    me,
    can: (p) => granted.has(p),
    isOwnerOrAdmin: me.user.role === "isp-owner" || me.user.role === "isp-admin",
  };
}
