import type { ComponentType } from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Card, CardContent } from "@/components/ui/card";
import {
  OverviewIllustration,
  EngagementIllustration,
  AccessPolicyIllustration,
  DevicesTeamIllustration,
  NetworkIllustration,
  HowItWorksHeroIllustration,
} from "@/components/customer/HowItWorksIllustrations";

interface HowItWorksItem {
  /** Matches the real sidebar label exactly (see customerNav.ts) so a
   * customer can map this straight onto what they see in their own
   * sidebar. */
  heading: string;
  copy: string;
}

interface HowItWorksGroup {
  id: string;
  label: string;
  line: string;
  Icon: ComponentType<{ className?: string }>;
  items: HowItWorksItem[];
}

const GROUPS: HowItWorksGroup[] = [
  {
    id: "overview",
    label: "Overview",
    line: "A quick, real-time read on how your guest WiFi is doing right now.",
    Icon: OverviewIllustration,
    items: [
      {
        heading: "Dashboard",
        copy: "Your home screen the moment you sign in. It shows how many guests are online right now, whether your internet connection is healthy, how much of your bandwidth is being used, and a rolling look at guest activity over the last 24 hours — plus anything that needs your attention, like hardware that's gone offline. Check it here first before a guest has to tell you something's down.",
      },
      {
        heading: "Users",
        copy: "The live list of every guest connected to your network. Search by name, filter by online or offline, and open any guest to see their phone number, device, how long they've been connected, and how much data they've used. If someone needs to be kicked off, you can disconnect them on the spot — it ends their session and clears them from the router, not just your records.",
      },
    ],
  },
  {
    id: "engagement",
    label: "Engagement",
    line: "Reach the people connected to your WiFi — surveys, offers, and a branded welcome.",
    Icon: EngagementIllustration,
    items: [
      {
        heading: "Campaigns",
        copy: "Run two kinds of outreach to guests as they connect: quick surveys and feedback forms, or banners with discounts and promotions. You can also set the Post-Login Redirect URL — the page guests land on right after they sign in — so their first moment on your WiFi points wherever you want (your menu, a booking page, your website).",
      },
      {
        heading: "Portal",
        copy: "Design exactly what a guest sees on the sign-in screen: the headline and welcome message, your brand color and logo, the overall look and font, which languages to offer, and which sign-in methods are available (OTP by mobile, email, or WhatsApp, a voucher code, or social login). Changes show up in a live preview instantly, so you can see exactly what a guest will see before you save.",
      },
      {
        heading: "Vouchers",
        copy: "Generate batches of one-time or limited-use access codes guests can redeem instead of signing in the usual way — set how many codes, how long they're valid, and any data limit per code. Once a batch is ready, export it as a CSV, download a printable PDF, or email it straight to someone (handy for reception desks or events).",
      },
    ],
  },
  {
    id: "access-policy",
    label: "Access & Policy",
    line: "Control who can connect, how much bandwidth they get, and when WiFi is available.",
    Icon: AccessPolicyIllustration,
    items: [
      {
        heading: "Access Rules",
        copy: "Set the limits every guest connects under: maximum speed per device, how many devices one guest can use at once, how long before they're asked to sign in again (session timeout), how long an inactive connection is cut off (idle timeout), and a cap on total connected time per day. This is also where you manage blocked guests, choose which sign-in methods are offered, and set up access tiers — different limit packages you can assign different guests to.",
      },
      {
        heading: "Always Allowed",
        copy: "A short list of phone numbers or devices that skip the sign-in screen entirely and connect automatically — useful for regulars, staff, or anyone you don't want to make sign in every time. Each entry can be given a start and end date, so the bypass can be temporary rather than forever.",
      },
      {
        heading: "Trusted Devices",
        copy: "Similar idea, but by device instead of by person: authorize specific hardware (by its MAC address — the device's built-in serial number) to connect without ever hitting the sign-in screen. Good for things like a front-desk tablet, a POS terminal, or an office printer. You can mark an entry as permanent or set it to expire.",
      },
      {
        heading: "Open Hours",
        copy: "Set a weekly schedule for when guests are allowed to sign in to your WiFi — pick the days and hours it's open, and write a message guests see if they try to connect while you're closed. An “Enforce” toggle turns the whole schedule on or off, and the page shows you a live “Open now / Closed now” status.",
      },
      {
        heading: "Background Image",
        copy: "Upload a custom background image to appear behind the sign-in screen guests see when they first connect — a simple way to make that first impression feel fully branded to your venue instead of generic.",
      },
    ],
  },
  {
    id: "devices-team",
    label: "Devices & Team",
    line: "Keep track of your hardware and shared accounts, and control what your staff can do.",
    Icon: DevicesTeamIllustration,
    items: [
      {
        heading: "Devices",
        copy: "Two things in one place: register your own network hardware — access points, printers, routers, cameras — by MAC address and which floor it's on, so you can see at a glance if anything's gone offline; and see the live list of every device currently connected to your guest network, with its IP address, device type, and when it was last seen.",
      },
      {
        heading: "Guest Groups",
        copy: "Set up shared team or desk accounts — think a coworking desk, a meeting room, or a shared office — with one login and a pooled data allowance that everyone using that account draws from together, instead of tracking each person individually.",
      },
      {
        heading: "Staff Access",
        copy: "Create roles with specific permissions, then add your own team members — name, email, mobile number — and assign each one a role. This is what controls which parts of the dashboard each of your staff can see and change, so you can hand off day-to-day management without handing over everything.",
      },
    ],
  },
  {
    id: "network",
    label: "Network",
    line: "The plumbing behind your guest WiFi — addresses, separation, forwarding, and call quality.",
    Icon: NetworkIllustration,
    items: [
      {
        heading: "IP Addresses",
        copy: "The pool of addresses your router automatically hands out to each guest device when it connects, along with the gateway and DNS settings and how long a device holds onto its address before it's freed up for someone else. You generally won't need to touch this unless you're troubleshooting a connectivity issue.",
      },
      {
        heading: "Network Zones",
        copy: "Split your network into separate zones — most commonly, keeping guest WiFi completely walled off from your staff or office devices — each with its own private address range. This keeps guest traffic from ever mixing with the equipment and systems you use to run your business.",
      },
      {
        heading: "Port Forwarding",
        copy: "Lets a specific device on your network — a camera system, a booking kiosk, an internal tool — be reached from the outside internet, by forwarding one specific incoming connection to that device. This is an advanced, occasional-use setting; most venues will never need it.",
      },
      {
        heading: "Call Priority",
        copy: "Gives voice and video calls priority over regular browsing traffic, so a guest's call stays clear even when the network is busy with everyone else's streaming, downloads, and browsing.",
      },
    ],
  },
];

