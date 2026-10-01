import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Globe2, Loader2, RotateCw, X } from "lucide-react";
import i18n from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { requestErrorOf } from "@/services/api";
import {
  useContentFilterRules,
  useCreateContentFilterRule,
  useDeleteContentFilterRule,
  usePushContentFilterRule,
} from "@/hooks/useContentFilter";
import { useWebFilterRouterAction, useWebFilterRouterStatus } from "@/hooks/useDnsFiltering";
import { websiteToDomain } from "@/lib/firewall-rules";
import type { ContentFilterRule } from "@/types/contentFilter";

const CHIP_STYLE: Record<ContentFilterRule["devicePushStatus"], string> = {
  active: "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300",
  pending: "border-zinc-500/30 bg-zinc-500/10 text-zinc-700 dark:text-zinc-300",
  failed: "border-rose-500/30 bg-rose-500/10 text-rose-800 dark:text-rose-300",
};

/**
 * "Block a website" on Security -> Block Websites (it started on the Firewall
 * screen and moved so that websites have one home): type a name, press
 * Block, done.
 *
 * A firewall rule matches addresses, and a website has no address an owner
 * can know -- youtube.com answers from hundreds of IPs that change hourly.
 * So a website is blocked by NAME, through the router's own DNS: these are
 * the content-filtering domain rows (`/content-filters`, the same rows
 * Block Websites' "Advanced" rule list shows), which cloud-guest pushes as
 * `/ip dns static` sinkhole entries covering the name and every subdomain.
 *
 * Block is one action for the owner but two calls here: create the row, then
 * push it. A row that saved but did not push is shown as "not on the router"
 * with a retry, never as blocked. Removing deletes the row, and the backend
 * takes the entry off the router first (a device failure aborts the delete,
 * so a chip that disappears really is unblocked).
 */
export function WebsiteBlockBox({ routerId }: { routerId: string }) {
  const { t } = useTranslation("nav", { i18n });
  const list = useContentFilterRules({ routerId, page: 1, pageSize: 100 });
  const create = useCreateContentFilterRule();
  const push = usePushContentFilterRule();
  const del = useDeleteContentFilterRule();

  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const sites = (list.data?.rows ?? []).filter((r) => r.valueType === "domain");

  async function block() {
    const domain = websiteToDomain(value);
    if (!domain) {
      setError(
        t(
          "blockWebsites.siteInvalid",
          "Type a website name like youtube.com. To block an internet address, open Advanced at the bottom of this page.",
        ),
      );
      return;
    }
    if (sites.some((s) => s.value === domain)) {
      setError(
        t("firewallPage.siteDuplicate", "{{site}} is already on the list.", { site: domain }),
      );
      return;
    }
    setError(null);
    setBusy(true);
    let created: ContentFilterRule | null = null;
    try {
      created = await create.mutateAsync({
        routerId,
        name: domain,
        valueType: "domain",
        value: domain,
        category: "custom",
        isEnabled: true,
      });
      await push.mutateAsync({ id: created.id });
      toast.success(
        t("firewallPage.siteBlocked", "{{site}} is blocked on the router.", { site: domain }),
      );
      setValue("");
    } catch (err) {
      const msg = requestErrorOf(err)?.message;
      setError(
        created
          ? t(
              "firewallPage.siteSavedNotPushed",
              "{{site}} was saved but didn't reach the router, so it isn't blocked yet. Press retry on it.",
              { site: domain },
            ) + (msg ? ` (${msg})` : "")
          : (msg ?? t("firewallPage.siteSaveFailed", "Couldn't block {{site}}.", { site: domain })),
      );
    } finally {
      setBusy(false);
    }
  }

  function retry(rule: ContentFilterRule) {
    push.mutate(
      { id: rule.id },
      {
        onSuccess: () =>
          toast.success(
            t("firewallPage.siteBlocked", "{{site}} is blocked on the router.", {
              site: rule.value,
            }),
          ),
        onError: (err) => toast.error(requestErrorOf(err)?.message ?? `Couldn't reach the router.`),
      },
    );
  }

  function unblock(rule: ContentFilterRule) {
    del.mutate(
      { id: rule.id },
      {
        onSuccess: () =>
          toast.success(
            t("firewallPage.siteUnblocked", "{{site}} is open again.", { site: rule.value }),
          ),
        onError: (err) =>
          toast.error(
            requestErrorOf(err)?.message ??
              t(
                "firewallPage.siteUnblockFailed",
                "Couldn't reach the router, so {{site}} is still blocked. Try again.",
                { site: rule.value },
              ),
          ),
      },
    );
  }

  return (
    <section className="space-y-3 rounded-lg border border-border/60 bg-muted/30 p-4">
      <div className="space-y-0.5">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Globe2 className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          {t("firewallPage.siteTitle", "Block a website")}
        </h3>
        <p className="text-xs text-muted-foreground">
          {t(
            "firewallPage.siteHint",
            "Type the name — no address needed. It's blocked by name on the router (DNS), including every page and subdomain of it.",
          )}
        </p>
      </div>

      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          void block();
        }}
      >
        <Input
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (error) setError(null);
          }}
          placeholder="youtube.com"
          inputMode="url"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          aria-label={t("firewallPage.siteInput", "Website to block")}
          aria-invalid={!!error}
          className="sm:max-w-sm"
        />
        <Button type="submit" disabled={busy || !value.trim()}>
          {busy && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden="true" />}
          {t("firewallPage.siteBlock", "Block")}
        </Button>
      </form>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}

      {list.isLoading ? (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          {t("firewallPage.siteLoading", "Loading blocked websites…")}
        </p>
      ) : sites.length > 0 ? (
        <ul
          className="flex flex-wrap gap-2"
          aria-label={t("firewallPage.siteList", "Blocked websites")}
        >
          {sites.map((s) => {
            const pushing = push.isPending && push.variables?.id === s.id;
            const removing = del.isPending && del.variables?.id === s.id;
            const off = !s.isEnabled;
            return (
              <li
                key={s.id}
                className={cn(
                  "flex items-center gap-1 rounded-full border py-0.5 pl-3 pr-1 text-xs",
                  CHIP_STYLE[s.devicePushStatus],
                )}
                title={s.devicePushError ?? undefined}
              >
                <span className="font-medium">{s.value}</span>
                {(s.devicePushStatus !== "active" || off) && (
                  <span className="opacity-80">
                    ·{" "}
                    {off
                      ? t("firewallPage.siteOff", "switched off")
                      : s.devicePushStatus === "failed"
                        ? t("firewallPage.siteFailed", "didn't reach router")
                        : t("firewallPage.sitePending", "not on router yet")}
                  </span>
                )}
                {s.devicePushStatus !== "active" && !off && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 rounded-full"
                    aria-label={t("firewallPage.siteRetry", "Send {{site}} to the router", {
                      site: s.value,
                    })}
                    disabled={pushing}
                    onClick={() => retry(s)}
                  >
                    <RotateCw className={cn("h-3 w-3", pushing && "animate-spin")} />
                  </Button>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 rounded-full"
                  aria-label={t("firewallPage.siteRemove", "Unblock {{site}}", { site: s.value })}
                  disabled={removing}
                  onClick={() => unblock(s)}
                >
                  {removing ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <X className="h-3 w-3" />
                  )}
                </Button>
              </li>
            );
          })}
        </ul>
      ) : null}

      {sites.length > 0 && <BypassSwitch routerId={routerId} />}
    </section>
  );
}

