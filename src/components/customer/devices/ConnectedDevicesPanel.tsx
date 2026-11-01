/**
 * Connected Devices: the guest devices this venue's network has seen (MAC,
 * IP, device name, first/last seen). Dense, sortable, searchable.
 *
 * Data: `useCustomerFeatureData("devices", locationId)` -- the same query and
 * key the page used before; nothing new is fetched. The demo fixture below is
 * shown only when `useIsDemo()` is true AND the read returned nothing, exactly
 * as before.
 *
 * DATA MASKING. When `masked` is on, the MAC is shown through `maskMac`, as
 * before (today a deliberate passthrough -- see `@/lib/masking`: owners need
 * the real MAC for support). Every other use of it goes through the SAME
 * displayed string, so turning masking back on can leak nothing:
 * search matches the masked text, MAC sort orders the masked text, React
 * keys are row positions. A search box that matched the raw MAC would let
 * anyone confirm a guest's address one character at a time; a sort on the
 * raw value would leak its ordering. IP and device name are not masked
 * today, and this keeps that unchanged.
 */
import { useMemo, useState } from "react";
import { Search, Wifi } from "lucide-react";
import { useCustomerFeatureData, useIsDemo } from "@/hooks/useCustomerDashboard";
import { maskMac } from "@/lib/masking";
import { EmptyState, Panel } from "@/components/customer/console";
import { PanelTitle } from "@/components/customer/dashboard/overview/console-ui";
import { MONO, SortHeader } from "./ui";
import { useDevicesT } from "./ui-shared";
import { type SortKey, toConnectedRows, queryConnectedRows } from "./connected-rows";

// ── Demo only ──────────────────────────────────────────────
const DEMO_DEVICES = [
  { m: "00:1A:2B:3C:4D:5E", i: "10.0.1.42", d: "iPhone 15", fs: "Today", ls: "Just now" },
  { m: "AA:BB:CC:DD:EE:FF", i: "10.0.1.87", d: "MacBook Pro", fs: "Yesterday", ls: "2 min ago" },
  { m: "11:22:33:44:55:66", i: "10.0.2.15", d: "Galaxy S24", fs: "Today", ls: "5 min ago" },
  { m: "AB:CD:EF:01:23:45", i: "10.0.2.34", d: "iPad Air", fs: "2 days ago", ls: "1 hour ago" },
];

export interface ConnectedRow {
  /** Position in the API's order (newest activity first). */
  idx: number;
  /** The MAC exactly as it may be SHOWN: already masked when masking is on. */
  mac: string;
  ip: string;
  device: string;
  firstSeen: string;
  lastSeen: string;
}

export function ConnectedDevicesPanel({
  locationId,
  masked,
}: {
  locationId: string;
  masked: boolean;
}) {
  const t = useDevicesT();
  const { data, isLoading, isError } = useCustomerFeatureData("devices", locationId);
  const demo = useIsDemo();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "lastSeen", dir: 1 });

  // Validated: anything but an array of objects is "nothing read".
  const raw = useMemo(() => {
    const list = Array.isArray(data?.devices) ? data.devices : [];
    const real = list
      .filter((d): d is NonNullable<typeof d> => d != null && typeof d === "object")
      .map((d) => ({ m: d.mac, i: d.ip, d: d.device, fs: d.firstSeen, ls: d.lastSeen }));
    return real.length ? real : demo ? DEMO_DEVICES : [];
  }, [data, demo]);
  const rows = useMemo(() => toConnectedRows(raw, masked), [raw, masked]);
  const shown = useMemo(() => queryConnectedRows(rows, query, sort), [rows, query, sort]);
  const onSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: 1 }));

  return (
    <Panel
      flush
      title={<PanelTitle icon={<Wifi />}>{t("connected.title", "Connected Devices")}</PanelTitle>}
      description={
        rows.length
          ? t("connected.meta", "{{count}} guest devices seen on this network", {
              count: rows.length,
            })
          : undefined
      }
      actions={
        rows.length > 0 ? (
          <label className="relative">
            <span className="sr-only">{t("connected.search", "Search connected devices")}</span>
            <Search
              aria-hidden
              className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--wy-text-faint)]"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("connected.searchPlaceholder", "Search")}
              className="h-7 w-32 rounded-[var(--wy-radius)] border border-[var(--wy-border-strong)] bg-[var(--wy-surface)] pl-7 pr-2 text-xs text-[var(--wy-text)] placeholder:text-[var(--wy-text-faint)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wy-accent)] sm:w-48"
            />
          </label>
        ) : undefined
      }
    >
      {isLoading ? (
        <div className="space-y-2 p-4" aria-busy="true">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-7 animate-pulse rounded bg-[var(--wy-surface-2)] motion-reduce:animate-none"
            />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          compact
          icon={Wifi}
          title={
            isError
              ? t("connected.errorTitle", "Couldn't load connected devices")
              : t("connected.emptyTitle", "No connected devices yet")
          }
          description={
            isError
              ? t(
                  "connected.errorBody",
                  "This is a problem reading the list, not a sign that nobody is connected.",
                )
              : t(
                  "connected.emptyBody",
                  "Devices that connect to this location's network will show up here.",
                )
          }
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <caption className="sr-only">
              {t("connected.caption", "Guest devices seen on this network")}
              {masked ? ` ${t("connected.maskedNote", "(MAC addresses are masked)")}` : ""}
            </caption>
            <thead className="bg-[var(--wy-surface-2)]">
              <tr className="border-b border-[var(--wy-border)]">
                <SortHeader
                  label={t("col.mac", "MAC")}
                  sortKey="mac"
                  sort={sort}
                  onSort={onSort}
                  className="pl-4"
                />
                <SortHeader label={t("col.ip", "IP")} sortKey="ip" sort={sort} onSort={onSort} />
                <SortHeader
                  label={t("col.device", "Device")}
                  sortKey="device"
                  sort={sort}
                  onSort={onSort}
                />
                <SortHeader
                  label={t("col.firstSeen", "First seen")}
                  sortKey="firstSeen"
                  sort={sort}
                  onSort={onSort}
                  className="hidden sm:table-cell"
                />
                <SortHeader
                  label={t("col.lastSeen", "Last seen")}
                  sortKey="lastSeen"
                  sort={sort}
                  onSort={onSort}
                />
              </tr>
            </thead>
            <tbody>
              {shown.map((d) => (
                <tr
                  key={d.idx}
                  data-wy="connected-row"
                  className="border-b border-[var(--wy-border)] last:border-b-0 hover:bg-[var(--wy-surface-2)]"
                >
                  <td className={`whitespace-nowrap py-2 pl-4 pr-3 text-xs ${MONO}`}>{d.mac}</td>
                  <td
                    className={`whitespace-nowrap px-3 py-2 text-xs text-[var(--wy-text-muted)] ${MONO}`}
                  >
                    {d.ip}
                  </td>
                  <td className="max-w-[14rem] truncate px-3 py-2">{d.device}</td>
                  <td className="hidden whitespace-nowrap px-3 py-2 text-xs text-[var(--wy-text-muted)] sm:table-cell">
                    {d.firstSeen}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-[var(--wy-text-muted)]">
                    {d.lastSeen}
                  </td>
                </tr>
              ))}
              {shown.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-[13px] text-[var(--wy-text-muted)]"
                  >
                    {t("connected.noMatch", "No device matches “{{q}}”.", { q: query })}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

export default ConnectedDevicesPanel;
