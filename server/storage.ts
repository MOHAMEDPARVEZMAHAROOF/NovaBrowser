import type { Conversation, InsertConversation, Message, InsertMessage } from "@shared/schema";

export interface IStorage {
  // Conversations
  getConversations(): Promise<Conversation[]>;
  getConversation(id: number): Promise<Conversation | undefined>;
  createConversation(data: InsertConversation): Promise<Conversation>;
  deleteConversation(id: number): Promise<void>;
  updateConversationTitle(id: number, title: string): Promise<Conversation | undefined>;

  // Messages
  getMessages(conversationId: number): Promise<Message[]>;
  createMessage(data: InsertMessage): Promise<Message>;
}

export class MemStorage implements IStorage {
  private conversations: Map<number, Conversation> = new Map();
  private messages: Map<number, Message> = new Map();
  private convIdCounter = 1;
  private msgIdCounter = 1;

  async getConversations(): Promise<Conversation[]> {
    return Array.from(this.conversations.values()).sort(
      (a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime()
    );
  }

  async getConversation(id: number): Promise<Conversation | undefined> {
    return this.conversations.get(id);
  }

  async createConversation(data: InsertConversation): Promise<Conversation> {
    const conv: Conversation = {
      id: this.convIdCounter++,
      title: data.title || "New Chat",
      createdAt: new Date(),
    };
    this.conversations.set(conv.id, conv);
    return conv;
  }

  async deleteConversation(id: number): Promise<void> {
    this.conversations.delete(id);
    // Delete associated messages
    for (const [msgId, msg] of this.messages) {
      if (msg.conversationId === id) {
        this.messages.delete(msgId);
      }
    }
  }

  async updateConversationTitle(id: number, title: string): Promise<Conversation | undefined> {
    const conv = this.conversations.get(id);
    if (!conv) return undefined;
    conv.title = title;
    this.conversations.set(id, conv);
    return conv;
  }

  async getMessages(conversationId: number): Promise<Message[]> {
    return Array.from(this.messages.values())
      .filter((m) => m.conversationId === conversationId)
      .sort((a, b) => a.id - b.id);
  }

  async createMessage(data: InsertMessage): Promise<Message> {
    const msg: Message = {
      id: this.msgIdCounter++,
      conversationId: data.conversationId,
      role: data.role,
      content: data.content,
      sources: data.sources || null,
    };
    this.messages.set(msg.id, msg);
    return msg;
  }
}

export const storage = new MemStorage();
