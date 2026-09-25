import { useState } from "react";
import { Users } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { LoadingSkeleton } from "@/components/common/LoadingSkeleton";
import { useCampaignRecipients } from "@/hooks/useMarketing";
import {
  RECIPIENT_STATUSES,
  type CampaignRecipient,
  type RecipientStatus,
} from "@/types/marketing";
import { Pager, RecipientStatusTag } from "../marketing-ui";
import { SKIP_REASON_LABEL, formatDateTime, marketingErrorMessage } from "../marketing-helpers";

/** The one line under a recipient's status that says why, if anything went
 * other than to plan: the skip reason, or the provider's own error text. */
export function RecipientDetail({ r }: { r: CampaignRecipient }) {
  if (r.status === "skipped" && r.skip_reason) {
    return (
      <p className="mt-0.5 text-[11px] text-muted-foreground">
        {SKIP_REASON_LABEL[r.skip_reason] ?? r.skip_reason}
      </p>
    );
  }
  if (r.status === "failed" && (r.error_message || r.error_code)) {
    return (
      <p
        className="mt-0.5 max-w-xs break-words text-[11px] text-red-600"
        title={r.error_message ?? undefined}
      >
        {r.error_message ?? r.error_code}
        {r.attempt_count > 1 ? ` (after ${r.attempt_count} attempts)` : ""}
      </p>
    );
  }
  return null;
}

/** Per-recipient delivery log for one campaign (spec §5.6). */
export function RecipientsTable({ campaignId, live }: { campaignId: string; live: boolean }) {
  const [status, setStatus] = useState<"all" | RecipientStatus>("all");
  const [page, setPage] = useState(1);
  const list = useCampaignRecipients(
    campaignId,
    { status: status === "all" ? undefined : [status], page, page_size: 25 },
    live,
  );
  const rows = list.data?.items ?? [];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold">Recipients</h4>
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v as typeof status);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-44" aria-label="Filter by status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {RECIPIENT_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                <RecipientStatusTag status={s} />
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {list.isLoading ? (
        <LoadingSkeleton rows={4} />
      ) : list.isError ? (
        <ErrorState
          title="Couldn't load recipients"
          description={marketingErrorMessage(list.error)}
          onRetry={() => void list.refetch()}
        />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No recipients"
          description={
            status === "all"
              ? "Recipients are picked when the campaign starts sending, from guests who are opted in at that moment."
              : "No recipients have this status."
          }
        />
      ) : (
        <>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Guest</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden sm:table-cell">When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <p className="font-medium">
                        {r.display_name ?? <span className="text-muted-foreground">No name</span>}
                      </p>
                      <p className="font-mono text-xs text-muted-foreground">{r.masked_address}</p>
                    </TableCell>
                    <TableCell>
                      <RecipientStatusTag status={r.status} />
                      <RecipientDetail r={r} />
                    </TableCell>
                    <TableCell className="hidden text-xs text-muted-foreground sm:table-cell">
                      {formatDateTime(r.delivered_at ?? r.failed_at ?? r.submitted_at)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Pager
            page={list.data?.page ?? page}
            totalPages={list.data?.total_pages ?? 1}
            totalItems={list.data?.total_items ?? 0}
            onPage={setPage}
            busy={list.isFetching}
          />
        </>
      )}
    </div>
  );
}
