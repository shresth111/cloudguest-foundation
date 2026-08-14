export type AssistantMessageRole = "user" | "assistant";

export interface AssistantMessage {
  id: string;
  conversationId: string;
  role: AssistantMessageRole;
  content: string;
  createdAt: string;
}

export interface AssistantConversation {
  id: string;
  organizationId: string;
  userId: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
}