/**
 * The customer-facing "How the dashboard works" help page -- a static,
 * always-available reference walking through what every sidebar group and
 * item does, in the copy's own words (see customerNav.ts's group ids/order,
 * which this deliberately mirrors 1:1 so the mapping to a customer's real
 * sidebar is obvious). Rendered as the `how-it-works` case in
 * CustomerFeaturePage.tsx, reachable from the sidebar's Support & Logs
 * group.
 */
export function HowItWorksView() {
  return (
    <div className="space-y-8">
      {/* Hero band -- same 3-stop indigo/violet gradient panel as the
       * Dashboard hero (see CustomerFeaturePage.tsx's DashboardView), with
       * the content writer's intro blurb and the illustrator's orbiting
       * hero graphic instead of live KPI numbers, since this page has none
       * of its own to show. */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1e1b4b] via-[#312e81] to-[#4c1d95] p-5 text-white shadow-xl shadow-indigo-950/30 sm:p-6">
        <div className="relative">
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-white/60">Help</p>
          <h1 className="font-display mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
            How the dashboard works
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/70">
            Welcome to your dashboard. Everything you need to run your guest WiFi lives here —
            from checking who's online right now to deciding exactly who gets to connect. This
            page walks through what each section does, so you can find your way around without
            any networking background.
          </p>
        </div>
        <div className="relative mt-5">
          <HowItWorksHeroIllustration />
        </div>
      </div>

      {/* One accordion section per sidebar group, each opened by default so
       * the page is fully scannable/searchable (Cmd+F) without extra
       * clicks, but still collapsible for anyone who wants to focus on one
       * section at a time. */}
      <Accordion type="multiple" defaultValue={GROUPS.map((g) => g.id)} className="space-y-4">
        {GROUPS.map((group) => (
          <AccordionItem
            key={group.id}
            value={group.id}
            className="premium-card overflow-hidden rounded-2xl border px-4 sm:px-6"
          >
            <AccordionTrigger className="py-4 hover:no-underline sm:py-5">
              <div className="flex items-center gap-4 text-left">
                <group.Icon className="h-11 w-11 shrink-0 sm:h-12 sm:w-12" />
                <div>
                  <p className="text-base font-semibold tracking-tight text-foreground">{group.label}</p>
                  <p className="mt-0.5 text-sm font-normal text-muted-foreground">{group.line}</p>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="grid gap-3 pb-2 sm:grid-cols-2">
                {group.items.map((item) => (
                  <Card key={item.heading} className="premium-card premium-card-hover rounded-2xl">
                    <CardContent className="p-4 sm:p-5">
                      <p className="text-sm font-semibold text-foreground">{item.heading}</p>
                      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{item.copy}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
