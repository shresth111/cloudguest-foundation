import { ExternalLink, KeyRound } from "lucide-react";
import { Trans, useTranslation } from "react-i18next";
import { Checkbox } from "@/components/ui/checkbox";
import masterI18n from "@/lib/master-i18n";
import { RegenerateGuard } from "./RegenerateGuard";
import { GENERATED_CHUNKS } from "./generated-chunks";

/**
 * The per-router half of a phase, kept visually and verbally separate
 * from the universal blocks below it.
 *
 * The distinction matters operationally, so it is stated rather than
 * implied: these chunks are minted for this one router, contain secrets
 * that are shown exactly once, and are NOT safe to keep regenerating.
 * The universal blocks underneath are the opposite -- same text on every
 * router, re-runnable as many times as he likes.
 */
export function GeneratedChunkCallout({
  phaseId,
  routerId,
  routerName,
  secretsAck,
  onSecretsAck,
  onGoToRecovery,
}: {
  phaseId: string;
  routerId: string;
  routerName: string;
  secretsAck: boolean;
  onSecretsAck: (v: boolean) => void;
  onGoToRecovery: () => void;
}) {
  const { t } = useTranslation("guided", { i18n: masterI18n });
  const spec = GENERATED_CHUNKS[phaseId];
  if (!spec) return null;

  // Plain href + target=_blank rather than a router `<Link>`: this must
  // open in a NEW tab. He is mid-phase with answers on screen, and the
  // whole point of this module is that he never loses his place.
  const generatorHref = `/master/routers?advanced=${encodeURIComponent(routerId)}`;

  return (
    <div className="space-y-3 rounded-xl border-2 border-primary/50 bg-primary/5 p-3">
      <div>
        <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <KeyRound className="h-4 w-4 text-primary" /> {t("generated.heading")}
        </p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          <Trans i18n={masterI18n} t={t} i18nKey="generated.body" components={{ b: <strong /> }} />
        </p>
      </div>

      <ul className="space-y-1">
        {spec.labels.map((l) => (
          <li
            key={l}
            className="rounded-lg border border-border bg-background px-2.5 py-1.5 font-mono text-[11px] text-foreground"
          >
            {l}
          </li>
        ))}
      </ul>

      <a
        href={generatorHref}
        target="_blank"
        rel="noreferrer"
        className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground hover:opacity-90"
      >
        <ExternalLink className="h-4 w-4" /> {t("generated.openConsole")}
      </a>

      {spec.carriesSecrets ? (
        <div className="space-y-2 rounded-lg border border-amber-500/50 bg-amber-500/5 p-2.5">
          <p className="text-xs font-semibold text-foreground">{t("generated.secretsOnce")}</p>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            <Trans
              i18n={masterI18n}
              t={t}
              i18nKey="generated.secretsBody"
              components={{ b: <strong className="text-foreground" /> }}
            />
          </p>
          {/* Closes the recovery loop. The API password is now reused by
           * default (see RouterSetupScriptAdvanced's mint block), which is
           * correct everywhere EXCEPT straight after step 9's cleanup --
           * that deletes the `cloudguest-api` user from the device, so a
           * plain Generate would leave out the "API Access" chunk and the
           * user would never come back. The one place he needs to know
           * that is here, at the moment he is sent to the generator. */}
          <p className="rounded-lg border border-border bg-background px-2.5 py-2 text-[11px] leading-relaxed text-muted-foreground">
            <Trans
              i18n={masterI18n}
              t={t}
              i18nKey="generated.step9Note"
              components={{ b: <strong className="text-foreground" />, c: <code /> }}
            />
          </p>
          <label className="flex cursor-pointer items-start gap-2 pt-0.5">
            <Checkbox
              checked={secretsAck}
              onCheckedChange={(v) => onSecretsAck(v === true)}
              className="mt-0.5"
            />
            <span className="text-xs text-foreground">
              <Trans
                i18n={masterI18n}
                t={t}
                i18nKey="generated.ack"
                components={{ b: <strong /> }}
              />
            </span>
          </label>
        </div>
      ) : (
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          <Trans
            i18n={masterI18n}
            t={t}
            i18nKey="generated.nonSecretNote"
            components={{ b: <strong className="text-foreground" /> }}
          />
        </p>
      )}

      <RegenerateGuard routerName={routerName} onGoToRecovery={onGoToRecovery} />
    </div>
  );
}
