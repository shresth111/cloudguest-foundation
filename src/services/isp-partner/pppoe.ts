/** `/isp/subscribers/{id}/pppoe*` and `/isp/pppoe/*` (lane JAZE-6). */
import api from "@/services/api";
import { cleanParams } from "@/services/isp-partner/isp";
import type { IspPage } from "@/services/isp-partner/types";
import type {
  PppoeCredential,
  PppoeCredentialBody,
  PppoeCredentialSaved,
  PppoeKickResult,
  PppoeScriptParams,
  PppoeSession,
  PppoeSessionQuery,
  PppoeStatus,
} from "@/services/isp-partner/pppoe-types";

const sub = (id: string) => `/isp/subscribers/${id}/pppoe`;

export const pppoeService = {
  /** 404 while `ISP_PPPOE_ENABLED` is off: the UI shows "not switched on". */
  async status(): Promise<PppoeStatus> {
    return (await api.get<PppoeStatus>("/isp/pppoe/status")).data;
  },
  async credential(subscriberId: string): Promise<PppoeCredential> {
    return (await api.get<PppoeCredential>(sub(subscriberId))).data;
  },
  async saveCredential(
    subscriberId: string,
    body: PppoeCredentialBody,
  ): Promise<PppoeCredentialSaved> {
    return (await api.put<PppoeCredentialSaved>(sub(subscriberId), body)).data;
  },
  async setEnabled(subscriberId: string, enabled: boolean): Promise<PppoeCredentialSaved> {
    return (
      await api.post<PppoeCredentialSaved>(`${sub(subscriberId)}/${enabled ? "enable" : "disable"}`)
    ).data;
  },
  async disconnectSubscriber(
    subscriberId: string,
  ): Promise<{ subscriber_id: string; results: PppoeKickResult[] }> {
    return (
      await api.post<{ subscriber_id: string; results: PppoeKickResult[] }>(
        `${sub(subscriberId)}/disconnect`,
      )
    ).data;
  },
  async sessions(q: PppoeSessionQuery): Promise<IspPage<PppoeSession>> {
    return (await api.get<IspPage<PppoeSession>>("/isp/pppoe/sessions", { params: cleanParams(q) }))
      .data;
  },
  async disconnectSession(sessionId: string): Promise<PppoeKickResult> {
    return (await api.post<PppoeKickResult>(`/isp/pppoe/sessions/${sessionId}/disconnect`)).data;
  },
  /** `text/plain` RouterOS script; carries the router's RADIUS secret, so it
   * is never cached and every fetch is audited. */
  async routerScript(ispRouterId: string, params: PppoeScriptParams): Promise<string> {
    const { data } = await api.get<string>(`/isp/pppoe/routers/${ispRouterId}/script`, {
      params: cleanParams(params),
      responseType: "text",
      headers: { Accept: "text/plain" },
    });
    return data;
  },
};
