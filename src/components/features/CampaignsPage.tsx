import { useClientControls } from "@/hooks/useClientControls";
import { isNasOnlyVendor } from "@/lib/router-vendors";
import { useEffect, useState } from "react";
import {
  BarChart3,
  ClipboardList,
  Copy,
  ExternalLink,
  Eye,
  ListChecks,
  MessageSquareText,
  Pencil,
  Plus,
  Search,
  Star,
  TicketPercent,
  Trash2,
  Wifi,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DataTable,
  PageHeader,
  Panel,
  StatTile,
  Toolbar,
  ToolbarSearch,
  type PageScope,
} from "@/components/customer/console";
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
import { toast } from "sonner";
import { EmptyState } from "@/components/common/EmptyState";
import { LoadingSkeleton } from "@/components/common/LoadingSkeleton";
import { useTranslation } from "react-i18next";
import i18n from "@/lib/i18n";
import { useIsDemo } from "@/hooks/useCustomerDashboard";
import {
  DEMO_CAMPAIGN_COUPON_CODE,
  DEMO_CAMPAIGN_COUPON_EXPIRES_AT,
  DEMO_CAMPAIGN_HEADLINE,
  DEMO_CAMPAIGN_NAME,
  DEMO_CAMPAIGN_SUBTEXT,
} from "@/lib/portal-demo";
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
    name: DEMO_CAMPAIGN_NAME,
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
//
// The copy is NOT written here: it comes from `src/lib/portal-demo.ts`, the
// same constants the portal walkthrough's own campaign step renders
// (`DEMO_PORTAL_CAMPAIGN`). One demo campaign, one coupon, described once --
// a local copy here is exactly how the demo would come to show a prospect a
// coupon that the Campaigns page they were just looking at does not have.
const demoAssetSeed = (campaignId: string): CampaignAsset[] => [
  {
    id: `${campaignId}-demo-asset`,
    campaignId,
    imageUrl: null,
    clickUrl: null,
    altText: DEMO_CAMPAIGN_HEADLINE,
    locale: null,
    headline: DEMO_CAMPAIGN_HEADLINE,
    subtext: DEMO_CAMPAIGN_SUBTEXT,
    couponCode: DEMO_CAMPAIGN_COUPON_CODE,
    couponExpiresAt: DEMO_CAMPAIGN_COUPON_EXPIRES_AT,
  },
];

