import { useState } from "react";
import { AlertOctagon, ChevronDown, ChevronRight, LifeBuoy } from "lucide-react";
import { Trans, useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import masterI18n from "@/lib/master-i18n";

/**
 * The guard in front of pressing "Generate script" a second time.
 *
 * WHY THIS EXISTS.
 *
 * Regenerating rotates four secrets on the SERVER: agent credential,
 * WireGuard keypair, RADIUS shared secret, RouterOS API password. Two of
 * them are written to the device by chunks shaped as add-if-missing with
 * no `else` branch:
 *
 *   :if ([:len [/interface wireguard find where name="wg-cloudguest"]] = 0) do={ add private-key=NEW }
 *   :if ([:len [/radius find where address="..."]] = 0) do={ add secret=NEW } else={ ...disabled=no }
 *
 * So on a router that already has the old values, the new script is a
 * no-op for exactly the two things that changed. The device keeps the old
 * key and the old secret while the server has moved on, and RouterOS
 * reports nothing -- every command "succeeded". The tunnel silently never
 * handshakes; every RADIUS reply is a reject. Re-pasting the whole script
 * does NOT repair it. Confirmed live today, the API-credential half:
 * `login failure for user cloudguest-api from 10.20.0.4 via api`.
 *
 * Collapsed by default: the first, normal Generate is not dangerous, and
 * a confirmation in front of the happy path only trains people to click
 * through confirmations. It opens only when he goes looking for a second
 * one -- and then it is fully blocking.
 *
 * The repair itself is NOT duplicated here. Phase 8 ("Kuch galat ho gaya")
 * already owns it: it detects the mismatch by counting the API login
 * failures in the log, then offers the surgical remove commands. One
 * source of truth, and he arrives there having actually confirmed the
 * mismatch rather than guessing.
 */
export function RegenerateGuard({
  routerName,
  onGoToRecovery,
}: {
  routerName: string;
  onGoToRecovery: () => void;
}) {
  const { t } = useTranslation("guided", { i18n: masterI18n });
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const nameMatches = typed.trim() === routerName.trim() && routerName.trim().length > 0;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-9 w-full items-center gap-1.5 rounded-lg border border-dashed border-amber-500/50 bg-amber-500/5 px-3 py-2 text-left text-xs font-medium text-amber-700 hover:bg-amber-500/10 dark:text-amber-500"
      >
        <ChevronRight className="h-3.5 w-3.5 shrink-0" />
        {t("regen.trigger")}
      </button>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border-2 border-destructive/60 bg-destructive/5 p-3">
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="inline-flex items-center gap-1.5 text-sm font-bold text-destructive"
      >
        <ChevronDown className="h-4 w-4 shrink-0" />
        <AlertOctagon className="h-4 w-4 shrink-0" /> {t("regen.heading")}
      </button>

      <div className="space-y-1.5 text-xs leading-relaxed text-foreground">
        <p>
          <Trans i18n={masterI18n} t={t} i18nKey="regen.p1" components={{ b: <strong /> }} />
        </p>
        <p>
          <Trans i18n={masterI18n} t={t} i18nKey="regen.p2" components={{ b: <strong /> }} />
        </p>
      </div>

      <div className="rounded-lg border border-border bg-background p-2.5">
        <p className="text-xs font-medium text-foreground">
          {t("regen.typeName")} <span className="font-mono text-destructive">{routerName}</span>
        </p>
        <Input
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder={t("regen.namePlaceholder")}
          autoComplete="off"
          spellCheck={false}
          className="mt-1.5 text-xs"
        />
      </div>

      <button
        type="button"
        disabled={!nameMatches}
        onClick={onGoToRecovery}
        className="inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded-lg bg-destructive px-4 py-2.5 text-xs font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <LifeBuoy className="h-4 w-4" /> {t("regen.goToRecovery")}
      </button>
      <p className="text-[11px] leading-relaxed text-muted-foreground">{t("regen.tail")}</p>
    </div>
  );
}
