import React, { useEffect, useRef, useState } from 'react';
import { 
  Copy, 
  Check, 
  AlertTriangle,
  FileText,
  Sparkles,
  Code2,
  Image as ImageIcon,
  Globe,
  ExternalLink,
  ChevronDown
} from 'lucide-react';
import type { ChatMessage, Settings } from '../types';
import { getTranslation, type TranslationKey } from '../i18n/translations';
import { MarkdownRenderer } from './MarkdownRenderer';

interface ChatViewProps {
  messages: ChatMessage[];
  settings: Settings;
  onInsertCode?: (code: string) => void;
}

interface ThinkingStatus {
  text: string;
  icon: 'sparkles' | 'code' | 'image' | 'file';
}

function getThinkingStatus(
  prevMessage?: ChatMessage,
  lang: 'uz' | 'en' | 'ru' = 'uz'
): ThinkingStatus {
  if (!prevMessage) {
    return {
      text: lang === 'uz' ? 'Fikrlanmoqda...' : lang === 'ru' ? 'Думаю...' : 'Thinking...',
      icon: 'sparkles',
    };
  }

  // 1. Image analysis
  if (prevMessage.attachments && prevMessage.attachments.some((a) => a.isImage)) {
    return {
      text: lang === 'uz' ? 'Rasm tahlil qilinmoqda...' : lang === 'ru' ? 'Анализ изображения...' : 'Analyzing image...',
      icon: 'image',
    };
  }

  // 2. Document/File analysis
  if (prevMessage.attachments && prevMessage.attachments.length > 0) {
    return {
      text: lang === 'uz' ? 'Fayllar tahlil qilinmoqda...' : lang === 'ru' ? 'Анализ файлов...' : 'Analyzing files...',
      icon: 'file',
    };
  }

  const text = (prevMessage.content || '').toLowerCase();

  // 3. Code & debugging analysis
  const codeKeywords = [
    'kod', 'code', 'xato', 'bug', 'error', 'funksiya', 'function', 'class',
    'import', 'python', 'javascript', 'typescript', 'sql', 'react', 'refactor',
    'tuzat', 'dastur', 'algoritm', 'algorithm'
  ];
  if (codeKeywords.some((k) => text.includes(k))) {
    return {
      text: lang === 'uz' ? 'Kod tahlil qilinmoqda...' : lang === 'ru' ? 'Анализ кода...' : 'Analyzing code...',
      icon: 'code',
    };
  }

  // 4. Translation
  if (text.includes('tarjima') || text.includes('translate') || text.includes('перевод')) {
    return {
      text: lang === 'uz' ? 'Tarjima qilinmoqda...' : lang === 'ru' ? 'Перевод текста...' : 'Translating...',
      icon: 'sparkles',
    };
  }

  // 5. Default reasoning
  return {
    text: lang === 'uz' ? 'Fikrlanmoqda...' : lang === 'ru' ? 'Думаю...' : 'Thinking...',
    icon: 'sparkles',
  };
}

function parseThoughtAndContent(content: string) {
  if (!content) return { thought: null, response: '', isThinking: false };

  const thinkMatch = content.match(/^<think>([\s\S]*?)(?:<\/think>|$)([\s\S]*)$/);
  if (thinkMatch) {
    const isClosed = content.includes('</think>');
    return {
      thought: thinkMatch[1].trim(),
      response: isClosed ? thinkMatch[2].trimStart() : '',
      isThinking: !isClosed,
    };
  }

  return { thought: null, response: content, isThinking: false };
}

