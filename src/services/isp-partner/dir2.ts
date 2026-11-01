/**
 * DIR-2 (BE flag `ISP_DIR2_ENABLED`, default off -> 404): directory export
 * and bulk renew / block / unblock / freeze / unfreeze / move, each with a
 * dry run first.
 */
import api from "@/services/api";
import { cleanParams, downloadFile, type FileDownload } from "@/services/isp-partner/isp";

export interface DirFilter {
  state?: string;
  search?: string;
  isp_customer_id?: string;
  package_id?: string;
  zone_id?: string;
}

export interface BulkSelection {
  subscriber_ids?: string[];
  filter?: DirFilter;
}

export type BulkStatusAction = "block" | "unblock" | "freeze" | "unfreeze";

export interface BulkResult {
  dry_run: boolean;
  matched: number;
  eligible: number;
  skipped: { id: string; reason: string }[];
  applied?: number;
  failed?: { id: string; reason: string; message: string }[];
  /** SMALL-1: present only when a renew carried a discount code. */
  discount?: BulkDiscountSummary;
}

/** SMALL-1: per-subscriber quote of the code (pre-tax, DISCOUNT-WIRE maths). */
export interface BulkDiscountQuote {
  id: string;
  identifier: string;
  /** Already renewed under this bulk key: replays its first invoice, no new use. */
  replay: boolean;
  package_id?: string;
  taxable_before_paise?: number;
  discount_paise: number;
  taxable_after_paise?: number;
  label: string | null;
}

export interface BulkDiscountSummary {
  code: string;
  kind: "percent" | "flat";
  value: number;
  remaining_uses_before: number | null;
  subscribers_discounted: number;
  total_discount_paise: number;
  per_subscriber: BulkDiscountQuote[];
}

export const SKIP_REASON_LABEL: Record<string, string> = {
  not_found: "not found / outside your scope",
  blocked: "blocked",
  frozen: "frozen",
  disabled: "disabled",
  no_package: "no package",
  already_blocked: "already blocked",
  not_blocked: "not blocked",
  permanent_owner_only: "permanently blocked (owner/admin only)",
  already_frozen: "already frozen",
  no_validity_left: "no validity left to pause",
  not_frozen: "not frozen",
  already_there: "already under that customer",
  // SMALL-1: discount code on bulk renew (these subscribers are not renewed)
  discount_not_for_package: "code not valid for their package",
  discount_below_minimum: "bill below the code's minimum",
  discount_nothing_to_discount: "no price to discount",
  discount_used_up: "code used up before reaching them",
  package_not_found: "package not found",
};

type Run = { dry_run: boolean; bulk_key?: string };

export const dir2Service = {
  async capabilities(): Promise<{ enabled: boolean; max_subscribers: number }> {
    const { data } = await api.get<{ enabled: boolean; max_subscribers: number }>(
      "/isp/subscriber-bulk",
    );
    return data;
  },
  exportDirectory(filter: DirFilter, format: "csv" | "xlsx"): Promise<FileDownload> {
    return downloadFile(
      "/isp/subscriber-directory/export",
      cleanParams({ ...filter, format }),
      `subscribers.${format}`,
    );
  },
  async renew(
    sel: BulkSelection,
    run: Run,
    extra: { cycles?: number; discount_code?: string } = {},
  ) {
    const code = extra.discount_code?.trim();
    const { data } = await api.post<BulkResult>("/isp/subscriber-bulk/renew", {
      ...sel,
      ...run,
      ...(extra.cycles && extra.cycles > 1 ? { cycles: extra.cycles } : {}),
      ...(code ? { discount_code: code } : {}),
    });
    return data;
  },
  async status(sel: BulkSelection, run: Run, action: BulkStatusAction, reason?: string) {
    const { data } = await api.post<BulkResult>("/isp/subscriber-bulk/status", {
      ...sel,
      ...run,
      action,
      reason: reason || undefined,
    });
    return data;
  },
  async move(sel: BulkSelection, run: Run, ispCustomerId: string, reason?: string) {
    const { data } = await api.post<BulkResult>("/isp/subscriber-bulk/move", {
      ...sel,
      ...run,
      isp_customer_id: ispCustomerId,
      reason: reason || undefined,
    });
    return data;
  },
};
