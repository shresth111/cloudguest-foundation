import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  BookOpen, Code2, FileText, HelpCircle, LifeBuoy, MessageCircle, Newspaper, PlayCircle,
  Search, Sparkles, Ticket,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/system/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageSkeleton } from "@/components/common/LoadingSkeleton";
import { ErrorState } from "@/components/common/ErrorState";
import { useHelp } from "@/hooks/useSystem";

export const Route = createFileRoute("/_authenticated/help/")({
  component: HelpPage,
});

const CATEGORY_ICON = {
  docs: BookOpen,
  video: PlayCircle,
  kb: FileText,
  faq: HelpCircle,
  release: Newspaper,
  api: Code2,
} as const;

const QUICK = [
  { icon: LifeBuoy, title: "Support tickets", desc: "Open and track cases.", cta: "Open ticket" },
  { icon: MessageCircle, title: "Live chat", desc: "Chat with an engineer, 24/7.", cta: "Start chat" },
  { icon: Ticket, title: "Contact support", desc: "Escalations & billing.", cta: "Email us" },
];

function HelpPage() {
  const q = useHelp();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => (q.data ?? []).filter((a) => !search || `${a.title} ${a.summary}`.toLowerCase().includes(search.toLowerCase())), [q.data, search]);

  if (q.isLoading) return <PageSkeleton />;
  if (q.isError) return <ErrorState onRetry={() => q.refetch()} />;

  return (
    <div className="space-y-6">
      <PageHeader title="Help center" description="Documentation, tutorials, and support — all in one place." />

      <Card className="overflow-hidden">
        <CardContent className="flex flex-col gap-4 bg-gradient-to-br from-primary/10 via-background to-background p-8">
          <div className="flex items-center gap-2 text-primary">
            <Sparkles className="h-4 w-4" /> How can we help?
          </div>
          <div className="relative max-w-2xl">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search articles, videos, and FAQs…" className="h-12 pl-9 text-base" />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        {QUICK.map((q) => {
          const Icon = q.icon;
          return (
            <Card key={q.title}>
              <CardContent className="pt-6">
                <div className="mb-3 grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <p className="font-medium">{q.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{q.desc}</p>
                <Button variant="outline" size="sm" className="mt-4" onClick={() => toast.success(`${q.cta} coming up`)}>{q.cta}</Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Popular articles</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {filtered.map((a) => {
            const Icon = CATEGORY_ICON[a.category];
            return (
              <button key={a.id} className="rounded-lg border border-border p-4 text-left transition-colors hover:bg-accent" onClick={() => toast.info(a.title)}>
                <div className="flex items-start gap-3">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-muted text-foreground">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{a.title}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">{a.summary}</p>
                    <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="outline" className="uppercase">{a.category}</Badge>
                      <span>Updated {new Date(a.updatedAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