export function CampaignsPage({ locationId, scope }: { locationId?: string; scope?: PageScope }) {
  const { t } = useTranslation("marketing", { i18n });
  const demo = useIsDemo();
  const clientControls = useClientControls();
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
  const [surveyDetails, setSurveyDetails] = useState({ name: "", startDate: "", endDate: "" });
  const [surveyDetailsSaving, setSurveyDetailsSaving] = useState(false);

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
  // Edit -- a banner or redirect's name, scheduled window and content. Kept
  // apart from Guest Preview, which only shows what a guest would see.
  const [editFor, setEditFor] = useState<Campaign | null>(null);
  const [editAsset, setEditAsset] = useState<CampaignAsset | null>(null);
  const [editDetails, setEditDetails] = useState({ name: "", startDate: "", endDate: "" });
  const [editLoading, setEditLoading] = useState(false);
  const [editLoadFailed, setEditLoadFailed] = useState(false);
  const [editSaving, setEditSaving] = useState(false);

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
      if (created.campaignType.toUpperCase() !== "SURVEY") {
        void openEdit({
          id: created.id,
          name: created.name,
          type: created.campaignType.toUpperCase(),
          status: created.status,
          businessUnit: "",
          startDate: created.startsAt?.slice(0, 10) ?? "",
          endDate: created.endsAt?.slice(0, 10) ?? "",
          impressions: 0,
          conversions: 0,
        });
      }
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
    setSurveyDetails({ name: c.name, startDate: c.startDate, endDate: c.endDate });
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

  const saveSurveyDetails = async () => {
    if (!manageFor) return;
    const name = surveyDetails.name.trim();
    if (!name) {
      toast.error(t("offersEdit.nameRequired", "Campaign name is required."));
      return;
    }
    if (
      surveyDetails.startDate &&
      surveyDetails.endDate &&
      surveyDetails.endDate < surveyDetails.startDate
    ) {
      toast.error(t("offersEdit.endBeforeStart", "End date must be after start date."));
      return;
    }
    const applyLocal = () => {
      const updated = {
        ...manageFor,
        name,
        startDate: surveyDetails.startDate,
        endDate: surveyDetails.endDate,
      };
      setItems((rows) => rows.map((r) => (r.id === manageFor.id ? { ...r, ...updated } : r)));
      setManageFor(updated);
      toast.success(t("offersEdit.surveySaved", "Survey saved"));
    };
    if (demo) {
      applyLocal();
      return;
    }
    setSurveyDetailsSaving(true);
    try {
      await campaignService.update(manageFor.id, {
        name,
        ...(surveyDetails.startDate
          ? { startsAt: new Date(surveyDetails.startDate).toISOString() }
          : {}),
        endsAt: surveyDetails.endDate ? new Date(surveyDetails.endDate).toISOString() : null,
      });
      applyLocal();
    } catch {
      toast.error(
        t(
          "offersEdit.surveySaveFailed",
          "Could not save the survey — check the connection and try again.",
        ),
      );
    } finally {
      setSurveyDetailsSaving(false);
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

  const openEdit = async (c: Campaign) => {
    // A survey's content is its questions, which already have their own editor.
    if (c.type === "SURVEY") {
      void openManage(c);
      return;
    }
    setEditFor(c);
    setEditDetails({ name: c.name, startDate: c.startDate, endDate: c.endDate });
    setEditAsset(null);
    setAssetForm(emptyAssetForm);
    setEditLoadFailed(false);
    const fill = (asset: CampaignAsset | null) => {
      setEditAsset(asset);
      setAssetForm({
        imageUrl: asset?.imageUrl ?? "",
        clickUrl: asset?.clickUrl ?? "",
        headline: asset?.headline ?? "",
        subtext: asset?.subtext ?? "",
        couponCode: asset?.couponCode ?? "",
        couponExpiresAt: asset?.couponExpiresAt?.slice(0, 10) ?? "",
      });
    };
    if (demo) {
      fill(demoAssetSeed(c.id)[0] ?? null);
      return;
    }
    setEditLoading(true);
    try {
      fill((await campaignService.listAssets(c.id))[0] ?? null);
    } catch {
      // Saving now could add a second banner beside the unread one.
      setEditLoadFailed(true);
    } finally {
      setEditLoading(false);
    }
  };

  const closeEdit = () => {
    setEditFor(null);
    setEditAsset(null);
    setAssetForm(emptyAssetForm);
  };

  const saveEdit = async () => {
    if (!editFor || editLoadFailed) return;
    const name = editDetails.name.trim();
    if (!name) {
      toast.error(t("offersEdit.nameRequired", "Campaign name is required."));
      return;
    }
    if (
      editDetails.startDate &&
      editDetails.endDate &&
      editDetails.endDate < editDetails.startDate
    ) {
      toast.error(t("offersEdit.endBeforeStart", "End date must be after start date."));
      return;
    }
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
    const assetPayload = {
      imageUrl: assetForm.imageUrl || null,
      clickUrl: assetForm.clickUrl || null,
      headline: assetForm.headline || null,
      subtext: assetForm.subtext || null,
      couponCode: assetForm.couponCode || null,
      couponExpiresAt: assetForm.couponExpiresAt
        ? new Date(assetForm.couponExpiresAt).toISOString()
        : null,
    };
    const applyLocal = (asset: CampaignAsset) => {
      setItems((rows) =>
        rows.map((r) =>
          r.id === editFor.id
            ? {
                ...r,
                name,
                startDate: editDetails.startDate,
                endDate: editDetails.endDate,
              }
            : r,
        ),
      );
      setCouponsByCampaign((prev) => ({ ...prev, [editFor.id]: asset }));
      toast.success(t("offersEdit.saved", "Banner saved"));
      closeEdit();
    };
    if (demo) {
      applyLocal({
        id: editAsset?.id ?? `${editFor.id}-demo-asset`,
        campaignId: editFor.id,
        altText: null,
        locale: null,
        ...assetPayload,
      });
      return;
    }
    setEditSaving(true);
    try {
      await campaignService.update(editFor.id, {
        name,
        ...(editDetails.startDate
          ? { startsAt: new Date(editDetails.startDate).toISOString() }
          : {}),
        endsAt: editDetails.endDate ? new Date(editDetails.endDate).toISOString() : null,
      });
      const asset = editAsset
        ? await campaignService.updateAsset(editAsset.id, assetPayload)
        : await campaignService.addAsset(editFor.id, assetPayload);
      applyLocal(asset);
    } catch {
      toast.error(
        t(
          "offersEdit.saveFailed",
          "Could not save the banner — check the connection and try again.",
        ),
      );
    } finally {
      setEditSaving(false);
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
      {/* The console PageHeader: the nav label, the venue chip and the one
       * primary action. Search and filters moved down onto the Saved
       * campaigns list they filter. */}
      <PageHeader
        title={scope?.title ?? "Login Page Offers"}
        venue={scope?.venue}
        actions={
          <Button onClick={() => openCreate("SURVEY")}>
            <Plus className="h-4 w-4" aria-hidden />
            Create Campaign
          </Button>
        }
      />

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
        <Panel
          title={
            <span className="flex items-center gap-2">
              <MessageSquareText className="h-4 w-4 text-[var(--wy-text-faint)]" aria-hidden />
              Survey &amp; Feedback
            </span>
          }
          actions={
            <Button size="sm" variant="outline" onClick={() => openCreate("SURVEY")}>
              <Plus className="h-4 w-4" aria-hidden />
              New survey
            </Button>
          }
        >
          {surveys.length === 0 ? (
            <p className="py-2 text-sm text-muted-foreground">
              No surveys yet. Ask guests a few questions when they connect.
            </p>
          ) : (
            <ul className="divide-y divide-[var(--wy-border)]">
              {surveys.map((c) => (
                <li key={c.id} className="flex items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{c.name}</p>
                    <p className="text-xs capitalize text-muted-foreground">{c.status}</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => openManage(c)}>
                    <Pencil className="mr-2 h-4 w-4" aria-hidden />
                    {t("offersEdit.edit", "Edit")}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => openPreview(c)}>
                    <Eye className="mr-2 h-4 w-4" aria-hidden />
                    {t("offersEdit.preview", "Preview")}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {/* Discounts & Banners -- the coupon half, designed as coupons. */}
        <Panel
          title={
            <span className="flex items-center gap-2">
              <TicketPercent className="h-4 w-4 text-[var(--wy-text-faint)]" aria-hidden />
              Coupons &amp; Banners
            </span>
          }
          actions={
            <Button size="sm" variant="outline" onClick={() => openCreate("BANNER")}>
              <Plus className="h-4 w-4" aria-hidden />
              New offer
            </Button>
          }
        >
          {banners.length === 0 ? (
            <p className="py-2 text-sm text-muted-foreground">
              No offers yet. Show a banner and a coupon code when guests connect.
            </p>
          ) : (
            <ul className="divide-y divide-[var(--wy-border)]">
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
                    <span className="shrink-0 rounded-[var(--wy-radius)] border border-dashed border-[var(--wy-border-strong)] bg-[var(--wy-surface-2)] px-2.5 py-1 font-[family-name:var(--wy-font-mono)] text-[13px] font-semibold tracking-[0.12em] text-[var(--wy-text)]">
                      {asset.couponCode}
                    </span>
                  ) : (
                    <span className="shrink-0 text-xs text-muted-foreground">No coupon</span>
                  )}
                  <Button size="sm" variant="outline" onClick={() => openEdit(campaign)}>
                    <Pencil className="mr-2 h-4 w-4" aria-hidden />
                    {t("offersEdit.edit", "Edit")}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => openPreview(campaign)}>
                    <Eye className="mr-2 h-4 w-4" aria-hidden />
                    {t("offersEdit.preview", "Preview")}
                  </Button>
                </li>
              ))}
            </ul>
          )}
          {bannersTruncated > 0 && (
            <p className="pt-2 text-xs text-muted-foreground">
              +{bannersTruncated} more in the list below.
            </p>
          )}
        </Panel>
      </div>

      {showCreate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setShowCreate(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="campaign-create-title"
            className="w-full max-w-md rounded-[var(--wy-radius-lg)] border border-[var(--wy-border)] bg-[var(--wy-surface)] p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="campaign-create-title" className="text-base font-semibold">
              Create Campaign
            </h3>
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
                    <SelectContent className="wy-console">
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
                  <SelectContent className="wy-console">
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setResultsFor(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Answers — ${resultsFor.name}`}
            className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-[var(--wy-radius-lg)] border border-[var(--wy-border)] bg-[var(--wy-surface)] p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-1 flex items-center justify-between">
              <h3 className="text-base font-semibold tracking-tight">
                Answers — {resultsFor.name}
              </h3>
              <button
                type="button"
                onClick={() => setResultsFor(null)}
                aria-label="Close"
                className="rounded-[var(--wy-radius)] p-1 text-[var(--wy-text-muted)] hover:bg-[var(--wy-surface-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wy-accent)]"
              >
                <X className="h-4 w-4" aria-hidden />
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
                    <StatTile key={k.label} label={k.label} value={k.value.toLocaleString()} />
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={closeManage}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Manage Questions — ${manageFor.name}`}
            className="w-full max-w-lg rounded-[var(--wy-radius-lg)] border border-[var(--wy-border)] bg-[var(--wy-surface)] p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-1 flex items-center justify-between">
              <h3 className="text-base font-semibold tracking-tight">
                Manage Questions — {manageFor.name}
              </h3>
              <button
                type="button"
                onClick={closeManage}
                aria-label="Close"
                className="rounded-[var(--wy-radius)] p-1 text-[var(--wy-text-muted)] hover:bg-[var(--wy-surface-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wy-accent)]"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
            <div className="mb-4 space-y-3 border-b border-[var(--wy-border)] pb-4">
              <div>
                <Label htmlFor="edit-survey-name">{t("offersEdit.name", "Campaign Name")}</Label>
                <Input
                  id="edit-survey-name"
                  value={surveyDetails.name}
                  onChange={(e) => setSurveyDetails({ ...surveyDetails, name: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="edit-survey-start">{t("offersEdit.start", "Start date")}</Label>
                  <Input
                    id="edit-survey-start"
                    type="date"
                    value={surveyDetails.startDate}
                    onChange={(e) =>
                      setSurveyDetails({ ...surveyDetails, startDate: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="edit-survey-end">
                    {t("offersEdit.end", "End date (optional)")}
                  </Label>
                  <Input
                    id="edit-survey-end"
                    type="date"
                    value={surveyDetails.endDate}
                    onChange={(e) =>
                      setSurveyDetails({ ...surveyDetails, endDate: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button size="sm" onClick={saveSurveyDetails} disabled={surveyDetailsSaving}>
                  {surveyDetailsSaving
                    ? t("offersEdit.saving", "Saving…")
                    : t("offersEdit.saveDetails", "Save details")}
                </Button>
              </div>
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
                      title={`Remove question ${i + 1}`}
                      aria-label={`Remove question ${i + 1}`}
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
                  <SelectContent className="wy-console">
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

      {editFor && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={closeEdit}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t("offersEdit.title", "Edit — {{name}}", { name: editFor.name })}
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-[var(--wy-radius-lg)] border border-[var(--wy-border)] bg-[var(--wy-surface)] p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold">
              {t("offersEdit.title", "Edit — {{name}}", { name: editFor.name })}
            </h3>
            {editLoading ? (
              <p className="mt-3 text-sm text-muted-foreground">
                {t("offersEdit.loading", "Loading…")}
              </p>
            ) : editLoadFailed ? (
              <p className="mt-3 text-sm text-destructive" role="alert">
                {t(
                  "offersEdit.loadFailed",
                  "Could not load this banner, so it can't be edited right now. Close this and try again.",
                )}
              </p>
            ) : (
              <div className="mt-3 space-y-3">
                <div>
                  <Label htmlFor="edit-campaign-name">
                    {t("offersEdit.name", "Campaign Name")}
                  </Label>
                  <Input
                    id="edit-campaign-name"
                    value={editDetails.name}
                    onChange={(e) => setEditDetails({ ...editDetails, name: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="edit-campaign-start">
                      {t("offersEdit.start", "Start date")}
                    </Label>
                    <Input
                      id="edit-campaign-start"
                      type="date"
                      value={editDetails.startDate}
                      onChange={(e) =>
                        setEditDetails({ ...editDetails, startDate: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-campaign-end">
                      {t("offersEdit.end", "End date (optional)")}
                    </Label>
                    <Input
                      id="edit-campaign-end"
                      type="date"
                      value={editDetails.endDate}
                      onChange={(e) => setEditDetails({ ...editDetails, endDate: e.target.value })}
                    />
                  </div>
                </div>
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
                <Input
                  value={assetForm.couponCode}
                  onChange={(e) => setAssetForm({ ...assetForm, couponCode: e.target.value })}
                  placeholder="Coupon code (e.g. SAVE20)"
                />
                <div>
                  <Label htmlFor="edit-coupon-expiry">
                    {t("offersEdit.couponUntil", "Coupon valid until (optional)")}
                  </Label>
                  <Input
                    id="edit-coupon-expiry"
                    type="date"
                    value={assetForm.couponExpiresAt}
                    onChange={(e) =>
                      setAssetForm({ ...assetForm, couponExpiresAt: e.target.value })
                    }
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {t(
                      "offersEdit.couponHint",
                      "Leave this blank if the dates above are enough. Guests just won't see a separate coupon date.",
                    )}
                  </p>
                </div>
                <Input
                  value={assetForm.imageUrl}
                  onChange={(e) => setAssetForm({ ...assetForm, imageUrl: e.target.value })}
                  placeholder="Image URL (optional, e.g. https://…/banner.png)"
                />
                {isNasOnlyVendor(clientControls.vendor) && (
                  <p
                    className="text-[11px] text-muted-foreground"
                    data-testid="banner-image-nas-only"
                  >
                    {t(
                      "offersEdit.imageNasOnly",
                      "Guests aren't online yet when they see this. An image hosted on another site won't load unless that site's domain is allowed on the guest network in the Instant On app.",
                    )}
                  </p>
                )}
                <Input
                  value={assetForm.clickUrl}
                  onChange={(e) => setAssetForm({ ...assetForm, clickUrl: e.target.value })}
                  placeholder="Click-through URL (optional)"
                />
              </div>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={closeEdit}>
                {t("offersEdit.cancel", "Cancel")}
              </Button>
              {!editLoading && !editLoadFailed && (
                <Button size="sm" onClick={saveEdit} disabled={editSaving}>
                  {editSaving ? t("offersEdit.saving", "Saving…") : t("offersEdit.save", "Save")}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {previewFor && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={closePreview}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Guest Preview — ${previewFor.name}`}
            className="max-h-[92vh] w-full max-w-sm overflow-y-auto rounded-[var(--wy-radius-lg)] border border-[var(--wy-border)] bg-[var(--wy-surface)] p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-1 flex items-center justify-between">
              <h3 className="text-base font-semibold tracking-tight">
                Guest Preview — {previewFor.name}
              </h3>
              <button
                type="button"
                onClick={closePreview}
                aria-label="Close"
                className="rounded-[var(--wy-radius)] p-1 text-[var(--wy-text-muted)] hover:bg-[var(--wy-surface-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wy-accent)]"
              >
                <X className="h-4 w-4" aria-hidden />
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
                reads as the same feature family. It draws the GUEST portal,
                not the console, so it keeps the portal's own colours as
                literal values rather than console tokens. */}
            <div className="mx-auto w-full max-w-[260px] rounded-[2rem] border-8 border-foreground/90 bg-foreground/90 p-1.5 shadow-xl">
              <div
                className="relative min-h-[420px] overflow-hidden rounded-[1.4rem]"
                style={{
                  background: "linear-gradient(160deg, #eef2ff 0%, #f8fafc 45%, #e0e7ff 100%)",
                }}
              >
                {previewLoading && (
                  <div className="absolute inset-0 z-20 grid place-items-center bg-white/60">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#6366f1] border-t-transparent" />
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
                    className="flex flex-1 flex-col rounded-[16px] border border-[#e0e7ff]/80 bg-white p-3.5"
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
                                {q.isRequired && <span className="text-[#f43f5e]"> *</span>}
                              </p>
                              {q.answerType === "free_text" ? (
                                <div className="rounded-lg border border-slate-200 px-2 py-1.5 text-[10px] text-slate-400">
                                  Type your answer…
                                </div>
                              ) : q.answerType === "rating_5" ? (
                                <div className="flex gap-1">
                                  {[1, 2, 3, 4, 5].map((n) => (
                                    <Star key={n} className="h-3.5 w-3.5 text-[#fcd34d]" />
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
                        <div className="flex flex-col items-center gap-2 rounded-xl bg-[#fffbeb] px-3 py-4 text-center">
                          <span className="inline-flex items-center gap-1 rounded-full bg-[#fef3c7] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-[#b45309]">
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
                            <span className="rounded-lg border-2 border-dashed border-[#fcd34d] bg-white px-3 py-1 font-mono text-[12px] font-bold tracking-[0.15em] text-[#92400e]">
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
                          <p className="flex items-center justify-center gap-1 text-[10px] text-[#4f46e5]">
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
                        <span className="mt-1 block truncate font-medium text-[#4f46e5]">
                          {previewAssets[0].clickUrl}
                        </span>
                      </div>
                    ) : (
                      <p className="py-6 text-center text-[11px] text-slate-500">
                        {t(
                          "offersEdit.previewEmpty",
                          "No banner configured yet — use Edit to add one, then preview again.",
                        )}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

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
      <Panel title="Saved campaigns" flush>
        <Toolbar divided>
          <ToolbarSearch
            placeholder="Search campaigns…"
            aria-label="Search campaigns by name"
            value={filters.search}
            onValueChange={(v) => setFilters((f) => ({ ...f, search: v }))}
          />
          <Select
            value={filters.type || "__all"}
            onValueChange={(v) => setFilters((f) => ({ ...f, type: v === "__all" ? "" : v }))}
          >
            <SelectTrigger className="w-full sm:w-40" aria-label="Filter by campaign type">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent className="wy-console">
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
              <SelectTrigger className="w-full sm:w-40" aria-label="Filter by business unit">
                <SelectValue placeholder="All business units" />
              </SelectTrigger>
              <SelectContent className="wy-console">
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
            className="h-10 w-full sm:h-9 sm:w-40"
            aria-label="Campaigns starting on or after"
          />
          {filtersActive && (
            <Button
              variant="ghost"
              size="sm"
              className="h-10 sm:h-9"
              onClick={() => setFilters(emptyFilters)}
            >
              Clear
            </Button>
          )}
        </Toolbar>
        {loadError ? (
          <EmptyState
            icon={ClipboardList}
            title="Couldn't load your campaigns"
            description="Nothing was changed. Refresh to try again — if it keeps happening, raise a support ticket."
          />
        ) : (
          <DataTable
            ariaLabel="Saved campaigns"
            rows={filtered}
            rowKey={(c) => c.id}
            loading={loading}
            loadingLabel="Loading campaigns…"
            empty={
              <EmptyState
                icon={ClipboardList}
                title="No campaigns"
                description={
                  filtersActive
                    ? "No campaigns match your search."
                    : "Create a campaign above to reach guests over your WiFi."
                }
              />
            }
            density="comfortable"
            actionsLabel="Actions"
            columns={[
              {
                id: "name",
                header: "Name",
                mobile: "title",
                className: "whitespace-normal font-medium",
                cell: (c) =>
                  c.type === "SURVEY" ? (
                    <button
                      type="button"
                      className="rounded-sm text-left hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wy-accent)]"
                      onClick={() => openManage(c)}
                    >
                      {c.name}
                    </button>
                  ) : (
                    c.name
                  ),
              },
              {
                id: "type",
                header: "Type",
                cell: (c) => (
                  <span className="inline-flex h-5 items-center rounded-[calc(var(--wy-radius)-2px)] border border-[var(--wy-border)] bg-[var(--wy-surface-2)] px-1.5 text-[11px] font-medium text-[var(--wy-text-muted)]">
                    {c.type}
                  </span>
                ),
              },
              {
                id: "status",
                header: "Status",
                cell: (c) => (
                  <Select
                    disabled={selectableStatuses(c.status).length === 1}
                    value={c.status}
                    onValueChange={(v) => updateStatus(c.id, v)}
                  >
                    <SelectTrigger className="h-8 w-28" aria-label={`Status of ${c.name}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="wy-console">
                      {STATUSES.filter((s) => selectableStatuses(c.status).includes(s)).map((s) => (
                        <SelectItem key={s} value={s} className="capitalize">
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ),
              },
              {
                id: "impressions",
                header: "Impressions",
                align: "right",
                cell: (c) =>
                  c.impressions === null ? (
                    <span className="text-[var(--wy-text-faint)]">--</span>
                  ) : (
                    <span className="tabular-nums">{c.impressions.toLocaleString()}</span>
                  ),
              },
              {
                id: "conversions",
                header: "Conversions",
                align: "right",
                cell: (c) =>
                  c.conversions === null ? (
                    <span className="text-[var(--wy-text-faint)]">--</span>
                  ) : (
                    <span className="tabular-nums">{c.conversions.toLocaleString()}</span>
                  ),
              },
            ]}
            rowActions={(c) => (
              <div className="flex justify-end">
                <Button
                  variant="ghost"
                  size="icon"
                  title={t("offersEdit.edit", "Edit")}
                  aria-label={t("offersEdit.editNamed", "Edit {{name}}", { name: c.name })}
                  onClick={() => openEdit(c)}
                >
                  <Pencil className="h-4 w-4" aria-hidden />
                </Button>
                {c.type === "SURVEY" && (
                  <Button
                    variant="ghost"
                    size="icon"
                    title="See answers"
                    aria-label={`See answers for ${c.name}`}
                    onClick={() => openResults(c)}
                  >
                    <BarChart3 className="h-4 w-4" aria-hidden />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  title="Preview as a guest"
                  aria-label={`Preview ${c.name} as a guest`}
                  onClick={() => openPreview(c)}
                >
                  <Eye className="h-4 w-4" aria-hidden />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  title="Copy campaign ID"
                  aria-label={`Copy the ID of ${c.name}`}
                  onClick={() => copyCampaignId(c.id)}
                >
                  <Copy className="h-4 w-4" aria-hidden />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-[var(--wy-crit)]"
                  title={`Delete ${c.name}`}
                  aria-label={`Delete ${c.name}`}
                  onClick={() => removeCampaign(c.id)}
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </Button>
              </div>
            )}
          />
        )}
      </Panel>
    </div>
  );
}
