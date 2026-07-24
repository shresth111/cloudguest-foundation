import { useEffect, useRef, useState } from "react";
import { Bot, Loader2, MessageCircle, Send, User, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useIsDemo } from "@/hooks/useCustomerDashboard";
import { assistantService } from "@/services/assistant.service";
import type { AssistantMessage } from "@/types/assistant";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

/**
 * Floating customer-support chat widget -- bottom-right button that
 * expands into a chat panel. Dual demo/real mode via useIsDemo(), the
 * exact same hook TicketsPage/CampaignsPage use this session:
 *
 * - Demo mode: a purely client-side, keyword-based canned-response
 *   simulation (same topical flavor as the backend's
 *   LoggingAssistantProvider, for visual consistency) so the demo
 *   experience never depends on a live backend.
 * - Real mode: calls the real assistant.service.ts endpoints. On open,
 *   resumes the caller's most recent conversation (if any) so a page
 *   reload doesn't lose history -- proof the thread is DB-backed, not
 *   just component state.
 */

interface DisplayMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const DEMO_WELCOME =
  "Hi! I'm the ZIP WiFi assistant. Ask me about WiFi connectivity, billing, or vouchers -- or anything else on your mind.";

const DEMO_WIFI_KEYWORDS = ["wifi", "wi-fi", "password", "connect", "internet", "network", "login"];
const DEMO_BILLING_KEYWORDS = ["bill", "invoice", "payment", "charge", "subscription", "refund"];
const DEMO_VOUCHER_KEYWORDS = ["voucher", "redeem", "redemption"];

const DEMO_VOUCHER_REPLY =
  "Vouchers are redeemed from the guest WiFi login page -- enter the code exactly as printed (it's case-sensitive) and tap Connect. A code that's already used or expired can't be reused; ask reception to issue a new one from the Vouchers section.";
const DEMO_BILLING_REPLY =
  "For billing questions, check the Billing section of your dashboard for your invoice history and subscription status. Still looks wrong? I've noted this conversation for our support team, or you can raise a support ticket for a tracked response.";
const DEMO_WIFI_REPLY =
  "For WiFi trouble: double-check the network name and password (case-sensitive), then try forgetting the network on your device and reconnecting. Still stuck? I've noted this for our support team, or raise a support ticket directly.";
const DEMO_DEFAULT_REPLY =
  "Thanks for reaching out -- I've noted this conversation so our support team can follow up. You can also raise a formal support ticket from your dashboard for a tracked response.";

function demoReply(message: string): string {
  const lowered = message.toLowerCase();
  if (DEMO_VOUCHER_KEYWORDS.some((k) => lowered.includes(k))) return DEMO_VOUCHER_REPLY;
  if (DEMO_BILLING_KEYWORDS.some((k) => lowered.includes(k))) return DEMO_BILLING_REPLY;
  if (DEMO_WIFI_KEYWORDS.some((k) => lowered.includes(k))) return DEMO_WIFI_REPLY;
  return DEMO_DEFAULT_REPLY;
}

function toDisplay(messages: AssistantMessage[]): DisplayMessage[] {
  return messages.map((m) => ({ id: m.id, role: m.role, content: m.content }));
}

export default function AssistantWidget() {
  const demo = useIsDemo();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to the latest message.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, sending, open]);

  // On first open, seed demo welcome message or resume the caller's most
  // recent real conversation (proves persistence across a page reload).
  useEffect(() => {
    if (!open || initialized) return;
    setInitialized(true);
    if (demo) {
      setMessages([{ id: "welcome", role: "assistant", content: DEMO_WELCOME }]);
      return;
    }
    void (async () => {
      try {
        const conversations = await assistantService.listConversations();
        const latest = conversations[0];
        if (latest) {
          setConversationId(latest.id);
          const history = await assistantService.listMessages(latest.id);
          setMessages(toDisplay(history));
        }
      } catch {
        // No existing conversation, or a transient fetch failure -- either
        // way the widget still works: the first send just starts a new one.
      }
    })();
  }, [open, initialized, demo]);

  async function handleSend() {
    const content = input.trim();
    if (!content || sending) return;
    setInput("");

    if (demo) {
      const userMsg: DisplayMessage = { id: `u-${Date.now()}`, role: "user", content };
      setMessages((prev) => [...prev, userMsg]);
      setSending(true);
      window.setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          { id: `a-${Date.now()}`, role: "assistant", content: demoReply(content) },
        ]);
        setSending(false);
      }, 500);
      return;
    }

    setMessages((prev) => [...prev, { id: `pending-${Date.now()}`, role: "user", content }]);
    setSending(true);
    try {
      if (!conversationId) {
        const { conversation } = await assistantService.startConversation(content);
        setConversationId(conversation.id);
        const history = await assistantService.listMessages(conversation.id);
        setMessages(toDisplay(history));
      } else {
        await assistantService.sendMessage(conversationId, content);
        const history = await assistantService.listMessages(conversationId);
        setMessages(toDisplay(history));
      }
    } catch {
      toast.error("Couldn't reach the assistant -- please try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      {open && (
        <Card className="fixed bottom-24 right-6 z-50 flex h-[30rem] w-[22rem] flex-col overflow-hidden rounded-2xl border shadow-2xl sm:w-96">
          <div className="flex shrink-0 items-center justify-between gap-2 border-b bg-primary/5 px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Bot className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-semibold leading-tight">Support Assistant</p>
                <p className="text-[11px] text-muted-foreground leading-tight">
                  {demo ? "Demo mode" : "We usually reply instantly"}
                </p>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3">
            <div className="space-y-3">
              {messages.length === 0 && !sending && (
                <p className="px-2 py-8 text-center text-xs text-muted-foreground">
                  Ask about WiFi connectivity, billing, or vouchers to get started.
                </p>
              )}
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={cn("flex items-end gap-2", m.role === "user" ? "flex-row-reverse" : "flex-row")}
                >
                  <div
                    className={cn(
                      "flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
                      m.role === "user" ? "bg-muted text-foreground" : "bg-primary text-primary-foreground",
                    )}
                  >
                    {m.role === "user" ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
                  </div>
                  <div
                    className={cn(
                      "max-w-[75%] rounded-2xl px-3 py-2 text-sm leading-relaxed",
                      m.role === "user"
                        ? "rounded-br-sm bg-primary text-primary-foreground"
                        : "rounded-bl-sm bg-muted text-foreground",
                    )}
                  >
                    {m.content}
                  </div>
                </div>
              ))}
              {sending && (
                <div className="flex items-end gap-2">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Bot className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-sm bg-muted px-3 py-2.5">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Thinking…</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2 border-t p-3">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void handleSend();
                }
              }}
              placeholder="Type a message…"
              disabled={sending}
              className="h-9 text-sm"
            />
            <Button size="icon" className="h-9 w-9 shrink-0" onClick={() => void handleSend()} disabled={sending || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </Card>
      )}

      <Button
        onClick={() => setOpen((o) => !o)}
        size="icon"
        className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-2xl"
        aria-label={open ? "Close support chat" : "Open support chat"}
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </Button>
    </>
  );
}
