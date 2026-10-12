import type { Conversation, ChatMessage } from '../types';

export interface ChatMeta {
  id: string;
  title: string;
  updatedAt: number;
}

const INDEX_KEY = 'qwen_ui_chat_index_v2';
const CHAT_MSG_PREFIX = 'qwen_ui_chat_msg_';
const LEGACY_KEY = 'qwen_ui_conversations_v1';
export const ACTIVE_CHAT_KEY = 'qwen_ui_active_chat_id';

export function migrateLegacyStorage(): void {
  try {
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (!legacy) return;

    const parsed: Conversation[] = JSON.parse(legacy);
    if (Array.isArray(parsed) && parsed.length > 0) {
      const index: ChatMeta[] = [];
      parsed.forEach((conv) => {
        index.push({
          id: conv.id,
          title: conv.title || '',
          updatedAt: conv.updatedAt || Date.now(),
        });
        const messages = (conv.messages || []).map((m) => ({ ...m, isStreaming: false }));
        localStorage.setItem(CHAT_MSG_PREFIX + conv.id, JSON.stringify(messages));
      });
      localStorage.setItem(INDEX_KEY, JSON.stringify(index));
      localStorage.removeItem(LEGACY_KEY);
    }
  } catch (err) {
    console.error('Storage migration failed:', err);
  }
}

export function loadChatIndex(): ChatMeta[] {
  migrateLegacyStorage();
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    if (raw) {
      const list: ChatMeta[] = JSON.parse(raw);
      if (Array.isArray(list)) return list;
    }
  } catch (err) {
    console.warn('Failed to parse chat index:', err);
  }
  return [];
}

export function saveChatIndex(index: ChatMeta[]): void {
  try {
    localStorage.setItem(INDEX_KEY, JSON.stringify(index));
  } catch (err) {
    console.error('Failed to save chat index:', err);
  }
}

export function loadChatMessages(chatId: string): ChatMessage[] {
  try {
    const raw = localStorage.getItem(CHAT_MSG_PREFIX + chatId);
    if (raw) {
      const list: ChatMessage[] = JSON.parse(raw);
      if (Array.isArray(list)) {
        return list.map((m) => ({ ...m, isStreaming: false }));
      }
    }
  } catch (err) {
    console.warn(`Failed to load messages for chat ${chatId}:`, err);
  }
  return [];
}

export function saveChatMessages(chatId: string, messages: ChatMessage[]): void {
  try {
    const sanitized = messages.map((m) => ({ ...m, isStreaming: false }));
    localStorage.setItem(CHAT_MSG_PREFIX + chatId, JSON.stringify(sanitized));
  } catch (err) {
    console.error(`Failed to save messages for chat ${chatId}:`, err);
  }
}

export function deleteChatStorage(chatId: string): void {
  try {
    localStorage.removeItem(CHAT_MSG_PREFIX + chatId);
  } catch (err) {
    console.error(err);
  }
}
