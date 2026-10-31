/**
 * Internet Connection -- the customer's ISP page, on the network-ops console.
 *
 * Moved here from `components/features/OperationsFeatures.tsx` (which
 * re-exports it, so `lazyView(OPS, "IspDetailsView")` is unchanged). The
 * data layer is the one the page already had, unchanged in what it asks for:
 *
 *   - routers   `routerService.listForLocation`        (once per location)
 *   - links     `ispService.listLinks({ routerId })`   (+ the 20s visible-tab poll)
 *   - rules     `ispService.listRoutingRules`          (MikroTik rows only)
 *   - per link  `listHealthChecks(page_size=30)` + `getHealthCheckSummary(range)`
 *               -- the two reads the old per-row timeline and history dialog
 *               made; see `useIspHistory.ts`.
 *
 * Every write is the one the old table offered: create/update/remove link,
 * check health now, manual up/down, routing-rule CRUD. Nothing pushes to the
 * router from here that did not before. Demo fixtures only behind `isDemo()`.
 *
 * Contract §11.5 (controller-managed venues): records stay, conversations
 * with the device (health checks, routing rules) are gated -- see
 * `deviceControlsApply`.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowLeftRight,
  GitBranch,
  Globe,
  Network,
  Pencil,
  Plus,
  RotateCw,
  Router as RouterIcon,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  controllerRouterDeviceWriteReason,
  isControllerManaged,
  isNasOnlyVendor,
  routerVendorLabel,
} from "@/lib/router-vendors";
import { humanizeApiError } from "@/lib/errorMessages";
import type { AppError } from "@/services/api";
import { isDemo, resolveOrgId } from "@/services/customer.service";
import { routerService } from "@/services/router.service";
import { ispService } from "@/services/isp.service";
import { matchValueFromRule } from "@/components/network/IspManagement";
import { EmptyState, Panel, StatTile, StatusDot } from "@/components/customer/console";
import {
  SectionBoundary,
  SectionFailed,
  PanelTitle,
} from "@/components/customer/dashboard/overview/console-ui";
import type { RouterDevice } from "@/types/router";
import type { IspLink, IspManualHealthStatus, IspRoutingRule } from "@/types/isp";
import {
  failoverState,
  isLinkList,
  linkStatus,
  sortLinks,
  stateChanges,
  uptimePercent,
} from "./isp-model";
import {
  FailoverBanner,
  LinkStatus,
  STATUS_TEXT,
  fmtClock,
  ispColor,
  useIspT,
  useStatusWord,
} from "./isp-ui";
import { IspLinkCard } from "./IspLinkCard";
import { IspHistoryPanel } from "./IspHistoryPanel";
import { IspPathDiagram } from "./IspPathDiagram";
import {
  IspLinkDialog,
  IspRuleDialog,
  type IspLinkFormState,
  type IspRuleFormState,
} from "./IspDialogs";
import { DEMO_ISP_LINKS, DEMO_ISP_ROUTER, type IspRange } from "./isp.demo";
import { useIspRecentChecks, useIspSummaries } from "./useIspHistory";

const ISP_LINKS_POLL_INTERVAL_MS = 20_000;

export function IspDetailsView({ locationId }: { locationId?: string }) {
  const demo = isDemo();
  const { t, i18n: inst } = useIspT();
  const lang = inst.language;
  const word = useStatusWord();

  const [routers, setRouters] = useState<RouterDevice[]>([]);
  const [routersLoading, setRoutersLoading] = useState(true);
  // "The fetch failed" vs "there are genuinely zero routers/links" -- the
  // two must never render the same empty state (see the old view's notes).
  const [routersError, setRoutersError] = useState(false);
  const [routersRetryTick, setRoutersRetryTick] = useState(0);
  const [selectedRouterId, setSelectedRouterId] = useState("");
  const [links, setLinks] = useState<IspLink[]>([]);
  const [linksLoading, setLinksLoading] = useState(false);
  const [linksError, setLinksError] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLink, setEditingLink] = useState<IspLink | null>(null);
  const [saving, setSaving] = useState(false);
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const [statusBusyId, setStatusBusyId] = useState<string | null>(null);
  const [rules, setRules] = useState<IspRoutingRule[]>([]);
  const [rulesLoading, setRulesLoading] = useState(false);
  const [ruleDialogOpen, setRuleDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<IspRoutingRule | null>(null);
  const [savingRule, setSavingRule] = useState(false);
  const [range, setRange] = useState<IspRange>("24h");
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const historyRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setRoutersLoading(true);
      setRoutersError(false);
      try {
        const rows = demo
          ? [DEMO_ISP_ROUTER]
          : locationId
            ? await routerService.listForLocation(locationId, await resolveOrgId())
            : [];
        if (!alive) return;
        const safe = Array.isArray(rows) ? rows : [];
        setRouters(safe);
        setSelectedRouterId((prev) =>
          prev && safe.some((r) => r.id === prev) ? prev : (safe[0]?.id ?? ""),
        );
      } catch {
        if (!alive) return;
        setRoutersError(true);
        setRouters([]);
        toast.error(t("toast.routersError", "Could not load routers for this location."));
      } finally {
        if (alive) setRoutersLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId, demo, routersRetryTick]);

  // `quiet` backs the background poll: no skeleton flash, no toast spam,
  // and a failed tick keeps the last known-good rows.
  const loadLinks = async (routerId: string, opts: { quiet?: boolean } = {}) => {
    if (!routerId) {
      setLinks([]);
      setLinksError(false);
      return;
    }
    if (!opts.quiet) {
      setLinksLoading(true);
      setLinksError(false);
    }
    try {
      if (demo) {
        setLinks(routerId === DEMO_ISP_ROUTER.id ? DEMO_ISP_LINKS : []);
      } else {
        const result = await ispService.listLinks({ routerId, page: 1, pageSize: 25 });
        if (!isLinkList(result?.rows)) throw new Error("bad /isp/links shape");
        setLinks(result.rows);
      }
      if (!opts.quiet) setLinksError(false);
    } catch {
      if (!opts.quiet) {
        setLinksError(true);
        toast.error(t("toast.linksError", "Could not load ISP links for this router."));
        setLinks([]);
      }
    } finally {
      if (!opts.quiet) setLinksLoading(false);
    }
  };

  useEffect(() => {
    loadLinks(selectedRouterId); /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [selectedRouterId, demo]);

  // Auto-refresh every 20s while the tab is visible -- unchanged from the
  // old view. Skips a tick that lands mid-manual-action so a racing poll
  // cannot clobber the action's own fresher response.
  const checkingIdRef = useRef(checkingId);
  const statusBusyIdRef = useRef(statusBusyId);
  useEffect(() => {
    checkingIdRef.current = checkingId;
  }, [checkingId]);
  useEffect(() => {
    statusBusyIdRef.current = statusBusyId;
  }, [statusBusyId]);

  useEffect(() => {
    if (demo || !selectedRouterId) return;
    let timer: ReturnType<typeof setInterval> | null = null;
    const tick = () => {
      if (checkingIdRef.current != null || statusBusyIdRef.current != null) return;
      loadLinks(selectedRouterId, { quiet: true });
    };
    const start = () => {
      if (timer == null) timer = setInterval(tick, ISP_LINKS_POLL_INTERVAL_MS);
    };
    const stop = () => {
      if (timer != null) {
        clearInterval(timer);
        timer = null;
      }
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        tick();
        start();
      } else {
        stop();
      }
    };
    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRouterId, demo]);

  const selectedRouter = routers.find((r) => r.id === selectedRouterId) ?? null;
  const deviceControlsApply = !isControllerManaged(selectedRouter?.vendor);

  const loadRules = async (routerId: string) => {
    if (!routerId) {
      setRules([]);
      return;
    }
    setRulesLoading(true);
    try {
      // No demo fixture for routing rules: the demo shows the real empty state.
      const result = demo
        ? { rows: [] as IspRoutingRule[] }
        : await ispService.listRoutingRules({ routerId, page: 1, pageSize: 25 });
      setRules(Array.isArray(result?.rows) ? result.rows : []);
    } catch {
      toast.error(t("toast.rulesError", "Could not load routing rules for this router."));
      setRules([]);
    } finally {
      setRulesLoading(false);
    }
  };

  useEffect(() => {
    loadRules(selectedRouterId); /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [selectedRouterId, demo]);

  const sorted = useMemo(() => sortLinks(links), [links]);
  const linkIds = sorted.map((l) => l.id);
  const recent = useIspRecentChecks(linkIds, demo);
  const summaries = useIspSummaries(linkIds, range, demo);
  const failover = failoverState(sorted);
  const multi = sorted.length > 1;

  /* ---------- writes (unchanged behaviour) ---------- */

  const openCreate = () => {
    setEditingLink(null);
    setDialogOpen(true);
  };
  const openEdit = (link: IspLink) => {
    setEditingLink(link);
    setDialogOpen(true);
  };

  const saveLink = async (form: IspLinkFormState) => {
    if (demo) {
      toast.error(t("toast.demoLinks", "Sign in to a real account to manage ISP links."));
      return;
    }
    if (!selectedRouterId) return;
    setSaving(true);
    try {
      const payload = {
        routerId: selectedRouterId,
        providerName: form.providerName.trim(),
        linkType: form.linkType,
        connectionMode: form.connectionMode,
        role: form.role,
        priority: form.priority,
        interface: form.interfaceName.trim() || null,
        // Only a STATIC link has a manually-entered gateway.
        gatewayIpAddress:
          form.connectionMode === "static" ? form.gatewayIpAddress.trim() || null : null,
        dnsPrimary: form.dnsPrimary.trim() || null,
        dnsSecondary: form.dnsSecondary.trim() || null,
        downloadBandwidthMbps: form.downloadBandwidthMbps ? +form.downloadBandwidthMbps : null,
        uploadBandwidthMbps: form.uploadBandwidthMbps ? +form.uploadBandwidthMbps : null,
        autoFailback: form.autoFailback,
      };
      if (editingLink) {
        const updated = await ispService.updateLink(editingLink.id, payload);
        setLinks((ls) => ls.map((l) => (l.id === updated.id ? updated : l)));
        toast.success(t("toast.linkUpdated", "ISP link updated"));
      } else {
        const created = await ispService.createLink(payload);
        setLinks((ls) => [created, ...ls]);
        toast.success(t("toast.linkAdded", "ISP link added"));
      }
      setDialogOpen(false);
    } catch (err) {
      toast.error(humanizeApiError(err as AppError, "Could not save the ISP link."));
    } finally {
      setSaving(false);
    }
  };

  const removeLink = async (link: IspLink) => {
    if (demo) {
      toast.error(t("toast.demoLinks", "Sign in to a real account to manage ISP links."));
      return;
    }
    setLinks((ls) => ls.filter((l) => l.id !== link.id));
    try {
      await ispService.removeLink(link.id);
      toast.success(t("toast.linkRemoved", "ISP link removed"));
    } catch (err) {
      toast.error(humanizeApiError(err as AppError, "Could not remove the ISP link."));
      setLinks((ls) => [link, ...ls]);
    }
  };

  const checkHealth = async (link: IspLink) => {
    if (demo) {
      toast.info(
        t(
          "toast.demoCheck",
          "Health checks run against real router hardware -- not available in demo mode.",
        ),
      );
      return;
    }
    setCheckingId(link.id);
    try {
      const updated = await ispService.checkLinkHealth(link.id);
      setLinks((ls) => ls.map((l) => (l.id === updated.id ? updated : l)));
      toast.success(
        t("toast.checkDone", "Health check complete — {{status}}", {
          status: word(updated.healthStatus),
        }),
      );
    } catch (err) {
      toast.error(humanizeApiError(err as AppError, "Health check failed."));
    } finally {
      setCheckingId(null);
    }
  };

  // An admin's manual up/down override. Never pushes to the router; the
  // next automated check reclaims the link's real status.
  const setLinkManualStatus = async (link: IspLink, healthStatus: IspManualHealthStatus) => {
    if (demo) {
      toast.info(t("toast.demoManual", "Manual status overrides aren't available in demo mode."));
      return;
    }
    setStatusBusyId(link.id);
    try {
      const updated = await ispService.setManualStatus(link.id, healthStatus);
      setLinks((ls) => ls.map((l) => (l.id === updated.id ? updated : l)));
      toast.success(
        healthStatus === "healthy"
          ? t("toast.markedUp", "{{name}} marked Up", { name: link.providerName })
          : t("toast.markedDown", "{{name}} marked Down", { name: link.providerName }),
      );
    } catch (err) {
      toast.error(humanizeApiError(err as AppError, "Could not update ISP link status."));
    } finally {
      setStatusBusyId(null);
    }
  };

  const openCreateRule = () => {
    setEditingRule(null);
    setRuleDialogOpen(true);
  };
  const openEditRule = (r: IspRoutingRule) => {
    setEditingRule(r);
    setRuleDialogOpen(true);
  };

  const saveRule = async (form: IspRuleFormState) => {
    if (demo) {
      toast.error(t("toast.demoRules", "Sign in to a real account to manage routing rules."));
      return;
    }
    if (!selectedRouterId) return;
    setSavingRule(true);
    try {
      const matchFields = {
        vlanId: form.ruleType === "vlan" ? Number(form.matchValue) : null,
        sourceMacAddress: form.ruleType === "user" ? form.matchValue : null,
        ipAddress: form.ruleType === "ip" ? form.matchValue : null,
        sourceCidr: form.ruleType === "source" ? form.matchValue : null,
        interfaceName: form.ruleType === "interface" ? form.matchValue : null,
        policyId: form.ruleType === "policy" ? form.matchValue : null,
      };
      const shared = {
        ispLinkId: form.ispLinkId,
        ruleType: form.ruleType,
        name: form.name.trim(),
        description: form.description.trim() || null,
        priority: form.priority,
        ...matchFields,
      };
      if (editingRule) {
        const updated = await ispService.updateRoutingRule(editingRule.id, {
          ...shared,
          isEnabled: form.isEnabled,
        });
        setRules((rs) => rs.map((r) => (r.id === updated.id ? updated : r)));
        toast.success(t("toast.ruleUpdated", "Routing rule updated"));
      } else {
        const created = await ispService.createRoutingRule({
          routerId: selectedRouterId,
          ...shared,
        });
        setRules((rs) => [created, ...rs]);
        toast.success(t("toast.ruleAdded", "Routing rule added"));
      }
      setRuleDialogOpen(false);
    } catch (err) {
      toast.error(humanizeApiError(err as AppError, "Could not save the routing rule."));
    } finally {
      setSavingRule(false);
    }
  };

  const removeRule = async (rule: IspRoutingRule) => {
    if (demo) {
      toast.error(t("toast.demoRules", "Sign in to a real account to manage routing rules."));
      return;
    }
    setRules((rs) => rs.filter((r) => r.id !== rule.id));
    try {
      await ispService.removeRoutingRule(rule.id);
      toast.success(t("toast.ruleRemoved", "Routing rule removed"));
    } catch (err) {
      toast.error(humanizeApiError(err as AppError, "Could not remove the routing rule."));
      setRules((rs) => [rule, ...rs]);
    }
  };

  const showHistoryFor = (linkId: string) => {
    setHidden(new Set(sorted.filter((l) => l.id !== linkId).map((l) => l.id)));
    historyRef.current?.scrollIntoView({
      behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      block: "start",
    });
  };
  const toggleLine = (id: string) =>
    setHidden((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      // Never hide every line: the charts would be blank for no reason.
      return next.size >= sorted.length ? new Set() : next;
    });

  /* ---------- derived reading ---------- */

  const healthyCount = sorted.filter((l) => l.healthStatus === "healthy").length;
  const activeLink = sorted.find((l) => l.isActiveUplink) ?? null;
  const activeSummary = activeLink ? summaries.byLink[activeLink.id] : undefined;
  const activeUptime =
    activeSummary?.status === "ready" ? uptimePercent(activeSummary.data.buckets) : null;
  const routerOnline = selectedRouter?.status === "online";

  let headline = "";
  let headNote: string | null = null;
  let headStatus = linkStatus("unknown");
  if (sorted.length) {
    const known = sorted.filter((l) => l.healthStatus && l.healthStatus !== "unknown");
    const others = sorted.filter(
      (l) => l !== activeLink && l.healthStatus !== "healthy" && l.healthStatus !== "unknown",
    );
    if (failover.kind === "all-down") {
      headline = t("head.allDown", "No internet");
      headStatus = "crit";
    } else if (failover.kind === "on-backup") {
      headline = t("head.onBackup", "Online on backup");
      headStatus = "warn";
    } else if (known.length === 0) {
      headline = t("head.notChecked", "Not checked yet");
    } else if (activeLink?.healthStatus === "healthy" || (!multi && healthyCount === 1)) {
      // The line carrying traffic is what guests feel; a standby line's
      // trouble is said underneath, not as the headline.
      headline = t("head.online", "Online");
      headStatus = "ok";
      if (others.length)
        headNote = t("head.otherIssue", "{{names}}: {{status}}", {
          names: others.map((l) => l.providerName).join(", "),
          status: others.map((l) => word(l.healthStatus)).join(", "),
        });
    } else if (healthyCount === sorted.length) {
      headline = t("head.allOnline", "All {{n}} lines online", { n: sorted.length });
      headStatus = "ok";
    } else {
      headline = t("head.someIssues", "{{up}} of {{n}} lines healthy", {
        up: healthyCount,
        n: sorted.length,
      });
      headStatus = activeLink?.healthStatus === "unhealthy" ? "crit" : "warn";
    }
  }

  const events = sorted
    .flatMap((l) => {
      const r = recent.byLink[l.id];
      return r?.status === "ready" ? stateChanges(r.data).map((e) => ({ ...e, link: l })) : [];
    })
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 10);

  const sectionFallback = (name: string) => (
    <SectionFailed
      title={t("sectionFailed.title", "This section couldn't be shown")}
      body={t(
        "sectionFailed.body",
        "The rest of the page still works. Reload to try {{name}} again.",
        { name },
      )}
    />
  );

  return (
    <div className="space-y-4" data-wy="isp-page">
      {/* Toolbar: what this page is, which router, add a line. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <p className="min-w-0 flex-1 basis-72 text-[13px] text-[var(--wy-text-muted)]">
          {t(
            "intro",
            "Your internet lines (ISPs): live health, speed against your plan, failover between lines, and history.",
          )}
        </p>
        {routers.length > 1 && (
          <Select
            value={selectedRouterId}
            onValueChange={setSelectedRouterId}
            disabled={routersLoading}
          >
            <SelectTrigger
              className="h-8 w-full text-[13px] sm:w-64"
              aria-label={t("router", "Router")}
            >
              <SelectValue placeholder={t("selectRouter", "Select a router")} />
            </SelectTrigger>
            <SelectContent className="wy-console">
              {/* Contract §11.5: a controller stays selectable here -- a
                  venue's uplink is a record about the building. */}
              {routers.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.name}{" "}
                  <span className="text-muted-foreground">
                    ({r.locationName || r.serialNumber})
                  </span>
                  {isControllerManaged(r.vendor) && (
                    <span className="text-muted-foreground">
                      {" "}
                      · {routerVendorLabel(r.vendor)}{" "}
                      {isNasOnlyVendor(r.vendor) ? "access points" : "controller"}
                    </span>
                  )}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {selectedRouterId && (
          <Button size="sm" onClick={openCreate} className="h-8">
            <Plus className="h-4 w-4" />
            {t("addLink", "Add ISP link")}
          </Button>
        )}
      </div>

      {routersLoading && (
        <div className="space-y-3" aria-busy="true" aria-label={t("loading", "Loading")}>
          <div className="h-20 animate-pulse rounded-[var(--wy-radius)] bg-[var(--wy-surface-2)]" />
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="h-56 animate-pulse rounded-[var(--wy-radius)] bg-[var(--wy-surface-2)]" />
            <div className="h-56 animate-pulse rounded-[var(--wy-radius)] bg-[var(--wy-surface-2)]" />
          </div>
        </div>
      )}
      {!routersLoading && routersError && (
        <Panel>
          <EmptyState
            icon={AlertTriangle}
            title={t("routersError.title", "Couldn't load routers")}
            description={t(
              "routersError.body",
              "Something went wrong fetching the routers for this location -- your connection or our servers, not a real empty account.",
            )}
            action={
              <Button size="sm" variant="outline" onClick={() => setRoutersRetryTick((n) => n + 1)}>
                <RotateCw className="h-3.5 w-3.5" />
                {t("retry", "Retry")}
              </Button>
            }
          />
        </Panel>
      )}
      {!routersLoading && !routersError && routers.length === 0 && (
        <Panel>
          <EmptyState
            icon={RouterIcon}
            title={t("noRouter.title", "No router at this location yet")}
            description={t(
              "noRouter.body",
              "Your internet lines are recorded against the venue's router. Once a router is set up here, add its ISP lines on this page.",
            )}
          />
        </Panel>
      )}

      {selectedRouter && (
        <>
          {!deviceControlsApply && (
            <div
              className="rounded-[var(--wy-radius)] border border-dashed border-[var(--wy-border-strong)] bg-[var(--wy-surface)] px-4 py-3 text-xs text-[var(--wy-text-muted)]"
              data-wy="controller-note"
            >
              <p>{controllerRouterDeviceWriteReason(selectedRouter.vendor)}</p>
              <p className="mt-1.5">
                {t(
                  "controllerNote",
                  "You can still record this venue's uplinks here — provider, speed and which one is the main line — and they are used in your reports. What we cannot do from here is check them, switch between them or route traffic across them.",
                )}
              </p>
            </div>
          )}

          {/* Link health header */}
          <SectionBoundary name="isp-header" fallback={sectionFallback(t("header", "the summary"))}>
            <section aria-label={t("summary", "Connection summary")} className="space-y-3">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <div className="col-span-2 flex min-w-0 flex-col justify-center rounded-[var(--wy-radius)] border border-[var(--wy-border)] bg-[var(--wy-surface)] px-4 py-3 shadow-[var(--wy-shadow)] lg:col-span-1">
                  <p className="text-xs font-medium text-[var(--wy-text-muted)]">
                    {t("internet", "Internet")}
                  </p>
                  {linksLoading ? (
                    <div className="mt-1 h-7 w-32 animate-pulse rounded bg-[var(--wy-surface-2)]" />
                  ) : linksError ? (
                    <p className="text-[15px] font-semibold text-[var(--wy-text-muted)]">—</p>
                  ) : sorted.length === 0 ? (
                    <p className="text-[15px] font-semibold text-[var(--wy-text-muted)]">
                      {t("head.noLines", "No line added")}
                    </p>
                  ) : (
                    <p
                      className={cn(
                        "flex items-center gap-2 text-xl font-semibold tracking-tight",
                        STATUS_TEXT[headStatus],
                      )}
                      data-wy="isp-headline"
                    >
                      <StatusDot status={headStatus} label={headline} pulse={headStatus === "ok"} />
                      <span className="truncate">{headline}</span>
                    </p>
                  )}
                  {headNote && !linksLoading && (
                    <p className="mt-0.5 truncate text-xs text-[var(--wy-text-muted)]">
                      {headNote}
                    </p>
                  )}
                </div>
                <StatTile
                  label={t("tile.router", "Router")}
                  leading={
                    <StatusDot
                      size="sm"
                      status={routerOnline ? "ok" : "crit"}
                      label={routerOnline ? word("healthy") : word("unhealthy")}
                    />
                  }
                  value={
                    routerOnline
                      ? t("tile.routerOnline", "Online")
                      : selectedRouter.status.replace(/_/g, " ")
                  }
                  unit={selectedRouter.name}
                />
                <StatTile
                  label={t("tile.healthy", "Healthy lines")}
                  loading={linksLoading}
                  value={linksError ? null : `${healthyCount}/${sorted.length}`}
                />
                <StatTile
                  className="col-span-2 lg:col-span-1"
                  label={
                    activeUptime != null
                      ? t("tile.inUseUptime", "In use · uptime {{range}}", { range })
                      : t("tile.inUse", "In use")
                  }
                  loading={linksLoading}
                  value={activeLink?.providerName ?? null}
                  unit={
                    activeUptime != null
                      ? `${activeUptime >= 99.95 ? "100" : activeUptime.toFixed(activeUptime >= 99 ? 2 : 1)}%`
                      : undefined
                  }
                />
              </div>
              <FailoverBanner state={failover} />
            </section>
          </SectionBoundary>

          {linksLoading ? (
            <div className="grid gap-3 lg:grid-cols-2" aria-busy="true">
              <div className="h-64 animate-pulse rounded-[var(--wy-radius)] bg-[var(--wy-surface-2)]" />
              <div className="h-64 animate-pulse rounded-[var(--wy-radius)] bg-[var(--wy-surface-2)]" />
            </div>
          ) : linksError ? (
            <Panel>
              <EmptyState
                icon={AlertTriangle}
                title={t("linksError.title", "Couldn't load ISP links")}
                description={t(
                  "linksError.body",
                  "Something went wrong fetching this router's ISP links -- your connection or our servers, not a real empty configuration.",
                )}
                action={
                  <Button size="sm" variant="outline" onClick={() => loadLinks(selectedRouterId)}>
                    <RotateCw className="h-3.5 w-3.5" />
                    {t("retry", "Retry")}
                  </Button>
                }
              />
            </Panel>
          ) : sorted.length === 0 ? (
            <Panel>
              <EmptyState
                icon={Globe}
                title={t("noLinks.title", "No internet line added yet")}
                description={t(
                  "noLinks.body",
                  "Add your ISP line -- provider, plan speed and the router port it plugs into -- to see its live health, speed and history here. Add a second line to get automatic failover.",
                )}
                action={
                  <Button size="sm" onClick={openCreate}>
                    <Plus className="h-4 w-4" />
                    {t("addLink", "Add ISP link")}
                  </Button>
                }
              />
            </Panel>
          ) : (
            <>
              {/* Path diagram */}
              <SectionBoundary
                name="isp-path"
                fallback={sectionFallback(t("path.title", "Connection path"))}
              >
                <Panel
                  title={
                    <PanelTitle icon={<Network />}>{t("path.title", "Connection path")}</PanelTitle>
                  }
                  bodyClassName="px-4 py-3"
                >
                  <IspPathDiagram router={selectedRouter} links={sorted} failover={failover} />
                </Panel>
              </SectionBoundary>

              {/* One card per line */}
              <SectionBoundary
                name="isp-cards"
                fallback={sectionFallback(t("cards", "the line cards"))}
              >
                <div className="grid items-stretch gap-3 lg:grid-cols-2">
                  {sorted.map((l, i) => (
                    <IspLinkCard
                      key={l.id}
                      link={l}
                      index={i}
                      multi={multi}
                      checks={recent.byLink[l.id]}
                      summary={summaries.byLink[l.id]}
                      range={range}
                      deviceControlsApply={deviceControlsApply}
                      checking={checkingId === l.id}
                      statusBusy={statusBusyId === l.id}
                      onCheck={() => checkHealth(l)}
                      onMark={(s) => setLinkManualStatus(l, s)}
                      onHistory={() => showHistoryFor(l.id)}
                      onEdit={() => openEdit(l)}
                      onRemove={() => removeLink(l)}
                    />
                  ))}
                  {!multi && (
                    <div className="flex flex-col items-start justify-center gap-2 rounded-[var(--wy-radius)] border border-dashed border-[var(--wy-border-strong)] px-5 py-6">
                      <GitBranch aria-hidden className="h-4 w-4 text-[var(--wy-text-faint)]" />
                      <p className="text-[13px] font-semibold">
                        {t("single.title", "One line, no failover")}
                      </p>
                      <p className="max-w-sm text-xs text-[var(--wy-text-muted)]">
                        {t(
                          "single.body",
                          "If this line goes down, guests lose internet until it comes back. Add a backup line (a second ISP or a 4G/5G dongle) and traffic moves to it automatically when this one fails its health checks.",
                        )}
                      </p>
                      <Button size="sm" variant="outline" onClick={openCreate} className="mt-1">
                        <Plus className="h-4 w-4" />
                        {t("single.add", "Add a backup line")}
                      </Button>
                    </div>
                  )}
                </div>
              </SectionBoundary>

              {/* History */}
              <div ref={historyRef} className="scroll-mt-20">
                <SectionBoundary
                  name="isp-history"
                  fallback={sectionFallback(t("history.title", "History"))}
                >
                  <IspHistoryPanel
                    links={sorted}
                    summaries={summaries.byLink}
                    range={range}
                    onRangeChange={setRange}
                    onRetry={summaries.retry}
                    hidden={hidden}
                    onToggle={toggleLine}
                    healthChecksApply={deviceControlsApply}
                  />
                </SectionBoundary>
              </div>

              {/* Failover settings + recent state changes */}
              <SectionBoundary
                name="isp-failover"
                fallback={sectionFallback(t("failover.title", "Failover"))}
              >
                <div className="grid items-start gap-3 lg:grid-cols-2">
                  <Panel
                    title={
                      <PanelTitle icon={<GitBranch />}>
                        {t("failover.title", "Failover")}
                      </PanelTitle>
                    }
                    description={
                      multi
                        ? t(
                            "failover.desc",
                            "Which line carries traffic, and what happens when it fails",
                          )
                        : t("failover.descSingle", "Needs a second line")
                    }
                  >
                    <ol className="space-y-2">
                      {[...sorted]
                        .sort((a, b) =>
                          a.role !== b.role
                            ? a.role === "primary"
                              ? -1
                              : 1
                            : a.priority - b.priority,
                        )
                        .map((l) => (
                          <li
                            key={l.id}
                            className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs"
                          >
                            <span
                              aria-hidden
                              className="h-2 w-2 shrink-0 rounded-sm"
                              style={{ background: ispColor(sorted.indexOf(l)) }}
                            />
                            <span className="min-w-[10rem] flex-1 font-medium">
                              {l.providerName}
                              <span className="font-normal text-[var(--wy-text-faint)]">
                                {" · "}
                                {l.role === "primary"
                                  ? t("role.primary", "Primary")
                                  : t("role.backup", "Backup")}
                                {" · "}
                                {t("card.priority", "Priority")} {l.priority}
                              </span>
                            </span>
                            <LinkStatus link={l} />
                            <span className="text-[var(--wy-text-muted)] sm:w-28 sm:text-right">
                              {t("card.failback", "Auto-failback")}{" "}
                              <span className="font-medium text-[var(--wy-text)]">
                                {l.autoFailback ? t("on", "On") : t("off", "Off")}
                              </span>
                            </span>
                          </li>
                        ))}
                    </ol>
                    <p className="mt-3 border-t border-[var(--wy-border)] pt-3 text-xs leading-relaxed text-[var(--wy-text-muted)]">
                      {multi
                        ? t(
                            "failover.note",
                            "If the line in use fails its health checks, traffic moves to the next healthy line automatically. With auto-failback on, it moves back once the primary is healthy again; with it off, it stays on the backup until switched back manually.",
                          )
                        : t(
                            "failover.noteSingle",
                            "Failover needs a second line. Until then, an outage on this line is an outage for your guests.",
                          )}
                    </p>
                  </Panel>
                  <Panel
                    title={
                      <PanelTitle icon={<ArrowLeftRight />}>
                        {t("events.title", "Recent changes")}
                      </PanelTitle>
                    }
                    description={t(
                      "events.desc",
                      "Status changes in each line's latest health checks",
                    )}
                    flush
                  >
                    {events.length === 0 ? (
                      <EmptyState
                        compact
                        title={t("events.none", "No status changes")}
                        description={t(
                          "events.noneBody",
                          "Each line held the same status across its latest checks. Longer history is in the charts above.",
                        )}
                      />
                    ) : (
                      <ol className="divide-y divide-[var(--wy-border)]" data-wy="isp-events">
                        {events.map((e) => (
                          <li
                            key={`${e.link.id}-${e.at}`}
                            className="flex items-center gap-3 px-4 py-2 text-xs"
                          >
                            <span className="w-16 shrink-0 tabular-nums text-[var(--wy-text-faint)]">
                              {fmtClock(e.at, lang)}
                            </span>
                            <span className="min-w-0 flex-1 truncate">
                              <span className="font-medium">{e.link.providerName}</span>{" "}
                              <span className="text-[var(--wy-text-muted)]">{word(e.from)} → </span>
                              <span className={cn("font-medium", STATUS_TEXT[linkStatus(e.to)])}>
                                {word(e.to)}
                              </span>
                              {e.source === "manual" && (
                                <span className="text-[var(--wy-text-faint)]">
                                  {" "}
                                  · {t("manual", "Manual")}
                                </span>
                              )}
                            </span>
                          </li>
                        ))}
                      </ol>
                    )}
                  </Panel>
                </div>
              </SectionBoundary>
            </>
          )}

          {/* Routing rules -- §11.5: not mounted for a controller. */}
          {deviceControlsApply && (
            <SectionBoundary
              name="isp-rules"
              fallback={sectionFallback(t("rules.title", "Routing rules"))}
            >
              <Panel
                title={
                  <PanelTitle icon={<ArrowLeftRight />}>
                    {t("rules.title", "Routing rules")}
                  </PanelTitle>
                }
                description={t(
                  "rules.desc",
                  "Pin matching traffic (by VLAN, device, IP, source network, interface, or policy) to a specific line.",
                )}
                actions={
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7"
                    onClick={openCreateRule}
                    disabled={links.length === 0}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {t("rules.new", "New rule")}
                  </Button>
                }
                flush
              >
                {rulesLoading ? (
                  <div className="space-y-2 p-4">
                    {[0, 1].map((i) => (
                      <div key={i} className="h-8 animate-pulse rounded bg-[var(--wy-surface-2)]" />
                    ))}
                  </div>
                ) : rules.length === 0 ? (
                  <EmptyState
                    compact
                    icon={ArrowLeftRight}
                    title={t("rules.empty", "No routing rules yet")}
                    description={
                      links.length === 0
                        ? t(
                            "rules.emptyNoLinks",
                            "Add an ISP line first, then pin specific traffic to it here.",
                          )
                        : t(
                            "rules.emptyBody",
                            'Use "New rule" to pin matching traffic to a specific line.',
                          )
                    }
                  />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[560px] text-left text-xs">
                      <thead className="bg-[var(--wy-surface-2)] text-[11px] uppercase tracking-wider text-[var(--wy-text-faint)]">
                        <tr>
                          <th className="px-4 py-2 font-medium">{t("rules.name", "Name")}</th>
                          <th className="px-3 py-2 font-medium">{t("rules.type", "Type")}</th>
                          <th className="px-3 py-2 font-medium">{t("rules.match", "Match")}</th>
                          <th className="px-3 py-2 font-medium">{t("rules.line", "Line")}</th>
                          <th className="px-3 py-2 font-medium">
                            {t("card.priority", "Priority")}
                          </th>
                          <th className="px-3 py-2 font-medium">{t("rules.status", "Status")}</th>
                          <th className="px-4 py-2 text-right font-medium">
                            <span className="sr-only">{t("rules.actions", "Actions")}</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--wy-border)]">
                        {rules.map((r) => {
                          const li = sorted.findIndex((l) => l.id === r.ispLinkId);
                          return (
                            <tr key={r.id}>
                              <td className="px-4 py-2 font-medium">{r.name}</td>
                              <td className="px-3 py-2 uppercase text-[var(--wy-text-muted)]">
                                {r.ruleType}
                              </td>
                              <td className="px-3 py-2 font-mono">{matchValueFromRule(r)}</td>
                              <td className="px-3 py-2 text-[var(--wy-text-muted)]">
                                <span className="inline-flex items-center gap-1.5">
                                  {li >= 0 && (
                                    <span
                                      aria-hidden
                                      className="h-2 w-2 rounded-sm"
                                      style={{ background: ispColor(li) }}
                                    />
                                  )}
                                  {sorted[li]?.providerName ?? r.ispLinkId.slice(0, 8)}
                                </span>
                              </td>
                              <td className="px-3 py-2 tabular-nums text-[var(--wy-text-muted)]">
                                {r.priority}
                              </td>
                              <td className="px-3 py-2">
                                <span
                                  className={cn(
                                    "rounded px-1.5 py-0.5 text-[11px] font-medium",
                                    r.isEnabled
                                      ? "bg-[var(--wy-ok-soft)] text-[var(--wy-ok)]"
                                      : "bg-[var(--wy-surface-2)] text-[var(--wy-text-faint)]",
                                  )}
                                >
                                  {r.isEnabled
                                    ? t("rules.enabled", "Enabled")
                                    : t("rules.disabled", "Disabled")}
                                </span>
                              </td>
                              <td className="px-4 py-1.5 text-right">
                                <div className="inline-flex gap-1">
                                  <button
                                    type="button"
                                    aria-label={t("action.editRule", "Edit rule {{name}}", {
                                      name: r.name,
                                    })}
                                    title={t("action.edit", "Edit")}
                                    onClick={() => openEditRule(r)}
                                    className="rounded-[6px] p-1.5 text-[var(--wy-text-muted)] hover:bg-[var(--wy-surface-2)] hover:text-[var(--wy-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wy-accent)]"
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    aria-label={t("action.removeRule", "Remove rule {{name}}", {
                                      name: r.name,
                                    })}
                                    title={t("action.remove", "Remove")}
                                    onClick={() => removeRule(r)}
                                    className="rounded-[6px] p-1.5 text-[var(--wy-text-muted)] hover:bg-[var(--wy-surface-2)] hover:text-[var(--wy-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wy-accent)]"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </Panel>
            </SectionBoundary>
          )}
        </>
      )}

      <IspLinkDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editingLink}
        saving={saving}
        onSave={saveLink}
      />
      <IspRuleDialog
        open={ruleDialogOpen}
        onOpenChange={setRuleDialogOpen}
        editing={editingRule}
        links={links}
        saving={savingRule}
        onSave={saveRule}
      />
    </div>
  );
}
