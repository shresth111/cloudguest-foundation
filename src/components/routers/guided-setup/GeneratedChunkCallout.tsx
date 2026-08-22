import { ExternalLink, KeyRound } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
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
          <KeyRound className="h-4 w-4 text-primary" /> Pehle: Master console se yeh chunk paste
          karo
        </p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Yeh hisse <strong>is router ke apne</strong> hain (IDs, keys, secrets) -- inhe yahan nahi
          dikhaya ja sakta. Master console kholo, script generate karo, aur neeche wale naam ke
          chunk copy karke router pe paste karo. <strong>Uske baad</strong> is page ke universal
          blocks chalao.
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
        <ExternalLink className="h-4 w-4" /> Master console kholo (nayi tab me)
      </a>

      {spec.carriesSecrets ? (
        <div className="space-y-2 rounded-lg border border-amber-500/50 bg-amber-500/5 p-2.5">
          <p className="text-xs font-semibold text-foreground">
            Yeh secrets sirf ek baar dikhte hain
          </p>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            WireGuard key, RADIUS secret aur API password dobara nahi mil sakte. Master console me{" "}
            <strong className="text-foreground">"Download .rsc"</strong> hi tumhari asli copy hai --
            usse pehle tab band mat karna.
          </p>
          {/* Closes the recovery loop. The API password is now reused by
           * default (see RouterSetupScriptAdvanced's mint block), which is
           * correct everywhere EXCEPT straight after step 9's cleanup --
           * that deletes the `cloudguest-api` user from the device, so a
           * plain Generate would leave out the "API Access" chunk and the
           * user would never come back. The one place he needs to know
           * that is here, at the moment he is sent to the generator. */}
          <p className="rounded-lg border border-border bg-background px-2.5 py-2 text-[11px] leading-relaxed text-muted-foreground">
            Step 9 ki safai ke baad aa rahe ho? Master console me{" "}
            <strong className="text-foreground">"Rotate the RouterOS API password"</strong> wala box
            bhi tick karna -- warna "API Access" chunk script me aayega hi nahi aur router ka
            <code> cloudguest-api</code> user wapas nahi banega. Normal setup me is box ko haath mat
            lagana.
          </p>
          <label className="flex cursor-pointer items-start gap-2 pt-0.5">
            <Checkbox
              checked={secretsAck}
              onCheckedChange={(v) => onSecretsAck(v === true)}
              className="mt-0.5"
            />
            <span className="text-xs text-foreground">
              <strong>Mere paas copy hai</strong> -- .rsc download kar liya ya safe jagah save kar
              liya.
            </span>
          </label>
        </div>
      ) : (
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Master console me <strong className="text-foreground">"Download .rsc"</strong> dabakar
          poori script ki ek copy rakh lo -- usme aage ke phases ke secrets bhi hain, jo dobara nahi
          dikhenge.
        </p>
      )}

      <RegenerateGuard routerName={routerName} onGoToRecovery={onGoToRecovery} />
    </div>
  );
}
