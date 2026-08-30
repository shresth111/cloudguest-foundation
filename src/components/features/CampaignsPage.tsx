import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  Plus,
  Trash2,
  Play,
  Pause,
  Copy,
  Search,
  ClipboardList,
  Image as ImageIcon,
  Link2,
  Star,
  MessageSquareText,
  Percent,
  Sparkles,
  X,
  ListChecks,
  Eye,
  Wifi,
  ExternalLink,
  TicketPercent,
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
import { portalService } from "@/services/portal.service";
import type {
  CampaignAsset,
  CampaignQuestion,
  CampaignType,
  QuestionAnswerType,
} from "@/types/campaign";

interface Campaign {
  id: string;
  name: string;
  type: string;
  status: string;
  businessUnit: string;
  startDate: string;
  endDate: string;
  impressions: number;
  conversions: number;
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
 * Hero illustration: a phone reaching guests with a survey (chat bubble)
 * and a discount (percent-sign badge), WiFi-style signal rings radiating
 * outward from the screen -- same filled-flat-shape character language as
 * customer.index.tsx's HeroManagerIllustration, adapted to this page's own
 * subject (reaching guests with campaigns) rather than reused wholesale.
 *
 * Purely decorative -- aria-hidden. The signal-ring pulse loops and
 * respects useReducedMotion; the connector-line draw-on is a one-time
 * entrance.
 */
function CampaignReachIllustration() {
  const shouldReduceMotion = useReducedMotion();
  const phone = { x: 150, y: 105 };
  const badges = [
    { key: "survey", x: 330, y: 40, accent: "#22d3ee" },
    { key: "discount", x: 378, y: 130, accent: "#f0abfc" },
  ];

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 480 210"
      className="h-auto w-full max-w-[280px]"
      fill="none"
    >
      <defs>
        <filter id="camp-illo-glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="14" />
        </filter>
      </defs>

      <circle
        cx="150"
        cy="105"
        r="72"
        fill="#7c3aed"
        opacity="0.16"
        filter="url(#camp-illo-glow)"
      />
      <line
        x1="20"
        y1="188"
        x2="460"
        y2="188"
        stroke="white"
        strokeOpacity="0.12"
        strokeWidth="1"
      />

      {[26, 40, 54].map((r, i) => (
        <motion.circle
          key={r}
          cx={phone.x}
          cy={phone.y}
          r={r}
          stroke={["#22d3ee", "#a78bfa", "#f0abfc"][i]}
          strokeOpacity="0.4"
          strokeWidth="2"
          fill="none"
          initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.85 }}
          animate={
            shouldReduceMotion
              ? { opacity: 0.25 }
              : { opacity: [0, 0.5, 0], scale: [0.85, 1.15, 1.3] }
          }
          transition={
            shouldReduceMotion
              ? undefined
              : { duration: 2.6, repeat: Infinity, delay: i * 0.5, ease: "easeOut" }
          }
        />
      ))}

      {badges.map((b, i) => (
        <motion.path
          key={`line-${b.key}`}
          d={`M${phone.x + 34} ${phone.y - 10} Q${(phone.x + b.x) / 2} ${Math.min(phone.y, b.y) - 20} ${b.x} ${b.y + 22}`}
          stroke={b.accent}
          strokeOpacity="0.55"
          strokeWidth="2"
          strokeDasharray="1 6"
          strokeLinecap="round"
          initial={shouldReduceMotion ? false : { pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.7, delay: 0.4 + i * 0.15, ease: "easeOut" }}
        />
      ))}

      <rect
        x={phone.x - 34}
        y={phone.y - 58}
        width="68"
        height="116"
        rx="14"
        fill="#2e2a5c"
        stroke="white"
        strokeOpacity="0.15"
        strokeWidth="1.5"
      />
      <rect x={phone.x - 26} y={phone.y - 46} width="52" height="80" rx="4" fill="#1e1b4b" />
      <circle cx={phone.x} cy={phone.y - 16} r="14" fill="#22d3ee" />
      <path
        d={`M${phone.x - 6} ${phone.y - 16}l4 4 8-9`}
        stroke="#1e1b4b"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <rect
        x={phone.x - 18}
        y={phone.y + 6}
        width="36"
        height="8"
        rx="4"
        fill="#f0abfc"
        fillOpacity="0.7"
      />
      <rect
        x={phone.x - 18}
        y={phone.y + 18}
        width="24"
        height="6"
        rx="3"
        fill="white"
        fillOpacity="0.2"
      />
      <circle cx={phone.x} cy={phone.y + 44} r="4" fill="white" fillOpacity="0.3" />

      <g transform={`translate(${badges[0].x}, ${badges[0].y})`}>
        <rect width="54" height="46" rx="12" fill="#2e2a5c" stroke="white" strokeOpacity="0.12" />
        <path
          d="M12 14h30a4 4 0 0 1 4 4v12a4 4 0 0 1-4 4H24l-8 6v-6h-4a4 4 0 0 1-4-4V18a4 4 0 0 1 4-4z"
          fill="#22d3ee"
        />
        <circle cx="21" cy="24" r="1.6" fill="#1e1b4b" />
        <circle cx="27" cy="24" r="1.6" fill="#1e1b4b" />
        <circle cx="33" cy="24" r="1.6" fill="#1e1b4b" />
      </g>

      <g transform={`translate(${badges[1].x}, ${badges[1].y})`}>
        <rect width="54" height="46" rx="12" fill="#2e2a5c" stroke="white" strokeOpacity="0.12" />
        <circle cx="20" cy="19" r="5" stroke="#f0abfc" strokeWidth="2.4" fill="none" />
        <circle cx="34" cy="29" r="5" stroke="#f0abfc" strokeWidth="2.4" fill="none" />
        <path d="M18 31L36 15" stroke="#f0abfc" strokeWidth="2.4" strokeLinecap="round" />
      </g>
    </svg>
  );
}

