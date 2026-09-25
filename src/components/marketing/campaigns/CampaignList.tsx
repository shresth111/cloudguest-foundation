import { useState } from "react";
import { Megaphone, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import {
  useDebounced,
  useMarketingCampaigns,
  useMarketingScope,
  useVenueLabel,
} from "@/hooks/useMarketing";
import {
  CAMPAIGN_STATUSES,
  MARKETING_CHANNELS,
  type CampaignStatus,
  type MarketingCampaign,
  type MarketingChannel,
  type MarketingStatus,
} from "@/types/marketing";
import { CampaignStatusTag, ChannelTag, Pager } from "../marketing-ui";
import {
  formatCount,
  formatDateTime,
  marketingErrorMessage,
  useChannelLabel,
  useMarketingCan,
} from "../marketing-helpers";
import { CampaignComposerSheet } from "./CampaignComposerSheet";
import { VenueFilterSelect } from "../audience/VenuePicker";
import type { MarketingTab } from "../MarketingView";

/** The time a row is best described by: when it went (or will go) out. */
function whenOf(c: MarketingCampaign): { label: string; at: string | null } {
  switch (c.status) {
    case "scheduled":
      return { label: "Scheduled", at: c.scheduled_at };
    case "sending":
      return { label: "Started", at: c.started_at };
    case "sent":
    case "failed":
      return { label: "Finished", at: c.completed_at ?? c.started_at };
    case "cancelled":
      return { label: "Cancelled", at: c.cancelled_at };
    default:
      return { label: "Created", at: c.created_at };
  }
}

/**
 * Campaigns tab (spec §8.1 CampaignList): name, channel, status, when,
 * recipients, accepted by provider, failed. Opening a row opens its detail
 * sheet (`?campaign=`); drafts open back into the composer from there.
 */
export function CampaignList({
  status,
  onOpenCampaign,
  onGoToTab,
}: {
  status: MarketingStatus;
  onOpenCampaign: (id: string) => void;
  onGoToTab: (t: MarketingTab) => void;
}) {
  const can = useMarketingCan();
  // Org-scoped callers see every venue's campaigns, so each row names its
  // venues (§4.5 location_id; null = org-wide or a multi-venue audience).
  const orgScoped = useMarketingScope().kind === "organization";
  const venueLabel = useVenueLabel();
  const label = useChannelLabel();
  const [statusFilter, setStatusFilter] = useState<"all" | CampaignStatus>("all");
  const [channel, setChannel] = useState<"all" | MarketingChannel>("all");
  const [venue, setVenue] = useState("all");
  const [searchText, setSearchText] = useState("");
  const search = useDebounced(searchText.trim(), 400);
  const [page, setPage] = useState(1);
  const [composerOpen, setComposerOpen] = useState(false);

  const list = useMarketingCampaigns({
    status: statusFilter === "all" ? undefined : [statusFilter],
    channel: channel === "all" ? undefined : channel,
    location_id: orgScoped && venue !== "all" ? venue : undefined,
    search: search || undefined,
    page,
    page_size: 25,
  });
  const rows = list.data?.items ?? [];
  const filtered = statusFilter !== "all" || channel !== "all" || venue !== "all" || !!search;
  const totalOptedIn = MARKETING_CHANNELS.reduce((n, c) => n + (status.consent_counts[c] ?? 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-1 flex-wrap gap-2">
          <div className="relative min-w-[12rem] flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchText}
              onChange={(e) => {
                setSearchText(e.target.value);
                setPage(1);
              }}
              placeholder="Search campaigns"
              className="pl-8"
              aria-label="Search campaigns"
            />
          </div>
          <Select
            value={statusFilter}
            onValueChange={(v) => {
              setStatusFilter(v as typeof statusFilter);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-36" aria-label="Status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {CAMPAIGN_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  <CampaignStatusTag status={s} />
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={channel}
            onValueChange={(v) => {
              setChannel(v as typeof channel);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-36" aria-label="Channel">
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
          <VenueFilterSelect
            value={venue}
            onChange={(v) => {
              setVenue(v);
              setPage(1);
            }}
          />
        </div>
        {can("create") && (
          <Button onClick={() => setComposerOpen(true)}>
            <Plus className="h-4 w-4" /> New campaign
          </Button>
        )}
      </div>

      {list.isLoading ? (
        <LoadingSkeleton rows={5} />
      ) : list.isError ? (
        <ErrorState
          title="Couldn't load campaigns"
          description={marketingErrorMessage(list.error)}
          onRetry={() => void list.refetch()}
        />
      ) : rows.length === 0 ? (
        filtered ? (
          <EmptyState
            icon={Megaphone}
            title="No campaigns match"
            description="Try another status, channel or search."
          />
        ) : (
          <EmptyState
            icon={Megaphone}
            title="No campaigns yet"
            description={
              totalOptedIn === 0
                ? "No guest has opted in yet, so a campaign would reach nobody today. You can still prepare one; start by turning on the opt-in in Audience."
                : "Pick a template, choose who gets it and send or schedule it."
            }
            action={
              can("create")
                ? { label: "Create your first campaign", onClick: () => setComposerOpen(true) }
                : undefined
            }
          >
            {totalOptedIn === 0 && (
              <Button variant="link" className="mt-2" onClick={() => onGoToTab("audience")}>
                Go to Audience
              </Button>
            )}
          </EmptyState>
        )
      ) : (
        <Card className="premium-card">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Campaign</TableHead>
                    <TableHead>Status</TableHead>
                    {orgScoped && <TableHead className="hidden lg:table-cell">Venues</TableHead>}
                    <TableHead className="hidden md:table-cell">When</TableHead>
                    <TableHead className="hidden text-right sm:table-cell">Recipients</TableHead>
                    <TableHead className="hidden text-right sm:table-cell">
                      Accepted by provider
                    </TableHead>
                    <TableHead className="hidden text-right sm:table-cell">Failed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((c) => {
                    const w = whenOf(c);
                    const started = c.status !== "draft" && c.status !== "scheduled";
                    return (
                      <TableRow
                        key={c.id}
                        className="cursor-pointer"
                        onClick={() => onOpenCampaign(c.id)}
                      >
                        <TableCell>
                          <button
                            type="button"
                            className="text-left font-medium hover:underline"
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenCampaign(c.id);
                            }}
                          >
                            {c.name}
                          </button>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                            <ChannelTag channel={c.channel} />
                            <span className="truncate">{c.template.name}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <CampaignStatusTag status={c.status} />
                        </TableCell>
                        {orgScoped && (
                          <TableCell className="hidden text-xs lg:table-cell">
                            {venueLabel(c.location_id, c.audience_filter?.location_ids ?? null)}
                          </TableCell>
                        )}
                        <TableCell className="hidden text-xs md:table-cell">
                          <span className="text-muted-foreground">{w.label}</span>
                          <br />
                          {formatDateTime(w.at)}
                        </TableCell>
                        <TableCell className="hidden text-right tabular-nums sm:table-cell">
                          {started ? formatCount(c.stats.recipients) : "—"}
                        </TableCell>
                        <TableCell className="hidden text-right tabular-nums sm:table-cell">
                          {started ? formatCount(c.stats.submitted) : "—"}
                        </TableCell>
                        <TableCell className="hidden text-right tabular-nums sm:table-cell">
                          {started ? formatCount(c.stats.failed) : "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
      {rows.length > 0 && (
        <Pager
          page={list.data?.page ?? page}
          totalPages={list.data?.total_pages ?? 1}
          totalItems={list.data?.total_items ?? 0}
          onPage={setPage}
          busy={list.isFetching}
        />
      )}

      <CampaignComposerSheet
        open={composerOpen}
        onOpenChange={setComposerOpen}
        status={status}
        draft={null}
        onDone={(id) => onOpenCampaign(id)}
      />
    </div>
  );
}
