/** JAZE-5 Apps endpoints. Ticket create / comment / types come from
 * SUB360-2's `helpdeskService` (re-used, not copied); everything else is
 * here. CSV exports use the shared `downloadFile`. */
import api from "@/services/api";
import { cleanParams, downloadFile, type FileDownload } from "@/services/isp-partner/isp";
import type { IspPage } from "@/services/isp-partner/types";
import { helpdeskService } from "@/services/isp-partner/workbench";
import type {
  AppsSettings,
  Checkout,
  Escalation,
  EscalationRule,
  EscalationRuleBody,
  StockLocation,
  Vendor,
  Announcement,
  AnnouncementBody,
  Discount,
  DiscountBody,
  DiscountPreview,
  ImportResult,
  InventoryItem,
  InventoryUnit,
  InventoryUnitDetail,
  Lead,
  LeadBody,
  LeadDetail,
  LeadQuery,
  Redemption,
  TaskBody,
  TaskQuery,
  TaskView,
  TicketDetail,
  TicketPatch,
  TicketQuery,
  TicketStats,
  TicketTypeBody,
  TicketTypeFull,
  TicketView,
  UnitQuery,
} from "@/services/isp-partner/apps-types";

const A = "/isp/apps";
const get = async <T>(url: string, params?: object): Promise<T> =>
  (await api.get<T>(url, params ? { params: cleanParams(params) } : undefined)).data;
const post = async <T>(url: string, body?: unknown): Promise<T> =>
  (await api.post<T>(url, body ?? {})).data;
const patch = async <T>(url: string, body: unknown): Promise<T> =>
  (await api.patch<T>(url, body)).data;
const csv = (path: string, q: object, name: string): Promise<FileDownload> =>
  downloadFile(`${A}${path}`, cleanParams(q), name);

