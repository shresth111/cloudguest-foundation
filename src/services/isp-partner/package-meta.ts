/**
 * PKG-2: package type + connection type (`/isp/package-meta`, BE flag
 * `ISP_PACKAGE_META_ENABLED`, default off -> 404). Labels for filtering only.
 */
import api from "@/services/api";

export type PackageKind = "home" | "commercial" | "sme" | "enterprise";
export type ConnectionKind = "wireless" | "fiber" | "ethernet";

export interface PackageMeta {
  package_id: string;
  package_type: PackageKind | null;
  connection_type: ConnectionKind | null;
}

export const PACKAGE_KIND_LABEL: Record<PackageKind, string> = {
  home: "Home",
  commercial: "Commercial",
  sme: "SME",
  enterprise: "Enterprise",
};

export const CONNECTION_KIND_LABEL: Record<ConnectionKind, string> = {
  wireless: "Wireless",
  fiber: "Fiber",
  ethernet: "Ethernet",
};

export const packageMetaService = {
  async list(): Promise<PackageMeta[]> {
    const { data } = await api.get<{ items: PackageMeta[] }>("/isp/package-meta");
    return data.items;
  },
  async put(
    packageId: string,
    body: { package_type: PackageKind | null; connection_type: ConnectionKind | null },
  ): Promise<PackageMeta> {
    const { data } = await api.put<PackageMeta>(`/isp/package-meta/${packageId}`, body);
    return data;
  },
};
