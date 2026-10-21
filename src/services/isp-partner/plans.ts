/** ADDENDUM_02 §8 endpoints: speed groups, packages, coupons, subscribers. */
import api from "@/services/api";
import { cleanParams, downloadFile, type FileDownload } from "@/services/isp-partner/isp";
import type { IspPage } from "@/services/isp-partner/types";
import type {
  Coupon,
  CouponBatch,
  CouponBatchBody,
  CouponLayout,
  IspPackage,
  LadderBody,
  LadderResult,
  PackageBody,
  PackagePatch,
  PlanSettings,
  SpeedGroup,
  SpeedGroupBody,
  Subscriber,
  SubscriberCreate,
  SubscriberDetail,
  SubscriberPatch,
} from "@/services/isp-partner/plans-types";

type Q = Record<string, string | number | boolean | undefined | null>;

export const plansService = {
  // speed groups
  async listGroups(q: Q): Promise<IspPage<SpeedGroup>> {
    const { data } = await api.get<IspPage<SpeedGroup>>("/isp/speed-groups", {
      params: cleanParams(q),
    });
    return data;
  },
  async createGroup(body: SpeedGroupBody): Promise<SpeedGroup> {
    const { data } = await api.post<SpeedGroup>("/isp/speed-groups", body);
    return data;
  },
  async updateGroup(id: string, body: Partial<SpeedGroupBody>): Promise<SpeedGroup> {
    const { data } = await api.patch<SpeedGroup>(`/isp/speed-groups/${id}`, body);
    return data;
  },
  async setGroupEnabled(id: string, enabled: boolean): Promise<SpeedGroup> {
    const { data } = await api.post<SpeedGroup>(
      `/isp/speed-groups/${id}/${enabled ? "enable" : "disable"}`,
    );
    return data;
  },
  async deleteGroup(id: string): Promise<void> {
    await api.delete(`/isp/speed-groups/${id}`);
  },

  // packages
  async listPackages(q: Q): Promise<IspPage<IspPackage>> {
    const { data } = await api.get<IspPage<IspPackage>>("/isp/packages", {
      params: cleanParams(q),
    });
    return data;
  },
  async createPackage(body: PackageBody): Promise<IspPackage> {
    const { data } = await api.post<IspPackage>("/isp/packages", body);
    return data;
  },
  async updatePackage(id: string, body: PackagePatch): Promise<IspPackage> {
    const { data } = await api.patch<IspPackage>(`/isp/packages/${id}`, body);
    return data;
  },
  async duplicatePackage(
    id: string,
    body: { validity_days: number; price_paise: number; name: string | null },
  ): Promise<IspPackage> {
    const { data } = await api.post<IspPackage>(`/isp/packages/${id}/duplicate`, body);
    return data;
  },
  async setPackageEnabled(id: string, enabled: boolean): Promise<IspPackage> {
    const { data } = await api.post<IspPackage>(
      `/isp/packages/${id}/${enabled ? "enable" : "disable"}`,
    );
    return data;
  },
  async deletePackage(id: string): Promise<void> {
    await api.delete(`/isp/packages/${id}`);
  },
  async ladder(body: LadderBody): Promise<LadderResult> {
    const { data } = await api.post<LadderResult>("/isp/packages/ladder", body);
    return data;
  },
  async suggestName(q: {
    speed_group_id: string;
    type: string;
    validity_days: number;
  }): Promise<string> {
    const { data } = await api.get<string | { name: string }>("/isp/packages/suggest-name", {
      params: cleanParams(q),
    });
    return typeof data === "string" ? data : (data?.name ?? "");
  },
  async getPlanSettings(): Promise<PlanSettings> {
    const { data } = await api.get<PlanSettings>("/isp/plan-settings");
    return data;
  },
  async putPlanSettings(body: PlanSettings): Promise<PlanSettings> {
    const { data } = await api.put<PlanSettings>("/isp/plan-settings", body);
    return data;
  },

  // coupons
  async createBatch(body: CouponBatchBody): Promise<CouponBatch> {
    const { data } = await api.post<CouponBatch>("/isp/coupon-batches", body);
    return data;
  },
  async listBatches(q: Q): Promise<IspPage<CouponBatch>> {
    const { data } = await api.get<IspPage<CouponBatch>>("/isp/coupon-batches", {
      params: cleanParams(q),
    });
    return data;
  },
  async getBatch(id: string): Promise<CouponBatch> {
    const { data } = await api.get<CouponBatch>(`/isp/coupon-batches/${id}`);
    return data;
  },
  async listCoupons(batchId: string, q: Q): Promise<IspPage<Coupon>> {
    const { data } = await api.get<IspPage<Coupon>>(`/isp/coupon-batches/${batchId}/coupons`, {
      params: cleanParams(q),
    });
    return data;
  },
  exportBatchCsv(batchId: string): Promise<FileDownload> {
    return downloadFile(
      `/isp/coupon-batches/${batchId}/export.csv`,
      {},
      `coupons-${batchId.slice(0, 8)}.csv`,
    );
  },
  printBatch(batchId: string, layout: CouponLayout): Promise<FileDownload> {
    return downloadFile(
      `/isp/coupon-batches/${batchId}/print.pdf`,
      { layout },
      `coupons-${batchId.slice(0, 8)}-${layout}.pdf`,
    );
  },
  async revokeBatch(batchId: string): Promise<CouponBatch> {
    const { data } = await api.post<CouponBatch>(`/isp/coupon-batches/${batchId}/revoke`);
    return data;
  },
  async revokeCoupon(couponId: string): Promise<Coupon> {
    const { data } = await api.post<Coupon>(`/isp/coupons/${couponId}/revoke`);
    return data;
  },

  // subscribers
  async listSubscribers(q: Q): Promise<IspPage<Subscriber>> {
    const { data } = await api.get<IspPage<Subscriber>>("/isp/subscribers", {
      params: cleanParams(q),
    });
    return data;
  },
  async getSubscriber(id: string): Promise<SubscriberDetail> {
    const { data } = await api.get<SubscriberDetail>(`/isp/subscribers/${id}`);
    return data;
  },
  async createSubscriber(body: SubscriberCreate): Promise<Subscriber> {
    const { data } = await api.post<Subscriber>("/isp/subscribers", body);
    return data;
  },
  async updateSubscriber(id: string, body: SubscriberPatch): Promise<Subscriber> {
    const { data } = await api.patch<Subscriber>(`/isp/subscribers/${id}`, body);
    return data;
  },
  async setSubscriberEnabled(id: string, enabled: boolean): Promise<Subscriber> {
    const { data } = await api.post<Subscriber>(
      `/isp/subscribers/${id}/${enabled ? "enable" : "disable"}`,
    );
    return data;
  },
};
