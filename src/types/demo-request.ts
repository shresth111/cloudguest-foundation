export type DemoRequestStatus = "new" | "contacted" | "scheduled" | "closed";

export interface DemoRequest {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  companyName: string;
  message: string | null;
  status: DemoRequestStatus;
  internalNotes: string | null;
  submittedAt: string;
  updatedAt: string;
}

export interface SubmitDemoRequestPayload {
  fullName: string;
  email: string;
  phone?: string;
  companyName: string;
  message?: string;
}

export interface UpdateDemoRequestPayload {
  status?: DemoRequestStatus;
  internalNotes?: string;
}

export const DEMO_REQUEST_STATUS_LABEL: Record<DemoRequestStatus, string> = {
  new: "New",
  contacted: "Contacted",
  scheduled: "Scheduled",
  closed: "Closed",
};