export const appsService = {
  /** 404 = `ISP_APPS_ENABLED` is off: the whole section is hidden. */
  probe: () => get<TicketTypeFull[]>(`${A}/ticket-types`),

  // helpdesk -- create / comment / types: SUB360-2's helpdeskService
  createTicket: helpdeskService.create,
  comment: helpdeskService.comment,
  tickets: (q: TicketQuery) => get<IspPage<TicketView>>(`${A}/tickets`, q),
  ticket: (id: string) => get<TicketDetail>(`${A}/tickets/${id}`),
  patchTicket: (id: string, body: TicketPatch) => patch<TicketView>(`${A}/tickets/${id}`, body),
  ticketStats: (q: { isp_customer_id?: string; since?: string; until?: string }) =>
    get<TicketStats>(`${A}/tickets/stats`, q),
  ticketsCsv: (q: TicketQuery) =>
    csv("/tickets/export.csv", { ...q, page: undefined, page_size: undefined }, "tickets.csv"),
  ticketTypes: () => get<TicketTypeFull[]>(`${A}/ticket-types`),
  createTicketType: (body: TicketTypeBody) => post<TicketTypeFull>(`${A}/ticket-types`, body),
  patchTicketType: (id: string, body: TicketTypeBody) =>
    patch<TicketTypeFull>(`${A}/ticket-types/${id}`, body),
  seedTicketTypes: () => post<TicketTypeFull[]>(`${A}/ticket-types/defaults`),

  // tasks
  tasks: (q: TaskQuery) => get<IspPage<TaskView>>(`${A}/tasks`, q),
  task: (id: string) => get<TaskView>(`${A}/tasks/${id}`),
  createTask: (body: TaskBody) => post<TaskView>(`${A}/tasks`, body),
  patchTask: (id: string, body: TaskBody) => patch<TaskView>(`${A}/tasks/${id}`, body),
  claimTask: (id: string) => post<TaskView>(`${A}/tasks/${id}/claim`),
  tasksCsv: (q: TaskQuery) =>
    csv(
      "/tasks/export.csv",
      { ...q, mine: undefined, page: undefined, page_size: undefined },
      "tasks.csv",
    ),

  // announcements
  announcements: (page = 1) =>
    get<IspPage<Announcement>>(`${A}/announcements`, { page, page_size: 25 }),
  announcement: (id: string) => get<Announcement>(`${A}/announcements/${id}`),
  createAnnouncement: (body: AnnouncementBody) => post<Announcement>(`${A}/announcements`, body),
  patchAnnouncement: (id: string, body: AnnouncementBody) =>
    patch<Announcement>(`${A}/announcements/${id}`, body),
  deleteAnnouncement: async (id: string) => {
    await api.delete(`${A}/announcements/${id}`);
  },
  sendAnnouncement: (id: string) => post<Announcement>(`${A}/announcements/${id}/send`),

  // discounts
  discounts: (q: { active?: boolean; page?: number }) =>
    get<IspPage<Discount>>(`${A}/discounts`, { ...q, page_size: 50 }),
  createDiscount: (body: DiscountBody) => post<Discount>(`${A}/discounts`, body),
  patchDiscount: (id: string, body: DiscountBody) => patch<Discount>(`${A}/discounts/${id}`, body),
  previewDiscount: (body: { code: string; gross_paise: number; package_id?: string | null }) =>
    post<DiscountPreview>(`${A}/discounts/preview`, body),
  redemptions: (id: string) => get<Redemption[]>(`${A}/discounts/${id}/redemptions`),

  // inventory
  items: () => get<InventoryItem[]>(`${A}/inventory/items`),
  createItem: (body: { name: string; sku: string; category: string; notes?: string | null }) =>
    post<InventoryItem>(`${A}/inventory/items`, body),
  patchItem: (
    id: string,
    body: { name?: string; sku?: string; category?: string; notes?: string | null },
  ) => patch<InventoryItem>(`${A}/inventory/items/${id}`, body),
  units: (q: UnitQuery) => get<IspPage<InventoryUnit>>(`${A}/inventory/units`, q),
  unit: (id: string) => get<InventoryUnitDetail>(`${A}/inventory/units/${id}`),
  addUnit: (body: { item_id: string; serial: string; mac?: string | null; note?: string | null }) =>
    post<InventoryUnit>(`${A}/inventory/units`, body),
  moveUnit: (
    id: string,
    body: {
      state: string;
      isp_customer_id?: string | null;
      subscriber_id?: string | null;
      note?: string | null;
    },
  ) => post<InventoryUnit>(`${A}/inventory/units/${id}/move`, body),
  importUnits: async (file: File): Promise<ImportResult> => {
    const form = new FormData();
    form.append("file", file);
    return (
      await api.post<ImportResult>(`${A}/inventory/units/import`, form, {
        headers: { "Content-Type": undefined },
      })
    ).data;
  },
  unitsCsv: (q: UnitQuery) =>
    csv(
      "/inventory/units/export.csv",
      { ...q, page: undefined, page_size: undefined },
      "units.csv",
    ),

  // leads
  leads: (q: LeadQuery) => get<IspPage<Lead>>(`${A}/leads`, q),
  lead: (id: string) => get<LeadDetail>(`${A}/leads/${id}`),
  funnel: () => get<Record<string, number>>(`${A}/leads/funnel`),
  createLead: (body: LeadBody) => post<Lead>(`${A}/leads`, body),
  patchLead: (id: string, body: LeadBody) => patch<Lead>(`${A}/leads/${id}`, body),
  scheduleInstall: (
    id: string,
    body: {
      title?: string | null;
      notes?: string | null;
      scheduled_at?: string | null;
      assignee_user_id?: string | null;
    },
  ) => post<LeadDetail>(`${A}/leads/${id}/install`, body),
  /** JAZE-5's own convert; used only while the CAF workbench is off (with it
   * on, conversion happens there so the CAF fields follow the lead). */
  convertLead: (
    id: string,
    body: { identifier: string; package_id?: string | null; isp_customer_id?: string | null },
  ) => post<LeadDetail>(`${A}/leads/${id}/convert`, body),
  leadsCsv: (q: LeadQuery) =>
    csv("/leads/export.csv", { ...q, page: undefined, page_size: undefined }, "leads.csv"),

  // ---------------------------------------------------------------- APPS-2
  settings: () => get<AppsSettings>(`${A}/settings`),
  saveSettings: async (body: Partial<AppsSettings>) =>
    (await api.put<AppsSettings>(`${A}/settings`, body)).data,
  escalationRules: () => get<EscalationRule[]>(`${A}/escalation-rules`),
  createEscalationRule: (body: EscalationRuleBody) =>
    post<EscalationRule>(`${A}/escalation-rules`, body),
  patchEscalationRule: (id: string, body: EscalationRuleBody) =>
    patch<EscalationRule>(`${A}/escalation-rules/${id}`, body),
  deleteEscalationRule: async (id: string) => {
    await api.delete(`${A}/escalation-rules/${id}`);
  },
  escalations: (page = 1) => get<IspPage<Escalation>>(`${A}/escalations`, { page, page_size: 25 }),
  approveTask: (id: string, note?: string | null) =>
    post<TaskView>(`${A}/tasks/${id}/approve`, { note: note || null }),
  sendBackTask: (id: string, note: string) =>
    post<TaskView>(`${A}/tasks/${id}/send-back`, { note }),
  vendors: () => get<Vendor[]>(`${A}/inventory/vendors`),
  createVendor: (body: Partial<Vendor>) => post<Vendor>(`${A}/inventory/vendors`, body),
  patchVendor: (id: string, body: Partial<Vendor>) =>
    patch<Vendor>(`${A}/inventory/vendors/${id}`, body),
  locations: () => get<StockLocation[]>(`${A}/inventory/locations`),
  createLocation: (body: Partial<StockLocation>) =>
    post<StockLocation>(`${A}/inventory/locations`, body),
  patchLocation: (id: string, body: Partial<StockLocation>) =>
    patch<StockLocation>(`${A}/inventory/locations/${id}`, body),
  putUnitMeta: async (
    id: string,
    body: {
      vendor_id?: string | null;
      stock_location_id?: string | null;
      tr069_device_id?: string | null;
    },
  ) => (await api.put<InventoryUnit>(`${A}/inventory/units/${id}/meta`, body)).data,
  requestCheckout: (
    id: string,
    body: {
      isp_customer_id: string;
      subscriber_id?: string | null;
      task_id?: string | null;
      note?: string | null;
    },
  ) => post<Checkout>(`${A}/inventory/units/${id}/checkout`, body),
  checkouts: (status?: string) => get<Checkout[]>(`${A}/inventory/checkouts`, { status }),
  approveCheckout: (id: string, note?: string | null) =>
    post<Checkout>(`${A}/inventory/checkouts/${id}/approve`, { note: note || null }),
  rejectCheckout: (id: string, note?: string | null) =>
    post<Checkout>(`${A}/inventory/checkouts/${id}/reject`, { note: note || null }),

  /** Is the CAF-2 workbench on? (its options route 404s while off) */
  cafOn: async (): Promise<boolean> => {
    try {
      await api.get("/isp/caf/options");
      return true;
    } catch {
      return false;
    }
  },
};