/**
 * "Stop guests getting around these blocks": the router's DNS-bypass layers
 * (cloud-guest dns_filtering bypass hardening). A name block lives in the
 * router's own DNS, so a guest who sets 8.8.8.8 or Android Private DNS walks
 * straight past it; these layers send every guest lookup through the router.
 * The backend accepts them for a router with website blocks even when Web
 * filtering is off. Hidden when the status can't be read (no permission, or
 * a backend without the endpoint) rather than shown as a switch that 403s.
 */
function BypassSwitch({ routerId }: { routerId: string }) {
  const { t } = useTranslation("nav", { i18n });
  const status = useWebFilterRouterStatus(routerId);
  const action = useWebFilterRouterAction(routerId);
  if (!status.data) return null;
  const s = status.data;
  return (
    <div className="flex items-start justify-between gap-4 rounded-md border border-border/60 bg-background p-3">
      <div className="space-y-0.5">
        <p className="text-sm font-medium">
          {t("firewallPage.bypassTitle", "Stop guests getting around these blocks")}
        </p>
        <p className="text-xs text-muted-foreground">
          {t(
            "firewallPage.bypassBody",
            "Without this, a guest who changes their phone's DNS (like 8.8.8.8 or Private DNS) can still open blocked websites.",
          )}
        </p>
        {s.bypassHardeningStatus === "failed" && (
          <p role="alert" className="text-xs text-destructive">
            {t("firewallPage.bypassFailed", "The last change to this didn't work.")}
            {s.bypassHardeningError ? ` ${s.bypassHardeningError}` : ""}
          </p>
        )}
      </div>
      <Switch
        checked={s.bypassHardeningEnabled}
        disabled={action.isPending}
        aria-label={t("firewallPage.bypassTitle", "Stop guests getting around these blocks")}
        onCheckedChange={(v) =>
          action.mutate(
            { kind: "bypass", enabled: v },
            {
              onSuccess: () =>
                toast.success(
                  v
                    ? t("firewallPage.bypassOnToast", "Guests can no longer get around the blocks.")
                    : t("firewallPage.bypassOffToast", "Bypass protection is off."),
                ),
              onError: (err) =>
                toast.error(requestErrorOf(err)?.message ?? "Couldn't change this on the router."),
            },
          )
        }
      />
    </div>
  );
}

export default WebsiteBlockBox;
