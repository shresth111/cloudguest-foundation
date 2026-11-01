/** CAF-2 workbench (`/isp/caf/*`, BE `isp_partner/caf_router.py`, flag
 * `ISP_CAF_WORKBENCH_ENABLED`, default OFF -> every route 404s).
 *
 * The ID number in every response is already masked by the backend
 * (Aadhaar: `XXXX XXXX 1234`; only the last four digits are stored). */
import api from "@/services/api";
import { downloadFile, type FileDownload } from "@/services/isp-partner/isp";

export const APPLICANT_CATEGORIES = [
  "individual",
  "proprietor",
  "partnership",
  "pvt_ltd",
  "public_ltd",
  "other",
] as const;
export type ApplicantCategory = (typeof APPLICANT_CATEGORIES)[number];

export interface CafProfile {
  signatory_name: string | null;
  signatory_designation: string | null;
  stamp_set: boolean;
  licence_number: string | null;
  licence_category: string | null;
  legal_name: string | null;
  gstin: string | null;
}

export interface CafOptions {
  leads: boolean;
  convert_leads: boolean;
  applicant_categories: ApplicantCategory[];
  id_types: string[];
  export_max: number;
  profile: CafProfile;
}

export type CafSource = "subscriber" | "lead";

export interface CafHit {
  source: CafSource;
  id: string;
  label: string;
  detail: string;
  status: string;
  converted_subscriber_id: string | null;
  caf_number: string | null;
}

export interface CafExtras {
  applicant_category: ApplicantCategory;
  applicant_category_other?: string | null;
  father_or_spouse_name?: string | null;
  plot_no?: string | null;
  locality?: string | null;
  district?: string | null;
}

export interface CafSubscriberBlock {
  id: string;
  circuit_id: number;
  username: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  gstin: string | null;
  address: string | null;
  billing_city: string | null;
  billing_pincode: string | null;
  install_same_as_billing: boolean;
  install_address: string | null;
  install_city: string | null;
  install_pincode: string | null;
  package_name: string | null;
  customer_name: string | null;
  isp_customer_id: string;
}

export type CafMissing = "kyc" | "photo" | "signature" | "licence_number";

export interface CafSubscriberPrefill {
  source: "subscriber";
  subscriber: CafSubscriberBlock;
  /** JAZE-3 `kyc_view`, masked. */
  kyc: {
    applicant_type: string;
    full_name: string | null;
    father_or_spouse_name: string | null;
    date_of_birth: string | null;
    permanent_address: string | null;
    installation_address: string | null;
    id_proof_type: string | null;
    id_number: string | null;
    caf_number: string | null;
  } | null;
  documents: { photo: boolean; signature: boolean };
  extras: CafExtras;
  extras_saved: boolean;
  caf_number: string | null;
  caf_generated_at: string | null;
  missing: CafMissing[];
}

export interface CafLeadPrefill {
  source: "lead";
  lead: {
    id: string;
    number: string;
    name: string;
    phone: string | null;
    email: string | null;
    address: string | null;
    city: string | null;
    status: string;
    isp_customer_id: string | null;
    customer_name: string | null;
    interested_package_id: string | null;
    converted_subscriber_id: string | null;
  };
  extras: CafExtras;
  extras_saved: boolean;
}

export interface CafExportBody {
  subscriber_ids?: string[];
  /** Plain `YYYY-MM-DD` (BE `date`), never `toISOString()`. */
  since?: string;
  until?: string;
}

const C = "/isp/caf";

export const cafService = {
  async options(): Promise<CafOptions> {
    return (await api.get<CafOptions>(`${C}/options`)).data;
  },
  async search(q: string, source: CafSource): Promise<CafHit[]> {
    return (await api.get<CafHit[]>(`${C}/search`, { params: { q, source } })).data;
  },
  async subscriber(id: string): Promise<CafSubscriberPrefill> {
    return (await api.get<CafSubscriberPrefill>(`${C}/subscribers/${id}`)).data;
  },
  async saveSubscriberExtras(id: string, body: Partial<CafExtras>): Promise<CafExtras> {
    return (await api.put<CafExtras>(`${C}/subscribers/${id}/extras`, body)).data;
  },
  async assignNumber(
    id: string,
    body: { mode: "auto" } | { mode: "custom"; number: string },
  ): Promise<{ caf_number: string; source: string }> {
    return (
      await api.post<{ caf_number: string; source: string }>(`${C}/subscribers/${id}/number`, body)
    ).data;
  },
  pdf(id: string): Promise<FileDownload> {
    return downloadFile(`${C}/subscribers/${id}/caf.pdf`, {}, "caf.pdf");
  },
  async lead(id: string): Promise<CafLeadPrefill> {
    return (await api.get<CafLeadPrefill>(`${C}/leads/${id}`)).data;
  },
  async saveLeadExtras(id: string, body: Partial<CafExtras>): Promise<CafExtras> {
    return (await api.put<CafExtras>(`${C}/leads/${id}/extras`, body)).data;
  },
  async convertLead(
    id: string,
    body: {
      identifier?: string | null;
      package_id?: string | null;
      isp_customer_id?: string | null;
    },
  ): Promise<CafSubscriberPrefill> {
    return (await api.post<CafSubscriberPrefill>(`${C}/leads/${id}/convert`, body)).data;
  },
  async exportZip(body: CafExportBody): Promise<FileDownload> {
    const res = await api.post<Blob>(`${C}/export`, body, {
      responseType: "blob",
      timeout: 300_000,
    });
    const cd = String(res.headers["content-disposition"] ?? "");
    const m = /filename="?([^";]+)"?/.exec(cd);
    return { blob: res.data, filename: m?.[1] ?? "caf-export.zip" };
  },
  async saveProfile(body: {
    signatory_name?: string | null;
    signatory_designation?: string | null;
  }): Promise<CafProfile> {
    return (await api.put<CafProfile>(`${C}/profile`, body)).data;
  },
  async uploadStamp(file: File): Promise<CafProfile> {
    const form = new FormData();
    form.append("file", file);
    return (
      await api.post<CafProfile>(`${C}/profile/stamp`, form, {
        headers: { "Content-Type": undefined },
      })
    ).data;
  },
  async removeStamp(): Promise<CafProfile> {
    return (await api.delete<CafProfile>(`${C}/profile/stamp`)).data;
  },
};
