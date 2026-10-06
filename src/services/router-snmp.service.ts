/**
 * Master console SNMP for one fleet device (`/platform/routers/{id}/snmp...`,
 * all GLOBAL-scoped on the backend). No organization header: the Master
 * caller's grant is platform-wide. Mapping lives in `@/lib/router-snmp`.
 */
import { api } from "@/services/api";
import {
  toSnmpApplyResult,
  toSnmpConfigBody,
  toSnmpDeviceState,
  toSnmpStatus,
  toSnmpTestResult,
  type RouterSnmpApplyResult,
  type RouterSnmpConfigInput,
  type RouterSnmpDeviceState,
  type RouterSnmpStatus,
  type RouterSnmpTestResult,
} from "@/lib/router-snmp";

type Raw = Record<string, unknown>;

/** A real SNMP round trip that gets no reply waits for the poller's timeout
 * plus one retry before it can say so; the default 20s axios ceiling would
 * turn an honest "no reply" into a client-side timeout. */
const DEVICE_CALL_TIMEOUT_MS = 45_000;

const base = (routerId: string) => `/platform/routers/${routerId}/snmp`;

export const routerSnmpService = {
  async status(routerId: string): Promise<RouterSnmpStatus> {
    const { data } = await api.get<Raw>(base(routerId));
    return toSnmpStatus(data);
  },

  async save(routerId: string, input: RouterSnmpConfigInput): Promise<RouterSnmpStatus> {
    const { data } = await api.put<Raw>(base(routerId), toSnmpConfigBody(input));
    return toSnmpStatus(data);
  },

  async test(routerId: string): Promise<RouterSnmpTestResult> {
    const { data } = await api.post<Raw>(`${base(routerId)}/test`, undefined, {
      timeout: DEVICE_CALL_TIMEOUT_MS,
    });
    return toSnmpTestResult(data);
  },

  async apply(routerId: string): Promise<RouterSnmpApplyResult> {
    const { data } = await api.post<Raw>(`${base(routerId)}/apply`, undefined, {
      timeout: DEVICE_CALL_TIMEOUT_MS,
    });
    return toSnmpApplyResult(data);
  },

  async deviceState(routerId: string): Promise<RouterSnmpDeviceState | null> {
    const { data } = await api.get<Raw>(`${base(routerId)}/device`, {
      timeout: DEVICE_CALL_TIMEOUT_MS,
    });
    return toSnmpDeviceState(data);
  },

  async script(routerId: string): Promise<{ action: string; lines: string[] }> {
    const { data } = await api.get<Raw>(`${base(routerId)}/script`);
    return {
      action: typeof data.action === "string" ? data.action : "apply",
      lines: Array.isArray(data.lines) ? data.lines.map(String) : [],
    };
  },
};
