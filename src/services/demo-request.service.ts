import { api } from "@/services/api";
import type {
  DemoRequest,
  DemoRequestStatus,
  SubmitDemoRequestPayload,
  UpdateDemoRequestPayload,
} from "@/types/demo-request";

interface BackendDemoRequest {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  company_name: string;
  message: string | null;
  status: DemoRequestStatus;
  internal_notes: string | null;
  submitted_at: string;
  updated_at: string;
}

interface BackendDemoRequestListResponse {
  items: BackendDemoRequest[];
  page: number;
  page_size: number;
  total_items: number;
  total_pages: number;
  has_next: boolean;
  has_previous: boolean;
}

function toDemoRequest(r: BackendDemoRequest): DemoRequest {
  return {
    id: r.id,
    fullName: r.full_name,
    email: r.email,
    phone: r.phone,
    companyName: r.company_name,
    message: r.message,
    status: r.status,
    internalNotes: r.internal_notes,
    submittedAt: r.submitted_at,
    updatedAt: r.updated_at,
  };
}

export const demoRequestService = {
  /** Public "Book a Demo" form submission -- no auth, no
   * X-Organization-Id header. See app.domains.demo_request.router's
   * module docstring for the backend half (public POST, no RBAC). */
  async submit(payload: SubmitDemoRequestPayload): Promise<DemoRequest> {
    const { data } = await api.post<BackendDemoRequest>("/demo-requests", {
      full_name: payload.fullName,
      email: payload.email,
      phone: payload.phone || undefined,
      company_name: payload.companyName,
      message: payload.message || undefined,
    });
    return toDemoRequest(data);
  },

  /** Master console -- lists every submitted demo request, gated by
   * demo_requests.read. */
  async list(params?: { status?: DemoRequestStatus; search?: string }): Promise<DemoRequest[]> {
    const { data } = await api.get<BackendDemoRequestListResponse>("/demo-requests", {
      params: { page_size: 100, ...params },
    });
    return data.items.map(toDemoRequest);
  },

  /** Master console -- updates a demo request's status/internal notes,
   * gated by demo_requests.manage. */
  async update(demoRequestId: string, payload: UpdateDemoRequestPayload): Promise<DemoRequest> {
    const { data } = await api.patch<BackendDemoRequest>(`/demo-requests/${demoRequestId}`, {
      status: payload.status,
      internal_notes: payload.internalNotes,
    });
    return toDemoRequest(data);
  },
};
