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
  const sanitized = messages.map((m) => ({ ...m, isStreaming: false }));
  try {
    localStorage.setItem(CHAT_MSG_PREFIX + chatId, JSON.stringify(sanitized));
  } catch (err) {
    console.warn(`localStorage quota exceeded for chat ${chatId}, saving lightweight version:`, err);
    try {
      // In case quota is exceeded (e.g. 15 images or video frames),
      // preserve text content, remove heavy frame arrays and keep lightweight metadata
      const lightweight = sanitized.map((m) => ({
        ...m,
        attachments: m.attachments?.map((a) => ({
          id: a.id,
          name: a.name,
          size: a.size,
          type: a.type,
          isImage: a.isImage,
          isVideo: a.isVideo,
          videoDuration: a.videoDuration,
          thumbnailUrl: a.thumbnailUrl,
          // keep previewUrl if it's not gigantic, omit huge raw frame arrays
          previewUrl: a.previewUrl && a.previewUrl.length < 400000 ? a.previewUrl : undefined,
        })),
      }));
      localStorage.setItem(CHAT_MSG_PREFIX + chatId, JSON.stringify(lightweight));
    } catch (e2) {
      console.error(`Failed to save even lightweight messages for chat ${chatId}:`, e2);
    }
  }
}

export function deleteChatStorage(chatId: string): void {
  try {
    localStorage.removeItem(CHAT_MSG_PREFIX + chatId);
  } catch (err) {
    console.error(err);
  }
}

export interface BackupData {
  version: 2;
  exportedAt: number;
  index: ChatMeta[];
  chats: Record<string, ChatMessage[]>;
}

export function exportAllChats(): string {
  const index = loadChatIndex();
  const chats: Record<string, ChatMessage[]> = {};
  index.forEach((meta) => {
    chats[meta.id] = loadChatMessages(meta.id);
  });
  const backup: BackupData = {
    version: 2,
    exportedAt: Date.now(),
    index,
    chats,
  };
  return JSON.stringify(backup, null, 2);
}

export function importAllChats(jsonString: string): { success: boolean; count: number; error?: string } {
  try {
    const data = JSON.parse(jsonString);
    if (!data || !Array.isArray(data.index) || typeof data.chats !== 'object') {
      return { success: false, count: 0, error: "Fayl formati noto'g'ri (ModelHub zaxira fayli emas)." };
    }
    const currentIndex = loadChatIndex();
    const existingIds = new Set(currentIndex.map((m) => m.id));
    const mergedIndex = [...currentIndex];
    let importedCount = 0;

    data.index.forEach((meta: ChatMeta) => {
      const msgs = data.chats[meta.id];
      if (Array.isArray(msgs)) {
        if (!existingIds.has(meta.id)) {
          mergedIndex.push(meta);
          existingIds.add(meta.id);
        }
        saveChatMessages(meta.id, msgs);
        importedCount++;
      }
    });

    saveChatIndex(mergedIndex);
    return { success: true, count: importedCount };
  } catch (err: any) {
    return { success: false, count: 0, error: err.message || "Faylni o'qishda xatolik." };
  }
}

export function clearAllChatsStorage(): void {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (
        key &&
        (key.startsWith(CHAT_MSG_PREFIX) ||
          key === INDEX_KEY ||
          key === LEGACY_KEY ||
          key === ACTIVE_CHAT_KEY ||
          key === 'qwen_ui_conversations')
      ) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  } catch (err) {
    console.error(err);
  }
}

export function getStorageUsage(): { usedBytes: number; usedKb: number; usedMb: string } {
  try {
    let total = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        total += (key.length + (localStorage.getItem(key)?.length || 0)) * 2;
      }
    }
    return {
      usedBytes: total,
      usedKb: Math.round(total / 1024),
      usedMb: (total / (1024 * 1024)).toFixed(2),
    };
  } catch {
    return { usedBytes: 0, usedKb: 0, usedMb: '0.00' };
  }
}
