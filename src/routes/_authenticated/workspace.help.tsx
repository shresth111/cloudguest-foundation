import { createFileRoute } from "@tanstack/react-router";
import { ArrowUpRight, LifeBuoy, Mail, MessageCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useWorkspace } from "@/context/WorkspaceContext";

export const Route = createFileRoute("/_authenticated/workspace/help")({
  component: HelpPage,
});

const SUPPORT_EMAIL = "support@wyfyguest.com";

function HelpPage() {
  const { customer, activeLocation } = useWorkspace();

  // Prefill the subject and body so a venue owner doesn't have to work out
  // which organization and location they're writing about.
  const context = [
    customer?.organizationName ? `Organization: ${customer.organizationName}` : null,
    activeLocation?.name ? `Location: ${activeLocation.name}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const mailto = (subject: string) =>
    `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}` +
    (context ? `&body=${encodeURIComponent(`${context}\n\n`)}` : "");

  const items: { icon: typeof Mail; title: string; desc: string; href: string }[] = [
    {
      icon: MessageCircle,
      title: "Ask a question",
      desc: `Email the Wyfy Guest team at ${SUPPORT_EMAIL}.`,
      href: mailto("Wyfy Guest — question"),
    },
    {
      icon: LifeBuoy,
      title: "Report a problem",
      desc: "Something not working? Tell us what you were doing and what happened.",
      href: mailto("Wyfy Guest — problem report"),
    },
  ];

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">Help</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        The Wyfy Guest team handles router provisioning and setup for you. For anything else, get in
        touch.
      </p>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {items.map((i) => (
          <Card key={i.title} className="transition-shadow hover:shadow-md">
            <CardContent className="p-0">
              <a
                href={i.href}
                className="flex items-start gap-4 rounded-lg p-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="rounded-lg bg-primary/10 p-2 text-primary">
                  <i.icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1 text-base font-semibold">
                    {i.title}
                    <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
                  </p>
                  <p className="text-sm text-muted-foreground">{i.desc}</p>
                </div>
              </a>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
