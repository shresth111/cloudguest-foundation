/** Customer detail → Guests & sessions (PRD §4.7). Read-only; phone and
 * email arrive already masked by the backend. */
import { useState } from "react";
import { Users } from "lucide-react";
import {
  MEmptyState,
  MSeg,
  MTable,
  MTag,
  MTd,
  MTh,
  MTr,
  M_INPUT,
} from "@/components/master/MasterKit";
import { ErrorBlock, Pager } from "@/components/isp-partner/kit";
import { useIspCustomerLocations, useIspGuests, useIspSessions } from "@/hooks/isp-partner/useIsp";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { formatBytes, formatDateTime } from "@/lib/isp-partner/format";

type View = "sessions" | "guests";
type SessionStatus = "all" | "active" | "ended";

function GuestsTable({ customerId, locationId }: { customerId: string; locationId: string }) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const debounced = useDebouncedValue(search.trim(), 300);
  const q = useIspGuests(customerId, {
    isp_location_id: locationId || undefined,
    search: debounced || undefined,
    page,
    page_size: 25,
  });
  const data = q.data;
  return (
    <div className="space-y-2">
      <input
        className={`${M_INPUT} max-w-xs`}
        placeholder="Search name"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(1);
        }}
      />
      {q.error && !data ? (
        <ErrorBlock error={q.error} onRetry={() => q.refetch()} what="guests" />
      ) : data && data.items.length === 0 ? (
        <MEmptyState
          icon={Users}
          title="No guests"
          description="Guests appear after their first sign-in."
        />
      ) : (
        <>
          <MTable
            loading={q.isLoading}
            head={
              <>
                <MTh>Guest</MTh>
                <MTh>Phone</MTh>
                <MTh>Email</MTh>
                <MTh className="text-right">Sessions</MTh>
                <MTh>First seen</MTh>
                <MTh>Last seen</MTh>
              </>
            }
          >
            {data?.items.map((g) => (
              <MTr key={g.id}>
                <MTd>{g.display_name ?? "–"}</MTd>
                <MTd className="font-mono text-xs">{g.phone_masked ?? "–"}</MTd>
                <MTd className="font-mono text-xs">{g.email_masked ?? "–"}</MTd>
                <MTd className="text-right tabular-nums">{g.session_count}</MTd>
                <MTd className="text-xs">{formatDateTime(g.first_seen_at)}</MTd>
                <MTd className="text-xs">{formatDateTime(g.last_seen_at)}</MTd>
              </MTr>
            ))}
          </MTable>
          {data && (
            <Pager page={data.page} pages={data.pages} total={data.total} onPage={setPage} />
          )}
        </>
      )}
    </div>
  );
}

function SessionsTable({ customerId, locationId }: { customerId: string; locationId: string }) {
  const [status, setStatus] = useState<SessionStatus>("all");
  const [page, setPage] = useState(1);
  const q = useIspSessions(customerId, {
    isp_location_id: locationId || undefined,
    status: status === "all" ? undefined : status,
    page,
    page_size: 25,
  });
  const data = q.data;
  return (
    <div className="space-y-2">
      <MSeg<SessionStatus>
        value={status}
        onChange={(v) => {
          setStatus(v);
          setPage(1);
        }}
        options={[
          { value: "all", label: "All" },
          { value: "active", label: "Active" },
          { value: "ended", label: "Ended" },
        ]}
      />
      {q.error && !data ? (
        <ErrorBlock error={q.error} onRetry={() => q.refetch()} what="sessions" />
      ) : data && data.items.length === 0 ? (
        <MEmptyState icon={Users} title="No sessions" description="No guest sessions match." />
      ) : (
        <>
          <MTable
            loading={q.isLoading}
            head={
              <>
                <MTh>Guest</MTh>
                <MTh>Location</MTh>
                <MTh>Sign-in</MTh>
                <MTh>Status</MTh>
                <MTh>Started</MTh>
                <MTh>Ended</MTh>
                <MTh>IP</MTh>
                <MTh className="text-right">Down / Up</MTh>
              </>
            }
          >
            {data?.items.map((s) => (
              <MTr key={s.id}>
                <MTd>{s.guest_display_name ?? "–"}</MTd>
                <MTd className="text-xs">{s.location_name ?? "–"}</MTd>
                <MTd className="text-xs">{s.auth_method ?? "–"}</MTd>
                <MTd>
                  <MTag label={s.status} tone={s.status === "active" ? "online" : "normal"} />
                </MTd>
                <MTd className="text-xs">{formatDateTime(s.started_at)}</MTd>
                <MTd className="text-xs">{formatDateTime(s.ended_at)}</MTd>
                <MTd className="font-mono text-xs">{s.ip_address ?? "–"}</MTd>
                <MTd className="text-right text-xs tabular-nums">
                  {formatBytes(s.bytes_downloaded)} / {formatBytes(s.bytes_uploaded)}
                </MTd>
              </MTr>
            ))}
          </MTable>
          {data && (
            <Pager page={data.page} pages={data.pages} total={data.total} onPage={setPage} />
          )}
        </>
      )}
    </div>
  );
}

export function GuestsSessionsTab({ customerId }: { customerId: string }) {
  const [view, setView] = useState<View>("sessions");
  const [locationId, setLocationId] = useState("");
  const locations = useIspCustomerLocations(customerId);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <MSeg<View>
          value={view}
          onChange={setView}
          options={[
            { value: "sessions", label: "Sessions" },
            { value: "guests", label: "Guests" },
          ]}
        />
        <select
          className={`${M_INPUT} w-auto`}
          value={locationId}
          onChange={(e) => setLocationId(e.target.value)}
          aria-label="Location"
        >
          <option value="">All locations</option>
          {(locations.data?.items ?? []).map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </div>
      {view === "sessions" ? (
        <SessionsTable key={locationId} customerId={customerId} locationId={locationId} />
      ) : (
        <GuestsTable key={locationId} customerId={customerId} locationId={locationId} />
      )}
    </div>
  );
}
