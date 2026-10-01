import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Globe2, Loader2, RotateCw, X } from "lucide-react";
import i18n from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requestErrorOf } from "@/services/api";
import {
  useContentFilterRules,
  useCreateContentFilterRule,
  useDeleteContentFilterRule,
  usePushContentFilterRule,
} from "@/hooks/useContentFilter";
import { websiteToDomain } from "@/lib/firewall-rules";
import type { ContentFilterRule } from "@/types/contentFilter";

const CHIP_STYLE: Record<ContentFilterRule["devicePushStatus"], string> = {
  active: "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300",
  pending: "border-zinc-500/30 bg-zinc-500/10 text-zinc-700 dark:text-zinc-300",
  failed: "border-rose-500/30 bg-rose-500/10 text-rose-800 dark:text-rose-300",
};

/**
 * "Block a website" on the Firewall screen: type a name, press Block, done.
 *
 * A firewall rule matches addresses, and a website has no address an owner
 * can know -- youtube.com answers from hundreds of IPs that change hourly.
 * So a website is blocked by NAME, through the router's own DNS: these are
 * the content-filtering domain rows (`/content-filters`, the same rows
 * Security -> Blocking -> Websites lists), which cloud-guest pushes as
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
          "firewallPage.siteInvalid",
          "Type a website name like youtube.com. To block an address, add a rule below.",
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

      <p className="text-xs text-muted-foreground">
        {t(
          "firewallPage.siteCategoriesPrefix",
          "Want to block whole kinds of sites (adult, gambling, …)? Use",
        )}{" "}
        <Link
          to="/web-filtering"
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          {t("customerItem.web-filtering", "Web filtering")}
        </Link>
        .
      </p>
    </section>
  );
}

export default WebsiteBlockBox;
