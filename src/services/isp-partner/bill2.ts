/**
 * BILL-2 (BE flag `ISP_BILL2_ENABLED`, default off -> 404): the GSTR-1
 * export and per-zone invoice branding.
 */
import api from "@/services/api";
import { downloadFile, type FileDownload } from "@/services/isp-partner/isp";

export type Gstr1Section = "all" | "b2b" | "b2cl" | "b2cs" | "cdnr" | "cdnur" | "hsn";

export const GSTR1_SECTION_LABEL: Record<Gstr1Section, string> = {
  all: "All sections (Excel, one sheet each)",
  b2b: "B2B: buyers with a GSTIN",
  b2cl: "B2CL: large inter-state, no GSTIN",
  b2cs: "B2CS: other consumers, by state and rate",
  cdnr: "CDNR: credit notes to GSTIN buyers",
  cdnur: "CDNUR: credit notes on B2CL invoices",
  hsn: "HSN/SAC summary",
};

export interface ZoneBranding {
  zone_id: string;
  invoice_name: string | null;
  bank_name: string | null;
  bank_account_name: string | null;
  bank_account_number: string | null;
  bank_ifsc: string | null;
  bank_branch: string | null;
  upi_vpa: string | null;
}

export type ZoneBrandingBody = Omit<ZoneBranding, "zone_id">;

export const bill2Service = {
  gstr1(month: string, section: Gstr1Section): Promise<FileDownload> {
    const format = section === "all" ? "xlsx" : "csv";
    return downloadFile(
      "/isp/gst/gstr1",
      { month, section, format },
      `gstr1-${month}${section === "all" ? "" : `-${section}`}.${format}`,
    );
  },
  async branding(zoneId: string): Promise<ZoneBranding> {
    const { data } = await api.get<ZoneBranding>(`/isp/zones/${zoneId}/branding`);
    return data;
  },
  async saveBranding(zoneId: string, body: ZoneBrandingBody): Promise<ZoneBranding> {
    const { data } = await api.put<ZoneBranding>(`/isp/zones/${zoneId}/branding`, body);
    return data;
  },
};
