import { useEffect, useState } from "react";
import {
  Plus,
  Trash2,
  Copy,
  Search,
  ClipboardList,
  MessageSquareText,
  TicketPercent,
  X,
  ListChecks,
  BarChart3,
  Eye,
  Wifi,
  ExternalLink,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { EmptyState } from "@/components/common/EmptyState";
import { LoadingSkeleton } from "@/components/common/LoadingSkeleton";
import { useIsDemo } from "@/hooks/useCustomerDashboard";
import { campaignService, CAMPAIGN_STATUS_TRANSITIONS } from "@/services/campaign.service";
import type {
  CampaignAsset,
  CampaignQuestion,
  CampaignResults,
  CampaignType,
  QuestionAnswerType,
} from "@/types/campaign";

/** One horizontal answer bar: label, count, and the share of answers it
 * took. Used for both star buckets and choice options, so a survey's two
 * question shapes read as one thing rather than two.
 *
 * `total` is the question's own answer count, not the campaign's, so a
 * multi-choice question where guests picked several options can legitimately
 * sum past 100% -- clamped rather than allowed to overflow the track. */
function AnswerBar({ label, count, total }: { label: string; count: number; total: number }) {
  const pct = total > 0 ? Math.min(100, Math.round((count / total) * 100)) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-24 shrink-0 truncate text-xs text-muted-foreground" title={label}>
        {label}
      </span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-10 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
        {count.toLocaleString()}
      </span>
    </div>
  );
}

interface Campaign {
  id: string;
  name: string;
  type: string;
  status: string;
  businessUnit: string;
  startDate: string;
  endDate: string;
  /** `null` means "not asked yet, or the results call failed" -- rendered
   * as "--". Never conflate that with a real zero: this table used to hard
   * code 0 for every campaign on a real account, which reads as "nobody
   * ever saw it" rather than "we did not look". A freshly created campaign
   * legitimately is 0. */
  impressions: number | null;
  conversions: number | null;
}
const TYPES = ["SURVEY", "BANNER", "REDIRECT"];
const STATUSES = ["draft", "scheduled", "active", "paused", "ended"];
const UNITS = ["Mumbai HQ", "Delhi Office", "Bangalore DC", "Chennai Office"]; // Matches this demo account's real location roster (see customer.service.ts DEMO_LOCATIONS) instead of unrelated placeholder hospitality names that clashed with the rest of the demo persona.

const SURVEY_QUESTIONS = [
  { q: "Rate our food quality?", options: ["Excellent", "Good", "Average", "Could be better"] },
  {
    q: "Rate courteousness of our staff?",
    options: ["Very Good", "Average", "Could be better", "Poor"],
  },
  {
    q: "How do you rate our cleanliness?",
    options: ["Excellent", "Good", "Average", "Could be better"],
  },
];

const DEMO_SEED: Campaign[] = [
  {
    id: "1",
    name: "Summer Promo",
    type: "BANNER",
    status: "active",
    businessUnit: "Mumbai HQ",
    startDate: "2026-06-01",
    endDate: "2026-08-31",
    impressions: 2841,
    conversions: 423,
  },
  {
    id: "2",
    name: "Guest Feedback",
    type: "SURVEY",
    status: "draft",
    businessUnit: "Delhi Office",
    startDate: "2026-07-01",
    endDate: "2026-09-30",
    impressions: 0,
    conversions: 0,
  },
  {
    id: "3",
    name: "Weekend Special",
    type: "REDIRECT",
    status: "paused",
    businessUnit: "Bangalore DC",
    startDate: "2026-05-15",
    endDate: "2026-07-15",
    impressions: 1520,
    conversions: 198,
  },
];

/**
 * Hero illustrations removed along with the hero itself. This page used to
 * open with a dark indigo/violet gradient band carrying a title ("Campaign"),
 * a strapline, a hand-drawn phone-and-badges illustration, and the two real
 * controls (Search, Create) *inside* it. Founder QA: "This Extra fancy banner
 * is not required", alongside "we already have location selected and showing
 * at top, no need to repeat same information 2 more time" -- the band was a
 * third title for a screen whose venue and feature name the shell already
 * prints above it.
 *
 * Nothing was lost with it: the two controls it contained now sit in a plain
 * toolbar over the list they act on, which is also where they belong (the
 * search filters the list, and Create adds to it).
 */

const emptyForm = { name: "", type: "SURVEY", businessUnit: "", startDate: "", endDate: "" };
//: How many coupons the Coupons card shows. See the effect that fills it.
const COUPON_CARD_LIMIT = 6;
const emptyFilters = { search: "", businessUnit: "", type: "", startDate: "" };
const emptyAssetForm = {
  imageUrl: "",
  clickUrl: "",
  headline: "",
  subtext: "",
  couponCode: "",
  couponExpiresAt: "",
};

// The only statuses a given current status may legally move to next --
// mirrors the backend's own CAMPAIGN_STATUS_TRANSITIONS. Anything outside
// this set 409s server-side (InvalidCampaignStatusTransitionError), so the
// status control below only ever offers these.
function selectableStatuses(current: string): string[] {
  return [current, ...(CAMPAIGN_STATUS_TRANSITIONS[current] ?? [])];
}

// A `nextPlayAction` helper and the bare Play/Pause row icon it fed used to
// live here. Both are gone: the icon wrote the same field the status control
// on the same row already writes, so a row carried two controls for one
// setting -- and the one that could not 409 (the control, which is restricted
// to the legal transitions above) was the one an operator had to discover.
// The control is now the single way to move a campaign, which is also what
// "option to choose from saved campaign which we want to be active" asks for.

const ANSWER_TYPES: { value: QuestionAnswerType; label: string }[] = [
  { value: "single_choice", label: "Single choice" },
  { value: "multi_choice", label: "Multiple choice" },
  { value: "rating_5", label: "Rating (1-5)" },
  { value: "free_text", label: "Free text" },
];
const emptyQuestionForm = {
  questionText: "",
  answerType: "single_choice" as QuestionAnswerType,
  options: "",
  isRequired: true,
};

