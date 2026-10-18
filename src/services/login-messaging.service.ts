import { api } from "@/services/api";
import type {
  LoginChannel,
  LoginMessagingOverview,
  LoginMessagingTarget,
  LoginProviderPut,
  LoginProviderView,
  VerifyStartResult,
} from "@/types/login-messaging";

/**
 * Login messaging API. Two bases over the same backend service:
 *
 *  - `own`: `/guest-messaging/providers` -- the organization is the
 *    caller's (the interceptor's `X-Organization-Id`); pinned ORGANIZATION.
 *  - `platform`: `/platform/organizations/{id}/guest-messaging/providers` --
 *    the Wyfy team acting for that organization; pinned GLOBAL on the
 *    backend, the organization comes from the path only.
 *
 * Secrets never round-trip: a secret the operator did not retype is left
 * out of the PUT and the server keeps the stored one.
 */
function base(target: LoginMessagingTarget): string {
  return target.kind === "own"
    ? "/guest-messaging/providers"
    : `/platform/organizations/${encodeURIComponent(target.organizationId)}/guest-messaging/providers`;
}

export const loginMessagingService = {
  async overview(target: LoginMessagingTarget): Promise<LoginMessagingOverview> {
    const { data } = await api.get<LoginMessagingOverview>(base(target));
    return data;
  },

  async put(
    target: LoginMessagingTarget,
    channel: LoginChannel,
    body: LoginProviderPut,
  ): Promise<LoginProviderView> {
    const { data } = await api.put<LoginProviderView>(
      `${base(target)}/${encodeURIComponent(channel)}`,
      body,
    );
    return data;
  },

  async remove(target: LoginMessagingTarget, channel: LoginChannel): Promise<unknown> {
    const { data } = await api.delete(`${base(target)}/${encodeURIComponent(channel)}`);
    return data;
  },

  /** Sends a real code through the venue's account to `to`. */
  async startVerify(
    target: LoginMessagingTarget,
    channel: LoginChannel,
    to: string,
  ): Promise<VerifyStartResult> {
    const { data } = await api.post<VerifyStartResult>(
      `${base(target)}/${encodeURIComponent(channel)}/verify`,
      { to },
      { timeout: 60_000 },
    );
    return data;
  },

  async confirmVerify(
    target: LoginMessagingTarget,
    channel: LoginChannel,
    code: string,
  ): Promise<LoginProviderView> {
    const { data } = await api.post<LoginProviderView>(
      `${base(target)}/${encodeURIComponent(channel)}/verify/confirm`,
      { code },
    );
    return data;
  },
};
