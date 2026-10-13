/**
 * Wire types for the MASTER flow table (wyfy-specs/flow-visibility/API.md,
 * F-1 and F-2): the shared shape plus what only this console receives, the
 * two platform switches and the address the record was exported from.
 * Nothing under the customer dashboard may import this file.
 */
import type { FlowRecordBase, FlowRecordsPage } from "@/types/flow-records";

export type {
  FlowIncompleteStretch,
  FlowRecordFilterForm,
  FlowRecordSort,
  FlowRecordSortKey,
  FlowRecordsExport,
} from "@/types/flow-records";

export interface FlowRecord extends FlowRecordBase {
  exporter: string | null;
}

export interface FlowRecordsResult extends FlowRecordsPage<FlowRecord> {
  feature_enabled: boolean;
  records_enabled: boolean;
}
