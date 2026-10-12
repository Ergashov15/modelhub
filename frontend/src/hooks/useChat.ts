import { useState, useEffect, useRef, useCallback } from 'react';
import type { ChatMessage, Conversation, Settings, FileAttachment } from '../types';
import { getTranslation } from '../i18n/translations';
import {
  ACTIVE_CHAT_KEY,
  loadChatIndex,
  saveChatIndex,
  loadChatMessages,
  saveChatMessages,
  deleteChatStorage,
  type ChatMeta,
} from '../utils/storage';

export function useChat(settings: Settings) {
  const [conversations, setConversations] = useState<Conversation[]>(() => {
    const index = loadChatIndex();
    if (index.length > 0) {
      return index.map((meta) => ({
        id: meta.id,
        title: meta.title,
        updatedAt: meta.updatedAt,
        messages: loadChatMessages(meta.id),
      }));
    }
    const defaultId = 'default-1';
    const defaultConv: Conversation = {
      id: defaultId,
      title: '',
      messages: [],
      updatedAt: Date.now(),
    };
    saveChatIndex([{ id: defaultId, title: '', updatedAt: defaultConv.updatedAt }]);
    saveChatMessages(defaultId, []);
    return [defaultConv];
  });

  const [activeId, setActiveId] = useState<string>(() => {
    try {
      const savedActive = localStorage.getItem(ACTIVE_CHAT_KEY);
      const index = loadChatIndex();
      if (savedActive && index.some((m) => m.id === savedActive)) {
        return savedActive;
      }
      if (index.length > 0) {
        return index[0].id;
      }
    } catch (err) {
      console.warn(err);
    }
    return 'default-1';
  });

  const [isStreaming, setIsStreaming] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const lastSaveTimeRef = useRef<number>(0);
  const saveTimeoutRef = useRef<number | null>(null);
  const pendingSaveMsgsRef = useRef<{ chatId: string; messages: ChatMessage[] } | null>(null);

  const persistChatMessages = useCallback((chatId: string, messages: ChatMessage[], immediate = false) => {
    pendingSaveMsgsRef.current = { chatId, messages };
    const now = Date.now();
    if (immediate || now - lastSaveTimeRef.current >= 1000) {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
      saveChatMessages(chatId, messages);
      lastSaveTimeRef.current = now;
      pendingSaveMsgsRef.current = null;
    } else if (!saveTimeoutRef.current) {
      saveTimeoutRef.current = window.setTimeout(() => {
        if (pendingSaveMsgsRef.current) {
          saveChatMessages(pendingSaveMsgsRef.current.chatId, pendingSaveMsgsRef.current.messages);
          pendingSaveMsgsRef.current = null;
        }
        lastSaveTimeRef.current = Date.now();
        saveTimeoutRef.current = null;
      }, 1000);
    }
  }, []);

  useEffect(() => {
    const indexMeta: ChatMeta[] = conversations.map((c) => ({
      id: c.id,
      title: c.title,
      updatedAt: c.updatedAt,
    }));
    saveChatIndex(indexMeta);
  }, [conversations]);

  useEffect(() => {
    try {
      localStorage.setItem(ACTIVE_CHAT_KEY, activeId);
    } catch (err) {
      console.error(err);
    }
  }, [activeId]);

  const activeConversation = conversations.find((c) => c.id === activeId) || conversations[0];

  // Guarantee persistence before page unloads / refreshes
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (pendingSaveMsgsRef.current) {
        saveChatMessages(pendingSaveMsgsRef.current.chatId, pendingSaveMsgsRef.current.messages);
      }
      const current = conversations.find((c) => c.id === activeId);
      if (current && current.messages.length > 0) {
        saveChatMessages(activeId, current.messages);
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [activeId, conversations]);

  const createNewChat = () => {
    const emptyExisting = conversations.find((c) => c.messages.length === 0);
    if (emptyExisting) {
      setActiveId(emptyExisting.id);
      return;
    }

    const newConv: Conversation = {
      id: 'conv-' + Date.now(),
      title: '',
      messages: [],
      updatedAt: Date.now(),
    };
    saveChatMessages(newConv.id, []);
    setConversations((prev) => [newConv, ...prev]);
    setActiveId(newConv.id);
  };

  const deleteChat = (id: string) => {
    deleteChatStorage(id);
    setConversations((prev) => {
      const filtered = prev.filter((c) => c.id !== id);
      if (filtered.length === 0) {
        const fresh: Conversation = {
          id: 'conv-' + Date.now(),
          title: '',
          messages: [],
          updatedAt: Date.now(),
        };
        saveChatMessages(fresh.id, []);
        setActiveId(fresh.id);
        return [fresh];
      }
      if (activeId === id) {
        setActiveId(filtered[0].id);
      }
      return filtered;
    });
  };

  const stopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (activeConversation) {
      saveChatMessages(activeId, activeConversation.messages);
    }
    setIsStreaming(false);
  };

  const sendMessage = async (content: string, attachments?: FileAttachment[], webSearch?: boolean) => {
    const trimmed = content.trim();
    if ((!trimmed && (!attachments || attachments.length === 0)) || isStreaming) return;

    const userMessage: ChatMessage = {
      id: 'msg-' + Date.now(),
      role: 'user',
      content: trimmed,
      timestamp: Date.now(),
      attachments: attachments && attachments.length > 0 ? attachments : undefined,
    };

    const assistantId = 'msg-ast-' + Date.now();
    const assistantMessage: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      isStreaming: true,
    };

    const baseHistory = activeConversation ? [...activeConversation.messages] : [];
    const initialMsgs: ChatMessage[] = [...baseHistory, userMessage, assistantMessage];
    const displayTitle = trimmed || (attachments && attachments[0]?.name) || 'File';
    const isFirstMessage = baseHistory.length === 0;
    const newTitle = isFirstMessage
      ? displayTitle.slice(0, 30) + (displayTitle.length > 30 ? '...' : '')
      : (activeConversation?.title || '');

    setConversations((prev) =>
      prev.map((c) => {
        if (c.id === activeId) {
          return {
            ...c,
            title: newTitle,
            messages: initialMsgs,
            updatedAt: Date.now(),
          };
        }
        return c;
      })
    );

    saveChatMessages(activeId, initialMsgs);
    if (isFirstMessage) {
      const currentIndex = loadChatIndex();
      const updatedIndex = currentIndex.some((item) => item.id === activeId)
        ? currentIndex.map((item) =>
            item.id === activeId ? { ...item, title: newTitle, updatedAt: Date.now() } : item
          )
        : [{ id: activeId, title: newTitle, updatedAt: Date.now() }, ...currentIndex];
      saveChatIndex(updatedIndex);
    }

    setIsStreaming(true);
    abortControllerRef.current = new AbortController();

    const currentMessages = [...baseHistory, userMessage];
    const apiMessages: Array<{ role: string; content: string | any[] }> = [];

    if (settings.systemPrompt && settings.systemPrompt.trim()) {
      apiMessages.push({ role: 'system', content: settings.systemPrompt.trim() });
    }

    currentMessages.forEach((m) => {
      if (m.attachments && m.attachments.length > 0) {
        let msgText = m.content;
        const textFiles = m.attachments.filter((a) => !a.isImage && a.content);
        if (textFiles.length > 0) {
          const context = textFiles.map((f) => `[File: ${f.name}]\n\`\`\`\n${f.content}\n\`\`\``).join('\n\n');
          msgText = context + (msgText ? `\n\n${msgText}` : '');
        }

        const imageFiles = m.attachments.filter((a) => a.isImage && a.previewUrl);
        if (imageFiles.length > 0) {
          const contentParts: any[] = [{ type: 'text', text: msgText || 'Analyze the attached image.' }];
          imageFiles.forEach((img) => {
            contentParts.push({
              type: 'image_url',
              image_url: { url: img.previewUrl }
            });
          });
          apiMessages.push({ role: m.role, content: contentParts });
        } else {
          apiMessages.push({ role: m.role, content: msgText });
        }
      } else {
        apiMessages.push({ role: m.role, content: m.content });
      }
    });

    let accumulatedContent = '';

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortControllerRef.current.signal,
        body: JSON.stringify({
          endpoint: settings.endpoint,
          api_key: settings.apiKey || undefined,
          model: settings.model,
          messages: apiMessages,
          temperature: settings.temperature,
          top_p: settings.topP,
          max_tokens: settings.maxTokens,
          stream: true,
          web_search: !!webSearch,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        let message = errorData.detail;
        if (!message) {
          message = `${getTranslation(settings.language, 'unknownError')} (${response.status})`;
        } else if (message.includes('Endpoint URL')) {
          message = getTranslation(settings.language, 'endpointNotConfigured');
        } else if (message.includes('Model name')) {
          message = getTranslation(settings.language, 'modelNotConfigured');
        }
        throw new Error(message);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error(getTranslation(settings.language, 'streamReadError'));

      const decoder = new TextDecoder();
      let isInsideThinkingBlock = false;
      let sseBuffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        sseBuffer += decoder.decode(value, { stream: true });
        const lines = sseBuffer.split('\n');
        // Keep the last element in buffer (which may be an incomplete line)
        sseBuffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data:')) continue;

          const dataStr = trimmed.replace(/^data:\s*/, '');
          if (dataStr === '[DONE]') break;

          let parsed: any;
          try {
            parsed = JSON.parse(dataStr);
          } catch {
            // Incomplete or non-JSON line, continue
            continue;
          }

          if (parsed.error) {
            const errStr = typeof parsed.error === 'string'
              ? parsed.error
              : parsed.error?.message || JSON.stringify(parsed.error);
            throw new Error(errStr);
          }

          // Handle incoming Web Search sources event
          if (parsed.type === 'sources' && Array.isArray(parsed.sources)) {
            assistantMessage.sources = parsed.sources;
            const currentMsgs: ChatMessage[] = [
              ...baseHistory,
              userMessage,
              { ...assistantMessage, content: accumulatedContent, sources: parsed.sources, isStreaming: true },
            ];
            setConversations((prev) =>
              prev.map((c) => (c.id === activeId ? { ...c, messages: currentMsgs } : c))
            );
            persistChatMessages(activeId, currentMsgs, false);
            continue;
          }

          // Extract delta from multiple possible server formats:
          // 1. Standard OpenAI / vLLM: delta.content
          // 2. Ollama & DeepSeek-R1 reasoning: delta.reasoning or delta.reasoning_content
          // 3. Ollama native API: message.thinking or message.content or response
          // 4. Non-streaming OpenAI fallback: choices[0].message.content
          // 5. llama.cpp / text completions: choices[0].text
          const deltaObj = parsed.choices?.[0]?.delta;
          const reasoningDelta = 
            deltaObj?.reasoning ?? 
            deltaObj?.reasoning_content ?? 
            parsed.message?.thinking ??
            parsed.thinking ??
            '';
          const contentDelta = 
            deltaObj?.content ?? 
            parsed.choices?.[0]?.text ?? 
            parsed.choices?.[0]?.message?.content ?? 
            parsed.message?.content ?? 
            parsed.response ?? 
            '';

          let chunkToAppend = '';

          // If model sends reasoning tokens (Ollama, DeepSeek-R1, Qwen reasoning)
          if (reasoningDelta) {
            if (!isInsideThinkingBlock) {
              if (!accumulatedContent.includes('<think>')) {
                chunkToAppend += '<think>\n';
              }
              isInsideThinkingBlock = true;
            }
            chunkToAppend += reasoningDelta;
          }

          // If model sends actual content tokens
          if (contentDelta) {
            if (isInsideThinkingBlock) {
              if (!accumulatedContent.includes('</think>')) {
                chunkToAppend += '\n</think>\n\n';
              }
              isInsideThinkingBlock = false;
            }
            chunkToAppend += contentDelta;
          }

          if (chunkToAppend) {
            accumulatedContent += chunkToAppend;
            const currentMsgs: ChatMessage[] = [
              ...baseHistory,
              userMessage,
              { ...assistantMessage, content: accumulatedContent, isStreaming: true },
            ];
            setConversations((prev) =>
              prev.map((c) => (c.id === activeId ? { ...c, messages: currentMsgs } : c))
            );
            persistChatMessages(activeId, currentMsgs, false);
          }
        }
      }

      // Flush remaining sseBuffer line if present
      if (sseBuffer.trim() && sseBuffer.trim().startsWith('data:')) {
        const dataStr = sseBuffer.trim().replace(/^data:\s*/, '');
        if (dataStr !== '[DONE]') {
          try {
            const parsed = JSON.parse(dataStr);
            const deltaObj = parsed.choices?.[0]?.delta;
            const cDelta = deltaObj?.content ?? parsed.choices?.[0]?.message?.content ?? parsed.message?.content ?? '';
            if (cDelta) accumulatedContent += cDelta;
          } catch {}
        }
      }

      // Close thinking block cleanly if ended without content
      if (isInsideThinkingBlock && !accumulatedContent.includes('</think>')) {
        accumulatedContent += '\n</think>';
      }

      const completedMsgs: ChatMessage[] = [
        ...baseHistory,
        userMessage,
        { ...assistantMessage, content: accumulatedContent, isStreaming: false },
      ];
      setConversations((prev) =>
        prev.map((c) => (c.id === activeId ? { ...c, messages: completedMsgs } : c))
      );
      persistChatMessages(activeId, completedMsgs, true);
    } catch (err: any) {
      if (err.name === 'AbortError') {
        const abortedMsgs: ChatMessage[] = [
          ...baseHistory,
          userMessage,
          { ...assistantMessage, content: accumulatedContent, isStreaming: false },
        ];
        setConversations((prev) =>
          prev.map((c) => (c.id === activeId ? { ...c, messages: abortedMsgs } : c))
        );
        persistChatMessages(activeId, abortedMsgs, true);
      } else {
        const errMsg = err.message || getTranslation(settings.language, 'connectionLost');
        const errorMsgs: ChatMessage[] = [
          ...baseHistory,
          userMessage,
          {
            ...assistantMessage,
            error: errMsg,
            isStreaming: false,
            content: accumulatedContent || `${getTranslation(settings.language, 'errorOccurred')} ${errMsg}`,
          },
        ];
        setConversations((prev) =>
          prev.map((c) => (c.id === activeId ? { ...c, messages: errorMsgs } : c))
        );
        persistChatMessages(activeId, errorMsgs, true);
      }
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  };

  return {
    conversations,
    activeConversation,
    activeId,
    setActiveId,
    createNewChat,
    deleteChat,
    sendMessage,
    stopGeneration,
    isStreaming,
  };
}