// Demo-only seed so a survey campaign created while in demo mode still has
// something to manage -- mirrors the shape a real backend question takes.
const demoQuestionSeed = (campaignId: string): CampaignQuestion[] =>
  SURVEY_QUESTIONS.map((s, i) => ({
    id: `${campaignId}-demo-${i}`,
    campaignId,
    orderIndex: i,
    questionText: s.q,
    answerType: "single_choice" as QuestionAnswerType,
    options: s.options,
    isRequired: true,
  }));

// Demo-only seed so previewing a BANNER/REDIRECT campaign while in demo
// mode still has something real-shaped to show -- mirrors the "Flat 20%
// off" illustration already used elsewhere on this page.
const demoAssetSeed = (campaignId: string): CampaignAsset[] => [
  {
    id: `${campaignId}-demo-asset`,
    campaignId,
    imageUrl: null,
    clickUrl: null,
    altText: "Flat 20% off this weekend",
    locale: null,
    headline: "Flat 20% off this weekend",
    subtext: "Show this coupon at checkout to redeem your discount.",
    couponCode: "SAVE20",
    couponExpiresAt: "2026-12-31T23:59:59Z",
  },
];

export function CampaignsPage({ locationId }: { locationId?: string }) {
  const demo = useIsDemo();
  const [items, setItems] = useState<Campaign[]>(demo ? DEMO_SEED : []);
  const [loading, setLoading] = useState(!demo);
  // Set when the campaign list itself could not be loaded. Previously this
  // path substituted DEMO_SEED, i.e. six invented campaigns with invented
  // engagement numbers, on a real account.
  const [loadError, setLoadError] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [filters, setFilters] = useState(emptyFilters);
  // The coupon behind each BANNER/REDIRECT campaign, for the Coupons card.
  // Absent (or explicitly null) whenever the assets call failed, so the card
  // says "No coupon" for that row rather than inventing one.
  const [couponsByCampaign, setCouponsByCampaign] = useState<Record<string, CampaignAsset | null>>(
    {},
  );

  // Manage Questions -- the only real way to configure what a SURVEY
  // campaign actually asks guests. Previously there was no click path to
  // this at all: the Recent Campaigns table had no per-row action for it,
  // so clicking a survey campaign did nothing.
  const [manageFor, setManageFor] = useState<Campaign | null>(null);

  // Survey results. The star rating has shipped for a while and guests
  // really do submit answers (campaign-portal.service.ts's submitResponse),
  // but until now nothing in the dashboard read them back -- an owner could
  // ask "How was your visit?" and never see a single reply. The aggregate
  // has always been there: GET /campaigns/{id}/results returns per-question
  // option counts, an average rating and a star distribution.
  const [resultsFor, setResultsFor] = useState<Campaign | null>(null);
  const [resultsData, setResultsData] = useState<CampaignResults | null>(null);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [resultsError, setResultsError] = useState(false);

  const openResults = async (c: Campaign) => {
    setResultsFor(c);
    setResultsData(null);
    setResultsError(false);
    if (demo) return;
    setResultsLoading(true);
    try {
      setResultsData(await campaignService.getResults(c.id));
    } catch {
      setResultsError(true);
    } finally {
      setResultsLoading(false);
    }
  };
  const [questions, setQuestions] = useState<CampaignQuestion[]>([]);
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [qForm, setQForm] = useState(emptyQuestionForm);
  const [qErr, setQErr] = useState("");

  // Guest Preview -- an honest look at what an actual guest would see for
  // this campaign: a SURVEY's real questions (same data Manage Questions
  // edits) rendered as a guest-facing form mockup, or a BANNER/REDIRECT's
  // real uploaded image/click-through link. Mirrors the device-mockup look
  // of /preview/portal/:locationId (today's Portal Preview) so this reads
  // as the same feature family rather than a new visual language.
  const [previewFor, setPreviewFor] = useState<Campaign | null>(null);
  const [previewQuestions, setPreviewQuestions] = useState<CampaignQuestion[]>([]);
  const [previewAssets, setPreviewAssets] = useState<CampaignAsset[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [assetForm, setAssetForm] = useState(emptyAssetForm);

  useEffect(() => {
    if (demo) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await campaignService.list({ locationId, page: 1, pageSize: 50 });
        if (cancelled) return;
        // Paint the rows first, then fill the counters in. The list is the
        // useful part of this screen and it should not wait on N results
        // calls; a campaign whose counters are still in flight shows "--",
        // which is also what it shows if they never arrive.
        setItems(
          res.rows.map((c) => ({
            id: c.id,
            name: c.name,
            type: c.campaignType.toUpperCase(),
            status: c.status,
            businessUnit: "",
            startDate: c.startsAt?.slice(0, 10) ?? "",
            endDate: c.endsAt?.slice(0, 10) ?? "",
            impressions: null,
            conversions: null,
          })),
        );
        setLoading(false);

        const results = await campaignService.listResults(res.rows.map((c) => c.id));
        if (cancelled) return;
        setItems((rows) =>
          rows.map((r) => {
            const hit = results[r.id];
            return hit
              ? { ...r, impressions: hit.totalImpressions, conversions: hit.totalResponses }
              : r;
          }),
        );
      } catch {
        // Previously: `setItems(DEMO_SEED)`. On a real account, any failure
        // of this fetch filled the table with six invented campaigns
        // carrying invented engagement numbers (2841 impressions, 423
        // conversions) -- indistinguishable from real data, on the screen
        // where a venue decides whether its offers are working. An empty
        // table and an error is the honest answer to "we could not load
        // your campaigns".
        if (!cancelled) {
          setItems([]);
          setLoadError(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [demo, locationId]);

  // The coupon each BANNER/REDIRECT campaign carries, for the Coupons card.
  //
  // Deliberately capped: this card is a summary of what the venue is running,
  // not a second copy of the list below, and an organization with dozens of
  // banners should not pay dozens of requests to paint it. Named in the UI as
  // a count when it bites, so the cap is never mistaken for the whole set.
  //
  // `allSettled`, not `all`: one campaign whose assets call fails must not
  // blank the card for every other one -- it simply renders with no coupon,
  // which is a state the card already has an honest label for.
  useEffect(() => {
    if (loading || loadError) return;
    const banners = items.filter((c) => c.type !== "SURVEY").slice(0, COUPON_CARD_LIMIT);
    if (banners.length === 0) {
      setCouponsByCampaign({});
      return;
    }
    if (demo) {
      setCouponsByCampaign(
        Object.fromEntries(banners.map((c) => [c.id, demoAssetSeed(c.id)[0] ?? null])),
      );
      return;
    }
    let cancelled = false;
    (async () => {
      const settled = await Promise.allSettled(
        banners.map((c) => campaignService.listAssets(c.id)),
      );
      if (cancelled) return;
      setCouponsByCampaign(
        Object.fromEntries(
          banners.map((c, i) => {
            const r = settled[i];
            return [c.id, r.status === "fulfilled" ? (r.value[0] ?? null) : null];
          }),
        ),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [demo, items, loading, loadError]);

  const openCreate = (type: string) => {
    setForm({ ...emptyForm, type });
    setErrs({});
    setShowCreate(true);
  };

  const handleCreate = async () => {
    // Only the name is required now. "For creating campaigns it should be
    // simple enough" -- a name, a type, done. The dates were both required
    // before, which meant an operator who wanted a survey running *now* had to
    // invent a start date and pick an end date they had no view on. An empty
    // start means "from now" (the campaign is created a draft either way, so
    // nothing is live until it is activated) and an empty end means "no end",
    // which is what the API already stores for these two fields.
    const e: Record<string, string> = {};
    if (!form.name) e.name = "Campaign name is required.";
    if (form.startDate && form.endDate && form.endDate < form.startDate)
      e.endDate = "End date must be after start date.";
    if (demo && !form.businessUnit) e.businessUnit = "Select a business unit.";
    setErrs(e);
    if (Object.keys(e).length) return;

    if (demo) {
      setItems([
        {
          id: String(Date.now()),
          name: form.name,
          type: form.type,
          status: "draft",
          businessUnit: form.businessUnit,
          startDate: form.startDate,
          endDate: form.endDate,
          impressions: 0,
          conversions: 0,
        },
        ...items,
      ]);
      setForm(emptyForm);
      setShowCreate(false);
      toast.success("Campaign created");
      return;
    }

    try {
      const created = await campaignService.create({
        locationId,
        name: form.name,
        campaignType: form.type.toLowerCase() as CampaignType,
        // Empty start -> now, not null. A null `starts_at` is a campaign whose
        // start is undefined, which is not what "leave it empty to start now"
        // promises on the form.
        startsAt: (form.startDate ? new Date(form.startDate) : new Date()).toISOString(),
        endsAt: form.endDate ? new Date(form.endDate).toISOString() : null,
      });
      setItems([
        {
          id: created.id,
          name: created.name,
          type: created.campaignType.toUpperCase(),
          status: created.status,
          businessUnit: "",
          startDate: created.startsAt?.slice(0, 10) ?? "",
          endDate: created.endsAt?.slice(0, 10) ?? "",
          impressions: 0,
          conversions: 0,
        },
        ...items,
      ]);
      setForm(emptyForm);
      setShowCreate(false);
      toast.success("Campaign created");
    } catch {
      toast.error("Could not create the campaign — check the connection and try again.");
    }
  };

  const updateStatus = async (id: string, status: string) => {
    const prev = items;
    setItems(items.map((i) => (i.id === id ? { ...i, status } : i)));
    if (demo) {
      toast.success(`Campaign ${status}`);
      return;
    }
    try {
      if (status === "paused") await campaignService.pause(id);
      else if (status === "active") await campaignService.resume(id);
      else if (status === "scheduled") await campaignService.schedule(id);
      else if (status === "ended") await campaignService.end(id);
      toast.success(`Campaign ${status}`);
    } catch {
      setItems(prev);
      toast.error("Could not update the campaign on the server.");
    }
  };

  const removeCampaign = async (id: string) => {
    const prev = items;
    setItems(items.filter((i) => i.id !== id));
    toast.success("Campaign deleted");
    if (!demo) {
      try {
        await campaignService.remove(id);
      } catch {
        setItems(prev);
        toast.error("Could not delete on the server.");
      }
    }
  };

  const openManage = async (c: Campaign) => {
    setManageFor(c);
    setQForm(emptyQuestionForm);
    setQErr("");
    if (demo) {
      setQuestions(demoQuestionSeed(c.id));
      return;
    }
    setQuestionsLoading(true);
    try {
      setQuestions(await campaignService.listQuestions(c.id));
    } catch {
      toast.error("Could not load the survey's questions.");
      setQuestions([]);
    } finally {
      setQuestionsLoading(false);
    }
  };

  const closeManage = () => {
    setManageFor(null);
    setQuestions([]);
    setQForm(emptyQuestionForm);
    setQErr("");
  };

  // navigator.clipboard is only defined in a secure context (HTTPS or
  // localhost) -- this deployment is served over plain HTTP, so
  // navigator.clipboard is undefined there and calling .writeText on it
  // threw a TypeError instead of copying, which looked like the Copy
  // Campaign ID icon "did nothing" (found while sweeping every control on
  // this page for the reported click issue). Falls back to the older
  // execCommand("copy") path, which does work over HTTP.
  const copyCampaignId = async (id: string) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(id);
      } else {
        const ta = document.createElement("textarea");
        ta.value = id;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      toast.success("Campaign ID copied");
    } catch {
      toast.error("Could not copy the campaign ID.");
    }
  };

  const openPreview = async (c: Campaign) => {
    setPreviewFor(c);
    setPreviewQuestions([]);
    setPreviewAssets([]);
    setAssetForm(emptyAssetForm);
    if (demo) {
      if (c.type === "SURVEY") setPreviewQuestions(demoQuestionSeed(c.id));
      else setPreviewAssets(demoAssetSeed(c.id));
      return;
    }
    setPreviewLoading(true);
    try {
      if (c.type === "SURVEY") setPreviewQuestions(await campaignService.listQuestions(c.id));
      else setPreviewAssets(await campaignService.listAssets(c.id));
    } catch {
      toast.error("Could not load the preview — check the connection and try again.");
    } finally {
      setPreviewLoading(false);
    }
  };

  const closePreview = () => {
    setPreviewFor(null);
    setPreviewQuestions([]);
    setPreviewAssets([]);
    setAssetForm(emptyAssetForm);
  };

  const addPreviewAsset = async () => {
    if (!previewFor) return;
    // A banner is renderable as an image, a bare click-through, or a
    // text/coupon promo (headline and/or coupon code) -- the same "at least
    // one renderable source" rule the backend enforces.
    if (
      !assetForm.imageUrl.trim() &&
      !assetForm.clickUrl.trim() &&
      !assetForm.headline.trim() &&
      !assetForm.couponCode.trim()
    ) {
      toast.error("Add an image, a link, a headline, or a coupon code.");
      return;
    }
    const couponExpiresAtIso = assetForm.couponExpiresAt
      ? new Date(assetForm.couponExpiresAt).toISOString()
      : null;
    if (demo) {
      setPreviewAssets([
        {
          id: `${previewFor.id}-demo-asset`,
          campaignId: previewFor.id,
          imageUrl: assetForm.imageUrl || null,
          clickUrl: assetForm.clickUrl || null,
          altText: null,
          locale: null,
          headline: assetForm.headline || null,
          subtext: assetForm.subtext || null,
          couponCode: assetForm.couponCode || null,
          couponExpiresAt: couponExpiresAtIso,
        },
      ]);
      setAssetForm(emptyAssetForm);
      toast.success("Banner saved");
      return;
    }
    try {
      const created = await campaignService.addAsset(previewFor.id, {
        imageUrl: assetForm.imageUrl || null,
        clickUrl: assetForm.clickUrl || null,
        headline: assetForm.headline || null,
        subtext: assetForm.subtext || null,
        couponCode: assetForm.couponCode || null,
        couponExpiresAt: couponExpiresAtIso,
      });
      setPreviewAssets([...previewAssets, created]);
      setAssetForm(emptyAssetForm);
      toast.success("Banner saved");
    } catch {
      toast.error("Could not save the banner — check the connection and try again.");
    }
  };

  const addQuestion = async () => {
    if (!manageFor) return;
    if (!qForm.questionText.trim()) {
      setQErr("Question text is required.");
      return;
    }
    const needsOptions =
      qForm.answerType === "single_choice" || qForm.answerType === "multi_choice";
    const options = qForm.options
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean);
    if (needsOptions && options.length < 2) {
      setQErr("Add at least two comma-separated options.");
      return;
    }
    setQErr("");

    if (demo) {
      setQuestions([
        ...questions,
        {
          id: `${manageFor.id}-demo-${Date.now()}`,
          campaignId: manageFor.id,
          orderIndex: questions.length,
          questionText: qForm.questionText,
          answerType: qForm.answerType,
          options: needsOptions ? options : [],
          isRequired: qForm.isRequired,
        },
      ]);
      setQForm(emptyQuestionForm);
      toast.success("Question added");
      return;
    }

    try {
      const created = await campaignService.addQuestion(manageFor.id, {
        orderIndex: questions.length,
        questionText: qForm.questionText,
        answerType: qForm.answerType,
        options: needsOptions ? options : [],
        isRequired: qForm.isRequired,
      });
      setQuestions([...questions, created]);
      setQForm(emptyQuestionForm);
      toast.success("Question added");
    } catch {
      toast.error("Could not add the question — check the connection and try again.");
    }
  };

  const removeQuestion = async (id: string) => {
    const prev = questions;
    setQuestions(questions.filter((q) => q.id !== id));
    if (demo) {
      toast.success("Question removed");
      return;
    }
    try {
      await campaignService.deleteQuestion(id);
      toast.success("Question removed");
    } catch {
      setQuestions(prev);
      toast.error("Could not remove the question on the server.");
    }
  };

  const filtered = items.filter(
    (c) =>
      (!filters.search || c.name.toLowerCase().includes(filters.search.trim().toLowerCase())) &&
      (!filters.businessUnit || c.businessUnit === filters.businessUnit) &&
      (!filters.type || c.type === filters.type) &&
      (!filters.startDate || c.startDate >= filters.startDate),
  );
  const filtersActive = filters.search || filters.businessUnit || filters.type || filters.startDate;

  // The two cards read the same `items` the list below does -- one source, so
  // a survey cannot appear on the card and not in the list, or disagree about
  // its status between the two.
  const surveys = items.filter((c) => c.type === "SURVEY");
  const banners = items
    .filter((c) => c.type !== "SURVEY")
    .slice(0, COUPON_CARD_LIMIT)
    .map((campaign) => ({ campaign, asset: couponsByCampaign[campaign.id] ?? null }));
  const bannersTruncated = Math.max(
    0,
    items.filter((c) => c.type !== "SURVEY").length - COUPON_CARD_LIMIT,
  );

  return (
    <div className="space-y-6">
      {/* The two controls the hero used to hold, in the plain form they
       * should always have had: a search over the list, and Create. Same
       * filter state, same handlers -- no band, no illustration, no third
       * copy of this page's own title. */}
      <div className="flex flex-wrap items-end gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search campaigns…"
            value={filters.search}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
            className="h-9 pl-8"
            aria-label="Search campaigns by name"
          />
        </div>
        <Select
          value={filters.type || "__all"}
          onValueChange={(v) => setFilters((f) => ({ ...f, type: v === "__all" ? "" : v }))}
        >
          <SelectTrigger className="h-9 w-[160px]" aria-label="Filter by campaign type">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">All types</SelectItem>
            {TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {/* Business Unit is demo-only seed data -- a real campaign carries no
            businessUnit, because this page is already scoped to one location
            and the shell prints which. Same demo gating as the create form. */}
        {demo && (
          <Select
            value={filters.businessUnit || "__all"}
            onValueChange={(v) =>
              setFilters((f) => ({ ...f, businessUnit: v === "__all" ? "" : v }))
            }
          >
            <SelectTrigger className="h-9 w-[160px]" aria-label="Filter by business unit">
              <SelectValue placeholder="All business units" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">All business units</SelectItem>
              {UNITS.map((u) => (
                <SelectItem key={u} value={u}>
                  {u}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Input
          type="date"
          value={filters.startDate}
          onChange={(e) => setFilters((f) => ({ ...f, startDate: e.target.value }))}
          className="h-9 w-[150px]"
          aria-label="Campaigns starting on or after"
        />
        {filtersActive && (
          <Button
            variant="ghost"
            size="sm"
            className="h-9"
            onClick={() => setFilters(emptyFilters)}
          >
            Clear
          </Button>
        )}
        <Button className="ml-auto h-9" onClick={() => openCreate("SURVEY")}>
          <Plus className="mr-2 h-4 w-4" />
          Create Campaign
        </Button>
      </div>

      {/* The two things this product does, side by side, with the marketing
       * copy taken out and the invented sample data replaced by the venue's
       * own.
       *
       * What was here: a "Types of Campaign" heading over a strapline
       * ("Leverage WiFi as a communication platform..."), and in each card a
       * hard-coded mock-up -- three invented survey questions ("Rate our food
       * quality?") and a fake "Flat 20% off / SAVE20" coupon -- plus two more
       * straplines ("Feedback Made Easy", "More Business With Discounts").
       * Founder QA, twice over: "No Need for unnecessary descriptions like
       * 'Feedback Made Easy Collect real-time feedback...'", and "Discount
       * coupons are interesting part of our product, so it should be more
       * clearly designed".
       *
       * The invented content is the worse half of that. A venue that had never
       * run a survey was shown three questions it had not written, and one
       * that had never issued a coupon was shown a code that does not exist,
       * on the two cards whose whole job is to tell it what it has. Both cards
       * now read the real campaigns for this location.
       *
       * "Customizable survey and feedback" is the other half of that report:
       * a survey's questions were only reachable through a small icon in a
       * table row, which is not where an owner looks to customise a survey.
       * The card now lists the venue's own surveys with the question editor
       * one click away, on the card named after surveys. */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Survey & Feedback */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="flex-row items-center gap-2.5 space-y-0 pb-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#4f46e5] to-[#a78bfa] text-white shadow-sm shadow-indigo-500/20">
              <MessageSquareText className="h-4.5 w-4.5" />
            </span>
            <CardTitle className="text-sm">Survey &amp; Feedback</CardTitle>
            <Button
              size="sm"
              variant="outline"
              className="ml-auto"
              onClick={() => openCreate("SURVEY")}
            >
              <Plus className="mr-2 h-4 w-4" />
              New survey
            </Button>
          </CardHeader>
          <CardContent>
            {surveys.length === 0 ? (
              <p className="py-2 text-sm text-muted-foreground">
                No surveys yet. Ask guests a few questions when they connect.
              </p>
            ) : (
              <ul className="divide-y">
                {surveys.map((c) => (
                  <li key={c.id} className="flex items-center gap-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{c.name}</p>
                      <p className="text-xs capitalize text-muted-foreground">{c.status}</p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => openManage(c)}>
                      <ListChecks className="mr-2 h-4 w-4" />
                      Questions
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Discounts & Banners -- the coupon half, designed as coupons. */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="flex-row items-center gap-2.5 space-y-0 pb-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#4f46e5] to-[#a78bfa] text-white shadow-sm shadow-indigo-500/20">
              <TicketPercent className="h-4.5 w-4.5" />
            </span>
            <CardTitle className="text-sm">Coupons &amp; Banners</CardTitle>
            <Button
              size="sm"
              variant="outline"
              className="ml-auto"
              onClick={() => openCreate("BANNER")}
            >
              <Plus className="mr-2 h-4 w-4" />
              New offer
            </Button>
          </CardHeader>
          <CardContent>
            {banners.length === 0 ? (
              <p className="py-2 text-sm text-muted-foreground">
                No offers yet. Show a banner and a coupon code when guests connect.
              </p>
            ) : (
              <ul className="divide-y">
                {banners.map(({ campaign, asset }) => (
                  <li key={campaign.id} className="flex items-center gap-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{campaign.name}</p>
                      <p className="text-xs capitalize text-muted-foreground">
                        {campaign.status}
                        {asset?.couponExpiresAt
                          ? ` · valid until ${new Date(asset.couponExpiresAt).toLocaleDateString(
                              undefined,
                              { year: "numeric", month: "short", day: "numeric" },
                            )}`
                          : ""}
                      </p>
                    </div>
                    {asset?.couponCode ? (
                      <span className="shrink-0 rounded-lg border-2 border-dashed border-amber-300 bg-amber-50 px-3 py-1 font-mono text-sm font-bold tracking-[0.15em] text-amber-800">
                        {asset.couponCode}
                      </span>
                    ) : (
                      <span className="shrink-0 text-xs text-muted-foreground">No coupon</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {bannersTruncated > 0 && (
              <p className="pt-2 text-xs text-muted-foreground">
                +{bannersTruncated} more in the list below.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {showCreate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
          onClick={() => setShowCreate(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold tracking-tight">Create Campaign</h3>
            <div className="mt-3 space-y-3">
              <div>
                <Label>
                  Campaign Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Campaign Name"
                />
                {errs.name && <p className="mt-1 text-xs text-destructive">{errs.name}</p>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Start date</Label>
                  <Input
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">Leave empty to start now.</p>
                  {errs.startDate && (
                    <p className="mt-1 text-xs text-destructive">{errs.startDate}</p>
                  )}
                </div>
                <div>
                  <Label>End date</Label>
                  <Input
                    type="date"
                    value={form.endDate}
                    onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">Leave empty for no end.</p>
                  {errs.endDate && <p className="mt-1 text-xs text-destructive">{errs.endDate}</p>}
                </div>
              </div>
              {demo && (
                <div>
                  <Label>
                    Business Unit <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={form.businessUnit}
                    onValueChange={(v) => setForm({ ...form, businessUnit: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose business unit" />
                    </SelectTrigger>
                    <SelectContent>
                      {UNITS.map((u) => (
                        <SelectItem key={u} value={u}>
                          {u}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errs.businessUnit && (
                    <p className="mt-1 text-xs text-destructive">{errs.businessUnit}</p>
                  )}
                </div>
              )}
              <div>
                <Label>
                  Campaign Type <span className="text-destructive">*</span>
                </Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <Button variant="outline" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreate}>Create</Button>
            </div>
          </div>
        </div>
      )}

      {resultsFor && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
          onClick={() => setResultsFor(null)}
        >
          <div
            className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border bg-card p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-1 flex items-center justify-between">
              <h3 className="text-base font-semibold tracking-tight">
                Answers — {resultsFor.name}
              </h3>
              <button
                onClick={() => setResultsFor(null)}
                className="rounded-lg p-1 text-muted-foreground hover:bg-accent"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mb-4 text-xs text-muted-foreground">
              What guests actually replied. Aggregated, never per guest.
            </p>

            {demo ? (
              <EmptyState
                icon={BarChart3}
                title="Not available on the demo account"
                description="Survey answers belong to real guests at a real venue, so there is nothing to aggregate here."
              />
            ) : resultsLoading ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
            ) : resultsError ? (
              <EmptyState
                icon={BarChart3}
                title="Couldn't load the answers"
                description="Try again in a moment — nothing was changed."
              />
            ) : !resultsData ? null : (
              <div className="space-y-5">
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Shown", value: resultsData.totalImpressions },
                    { label: "Answered", value: resultsData.totalResponses },
                    { label: "Skipped", value: resultsData.totalSkipped },
                  ].map((k) => (
                    <div key={k.label} className="rounded-xl bg-muted/40 px-3 py-2.5 text-center">
                      <p className="text-xs text-muted-foreground">{k.label}</p>
                      <p className="text-lg font-semibold tabular-nums">
                        {k.value.toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>

                {resultsData.questionBreakdowns.length === 0 ? (
                  <EmptyState
                    icon={BarChart3}
                    title="No answers yet"
                    description="Once guests start replying, their answers appear here."
                  />
                ) : (
                  resultsData.questionBreakdowns.map((q) => (
                    <div key={q.questionId} className="space-y-2 rounded-xl border p-4">
                      <div>
                        <p className="text-sm font-medium text-foreground">{q.questionText}</p>
                        <p className="text-xs text-muted-foreground">
                          {q.totalAnswers.toLocaleString()}{" "}
                          {q.totalAnswers === 1 ? "answer" : "answers"}
                        </p>
                      </div>

                      {q.totalAnswers === 0 ? (
                        <p className="text-xs text-muted-foreground">
                          Nobody has answered this yet.
                        </p>
                      ) : (
                        <>
                          {q.averageRating != null && (
                            <p className="text-sm">
                              <span className="font-semibold tabular-nums">
                                {q.averageRating.toFixed(1)}
                              </span>
                              <span className="text-muted-foreground"> average out of 5</span>
                            </p>
                          )}
                          {q.ratingDistribution && (
                            <div className="space-y-1">
                              {[5, 4, 3, 2, 1].map((star) => (
                                <AnswerBar
                                  key={star}
                                  label={`${star} star`}
                                  count={q.ratingDistribution?.[star] ?? 0}
                                  total={q.totalAnswers}
                                />
                              ))}
                            </div>
                          )}
                          {q.optionCounts && (
                            <div className="space-y-1">
                              {Object.entries(q.optionCounts).map(([opt, n]) => (
                                <AnswerBar key={opt} label={opt} count={n} total={q.totalAnswers} />
                              ))}
                            </div>
                          )}
                          {q.freeTextAnswers && q.freeTextAnswers.length > 0 && (
                            <ul className="space-y-1.5">
                              {q.freeTextAnswers.map((t, i) => (
                                <li
                                  key={i}
                                  className="rounded-lg bg-muted/40 px-3 py-2 text-sm text-foreground"
                                >
                                  {t}
                                </li>
                              ))}
                            </ul>
                          )}
                        </>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {manageFor && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
          onClick={closeManage}
        >
          <div
            className="w-full max-w-lg rounded-2xl border bg-card p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-1 flex items-center justify-between">
              <h3 className="text-base font-semibold tracking-tight">
                Manage Questions — {manageFor.name}
              </h3>
              <button
                onClick={closeManage}
                className="rounded-lg p-1 text-muted-foreground hover:bg-accent"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mb-4 text-xs text-muted-foreground">
              Guests answer these when this survey campaign is shown at login.
            </p>

            {questionsLoading ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
            ) : (
              <div className="mb-4 max-h-64 space-y-2 overflow-y-auto">
                {questions.length === 0 && (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    No questions yet — add one below.
                  </p>
                )}
                {questions.map((q, i) => (
                  <div
                    key={q.id}
                    className="flex items-start justify-between gap-2 rounded-xl border bg-muted/30 p-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium">
                        {i + 1}. {q.questionText}
                        {q.isRequired && <span className="text-destructive"> *</span>}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {ANSWER_TYPES.find((a) => a.value === q.answerType)?.label}
                        {q.options.length > 0 ? ` — ${q.options.join(", ")}` : ""}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0 text-destructive"
                      onClick={() => removeQuestion(q.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-2 border-t pt-4">
              <Label>New Question</Label>
              <Input
                value={qForm.questionText}
                onChange={(e) => setQForm({ ...qForm, questionText: e.target.value })}
                placeholder="e.g. Rate our food quality?"
              />
              <div className="grid grid-cols-2 gap-2">
                <Select
                  value={qForm.answerType}
                  onValueChange={(v: QuestionAnswerType) => setQForm({ ...qForm, answerType: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ANSWER_TYPES.map((a) => (
                      <SelectItem key={a.value} value={a.value}>
                        {a.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={qForm.isRequired}
                    onCheckedChange={(v) => setQForm({ ...qForm, isRequired: v === true })}
                  />
                  Required
                </label>
              </div>
              {(qForm.answerType === "single_choice" || qForm.answerType === "multi_choice") && (
                <Input
                  value={qForm.options}
                  onChange={(e) => setQForm({ ...qForm, options: e.target.value })}
                  placeholder="Options, comma separated (e.g. Excellent, Good, Average)"
                />
              )}
              {qErr && <p className="text-xs text-destructive">{qErr}</p>}
              <div className="flex justify-end gap-2 pt-1">
                <Button variant="outline" size="sm" onClick={closeManage}>
                  Done
                </Button>
                <Button size="sm" onClick={addQuestion}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Question
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {previewFor && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
          onClick={closePreview}
        >
          <div
            className="w-full max-w-sm rounded-2xl border bg-card p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-1 flex items-center justify-between">
              <h3 className="text-base font-semibold tracking-tight">
                Guest Preview — {previewFor.name}
              </h3>
              <button
                onClick={closePreview}
                className="rounded-lg p-1 text-muted-foreground hover:bg-accent"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mb-3 text-xs text-muted-foreground">
              {previewFor.type === "SURVEY"
                ? "The real questions this campaign will ask, exactly as configured in Manage Questions."
                : "The real banner content this campaign will show."}{" "}
              This is exactly what an active campaign shows a guest connecting through the captive
              portal — it renders live in the guest login flow.
            </p>

            {/* Device mockup -- same phone-frame + indigo gradient look as
                /preview/portal/:locationId (today's Portal Preview), so this
                reads as the same feature family. */}
            <div className="mx-auto w-full max-w-[260px] rounded-[2rem] border-8 border-foreground/90 bg-foreground/90 p-1.5 shadow-xl">
              <div
                className="relative min-h-[420px] overflow-hidden rounded-[1.4rem]"
                style={{
                  background: "linear-gradient(160deg, #eef2ff 0%, #f8fafc 45%, #e0e7ff 100%)",
                }}
              >
                {previewLoading && (
                  <div className="absolute inset-0 z-20 grid place-items-center bg-white/60">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
                  </div>
                )}
                <div className="relative z-10 flex min-h-[420px] flex-col px-4 pb-4 pt-5 text-slate-900">
                  <div className="mb-4 flex flex-col items-center text-center">
                    <div
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-white shadow-lg"
                      style={{ background: "linear-gradient(135deg, #6366f1, #4f46e5)" }}
                    >
                      {previewFor.type === "SURVEY" ? (
                        <MessageSquareText className="h-4 w-4" />
                      ) : (
                        <Wifi className="h-4 w-4" />
                      )}
                    </div>
                    <h4 className="font-display mt-2 text-sm font-bold tracking-tight leading-tight">
                      {previewFor.type === "SURVEY" ? "Quick feedback?" : "Welcome!"}
                    </h4>
                    <p className="mt-0.5 text-[10px] text-slate-500">
                      {previewFor.type === "SURVEY"
                        ? "Help us improve — it only takes a moment."
                        : "You're connected to guest WiFi."}
                    </p>
                  </div>

                  <div
                    className="flex flex-1 flex-col rounded-2xl border border-indigo-100/80 bg-white p-3.5"
                    style={{ boxShadow: "0 16px 40px -18px rgba(79,70,229,0.3)" }}
                  >
                    {previewFor.type === "SURVEY" ? (
                      previewQuestions.length === 0 ? (
                        <p className="py-6 text-center text-[11px] text-slate-500">
                          No questions yet — add some via Manage Questions, then preview again.
                        </p>
                      ) : (
                        <div className="space-y-3 overflow-y-auto">
                          {previewQuestions.map((q, i) => (
                            <div
                              key={q.id}
                              className={i > 0 ? "border-t border-slate-100 pt-3" : ""}
                            >
                              <p className="mb-1.5 text-[11px] font-semibold text-slate-700">
                                {i + 1}. {q.questionText}
                                {q.isRequired && <span className="text-rose-500"> *</span>}
                              </p>
                              {q.answerType === "free_text" ? (
                                <div className="rounded-lg border border-slate-200 px-2 py-1.5 text-[10px] text-slate-400">
                                  Type your answer…
                                </div>
                              ) : q.answerType === "rating_5" ? (
                                <div className="flex gap-1">
                                  {[1, 2, 3, 4, 5].map((n) => (
                                    <Star key={n} className="h-3.5 w-3.5 text-amber-300" />
                                  ))}
                                </div>
                              ) : (
                                <div className="flex flex-wrap gap-1">
                                  {q.options.map((o) => (
                                    <span
                                      key={o}
                                      className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] text-slate-600"
                                    >
                                      {o}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                          <div
                            className="mt-1 rounded-lg py-1.5 text-center text-[10px] font-semibold text-white"
                            style={{ background: "linear-gradient(135deg, #6366f1, #4f46e5)" }}
                          >
                            Submit feedback
                          </div>
                        </div>
                      )
                    ) : previewAssets[0]?.headline || previewAssets[0]?.couponCode ? (
                      <div className="space-y-2">
                        {previewAssets[0].imageUrl && (
                          <div className="overflow-hidden rounded-xl border border-slate-200">
                            <img
                              src={previewAssets[0].imageUrl}
                              alt={previewAssets[0].altText ?? ""}
                              className="w-full object-cover"
                            />
                          </div>
                        )}
                        <div className="flex flex-col items-center gap-2 rounded-xl bg-amber-50 px-3 py-4 text-center">
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-700">
                            <TicketPercent className="h-3 w-3" />
                            Offer
                          </span>
                          {previewAssets[0].headline && (
                            <p className="text-[12px] font-bold text-slate-900">
                              {previewAssets[0].headline}
                            </p>
                          )}
                          {previewAssets[0].subtext && (
                            <p className="text-[10px] text-slate-600">{previewAssets[0].subtext}</p>
                          )}
                          {previewAssets[0].couponCode && (
                            <span className="rounded-lg border-2 border-dashed border-amber-300 bg-white px-3 py-1 font-mono text-[12px] font-bold tracking-[0.15em] text-amber-800">
                              {previewAssets[0].couponCode}
                            </span>
                          )}
                          {previewAssets[0].couponExpiresAt && (
                            <p className="text-[9px] text-slate-400">
                              Valid until{" "}
                              {new Date(previewAssets[0].couponExpiresAt).toLocaleDateString(
                                undefined,
                                { year: "numeric", month: "short", day: "numeric" },
                              )}
                            </p>
                          )}
                        </div>
                        <div
                          className="rounded-lg py-1.5 text-center text-[10px] font-semibold text-white"
                          style={{ background: "linear-gradient(135deg, #6366f1, #4f46e5)" }}
                        >
                          Continue
                        </div>
                      </div>
                    ) : previewAssets[0]?.imageUrl ? (
                      <div className="space-y-2">
                        <div className="overflow-hidden rounded-xl border border-slate-200">
                          <img
                            src={previewAssets[0].imageUrl}
                            alt={previewAssets[0].altText ?? ""}
                            className="w-full object-cover"
                          />
                        </div>
                        {previewAssets[0].clickUrl && (
                          <p className="flex items-center justify-center gap-1 text-[10px] text-indigo-600">
                            <ExternalLink className="h-3 w-3" />
                            Tap to open offer
                          </p>
                        )}
                        <div
                          className="rounded-lg py-1.5 text-center text-[10px] font-semibold text-white"
                          style={{ background: "linear-gradient(135deg, #6366f1, #4f46e5)" }}
                        >
                          Continue
                        </div>
                      </div>
                    ) : previewAssets[0]?.clickUrl ? (
                      <div className="py-4 text-center text-[11px] text-slate-600">
                        No banner image — guests will be redirected straight to
                        <span className="mt-1 block truncate font-medium text-indigo-600">
                          {previewAssets[0].clickUrl}
                        </span>
                      </div>
                    ) : (
                      <p className="py-6 text-center text-[11px] text-slate-500">
                        No banner configured yet — add an image or link below, then preview again.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {previewFor.type !== "SURVEY" && !previewLoading && !previewAssets[0] && (
              <div className="mt-4 space-y-2 border-t pt-4">
                <Label className="text-xs">Add this campaign's banner</Label>
                <p className="text-[11px] text-muted-foreground">
                  Provide a promo headline and coupon code, an image, a link — or any combination.
                  Guests see this the moment they connect.
                </p>
                <Input
                  value={assetForm.headline}
                  onChange={(e) => setAssetForm({ ...assetForm, headline: e.target.value })}
                  placeholder="Headline (e.g. Flat 20% off this weekend)"
                />
                <Input
                  value={assetForm.subtext}
                  onChange={(e) => setAssetForm({ ...assetForm, subtext: e.target.value })}
                  placeholder="Subtext (e.g. Show this coupon at checkout)"
                />
                <div className="flex gap-2">
                  <Input
                    value={assetForm.couponCode}
                    onChange={(e) => setAssetForm({ ...assetForm, couponCode: e.target.value })}
                    placeholder="Coupon code (e.g. SAVE20)"
                  />
                  <Input
                    type="date"
                    value={assetForm.couponExpiresAt}
                    onChange={(e) =>
                      setAssetForm({ ...assetForm, couponExpiresAt: e.target.value })
                    }
                    aria-label="Coupon valid until"
                  />
                </div>
                <Input
                  value={assetForm.imageUrl}
                  onChange={(e) => setAssetForm({ ...assetForm, imageUrl: e.target.value })}
                  placeholder="Image URL (optional, e.g. https://…/banner.png)"
                />
                <Input
                  value={assetForm.clickUrl}
                  onChange={(e) => setAssetForm({ ...assetForm, clickUrl: e.target.value })}
                  placeholder="Click-through URL (optional)"
                />
                <div className="flex justify-end">
                  <Button size="sm" onClick={addPreviewAsset}>
                    <Plus className="mr-2 h-4 w-4" />
                    Save banner
                  </Button>
                </div>
              </div>
            )}

            <div className="mt-4 flex justify-end">
              <Button variant="outline" size="sm" onClick={closePreview}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Saved campaigns -- the list the QR's first line asks for ("List of
       * created campaign/survey forms"), and the place a saved campaign is
       * chosen and made active. Its one-line description ("This lists out all
       * the recent communication campaigns you had setup") was the exact kind
       * of restatement the report asked to drop: a list of campaigns does not
       * need to be told what it is. */}
      <div>
        <h3 className="mb-3 text-base font-semibold tracking-tight">Saved campaigns</h3>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-0">
            {loading ? (
              <div className="p-4">
                <LoadingSkeleton rows={4} />
              </div>
            ) : loadError ? (
              <EmptyState
                icon={ClipboardList}
                title="Couldn't load your campaigns"
                description="Nothing was changed. Refresh to try again — if it keeps happening, raise a support ticket."
              />
            ) : filtered.length === 0 ? (
              <EmptyState
                icon={ClipboardList}
                title="No campaigns"
                description={
                  filtersActive
                    ? "No campaigns match your search."
                    : "Create a campaign above to reach guests over your WiFi."
                }
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs font-medium uppercase tracking-wide">
                      Name
                    </TableHead>
                    <TableHead className="text-xs font-medium uppercase tracking-wide">
                      Type
                    </TableHead>
                    <TableHead className="text-xs font-medium uppercase tracking-wide">
                      Status
                    </TableHead>
                    <TableHead className="text-xs font-medium uppercase tracking-wide">
                      Impressions
                    </TableHead>
                    <TableHead className="text-xs font-medium uppercase tracking-wide">
                      Conversions
                    </TableHead>
                    <TableHead className="text-xs font-medium uppercase tracking-wide text-right">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((c) => (
                    <TableRow key={c.id} className="border-b">
                      <TableCell className="font-medium">
                        {c.type === "SURVEY" ? (
                          <button
                            className="hover:underline text-left"
                            onClick={() => openManage(c)}
                          >
                            {c.name}
                          </button>
                        ) : (
                          c.name
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{c.type}</Badge>
                      </TableCell>
                      <TableCell>
                        <Select
                          disabled={selectableStatuses(c.status).length === 1}
                          value={c.status}
                          onValueChange={(v) => updateStatus(c.id, v)}
                        >
                          <SelectTrigger className="h-7 w-28">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUSES.filter((s) => selectableStatuses(c.status).includes(s)).map(
                              (s) => (
                                <SelectItem key={s} value={s} className="capitalize">
                                  {s}
                                </SelectItem>
                              ),
                            )}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        {c.impressions === null ? (
                          <span className="text-muted-foreground">--</span>
                        ) : (
                          c.impressions.toLocaleString()
                        )}
                      </TableCell>
                      <TableCell>
                        {c.conversions === null ? (
                          <span className="text-muted-foreground">--</span>
                        ) : (
                          c.conversions.toLocaleString()
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {c.type === "SURVEY" && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Manage questions"
                              onClick={() => openManage(c)}
                            >
                              <ListChecks className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              title="See answers"
                              onClick={() => openResults(c)}
                            >
                              <BarChart3 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Preview as a guest"
                          onClick={() => openPreview(c)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Copy campaign ID"
                          onClick={() => copyCampaignId(c.id)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive"
                          onClick={() => removeCampaign(c.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
