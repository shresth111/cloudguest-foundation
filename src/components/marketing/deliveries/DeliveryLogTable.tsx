import { useState } from "react";
import { ScrollText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { useMarketingDeliveries } from "@/hooks/useMarketing";
import {
  MARKETING_CHANNELS,
  RECIPIENT_STATUSES,
  type MarketingChannel,
  type RecipientStatus,
} from "@/types/marketing";
import { ChannelTag, Pager, RecipientStatusTag } from "../marketing-ui";
import { formatDateTime, marketingErrorMessage, useChannelLabel } from "../marketing-helpers";
import { RecipientDetail } from "../campaigns/RecipientsTable";

/**
 * Delivery logs tab (spec §5.6 `GET /marketing/deliveries`): every message
 * across every campaign at this venue, newest first, masked.
 *
 * "Sent to provider" (`submitted`) is the strongest claim this log makes
 * for most rows: SMS and WhatsApp providers in MVP give no delivery
 * receipts, and carriers silently drop promotional SMS to DND numbers, so
 * "delivered" is only shown where a provider actually reported it.
 */
export function DeliveryLogTable({ onOpenCampaign }: { onOpenCampaign: (id: string) => void }) {
  const label = useChannelLabel();
  const [channel, setChannel] = useState<"all" | MarketingChannel>("all");
  const [status, setStatus] = useState<"all" | RecipientStatus>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const badRange = !!from && !!to && from > to;

  const list = useMarketingDeliveries({
    channel: channel === "all" ? undefined : channel,
    status: status === "all" ? undefined : [status],
    from: from || undefined,
    to: badRange ? undefined : to || undefined,
    page,
    page_size: 25,
  });
  const rows = list.data?.items ?? [];

  return (
    <Card className="premium-card">
      <CardContent className="space-y-3 p-4">
        <div className="grid gap-2 sm:grid-cols-4">
          <div className="space-y-1">
            <Label className="text-xs">Channel</Label>
            <Select
              value={channel}
              onValueChange={(v) => {
                setChannel(v as typeof channel);
                setPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All channels</SelectItem>
                {MARKETING_CHANNELS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {label(c)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Status</Label>
            <Select
              value={status}
              onValueChange={(v) => {
                setStatus(v as typeof status);
                setPage(1);
              }}
            >
              <SelectTrigger>
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
          <div className="space-y-1">
            <Label htmlFor="dl-from" className="text-xs">
              From
            </Label>
            <Input
              id="dl-from"
              type="date"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="dl-to" className="text-xs">
              To
            </Label>
            <Input
              id="dl-to"
              type="date"
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>
        {badRange && <p className="text-xs text-red-600">“From” is after “to”.</p>}

        {list.isLoading ? (
          <LoadingSkeleton rows={6} />
        ) : list.isError ? (
          <ErrorState
            title="Couldn't load the delivery log"
            description={marketingErrorMessage(list.error)}
            onRetry={() => void list.refetch()}
          />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={ScrollText}
            title="No messages yet"
            description="Every message a campaign sends, skips or fails shows up here."
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Guest</TableHead>
                    <TableHead>Campaign</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden lg:table-cell">When</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <p className="font-medium">
                          {r.display_name ?? <span className="text-muted-foreground">No name</span>}
                        </p>
                        <p className="font-mono text-xs text-muted-foreground">
                          {r.masked_address}
                        </p>
                      </TableCell>
                      <TableCell>
                        <button
                          type="button"
                          onClick={() => onOpenCampaign(r.campaign.id)}
                          className="text-left text-sm font-medium text-primary underline-offset-4 hover:underline"
                        >
                          {r.campaign.name}
                        </button>
                        <div className="mt-1">
                          <ChannelTag channel={r.channel} />
                        </div>
                      </TableCell>
                      <TableCell>
                        <RecipientStatusTag status={r.status} />
                        <RecipientDetail r={r} />
                      </TableCell>
                      <TableCell className="hidden text-xs text-muted-foreground lg:table-cell">
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
      </CardContent>
    </Card>
  );
}