export const ChatView: React.FC<ChatViewProps> = ({
  messages,
  settings,
  onInsertCode,
}) => {
  const scrollEndRef = useRef<HTMLDivElement>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [collapsedSources, setCollapsedSources] = useState<Record<string, boolean>>({});

  const toggleSources = (id: string) => {
    setCollapsedSources((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const t = (key: TranslationKey) => getTranslation(settings.language, key);

  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleCopy = (content: string, id: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const renderThinkingIcon = (icon: 'sparkles' | 'code' | 'image' | 'file') => {
    switch (icon) {
      case 'code':
        return <Code2 className="w-4 h-4 text-[#047857] dark:text-[#34D399]" />;
      case 'image':
        return <ImageIcon className="w-4 h-4 text-[#047857] dark:text-[#34D399]" />;
      case 'file':
        return <FileText className="w-4 h-4 text-[#047857] dark:text-[#34D399]" />;
      case 'sparkles':
      default:
        return <Sparkles className="w-4 h-4 text-[#047857] dark:text-[#34D399]" />;
    }
  };

  if (messages.length === 0) {
    return null;
  }

  return (
    <div className="flex-1 overflow-y-auto w-full no-scrollbar">
      <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-7">
        {messages.map((message, index) => {
        const isUser = message.role === 'user';
        const prevMessage = index > 0 ? messages[index - 1] : undefined;
        const thinkingStatus = getThinkingStatus(prevMessage, settings.language);
        const parsed = parseThoughtAndContent(message.content);
        // During streaming: keep thoughts completely hidden behind the loading indicator
        const displayResponse = message.isStreaming
          ? parsed.response
          : (parsed.response || parsed.thought || '');

        if (isUser) {
          // ChatGPT style User Message: cleanly aligned to the right, gentle smooth pill, no borders
          return (
            <div key={message.id} className="w-full flex justify-end">
              <div className="max-w-[85%] sm:max-w-[70%] rounded-3xl px-5 py-3.5 bg-[#F4F4F5] dark:bg-[#2F2F2F] text-[#1F2937] dark:text-[#ECEBE8] text-sm sm:text-base leading-relaxed break-words">
                {/* Attachments preview */}
                {message.attachments && message.attachments.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2.5">
                    {message.attachments.map((att) =>
                      att.isImage && att.previewUrl ? (
                        <a
                          key={att.id}
                          href={att.previewUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="block overflow-hidden rounded-2xl border border-black/10 dark:border-white/10 hover:opacity-90 transition-opacity"
                        >
                          <img
                            src={att.previewUrl}
                            alt={att.name}
                            className="max-h-64 max-w-full rounded-2xl object-contain bg-black/5 dark:bg-black/20"
                          />
                        </a>
                      ) : (
                        <div
                          key={att.id}
                          className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-white dark:bg-[#1E1E1C] border border-black/10 dark:border-white/10 text-xs sm:text-sm font-mono"
                        >
                          <FileText className="w-4 h-4 text-[#047857]" />
                          <span className="truncate max-w-[200px] font-medium text-[#1F2937] dark:text-[#ECEBE8]">{att.name}</span>
                          <span className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">
                            {(att.size / 1024).toFixed(0)} KB
                          </span>
                        </div>
                      )
                    )}
                  </div>
                )}

                {/* Text Content */}
                <div className="whitespace-pre-wrap font-sans">
                  {message.content}
                </div>
              </div>
            </div>
          );
        }

        // ChatGPT style Assistant Message: completely unboxed, flowing naturally across full width without avatar icon
        return (
          <div key={message.id} className="w-full group">
            {/* Content Area: No borders, no cards, no tables, pure clean typography */}
            <div className="w-full text-sm sm:text-base leading-relaxed text-[#1F2937] dark:text-[#ECEBE8]">
              {/* Attachments preview if assistant has generated files */}
              {message.attachments && message.attachments.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {message.attachments.map((att) =>
                    att.isImage && att.previewUrl ? (
                      <a
                        key={att.id}
                        href={att.previewUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="block overflow-hidden rounded-2xl border border-[#E5E7EB] dark:border-[#383835] hover:opacity-90 transition-opacity"
                      >
                        <img
                          src={att.previewUrl}
                          alt={att.name}
                          className="max-h-64 max-w-full rounded-2xl object-contain bg-black/5 dark:bg-black/20"
                        />
                      </a>
                    ) : (
                      <div
                        key={att.id}
                        className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-[#F9FAFB] dark:bg-[#1E1E1C] border border-[#E5E7EB] dark:border-[#383835] text-xs sm:text-sm font-mono"
                      >
                        <FileText className="w-4 h-4 text-[#047857]" />
                        <span className="truncate max-w-[200px] font-medium text-[#1F2937] dark:text-[#ECEBE8]">{att.name}</span>
                        <span className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">
                          {(att.size / 1024).toFixed(0)} KB
                        </span>
                      </div>
                    )
                  )}
                </div>
              )}

              {/* Error message */}
              {message.error ? (
                <div className="flex items-start gap-2.5 text-[#DC2626] dark:text-[#F87171] text-xs sm:text-sm p-3 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50">
                  <AlertTriangle className="w-4.5 h-4.5 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold mb-0.5">{t('errorOccurred')}</p>
                    <p className="opacity-90">{message.error}</p>
                  </div>
                </div>
              ) : (
                <>
                  {/* Web Search Sources Accordion (Vertically stacked, user-friendly, no horizontal scroll) */}
                  {message.sources && message.sources.length > 0 && (
                    <div className="mb-4 pt-0.5">
                      <button
                        type="button"
                        onClick={() => toggleSources(message.id)}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#E6F4EA] dark:bg-[#064E3B]/40 hover:bg-[#D1EBD8] dark:hover:bg-[#064E3B]/60 text-[#047857] dark:text-[#34D399] text-xs sm:text-[13px] font-semibold transition-all mb-2.5 cursor-pointer select-none"
                      >
                        <Globe className="w-3.5 h-3.5" />
                        <span>{t('sources')} ({message.sources.length})</span>
                        <ChevronDown
                          className={`w-3.5 h-3.5 transition-transform duration-200 ${
                            collapsedSources[message.id] ? '-rotate-90' : 'rotate-0'
                          }`}
                        />
                      </button>

                      {!collapsedSources[message.id] && (
                        <div className="flex flex-col gap-2 w-full animate-in fade-in duration-150">
                          {message.sources.map((src, idx) => (
                            <a
                              key={idx}
                              href={src.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="w-full flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl bg-[#F9FAFB] dark:bg-[#20201E] hover:bg-[#F3F4F6] dark:hover:bg-[#282825] border border-[#E5E7EB] dark:border-[#333330] transition-all group shadow-2xs"
                              title={`${src.title}\n${src.url}`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <span className="w-5 h-5 rounded-md bg-[#E6F4EA] dark:bg-[#064E3B]/70 text-[#047857] dark:text-[#34D399] flex items-center justify-center text-xs font-bold shrink-0">
                                  {idx + 1}
                                </span>
                                <span className="truncate text-xs sm:text-sm font-medium text-[#1F2937] dark:text-[#ECEBE8] group-hover:text-[#047857] dark:group-hover:text-[#34D399]">
                                  {src.title}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0 text-[11px] sm:text-xs text-[#6B7280] dark:text-[#9CA3AF]">
                                <span className="truncate max-w-[120px] sm:max-w-[200px] font-mono">{src.domain || 'web'}</span>
                                <ExternalLink className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100 group-hover:text-[#047857] dark:group-hover:text-[#34D399]" />
                              </div>
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Loading indicator while model is generating/thinking and no response text yet */}
                  {message.isStreaming && !displayResponse && (
                    <div className="flex items-center gap-2.5 py-2.5 text-xs sm:text-sm text-[#6B7280] dark:text-[#9CA3AF] my-1.5 select-none animate-pulse">
                      {message.sources && message.sources.length > 0 ? (
                        <>
                          <Globe className="w-4 h-4 text-[#047857] dark:text-[#34D399]" />
                          <span className="font-medium text-[#1F2937] dark:text-[#ECEBE8]">
                            {t('searchingWeb')}
                          </span>
                        </>
                      ) : (
                        <>
                          {renderThinkingIcon(thinkingStatus.icon)}
                          <span className="font-medium text-[#1F2937] dark:text-[#ECEBE8]">
                            {thinkingStatus.text}
                          </span>
                        </>
                      )}
                      <span className="flex gap-1.5 items-center ml-1.5">
                        <span className="w-2 h-2 rounded-full bg-[#047857] animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-2 h-2 rounded-full bg-[#047857] animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-2 h-2 rounded-full bg-[#047857] animate-bounce" style={{ animationDelay: '300ms' }} />
                      </span>
                    </div>
                  )}

                  {/* Main Response Content: Pure markdown flow */}
                  {displayResponse && (
                    <div className="w-full">
                      <MarkdownRenderer
                        content={displayResponse}
                        onInsertCode={onInsertCode}
                        uiLanguage={settings.language}
                        isStreaming={message.isStreaming}
                      />
                    </div>
                  )}
                </>
              )}

              {/* Minimal Clean Action Buttons: No borders, pure ChatGPT style */}
              {displayResponse && (
                <div className="flex items-center gap-3 mt-3 text-xs text-[#6B7280] dark:text-[#9CA3AF]">
                  <button
                    onClick={() => handleCopy(displayResponse, message.id)}
                    className="flex items-center gap-1.5 text-[#6B7280] dark:text-[#9CA3AF] hover:text-[#1F2937] dark:hover:text-[#ECEBE8] hover:bg-[#F3F4F6] dark:hover:bg-[#262624] transition-colors py-1 px-2 rounded-lg"
                    title={t('copy')}
                  >
                    {copiedId === message.id ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-[#047857]" />
                        <span className="text-[#047857] font-semibold">{t('copied')}</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>{t('copy')}</span>
                      </>
                    )}
                  </button>
                  <span className="font-mono text-[11px] text-[#9CA3AF] dark:text-[#6B7280] select-none">
                    {new Date(message.timestamp).toLocaleTimeString(
                      settings.language === 'uz' ? 'uz-UZ' : settings.language === 'ru' ? 'ru-RU' : 'en-US',
                      { hour: '2-digit', minute: '2-digit' }
                    )}
                  </span>
                </div>
              )}
            </div>
          </div>
        );
      })}
        <div ref={scrollEndRef} />
      </div>
    </div>
  );
};