const emptyForm = { name: "", type: "SURVEY", businessUnit: "", startDate: "", endDate: "" };
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
// this set 409s server-side (InvalidCampaignStatusTransitionError); the
// status <Select> below must only ever offer these, and the Play/Pause row
// icon must compute its target from this table too, not toggle blindly
// between "active"/"paused" regardless of the row's real current status.
function selectableStatuses(current: string): string[] {
  return [current, ...(CAMPAIGN_STATUS_TRANSITIONS[current] ?? [])];
}

/** What the single Play/Pause row icon should do next, given the campaign's
 * real current status -- or null when there's no legal next action at all
 * (a campaign that has ENDED). A draft campaign's icon schedules it (the
 * only legal move); a scheduled or paused campaign's icon activates it;
 * only an active campaign's icon pauses it. Previously this always sent
 * "active" unless the row was already "active", which 409'd for every
 * draft/ended row -- the click reverted with an error toast that was easy
 * to miss, reading as "nothing happened." */
function nextPlayAction(
  status: string,
): { target: string; label: string; icon: "play" | "pause" } | null {
  if (status === "active") return { target: "paused", label: "Pause", icon: "pause" };
  if (status === "scheduled" || status === "paused")
    return { target: "active", label: "Activate", icon: "play" };
  if (status === "draft") return { target: "scheduled", label: "Schedule", icon: "play" };
  return null;
}

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
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [filters, setFilters] = useState(emptyFilters);
  const [showSearch, setShowSearch] = useState(false);
  // Post-Login Redirect URL -- a real captive_portal-config field
  // (`redirect_url`, see portal.service.ts), not a Campaigns-domain field.
  // This card's Save button previously only fired a success toast and never
  // called the backend at all -- typing a URL, refreshing, and finding the
  // old value back was the exact "fake-save button" pattern this session
  // already found on Vouchers/Notification/Network-Diagnostics. Now backed
  // by the same portalService.update() the real Portal Builder page uses,
  // resolved to this location's captive-portal config.
  const [redirectUrl, setRedirectUrl] = useState("");
  const [portalConfigId, setPortalConfigId] = useState<string | null>(null);
  const [redirectLoading, setRedirectLoading] = useState(false);
  const [savingRedirect, setSavingRedirect] = useState(false);

  // Manage Questions -- the only real way to configure what a SURVEY
  // campaign actually asks guests. Previously there was no click path to
  // this at all: the Recent Campaigns table had no per-row action for it,
  // so clicking a survey campaign did nothing.
  const [manageFor, setManageFor] = useState<Campaign | null>(null);
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
    campaignService
      .list({ locationId, page: 1, pageSize: 50 })
      .then((res) => {
        if (cancelled) return;
        setItems(
          res.rows.map((c) => ({
            id: c.id,
            name: c.name,
            type: c.campaignType.toUpperCase(),
            status: c.status,
            businessUnit: "",
            startDate: c.startsAt?.slice(0, 10) ?? "",
            endDate: c.endsAt?.slice(0, 10) ?? "",
            impressions: 0,
            conversions: 0,
          })),
        );
      })
      .catch(() => {
        if (!cancelled) setItems(DEMO_SEED);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [demo, locationId]);

  // Load this location's real captive-portal config so the redirect URL
  // field shows what's actually persisted, not a hardcoded placeholder.
  useEffect(() => {
    if (demo) {
      setRedirectUrl("https://wyfyguest.com/welcome");
      return;
    }
    if (!locationId) return;
    let cancelled = false;
    setRedirectLoading(true);
    (async () => {
      try {
        const orgId = await campaignService.getOrganizationId();
        const { items } = await portalService.list({
          organizationId: orgId,
          page: 1,
          pageSize: 100,
          sort: { key: "name", dir: "asc" },
        });
        const match = items.find((p) => p.locationId === locationId) ?? null;
        if (cancelled) return;
        setPortalConfigId(match?.id ?? null);
        setRedirectUrl(match?.login.redirectUrl ?? "");
      } catch {
        if (!cancelled) {
          setPortalConfigId(null);
          setRedirectUrl("");
        }
      } finally {
        if (!cancelled) setRedirectLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [demo, locationId]);

  const saveRedirectUrl = async () => {
    if (demo) {
      toast.success("Redirect URL saved");
      return;
    }
    if (!portalConfigId) {
      toast.error(
        "No captive portal is configured for this location yet — set one up in Portal Builder first.",
      );
      return;
    }
    setSavingRedirect(true);
    try {
      const orgId = await campaignService.getOrganizationId();
      await portalService.update(portalConfigId, { login: { redirectUrl } }, orgId);
      toast.success("Redirect URL saved");
    } catch {
      toast.error("Could not save the redirect URL — check the connection and try again.");
    } finally {
      setSavingRedirect(false);
    }
  };

  const openCreate = (type: string) => {
    setForm({ ...emptyForm, type });
    setErrs({});
    setShowCreate(true);
  };

  const handleCreate = async () => {
    const e: Record<string, string> = {};
    if (!form.name) e.name = "Campaign name is required.";
    if (!form.startDate) e.startDate = "Required.";
    if (!form.endDate) e.endDate = "Required.";
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
        startsAt: form.startDate ? new Date(form.startDate).toISOString() : null,
        endsAt: form.endDate ? new Date(form.endDate).toISOString() : null,
      });
      setItems([
        {
          id: created.id,
          name: created.name,
          type: created.campaignType.toUpperCase(),
          status: created.status,
          businessUnit: "",
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

  return (
    <div className="space-y-6">
      {/* Hero -- this page's whole job is reaching guests through the
       * network, the exact kind of "high-energy outreach" moment the dark
       * indigo/violet/fuchsia hero treatment (established on the Select
       * Location and Dashboard pages) fits naturally, unlike a purely
       * data-scanning page. */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1e1b4b] via-[#312e81] to-[#4c1d95] p-6 text-white shadow-xl shadow-indigo-950/30 sm:p-8">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-fuchsia-500/30 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-24 -left-10 h-72 w-72 rounded-full bg-cyan-400/20 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.15]"
          style={{
            backgroundImage: "radial-gradient(rgba(255,255,255,0.5) 1px, transparent 1px)",
            backgroundSize: "22px 22px",
          }}
        />
        <div className="relative grid items-center gap-6 md:grid-cols-[1fr_auto]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-white/60">
              Reach every guest who connects
            </p>
            <h2 className="font-display mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
              Campaign
            </h2>
            <p className="mt-1 max-w-md text-sm text-white/70">
              Reach, survey, and re-engage guests over your WiFi.
            </p>
            <div className="relative mt-5 flex flex-wrap items-center gap-2">
              {/* Popover instead of a hand-rolled absolutely-positioned div --
                  that version lived inside this hero's `overflow-hidden`
                  wrapper (needed to clip the decorative glow blobs), so once
                  the panel grew tall enough (adding the name-search field
                  below) it started getting clipped instead of fully showing.
                  A Radix Popover portals its content to the document body,
                  so it can never be clipped by an ancestor's overflow again. */}
              <Popover open={showSearch} onOpenChange={setShowSearch}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white"
                  >
                    <Search className="mr-2 h-4 w-4" />
                    Search Campaign
                    {filtersActive && (
                      <span className="ml-1.5 h-1.5 w-1.5 rounded-full bg-fuchsia-300" />
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  align="start"
                  className="w-80 rounded-2xl p-5 text-foreground shadow-xl"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold">Search Campaign</p>
                      <p className="text-xs text-muted-foreground">
                        Search, edit, activate or deactivate any campaign for any Business Unit.
                      </p>
                    </div>
                    <button
                      onClick={() => setShowSearch(false)}
                      className="rounded-lg p-1 text-muted-foreground hover:bg-accent"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="space-y-3">
                    {/* The button said "Search Campaign" but this panel only
                        ever had filter dropdowns, no actual text search --
                        clicking it and typing a campaign name did nothing. */}
                    <div>
                      <Label className="text-xs">Campaign name</Label>
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          autoFocus
                          placeholder="Search by name…"
                          value={filters.search}
                          onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
                          className="h-9 pl-8"
                        />
                      </div>
                    </div>
                    {/* UNITS is demo-only seed data -- real campaigns don't carry
                        a businessUnit (this page is already scoped to one
                        location via its own locationId prop), so this filter
                        would just never match anything for a real session. Same
                        demo-only gating as the create form's Business Unit field
                        below. */}
                    {demo && (
                      <div>
                        <Label className="text-xs">Business Unit</Label>
                        <Select
                          value={filters.businessUnit || "__all"}
                          onValueChange={(v) =>
                            setFilters((f) => ({ ...f, businessUnit: v === "__all" ? "" : v }))
                          }
                        >
                          <SelectTrigger className="h-9">
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
                      </div>
                    )}
                    <div>
                      <Label className="text-xs">Campaign Type</Label>
                      <Select
                        value={filters.type || "__all"}
                        onValueChange={(v) =>
                          setFilters((f) => ({ ...f, type: v === "__all" ? "" : v }))
                        }
                      >
                        <SelectTrigger className="h-9">
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
                    </div>
                    <div>
                      <Label className="text-xs">Campaign Start Date</Label>
                      <Input
                        type="date"
                        value={filters.startDate}
                        onChange={(e) => setFilters((f) => ({ ...f, startDate: e.target.value }))}
                        className="h-9"
                      />
                    </div>
                  </div>
                  <div className="mt-4 flex justify-end gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setFilters(emptyFilters)}>
                      Clear
                    </Button>
                    <Button size="sm" onClick={() => setShowSearch(false)}>
                      Apply
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
              <Button
                className="bg-white text-[#1e1b4b] hover:bg-white/90"
                onClick={() => openCreate("SURVEY")}
              >
                <Plus className="mr-2 h-4 w-4" />
                Create Campaign
              </Button>
            </div>
          </div>
          <div className="hidden justify-self-end opacity-95 md:block">
            <CampaignReachIllustration />
          </div>
        </div>
      </div>

      {/* Types of Campaign */}
      <div>
        <div className="mb-4 flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-[#4f46e5] to-[#a78bfa]">
            <Sparkles className="h-3.5 w-3.5 text-white" />
          </span>
          <h3 className="text-base font-semibold tracking-tight">Types of Campaign</h3>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">
          Leverage WiFi as a communication platform. Run different types of campaigns &amp; promote
          your intentions internally &amp; externally.
        </p>

        <div className="grid gap-4 lg:grid-cols-2">
          {/* Survey & Feedback */}
          <Card className="overflow-hidden border-0 shadow-sm">
            <CardHeader className="flex-row items-center gap-2.5 space-y-0 pb-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#4f46e5] to-[#a78bfa] text-white shadow-sm shadow-indigo-500/20">
                <MessageSquareText className="h-4.5 w-4.5" />
              </span>
              <CardTitle className="text-sm">Survey &amp; Feedback</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl border bg-muted/30 p-4 space-y-3">
                {SURVEY_QUESTIONS.map((s, i) => (
                  <div key={s.q} className={i > 0 ? "border-t pt-3" : ""}>
                    <p className="mb-2 text-xs font-medium">
                      {i + 1}. {s.q}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {s.options.map((o) => (
                        <span
                          key={o}
                          className="inline-flex items-center gap-1 rounded-full border bg-card px-2.5 py-1 text-[11px] text-muted-foreground"
                        >
                          <Star className="h-3 w-3 text-amber-400" />
                          {o}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div>
                <p className="text-sm font-semibold">Feedback Made Easy</p>
                <p className="text-xs text-muted-foreground">
                  Collect real-time feedback from your users to improve your business &amp; user
                  satisfaction.
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={() => openCreate("SURVEY")}>
                <ClipboardList className="mr-2 h-4 w-4" />
                Create Survey Campaign
              </Button>
            </CardContent>
          </Card>

          {/* Banner & Discounts */}
          <Card className="overflow-hidden border-0 shadow-sm">
            <CardHeader className="flex-row items-center gap-2.5 space-y-0 pb-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#4f46e5] to-[#a78bfa] text-white shadow-sm shadow-indigo-500/20">
                <ImageIcon className="h-4.5 w-4.5" />
              </span>
              <CardTitle className="text-sm">Banner &amp; Discounts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="overflow-hidden rounded-xl border bg-gradient-to-br from-primary/15 to-primary/5">
                <div className="flex items-center justify-between p-4">
                  <div>
                    <Badge className="mb-2 gap-1" variant="secondary">
                      <Percent className="h-3 w-3" />
                      fb campaign
                    </Badge>
                    <p className="text-sm font-semibold">Flat 20% off this weekend</p>
                    <p className="text-xs text-muted-foreground">Show this coupon at checkout</p>
                  </div>
                  <div className="rounded-lg border bg-card px-3 py-2 text-center">
                    <p className="font-mono text-sm font-bold text-primary">SAVE20</p>
                  </div>
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold">More Business With Discounts</p>
                <p className="text-xs text-muted-foreground">
                  Pull more business from your users leveraging discount coupons delivered to their
                  Mobile Phones.
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={() => openCreate("BANNER")}>
                <ImageIcon className="mr-2 h-4 w-4" />
                Create Banner Campaign
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Post-Login Redirect URL */}
      <Card className="border-0 shadow-sm">
        <CardContent className="flex flex-wrap items-end gap-3 p-5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#4f46e5] to-[#a78bfa] text-white shadow-sm shadow-indigo-500/20">
            <Link2 className="h-4.5 w-4.5" />
          </span>
          <div className="flex-1 min-w-[220px]">
            <Label className="text-xs">Post-Login Redirect URL</Label>
            <p className="mb-1.5 text-xs text-muted-foreground">
              Where guests land right after they connect.
            </p>
            <Input
              value={redirectUrl}
              onChange={(e) => setRedirectUrl(e.target.value)}
              className="h-9"
              disabled={redirectLoading}
              placeholder={redirectLoading ? "Loading…" : "https://example.com/welcome"}
            />
          </div>
          <Button size="sm" onClick={saveRedirectUrl} disabled={savingRedirect || redirectLoading}>
            {savingRedirect ? "Saving…" : "Save"}
          </Button>
        </CardContent>
      </Card>

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
            <p className="mb-4 text-xs text-muted-foreground">
              This helps you to create different types of campaigns.
            </p>
            <div className="space-y-3">
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
                  <Label>
                    Campaign Start Date <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                  />
                  {errs.startDate && (
                    <p className="mt-1 text-xs text-destructive">{errs.startDate}</p>
                  )}
                </div>
                <div>
                  <Label>
                    Campaign End Date <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    type="date"
                    value={form.endDate}
                    onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                  />
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

      {/* Recent Campaigns */}
      <div>
        <h3 className="mb-1 text-base font-semibold tracking-tight">Recent Campaigns</h3>
        <p className="mb-3 text-xs text-muted-foreground">
          This lists out all the recent communication campaigns you had setup.
        </p>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-0">
            {loading ? (
              <div className="p-4">
                <LoadingSkeleton rows={4} />
              </div>
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
                      <TableCell>{c.impressions.toLocaleString()}</TableCell>
                      <TableCell>{c.conversions}</TableCell>
                      <TableCell className="text-right">
                        {c.type === "SURVEY" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Manage questions"
                            onClick={() => openManage(c)}
                          >
                            <ListChecks className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Preview as a guest"
                          onClick={() => openPreview(c)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {(() => {
                          const action = nextPlayAction(c.status);
                          return (
                            <Button
                              variant="ghost"
                              size="icon"
                              title={action?.label ?? "No further status change"}
                              disabled={!action}
                              onClick={() => action && updateStatus(c.id, action.target)}
                            >
                              {action?.icon === "pause" ? (
                                <Pause className="h-4 w-4" />
                              ) : (
                                <Play className="h-4 w-4" />
                              )}
                            </Button>
                          );
                        })()}
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
