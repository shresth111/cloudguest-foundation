import { useState } from "react";
import { useTranslation } from "react-i18next";
import i18n from "@/lib/i18n";
import { Megaphone, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DataTable,
  Panel,
  Toolbar,
  ToolbarSearch,
  type DataTableColumn,
} from "@/components/customer/console";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
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

const started = (c: MarketingCampaign) => c.status !== "draft" && c.status !== "scheduled";

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
  const { t } = useTranslation("marketing", { i18n });
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

  const columns: DataTableColumn<MarketingCampaign>[] = [
    {
      id: "campaign",
      header: "Campaign",
      mobile: "title",
      className: "whitespace-normal",
      cell: (c) => (
        <div className="min-w-0">
          <p className="font-medium text-[var(--wy-text)]">{c.name}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-[var(--wy-text-muted)]">
            <ChannelTag channel={c.channel} />
            <span className="truncate">{c.template.name}</span>
          </div>
        </div>
      ),
    },
    { id: "status", header: "Status", cell: (c) => <CampaignStatusTag status={c.status} /> },
    // Org-scoped callers only: each row names its venues.
    ...(orgScoped
      ? [
          {
            id: "venues",
            header: "Venues",
            visibleFrom: "lg" as const,
            cell: (c: MarketingCampaign) =>
              venueLabel(c.location_id, c.audience_filter?.location_ids ?? null),
          },
        ]
      : []),
    {
      id: "when",
      header: "When",
      visibleFrom: "md",
      cell: (c) => {
        const w = whenOf(c);
        return (
          <span className="text-xs">
            <span className="text-[var(--wy-text-faint)]">{w.label}</span>
            <br />
            {formatDateTime(w.at)}
          </span>
        );
      },
    },
    {
      id: "recipients",
      header: "Recipients",
      align: "right",
      cell: (c) => (
        <span className="tabular-nums">{started(c) ? formatCount(c.stats.recipients) : "—"}</span>
      ),
    },
    {
      id: "accepted",
      header: "Accepted by provider",
      align: "right",
      cell: (c) => (
        <span className="tabular-nums">{started(c) ? formatCount(c.stats.submitted) : "—"}</span>
      ),
    },
    {
      id: "failed",
      header: "Failed",
      align: "right",
      cell: (c) => (
        <span className="tabular-nums">{started(c) ? formatCount(c.stats.failed) : "—"}</span>
      ),
    },
  ];

  const emptyState = filtered ? (
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
  );

  return (
    <div className="space-y-4">
      <Panel flush>
        <Toolbar
          divided
          actions={
            can("create") ? (
              <Button onClick={() => setComposerOpen(true)}>
                <Plus className="h-4 w-4" aria-hidden /> New campaign
              </Button>
            ) : undefined
          }
        >
          <ToolbarSearch
            value={searchText}
            onValueChange={(v) => {
              setSearchText(v);
              setPage(1);
            }}
            placeholder="Search campaigns"
          />
          <Select
            value={statusFilter}
            onValueChange={(v) => {
              setStatusFilter(v as typeof statusFilter);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-full sm:w-36" aria-label="Status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="wy-console">
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
            <SelectTrigger className="w-full sm:w-36" aria-label="Channel">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="wy-console">
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
        </Toolbar>

        {list.isError ? (
          <div className="p-4">
            <ErrorState
              title="Couldn't load campaigns"
              description={marketingErrorMessage(list.error)}
              onRetry={() => void list.refetch()}
            />
          </div>
        ) : (
          <DataTable
            ariaLabel={t("tabs.campaigns", "Campaigns")}
            columns={columns}
            rows={rows}
            rowKey={(c) => c.id}
            loading={list.isLoading}
            loadingLabel={t("campaignList.loading", "Loading campaigns…")}
            empty={emptyState}
            onRowClick={(c) => onOpenCampaign(c.id)}
            rowLabel={(c) => t("campaignList.open", "Open {{name}}", { name: c.name })}
            density="comfortable"
            footer={
              rows.length > 0 ? (
                <Pager
                  inTable
                  page={list.data?.page ?? page}
                  totalPages={list.data?.total_pages ?? 1}
                  totalItems={list.data?.total_items ?? 0}
                  onPage={setPage}
                  busy={list.isFetching}
                />
              ) : undefined
            }
          />
        )}
      </Panel>

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
