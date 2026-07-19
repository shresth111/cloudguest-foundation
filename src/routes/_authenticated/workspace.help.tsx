import { createFileRoute } from "@tanstack/react-router";
import { BookOpen, LifeBuoy, MessageCircle, Video } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/workspace/help")({
  component: HelpPage,
});

const items = [
  { icon: BookOpen, title: "Documentation", desc: "Guides, API reference, playbooks." },
  { icon: Video, title: "Video tutorials", desc: "Watch quick walkthroughs of every module." },
  { icon: MessageCircle, title: "Chat with support", desc: "Reach the CloudGuest team 24/7." },
  { icon: LifeBuoy, title: "Submit a ticket", desc: "Track and resolve technical issues." },
];

function HelpPage() {
  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold tracking-tight">Help center</h1>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {items.map((i) => (
          <Card key={i.title} className="transition-shadow hover:shadow-md">
            <CardContent className="flex items-start gap-4 p-5">
              <div className="rounded-lg bg-primary/10 p-2 text-primary">
                <i.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-base font-semibold">{i.title}</p>
                <p className="text-sm text-muted-foreground">{i.desc}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
