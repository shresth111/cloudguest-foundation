import { useState } from "react";
import { toast } from "sonner";
import { Loader2, ShieldCheck } from "lucide-react";
import { MButton, MTag } from "@/components/master/MasterKit";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/context/AuthContext";
import { useFirewallBand, useInstallFirewallBand } from "@/hooks/useFirewall";
import { requestErrorOf } from "@/services/api";

/**
 * Master console: whether a MikroTik is prepared for customer firewall
 * rules, and the one action that prepares it (cloud-guest#304).
 *
 * WHY THIS IS HERE, AND ONLY HERE
 * -------------------------------
 * A venue's Apply (Security -> Firewall) writes its rules between two
 * sentinel rules -- the "band" -- in the router's forward chain, and refuses
 * with `ACCESS_RULES_BAND_MISSING` until that band exists. Placing it is a
 * provisioning decision: it goes directly above the router's
 * established-connection accept (PRD §37.1), and a band in the wrong place is
 * a guest network that stops working. So the backend pins
 * `POST /firewall-rules/routers/{id}/band` to `firewall.manage` at GLOBAL
 * scope, and the customer screen tells the owner to contact support rather
 * than offering a button that would 403.
 *
 * WHY IN THE FLEET DRAWER
 * -----------------------
 * The drawer's "Manage this router" links to `/routers/$routerId`, which
 * `_authenticated.tsx` redirects to `/master` on the master host -- so the
 * full router screen is not reachable from inside the Master console. The
 * drawer is. Rendered only for agent-managed (MikroTik) rows: #304 refuses a
 * controller-managed router here too, and a button that can only fail is
 * the defect this console has been cleaning out.
 *
 * STATUS
 * ------
 * `GET .../band` lands in a PR parallel to #304. Until it is deployed the
 * read 404s, which is shown as "Not checked" -- never as ready or missing.
 * The action stays available either way: it is idempotent (an existing band
 * is left alone and reported as such), so pressing it on a prepared router
 * is harmless and is itself the check.
 */
export function FirewallBandPanel({
  routerId,
  routerName,
}: {
  routerId: string;
  routerName: string;
}) {
  const { can } = useAuth();
  // No organization header: the Master caller's grant is platform-wide.
  const band = useFirewallBand(routerId, "");
  const install = useInstallFirewallBand();
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [placed, setPlaced] = useState<boolean | null>(null);

  const state = band.data?.state ?? null;
  const tag = band.isLoading
    ? { label: "Checking…", tone: "muted" }
    : band.isError
      ? { label: "Couldn't check", tone: "offline" }
      : state === "ready"
        ? { label: "Prepared", tone: "online" }
        : state === "missing"
          ? { label: "Not prepared", tone: "warning" }
          : state === "invalid"
            ? { label: "Band damaged", tone: "offline" }
            : { label: "Not checked", tone: "muted" };

  function run() {
    setConfirm(false);
    setError(null);
    setPlaced(null);
    install.mutate(routerId, {
      onSuccess: (r) => {
        setPlaced(r.created);
        toast.success(
          r.created
            ? `${routerName}: prepared for firewall rules`
            : `${routerName} was already prepared -- nothing changed`,
        );
      },
      onError: (err) => {
        const e = requestErrorOf(err);
        const code = typeof e?.data?.code === "string" ? `${e.data.code}: ` : "";
        setError(
          e?.status === 403
            ? "Your account does not hold firewall.manage at platform level, which this action requires."
            : `${code}${e?.message ?? "The router could not be prepared."}`,
        );
      },
    });
  }

  const allowed = can("firewall.manage");

  return (
    <div className="space-y-2 rounded-lg border border-border p-2.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">Customer firewall rules</p>
        <MTag label={tag.label} tone={tag.tone} />
      </div>
      {state !== null && band.data?.reason && (
        <p className="text-[11px] text-muted-foreground">{band.data.reason}</p>
      )}
      {state === null && !band.isLoading && !band.isError && (
        <p className="text-[11px] text-muted-foreground">
          This backend doesn&apos;t report the band yet. Preparing is safe to repeat: an existing
          band is left where it is.
        </p>
      )}
      {placed !== null && !error && (
        <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
          {placed
            ? "Band placed. The venue can now apply its firewall rules."
            : "A band was already there and was left in place."}
        </p>
      )}
      {error && (
        <p role="alert" className="text-[11px] text-destructive">
          {error}
        </p>
      )}
      {allowed ? (
        <MButton
          variant="outline"
          className="w-full justify-center"
          disabled={install.isPending || state === "ready"}
          onClick={() => setConfirm(true)}
        >
          {install.isPending ? <Loader2 className="animate-spin" /> : <ShieldCheck />}
          Prepare router for firewall rules
        </MButton>
      ) : (
        <p className="text-[11px] text-muted-foreground">
          Preparing a router needs firewall.manage at platform level.
        </p>
      )}

      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Prepare {routerName} for firewall rules?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  This adds two pass-through marker rules to the router&apos;s forward chain,
                  directly above <code>cloudguest-fw-fwd-established</code>. Pass-through rules only
                  count packets and hand them on, so guest traffic is unchanged.
                </p>
                <p>
                  After this the venue can apply its own firewall rules, which go between the two
                  markers. Nothing is written if the anchor rule is missing or appears more than
                  once, or if only half a band is already there. An existing band is never moved.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={run}>Prepare router</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
