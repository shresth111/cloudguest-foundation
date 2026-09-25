import { useState } from "react";
import { Search, UserX, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { VenueFilterSelect } from "./VenuePicker";
import { ErrorState } from "@/components/common/ErrorState";
import { LoadingSkeleton } from "@/components/common/LoadingSkeleton";
import {
  useMarketingContacts,
  useOptOutContact,
  useDebounced,
  useMarketingScope,
  useOrgVenues,
} from "@/hooks/useMarketing";
import {
  MARKETING_CHANNELS,
  type ConsentStatus,
  type MarketingChannel,
  type MarketingContact,
} from "@/types/marketing";
import { Pager } from "../marketing-ui";
import {
  formatDateTime,
  marketingErrorMessage,
  useChannelLabel,
  useMarketingCan,
} from "../marketing-helpers";

const CONSENT_LABEL: Record<ConsentStatus, string> = {
  opted_in: "Opted in",
  opted_out: "Opted out",
  none: "Never asked / didn't tick",
};

const SOURCE_LABEL: Record<string, string> = {
  captive_portal: "WiFi page",
  unsubscribe_link: "Unsubscribe link",
  staff_recorded: "Recorded by staff",
  inbound_stop: "Replied STOP",
};

/**
 * Who has (and has not) consented, per channel (spec §5.2). Addresses are
 * masked by the API; this table never sees a full number or email.
 *
 * The one write here is "Record opt-out": staff noting a guest's spoken or
 * written request. There is deliberately NO opt-in counterpart anywhere in
 * the dashboard -- consent can only come from the guest.
 */
export function ContactsTable() {
  const can = useMarketingCan();
  // Org-scoped callers see guests of every venue; they can narrow to one
  // with the contract's `location_id` query (§5.2). Location-scoped callers
  // are confined to their venue by the server and get no filter.
  const orgScoped = useMarketingScope().kind === "organization";
  const [venue, setVenue] = useState<string>("all");
  const label = useChannelLabel();
  const [channel, setChannel] = useState<MarketingChannel>("whatsapp");
  const [consent, setConsent] = useState<ConsentStatus>("opted_in");
  const [searchText, setSearchText] = useState("");
  const search = useDebounced(searchText.trim().slice(0, 100), 400);
  const [page, setPage] = useState(1);
  const list = useMarketingContacts({
    channel,
    consent_status: consent,
    location_id: orgScoped && venue !== "all" ? venue : undefined,
    search: search || undefined,
    page,
    page_size: 25,
  });

  const [optOutFor, setOptOutFor] = useState<MarketingContact | null>(null);
  const [optChannels, setOptChannels] = useState<MarketingChannel[]>([]);
  const [note, setNote] = useState("");
  const optOut = useOptOutContact();

  const openOptOut = (c: MarketingContact) => {
    setOptOutFor(c);
    setOptChannels([...MARKETING_CHANNELS]);
    setNote("");
  };

  const submitOptOut = async () => {
    if (!optOutFor || optChannels.length === 0) return;
    try {
      await optOut.mutateAsync({
        guestId: optOutFor.guest_id,
        channels: optChannels,
        note: note.trim() || null,
      });
      toast.success("Opt-out recorded. This guest won't be messaged on those channels.");
      setOptOutFor(null);
    } catch (err) {
      toast.error(marketingErrorMessage(err, "Couldn't record the opt-out."));
    }
  };

  const reset = () => setPage(1);
  const rows = list.data?.items ?? [];

  return (
    <Card className="premium-card">
      <CardContent className="space-y-3 p-4">
        <div>
          <p className="font-semibold">Contacts</p>
          <p className="text-xs text-muted-foreground">
            Guests of this venue and where each stands on consent.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <VenueFilterSelect
            value={venue}
            onChange={(v) => {
              setVenue(v);
              reset();
            }}
          />
          <Select
            value={channel}
            onValueChange={(v) => {
              setChannel(v as MarketingChannel);
              reset();
            }}
          >
            <SelectTrigger className="w-36" aria-label="Channel">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MARKETING_CHANNELS.map((c) => (
                <SelectItem key={c} value={c}>
                  {label(c)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={consent}
            onValueChange={(v) => {
              setConsent(v as ConsentStatus);
              reset();
            }}
          >
            <SelectTrigger className="w-48" aria-label="Consent">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(CONSENT_LABEL) as ConsentStatus[]).map((s) => (
                <SelectItem key={s} value={s}>
                  {CONSENT_LABEL[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="relative min-w-[12rem] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchText}
              onChange={(e) => {
                setSearchText(e.target.value);
                reset();
              }}
              placeholder="Name, last 4 digits or email name"
              className="pl-8"
              aria-label="Search contacts"
            />
          </div>
        </div>

        {list.isLoading ? (
          <LoadingSkeleton rows={5} />
        ) : list.isError ? (
          <ErrorState
            title="Couldn't load contacts"
            description={marketingErrorMessage(list.error)}
            onRetry={() => void list.refetch()}
          />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Users}
            title={
              consent === "opted_in"
                ? `No one has opted in on ${label(channel)} yet`
                : "No guests match"
            }
            description={
              consent === "opted_in"
                ? "Guests appear here once they tick the opt-in on your WiFi page."
                : "Try another channel, consent state or search."
            }
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Guest</TableHead>
                    <TableHead>Consent</TableHead>
                    <TableHead className="hidden md:table-cell">Visits</TableHead>
                    <TableHead className="hidden md:table-cell">Last seen</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((c) => (
                    <TableRow key={c.guest_id}>
                      <TableCell>
                        <p className="font-medium">
                          {c.display_name ?? <span className="text-muted-foreground">No name</span>}
                        </p>
                        <p className="font-mono text-xs text-muted-foreground">
                          {c.masked_address ?? "No address for this channel"}
                        </p>
                      </TableCell>
                      <TableCell className="text-xs">
                        <p>{CONSENT_LABEL[c.consent_status]}</p>
                        {c.consent_source && (
                          <p className="text-muted-foreground">
                            {SOURCE_LABEL[c.consent_source] ?? c.consent_source}
                            {c.consent_changed_at
                              ? ` · ${formatDateTime(c.consent_changed_at)}`
                              : ""}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="hidden tabular-nums md:table-cell">
                        {c.total_visit_count}
                      </TableCell>
                      <TableCell className="hidden text-xs text-muted-foreground md:table-cell">
                        {formatDateTime(c.last_seen_at)}
                      </TableCell>
                      <TableCell>
                        {can("update") && c.consent_status !== "opted_out" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openOptOut(c)}
                            aria-label="Record opt-out"
                            title="Record opt-out"
                          >
                            <UserX className="h-4 w-4" />
                          </Button>
                        )}
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

      <Dialog
        open={!!optOutFor}
        onOpenChange={(o) => !o && !optOut.isPending && setOptOutFor(null)}
      >
        <DialogContent className="w-[calc(100vw-2rem)] max-w-md">
          <DialogHeader>
            <DialogTitle>Record an opt-out</DialogTitle>
            <DialogDescription>
              For a guest who asked you in person or in writing to stop messages. This can't be
              undone from the dashboard; only the guest can opt in again.
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm">
            {optOutFor?.display_name ?? "Guest"}{" "}
            <span className="font-mono text-muted-foreground">
              {optOutFor?.masked_address ?? ""}
            </span>
          </p>
          <div className="space-y-2">
            {MARKETING_CHANNELS.map((c) => (
              <label key={c} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={optChannels.includes(c)}
                  onCheckedChange={(v) =>
                    setOptChannels((prev) =>
                      v ? [...new Set([...prev, c])] : prev.filter((x) => x !== c),
                    )
                  }
                />
                {label(c)}
              </label>
            ))}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="optout-note">Note (optional)</Label>
            <Textarea
              id="optout-note"
              rows={2}
              maxLength={300}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setOptOutFor(null)}
              disabled={optOut.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={submitOptOut}
              disabled={optOut.isPending || optChannels.length === 0}
            >
              {optOut.isPending ? "Recording…" : "Record opt-out"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
