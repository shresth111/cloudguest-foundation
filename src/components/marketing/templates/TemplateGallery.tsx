import { useState } from "react";
import {
  CheckCircle2,
  Copy,
  Eye,
  FileText,
  Pencil,
  Plus,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { CardGridSkeleton } from "@/components/common/LoadingSkeleton";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import {
  useDeleteTemplate,
  useDuplicateTemplate,
  useMarketingTemplates,
} from "@/hooks/useMarketing";
import {
  MARKETING_CHANNELS,
  TEMPLATE_CATEGORIES,
  type MarketingChannel,
  type MarketingStatus,
  type MarketingTemplate,
} from "@/types/marketing";
import {
  CHANNEL_ICON,
  SENDABLE_REASON_LABEL,
  marketingErrorMessage,
  useChannelLabel,
  useMarketingCan,
} from "../marketing-helpers";
import { TemplateEditorDialog } from "./TemplateEditorDialog";
import { TemplateViewDialog } from "./TemplateViewDialog";
import { SendableChips } from "./template-bits";
import { categoryLabel } from "../marketing-helpers";
import { SmsSize } from "./SmsCounter";

/**
 * Templates tab (spec §8.1 TemplateGallery): the 10 Wyfy templates
 * (read-only, duplicable) and the organisation's own custom ones.
 */
export function TemplateGallery({ status }: { status: MarketingStatus }) {
  const can = useMarketingCan();
  const label = useChannelLabel();
  const [channel, setChannel] = useState<"all" | MarketingChannel>("all");
  const [category, setCategory] = useState<string>("all");
  const list = useMarketingTemplates({
    channel: channel === "all" ? undefined : channel,
    category: category === "all" ? undefined : category,
    include_system: true,
    page: 1,
    page_size: 100,
  });

  const [editing, setEditing] = useState<MarketingTemplate | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [viewing, setViewing] = useState<MarketingTemplate | null>(null);
  const [dupOf, setDupOf] = useState<MarketingTemplate | null>(null);
  const [dupName, setDupName] = useState("");
  const [deleting, setDeleting] = useState<MarketingTemplate | null>(null);
  const duplicate = useDuplicateTemplate();
  const remove = useDeleteTemplate();

  const items = list.data?.items ?? [];
  const system = items.filter((t) => t.is_system);
  const custom = items.filter((t) => !t.is_system);
  // The editor opens on the list's CURRENT copy of the template, not the
  // snapshot taken when Edit was clicked -- a stale snapshot carries a stale
  // version and walks straight into a 409 version_conflict.
  const editingLive = editing ? (items.find((t) => t.id === editing.id) ?? editing) : null;

  const openDuplicate = (t: MarketingTemplate) => {
    setDupOf(t);
    setDupName(`${t.name} (copy)`.slice(0, 120));
  };

  const doDuplicate = async () => {
    if (!dupOf) return;
    try {
      const created = await duplicate.mutateAsync({ id: dupOf.id, name: dupName.trim() });
      toast.success(`Created “${created.name}”`);
      setDupOf(null);
      if (dupOf.whatsapp) {
        toast.info("The WhatsApp version wasn't copied: a copy isn't approved by Meta.");
      }
      if (can("update")) {
        setEditing(created);
        setEditorOpen(true);
      }
    } catch (err) {
      toast.error(marketingErrorMessage(err, "Couldn't duplicate the template."));
    }
  };

  const doDelete = async () => {
    if (!deleting) return;
    const t = deleting;
    try {
      await remove.mutateAsync(t.id);
      toast.success(`Deleted “${t.name}”`);
    } catch (err) {
      toast.error(marketingErrorMessage(err, "Couldn't delete the template."));
    } finally {
      setDeleting(null);
    }
  };

  const card = (t: MarketingTemplate) => (
    <Card key={t.id} className="premium-card flex flex-col">
      <CardContent className="flex flex-1 flex-col gap-3 p-4">
        <div className="min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="font-semibold leading-snug">{t.name}</p>
            <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              {categoryLabel(t.category)}
            </span>
          </div>
          {t.description && (
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{t.description}</p>
          )}
          {t.sms && (
            <p className="mt-1 text-[11px] text-muted-foreground">
              <SmsSize sms={t.sms} />
            </p>
          )}
        </div>
        <SendableChips template={t} />
        <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
          <Button size="sm" variant="outline" onClick={() => setViewing(t)}>
            <Eye className="h-3.5 w-3.5" /> View
          </Button>
          {can("create") && (
            <Button size="sm" variant="outline" onClick={() => openDuplicate(t)}>
              <Copy className="h-3.5 w-3.5" /> Duplicate
            </Button>
          )}
          {!t.is_system && can("update") && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setEditing(t);
                setEditorOpen(true);
              }}
            >
              <Pencil className="h-3.5 w-3.5" /> Edit
            </Button>
          )}
          {!t.is_system && can("delete") && (
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive"
              onClick={() => setDeleting(t)}
              aria-label={`Delete ${t.name}`}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Select value={channel} onValueChange={(v) => setChannel(v as typeof channel)}>
            <SelectTrigger className="w-40" aria-label="Channel">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All channels</SelectItem>
              {MARKETING_CHANNELS.map((c) => (
                <SelectItem key={c} value={c}>
                  {label(c)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-40" aria-label="Category">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {TEMPLATE_CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {categoryLabel(c)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {can("create") && (
          <Button
            onClick={() => {
              setEditing(null);
              setEditorOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> New template
          </Button>
        )}
      </div>

      {list.isLoading ? (
        <CardGridSkeleton count={6} />
      ) : list.isError ? (
        <ErrorState
          title="Couldn't load templates"
          description={marketingErrorMessage(list.error)}
          onRetry={() => void list.refetch()}
        />
      ) : (
        <>
          <section className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold">Wyfy templates</h3>
              <p className="text-xs text-muted-foreground">
                Ready-made and read-only. Duplicate one to change its wording.
              </p>
            </div>
            {system.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="No Wyfy templates match these filters"
                description="Try another channel or category."
              />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{system.map(card)}</div>
            )}
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold">Your templates</h3>
            {custom.length === 0 ? (
              <EmptyState
                icon={Copy}
                title="No templates of your own yet"
                description="Duplicate a Wyfy template above to adapt its wording, or write one from scratch."
                action={
                  can("create")
                    ? {
                        label: "Write a template",
                        onClick: () => {
                          setEditing(null);
                          setEditorOpen(true);
                        },
                      }
                    : undefined
                }
              />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{custom.map(card)}</div>
            )}
          </section>
        </>
      )}

      <TemplateEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        template={editingLive}
        status={status}
      />
      <TemplateViewDialog
        template={viewing}
        onOpenChange={(o) => !o && setViewing(null)}
        onDuplicate={
          can("create")
            ? (t) => {
                setViewing(null);
                openDuplicate(t);
              }
            : undefined
        }
      />

      <Dialog open={!!dupOf} onOpenChange={(o) => !o && !duplicate.isPending && setDupOf(null)}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-md">
          <DialogHeader>
            <DialogTitle>Duplicate template</DialogTitle>
            <DialogDescription>
              The copy is yours to edit. SMS and email text are copied
              {dupOf?.whatsapp
                ? "; the WhatsApp version isn't, because a copy isn't Meta-approved"
                : ""}
              .
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="dup-name">Name</Label>
            <Input
              id="dup-name"
              value={dupName}
              maxLength={120}
              onChange={(e) => setDupName(e.target.value)}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDupOf(null)} disabled={duplicate.isPending}>
              Cancel
            </Button>
            <Button onClick={doDuplicate} disabled={duplicate.isPending || !dupName.trim()}>
              {duplicate.isPending ? "Duplicating…" : "Duplicate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete “${deleting?.name ?? ""}”?`}
        description="Campaigns already sent keep their copy of the text. A template used by a scheduled or sending campaign can't be deleted."
        confirmLabel="Delete"
        destructive
        onConfirm={() => void doDelete()}
      />
    </div>
  );
}
