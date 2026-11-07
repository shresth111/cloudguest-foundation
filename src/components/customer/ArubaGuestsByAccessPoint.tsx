/**
 * "Online guests by access point" -- the Devices page at an Aruba Instant On
 * venue (DASHBOARD_PLAN P1-H), in place of "Connected Devices".
 *
 * Connected Devices is filled by the router agent's device sync, which an
 * Instant On venue never has, so it was permanently empty under a promise
 * ("will show up here") nothing keeps. This reads the access-points API
 * (P0-A2) instead: guests online now, sign-ins and data today per AP, from
 * this platform's own sign-in records. A failed read says unavailable, never
 * zeros; nothing here calls `/connected-devices` (whose sync answers 409
 * NAS_ONLY_DEVICE at this vendor).
 *
 * Mounted ONLY when `locationIsNasOnly`; MikroTik and Omada keep DevicesView.
 */
import { Radio } from "lucide-react";
import { useTranslation } from "react-i18next";
import i18n from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useArubaAccessPoints } from "@/hooks/useArubaAccessPoints";
import {
  ARUBA_AP_EMPTY,
  ARUBA_AP_MANAGE_NOTE,
  ARUBA_AP_UNAVAILABLE,
  apCount,
  apDataToday,
  apDisplayName,
  apStatusLabel,
  apUnattributedNote,
} from "@/lib/aruba-access-points";

const HEAD = "text-xs font-medium uppercase tracking-wide";

export function ArubaGuestsByAccessPoint({ locationId }: { locationId: string }) {
  const { t } = useTranslation("devices", { i18n });
  const state = useArubaAccessPoints(locationId);
  return (
    <Card data-testid="aruba-guests-by-ap">
      <CardHeader className="space-y-1">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--wy-radius)] bg-[var(--wy-accent-soft)] text-[var(--wy-accent)]">
            <Radio className="h-3.5 w-3.5" />
          </div>
          <CardTitle className="text-sm">
            {t("arubaAp.title", "Online guests by access point")}
          </CardTitle>
        </div>
        <CardDescription className="text-xs">
          {t(
            "arubaAp.description",
            "From guest sign-ins at this venue. Devices that haven't signed in to the guest WiFi aren't shown.",
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 p-0 pb-4">
        {state.status === "loading" ? (
          <div className="space-y-2 px-6">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        ) : state.status === "unavailable" ? (
          <p
            className="px-6 py-4 text-center text-xs text-muted-foreground"
            data-testid="aruba-guests-by-ap-unavailable"
          >
            {ARUBA_AP_UNAVAILABLE}
          </p>
        ) : state.items.length === 0 ? (
          <p className="px-6 py-4 text-center text-xs text-muted-foreground">{ARUBA_AP_EMPTY}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className={HEAD}>{t("arubaAp.colAp", "Access point")}</TableHead>
                <TableHead className={HEAD}>{t("arubaAp.colStatus", "Status")}</TableHead>
                <TableHead className={HEAD}>{t("arubaAp.colGuests", "Guests online")}</TableHead>
                <TableHead className={HEAD}>{t("arubaAp.colSignIns", "Sign-ins today")}</TableHead>
                <TableHead className={HEAD}>{t("arubaAp.colData", "Data today")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {state.items.map((ap) => (
                <TableRow key={ap.id} className="border-b" data-testid="aruba-guests-by-ap-row">
                  <TableCell>
                    <span className="text-sm font-medium">{apDisplayName(ap)}</span>
                    {ap.name && (
                      <span className="block font-mono text-[11px] text-muted-foreground">
                        {ap.mac}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs">{apStatusLabel(ap.status)}</TableCell>
                  <TableCell className="tabular-nums">{apCount(ap.clientsNow)}</TableCell>
                  <TableCell className="tabular-nums">{apCount(ap.sessionsToday)}</TableCell>
                  <TableCell className="tabular-nums">{apDataToday(ap)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {state.status === "ok" && apUnattributedNote(state.unattributedClientsNow) && (
          <p className="px-6 text-xs text-muted-foreground">
            {apUnattributedNote(state.unattributedClientsNow)}
          </p>
        )}
        <p className="px-6 text-xs text-muted-foreground">{ARUBA_AP_MANAGE_NOTE}</p>
      </CardContent>
    </Card>
  );
}
