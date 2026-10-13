import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { ChatMessage, Conversation, Settings, FileAttachment } from '../types';
import { getTranslation } from '../i18n/translations';
import { useAuth } from './useAuth';
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
  const { token } = useAuth();
  const tokenRef = useRef<string | null>(token);
  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

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

  // Lazy loading: Only load full messages for active chat on startup, keeping others lightweight in memory
  const [conversations, setConversations] = useState<Conversation[]>(() => {
    const index = loadChatIndex();
    const savedActive = typeof localStorage !== 'undefined' ? localStorage.getItem(ACTIVE_CHAT_KEY) : null;
    const initialActive = (savedActive && index.some((m) => m.id === savedActive))
      ? savedActive
      : (index[0]?.id || 'default-1');

    if (index.length > 0) {
      return index.map((meta) => ({
        id: meta.id,
        title: meta.title,
        updatedAt: meta.updatedAt,
        messages: meta.id === initialActive ? loadChatMessages(meta.id) : [],
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

  const conversationsRef = useRef<Conversation[]>(conversations);
  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  // Track streaming state per conversation ID so multiple chats can stream independently
  const [streamingChatIds, setStreamingChatIds] = useState<Record<string, boolean>>({});
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map());

  // Individual persistence queues per conversation to avoid cross-chat race conditions
  const pendingSavesRef = useRef<Map<string, ChatMessage[]>>(new Map());
  const saveTimeoutsRef = useRef<Map<string, number>>(new Map());

  // Cloud sync helper: upload conversation to server database
  const syncConversationToServer = useCallback(
    async (chatId: string, messages: ChatMessage[], title?: string) => {
      const currentToken = tokenRef.current;
      if (!currentToken) return;
      try {
        const conv = conversationsRef.current.find((c) => c.id === chatId);
        const convTitle = title !== undefined ? title : (conv?.title || '');
        await fetch('/api/user/conversations', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${currentToken}`,
          },
          body: JSON.stringify({
            conversations: [
              {
                id: chatId,
                title: convTitle,
                messages,
                updatedAt: Date.now(),
              },
            ],
          }),
        });
      } catch (err) {
        console.warn('Server sync error:', err);
      }
    },
    []
  );

  const persistChatMessages = useCallback(
    (chatId: string, messages: ChatMessage[], immediate = false) => {
      if (immediate) {
        const existingTimeout = saveTimeoutsRef.current.get(chatId);
        if (existingTimeout) {
          clearTimeout(existingTimeout);
          saveTimeoutsRef.current.delete(chatId);
        }
        pendingSavesRef.current.delete(chatId);
        saveChatMessages(chatId, messages);
        syncConversationToServer(chatId, messages);
        return;
      }

      pendingSavesRef.current.set(chatId, messages);
      if (!saveTimeoutsRef.current.has(chatId)) {
        const timeoutId = window.setTimeout(() => {
          const pending = pendingSavesRef.current.get(chatId);
          if (pending) {
            saveChatMessages(chatId, pending);
            syncConversationToServer(chatId, pending);
            pendingSavesRef.current.delete(chatId);
          }
          saveTimeoutsRef.current.delete(chatId);
        }, 800);
        saveTimeoutsRef.current.set(chatId, timeoutId);
      }
    },
    [syncConversationToServer]
  );

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

  // Switch active chat and lazy-load its messages on demand
  const switchChat = useCallback((id: string) => {
    setActiveId(id);
    setConversations((prev) => {
      const target = prev.find((c) => c.id === id);
      if (target && (!target.messages || target.messages.length === 0)) {
        const loaded = loadChatMessages(id);
        if (loaded.length > 0) {
          return prev.map((c) => (c.id === id ? { ...c, messages: loaded } : c));
        }
      }
      return prev;
    });
  }, []);

  const activeConversation = useMemo(() => {
    const conv = conversations.find((c) => c.id === activeId) || conversations[0];
    if (conv && (!conv.messages || conv.messages.length === 0)) {
      const loaded = loadChatMessages(conv.id);
      if (loaded.length > 0) {
        return { ...conv, messages: loaded };
      }
    }
    return conv;
  }, [conversations, activeId]);

  // Guarantee persistence before page unloads / refreshes
  useEffect(() => {
    const handleBeforeUnload = () => {
      pendingSavesRef.current.forEach((msgs, chatId) => {
        saveChatMessages(chatId, msgs);
      });
      pendingSavesRef.current.clear();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  const createNewChat = () => {
    // If there is an existing empty conversation that is NOT generating, switch to it
    const emptyExisting = conversations.find(
      (c) => (!c.messages || c.messages.length === 0) && !streamingChatIds[c.id]
    );
    if (emptyExisting) {
      switchChat(emptyExisting.id);
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
    switchChat(newConv.id);
  };

  const prevTokenRef = useRef<string | null>(token);
  useEffect(() => {
    if (token) {
      fetch('/api/user/conversations', {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => res.json())
        .then((data: { conversations?: Conversation[] }) => {
          if (data && data.conversations && data.conversations.length > 0) {
            data.conversations.forEach((c) => {
              saveChatMessages(c.id, c.messages || []);
            });
            setConversations(data.conversations);
            setActiveId((prevId) =>
              data.conversations!.some((c) => c.id === prevId) ? prevId : data.conversations![0].id
            );
          } else {
            // First time login or empty server database:
            // Sync existing local conversations with messages to server
            const localIndex = loadChatIndex();
            const localToSync = localIndex
              .map((m) => ({
                id: m.id,
                title: m.title,
                updatedAt: m.updatedAt,
                messages: loadChatMessages(m.id),
              }))
              .filter((c) => c.messages && c.messages.length > 0);

            if (localToSync.length > 0) {
              fetch('/api/user/conversations', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ conversations: localToSync }),
              }).catch((err) => console.warn('Initial sync error:', err));
            }
          }
        })
        .catch((err) => console.warn('Failed to load server conversations:', err));
    } else if (prevTokenRef.current && !token) {
      // User logged out: switch to a clean guest state
      const freshId = 'conv-' + Date.now();
      const freshConv: Conversation = {
        id: freshId,
        title: '',
        messages: [],
        updatedAt: Date.now(),
      };
      saveChatIndex([{ id: freshId, title: '', updatedAt: freshConv.updatedAt }]);
      saveChatMessages(freshId, []);
      setConversations([freshConv]);
      setActiveId(freshId);
    }
    prevTokenRef.current = token;
  }, [token]);

  const deleteChat = (id: string) => {
    // Abort if currently streaming
    const controller = abortControllersRef.current.get(id);
    if (controller) {
      controller.abort();
      abortControllersRef.current.delete(id);
    }
    setStreamingChatIds((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });

    deleteChatStorage(id);
    if (tokenRef.current) {
      fetch(`/api/user/conversations/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${tokenRef.current}` },
      }).catch((err) => console.warn('Delete on server error:', err));
    }
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

  const stopGeneration = (chatId?: string) => {
    const targetId = chatId || activeId;
    const controller = abortControllersRef.current.get(targetId);
    if (controller) {
      controller.abort();
      abortControllersRef.current.delete(targetId);
    }
    setStreamingChatIds((prev) => {
      const next = { ...prev };
      delete next[targetId];
      return next;
    });
    setConversations((prev) =>
      prev.map((c) => {
        if (c.id === targetId) {
          const msgs = c.messages.map((m) =>
            m.isStreaming ? { ...m, isStreaming: false } : m
          );
          saveChatMessages(targetId, msgs);
          return { ...c, messages: msgs };
        }
        return c;
      })
    );
  };

  const sendMessage = async (content: string, attachments?: FileAttachment[], webSearch?: boolean) => {
    const trimmed = content.trim();
    // Explicitly lock the target conversation ID at the moment of sending
    const targetChatId = activeId;

    // Disallow sending if empty or if THIS specific chat is already generating
    if ((!trimmed && (!attachments || attachments.length === 0)) || streamingChatIds[targetChatId]) {
      return;
    }

    const targetConv = conversations.find((c) => c.id === targetChatId);
    const baseHistory = targetConv?.messages && targetConv.messages.length > 0
      ? [...targetConv.messages]
      : loadChatMessages(targetChatId);

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

    const initialMsgs: ChatMessage[] = [...baseHistory, userMessage, assistantMessage];
    const displayTitle = trimmed || (attachments && attachments[0]?.name) || 'File';
    const isFirstMessage = baseHistory.length === 0;
    const newTitle = isFirstMessage
      ? displayTitle.slice(0, 30) + (displayTitle.length > 30 ? '...' : '')
      : (targetConv?.title || '');

    setConversations((prev) =>
      prev.map((c) => {
        if (c.id === targetChatId) {
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

    saveChatMessages(targetChatId, initialMsgs);
    syncConversationToServer(targetChatId, initialMsgs, newTitle);
    if (isFirstMessage) {
      const currentIndex = loadChatIndex();
      const updatedIndex = currentIndex.some((item) => item.id === targetChatId)
        ? currentIndex.map((item) =>
            item.id === targetChatId ? { ...item, title: newTitle, updatedAt: Date.now() } : item
          )
        : [{ id: targetChatId, title: newTitle, updatedAt: Date.now() }, ...currentIndex];
      saveChatIndex(updatedIndex);
    }

    // Set streaming state and controller for targetChatId
    const controller = new AbortController();
    abortControllersRef.current.set(targetChatId, controller);
    setStreamingChatIds((prev) => ({ ...prev, [targetChatId]: true }));

    const currentMessages = [...baseHistory, userMessage];
    const apiMessages: Array<{ role: string; content: string | any[] }> = [];

    if (settings.systemPrompt && settings.systemPrompt.trim()) {
      apiMessages.push({ role: 'system', content: settings.systemPrompt.trim() });
    }

    currentMessages.forEach((m) => {
      // Skip errored messages from LLM context
      if (m.error) return;

      // Clean internal thinking tags from previous assistant turns so context stays continuous
      let cleanContent = m.content || '';
      if (m.role === 'assistant') {
        cleanContent = cleanContent.replace(/<think>[\s\S]*?(?:<\/think>|$)/g, '').trim();
      }

      if (m.attachments && m.attachments.length > 0) {
        let msgText = cleanContent;
        const textFiles = m.attachments.filter((a) => !a.isImage && !a.isVideo && a.content);
        if (textFiles.length > 0) {
          const context = textFiles.map((f) => `[File: ${f.name}]\n\`\`\`\n${f.content}\n\`\`\``).join('\n\n');
          msgText = context + (msgText ? `\n\n${msgText}` : '');
        }

        const imageFiles = m.attachments.filter((a) => a.isImage && a.previewUrl);
        const videoFiles = m.attachments.filter((a) => a.isVideo);
        const hasVisualMedia = imageFiles.length > 0 || videoFiles.length > 0;

        if (hasVisualMedia) {
          const contentParts: any[] = [];

          let mediaHeader = '';
          if (videoFiles.length > 0) {
            mediaHeader += videoFiles.map((v) =>
              `[Biriktirilgan video: "${v.name}" (davomiyligi: ~${Math.round(v.videoDuration || 0)} soniya). Quyida ushbu videodan vaqt ketma-ketligida olingan ${v.videoFrames?.length || 0} ta kadr/frame taqdim etilmoqda]`
            ).join('\n') + '\n\n';
          }
          if (imageFiles.length > 0) {
            mediaHeader += `[Yuklangan rasmlar soni: ${imageFiles.length} ta]\n\n`;
          }

          const defaultPrompt = settings.language === 'uz'
            ? 'Iltimos, yuklangan barcha rasm va video kadrlarini diqqat bilan tahlil qiling va unda nimalar aks etganini, muhim jihatlarini batafsil tushuntirib bering.'
            : settings.language === 'ru'
            ? 'Пожалуйста, внимательно проанализируйте все прикрепленные изображения и видеокадры и подробно опишите, что на них происходит.'
            : 'Please carefully analyze all attached images and video frames and provide a detailed explanation of what is shown.';

          const fullText = (mediaHeader + (msgText || defaultPrompt)).trim();
          contentParts.push({ type: 'text', text: fullText });

          // Add image attachments (supporting up to 15 images)
          imageFiles.forEach((img, idx) => {
            if (imageFiles.length > 1) {
              contentParts.push({
                type: 'text',
                text: `[Rasm #${idx + 1}: ${img.name}]`,
              });
            }
            contentParts.push({
              type: 'image_url',
              image_url: { url: img.previewUrl },
            });
          });

          // Add video frames
          videoFiles.forEach((vid) => {
            if (vid.videoFrames && vid.videoFrames.length > 0) {
              vid.videoFrames.forEach((frame, fIdx) => {
                contentParts.push({
                  type: 'text',
                  text: `[Video: "${vid.name}" | Kadr #${fIdx + 1} (${frame.time})]:`,
                });
                contentParts.push({
                  type: 'image_url',
                  image_url: { url: frame.dataUrl },
                });
              });
            } else if (vid.previewUrl) {
              contentParts.push({
                type: 'image_url',
                image_url: { url: vid.previewUrl },
              });
            }
          });

          apiMessages.push({ role: m.role, content: contentParts });
        } else {
          if (msgText.trim()) {
            apiMessages.push({ role: m.role, content: msgText });
          }
        }
      } else {
        if (cleanContent.trim()) {
          apiMessages.push({ role: m.role, content: cleanContent });
        }
      }
    });

    let accumulatedContent = '';

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
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
      let rafId: number | null = null;
      let lastRenderTime = 0;

      const scheduleRender = () => {
        const now = performance.now();
        if (now - lastRenderTime >= 25) {
          lastRenderTime = now;
          if (rafId) {
            cancelAnimationFrame(rafId);
            rafId = null;
          }
          const currentMsgs: ChatMessage[] = [
            ...baseHistory,
            userMessage,
            { ...assistantMessage, content: accumulatedContent, isStreaming: true },
          ];
          setConversations((prev) =>
            prev.map((c) => (c.id === targetChatId ? { ...c, messages: currentMsgs } : c))
          );
        } else if (!rafId) {
          rafId = requestAnimationFrame(() => {
            rafId = null;
            lastRenderTime = performance.now();
            const currentMsgs: ChatMessage[] = [
              ...baseHistory,
              userMessage,
              { ...assistantMessage, content: accumulatedContent, isStreaming: true },
            ];
            setConversations((prev) =>
              prev.map((c) => (c.id === targetChatId ? { ...c, messages: currentMsgs } : c))
            );
          });
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        sseBuffer += decoder.decode(value, { stream: true });
        const lines = sseBuffer.split('\n');
        sseBuffer = lines.pop() || '';

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine || !trimmedLine.startsWith('data:')) continue;

          const dataStr = trimmedLine.replace(/^data:\s*/, '');
          if (dataStr === '[DONE]') break;

          let parsed: any;
          try {
            parsed = JSON.parse(dataStr);
          } catch {
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
              prev.map((c) => (c.id === targetChatId ? { ...c, messages: currentMsgs } : c))
            );
            continue;
          }

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

          // Thinking / Reasoning tokens
          if (reasoningDelta) {
            if (!isInsideThinkingBlock) {
              if (!accumulatedContent.includes('<think>')) {
                chunkToAppend += '<think>\n';
              }
              isInsideThinkingBlock = true;
            }
            chunkToAppend += reasoningDelta;
          }

          // Main content tokens
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
            scheduleRender();
          }
        }
      }

      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }

      // Flush remaining line if present
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
        prev.map((c) => (c.id === targetChatId ? { ...c, messages: completedMsgs } : c))
      );
      persistChatMessages(targetChatId, completedMsgs, true);
    } catch (err: any) {
      if (err.name === 'AbortError') {
        const abortedMsgs: ChatMessage[] = [
          ...baseHistory,
          userMessage,
          { ...assistantMessage, content: accumulatedContent, isStreaming: false },
        ];
        setConversations((prev) =>
          prev.map((c) => (c.id === targetChatId ? { ...c, messages: abortedMsgs } : c))
        );
        persistChatMessages(targetChatId, abortedMsgs, true);
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
          prev.map((c) => (c.id === targetChatId ? { ...c, messages: errorMsgs } : c))
        );
        persistChatMessages(targetChatId, errorMsgs, true);
      }
    } finally {
      setStreamingChatIds((prev) => {
        const next = { ...prev };
        delete next[targetChatId];
        return next;
      });
      abortControllersRef.current.delete(targetChatId);
    }
  };

  // Only the active conversation's streaming state is exposed as isStreaming for UI controls
  const isStreamingActiveChat = Boolean(streamingChatIds[activeId]);

  return {
    conversations,
    activeConversation,
    activeId,
    setActiveId: switchChat,
    createNewChat,
    deleteChat,
    sendMessage,
    stopGeneration,
    isStreaming: isStreamingActiveChat,
    streamingChatIds,
  };
}
