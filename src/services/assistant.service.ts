import { api } from "@/services/api";
import type { AssistantConversation, AssistantMessage } from "@/types/assistant";

interface BackendMessage {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

interface BackendConversation {
  id: string;
  organization_id: string;
  user_id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
}

interface BackendConversationStartResponse {
  conversation: BackendConversation;
  assistant_message: BackendMessage | null;
}

interface BackendConversationListResponse {
  items: BackendConversation[];
  page: number;
  page_size: number;
  total_items: number;
  total_pages: number;
  has_next: boolean;
  has_previous: boolean;
}

interface BackendMessageListResponse {
  items: BackendMessage[];
}

function toMessage(m: BackendMessage): AssistantMessage {
  return {
    id: m.id,
    conversationId: m.conversation_id,
    role: m.role,
    content: m.content,
    createdAt: m.created_at,
  };
}

function toConversation(c: BackendConversation): AssistantConversation {
  return {
    id: c.id,
    organizationId: c.organization_id,
    userId: c.user_id,
    title: c.title,
    createdAt: c.created_at,
    updatedAt: c.updated_at,
  };
}

let cachedOrgId: string | null = null;
async function resolveOrgId(): Promise<string> {
  if (cachedOrgId) return cachedOrgId;
  const { data } = await api.get<{ items: Array<{ id: string }> }>("/organizations", { params: { page_size: 1 } });
  const id = data.items[0]?.id;
  if (!id) throw new Error("No organization found for the current session");
  cachedOrgId = id;
  return id;
}

export const assistantService = {
  /** Starts a new conversation, optionally with an initial message -- the
   * assistant's reply (if any) comes back in the same response. */
  async startConversation(initialMessage?: string): Promise<{
    conversation: AssistantConversation;
    assistantMessage: AssistantMessage | null;
  }> {
    const orgId = await resolveOrgId();
    const { data } = await api.post<BackendConversationStartResponse>(
      "/assistant/conversations",
      { initial_message: initialMessage },
      { headers: { "X-Organization-Id": orgId } },
    );
    return {
      conversation: toConversation(data.conversation),
      assistantMessage: data.assistant_message ? toMessage(data.assistant_message) : null,
    };
  },

  /** The caller's own conversations -- most recently active first. */
  async listConversations(): Promise<AssistantConversation[]> {
    const orgId = await resolveOrgId();
    const { data } = await api.get<BackendConversationListResponse>("/assistant/conversations", {
      params: { page_size: 25 },
      headers: { "X-Organization-Id": orgId },
    });
    return data.items.map(toConversation);
  },

  async listMessages(conversationId: string): Promise<AssistantMessage[]> {
    const orgId = await resolveOrgId();
    const { data } = await api.get<BackendMessageListResponse>(
      `/assistant/conversations/${conversationId}/messages`,
      { headers: { "X-Organization-Id": orgId } },
    );
    return data.items.map(toMessage);
  },

  /** Sends a customer message and returns the assistant's reply
   * synchronously -- no websockets/streaming, see backend router's own
   * module docstring for why this is deliberately a POC-simple exchange. */
  async sendMessage(conversationId: string, content: string): Promise<AssistantMessage> {
    const orgId = await resolveOrgId();
    const { data } = await api.post<BackendMessage>(
      `/assistant/conversations/${conversationId}/messages`,
      { content },
      { headers: { "X-Organization-Id": orgId } },
    );
    return toMessage(data);
  },
};
